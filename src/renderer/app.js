const state = {
  accounts: [],
  currentAccount: null,
  products: [],
  loginAccountId: null,
  loginMode: 'create',
  pendingRemoval: null
};

const elements = {
  title: document.querySelector('#page-title'),
  pageMeta: document.querySelector('#page-meta'),
  pageBack: document.querySelector('#page-back'),
  addAccount: document.querySelector('#add-account'),
  accountLimit: document.querySelector('#account-limit'),
  accountsBody: document.querySelector('#accounts-body'),
  accountsTable: document.querySelector('#accounts-table-frame'),
  accountsEmpty: document.querySelector('#accounts-empty'),
  productsBody: document.querySelector('#products-body'),
  productsTable: document.querySelector('#products-table-frame'),
  productsEmpty: document.querySelector('#products-empty'),
  notice: document.querySelector('#notice'),
  modal: document.querySelector('#account-modal'),
  loginStartStep: document.querySelector('#login-start-step'),
  loginConfirmStep: document.querySelector('#login-confirm-step'),
  loginError: document.querySelector('#login-error'),
  loginErrorTitle: document.querySelector('#login-error-title'),
  loginErrorDetail: document.querySelector('#login-error-detail'),
  startLogin: document.querySelector('#start-login'),
  completeLogin: document.querySelector('#complete-login'),
  removeAccountModal: document.querySelector('#remove-account-modal'),
  removeAccountDescription: document.querySelector('#remove-account-description'),
  confirmRemoveAccount: document.querySelector('#confirm-remove-account')
};

const STATUS_LABELS = {
  active: ['在标', 'status-active'],
  suspected: ['疑似掉标', 'status-warning'],
  lost: ['已掉标', 'status-lost'],
  reviewing: ['审核中', 'status-info']
};

function createIcon(name) {
  const icon = document.createElement('i');
  icon.dataset.lucide = name;
  return icon;
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function renderAccountAvatar(container, avatarUrl) {
  container.replaceChildren();
  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl.replace(/^http:/, 'https:');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      container.replaceChildren(createIcon('store'));
      refreshIcons();
    }, { once: true });
    container.append(image);
  } else {
    container.append(createIcon('store'));
  }
}

function formatDate(value) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未同步';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function showNotice(message, error = false) {
  if (!String(message || '').trim()) {
    hideNotice();
    return;
  }
  elements.notice.querySelector('span').textContent = message;
  elements.notice.classList.toggle('is-error', error);
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
}

function friendlyError(error) {
  const original = String(error?.message || error || '');
  if (original.includes('登录窗口已关闭')) {
    return '登录窗口已经关闭。请点击“重新打开登录窗口”，完成登录后再保存账号。';
  }
  if (original.includes('尚未检测到商家后台登录成功')) {
    return '还未检测到登录完成。请在登录窗口进入拼多多商家后台首页后，再点击“登录完成，保存账号”。';
  }
  if (original.includes('商家账号不存在')) {
    return '本次登录已失效。请关闭弹窗后重新添加账号。';
  }
  if (original.includes('店铺已经添加过了')) {
    return '店铺已经添加过了，请直接使用已有店铺账号。';
  }
  const ipcMessage = original.match(/Error invoking remote method '[^']+': Error: (.+)$/);
  return ipcMessage?.[1] || original || '操作没有完成，请稍后重试。';
}

function setLoginButtonLabel(label) {
  elements.startLogin.querySelector('span').textContent = label;
}

function showLoginError(error) {
  const message = friendlyError(error);
  const details = {
    '登录窗口已经关闭。请点击“重新打开登录窗口”，完成登录后再保存账号。': ['登录窗口已关闭', '请重新打开登录窗口，完成登录后再保存账号。'],
    '还未检测到登录完成。请在登录窗口进入拼多多商家后台首页后，再点击“登录完成，保存账号”。': ['尚未完成登录', '请先进入拼多多商家后台首页，然后回来保存账号。'],
    '本次登录已失效。请关闭弹窗后重新添加账号。': ['本次登录已失效', '请关闭弹窗后重新添加账号。'],
    '店铺已经添加过了，请直接使用已有店铺账号。': ['店铺已经添加过了', '这个店铺已经在账号列表中，无需重复添加。']
  };
  const [title, detail] = details[message] || ['暂时无法继续', message];
  elements.loginErrorTitle.textContent = title;
  elements.loginErrorDetail.textContent = detail;
  elements.loginError.hidden = false;
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
  const isAccounts = name === 'accounts';
  const isSettings = name === 'settings';
  elements.addAccount.hidden = !isAccounts;
  elements.pageMeta.hidden = true;
  elements.pageBack.hidden = true;
  if (isAccounts) {
    elements.title.textContent = '商家账号';
  } else if (isSettings) {
    elements.title.textContent = '监控设置';
    loadSettings();
  }
  hideNotice();
}

