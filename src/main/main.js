const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, nativeImage, session, safeStorage, shell } = require('electron');
const { SqliteStore, DEFAULT_DATA } = require('./store');
const { PlatformClient } = require('./platform-client');
const { PlatformSession, SafeStorageTokenStore } = require('./platform-session');
const { PlatformService } = require('./platform-service');
const { platformConfigFor } = require('./platform-config');
const { normalizeMerchantProfile, findMerchantProfileInPayloads } = require('./merchant-profile');
const { PddActivityAdapter, AdapterNotConfiguredError } = require('./pdd-adapter');
const { SyncQueue } = require('./sync-queue');
const { assertWebhook, sendChannelTest, sendConfiguredNotifications } = require('./notifier');
const { MonitorScheduler } = require('./scheduler');
const {
  reconcileProducts,
  buildStatusAlert,
  buildActivitySummaryAlert,
  buildAccountOfflineAlert,
  isAbnormalActivityProduct,
  hasAbnormalActivityProducts
} = require('./product-monitor');

const MERCHANT_URL = 'https://mms.pinduoduo.com/';
const BID_PAGE_URL = 'https://mms.pinduoduo.com/act-bidding/market-sign-list?activity_status=IN_PROGRESS';
const MAX_ACCOUNTS = 10;
const APP_NAME = 'Elunvi Mart';

app.setName(APP_NAME);

let mainWindow;
let store;
let platformService;
let platformSession;
let platformConfig;
let userDataRoot;
let activePlatformUserId = null;
let scheduler;
let syncQueue;
const loginWindows = new Map();
const antiContentByAccount = new Map();
const configuredPartitions = new Set();
const manualSyncAtByAccount = new Map();
const MANUAL_SYNC_COOLDOWN_MS = 60_000;

function rendererPath(file) {
  return path.join(__dirname, '..', 'renderer', file);
}

function appIconPath() {
  return rendererPath('assets/elunvi-mart.png');
}

function dockIconPath() {
  return rendererPath('assets/elunvi-mart-dock.png');
}

function legacyOwnerPath() {
  return path.join(userDataRoot, 'monitor-owner.json');
}

function userStorePath(userId) {
  const legacyDatabase = path.join(userDataRoot, 'monitor.db');
  let legacyOwner = null;
  try { legacyOwner = JSON.parse(fs.readFileSync(legacyOwnerPath(), 'utf8')).userId || null; } catch {}
  if ((!legacyOwner || legacyOwner === userId) && fs.existsSync(legacyDatabase)) {
    if (!legacyOwner) fs.writeFileSync(legacyOwnerPath(), JSON.stringify({ userId }), { mode: 0o600 });
    return legacyDatabase;
  }
  return path.join(userDataRoot, 'users', userId, 'monitor.db');
}

function closeActiveStore() {
  scheduler?.stop();
  syncQueue?.cancelAll();
  store?.close();
  store = null;
  activePlatformUserId = null;
}

function activateUserStore(userId) {
  if (activePlatformUserId === userId && store) return;
  closeActiveStore();
  const filePath = userStorePath(userId);
  store = new SqliteStore(filePath);
  activePlatformUserId = userId;
  scheduler?.configure(store.getSettings());
  scheduler?.refreshAccounts();
}

function requireSignedInStore() {
  if (!platformService || !activePlatformUserId || !store) throw new Error('请先登录 Elunvi 账号');
  return store;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    title: APP_NAME,
    icon: appIconPath(),
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: rendererPath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(rendererPath('index.html'));
}

function accountPartition(accountId) {
  return `persist:pdd-account-${accountId}`;
}

function configureMerchantSession(partition, accountId) {
  const merchantSession = session.fromPartition(partition);
  merchantSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  if (configuredPartitions.has(partition)) return merchantSession;
  configuredPartitions.add(partition);
  merchantSession.webRequest.onBeforeSendHeaders({ urls: ['*://mms.pinduoduo.com/lakemms/bid/query/bidList*'] }, (details, callback) => {
    const antiContentEntry = Object.entries(details.requestHeaders).find(([name]) => name.toLowerCase() === 'anti-content');
    if (antiContentEntry?.[1]) antiContentByAccount.set(accountId, String(antiContentEntry[1]));
    callback({ requestHeaders: details.requestHeaders });
  });
  return merchantSession;
}

