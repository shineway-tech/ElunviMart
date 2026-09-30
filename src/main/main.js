const path = require('node:path');
const { initUpdater } = require('./updater');
const { fetchPolicy, isBelowMinVersion } = require('./app-policy');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, nativeImage, session, safeStorage, shell } = require('electron');
const { SqliteStore, DEFAULT_DATA } = require('./store');
const { PlatformClient } = require('./platform-client');
const { PlatformSession, SafeStorageTokenStore } = require('./platform-session');
const { PlatformService } = require('./platform-service');
const { platformConfigFor } = require('./platform-config');
const { MartClient } = require('./mart-client');
const { MartService } = require('./mart-service');
const { martConfigFor } = require('./mart-config');
const { normalizeMerchantProfile, findMerchantProfileInPayloads } = require('./merchant-profile');
const { PddActivityAdapter, AdapterNotConfiguredError } = require('./pdd-adapter');
const { buildDetailUrl, fetchDetailPage, isLoginPage, parseDetailTable } = require('./pdd-detail-page');
const { collectBidListPayloads } = require('./pdd-bid-page');
const { buildDetailReportHtml, diffDetailRows, detailIdsOf, isFullyWon, selectDetailCandidates, sweepStepMs } = require('./detail-monitor');
const { uploadReport } = require('./report-upload');
const { SyncQueue } = require('./sync-queue');
const { assertWebhook, sendChannelTest, sendConfiguredNotifications } = require('./notifier');
const { MonitorScheduler } = require('./scheduler');
const {
  reconcileProducts,
  buildActivitySummaryAlert,
  buildAccountOfflineAlert,
  isAbnormalActivityProduct,
  hasAbnormalActivityProducts
} = require('./product-monitor');

const MERCHANT_URL = 'https://mms.pinduoduo.com/';
const MERCHANT_HOME_URL = 'https://mms.pinduoduo.com/home/';
const PRICE_LINK_HOSTS = ['jd.com', 'taobao.com', 'tmall.com'];
const MAX_ACCOUNTS = 10;
const APP_NAME = 'Elunvi Mart';

app.setName(APP_NAME);

let mainWindow;
let store;
let platformService;
let platformSession;
let platformConfig;
let martService;
let martSession;
let martClientInstance = null;
let userDataRoot;
let activePlatformUserId = null;
let scheduler;
let updater = null;
let policyTimer = null;
let syncQueue;
const loginWindows = new Map();
const configuredPartitions = new Set();
const manualSyncAtByAccount = new Map();
const MANUAL_SYNC_COOLDOWN_MS = 120_000;
const detailFetchingByAccount = new Set();
const detailSweepRunning = new Set();
const DETAIL_CACHE_TTL_MS = 2 * 60_000;

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