function accountStatus(account) {
  return account.status === 'active'
    ? '<span class="status status-active">登录正常</span>'
    : '<span class="status status-warning">需要登录</span>';
}

function renderAccounts() {
  elements.accountsBody.replaceChildren();
  elements.accountLimit.textContent = `已添加 ${state.accounts.length} / 10 个账号`;
  elements.accountsEmpty.hidden = state.accounts.length > 0;
  elements.accountsTable.hidden = state.accounts.length === 0;
  for (const account of state.accounts) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div class="account-cell"><span class="account-avatar"><i data-lucide="store"></i></span><div><div class="primary-text"></div><div class="secondary-text"></div></div></div></td>
      <td>${accountStatus(account)}</td>
      <td>${Number(account.productCount || 0)} 个</td>
      <td class="time">${formatDate(account.lastSyncAt)}</td>
      <td><div class="account-actions"><button class="icon-button account-action" type="button" data-account-action="view" aria-label="查看营销活动商品" title="查看营销活动商品"><i data-lucide="eye"></i></button><button class="icon-button account-action" type="button" data-account-action="login" aria-label="${account.status === 'active' ? '重新登录' : '登录'}" title="${account.status === 'active' ? '重新登录' : '登录'}"><i data-lucide="refresh-cw"></i></button><button class="icon-button account-action account-remove" type="button" data-account-action="remove" aria-label="移除账号" title="移除账号"><i data-lucide="trash-2"></i></button></div></td>`;
    row.querySelector('.primary-text').textContent = account.displayName || '未命名店铺';
    row.querySelector('.secondary-text').textContent = account.mallId ? `店铺 ID ${account.mallId}` : '店铺 ID 待接口识别';
    renderAccountAvatar(row.querySelector('.account-avatar'), account.avatarUrl);
    row.querySelector('[data-account-action="view"]').addEventListener('click', () => openAccount(account));
    row.querySelector('[data-account-action="login"]').addEventListener('click', () => openLoginModal(account));
    row.querySelector('[data-account-action="remove"]').addEventListener('click', () => openRemoveAccountModal(account));
    elements.accountsBody.append(row);
  }
  refreshIcons();
}

function openRemoveAccountModal(account) {
  state.pendingRemoval = account;
  elements.removeAccountDescription.textContent = `移除“${account.displayName}”后，该账号的本地商品缓存和登录会话也会一并清除。此操作无法撤销。`;
  elements.removeAccountModal.hidden = false;
  elements.confirmRemoveAccount.focus();
}

function closeRemoveAccountModal() {
  state.pendingRemoval = null;
  elements.removeAccountModal.hidden = true;
}

async function removeAccount() {
  const account = state.pendingRemoval;
  if (!account) return;
  try {
    elements.confirmRemoveAccount.disabled = true;
    await window.pddMonitor.accounts.remove(account.id);
    closeRemoveAccountModal();
    await loadAccounts();
    showNotice('商家账号已移除');
  } catch (error) {
    showNotice(friendlyError(error), true);
  } finally {
    elements.confirmRemoveAccount.disabled = false;
  }
}

async function loadAccounts() {
  state.accounts = await window.pddMonitor.accounts.list();
  renderAccounts();
}

function renderProducts() {
  const search = document.querySelector('#product-search').value.trim().toLowerCase();
  const status = document.querySelector('#product-status').value;
  const visible = state.products.filter((product) => {
    const matchesText = !search || String(product.name || '').toLowerCase().includes(search) || String(product.id || '').includes(search);
    return matchesText && (!status || product.status === status);
  });
  elements.productsBody.replaceChildren();
  elements.productsEmpty.hidden = visible.length > 0;
  elements.productsTable.hidden = visible.length === 0;
  for (const product of visible) {
    const [label, className] = STATUS_LABELS[product.status] || ['未知', 'status-info'];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div class="product-cell"><span class="product-thumb"></span><div><div class="primary-text"></div><div class="secondary-text"></div></div></div></td>
      <td><div class="activity-name"></div><div class="secondary-text activity-id"></div></td>
      <td><span class="status ${className}">${label}</span></td>
      <td class="price"></td><td class="time ends-at"></td><td class="time updated-at"></td>`;
    row.querySelector('.primary-text').textContent = product.name || '未命名商品';
    row.querySelector('.product-cell .secondary-text').textContent = `商品 ID ${product.id || '-'}`;
    row.querySelector('.activity-name').textContent = product.activityName || '百亿补贴';
    row.querySelector('.activity-id').textContent = product.activityId ? `活动 ID ${product.activityId}` : '';
    row.querySelector('.price').textContent = product.activityPrice ?? '-';
    row.querySelector('.ends-at').textContent = product.endsAt || '-';
    row.querySelector('.updated-at').textContent = formatDate(product.updatedAt);
    const thumb = row.querySelector('.product-thumb');
    if (product.imageUrl) {
      const image = document.createElement('img');
      image.src = product.imageUrl;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      thumb.append(image);
    } else {
      thumb.append(createIcon('image'));
    }
    elements.productsBody.append(row);
  }
  refreshIcons();
}