function createLoginWindow(accountId, { deferNavigation = false, show = true } = {}) {
  const existing = loginWindows.get(accountId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }
  const partition = accountPartition(accountId);
  configureMerchantSession(partition, accountId);
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    title: `${APP_NAME} - 拼多多商家后台登录`,
    icon: appIconPath(),
    show,
    webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname;
      if (hostname === 'mms.pinduoduo.com' || hostname.endsWith('.pinduoduo.com')) return { action: 'allow' };
    } catch {}
    return { action: 'deny' };
  });
  if (!deferNavigation) window.loadURL(MERCHANT_URL);
  window.on('closed', () => {
    loginWindows.delete(accountId);
    antiContentByAccount.delete(accountId);
  });
  loginWindows.set(accountId, window);
  return window;
}

async function ensureBidPage(accountId, window, { refresh = false } = {}) {
  if (!window || window.isDestroyed()) throw new AdapterNotConfiguredError();
  const currentUrl = window.webContents.getURL();
  if (refresh || !currentUrl.includes('/act-bidding/market-sign-list')) {
    antiContentByAccount.delete(accountId);
    await new Promise((resolve, reject) => {
      const onFinished = () => { cleanup(); resolve(); };
      const onFailed = (_event, errorCode, errorDescription) => {
        cleanup();
        reject(new Error(`拼多多营销竞价页面加载失败（${errorCode}: ${errorDescription}）`));
      };
      const cleanup = () => {
        window.webContents.removeListener('did-finish-load', onFinished);
        window.webContents.removeListener('did-fail-load', onFailed);
      };
      window.webContents.once('did-finish-load', onFinished);
      window.webContents.once('did-fail-load', onFailed);
      window.loadURL(BID_PAGE_URL).catch(error => { cleanup(); reject(error); });
    });
  }
  const deadline = Date.now() + 15_000;
  while (!antiContentByAccount.has(accountId) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

function isMerchantLoggedIn(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname === 'mms.pinduoduo.com' && !url.pathname.toLowerCase().includes('login');
  } catch {
    return false;
  }
}

async function readMerchantProfile(window) {
  const apiProfiles = await window.webContents.executeJavaScript(`(async () => {
    const requests = [
      '/earth/api/mallInfo/commonMallInfo',
      '/earth/api/mallInfo/querySimpleCredential'
    ];
    const payloads = [];
    for (const path of requests) {
      try {
        const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) continue;
        const payload = await response.json();
        if (payload?.success === false) continue;
        payloads.push(payload);
      } catch {}
    }
    return payloads;
  })()`);
  const apiProfile = findMerchantProfileInPayloads(apiProfiles);
  if (apiProfile.displayName && apiProfile.mallId) return apiProfile;

  const pageProfile = await window.webContents.executeJavaScript(`(() => {
    const firstText = (selectors) => selectors.map((selector) => document.querySelector(selector)?.textContent?.trim()).find(Boolean) || '';
    const firstAttribute = (selectors, attribute) => selectors.map((selector) => document.querySelector(selector)?.getAttribute(attribute)).find(Boolean) || '';
    const displayName = firstText([
      '[data-testid*="shop"]', '[data-testid*="store"]', '[class*="shop-name"]', '[class*="store-name"]',
      '[class*="merchant-name"]', '[class*="shopName"]', '[class*="storeName"]'
    ]);
    const avatarUrl = firstAttribute([
      '[data-testid*="avatar"] img', '[class*="avatar"] img', '[class*="shop-logo"] img', '[class*="store-logo"] img'
    ], 'src') || document.querySelector('meta[property="og:image"]')?.content || '';
    const mallId = firstText([
      '[data-testid*="mall"]', '[data-testid*="shop-id"]', '[class*="mall-id"]', '[class*="shop-id"]'
    ]);
    return { displayName, avatarUrl, mallId, title: document.title };
  })()`);
  const normalized = normalizeMerchantProfile({
    displayName: pageProfile.displayName || apiProfile.displayName,
    avatarUrl: pageProfile.avatarUrl || apiProfile.avatarUrl,
    mallId: pageProfile.mallId || apiProfile.mallId
  });
  if (!normalized.displayName) {
    const title = String(pageProfile?.title || '').replace(/[-|｜].*$/, '').trim();
    normalized.displayName = title && !/拼多多|商家后台/.test(title) ? title : '';
  }
  return normalized;
}

function publicSettings(settings) {
  const copy = structuredClone(settings);
  for (const kind of ['wecom', 'dingtalk']) {
    const value = copy.notifications[kind];
    for (const key of ['webhook', 'secret']) {
      if (!value[key] || !value[key].startsWith('encrypted:')) continue;
      try {
        value[key] = safeStorage.decryptString(Buffer.from(value[key].slice(10), 'base64'));
      } catch {
        value[key] = '';
      }
    }
  }
  return copy;
}

function protectedSettings(settings) {
  const copy = structuredClone(settings);
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储暂不可用，无法保存 Webhook 配置');
  for (const kind of ['wecom', 'dingtalk']) {
    for (const key of ['webhook', 'secret']) {
      const value = copy.notifications[kind][key];
      copy.notifications[kind][key] = value
        ? `encrypted:${safeStorage.encryptString(value).toString('base64')}`
        : '';
    }
  }
  return copy;
}

function validateSettings(input) {
  const min = Number(input.intervalMinMinutes);
  const max = Number(input.intervalMaxMinutes);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max > 1440 || min > max) {
    throw new Error('检测间隔范围无效');
  }
  const settings = {
    intervalMinMinutes: min,
    intervalMaxMinutes: max,
    notifications: {
      desktop: Boolean(input.notifications?.desktop),
      wecom: {
        enabled: Boolean(input.notifications?.wecom?.enabled),
        webhook: String(input.notifications?.wecom?.webhook || '').trim()
      },
      dingtalk: {
        enabled: Boolean(input.notifications?.dingtalk?.enabled),
        webhook: String(input.notifications?.dingtalk?.webhook || '').trim(),
        secret: String(input.notifications?.dingtalk?.secret || '').trim()
      }
    }
  };
  for (const kind of ['wecom', 'dingtalk']) {
    const config = settings.notifications[kind];
    if (config.enabled && !config.webhook) throw new Error(`请填写${kind === 'wecom' ? '企业微信' : '钉钉'}机器人 Webhook`);
    if (config.webhook) assertWebhook(kind, config.webhook);
  }
  return settings;
}