function requiresEmailBinding(security) {
  return Array.isArray(security?.availableActions) && security.availableActions.includes('bind_email');
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// 版本与计费策略：后端可以要求低于某个版本的客户端先更新（configs 的 app.min_client_version）
// 比价单价的客户端展示值也来自这里，取不到就按 10
let clientPolicy = null;

async function checkVersionPolicy() {
  const policy = await fetchPolicy({ apiBaseUrl: martConfigFor().apiBaseUrl });
  if (policy) clientPolicy = policy;
  if (policy && app.isPackaged && isBelowMinVersion(app.getVersion(), policy.minClientVersion)) {
    sendToRenderer('app:force-update', {
      currentVersion: app.getVersion(),
      minVersion: policy.minClientVersion,
      note: policy.note,
      downloadUrl: policy.downloadUrl,
      portable: Boolean(updater?.portable)
    });
  }
  return policy;
}

// 手动检查：先看版本策略，再问更新源；返回值给渲染层决定提示文案
async function runUpdateCheck() {
  const currentVersion = app.getVersion();
  if (!app.isPackaged) return { status: 'dev', currentVersion };
  const policy = await checkVersionPolicy();
  if (policy && isBelowMinVersion(currentVersion, policy.minClientVersion)) {
    return { status: 'force', currentVersion, minVersion: policy.minClientVersion };
  }
  if (!updater?.enabled) return { status: 'disabled', currentVersion };
  const result = await updater.checkNow();
  return { ...result, currentVersion, portable: Boolean(updater.portable) };
}

// 免安装版装不了更新，只能引导用户去固定下载地址
function updateDownloadUrl() {
  try {
    return String(require('../../package.json').build.publish[0].url || '');
  } catch {
    return '';
  }
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

function configureMerchantSession(partition) {
  const merchantSession = session.fromPartition(partition);
  merchantSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  if (configuredPartitions.has(partition)) return merchantSession;
  configuredPartitions.add(partition);
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
  configureMerchantSession(partition);
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    title: `${APP_NAME} - 拼多多商家后台登录`,
    icon: appIconPath(),
    show,
    webPreferences: {
      partition,
      preload: path.join(__dirname, 'pdd-page-hook.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
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
  });
  loginWindows.set(accountId, window);
  return window;
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
  // 店铺资料全部取自页面自身状态（localStorage / DOM / 钩子记录的页面响应），我们不自己调接口
  const pageData = await window.webContents.executeJavaScript(`(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('new_userinfo') || 'null'); } catch {}
    const mall = (stored && stored.mall) || {};
    const firstText = (selectors) => selectors.map((selector) => document.querySelector(selector)?.textContent?.trim()).find(Boolean) || '';
    const firstAttribute = (selectors, attribute) => selectors.map((selector) => document.querySelector(selector)?.getAttribute(attribute)).find(Boolean) || '';
    return {
      displayName: String(mall.mall_name || '').trim() || firstText(['.user-name-text', '[class*="shop-name"]', '[class*="store-name"]', '[class*="merchant-name"]']),
      avatarUrl: String(mall.logo || '').trim() || firstAttribute(['.avatar img', '[class*="avatar"] img', '[class*="shop-logo"] img'], 'src'),
      mallId: mall.mall_id ?? stored?.mall_id ?? '',
      title: document.title
    };
  })()`).catch(() => ({}));
  const capturedProfiles = await window.webContents
    .executeJavaScript('(() => (window.__cueMallInfo || []).map((entry) => entry.payload))()')
    .catch(() => []);
  const apiProfile = findMerchantProfileInPayloads(Array.isArray(capturedProfiles) ? capturedProfiles : []);
  const normalized = normalizeMerchantProfile({
    displayName: pageData.displayName || apiProfile.displayName,
    avatarUrl: pageData.avatarUrl || apiProfile.avatarUrl,
    mallId: pageData.mallId || apiProfile.mallId
  });
  if (!normalized.displayName) {
    const title = String(pageData?.title || '').replace(/[-|｜].*$/, '').trim();
    normalized.displayName = title && !/拼多多|商家后台/.test(title) ? title : '';
  }
  return normalized;
}

// 每个店铺可以单独关掉通知：所有按店铺发的提醒都走这里
async function sendAccountNotifications(account, message) {
  if (account && account.notificationsEnabled === false) return [];
  return sendConfiguredNotifications(publicSettings(store.getSettings()), message);
}

// 详情页掉登录：跟列表同步一样要能标记掉线（accountOffline 标记交给 isAccountOfflineError 识别）
function merchantLoginExpiredError() {
  const error = new Error('拼多多商家后台登录状态已失效，请重新登录后恢复监控');
  error.accountOffline = true;
  return error;
}

async function fetchDetailRows(accountId, product) {
  const ids = detailIdsOf(product);
  if (!ids) throw new Error('这个商品的报名 ID 不完整，暂时看不了报名详情');
  const { table, pageText, finalUrl, loginRequired } = await fetchDetailPage({
    partition: accountPartition(accountId),
    url: buildDetailUrl(ids)
  });
  if (loginRequired || isLoginPage({ url: finalUrl, text: pageText })) throw merchantLoginExpiredError();
  if (!table) throw new Error(pageText ? `商家后台这次没打开报名详情（页面提示：${String(pageText).slice(0, 60)}）` : '商家后台没有返回报名详情，请稍后再试');
  return parseDetailTable(table);
}

// 抓一次 + 落库 + 与上一份快照对比出 SKU 中标变化（手动查看与自动巡检共用）
async function refreshProductDetail(accountId, product) {
  const previous = store.getProductDetail(accountId, product.id);
  let rows;
  try {
    rows = await fetchDetailRows(accountId, product);
  } catch (error) {
    // 详情这条路也得把账号标成"需要重新登录"，否则列表一直显示登录正常
    if (isAccountOfflineError(error)) {
      const account = store.getAccount(accountId);
      if (account) await markAccountOffline(account, error, 'detail');
    }
    throw error;
  }
  const changedAt = new Date().toISOString();
  store.setProductDetail(accountId, product.id, { rows, fetchedAt: changedAt });
  const changes = diffDetailRows(previous?.rows, rows, changedAt);
  if (changes.length) store.addProductDetailChanges(accountId, product.id, changes);
  return { rows, changes };
}

// 每轮变化：生成 HTML 报告（上传 OSS 后把链接放进提醒；上传失败就发文字摘要）
async function publishDetailReport(account, changes, roundAt) {
  const title = `拼多多中标变化：${account.displayName}`;
  let link = '';
  try {
    const html = buildDetailReportHtml(account, changes, roundAt);
    link = await uploadReport(martClientInstance, { title, html });
  } catch (error) {
    console.error('detail report upload failed:', error?.message || error);
  }
  // 通知里只摘要前 2 条，其余看报告链接
  const lines = changes.slice(0, 2).map((change) => `· ${change.productName}｜${change.target || '规格'}：${change.from} → ${change.to}`);
  if (changes.length > lines.length) lines.push(`· 另外还有 ${changes.length - lines.length} 项变化`);
  lines.push(`共 ${changes.length} 项`);
  if (link) lines.push(`详情：${link}`);
  const errors = await sendAccountNotifications(account, { title, body: lines.join('\n') });
  return { link, notificationErrors: errors };
}

// 后台巡检：按设置挑商品、平摊间隔逐个抓详情并比对
async function runDetailSweep(accountId) {
  if (detailSweepRunning.has(accountId)) return { changes: [] };
  detailSweepRunning.add(accountId);
  try {
    const account = store.getAccount(accountId);
    if (!account || account.status !== 'active') return { changes: [] };
    const settings = store.getSettings();
    const intervalMs = Math.max(5, Number(settings.detailIntervalMinutes) || 30) * 60_000;
    // 0（或未设置）= 每轮覆盖全部到期商品
    const configuredBatch = Number(settings.detailBatchSize);
    const batchSize = Number.isFinite(configuredBatch) && configuredBatch > 0 ? Math.min(200, configuredBatch) : 0;
    const products = store.getProducts(accountId);
    const detailByProductId = {};
    for (const product of products) detailByProductId[String(product.id)] = store.getProductDetail(accountId, product.id);
    const batch = selectDetailCandidates({ products, detailByProductId, intervalMs, batchSize });
    if (!batch.length) return { changes: [] };
    const cycleMinutes = ((Number(settings.intervalMinMinutes) || 30) + (Number(settings.intervalMaxMinutes) || 60)) / 2;
    const roundChanges = [];
    for (const [index, product] of batch.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, sweepStepMs({ batchSize: batch.length, cycleMinutes })));
      try {
        const result = await refreshProductDetail(accountId, product);
        const skuImageBySpec = new Map();
        for (const row of result.rows) {
          skuImageBySpec.set(String(row.referenceSpec || row.bidSpec || ''), row.referenceImage || row.bidImage || '');
        }
        for (const change of result.changes) {
          roundChanges.push({
            ...change,
            productId: String(product.id),
            productName: product.myBidProductName || product.name || product.id,
            productCode: product.myBidProductId || product.id,
            productImage: product.imageUrl || product.templateImageUrl || '',
            activityName: product.activityName || '',
            activityId: product.activityId || '',
            skuImage: skuImageBySpec.get(String(change.target || '')) || ''
          });
        }
      } catch (error) {
        if (isAccountOfflineError(error)) {
          console.error(`detail sweep stopped at ${product.id}: 账号需要重新登录`);
          break;
        }
        console.error(`detail sweep failed for ${product.id}:`, error.message);
      }
    }
    if (roundChanges.length) await publishDetailReport(account, roundChanges, new Date().toISOString());
    return { changes: roundChanges };
  } finally {
    detailSweepRunning.delete(accountId);
  }
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
  // 检测间隔按 30 分钟一档
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 30 || max > 1440 || min > max || min % 30 !== 0 || max % 30 !== 0) {
    throw new Error('检测间隔需要是 30 分钟的整数倍（30–1440 分钟）');
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
    if (config.enabled && !config.webhook) throw new Error(`请填写${kind === 'wecom' ? '企业微信' : '钉钉'}的机器人 Webhook 地址`);
    if (config.webhook) assertWebhook(kind, config.webhook);
  }
  return settings;
}