async function openAccount(account) {
  state.currentAccount = account;
  elements.title.textContent = account.displayName;
  elements.pageBack.hidden = false;
  elements.pageMeta.textContent = account.mallId ? `店铺 ID ${account.mallId}` : '店铺 ID 待接口识别';
  elements.pageMeta.hidden = false;
  elements.addAccount.hidden = true;
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== 'account-detail-view'; });
  state.products = await window.pddMonitor.products.list(account.id);
  document.querySelector('#detail-product-count').textContent = state.products.length;
  document.querySelector('#detail-error-count').textContent = state.products.filter((item) => ['lost', 'suspected'].includes(item.status)).length;
  renderProducts();
}

function resetLoginModal() {
  state.loginAccountId = null;
  state.loginMode = 'create';
  elements.loginStartStep.hidden = false;
  elements.loginConfirmStep.hidden = true;
  elements.startLogin.hidden = false;
  elements.completeLogin.hidden = true;
  elements.loginError.hidden = true;
  setLoginButtonLabel('打开登录窗口');
}

function openLoginModal(account = null) {
  resetLoginModal();
  if (account) {
    state.loginAccountId = account.id;
    state.loginMode = 'update';
    document.querySelector('#account-modal-title').textContent = '重新登录商家账号';
  } else {
    document.querySelector('#account-modal-title').textContent = '添加商家账号';
  }
  elements.modal.hidden = false;
  elements.startLogin.focus();
}

async function beginLogin() {
  try {
    elements.startLogin.disabled = true;
    const result = await window.pddMonitor.accounts.startLogin(state.loginAccountId);
    state.loginAccountId = result.accountId;
    elements.loginStartStep.hidden = true;
    elements.loginConfirmStep.hidden = false;
    elements.startLogin.hidden = false;
    elements.completeLogin.hidden = false;
    elements.loginError.hidden = true;
    setLoginButtonLabel('重新打开登录窗口');
  } catch (error) {
    showLoginError(error);
  } finally {
    elements.startLogin.disabled = false;
  }
}

async function completeLogin() {
  try {
    elements.completeLogin.disabled = true;
    await window.pddMonitor.accounts.completeLogin(state.loginAccountId);
    elements.modal.hidden = true;
    await loadAccounts();
    hideNotice();
  } catch (error) {
    showLoginError(error);
    setLoginButtonLabel('重新打开登录窗口');
  } finally {
    elements.completeLogin.disabled = false;
  }
}

async function syncProducts() {
  if (!state.currentAccount) return;
  const button = document.querySelector('#sync-products');
  const label = button.querySelector('span');
  button.disabled = true;
  label.textContent = '同步中';
  try {
    const result = await window.pddMonitor.products.sync(state.currentAccount.id);
    state.products = result.products;
    renderProducts();
    document.querySelector('#detail-product-count').textContent = state.products.length;
    const message = result.message || `已同步 ${state.products.length} 个营销活动商品`;
    showNotice(result.notificationErrors?.length ? `${message}；部分提醒发送失败` : message, !result.ok || Boolean(result.notificationErrors?.length));
    await loadAccounts();
  } catch (error) {
    showNotice(friendlyError(error), true);
  } finally {
    button.disabled = false;
    label.textContent = '从后台同步';
  }
}