async function syncAccount(adapter, accountId, source = 'manual') {
  return syncQueue.run(accountId, async (signal) => {
    const account = store.getAccount(accountId);
    if (!account) throw new Error('商家账号不存在');
    const loginWindow = loginWindows.get(accountId);
    if (!loginWindow || loginWindow.isDestroyed()) createLoginWindow(accountId, { deferNavigation: true, show: false });
    try {
      const incomingProducts = await adapter.syncProducts(account, { signal });
      signal.throwIfAborted();
      if (!store.getAccount(accountId)) throw new Error('商家账号已移除');
      const now = new Date().toISOString();
      const reconciliation = reconcileProducts(store.getProducts(accountId), incomingProducts, now);
      store.setProducts(accountId, reconciliation.products);
      store.updateAccount(accountId, { status: 'active', lastSyncAt: now, productCount: reconciliation.products.length, lastSyncSource: source, lastSyncError: '' });
      sendToRenderer('accounts:changed');
      const notificationErrors = [];
      for (const change of reconciliation.changes) {
        signal.throwIfAborted();
        notificationErrors.push(...await sendConfiguredNotifications(publicSettings(store.getSettings()), buildStatusAlert(account, change)));
      }
      signal.throwIfAborted();
      if (hasAbnormalActivityProducts(reconciliation.products)) {
        notificationErrors.push(...await sendConfiguredNotifications(publicSettings(store.getSettings()), buildActivitySummaryAlert(account, reconciliation.products)));
      }
      return { ok: true, source: 'api', products: reconciliation.products, syncedAt: now, notificationErrors };
    } catch (error) {
      if (signal.aborted || !store.getAccount(accountId)) throw error;
      if (isAccountOfflineError(error)) await markAccountOffline(account, error, source);
      signal.throwIfAborted();
      if (!store.getAccount(accountId)) throw error;
      store.updateAccount(accountId, { lastSyncError: error.message, lastSyncSource: source });
      sendToRenderer('accounts:changed');
      throw error;
    }
  }, { source });
}