async function syncAccount(adapter, accountId, source = 'manual') {
  return syncQueue.run(accountId, async (signal) => {
    const account = store.getAccount(accountId);
    if (!account) throw new Error('商家账号不存在');
    try {
      const incomingProducts = await adapter.syncProducts(account, { signal });
      signal.throwIfAborted();
      if (!store.getAccount(accountId)) throw new Error('商家账号已移除');
      const now = new Date().toISOString();
      const reconciliation = reconcileProducts(store.getProducts(accountId), incomingProducts, now);
      store.setProducts(accountId, reconciliation.products);
      store.updateAccount(accountId, { status: 'active', lastSyncAt: now, productCount: reconciliation.products.length, lastSyncSource: source, lastSyncError: '' });
      sendToRenderer('accounts:changed');
      // 逐条掉标提醒已按要求去掉，只保留异常汇总
      const notificationErrors = [];
      if (hasAbnormalActivityProducts(reconciliation.products)) {
        notificationErrors.push(...await sendAccountNotifications(account, buildActivitySummaryAlert(account, reconciliation.products)));
      }
      // 只有自动检测才在后台补抓详情；手动同步只更新商品列表
      if (source === 'scheduled') void runDetailSweep(accountId);
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
  if (error?.accountOffline === true) return true;
  if (error instanceof AdapterNotConfiguredError) return error.accountOffline !== false;
  if ([401, 403].includes(Number(error?.status))) return true;
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
    // 掉线提醒发失败（企业微信关键词/机器人被改之类）必须留痕，否则用户以为通知正常
    const errors = await sendAccountNotifications(account, buildAccountOfflineAlert(account));
    if (errors.length) console.error('offline alert failed:', errors.join('; '));
  }
}

function enforceManualSyncCooldown(accountId) {
  const lastSyncAt = manualSyncAtByAccount.get(accountId) || 0;
  const remainingMs = MANUAL_SYNC_COOLDOWN_MS - (Date.now() - lastSyncAt);
  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    throw new Error(`刚刚已经同步过了，请在 ${seconds} 秒后再试`);
  }
  manualSyncAtByAccount.set(accountId, Date.now());
}

// 界面偏好只允许 ui. 前缀，避免渲染层往本地库写任意键
function requireUiPreferenceKey(key) {
  const value = String(key || '');
  if (!value.startsWith('ui.')) throw new Error('不支持的界面配置项');
  return value;
}

function parseAlipayUrl(payUrl) {
  const value = String(payUrl || '');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('支付地址无效'); }
  const isAlipay = parsed.protocol === 'https:' && (parsed.hostname === 'alipay.com' || parsed.hostname.endsWith('.alipay.com'));
  if (!isAlipay) throw new Error('不支持打开该支付地址');
  return parsed;
}