function channelConfig(kind) {
  if (kind === 'wecom') return { webhook: document.querySelector('#wecom-webhook').value.trim() };
  return { webhook: document.querySelector('#dingtalk-webhook').value.trim(), secret: document.querySelector('#dingtalk-secret').value.trim() };
}

async function loadSettings() {
  const settings = await window.pddMonitor.settings.get();
  document.querySelector('#interval-min').value = String(settings.intervalMinMinutes);
  document.querySelector('#interval-max').value = String(settings.intervalMaxMinutes);
  document.querySelector('#desktop-enabled').checked = settings.notifications.desktop;
  document.querySelector('#wecom-enabled').checked = settings.notifications.wecom.enabled;
  document.querySelector('#wecom-webhook').value = settings.notifications.wecom.webhook;
  document.querySelector('#dingtalk-enabled').checked = settings.notifications.dingtalk.enabled;
  document.querySelector('#dingtalk-webhook').value = settings.notifications.dingtalk.webhook;
  document.querySelector('#dingtalk-secret').value = settings.notifications.dingtalk.secret;
  updateChannelVisibility();
}

function readSettings() {
  return {
    intervalMinMinutes: Number(document.querySelector('#interval-min').value),
    intervalMaxMinutes: Number(document.querySelector('#interval-max').value),
    notifications: {
      desktop: document.querySelector('#desktop-enabled').checked,
      wecom: { enabled: document.querySelector('#wecom-enabled').checked, webhook: document.querySelector('#wecom-webhook').value.trim() },
      dingtalk: { enabled: document.querySelector('#dingtalk-enabled').checked, webhook: document.querySelector('#dingtalk-webhook').value.trim(), secret: document.querySelector('#dingtalk-secret').value.trim() }
    }
  };
}

function updateChannelVisibility() {
  document.querySelector('#wecom-channel').classList.toggle('is-enabled', document.querySelector('#wecom-enabled').checked);
  document.querySelector('#dingtalk-channel').classList.toggle('is-enabled', document.querySelector('#dingtalk-enabled').checked);
}

document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-action="add-account"]').forEach((button) => button.addEventListener('click', () => openLoginModal()));
elements.addAccount.addEventListener('click', () => openLoginModal());
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => { elements.modal.hidden = true; }));
document.querySelectorAll('[data-close-remove-modal]').forEach((button) => button.addEventListener('click', closeRemoveAccountModal));
elements.removeAccountModal.addEventListener('click', (event) => { if (event.target === elements.removeAccountModal) closeRemoveAccountModal(); });
elements.confirmRemoveAccount.addEventListener('click', removeAccount);
elements.startLogin.addEventListener('click', beginLogin);
elements.completeLogin.addEventListener('click', completeLogin);
elements.pageBack.addEventListener('click', () => { showView('accounts'); loadAccounts(); });
document.querySelector('#sync-products').addEventListener('click', syncProducts);
document.querySelector('#product-search').addEventListener('input', renderProducts);
document.querySelector('#product-status').addEventListener('change', renderProducts);
document.querySelectorAll('#wecom-enabled,#dingtalk-enabled').forEach((input) => input.addEventListener('change', updateChannelVisibility));
document.querySelectorAll('[data-test-channel]').forEach((button) => button.addEventListener('click', async () => {
  const kind = button.dataset.testChannel;
  button.disabled = true;
  try {
    await window.pddMonitor.notifications.test(kind, channelConfig(kind));
    showNotice(`${kind === 'wecom' ? '企业微信' : '钉钉'}测试消息已发送`);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
}));
document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await window.pddMonitor.settings.save(readSettings());
    showNotice('监控设置已保存');
  } catch (error) {
    showNotice(error.message, true);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.removeAccountModal.hidden) closeRemoveAccountModal();
});

window.pddMonitor.onAccountsChanged(() => loadAccounts());

refreshIcons();
loadAccounts().catch((error) => showNotice(error.message, true));