function isAccountOfflineError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (error instanceof AdapterNotConfiguredError) return true;
  return /http\s*(401|403)|未登录|登录失效|账号失效|凭证失效|身份验证失败/.test(message);
}

async function markAccountOffline(account, error, source) {
  const current = store.getAccount(account.id);
  if (!current) return;
  const wasOnline = current.status === 'active';
  store.updateAccount(account.id, {
    status: 'needs_login',
    syncStatus: 'error',
    lastSyncError: error.message,
    lastSyncSource: source
  });
  sendToRenderer('accounts:changed');
  if (wasOnline) {
    await sendConfiguredNotifications(publicSettings(store.getSettings()), buildAccountOfflineAlert(account));
  }
}

function enforceManualSyncCooldown(accountId) {
  const lastSyncAt = manualSyncAtByAccount.get(accountId) || 0;
  const remainingMs = MANUAL_SYNC_COOLDOWN_MS - (Date.now() - lastSyncAt);
  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    throw new Error(`同步操作冷却中，请在 ${seconds} 秒后再试`);
  }
  manualSyncAtByAccount.set(accountId, Date.now());
}

function registerIpc(adapter) {
  ipcMain.handle('platform:state', async () => {
    if (!platformService || !(await platformSession.accessToken())) return { status: 'signed_out' };
    try {
      const profile = await platformService.getProfile();
      activateUserStore(profile.userId);
      return { status: 'signed_in', profile };
    } catch (error) {
      if (['AUTH_REQUIRED', 'authentication_required'].includes(error.code) || error.status === 401) {
        await platformService.logout();
        closeActiveStore();
        return { status: 'signed_out' };
      }
      return { status: 'error', message: error.message || '暂时无法连接 Elunvi Platform' };
    }
  });
  ipcMain.handle('platform:login', async (_event, { email, password }) => {
    const profile = await platformService.loginWithPassword(String(email || '').trim(), String(password || ''));
    activateUserStore(profile.userId);
    sendToRenderer('platform:changed', { status: 'signed_in', profile });
    return { status: 'signed_in', profile };
  });
  ipcMain.handle('platform:requestRegistrationCode', (_event, email) => platformService.requestRegistrationCode(String(email || '').trim()));
  ipcMain.handle('platform:completeRegistration', async (_event, input) => {
    const profile = await platformService.completeRegistration(input || {});
    activateUserStore(profile.userId);
    sendToRenderer('platform:changed', { status: 'signed_in', profile });
    return { status: 'signed_in', profile };
  });
  ipcMain.handle('platform:requestPasswordResetCode', (_event, email) => platformService.requestPasswordResetCode(String(email || '').trim()));
  ipcMain.handle('platform:resetPassword', (_event, input) => platformService.resetPassword(input || {}));
  ipcMain.handle('platform:wechatStart', () => platformService.startWechatLogin());
  ipcMain.handle('platform:wechatPoll', async () => {
    const result = await platformService.pollWechatLogin();
    if (result.state === 'signed_in') {
      activateUserStore(result.profile.userId);
      sendToRenderer('platform:changed', { status: 'signed_in', profile: result.profile });
    }
    return result;
  });
  ipcMain.handle('platform:emailBindingCode', (_event, email) => platformService.requestEmailBindingCode(String(email || '').trim()));
  ipcMain.handle('platform:emailBindingComplete', async (_event, input) => {
    const profile = await platformService.completeEmailBinding(input || {});
    activateUserStore(profile.userId);
    sendToRenderer('platform:changed', { status: 'signed_in', profile });
    return { status: 'signed_in', profile };
  });
  ipcMain.handle('platform:wechatCancel', () => platformService.cancelWechatLogin());
  ipcMain.handle('platform:logout', async () => {
    await platformService.logout();
    closeActiveStore();
    sendToRenderer('platform:changed', { status: 'signed_out' });
    return { status: 'signed_out' };
  });
  ipcMain.handle('platform:profile', () => platformService.getProfile());
  ipcMain.handle('platform:security', () => platformService.getSecurity());
  ipcMain.handle('platform:team', async () => ({
    accountState: await platformService.getTeamAccountState(),
    teams: await platformService.getTeams()
  }));
  ipcMain.handle('platform:teamMembers', (_event, teamId) => platformService.getTeamMembers(String(teamId)));
  ipcMain.handle('platform:createTeam', (_event, name) => platformService.createTeam(String(name || '')));
  ipcMain.handle('platform:addTeamMember', (_event, input) => platformService.addTeamMember(input || {}));
  ipcMain.handle('platform:respondTeamRequest', (_event, input) => platformService.respondToTeamRequest(String(input.requestId), input.action));
  ipcMain.handle('platform:billingContexts', () => platformService.getBillingContexts());
  ipcMain.handle('platform:wallet', (_event, walletOwnerId) => platformService.getWallet(String(walletOwnerId)));
  ipcMain.handle('platform:walletTransactions', (_event, cursor) => platformService.getWalletTransactions(cursor ? String(cursor) : null));
  ipcMain.handle('platform:teamHistory', (_event, { teamId, kind, cursor }) => platformService.getTeamHistory(String(teamId), kind, cursor ? String(cursor) : null));
  ipcMain.handle('platform:packages', (_event, amountFen) => platformService.listPaymentPackages(amountFen ? String(amountFen) : null));
  ipcMain.handle('platform:createCheckout', (_event, input) => platformService.createCheckout(input));
  ipcMain.handle('platform:createPaymentAttempt', (_event, input) => platformService.createPaymentAttempt(String(input.checkoutId), input.channel));
  ipcMain.handle('platform:getCheckout', (_event, input) => platformService.getCheckout(String(input.checkoutId), input.paymentContext || null));
  ipcMain.handle('platform:closeCheckout', (_event, checkoutId) => platformService.closeCheckout(String(checkoutId)));
  ipcMain.handle('platform:openPayment', async (_event, paymentUrl) => {
    const value = String(paymentUrl || '');
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('支付入口地址无效'); }
    const safe = parsed.protocol === 'weixin:' || parsed.protocol === 'elunvi-pay:' || (parsed.protocol === 'https:' && (parsed.hostname === 'alipay.com' || parsed.hostname.endsWith('.alipay.com')));
    if (!safe) throw new Error('支付入口地址不受支持');
    await shell.openExternal(parsed.toString());
    return true;
  });

  ipcMain.handle('accounts:list', () => requireSignedInStore().getAccounts().map((account) => ({
    ...account,
    abnormalProductCount: store.getProducts(account.id).filter(isAbnormalActivityProduct).length
  })));
  ipcMain.handle('accounts:startLogin', (_event, accountId) => {
    requireSignedInStore();
    let id = accountId;
    if (!id) {
      if (store.getAccounts().length >= MAX_ACCOUNTS) throw new Error('单个客户端最多添加 10 个商家账号');
      if (loginWindows.size >= MAX_ACCOUNTS) throw new Error('已打开 10 个待登录窗口，请先完成或关闭其中的登录');
      id = crypto.randomUUID();
    }
    createLoginWindow(id);
    return { accountId: id };
  });
  ipcMain.handle('accounts:completeLogin', async (_event, { accountId }) => {
    requireSignedInStore();
    const window = loginWindows.get(accountId);
    if (!window || window.isDestroyed()) throw new Error('登录窗口已关闭，请重新打开');
    const currentUrl = window.webContents.getURL();
    if (!isMerchantLoggedIn(currentUrl)) throw new Error('尚未检测到商家后台登录成功');
    const existing = store.getAccount(accountId);
    const profile = await readMerchantProfile(window);
    if (!profile.displayName && !existing?.displayName) throw new Error('未能读取店铺资料，请确认已进入拼多多商家后台首页后重试');
    const duplicate = store.findAccountByMallId(profile.mallId, accountId);
    if (duplicate) throw new Error('店铺已经添加过了');
    if (syncQueue?.isRunning(accountId)) throw new Error('该账号同步进行中，请稍后完成登录');
    antiContentByAccount.delete(accountId);
    const now = new Date().toISOString();
    const account = store.upsertAccount({
      id: accountId,
      displayName: profile.displayName || existing.displayName,
      avatarUrl: profile.avatarUrl || existing?.avatarUrl || '',
      mallId: profile.mallId || existing?.mallId || '',
      status: 'active',
      productCount: existing?.productCount || store.getProducts(accountId).length,
      lastSyncAt: existing?.lastSyncAt || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    window.hide();
    sendToRenderer('accounts:changed');
    scheduler?.refreshAccounts();
    return account;
  });
  ipcMain.handle('accounts:remove', (_event, accountId) => {
    requireSignedInStore();
    syncQueue?.cancel(accountId);
    store.removeAccount(accountId);
    manualSyncAtByAccount.delete(accountId);
    const window = loginWindows.get(accountId);
    if (window && !window.isDestroyed()) window.close();
    antiContentByAccount.delete(accountId);
    sendToRenderer('accounts:changed');
    scheduler?.refreshAccounts();
    return true;
  });
  ipcMain.handle('products:list', (_event, accountId) => requireSignedInStore().getProducts(accountId));
  ipcMain.handle('products:sync', (_event, accountId) => {
    requireSignedInStore();
    enforceManualSyncCooldown(accountId);
    return syncAccount(adapter, accountId);
  });
  ipcMain.handle('settings:get', () => publicSettings(requireSignedInStore().getSettings()));
  ipcMain.handle('settings:save', (_event, input) => {
    requireSignedInStore();
    const validated = validateSettings(input);
    const saved = store.setSettings(protectedSettings(validated));
    scheduler.configure(publicSettings(saved));
    return publicSettings(saved);
  });
  ipcMain.handle('notifications:test', async (_event, { kind, config }) => {
    requireSignedInStore();
    if (!['wecom', 'dingtalk'].includes(kind)) throw new Error('不支持的提醒方式');
    await sendChannelTest(kind, config);
    return true;
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.setIcon(nativeImage.createFromPath(dockIconPath()));
  userDataRoot = app.getPath('userData');
  platformConfig = platformConfigFor(process.platform);
  platformSession = new PlatformSession({
    tokenStore: new SafeStorageTokenStore({
      filePath: path.join(userDataRoot, 'elunvi-platform-session.bin'),
      safeStorage
    })
  });
  const platformClient = new PlatformClient({
    apiBaseUrl: platformConfig.apiBaseUrl,
    clientId: platformConfig.clientId,
    session: platformSession
  });
  platformService = new PlatformService({ client: platformClient, session: platformSession, config: platformConfig });
  const adapter = new PddActivityAdapter({
    getLoginWindow: id => loginWindows.get(id),
    getAntiContent: id => antiContentByAccount.get(id) || '',
    ensureBidPage
  });
  syncQueue = new SyncQueue({
    loadState: (id) => store.getSyncState(id),
    saveState: (id, state) => { if (store) store.setSyncState(id, state); }
  });
  scheduler = new MonitorScheduler(async (accountId) => {
    if (!store) return;
    const account = store.getAccount(accountId);
    if (!account) return;
    if (account.status !== 'active') {
      await sendConfiguredNotifications(
        publicSettings(store.getSettings()),
        buildAccountOfflineAlert(account)
      );
      return;
    }
    try {
      await syncAccount(adapter, accountId, 'scheduled');
    } catch (error) {
      console.error(`Scheduled sync failed for ${accountId}:`, error.message);
    }
  }, () => store ? store.getAccounts() : [], { remainingMs: (id) => syncQueue.remainingMs(id) });
  registerIpc(adapter);
  scheduler.configure(DEFAULT_DATA.settings);
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  scheduler?.stop();
  syncQueue?.cancelAll();
  store?.close();
});