let payWindow = null;

// 支付宝 qr_pay_mode=4 返回的是纯二维码页面，放进独立窗口让用户直接扫码
function openPayWindow(payUrl) {
  const parsed = parseAlipayUrl(payUrl);
  if (payWindow && !payWindow.isDestroyed()) {
    payWindow.loadURL(parsed.toString());
    payWindow.show();
    payWindow.focus();
    return true;
  }
  payWindow = new BrowserWindow({
    width: 380,
    height: 470,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: `${APP_NAME} - 支付宝扫码支付`,
    icon: appIconPath(),
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  payWindow.loadURL(parsed.toString());
  payWindow.on('closed', () => {
    payWindow = null;
    // 关闭扫码窗口后让渲染层查一次单，支付完成即可直接到账
    sendToRenderer('mart:payWindowClosed');
  });
  return true;
}

// 平台 access token 临近过期时先借 PlatformClient 的 401 重试刷新，保证换取的凭据不会立刻过期
async function ensureFreshPlatformToken() {
  const tokens = await platformSession.tokens();
  const expiresAt = tokens?.accessExpiresAt ? Date.parse(tokens.accessExpiresAt) : 0;
  if (!expiresAt || expiresAt - Date.now() < 60_000) {
    await platformService.getProfile();
  }
}

// 平台登录成功后建立 Mart 会话；Mart 不可用不影响本地监控功能，失败只记录并通知渲染层
async function linkMartSession() {
  if (!martService) return null;
  try {
    await ensureFreshPlatformToken();
    const summary = await martService.linkFromPlatform();
    sendToRenderer('mart:changed', { linked: true, ...summary });
    return summary;
  } catch (error) {
    console.error('Mart session link failed:', error.message);
    sendToRenderer('mart:changed', { linked: false, error: error.message });
    return null;
  }
}

async function announceSignedIn({ profile, security, accountEmail }) {
  await linkMartSession();
  sendToRenderer('platform:changed', { status: 'signed_in', profile, security, accountEmail });
  return { status: 'signed_in', profile, security, accountEmail };
}

function registerIpc(adapter) {
  ipcMain.handle('platform:state', async () => {
    if (!platformService || !(await platformSession.accessToken())) return { status: 'signed_out' };
    try {
      const profile = await platformService.getProfile();
      const security = await platformService.getSecurity();
      if (requiresEmailBinding(security)) {
        closeActiveStore();
        return { status: 'binding_required', profile, security };
      }
      activateUserStore(profile.userId);
      return { status: 'signed_in', profile, security, accountEmail: await platformService.accountEmail() };
    } catch (error) {
      console.error(`[platform] state check failed code=${error.code} status=${error.status} message=${error.message}`);
      if (['AUTH_REQUIRED', 'authentication_required'].includes(error.code) || error.status === 401) {
        console.error('[platform] clearing session and signing out');
        await platformService.logout();
        closeActiveStore();
        return { status: 'signed_out' };
      }
      return { status: 'error', message: error.message || '暂时无法连接 Elunvi Platform' };
    }
  });
  ipcMain.handle('platform:login', async (_event, { email, password }) => {
    const profile = await platformService.loginWithPassword(String(email || '').trim(), String(password || ''));
    const security = await platformService.getSecurity();
    if (requiresEmailBinding(security)) {
      closeActiveStore();
      return { status: 'binding_required', profile, security };
    }
    activateUserStore(profile.userId);
    const accountEmail = await platformService.accountEmail();
    return announceSignedIn({ profile, security, accountEmail });
  });
  ipcMain.handle('platform:requestRegistrationCode', (_event, email) => platformService.requestRegistrationCode(String(email || '').trim()));
  ipcMain.handle('platform:completeRegistration', async (_event, input) => {
    const profile = await platformService.completeRegistration(input || {});
    const security = await platformService.getSecurity();
    activateUserStore(profile.userId);
    const accountEmail = await platformService.accountEmail();
    return announceSignedIn({ profile, security, accountEmail });
  });
  ipcMain.handle('platform:requestPasswordResetCode', (_event, email) => platformService.requestPasswordResetCode(String(email || '').trim()));
  ipcMain.handle('platform:resetPassword', (_event, input) => platformService.resetPassword(input || {}));
  ipcMain.handle('platform:wechatStart', () => platformService.startWechatLogin());
  ipcMain.handle('platform:wechatPoll', async () => {
    const result = await platformService.pollWechatLogin();
    if (result.state === 'signed_in') {
      activateUserStore(result.profile.userId);
      await announceSignedIn({ profile: result.profile, security: result.security, accountEmail: await platformService.accountEmail() });
    }
    return result;
  });
  ipcMain.handle('platform:emailBindingCode', (_event, email) => platformService.requestEmailBindingCode(String(email || '').trim()));
  ipcMain.handle('platform:accountEmailBindingCode', (_event, email) => platformService.requestAuthenticatedEmailBindingCode(String(email || '').trim()));
  ipcMain.handle('platform:accountPasswordCode', (_event, email) => platformService.requestAuthenticatedPasswordCode(String(email || '').trim()));
  ipcMain.handle('platform:accountPasswordComplete', (_event, input) => platformService.completeAuthenticatedPassword(input || {}));
  ipcMain.handle('platform:emailBindingComplete', async (_event, input) => {
    const profile = await platformService.completeEmailBinding(input || {});
    const security = await platformService.getSecurity();
    activateUserStore(profile.userId);
    const accountEmail = await platformService.accountEmail();
    return announceSignedIn({ profile, security, accountEmail });
  });
  ipcMain.handle('platform:accountEmailBindingComplete', async (_event, input) => {
    const security = await platformService.completeAuthenticatedEmailBinding(input || {});
    platformService.cancelWechatLogin();
    const profile = await platformService.getProfile();
    activateUserStore(profile.userId);
    const accountEmail = await platformService.accountEmail();
    return announceSignedIn({ profile, security, accountEmail });
  });
  ipcMain.handle('platform:wechatCancel', () => platformService.cancelWechatLogin());
  ipcMain.handle('platform:logout', async () => {
    await martService?.logout();
    await platformService.logout();
    closeActiveStore();
    sendToRenderer('platform:changed', { status: 'signed_out' });
    sendToRenderer('mart:changed', { linked: false });
    return { status: 'signed_out' };
  });
  ipcMain.handle('mart:state', () => (martService
    ? martService.status()
    : { linked: false, user: null, default_team: null }));
  ipcMain.handle('mart:link', async () => {
    if (!martService) throw new Error('Mart 服务尚未初始化');
    return martService.linkFromPlatform();
  });
  ipcMain.handle('platform:profile', () => platformService.getProfile());
  ipcMain.handle('platform:security', () => platformService.getSecurity());

  // 团队、会员、积分和订单都是 Mart 自己的能力，不再经过 Platform
  ipcMain.handle('mart:teams', () => martService.listTeams());
  ipcMain.handle('mart:teamMembers', (_event, teamId) => martService.listMembers(teamId));
  ipcMain.handle('mart:inviteMember', (_event, input) => martService.inviteMember(input || {}));
  ipcMain.handle('mart:removeMember', (_event, input) => martService.removeMember(input || {}));
  ipcMain.handle('mart:leaveTeam', (_event, teamId) => martService.leaveTeam(teamId));
  ipcMain.handle('mart:acceptInvitation', (_event, code) => martService.acceptInvitation(String(code || '')));
  ipcMain.handle('mart:membership', (_event, teamId) => martService.membership(teamId));
  ipcMain.handle('mart:membershipQuote', (_event, input) => martService.quoteMembership(input || {}));
  ipcMain.handle('mart:membershipOrder', (_event, input) => martService.createMembershipOrder(input || {}));
  ipcMain.handle('mart:wallet', (_event, teamId) => martService.wallet(teamId));
  // 比价查询：扣积分的动作全在后端做，这里只转发
  ipcMain.handle('mart:priceSearch', (_event, input) => martService.priceSearch(input || {}));
  ipcMain.handle('mart:walletPackages', () => martService.walletPackages());
  ipcMain.handle('mart:walletTransactions', (_event, input) => martService.walletTransactions(input || {}));
  ipcMain.handle('mart:rechargeOrder', (_event, input) => martService.createRechargeOrder(input || {}));
  ipcMain.handle('mart:order', (_event, orderId) => martService.order(orderId));
  ipcMain.handle('mart:orderContext', (_event, orderId) => martService.orderContext(orderId));
  // 渲染层靠这个判断当前是本地后端还是线上：mock 渠道只在本地开放
  ipcMain.handle('app:info', () => ({
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    martApiBaseUrl: martConfigFor().apiBaseUrl,
    priceSearchCostPoints: Number(clientPolicy?.priceSearchCostPoints) > 0
      ? Number(clientPolicy.priceSearchCostPoints)
      : 10
  }));
  ipcMain.handle('app:updateCheck', () => runUpdateCheck());
  ipcMain.handle('app:updateInstall', () => (updater?.enabled ? updater.install() : { ok: false, reason: 'disabled' }));
  ipcMain.handle('app:updateOpenDownload', async () => {
    const url = updateDownloadUrl();
    if (!url) return { ok: false };
    await shell.openExternal(url);
    return { ok: true, url };
  });
  // 比价结果里的商品链接：只放行京东/淘宝/天猫的 https 地址
  ipcMain.handle('app:openExternal', async (_event, rawUrl) => {
    let parsed;
    try {
      parsed = new URL(String(rawUrl || ''));
    } catch {
      throw new Error('这个链接打不开');
    }
    const host = parsed.hostname.toLowerCase();
    const allowed = parsed.protocol === 'https:'
      && PRICE_LINK_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    if (!allowed) throw new Error('这个链接不支持打开');
    await shell.openExternal(parsed.toString());
    return { ok: true };
  });
  ipcMain.handle('mart:orders', (_event, input) => martService.listOrders(input || {}));
  ipcMain.handle('mart:paymentAttempt', (_event, input) => martService.createPaymentAttempt(input || {}));
  ipcMain.handle('mart:closeOrder', (_event, orderId) => martService.closeOrder(orderId));
  ipcMain.handle('mart:syncOrder', (_event, orderId) => martService.syncOrder(orderId));
  ipcMain.handle('mart:simulatePayment', (_event, orderId) => martService.simulatePayment(orderId));
  // 支付宝 qr_pay_mode=4 返回的就是一张二维码页面，放进独立窗口扫码即可
  ipcMain.handle('mart:openPayWindow', (_event, payUrl) => openPayWindow(payUrl));
  // 只在默认浏览器里打开支付宝收银台，其他地址一律拒绝
  ipcMain.handle('mart:openPayUrl', async (_event, payUrl) => {
    const parsed = parseAlipayUrl(payUrl);
    await shell.openExternal(parsed.toString());
    return true;
  });
  // 界面偏好（例如上次选中的团队）：随登录账号保存在各自的本地库里
  ipcMain.handle('preferences:get', (_event, key) => requireSignedInStore().getPreference(requireUiPreferenceKey(key)));
  ipcMain.handle('preferences:set', (_event, { key, value }) => {
    requireSignedInStore().setPreference(requireUiPreferenceKey(key), value);
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
  // 店铺管理后台用该账号自己的商家窗口打开，登录态就在窗口的 partition 里
  ipcMain.handle('accounts:openShopHome', async (_event, accountId) => {
    const signedIn = requireSignedInStore();
    if (!signedIn.getAccount(accountId)) throw new Error('商家账号不存在');
    const existing = loginWindows.get(accountId);
    const window = existing && !existing.isDestroyed()
      ? existing
      : createLoginWindow(accountId, { deferNavigation: true });
    window.show();
    window.focus();
    if (!window.webContents.getURL().startsWith(MERCHANT_HOME_URL)) {
      await window.loadURL(MERCHANT_HOME_URL).catch(() => {});
    }
    return true;
  });
  ipcMain.handle('accounts:setNotify', (_event, { accountId, enabled } = {}) => {
    requireSignedInStore();
    if (!store.getAccount(accountId)) throw new Error('商家账号不存在');
    store.updateAccount(accountId, { notificationsEnabled: Boolean(enabled) });
    sendToRenderer('accounts:changed');
    return true;
  });
  ipcMain.handle('accounts:remove', (_event, accountId) => {
    requireSignedInStore();
    syncQueue?.cancel(accountId);
    store.removeAccount(accountId);
    manualSyncAtByAccount.delete(accountId);
    const window = loginWindows.get(accountId);
    if (window && !window.isDestroyed()) window.close();
    sendToRenderer('accounts:changed');
    scheduler?.refreshAccounts();
    return true;
  });
  ipcMain.handle('products:list', (_event, accountId) => requireSignedInStore().getProducts(accountId));
  // 报名详情：按"店铺+商品"缓存，2 分钟内直接读 SQLite；超过 2 分钟才静默打开页面抓一次
  // （页面自己带签名请求，我们不重放接口；不做请求次数限制）
  ipcMain.handle('products:detail', async (_event, { accountId, productId } = {}) => {
    requireSignedInStore();
    const account = store.getAccount(accountId);
    if (!account) throw new Error('商家账号不存在');
    const product = store.getProducts(accountId).find((item) => String(item.id) === String(productId));
    if (!product) throw new Error('本地没有这个商品的缓存，请先同步');

    const cached = store.getProductDetail(accountId, productId);
    const cachedAt = cached ? Date.parse(cached.fetchedAt) : NaN;
    const cachedPayload = cached && Number.isFinite(cachedAt)
      ? { rows: cached.rows, fetchedAt: cachedAt, cached: true }
      : null;
    if (cachedPayload && Date.now() - cachedAt < DETAIL_CACHE_TTL_MS) return cachedPayload;

    if (detailFetchingByAccount.has(accountId)) throw new Error('上一个报名详情还在读取中，请稍等');

    detailFetchingByAccount.add(accountId);
    try {
      const { rows, changes } = await refreshProductDetail(accountId, product);
      return { rows, changes, fetchedAt: Date.now(), cached: false };
    } catch (error) {
      // 抓取失败但本地有旧数据时，宁可给旧数据也不要把弹窗打空
      console.error('detail fetch failed:', error?.message || error);
      if (cachedPayload) return { ...cachedPayload, stale: true };
      throw error;
    } finally {
      detailFetchingByAccount.delete(accountId);
    }
  });
  ipcMain.handle('products:detailChanges', (_event, { accountId, productId, limit = 10 } = {}) => {
    requireSignedInStore();
    if (!store.getAccount(accountId)) throw new Error('商家账号不存在');
    return store.getProductDetailChanges(accountId, productId, limit);
  });
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
  martSession = new PlatformSession({
    tokenStore: new SafeStorageTokenStore({
      filePath: path.join(userDataRoot, 'elunvi-mart-session.bin'),
      safeStorage
    }),
    label: 'Mart'
  });
  martClientInstance = new MartClient({
    apiBaseUrl: martConfigFor().apiBaseUrl,
    session: martSession
  });
  martService = new MartService({
    client: martClientInstance,
    session: martSession,
    platformSession,
    platformClientId: platformConfig.clientId,
    refreshPlatformSession: () => platformService.refreshSession()
  });
  const adapter = new PddActivityAdapter({
    collectPayloads: (account, options) => collectBidListPayloads({ partition: accountPartition(account.id), ...options })
  });
  syncQueue = new SyncQueue({
    loadState: (id) => store.getSyncState(id),
    saveState: (id, state) => { if (store) store.setSyncState(id, state); },
    maxConcurrent: 1
  });
  scheduler = new MonitorScheduler(async (accountId) => {
    if (!store) return;
    const account = store.getAccount(accountId);
    if (!account) return;
    if (account.status !== 'active') {
      await sendAccountNotifications(account, buildAccountOfflineAlert(account));
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
  updater = initUpdater({ isPackaged: app.isPackaged, sendToRenderer });
  void checkVersionPolicy();
  policyTimer = setInterval(() => void checkVersionPolicy(), 60 * 60 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  scheduler?.stop();
  if (policyTimer) clearInterval(policyTimer);
  updater?.stop?.();
  syncQueue?.cancelAll();
  store?.close();
});
