const state = {
  platform: { status: 'loading', profile: null, security: null, accountEmail: null },
  mart: {
    linked: false,
    user: null,
    teams: [],
    team: null,
    teamId: null,
    membership: null,
    members: [],
    wallet: null,
    packages: [],
    transactions: [],
    transactionTotal: 0,
    teamOrders: [],
    walletOrders: [],
    walletPackageId: null,
    teamPlanId: null,
    pages: { ledger: 1, walletOrders: 1, teamOrders: 1 },
    preferencesLoaded: false
  },
  purchase: { kind: null, order: null, attempt: null },
  orderPollTimer: null,
  teamTab: 'members',
  walletTab: 'recharge',
  accounts: [],
  accountQuota: null,
  currentAccount: null,
  products: [],
  productPage: 1,
  syncCooldownUntilByAccount: new Map(),
  syncCooldownTimer: null,
  toastTimer: null,
  syncInProgress: false,
  loginAccountId: null,
  loginMode: 'create',
  pendingConfirm: null,
  teamActionMode: null,
  platformAuthMode: 'login',
  platformAuthBindingKind: null,
  platformAuthChallengeId: null,
  platformAuthPasswordChallengeId: null,
  platformAuthChallenges: { register: null, reset: null },
  platformAuthCodeCooldownUntil: { register: 0, reset: 0 },
  platformAuthCodeCooldownTimers: { register: null, reset: null },
  platformAuthCodeRequesting: { register: false, reset: false },
  wechatExpiresAt: null,
  wechatPollTimer: null,
  wechatCountdownTimer: null,
  wechatScanned: false
};

const elements = {
  title: document.querySelector('#page-title'),
  pageMeta: document.querySelector('#page-meta'),
  pageBack: document.querySelector('#page-back'),
  addAccount: document.querySelector('#add-account'),
  accountsBody: document.querySelector('#accounts-body'),
  accountsTable: document.querySelector('#accounts-table-frame'),
  accountsEmpty: document.querySelector('#accounts-empty'),
  accountsFooter: document.querySelector('#accounts-footer'),
  emptyAdd: document.querySelector('#accounts-empty-add'),
  emptyTitle: document.querySelector('#accounts-empty-title'),
  emptyCopy: document.querySelector('#accounts-empty-copy'),
  productsBody: document.querySelector('#products-body'),
  productsTable: document.querySelector('#products-table-frame'),
  productsEmpty: document.querySelector('#products-empty'),
  productsPagination: document.querySelector('#products-pagination'),
  productsPaginationSummary: document.querySelector('#products-pagination-summary'),
  productsPageCurrent: document.querySelector('#products-page-current'),
  productsPagePrev: document.querySelector('#products-page-prev'),
  productsPageNext: document.querySelector('#products-page-next'),
  syncProducts: document.querySelector('#sync-products'),
  notice: document.querySelector('#notice'),
  toast: document.querySelector('#toast'),
  modal: document.querySelector('#account-modal'),
  loginStartStep: document.querySelector('#login-start-step'),
  loginConfirmStep: document.querySelector('#login-confirm-step'),
  loginError: document.querySelector('#login-error'),
  loginErrorTitle: document.querySelector('#login-error-title'),
  loginErrorDetail: document.querySelector('#login-error-detail'),
  startLogin: document.querySelector('#start-login'),
  completeLogin: document.querySelector('#complete-login'),
  confirmModal: document.querySelector('#confirm-modal'),
  confirmTitle: document.querySelector('#confirm-modal-title'),
  confirmDescription: document.querySelector('#confirm-modal-description'),
  confirmIcon: document.querySelector('#confirm-modal-icon'),
  confirmSubmit: document.querySelector('#confirm-modal-submit'),
  confirmSubmitLabel: document.querySelector('#confirm-modal-submit-label'),
  confirmSubmitIcon: document.querySelector('#confirm-modal-submit-icon'),
  platformSignin: document.querySelector('#platform-signin'),
  platformAccount: document.querySelector('#platform-account'),
  platformAccountAvatar: document.querySelector('#platform-account-avatar'),
  platformAccountName: document.querySelector('#platform-account-name'),
  platformAccountMeta: document.querySelector('#platform-account-meta'),
  platformAccountMenu: document.querySelector('#platform-account-menu'),
  platformAccountMenuAvatar: document.querySelector('#platform-account-menu-avatar'),
  platformAccountMenuName: document.querySelector('#platform-account-menu-name'),
  platformAccountMenuEmail: document.querySelector('#platform-account-menu-email'),
  platformAccountChangePassword: document.querySelector('#platform-account-change-password'),
  platformAccountLogout: document.querySelector('#platform-account-logout'),
  platformLoginModal: document.querySelector('#platform-login-modal'),
  platformAuthClose: document.querySelector('#platform-auth-close'),
  platformLoginForm: document.querySelector('#platform-login-form'),
  platformAuthCopy: document.querySelector('#platform-auth-copy'),
  platformAuthForms: document.querySelector('.platform-auth-forms'),
  platformLoginServerError: document.querySelector('#platform-login-server-error'),
  platformRegisterServerError: document.querySelector('#platform-register-server-error'),
  platformResetServerError: document.querySelector('#platform-reset-server-error'),
  platformWechatStart: document.querySelector('#platform-wechat-start'),
  platformWechatPanel: document.querySelector('#platform-wechat-panel'),
  platformWechatFrame: document.querySelector('#platform-wechat-frame'),
  platformWechatStatus: document.querySelector('#platform-wechat-status'),
  platformWechatCountdown: document.querySelector('#platform-wechat-countdown'),
  platformWechatBack: document.querySelector('#platform-wechat-back'),
  platformWechatRefresh: document.querySelector('#platform-wechat-refresh'),
  walletSummary: document.querySelector('#wallet-summary-card'),
  walletPackages: document.querySelector('#wallet-package-list'),
  walletTransactions: document.querySelector('#wallet-transactions-body'),
  walletLedgerPagination: document.querySelector('#wallet-ledger-pagination'),
  walletOrderBody: document.querySelector('#wallet-order-body'),
  walletOrderPagination: document.querySelector('#wallet-order-pagination'),
  teamOrderBody: document.querySelector('#team-order-body'),
  teamPurchaseBar: document.querySelector('#team-purchase-bar'),
  teamOrderPagination: document.querySelector('#team-order-pagination'),
  walletTabRecharge: document.querySelector('#wallet-tab-recharge'),
  walletTabOrders: document.querySelector('#wallet-tab-orders'),
  teamSummary: document.querySelector('#team-summary-card'),
  teamSwitcher: document.querySelector('#team-switcher'),
  walletSwitcher: document.querySelector('#wallet-switcher'),
  teamPlans: document.querySelector('#team-plan-list'),
  teamPlanCard: document.querySelector('#team-plan-card'),
  teamTabs: document.querySelector('#team-tabs'),
  teamTabPlans: document.querySelector('#team-tab-plans'),
  teamTabCount: document.querySelector('#team-tab-count'),
  walletTabs: document.querySelector('#wallet-tabs'),
  walletPurchaseBar: document.querySelector('#wallet-purchase-bar'),
  walletTabCount: document.querySelector('#wallet-tab-count'),
  teamMembers: document.querySelector('#team-members-body'),
  teamOrderCount: document.querySelector('#team-order-count'),
  walletOrderList: document.querySelector('#wallet-order-list'),
  walletOrderCount: document.querySelector('#wallet-order-count'),
  paymentStatusCard: document.querySelector('#payment-status-card'),
  paymentStatusCopy: document.querySelector('#payment-status-copy'),
  paymentOrderDetail: document.querySelector('#payment-order-detail'),
  paymentCloseOrder: document.querySelector('#payment-close-order'),
  paymentRefreshOrder: document.querySelector('#payment-refresh-order'),
  paymentSimulate: document.querySelector('#payment-simulate'),
  teamActionModal: document.querySelector('#team-action-modal'),
  teamActionForm: document.querySelector('#team-action-form'),
  teamActionTitle: document.querySelector('#team-action-title'),
  teamActionDescription: document.querySelector('#team-action-description'),
  teamActionName: document.querySelector('#team-action-name'),
  teamActionEmail: document.querySelector('#team-action-email'),
  teamActionDisplay: document.querySelector('#team-action-display'),
  teamActionCode: document.querySelector('#team-action-code'),
  teamNameField: document.querySelector('#team-name-field'),
  teamEmailField: document.querySelector('#team-email-field'),
  teamDisplayField: document.querySelector('#team-display-field'),
  teamCodeField: document.querySelector('#team-code-field'),
  teamActionError: document.querySelector('#team-action-error'),
  teamActionErrorText: document.querySelector('#team-action-error-text'),
  teamActionCancel: document.querySelector('#team-action-cancel'),
  teamActionClose: document.querySelector('#team-action-close'),
  teamActionSubmit: document.querySelector('#team-action-submit')
};

const PRODUCT_PAGE_SIZE = 10;

const STATUS_LABELS = {
  all_sku_win_bid: ['全部规格已中标', 'status-active'],
  partial_sku_win_bid: ['部分规格未中标', 'status-warning'],
  all_sku_not_win_bid: ['全部规格未中标', 'status-lost'],
  lost: ['已掉标', 'status-lost'],
  unknown: ['状态异常', 'status-warning']
};

function createIcon(name) {
  const icon = document.createElement('i');
  icon.dataset.lucide = name;
  return icon;
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function setIcon(container, name) {
  container.replaceChildren(createIcon(name));
  refreshIcons();
}

function togglePasswordVisibility(button) {
  const input = document.querySelector(`#${button.dataset.passwordToggle}`);
  if (!input) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  const label = visible ? '显示密码' : '隐藏密码';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = `<i data-lucide="${visible ? 'eye' : 'eye-off'}"></i>`;
  refreshIcons();
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

function renderPlatformAvatarInto(container, profile, fallbackName = '') {
  if (!container) return;
  container.replaceChildren();
  const initial = String(fallbackName || '').trim().slice(0, 1).toUpperCase();
  const renderInitial = () => {
    if (initial) {
      const letter = document.createElement('span');
      letter.className = 'platform-avatar-initial';
      letter.textContent = initial;
      container.append(letter);
      return;
    }
    container.append(createIcon('user-round'));
    refreshIcons();
  };
  if (profile?.avatarUrl) {
    const image = document.createElement('img');
    image.src = profile.avatarUrl.replace(/^http:/, 'https:');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', renderInitial, { once: true });
    container.append(image);
  } else {
    renderInitial();
  }
}

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, timeZone: LOCAL_TIME_ZONE
});

const LOCAL_DAY_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: LOCAL_TIME_ZONE
});

function formatDate(value, emptyLabel = '尚未同步') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return LOCAL_DATE_FORMATTER.format(date);
}

function formatDay(value, emptyLabel = '待确认') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return LOCAL_DAY_FORMATTER.format(date);
}

function formatPrice(value) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text.split(/[-~～]/).map((part) => {
    const amountInFen = Number(part.trim());
    if (!Number.isFinite(amountInFen)) return part.trim();
    return `¥${(amountInFen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }).join(' - ');
}

function getActivityStatus(product) {
  if (product.status === 'lost') return 'lost';
  const raw = product.raw || {};
  if (raw.all_sku_win_bid === true) return 'all_sku_win_bid';
  if (Number(raw.target_activity_status) === 2) return 'partial_sku_win_bid';
  if (Number(raw.target_activity_status) === 3) return 'all_sku_not_win_bid';
  return STATUS_LABELS[product.activityStatus] ? product.activityStatus : 'unknown';
}

function renderStatusOptions() {
  const select = document.querySelector('#product-status');
  const selected = select.value;
  const available = new Set(state.products.map(getActivityStatus));
  const statuses = ['all_sku_win_bid', 'partial_sku_win_bid', 'all_sku_not_win_bid', 'lost', 'unknown']
    .filter((value) => available.has(value));
  const options = [['', '全部状态'], ...statuses.map((value) => [value, STATUS_LABELS[value][0]])];
  select.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  select.value = statuses.includes(selected) ? selected : '';
}

function renderPagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCT_PAGE_SIZE));
  state.productPage = Math.min(Math.max(1, state.productPage), totalPages);
  const hasPagination = totalItems > PRODUCT_PAGE_SIZE;
  elements.productsPagination.hidden = !hasPagination;
  if (!hasPagination) return totalPages;
  elements.productsPaginationSummary.textContent = `共 ${totalItems} 条`;
  elements.productsPageCurrent.textContent = `第 ${state.productPage} / ${totalPages} 页`;
  elements.productsPagePrev.disabled = state.productPage <= 1;
  elements.productsPageNext.disabled = state.productPage >= totalPages;
  return totalPages;
}

function showNotice(message, error = false) {
  if (!String(message || '').trim()) {
    hideNotice();
    return;
  }
  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
  elements.toast.hidden = true;
  if (!error) {
    elements.notice.hidden = true;
    elements.toast.querySelector('span').textContent = message;
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; state.toastTimer = null; }, 1500);
    return;
  }
  elements.notice.querySelector('span').textContent = message;
  elements.notice.classList.add('is-error');
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
  elements.toast.hidden = true;
  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
}

function isPlatformSignedIn() {
  return state.platform.status === 'signed_in' && Boolean(state.platform.profile);
}

const PLACEHOLDER_DISPLAY_NAMES = new Set(['elunvi user', 'elunvi 用户']);

function hasRealDisplayName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized !== '' && !PLACEHOLDER_DISPLAY_NAMES.has(normalized);
}

// 邮箱注册的用户平台侧没有昵称，用邮箱 @ 前那截顶上（脱敏邮箱不带 @ 前的真实字符，不用）
function emailLocalPart(email) {
  const value = String(email || '').trim();
  const at = value.indexOf('@');
  if (at <= 0) return '';
  const local = value.slice(0, at);
  return local.includes('*') ? '' : local;
}

function platformDisplayName(profile, email) {
  const name = String(profile?.displayName || '').trim();
  if (hasRealDisplayName(name)) return name;
  return emailLocalPart(email) || name || 'Elunvi 用户';
}

function renderPlatformAvatar(profile, displayName) {
  renderPlatformAvatarInto(elements.platformAccountAvatar, profile, displayName);
  renderPlatformAvatarInto(elements.platformAccountMenuAvatar, profile, displayName);
}

function setPlatformShell(status) {
  const signedIn = status === 'signed_in';
  state.platform.status = status;
  elements.platformSignin.hidden = signedIn;
  elements.platformAccount.hidden = !signedIn;
  document.querySelectorAll('[data-platform-nav]').forEach((button) => { button.hidden = !signedIn; });
  elements.addAccount.disabled = !signedIn;
  if (signedIn) {
    const profile = state.platform.profile || {};
    const accountEmail = state.platform.accountEmail || '';
    const email = state.platform.security?.maskedEmail || accountEmail || 'Elunvi 用户';
    const displayName = platformDisplayName(profile, accountEmail);
    renderPlatformAvatar(profile, displayName);
    elements.platformAccountMenuEmail.textContent = email;
    elements.platformAccountMenuName.textContent = displayName;
    elements.platformAccountName.textContent = displayName;
    elements.platformAccountMeta.textContent = email;
  } else {
    closePlatformAccountMenu();
    renderPlatformAvatar(null);
    elements.platformAccountMenuEmail.textContent = '未登录';
    elements.platformAccountMenuName.textContent = '未登录';
    elements.platformAccountName.textContent = '未登录';
    elements.platformAccountMeta.textContent = '登录后使用软件';
  }
}

function closePlatformAccountMenu() {
  if (!elements.platformAccountMenu) return;
  elements.platformAccountMenu.hidden = true;
  elements.platformAccount.setAttribute('aria-expanded', 'false');
}

function togglePlatformAccountMenu() {
  const open = elements.platformAccountMenu.hidden;
  elements.platformAccountMenu.hidden = !open;
  elements.platformAccount.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closePlatformAuthModal() {
  if (elements.platformLoginModal.hidden) return;
  if (state.platformAuthMode === 'wechat') {
    clearWechatPollTimer();
    window.pddMonitor.platform.wechatCancel().catch(() => {});
  } else {
    const fields = authFields();
    if (fields.code) fields.code.value = '';
    if (fields.password) fields.password.value = '';
    if (fields.confirm) fields.confirm.value = '';
    clearAuthErrors(state.platformAuthMode);
  }
  elements.platformLoginModal.hidden = true;
}

function openPasswordChange() {
  closePlatformAccountMenu();
  if (state.platformAuthCodeCooldownTimers.reset) window.clearInterval(state.platformAuthCodeCooldownTimers.reset);
  state.platformAuthBindingKind = null;
  state.platformAuthChallengeId = null;
  state.platformAuthPasswordChallengeId = null;
  state.platformAuthChallenges.reset = null;
  state.platformAuthCodeCooldownUntil.reset = 0;
  setPlatformAuthMode('password-change');
  const fields = authFields('password-change');
  fields.email.value = state.platform.accountEmail || state.platform.security?.maskedEmail || '';
  fields.code.value = '';
  fields.password.value = '';
  fields.confirm.value = '';
  elements.platformLoginModal.hidden = false;
  fields.email.focus();
}

function showPlatformLogin(message = '') {
  clearWechatPollTimer();
  state.platformAuthBindingKind = null;
  state.platformAuthChallengeId = null;
  state.platformAuthPasswordChallengeId = null;
  setPlatformAuthMode('login');
  setServerError('login', message);
  elements.platformLoginModal.hidden = false;
  authFields('login').email.focus();
}

function authModeKey(mode = state.platformAuthMode) {
  return mode === 'email-binding' || mode === 'password-change' ? 'reset' : mode;
}

function authFields(mode = state.platformAuthMode) {
  const key = authModeKey(mode);
  const prefix = `platform-${key}`;
  return {
    form: document.querySelector(`#${prefix}-form`),
    email: document.querySelector(`#${prefix}-email`),
    code: key === 'login' ? null : document.querySelector(`#${prefix}-code`),
    requestCode: key === 'login' ? null : document.querySelector(`#${prefix}-request-code`),
    password: document.querySelector(`#${prefix}-password`),
    confirm: key === 'login' ? null : document.querySelector(`#${prefix}-confirm`),
    submit: document.querySelector(`#${prefix}-form button[type="submit"]`),
    errors: {
      email: document.querySelector(`#${prefix}-email-error`),
      code: key === 'login' ? null : document.querySelector(`#${prefix}-code-error`),
      password: document.querySelector(`#${prefix}-password-error`),
      confirm: key === 'login' ? null : document.querySelector(`#${prefix}-confirm-error`)
    },
    serverError: document.querySelector(`#${prefix}-server-error`)
  };
}

function setAuthError(node, message = '') {
  if (!node) return;
  const text = String(message || '');
  node.textContent = text;
  node.title = text;
  node.classList.toggle('is-visible', Boolean(text));
}

function setFieldValidation(fields, name, message = '') {
  const input = fields[name];
  const errorNode = fields.errors[name];
  if (input) {
    input.setCustomValidity(message);
    input.toggleAttribute('aria-invalid', Boolean(message));
  }
  // Keep field-specific messages out of document flow; the browser displays
  // the custom validity message as a native input tooltip.
  setAuthError(errorNode);
}

function reportFirstInvalid(fields) {
  const input = [fields.email, fields.code, fields.password, fields.confirm]
    .find((candidate) => candidate && !candidate.checkValidity());
  if (!input) return true;
  input.focus();
  input.reportValidity();
  return false;
}

function reportChallengeRequired(fields) {
  setFieldValidation(fields, 'code', '请先点击获取验证码');
  fields.code?.focus();
  fields.code?.reportValidity();
}

function clearAuthErrors(mode = state.platformAuthMode) {
  const fields = authFields(mode);
  ['email', 'code', 'password', 'confirm'].forEach((name) => setFieldValidation(fields, name));
  setAuthError(fields.serverError);
}

function setServerError(mode, message = '') {
  setAuthError(authFields(mode).serverError, message);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function passwordByteLength(value) {
  return new TextEncoder().encode(value).length;
}

function validateAuthFields(mode, { requireCode = true, onlyEmail = false } = {}) {
  const key = authModeKey(mode);
  const fields = authFields(mode);
  ['email', 'code', 'password', 'confirm'].forEach((name) => setFieldValidation(fields, name));
  let valid = true;
  const email = fields.email?.value.trim() || '';
  if (!email) {
    setFieldValidation(fields, 'email', '请输入邮箱');
    valid = false;
  } else if (!isValidEmail(email)) {
    setFieldValidation(fields, 'email', '请输入正确的邮箱地址');
    valid = false;
  }
  if (onlyEmail) {
    if (!valid) reportFirstInvalid(fields);
    return valid;
  }
  if (key === 'login') {
    if (!fields.password?.value) {
      setFieldValidation(fields, 'password', '请输入密码');
      valid = false;
    }
    if (!valid) reportFirstInvalid(fields);
    return valid;
  }
  if (requireCode && !fields.code?.value.trim()) {
    setFieldValidation(fields, 'code', '请输入邮箱验证码');
    valid = false;
  } else if (requireCode && !/^\d{6}$/u.test(fields.code.value.trim())) {
    setFieldValidation(fields, 'code', '请输入 6 位验证码');
    valid = false;
  }
  if (mode !== 'email-binding' && !fields.password?.value) {
    setFieldValidation(fields, 'password', '请输入密码');
    valid = false;
  } else if (mode !== 'email-binding' && (passwordByteLength(fields.password.value) < 8 || passwordByteLength(fields.password.value) > 20)) {
    setFieldValidation(fields, 'password', '密码长度需为 8-20 个字符');
    valid = false;
  }
  if (key !== 'reset' || mode !== 'email-binding') {
    if (!fields.confirm?.value) {
      setFieldValidation(fields, 'confirm', '请再次输入密码');
      valid = false;
    } else if (fields.password?.value !== fields.confirm.value) {
      setFieldValidation(fields, 'confirm', '两次输入的密码不一致');
      valid = false;
    }
  }
  if (!valid) reportFirstInvalid(fields);
  return valid;
}

function authCodeKey(mode) {
  return authModeKey(mode) === 'register' ? 'register' : 'reset';
}

function authCodeCooldownRemaining(mode) {
  const remaining = state.platformAuthCodeCooldownUntil[authCodeKey(mode)] - Date.now();
  return Math.max(0, remaining);
}

function updateAuthCodeButton(mode) {
  const fields = authFields(mode);
  if (!fields.requestCode) return;
  const key = authCodeKey(mode);
  const remaining = authCodeCooldownRemaining(mode);
  if (state.platformAuthCodeRequesting[key]) {
    fields.requestCode.disabled = true;
    fields.requestCode.textContent = '发送中…';
  } else if (remaining > 0) {
    fields.requestCode.disabled = true;
    fields.requestCode.textContent = `${Math.ceil(remaining / 1000)}秒后重试`;
  } else {
    fields.requestCode.disabled = false;
    const hasChallenge = mode === 'email-binding'
      ? Boolean(state.platformAuthChallengeId)
      : mode === 'password-change'
        ? Boolean(state.platformAuthPasswordChallengeId)
        : Boolean(state.platformAuthChallenges[key]);
    fields.requestCode.textContent = hasChallenge ? '重新获取' : '获取验证码';
  }
}

function startAuthCodeCooldown(mode) {
  const key = authCodeKey(mode);
  if (state.platformAuthCodeCooldownTimers[key]) window.clearInterval(state.platformAuthCodeCooldownTimers[key]);
  state.platformAuthCodeCooldownUntil[key] = Date.now() + 60_000;
  updateAuthCodeButton(mode);
  state.platformAuthCodeCooldownTimers[key] = window.setInterval(() => {
    if (authCodeCooldownRemaining(mode) > 0) {
      updateAuthCodeButton(mode);
      return;
    }
    window.clearInterval(state.platformAuthCodeCooldownTimers[key]);
    state.platformAuthCodeCooldownTimers[key] = null;
    state.platformAuthCodeCooldownUntil[key] = 0;
    updateAuthCodeButton(mode);
  }, 1000);
}

function updateAuthFormLabels(mode) {
  const key = authModeKey(mode);
  const fields = authFields(mode);
  if (!fields.form) return;
  if (fields.submit) {
    const hasChallenge = key === 'register'
      ? Boolean(state.platformAuthChallenges.register)
      : key === 'reset'
        ? Boolean(state.platformAuthChallenges.reset || state.platformAuthChallengeId || state.platformAuthPasswordChallengeId)
        : false;
    const label = mode === 'email-binding'
      ? (state.platformAuthChallengeId ? '完成绑定' : '先获取验证码')
      : mode === 'password-change'
        ? (state.platformAuthPasswordChallengeId ? '完成修改' : '先获取验证码')
      : key === 'login'
        ? '登录'
        : key === 'register'
          ? '注册'
          : '提交';
    const span = fields.submit.querySelector('span');
    if (span) span.textContent = label;
  }
  if (fields.requestCode) {
    updateAuthCodeButton(mode);
  }
}

function clearWechatPollTimer() {
  if (state.wechatPollTimer) window.clearTimeout(state.wechatPollTimer);
  if (state.wechatCountdownTimer) window.clearInterval(state.wechatCountdownTimer);
  state.wechatPollTimer = null;
  state.wechatCountdownTimer = null;
  state.wechatExpiresAt = null;
  state.wechatScanned = false;
}

function setPlatformAuthMode(mode) {
  state.platformAuthMode = mode;
  const isWechat = mode === 'wechat';
  const key = authModeKey(mode);
  const isLogin = key === 'login';
  const isRegister = key === 'register';
  const isBinding = mode === 'email-binding';
  const isPasswordChange = mode === 'password-change';
  elements.platformLoginModal.querySelector('.platform-auth-modal').classList.toggle('is-password-change', isPasswordChange);
  document.querySelector('#platform-login-title').textContent = isWechat ? '微信扫码登录' : isBinding ? '绑定邮箱' : isPasswordChange ? '修改密码' : isLogin ? '登录' : isRegister ? '注册' : '忘记密码';
  elements.platformAuthCopy.hidden = isWechat;
  elements.platformAuthCopy.textContent = isBinding
    ? state.platformAuthBindingKind === 'account' ? '为当前账号绑定邮箱' : '为微信账号绑定邮箱'
    : isPasswordChange ? '验证当前邮箱后设置新密码'
    : isLogin ? '使用 Elunvi 账号继续' : isRegister ? '创建账号后即可使用 Mart' : '输入验证码并设置新密码';
  document.querySelectorAll('.platform-auth-form').forEach((form) => {
    form.hidden = isWechat || form.id !== `platform-${key}-form`;
  });
  elements.platformAuthForms.hidden = isWechat;
  elements.platformWechatStart.hidden = !isLogin;
  elements.platformWechatPanel.hidden = !isWechat;
  clearAuthErrors(mode);
  updateAuthFormLabels(mode);
  updateEmailBindingFields(mode);
  const resetEmail = document.querySelector('#platform-reset-email');
  if (resetEmail) resetEmail.readOnly = isPasswordChange;
  if (!isWechat) elements.platformWechatFrame.src = 'about:blank';
  document.querySelectorAll('[data-platform-auth-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.platformAuthMode === mode);
    button.setAttribute('aria-selected', button.dataset.platformAuthMode === mode ? 'true' : 'false');
  });
}

function updateEmailBindingFields(mode = state.platformAuthMode) {
  const accountBinding = mode === 'email-binding' && state.platformAuthBindingKind === 'account';
  ['platform-reset-password', 'platform-reset-confirm'].forEach((id) => {
    const input = document.querySelector(`#${id}`);
    const field = input?.closest('.platform-auth-field');
    if (field) field.hidden = accountBinding;
  });
  document.querySelectorAll('#platform-reset-form .platform-auth-links').forEach((links) => {
    links.hidden = accountBinding || mode === 'password-change';
  });
}

function showEmailBinding(profile, kind = 'account', security = null) {
  clearWechatPollTimer();
  state.platform.status = 'binding_required';
  state.platform.profile = profile;
  state.platform.security = security;
  state.platformAuthBindingKind = kind;
  state.platformAuthChallengeId = null;
  state.platformAuthPasswordChallengeId = null;
  state.platformAuthCodeCooldownUntil.reset = 0;
  setPlatformShell('signed_out');
  setPlatformAuthMode('email-binding');
  elements.platformLoginModal.hidden = false;
  setServerError('email-binding', '登录后需要先绑定邮箱，完成后才能使用 Mart。');
  authFields('email-binding').email.focus();
}

async function requestPlatformCode(mode = state.platformAuthMode) {
  const key = authModeKey(mode);
  const fields = authFields(mode);
  if (authCodeCooldownRemaining(mode) > 0) {
    updateAuthCodeButton(mode);
    return false;
  }
  if (!validateAuthFields(mode, { onlyEmail: true })) return false;
  state.platformAuthCodeRequesting[authCodeKey(mode)] = true;
  updateAuthCodeButton(mode);
  setServerError(mode);
  try {
    const result = key === 'register'
      ? await window.pddMonitor.platform.requestRegistrationCode(fields.email.value.trim())
      : mode === 'email-binding'
        ? state.platformAuthBindingKind === 'account'
          ? await window.pddMonitor.platform.accountEmailBindingCode(fields.email.value.trim())
          : await window.pddMonitor.platform.emailBindingCode(fields.email.value.trim())
        : mode === 'password-change'
          ? await window.pddMonitor.platform.accountPasswordCode(fields.email.value.trim())
          : await window.pddMonitor.platform.requestPasswordResetCode(fields.email.value.trim());
    if (mode === 'email-binding') state.platformAuthChallengeId = result.challengeId;
    else if (mode === 'password-change') state.platformAuthPasswordChallengeId = result.challengeId;
    else state.platformAuthChallenges[key] = result.challengeId;
    updateAuthFormLabels(mode);
    startAuthCodeCooldown(mode);
    fields.code.focus();
    setServerError(mode, mode === 'password-change' ? '' : mode === 'reset'
      ? '如果该邮箱已注册，验证码会发送到邮箱，请注意查收。'
      : '验证码已发送，请检查邮箱。');
    return true;
  } catch (error) {
    setServerError(mode, friendlyError(error) || '验证码发送失败，请稍后重试');
    return false;
  } finally {
    state.platformAuthCodeRequesting[authCodeKey(mode)] = false;
    updateAuthCodeButton(mode);
  }
}

function isMartLinked() {
  return state.mart.linked === true;
}

function formatPoints(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatYuan(fen) {
  return `¥${(Number(fen || 0) / 100).toFixed(2)}`;
}

const ORDER_STATUS_LABELS = { 1: '待支付', 2: '已支付', 3: '已关闭', 4: '已完成', 5: '支付失败' };

const MEMBER_ROLE_OWNER = 1;

function setTabCount(node, value) {
  const text = value ? String(value) : '';
  node.textContent = text;
  node.hidden = !text;
}

function renderEmptyState(container, copy, actionLabel = '', onAction = null) {
  const text = document.createElement('p');
  text.className = 'empty-copy';
  text.textContent = copy;
  container.append(text);
  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.className = 'button button-primary';
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    container.append(button);
  }
}

function renderSignedOutState(container, copy = '登录 Elunvi 账号后即可使用。') {
  renderEmptyState(container, copy, '去登录', () => showPlatformLogin());
}

function setTeamTab(tab) {
  state.teamTab = tab;
  document.querySelectorAll('[data-team-tab]').forEach((button) => {
    const active = button.dataset.teamTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-team-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.teamPanel !== tab;
  });
  if (tab === 'orders') void loadTeamOrders();
}

function setWalletTab(tab) {
  state.walletTab = tab;
  document.querySelectorAll('[data-wallet-tab]').forEach((button) => {
    const active = button.dataset.walletTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-wallet-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.walletPanel !== tab;
  });
  if (tab === 'orders') void loadWalletOrders();
}

// 一个用户可以加入多个团队，切换只影响当前查看和操作的团队
function renderTeamSwitcher() {
  const teams = state.mart.teams || [];
  for (const container of [elements.teamSwitcher, elements.walletSwitcher]) {
    if (!container) continue;
    container.replaceChildren();
    if (teams.length < 2) {
      container.hidden = true;
      continue;
    }
    container.hidden = false;
    for (const item of teams) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `team-chip${String(item.id) === String(state.mart.teamId) ? ' is-active' : ''}`;
      chip.append(document.createTextNode(item.name || '未命名团队'));
      const role = document.createElement('span');
      role.className = 'chip-role';
      role.textContent = item.role === MEMBER_ROLE_OWNER ? '我的团队' : '成员';
      chip.append(role);
      chip.addEventListener('click', () => void selectTeam(item.id));
      container.append(chip);
    }
  }
}

async function selectTeam(teamId) {
  if (String(teamId) === String(state.mart.teamId)) return;
  state.mart.teamId = teamId;
  state.purchase = { kind: null, order: null, attempt: null };
  try { await window.pddMonitor.preferences.set('ui.selectedTeamId', String(teamId)); } catch {}
  await Promise.all([loadTeamData(), loadWalletData()]);
}

// 成员只能看自己的积分流水，充值档位与充值记录只对负责人开放
function applyWalletRole(team) {
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  elements.walletTabRecharge.hidden = !isOwner;
  elements.walletTabOrders.hidden = !isOwner;
  elements.walletTabs.hidden = !isOwner;
  if (!isOwner && state.walletTab !== 'ledger') setWalletTab('ledger');
}

async function loadWalletData() {
  elements.walletSummary.replaceChildren();
  elements.walletPackages.replaceChildren();
  elements.walletTransactions.replaceChildren();
  elements.walletLedgerPagination.replaceChildren();
  if (!isMartLinked()) {
    renderSignedOutState(elements.walletSummary);
    return;
  }
  if (!state.mart.team) await loadTeamData();
  renderTeamSwitcher();
  const team = state.mart.team;
  if (!team) {
    renderEmptyState(elements.walletSummary, '当前账号还没有团队，暂时无法使用团队积分。');
    return;
  }
  applyWalletRole(team);
  const page = state.mart.pages.ledger;
  try {
    const [wallet, packages, transactions] = await Promise.all([
      window.pddMonitor.mart.wallet(team.id),
      window.pddMonitor.mart.walletPackages(),
      window.pddMonitor.mart.walletTransactions({
        teamId: team.id,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE
      })
    ]);
    state.mart.wallet = wallet.wallet;
    state.mart.packages = packages.packages || [];
    state.mart.transactions = transactions.transactions || [];
    state.mart.transactionTotal = transactions.total || 0;
    renderWalletSummary(team);
    renderWalletPackages(team);
    renderWalletTransactions();
    if (state.walletTab === 'orders') void loadWalletOrders();
  } catch (error) {
    showNotice(error.message || '积分信息暂时无法加载', true);
    renderEmptyState(elements.walletSummary, '积分信息暂时无法加载，请稍后重试。', '重新加载', () => void loadWalletData());
  }
}

function renderWalletSummary(team) {
  elements.walletSummary.replaceChildren();
  const wallet = state.mart.wallet || { balance_points: 0 };
  const head = document.createElement('div');
  head.className = 'wallet-hero-head';
  const label = document.createElement('span');
  label.textContent = '积分余额';
  const teamChip = document.createElement('span');
  teamChip.className = 'wallet-team-chip';
  teamChip.append(createIcon('users'), document.createTextNode(team.name || '我的团队'));
  head.append(label, teamChip);

  const value = document.createElement('div');
  value.className = 'wallet-balance-value';
  value.append(document.createTextNode(formatPoints(wallet.balance_points)));
  const unit = document.createElement('i');
  unit.textContent = '积分';
  value.append(unit);

  elements.walletSummary.append(head, value);
  refreshIcons();
}

function renderWalletPackages(team) {
  elements.walletPackages.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const packages = state.mart.packages || [];
  if (!packages.length) {
    elements.walletPurchaseBar.hidden = true;
    renderEmptyState(elements.walletPackages, '暂无可购买的充值档位。');
    return;
  }
  // 默认选中折扣档（更划算），之后保留用户上一次的选择
  if (!packages.some((item) => item.id === state.walletPackageId)) {
    const preferred = packages.find((item) => item.payable_fen < item.price_fen) || packages[0];
    state.walletPackageId = preferred.id;
  }
  for (const item of packages) {
    const selected = item.id === state.walletPackageId;
    const discounted = item.payable_fen < item.price_fen;
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `plan-option${selected ? ' is-selected' : ''}`;
    option.setAttribute('aria-pressed', selected ? 'true' : 'false');
    option.addEventListener('click', () => {
      state.walletPackageId = item.id;
      renderWalletPackages(team);
    });

    const title = document.createElement('h4');
    title.textContent = `${formatPoints(item.points)} 积分`;
    const price = document.createElement('div');
    price.className = 'plan-price';
    const currency = document.createElement('span');
    currency.className = 'currency';
    currency.textContent = '¥';
    const amount = document.createElement('strong');
    amount.textContent = item.payable_fen % 100 === 0
      ? String(item.payable_fen / 100)
      : (item.payable_fen / 100).toFixed(2);
    price.append(currency, amount);
    if (discounted) {
      const original = document.createElement('del');
      original.textContent = `¥${item.price_fen / 100}`;
      price.append(original);
    }
    option.append(title, price);
    if (discounted) {
      const ribbon = document.createElement('span');
      ribbon.className = 'plan-ribbon';
      ribbon.textContent = `${(item.payable_fen / item.price_fen * 10).toFixed(1).replace(/\.0$/u, '')} 折`;
      option.append(ribbon);
    }
    if (selected) {
      const check = document.createElement('span');
      check.className = 'option-check';
      check.append(createIcon('check'));
      option.append(check);
    }
    elements.walletPackages.append(option);
  }
  renderWalletPurchaseBar(team, packages, isOwner);
  refreshIcons();
}

// 档位只负责选择，充值统一由这里的一个按钮发起
function renderWalletPurchaseBar(team, packages, isOwner) {
  const bar = elements.walletPurchaseBar;
  bar.replaceChildren();
  const selected = packages.find((item) => item.id === state.walletPackageId);
  if (!selected) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const summary = document.createElement('div');
  summary.className = 'purchase-summary';
  const title = document.createElement('strong');
  title.textContent = `已选 ${formatPoints(selected.points)} 积分`;
  const meta = document.createElement('small');
  meta.textContent = selected.payable_fen < selected.price_fen
    ? `实付 ${formatYuan(selected.payable_fen)}，原价 ${formatYuan(selected.price_fen)}`
    : `实付 ${formatYuan(selected.payable_fen)}`;
  summary.append(title, meta);
  const submit = document.createElement('button');
  submit.className = 'button button-primary';
  submit.type = 'button';
  submit.textContent = isOwner ? '立即充值' : '仅负责人可充值';
  submit.disabled = !isOwner;
  if (isOwner) submit.addEventListener('click', () => void startRechargePurchase(selected));
  bar.append(summary, submit);
}

const PAGE_SIZE = 10;

function tableEmptyRow(colspan, text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.className = 'table-empty';
  cell.textContent = text;
  row.append(cell);
  return row;
}

function renderPager(container, { total, page, onChange }) {
  container.replaceChildren();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  container.hidden = total <= PAGE_SIZE;
  if (container.hidden) return;
  const summary = document.createElement('span');
  summary.className = 'pagination-summary';
  summary.textContent = `共 ${total} 条`;
  const controls = document.createElement('div');
  controls.className = 'pagination-controls';
  const prev = document.createElement('button');
  prev.className = 'button';
  prev.type = 'button';
  prev.textContent = '上一页';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => onChange(page - 1));
  const current = document.createElement('span');
  current.className = 'pagination-current';
  current.textContent = `第 ${page} / ${totalPages} 页`;
  const next = document.createElement('button');
  next.className = 'button';
  next.type = 'button';
  next.textContent = '下一页';
  next.disabled = page >= totalPages;
  next.addEventListener('click', () => onChange(page + 1));
  controls.append(prev, current, next);
  container.append(summary, controls);
}

function renderWalletTransactions() {
  const body = elements.walletTransactions;
  body.replaceChildren();
  const rows = state.mart.transactions || [];
  if (!rows.length) {
    body.append(tableEmptyRow(4, '还没有你在该团队的积分记录'));
    return;
  }
  for (const row of rows) {
    const tr = document.createElement('tr');
    const time = document.createElement('td');
    time.className = 'time';
    time.textContent = formatDate(row.created_at, '时间待同步');
    const memo = document.createElement('td');
    memo.textContent = row.memo || '积分变动';
    const delta = document.createElement('td');
    delta.className = 'ledger-delta';
    delta.textContent = `${row.points > 0 ? '+' : ''}${formatPoints(row.points)}`;
    const balance = document.createElement('td');
    balance.className = 'ledger-balance';
    balance.textContent = formatPoints(row.balance_after);
    tr.append(time, memo, delta, balance);
    body.append(tr);
  }
  renderPager(elements.walletLedgerPagination, {
    total: state.mart.transactionTotal,
    page: state.mart.pages.ledger,
    onChange: (next) => {
      state.mart.pages.ledger = next;
      void loadWalletData();
    }
  });
}

// 订单快照里只有档位代码，展示时映射成档位名称
function planLabel(code) {
  const plan = (state.mart.membership?.plans || []).find((item) => item.code === code);
  return plan ? plan.name : (code || '一个月');
}

const ORDER_STATUS_CHIPS = {
  1: ['待支付', 'status-warning'],
  2: ['已支付', 'status-info'],
  3: ['已关闭', 'status-muted'],
  4: ['已完成', 'status-active'],
  5: ['支付失败', 'status-lost']
};

function renderOrderTable(body, orders, kind) {
  body.replaceChildren();
  if (!orders.length) {
    body.append(tableEmptyRow(6, kind === 'membership' ? '还没有会员购买记录' : '还没有充值记录'));
    return;
  }
  for (const order of orders) {
    const snapshot = order.quote_snapshot || {};
    const tr = document.createElement('tr');
    const no = document.createElement('td');
    no.className = 'order-no';
    no.textContent = order.order_no;
    const subject = document.createElement('td');
    subject.textContent = kind === 'recharge'
      ? `${formatPoints(snapshot.points || 0)} 积分`
      : `会员 · ${planLabel(snapshot.plan_code)}`;
    const amount = document.createElement('td');
    amount.className = 'order-amount';
    amount.textContent = formatYuan(order.amount_fen);
    const status = document.createElement('td');
    const [label, chipClass] = ORDER_STATUS_CHIPS[order.status] || ['处理中', 'status-info'];
    const chip = document.createElement('span');
    chip.className = `status ${chipClass}`;
    chip.textContent = label;
    status.append(chip);
    const time = document.createElement('td');
    time.className = 'time';
    time.textContent = formatDate(order.created_at, '时间待同步');
    const action = document.createElement('td');
    action.className = 'order-action';
    if (order.status === 1) {
      const resume = document.createElement('button');
      resume.className = 'button';
      resume.type = 'button';
      resume.textContent = '继续支付';
      resume.addEventListener('click', () => openPurchase(kind, order));
      action.append(resume);
    }
    tr.append(no, subject, amount, status, time, action);
    body.append(tr);
  }
}

async function loadTeamOrders() {
  if (!isMartLinked()) return;
  if (!state.mart.team) await loadTeamData();
  const team = state.mart.team;
  if (!team) return;
  elements.teamOrderBody.replaceChildren();
  elements.teamOrderPagination.replaceChildren();
  const page = state.mart.pages.teamOrders;
  try {
    const result = await window.pddMonitor.mart.orders({
      teamId: team.id,
      bizType: 1,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    });
    state.mart.teamOrders = result.orders || [];
    setTabCount(elements.teamOrderCount, result.total);
    renderOrderTable(elements.teamOrderBody, state.mart.teamOrders, 'membership');
    renderPager(elements.teamOrderPagination, {
      total: result.total,
      page,
      onChange: (next) => {
        state.mart.pages.teamOrders = next;
        void loadTeamOrders();
      }
    });
  } catch (error) {
    showNotice(error.message || '购买记录暂时无法加载', true);
    elements.teamOrderBody.append(tableEmptyRow(6, '购买记录暂时无法加载'));
  }
}

async function loadWalletOrders() {
  if (!isMartLinked()) return;
  if (!state.mart.team) await loadTeamData();
  const team = state.mart.team;
  if (!team) return;
  elements.walletOrderBody.replaceChildren();
  elements.walletOrderPagination.replaceChildren();
  const page = state.mart.pages.walletOrders;
  try {
    const result = await window.pddMonitor.mart.orders({
      teamId: team.id,
      bizType: 2,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE
    });
    state.mart.walletOrders = result.orders || [];
    setTabCount(elements.walletOrderCount, result.total);
    renderOrderTable(elements.walletOrderBody, state.mart.walletOrders, 'recharge');
    renderPager(elements.walletOrderPagination, {
      total: result.total,
      page,
      onChange: (next) => {
        state.mart.pages.walletOrders = next;
        void loadWalletOrders();
      }
    });
  } catch (error) {
    showNotice(error.message || '充值记录暂时无法加载', true);
    elements.walletOrderBody.append(tableEmptyRow(6, '充值记录暂时无法加载'));
  }
}

async function resolveCurrentTeam({ refresh = false } = {}) {
  if (!refresh && state.mart.team) return state.mart.team;
  const teams = await window.pddMonitor.mart.teams();
  state.mart.teams = teams.teams || [];
  if (!state.mart.preferencesLoaded) {
    state.mart.preferencesLoaded = true;
    try {
      const saved = await window.pddMonitor.preferences.get('ui.selectedTeamId');
      if (!state.mart.teamId && saved) state.mart.teamId = saved;
    } catch {}
  }
  const selected = state.mart.teamId
    ? state.mart.teams.find((item) => String(item.id) === String(state.mart.teamId))
    : null;
  state.mart.team = selected || teams.default_team || state.mart.teams[0] || null;
  state.mart.teamId = state.mart.team ? state.mart.team.id : null;
  return state.mart.team;
}

async function loadTeamData() {
  elements.teamSummary.replaceChildren();
  elements.teamPlans.replaceChildren();
  elements.teamMembers.replaceChildren();
  if (!isMartLinked()) {
    renderSignedOutState(elements.teamSummary, '登录 Elunvi 账号后即可管理团队。');
    return;
  }
  try {
    const team = await resolveCurrentTeam({ refresh: true });
    renderTeamSwitcher();
    if (!team) {
      renderEmptyState(elements.teamSummary, '当前账号还没有团队。');
      return;
    }
    const [membership, members] = await Promise.all([
      window.pddMonitor.mart.membership(team.id),
      window.pddMonitor.mart.teamMembers(team.id).catch(() => null)
    ]);
    state.mart.membership = membership;
    state.mart.members = members?.members || [];
    renderTeamSummary(team, membership);
    renderTeamPlans(team, membership);
    renderTeamMembers(team);
    if (state.teamTab === 'orders') void loadTeamOrders();
  } catch (error) {
    showNotice(error.message || '团队信息暂时无法加载', true);
    renderEmptyState(elements.teamSummary, '团队信息暂时无法加载，请稍后重试。', '重新加载', () => void loadTeamData());
  }
}

function renderTeamSummary(team, membership) {
  elements.teamSummary.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const subscription = membership?.subscription || null;
  const active = Boolean(subscription?.active);
  const quota = membership?.quota || {};
  const usedMembers = Number(quota.used_members ?? 1);
  const maxMembers = Number(quota.max_members ?? 1);
  const memberFull = usedMembers >= maxMembers;

  const identity = document.createElement('div');
  identity.className = 'team-identity';
  const avatar = document.createElement('span');
  avatar.className = 'team-avatar';
  avatar.textContent = (team.name || '团').trim().slice(0, 1);
  const titleRow = document.createElement('div');
  titleRow.className = 'team-title-row';
  const heading = document.createElement('h3');
  heading.textContent = team.name || '我的团队';
  const planChip = document.createElement('span');
  planChip.className = `chip ${active ? 'chip-plan' : 'chip-muted'}`;
  planChip.textContent = active ? (subscription.plan?.name || '会员已开通') : '未开通会员';
  const roleChip = document.createElement('span');
  roleChip.className = `chip ${isOwner ? 'chip-owner' : 'chip-member'}`;
  roleChip.textContent = isOwner ? '负责人' : '成员';
  titleRow.append(heading, planChip, roleChip);
  identity.append(avatar, titleRow);

  const actions = document.createElement('div');
  actions.className = 'team-hero-actions';
  const join = document.createElement('button');
  join.className = 'button-link is-primary';
  join.type = 'button';
  join.textContent = '加入其他团队';
  join.addEventListener('click', () => openTeamAction('join'));
  actions.append(join);
  if (isOwner) {
    const invite = document.createElement('button');
    invite.className = 'button-link is-primary';
    invite.type = 'button';
    invite.textContent = '邀请成员';
    if (memberFull) {
      // 名额已满时邀请没有意义：后端在成员接受邀请时才会拒绝，这里提前挡住
      invite.disabled = true;
      invite.title = active
        ? `成员席位已满（${usedMembers}/${maxMembers}），升级会员后可继续邀请`
        : '当前团队未开通会员，开通后才能邀请成员';
    } else {
      invite.addEventListener('click', () => openTeamAction('invite'));
    }
    actions.append(invite);
  } else {
    const leave = document.createElement('button');
    leave.className = 'button-link';
    leave.type = 'button';
    leave.textContent = '退出团队';
    leave.addEventListener('click', () => void leaveCurrentTeam(team));
    actions.append(leave);
  }

  const head = document.createElement('div');
  head.className = 'team-hero-head';
  head.append(identity, actions);

  const metrics = document.createElement('div');
  metrics.className = 'team-metrics';
  const tiles = [
    ['users', '成员席位', `${usedMembers} / ${maxMembers}`, memberFull],
    ['store', '店铺额度', `${quota.max_shops ?? 0} 家`, false],
    ['calendar-clock', '会员到期', active ? formatDay(subscription.expires_at) : '—', false]
  ];
  for (const [icon, label, value, full] of tiles) {
    const tile = document.createElement('div');
    tile.className = 'hero-metric';
    const name = document.createElement('span');
    name.className = 'metric-label';
    name.append(createIcon(icon), document.createTextNode(label));
    const strong = document.createElement('strong');
    strong.textContent = value;
    if (full) strong.classList.add('is-full');
    tile.append(name, strong);
    metrics.append(tile);
  }

  elements.teamSummary.append(head, metrics);
  refreshIcons();
}

function renderTeamPlans(team, membership) {
  elements.teamPlans.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  // 成员只需要在概览里看到当前档位，购买入口只对负责人展示
  elements.teamTabs.hidden = !isOwner;
  elements.teamTabPlans.hidden = !isOwner;
  if (!isOwner) {
    if (state.teamTab === 'plans') setTeamTab('members');
    return;
  }
  const plans = membership?.plans || [];
  const current = membership?.subscription?.active ? membership.subscription.plan : null;
  if (!plans.length) {
    elements.teamPurchaseBar.hidden = true;
    renderEmptyState(elements.teamPlans, '暂时没有可购买的会员档位。');
    return;
  }
  // 默认选中当前档位（多半是要续期），没有订阅时从最低档开始
  if (!plans.some((item) => item.id === state.mart.teamPlanId)) {
    state.mart.teamPlanId = current ? current.id : plans[0].id;
  }
  for (const plan of plans) {
    const selected = plan.id === state.mart.teamPlanId;
    const isCurrent = Boolean(current) && plan.id === current.id;
    const isDowngrade = Boolean(current) && plan.sort_order < current.sort_order;
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `plan-option${selected ? ' is-selected' : ''}${isDowngrade ? ' is-muted' : ''}`;
    option.setAttribute('aria-pressed', selected ? 'true' : 'false');
    option.addEventListener('click', () => {
      state.mart.teamPlanId = plan.id;
      renderTeamPlans(team, membership);
    });

    const title = document.createElement('h4');
    title.textContent = plan.name;
    const price = document.createElement('div');
    price.className = 'plan-price';
    const currency = document.createElement('span');
    currency.className = 'currency';
    currency.textContent = '¥';
    const amount = document.createElement('strong');
    amount.textContent = String(Math.round(plan.price_fen / 100));
    const period = document.createElement('span');
    period.className = 'period';
    period.textContent = '/月';
    price.append(currency, amount, period);

    const features = document.createElement('ul');
    features.className = 'plan-features';
    for (const text of [
      `最多 ${plan.max_members} 个成员席位`,
      `每个成员可管理 ${plan.max_shops} 家店铺`
    ]) {
      const li = document.createElement('li');
      li.append(createIcon('check'), document.createTextNode(text));
      features.append(li);
    }
    option.append(title, price, features);
    if (isCurrent) {
      const ribbon = document.createElement('span');
      ribbon.className = 'plan-ribbon';
      ribbon.textContent = '当前档位';
      option.append(ribbon);
    }
    if (selected) {
      const check = document.createElement('span');
      check.className = 'option-check';
      check.append(createIcon('check'));
      option.append(check);
    }
    elements.teamPlans.append(option);
  }
  renderTeamPurchaseBar(plans, current);
  refreshIcons();
}

// 选中的档位汇总在底部固定栏里，购买只由这里的一个按钮发起
function renderTeamPurchaseBar(plans, current) {
  const bar = elements.teamPurchaseBar;
  bar.replaceChildren();
  const plan = plans.find((item) => item.id === state.mart.teamPlanId);
  if (!plan) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const isCurrent = Boolean(current) && plan.id === current.id;
  const isUpgrade = Boolean(current) && plan.sort_order > current.sort_order;
  const isDowngrade = Boolean(current) && plan.sort_order < current.sort_order;

  const summary = document.createElement('div');
  summary.className = 'purchase-summary';
  const title = document.createElement('strong');
  title.textContent = `已选 ${plan.name} · ${formatYuan(plan.price_fen)}/月`;
  const meta = document.createElement('small');
  meta.textContent = isCurrent
    ? '当前档位，续期从到期日顺延一个月'
    : isUpgrade
      ? '按剩余时间补差价，到期时间不变'
      : isDowngrade
        ? '会员到期后才能重新购买该档位'
        : '支付成功后立即生效，有效期一个月';
  summary.append(title, meta);

  const submit = document.createElement('button');
  submit.className = 'button button-primary';
  submit.type = 'button';
  submit.disabled = isDowngrade;
  submit.textContent = isDowngrade
    ? '到期后可购买'
    : isCurrent ? '续期一个月' : isUpgrade ? '升级并补差价' : '购买一个月';
  if (!isDowngrade) submit.addEventListener('click', () => void startMembershipPurchase(plan));
  bar.append(summary, submit);
}

// 有平台头像就加载头像，加载失败或没有头像时回退到首字
function renderMemberAvatar(container, member) {
  container.replaceChildren();
  const fallback = () => {
    container.replaceChildren();
    container.textContent = (member.display_name || '成').trim().slice(0, 1);
  };
  if (!member.avatar_url) {
    fallback();
    return;
  }
  const image = document.createElement('img');
  image.src = member.avatar_url.replace(/^http:/, 'https:');
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', fallback, { once: true });
  container.replaceChildren(image);
}

function renderTeamMembers(team) {
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const members = state.mart.members || [];
  const body = elements.teamMembers;
  body.replaceChildren();
  setTabCount(elements.teamTabCount, members.length);
  if (!members.length) {
    body.append(tableEmptyRow(4, '成员列表暂时无法加载'));
    return;
  }
  for (const member of members) {
    const tr = document.createElement('tr');
    const userCell = document.createElement('td');
    const cell = document.createElement('div');
    cell.className = 'account-cell';
    const avatar = document.createElement('span');
    avatar.className = `member-avatar${member.role === MEMBER_ROLE_OWNER ? ' is-owner' : ''}`;
    renderMemberAvatar(avatar, member);
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'primary-text';
    name.textContent = member.display_name || '未命名成员';
    info.append(name);
    cell.append(avatar, info);
    userCell.append(cell);

    const roleCell = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = `chip ${member.role === MEMBER_ROLE_OWNER ? 'chip-owner' : 'chip-member'}`;
    chip.textContent = member.role === MEMBER_ROLE_OWNER ? '负责人' : '成员';
    roleCell.append(chip);

    const timeCell = document.createElement('td');
    timeCell.className = 'time';
    timeCell.textContent = formatDate(member.joined_at, '待确认');

    const actionCell = document.createElement('td');
    actionCell.className = 'order-action';
    if (isOwner && member.role !== MEMBER_ROLE_OWNER) {
      const remove = document.createElement('button');
      remove.className = 'icon-button';
      remove.type = 'button';
      remove.title = '移除成员';
      remove.setAttribute('aria-label', '移除成员');
      remove.append(createIcon('user-minus'));
      remove.addEventListener('click', () => void removeTeamMember(member));
      actionCell.append(remove);
    }
    tr.append(userCell, roleCell, timeCell, actionCell);
    body.append(tr);
  }
  refreshIcons();
}

async function removeTeamMember(member) {
  const team = state.mart.team;
  if (!team) return;
  const name = member.display_name || '该成员';
  const ok = await confirmAction({
    title: '移除团队成员？',
    description: `移除「${name}」后，对方立即失去团队权限。`,
    confirmLabel: '移除成员',
    icon: 'user-minus'
  });
  if (!ok) return;
  try {
    await window.pddMonitor.mart.removeMember({ teamId: team.id, memberId: member.id });
    await loadTeamData();
    showNotice('成员已移除');
  } catch (error) {
    showNotice(error.message || '移除成员失败', true);
  }
}

async function leaveCurrentTeam(team) {
  const ok = await confirmAction({
    title: '退出团队？',
    description: `退出「${team.name || '该团队'}」后将失去团队资源和会员权益。`,
    confirmLabel: '退出团队',
    icon: 'log-out'
  });
  if (!ok) return;
  try {
    await window.pddMonitor.mart.leaveTeam(team.id);
    state.mart.team = null;
    state.mart.teamId = null;
    await loadTeamData();
    showNotice('已退出团队');
  } catch (error) {
    showNotice(error.message || '退出团队失败', true);
  }
}

function openTeamAction(mode) {
  state.teamActionMode = mode;
  elements.teamActionError.hidden = true;
  elements.teamActionForm.reset();
  const invite = mode === 'invite';
  elements.teamActionTitle.textContent = invite ? '邀请成员' : '加入团队';
  elements.teamActionDescription.textContent = invite
    ? '邀请码会发送到成员邮箱，成员登录后输入邀请码即可加入。'
    : '输入负责人发给你的 6 位邀请码，即可加入对应团队。';
  elements.teamNameField.hidden = true;
  elements.teamEmailField.hidden = !invite;
  elements.teamDisplayField.hidden = true;
  elements.teamCodeField.hidden = invite;
  elements.teamActionSubmit.textContent = invite ? '发送邀请' : '加入团队';
  elements.teamActionModal.hidden = false;
  (invite ? elements.teamActionEmail : elements.teamActionCode).focus();
}

function closeTeamAction() {
  elements.teamActionModal.hidden = true;
  state.teamActionMode = null;
}

async function submitTeamAction(event) {
  event.preventDefault();
  const mode = state.teamActionMode;
  if (!mode) return;
  elements.teamActionSubmit.disabled = true;
  elements.teamActionError.hidden = true;
  try {
    if (mode === 'invite') {
      const team = state.mart.team;
      if (!team) throw new Error('当前没有可操作的团队');
      const email = elements.teamActionEmail.value.trim();
      await window.pddMonitor.mart.inviteMember({ teamId: team.id, email });
      closeTeamAction();
      showNotice(`邀请码已发送到 ${email}`);
    } else {
      const code = elements.teamActionCode.value.trim();
      const result = await window.pddMonitor.mart.acceptInvitation(code);
      closeTeamAction();
      await Promise.all([loadTeamData(), loadWalletData()]);
      showNotice(`已加入「${result.team?.name || '团队'}」`);
    }
  } catch (error) {
    elements.teamActionErrorText.textContent = error.message || '操作没有完成，请稍后重试';
    elements.teamActionError.hidden = false;
  } finally {
    elements.teamActionSubmit.disabled = false;
  }
}

async function startMembershipPurchase(plan) {
  const team = state.mart.team;
  if (!team) return;
  try {
    const quote = await window.pddMonitor.mart.membershipQuote({ teamId: team.id, planId: plan.id });
    const order = await window.pddMonitor.mart.membershipOrder({ teamId: team.id, quoteId: quote.id });
    openPurchase('membership', order, plan);
  } catch (error) {
    showNotice(error.message || '创建会员订单失败', true);
  }
}

async function startRechargePurchase(pkg) {
  const team = state.mart.team;
  if (!team) return;
  try {
    const order = await window.pddMonitor.mart.rechargeOrder({ teamId: team.id, packageId: pkg.id });
    openPurchase('recharge', order, pkg);
  } catch (error) {
    showNotice(error.message || '创建充值订单失败', true);
  }
}

function openPurchase(kind, order, subject) {
  state.purchase = { kind, order, attempt: null, subject };
  showView('payment');
  renderPaymentOrder();
}

function purchaseSubject() {
  const { kind, order, subject } = state.purchase;
  const snapshot = order?.quote_snapshot || {};
  if (kind === 'membership') return `会员 · ${subject?.name || planLabel(snapshot.plan_code)}`;
  if (kind === 'recharge') return `${formatPoints(snapshot.points || subject?.points || 0)} 积分`;
  return 'Mart 订单';
}

function renderPaymentOrder() {
  const { order, attempt } = state.purchase;
  elements.paymentStatusCard.hidden = !order;
  if (!order) return;
  elements.paymentStatusCopy.textContent = `订单 ${order.order_no} · ${ORDER_STATUS_LABELS[order.status] || '处理中'}`;

  const detail = elements.paymentOrderDetail;
  detail.replaceChildren();
  const rows = [
    ['商品', purchaseSubject()],
    ['应付金额', formatYuan(order.amount_fen)],
    ['订单状态', ORDER_STATUS_LABELS[order.status] || '处理中'],
    ['支付方式', order.channel ? (order.channel === 'mock' ? '本地模拟支付' : order.channel) : '未发起'],
    ['有效至', formatDate(order.expire_at, '待确认')]
  ];
  if (order.paid_at) rows.push(['支付时间', formatDate(order.paid_at, '待确认')]);
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'finance-row';
    const left = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = label;
    left.append(name);
    const right = document.createElement('div');
    right.className = 'finance-row-value';
    right.textContent = value;
    row.append(left, right);
    detail.append(row);
  }

  const channel = attempt?.channel || order.channel || '';
  elements.paymentSimulate.hidden = !(order.status === 1 && attempt && channel === 'mock');
  elements.paymentRefreshOrder.hidden = !(order.status === 1 || order.status === 2);
  elements.paymentCloseOrder.hidden = order.status !== 1;

  if (order.status === 1 && !attempt) {
    const pick = document.createElement('div');
    pick.className = 'payment-channel-actions';
    const alipay = document.createElement('button');
    alipay.className = 'button button-primary';
    alipay.type = 'button';
    alipay.textContent = '支付宝支付';
    alipay.addEventListener('click', () => void beginPayment('alipay'));
    const mock = document.createElement('button');
    mock.className = 'button';
    mock.type = 'button';
    mock.textContent = '本地模拟支付';
    mock.addEventListener('click', () => void beginPayment('mock'));
    pick.append(alipay, mock);
    detail.append(pick);
  }
  if (order.status === 1 && attempt?.payment_params?.pay_url) {
    const open = document.createElement('button');
    open.className = 'button button-primary';
    open.type = 'button';
    open.textContent = '打开支付宝扫码窗口';
    open.addEventListener('click', async () => {
      try {
        await window.pddMonitor.mart.openPayWindow(attempt.payment_params.pay_url);
        showNotice('请用支付宝扫码支付，完成后关闭窗口即可自动确认');
      } catch (error) {
        showNotice(error.message || '无法打开支付窗口', true);
      }
    });
    const browser = document.createElement('button');
    browser.className = 'button';
    browser.type = 'button';
    browser.textContent = '在浏览器打开';
    browser.addEventListener('click', async () => {
      try {
        await window.pddMonitor.mart.openPayUrl(attempt.payment_params.pay_url);
      } catch (error) {
        showNotice(error.message || '无法打开支付页面', true);
      }
    });
    const actions = document.createElement('div');
    actions.className = 'payment-channel-actions';
    actions.append(open, browser);
    const hint = document.createElement('p');
    hint.className = 'empty-copy';
    hint.textContent = '扫码完成支付后，窗口关闭会自动查询支付状态。';
    detail.append(actions, hint);
  }
  if (order.status === 4) {
    const done = document.createElement('p');
    done.className = 'empty-copy';
    done.textContent = state.purchase.kind === 'membership'
      ? '会员已生效，可返回团队页查看新的档位和配额。'
      : '积分已到账，可返回钱包页查看余额和流水。';
    detail.append(done);
  }
}

async function beginPayment(channel = 'mock') {
  const order = state.purchase.order;
  if (!order) return;
  try {
    const result = await window.pddMonitor.mart.paymentAttempt({ orderId: order.id, channel });
    state.purchase.attempt = result.attempt;
    state.purchase.order = result.order;
    renderPaymentOrder();
    startOrderPolling();
  } catch (error) {
    showNotice(error.message || '发起支付失败', true);
  }
}

function startOrderPolling() {
  stopOrderPolling();
  state.orderPollTimer = window.setInterval(() => void refreshPaymentOrder(false), 3000);
}

function stopOrderPolling() {
  if (state.orderPollTimer) {
    window.clearInterval(state.orderPollTimer);
    state.orderPollTimer = null;
  }
}

async function refreshPaymentOrder(showFeedback = true, { sync = false } = {}) {
  const order = state.purchase.order;
  if (!order) return;
  try {
    // 手动查询时让服务端向渠道查单；自动轮询只读订单，避免频繁打渠道
    const fresh = sync
      ? await window.pddMonitor.mart.syncOrder(order.id)
      : await window.pddMonitor.mart.order(order.id);
    state.purchase.order = fresh;
    renderPaymentOrder();
    if (fresh.status !== 1) {
      // 关单、履约或失败都会改变记录列表里的状态，这里同步刷新一次
      stopOrderPolling();
      if (state.purchase.kind === 'membership') void loadTeamOrders(); else void loadWalletOrders();
    }
    if (fresh.status === 4) {
      await Promise.all([loadTeamData(), loadWalletData()]);
      showNotice(state.purchase.kind === 'membership' ? '会员已生效' : '充值已到账');
    } else if (fresh.status !== 1 || showFeedback) {
      showNotice(`订单状态：${ORDER_STATUS_LABELS[fresh.status] || '处理中'}`);
    }
  } catch (error) {
    if (showFeedback) showNotice(error.message || '订单状态暂时无法确认', true);
  }
}

async function simulatePayment() {
  const order = state.purchase.order;
  if (!order) return;
  elements.paymentSimulate.disabled = true;
  try {
    await window.pddMonitor.mart.simulatePayment(order.id);
    await refreshPaymentOrder(false);
  } catch (error) {
    showNotice(error.message || '模拟支付失败', true);
  } finally {
    elements.paymentSimulate.disabled = false;
  }
}

async function closePurchaseOrder() {
  const order = state.purchase.order;
  if (!order) return;
  try {
    await window.pddMonitor.mart.closeOrder(order.id);
    stopOrderPolling();
    await refreshPaymentOrder(false);
    showNotice('订单已关闭');
  } catch (error) {
    showNotice(error.message || '关闭订单失败', true);
  }
}

async function logoutPlatform() {
  const ok = await confirmAction({
    title: '退出 Elunvi 账号？',
    description: '退出后监控任务会暂停，重新登录才能继续同步。',
    confirmLabel: '退出登录',
    icon: 'log-out'
  });
  if (!ok) return;
  await window.pddMonitor.platform.logout();
  state.accounts = [];
  state.platformAuthBindingKind = null;
  state.platformAuthChallengeId = null;
  state.platform = { status: 'signed_out', profile: null, security: null, team: null, billing: null, accountEmail: null };
  setPlatformShell('signed_out');
  document.querySelectorAll('.view').forEach((view) => { view.hidden = true; });
  showPlatformLogin();
}

async function refreshMartState() {
  try {
    const result = await window.pddMonitor.mart.state();
    state.mart.linked = Boolean(result?.linked);
    state.mart.user = result?.user || null;
  } catch {
    state.mart.linked = false;
    state.mart.user = null;
  }
  return state.mart.linked;
}

async function loadPlatformState() {
  try {
    const result = await window.pddMonitor.platform.state();
    if (result.status === 'signed_in') {
      state.platform.status = 'signed_in';
      state.platform.profile = result.profile;
      state.platform.security = result.security || null;
      state.platform.accountEmail = result.accountEmail || null;
      setPlatformShell('signed_in');
      await Promise.all([loadAccounts(), refreshMartState()]);
      return;
    }
    if (result.status === 'binding_required') {
      showEmailBinding(result.profile, 'account', result.security);
      return;
    }
    setPlatformShell(result.status === 'error' ? 'error' : 'signed_out');
    showPlatformLogin(result.message || '');
  } catch (error) {
    setPlatformShell('error');
    showPlatformLogin(error.message || '暂时无法连接 Elunvi Platform');
  }
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
  if (/this product is inactive/i.test(original)) return '当前产品尚未在 Elunvi Platform 激活，请先激活产品码 elunvi-mart。';
  const ipcMessage = original.match(/Error invoking remote method '[^']+': (?:Error|PlatformApiError): (.+)$/);
  return ipcMessage?.[1] || original || '操作没有完成，请稍后重试。';
}

function syncCooldownRemaining(accountId) {
  return Math.max(0, (state.syncCooldownUntilByAccount.get(accountId) || 0) - Date.now());
}

function updateSyncButton() {
  const button = elements.syncProducts;
  if (!button) return;
  const label = button.querySelector('span');
  if (state.syncInProgress) {
    button.disabled = true;
    label.textContent = '同步中';
    return;
  }
  const remainingMs = syncCooldownRemaining(state.currentAccount?.id);
  if (remainingMs > 0) {
    button.disabled = true;
    label.textContent = `${Math.ceil(remainingMs / 1000)} 秒后可同步`;
    if (!state.syncCooldownTimer) state.syncCooldownTimer = window.setInterval(updateSyncButton, 250);
    return;
  }
  button.disabled = false;
  label.textContent = '从后台同步';
  if (state.syncCooldownTimer) {
    window.clearInterval(state.syncCooldownTimer);
    state.syncCooldownTimer = null;
  }
}

function startSyncCooldown(accountId, durationMs = 60_000) {
  const until = Date.now() + durationMs;
  state.syncCooldownUntilByAccount.set(accountId, Math.max(until, state.syncCooldownUntilByAccount.get(accountId) || 0));
  updateSyncButton();
}

function applySyncCooldownFromError(error, accountId) {
  const message = String(error?.message || error || '');
  const match = message.match(/(\d+)\s*秒/);
  if (match) startSyncCooldown(accountId, Math.max(1000, Number(match[1]) * 1000));
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
  if (!isPlatformSignedIn()) {
    showPlatformLogin('请先登录 Elunvi 账号');
    return;
  }
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
  const isAccounts = name === 'accounts';
  const isSettings = name === 'settings';
  elements.addAccount.hidden = !isAccounts;
  elements.pageMeta.hidden = true;
  elements.pageBack.hidden = true;
  if (isAccounts) {
    elements.title.textContent = '商家账号';
    void loadAccountQuota();
  } else if (isSettings) {
    elements.title.textContent = '监控设置';
    loadSettings();
  } else if (name === 'wallet') {
    elements.title.textContent = '钱包';
    void loadWalletData();
  } else if (name === 'team') {
    elements.title.textContent = '我的团队';
    void loadTeamData();
  } else if (name === 'payment') {
    elements.title.textContent = '支付订单';
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
  elements.accountsEmpty.hidden = state.accounts.length > 0;
  elements.accountsTable.hidden = state.accounts.length === 0;
  for (const account of state.accounts) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div class="account-cell"><span class="account-avatar"><i data-lucide="store"></i></span><div><div class="primary-text"></div><div class="secondary-text"></div></div></div></td>
      <td>${accountStatus(account)}</td>
      <td>${Number(account.productCount || 0)} 个</td>
      <td><span class="status ${Number(account.abnormalProductCount || 0) > 0 ? 'status-lost' : 'status-active'}">${Number(account.abnormalProductCount || 0)} 个</span></td>
      <td class="time">${formatDate(account.lastSyncAt)}</td>
      <td><div class="account-actions"><button class="icon-button account-action" type="button" data-account-action="view" aria-label="查看营销活动商品" title="查看营销活动商品"><i data-lucide="external-link"></i></button><button class="icon-button account-action" type="button" data-account-action="login" aria-label="${account.status === 'active' ? '重新登录' : '登录'}" title="${account.status === 'active' ? '重新登录' : '登录'}"><i data-lucide="log-in"></i></button><button class="icon-button account-action account-remove" type="button" data-account-action="remove" aria-label="移除账号" title="移除账号"><i data-lucide="trash-2"></i></button></div></td>`;
    row.querySelector('.primary-text').textContent = account.displayName || '未命名店铺';
    row.querySelector('.secondary-text').textContent = account.mallId ? `店铺 ID ${account.mallId}` : '店铺 ID 待接口识别';
    renderAccountAvatar(row.querySelector('.account-avatar'), account.avatarUrl);
    row.querySelector('[data-account-action="view"]').addEventListener('click', () => openAccount(account));
    row.querySelector('[data-account-action="login"]').addEventListener('click', () => openLoginModal(account));
    row.querySelector('[data-account-action="remove"]').addEventListener('click', () => void requestRemoveAccount(account));
    elements.accountsBody.append(row);
  }
  refreshIcons();
}

// 主题内的确认弹窗，替代系统原生 confirm；返回用户是否确认
function confirmAction({ title, description, confirmLabel, icon = 'triangle-alert' }) {
  return new Promise((resolve) => {
    state.pendingConfirm = resolve;
    elements.confirmTitle.textContent = title;
    elements.confirmDescription.textContent = description;
    elements.confirmSubmitLabel.textContent = confirmLabel;
    setIcon(elements.confirmIcon, icon);
    setIcon(elements.confirmSubmitIcon, icon);
    elements.modal.hidden = true;
    elements.confirmModal.hidden = false;
    elements.confirmSubmit.focus();
  });
}

function closeConfirmModal(confirmed = false) {
  const resolve = state.pendingConfirm;
  state.pendingConfirm = null;
  elements.confirmModal.hidden = true;
  if (resolve) resolve(confirmed);
}

async function requestRemoveAccount(account) {
  const name = account.displayName || '该账号';
  const ok = await confirmAction({
    title: '移除商家账号？',
    description: `移除「${name}」后，该账号的本地商品缓存和登录会话也会一并清除。此操作无法撤销。`,
    confirmLabel: '移除账号',
    icon: 'trash-2'
  });
  if (!ok) return;
  try {
    await window.pddMonitor.accounts.remove(account.id);
    await loadAccounts();
    showNotice('商家账号已移除');
  } catch (error) {
    showNotice(friendlyError(error), true);
  }
}

async function loadAccounts() {
  state.accounts = await window.pddMonitor.accounts.list();
  renderAccounts();
}

async function loadAccountQuota() {
  state.accountQuota = null;
  try {
    if (!isMartLinked()) await refreshMartState();
    if (!isMartLinked()) return applyAccountQuota();
    const team = await resolveCurrentTeam();
    if (!team) return applyAccountQuota();
    const membership = await window.pddMonitor.mart.membership(team.id);
    state.accountQuota = {
      teamId: team.id,
      max: Number(membership.quota?.max_shops ?? 0),
      active: Boolean(membership.subscription?.active)
    };
  } catch {
    state.accountQuota = null;
  }
  applyAccountQuota();
}

// 会员额度不足时不允许添加商家；额度未知（接口失败）时不拦截
function canAddAccount() {
  const quota = state.accountQuota;
  if (!quota) return true;
  if (!quota.active) return false;
  return state.accounts.length < quota.max;
}

function applyAccountQuota() {
  const quota = state.accountQuota;
  const unsubscribed = Boolean(quota && !quota.active);
  const allowed = canAddAccount();
  const reason = unsubscribed ? '当前团队未开通会员，开通后才能添加商家' : '商家数量已达到当前档位上限';
  elements.addAccount.disabled = !allowed;
  elements.addAccount.title = allowed ? '' : reason;
  elements.emptyAdd.disabled = !allowed;
  elements.emptyAdd.title = allowed ? '' : reason;
  elements.emptyTitle.textContent = unsubscribed ? '需要先开通会员' : '还没有商家账号';
  elements.emptyCopy.textContent = unsubscribed
    ? '当前团队未开通会员，开通后即可添加商家并读取营销活动商品。'
    : '添加账号并登录拼多多商家后台后，即可读取营销活动商品。';
  renderAccountFooter();
}

function renderAccountFooter() {
  const quota = state.accountQuota;
  elements.accountsFooter.replaceChildren();
  if (!quota || (state.accounts.length === 0 && quota.active)) {
    elements.accountsFooter.hidden = true;
    return;
  }
  const copy = document.createElement('p');
  copy.className = 'quota-copy';
  if (quota.active) {
    const used = document.createElement('strong');
    used.textContent = String(state.accounts.length);
    if (state.accounts.length >= quota.max) used.classList.add('is-full');
    const total = document.createElement('strong');
    total.textContent = String(quota.max);
    copy.append(
      document.createTextNode('已添加 '), used,
      document.createTextNode(' / '), total,
      document.createTextNode(' 家')
    );
  } else {
    const zero = document.createElement('strong');
    zero.className = 'is-full';
    zero.textContent = '0';
    copy.append(document.createTextNode('未开通会员，商家额度 '), zero, document.createTextNode(' 家'));
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'quota-link';
    link.textContent = '去开通会员';
    link.addEventListener('click', () => showView('team'));
    copy.append(link);
  }
  elements.accountsFooter.append(copy);
  elements.accountsFooter.hidden = false;
}

function renderProducts() {
  renderStatusOptions();
  const search = document.querySelector('#product-search').value.trim().toLowerCase();
  const status = document.querySelector('#product-status').value;
  const visible = state.products.filter((product) => {
    const matchesText = !search || String(product.name || '').toLowerCase().includes(search) || String(product.id || '').includes(search);
    return matchesText && (!status || getActivityStatus(product) === status);
  });
  renderPagination(visible.length);
  const pageStart = (state.productPage - 1) * PRODUCT_PAGE_SIZE;
  const pageProducts = visible.slice(pageStart, pageStart + PRODUCT_PAGE_SIZE);
  elements.productsBody.replaceChildren();
  elements.productsEmpty.hidden = visible.length > 0;
  elements.productsTable.hidden = visible.length === 0;
  for (const product of pageProducts) {
    const activityStatus = getActivityStatus(product);
    const [label, className] = STATUS_LABELS[activityStatus];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div class="activity-name"></div><div class="secondary-text activity-product"></div><div class="secondary-text activity-id"></div></td>
      <td><div class="product-cell"><span class="product-thumb"></span><div><div class="primary-text my-bid-product"></div><div class="secondary-text my-bid-id"></div></div></div></td>
      <td><span class="status ${className}">${label}</span></td>
      <td class="price"></td><td class="time enrolled-at"></td>`;
    row.querySelector('.activity-name').textContent = product.activityName || '百亿补贴';
    row.querySelector('.activity-product').textContent = product.activityProductName ? `活动商品：${product.activityProductName}` : '';
    row.querySelector('.activity-id').textContent = product.activityId ? `活动 ID ${product.activityId}` : '';
    row.querySelector('.my-bid-product').textContent = product.myBidProductName || product.name || '未命名商品';
    row.querySelector('.my-bid-id').textContent = product.myBidProductId ? `商品 ID ${product.myBidProductId}` : `商品 ID ${product.id || '-'}`;
    row.querySelector('.price').textContent = formatPrice(product.activityPrice);
    row.querySelector('.enrolled-at').textContent = formatDate(product.enrolledAt, '-');
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
  state.productPage = 1;
  state.products = await window.pddMonitor.products.list(account.id);
  document.querySelector('#detail-product-count').textContent = state.products.length;
  document.querySelector('#detail-error-count').textContent = state.products.filter((item) => getActivityStatus(item) !== 'all_sku_win_bid').length;
  renderProducts();
  updateSyncButton();
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
  const accountId = state.currentAccount.id;
  if (syncCooldownRemaining(accountId) > 0) {
    updateSyncButton();
    return;
  }
  state.syncInProgress = true;
  startSyncCooldown(accountId);
  updateSyncButton();
  try {
    const result = await window.pddMonitor.products.sync(accountId);
    state.products = result.products;
    state.productPage = 1;
    renderProducts();
    document.querySelector('#detail-product-count').textContent = state.products.length;
    document.querySelector('#detail-error-count').textContent = state.products.filter((item) => getActivityStatus(item) !== 'all_sku_win_bid').length;
    const message = result.message || `已同步 ${state.products.length} 个营销活动商品`;
    showNotice(result.notificationErrors?.length ? `${message}；部分提醒发送失败` : message, !result.ok || Boolean(result.notificationErrors?.length));
    await loadAccounts();
  } catch (error) {
    applySyncCooldownFromError(error, accountId);
    showNotice(friendlyError(error), true);
  } finally {
    state.syncInProgress = false;
    updateSyncButton();
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

async function submitLoginForm(event) {
  event.preventDefault();
  const fields = authFields('login');
  if (!validateAuthFields('login')) return;
  setServerError('login');
  fields.submit.disabled = true;
  try {
    state.platform.accountEmail = fields.email.value.trim();
    const result = await window.pddMonitor.platform.login({
      email: fields.email.value.trim(),
      password: fields.password.value
    });
    if (result.status === 'binding_required') {
      showEmailBinding(result.profile, 'account', result.security);
      return;
    }
    await finishPlatformSignIn(result.profile, result.security);
  } catch (error) {
    setServerError('login', friendlyError(error) || '登录失败，请稍后重试');
  } finally {
    fields.submit.disabled = false;
  }
}

async function submitRegistrationForm(event) {
  event.preventDefault();
  const mode = 'register';
  const fields = authFields(mode);
  if (!validateAuthFields(mode)) return;
  if (!state.platformAuthChallenges.register) {
    reportChallengeRequired(fields);
    return;
  }
  setServerError(mode);
  fields.submit.disabled = true;
  try {
    state.platform.accountEmail = fields.email.value.trim();
    const result = await window.pddMonitor.platform.completeRegistration({
      challengeId: state.platformAuthChallenges.register,
      code: fields.code.value.trim(),
      password: fields.password.value
    });
    await finishPlatformSignIn(result.profile, result.security);
  } catch (error) {
    setServerError(mode, friendlyError(error) || '注册失败，请稍后重试');
  } finally {
    fields.submit.disabled = false;
  }
}

async function submitResetForm(event) {
  event.preventDefault();
  const mode = state.platformAuthMode === 'email-binding' ? 'email-binding' : 'reset';
  const fields = authFields(mode);
  const challengeId = mode === 'email-binding'
    ? state.platformAuthChallengeId
    : state.platformAuthMode === 'password-change' ? state.platformAuthPasswordChallengeId : state.platformAuthChallenges.reset;
  if (!validateAuthFields(mode)) return;
  if (!challengeId) {
    reportChallengeRequired(fields);
    return;
  }
  setServerError(mode);
  fields.submit.disabled = true;
  try {
    if (mode === 'email-binding') {
      const result = state.platformAuthBindingKind === 'account'
        ? await window.pddMonitor.platform.accountEmailBindingComplete({
          challengeId,
          code: fields.code.value.trim()
        })
        : await window.pddMonitor.platform.emailBindingComplete({
          challengeId,
          code: fields.code.value.trim(),
          newPassword: fields.password.value || ''
        });
      await finishPlatformSignIn(result.profile, result.security);
      return;
    }
    if (state.platformAuthMode === 'password-change') {
      const security = await window.pddMonitor.platform.accountPasswordComplete({
        challengeId,
        code: fields.code.value.trim(),
        newPassword: fields.password.value
      });
      state.platform.security = security;
      state.platformAuthPasswordChallengeId = null;
      fields.password.value = '';
      fields.confirm.value = '';
      fields.code.value = '';
      elements.platformLoginModal.hidden = true;
      setPlatformAuthMode('login');
      setPlatformShell('signed_in');
      showNotice('密码已修改');
      return;
    }
    await window.pddMonitor.platform.resetPassword({
      challengeId,
      code: fields.code.value.trim(),
      newPassword: fields.password.value
    });
    state.platformAuthChallenges.reset = null;
    fields.password.value = '';
    fields.confirm.value = '';
    fields.code.value = '';
    setPlatformAuthMode('login');
    setServerError('login', '密码已重置，请使用新密码登录。');
  } catch (error) {
    setServerError(mode, friendlyError(error) || (mode === 'email-binding'
      ? '邮箱绑定失败，请稍后重试'
      : state.platformAuthMode === 'password-change' ? '修改密码失败，请稍后重试' : '重置密码失败，请稍后重试'));
  } finally {
    fields.submit.disabled = false;
  }
}

async function finishPlatformSignIn(profile, security = null) {
  clearWechatPollTimer();
  state.platformAuthBindingKind = null;
  state.platformAuthChallengeId = null;
  state.platform.status = 'signed_in';
  state.platform.profile = profile;
  state.platform.security = security || state.platform.security;
  elements.platformLoginModal.hidden = true;
  setPlatformShell('signed_in');
  await Promise.all([loadAccounts(), refreshMartState()]);
  showView('accounts');
}

async function beginWechatLogin() {
  elements.platformWechatStart.disabled = true;
  setServerError('login');
  try {
    const result = await window.pddMonitor.platform.wechatStart();
    state.wechatExpiresAt = result.expiresAt;
    setPlatformAuthMode('wechat');
    elements.platformWechatFrame.src = result.qrImageUrl;
    elements.platformWechatStatus.textContent = '请使用微信扫描二维码';
    startWechatCountdown();
    elements.platformLoginModal.hidden = false;
    void pollWechatLogin(result.pollIntervalSeconds);
  } catch (error) {
    setServerError('login', friendlyError(error) || '微信登录暂时无法开始');
  } finally {
    elements.platformWechatStart.disabled = false;
  }
}

function updateWechatCountdown() {
  const remaining = Date.parse(state.wechatExpiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    clearWechatPollTimer();
    elements.platformWechatCountdown.textContent = '二维码已过期';
    elements.platformWechatStatus.textContent = '二维码已过期，请刷新二维码';
    return false;
  }
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  elements.platformWechatCountdown.textContent = `二维码将在 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} 后过期`;
  return true;
}

function startWechatCountdown() {
  if (state.wechatCountdownTimer) window.clearInterval(state.wechatCountdownTimer);
  updateWechatCountdown();
  state.wechatCountdownTimer = window.setInterval(updateWechatCountdown, 1000);
}

async function refreshWechatLogin() {
  elements.platformWechatRefresh.disabled = true;
  clearWechatPollTimer();
  try {
    await window.pddMonitor.platform.wechatCancel();
    await beginWechatLogin();
  } finally {
    elements.platformWechatRefresh.disabled = false;
    refreshIcons();
  }
}

async function pollWechatLogin(retryAfterSeconds = 1) {
  if (state.platformAuthMode !== 'wechat') return;
  if (!updateWechatCountdown()) {
    clearWechatPollTimer();
    return;
  }
  try {
    const result = await window.pddMonitor.platform.wechatPoll();
    if (state.platformAuthMode !== 'wechat') return;
    if (result.state === 'signed_in') {
      await finishPlatformSignIn(result.profile, result.security);
      return;
    }
    if (result.state === 'binding_required') {
      clearWechatPollTimer();
      state.platformAuthBindingKind = result.bindingKind || 'device';
      setPlatformAuthMode('email-binding');
      authFields('email-binding').email.focus();
      return;
    }
    if (result.state === 'expired') {
      clearWechatPollTimer();
      elements.platformWechatCountdown.textContent = '二维码已过期';
      elements.platformWechatStatus.textContent = '二维码已过期，请刷新二维码';
      return;
    }
    if (result.state === 'scanned') {
      state.wechatScanned = true;
      elements.platformWechatStatus.textContent = '已扫描，请在微信中点击确认登录';
    } else if (!state.wechatScanned) {
      elements.platformWechatStatus.textContent = '请使用微信扫描二维码';
    }
    const next = Math.max(1, Number(result.retryAfterSeconds || retryAfterSeconds || 1));
    const remaining = Date.parse(state.wechatExpiresAt) - Date.now();
    state.wechatPollTimer = window.setTimeout(() => void pollWechatLogin(next), Math.min(next * 1000, Math.max(1, remaining)));
  } catch (error) {
    const retryable = Boolean(error?.retryable) || error?.status === 408 || error?.status === 429 || Number(error?.status) >= 500;
    if (retryable && updateWechatCountdown()) {
      elements.platformWechatStatus.textContent = '网络波动，正在重试微信登录…';
      const remaining = Date.parse(state.wechatExpiresAt) - Date.now();
      state.wechatPollTimer = window.setTimeout(() => void pollWechatLogin(retryAfterSeconds), Math.min(3000, Math.max(1, remaining)));
      return;
    }
    clearWechatPollTimer();
    elements.platformWechatStatus.textContent = friendlyError(error) || '微信登录暂时无法确认，请重试';
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  showView(button.dataset.view);
  if (button.closest('.platform-account-menu')) closePlatformAccountMenu();
}));
document.querySelectorAll('[data-platform-auth-mode]').forEach((button) => button.addEventListener('click', () => setPlatformAuthMode(button.dataset.platformAuthMode)));
document.querySelector('#platform-register-request-code').addEventListener('click', () => void requestPlatformCode('register'));
document.querySelector('#platform-reset-request-code').addEventListener('click', () => void requestPlatformCode(
  state.platformAuthMode === 'email-binding' ? 'email-binding' : state.platformAuthMode === 'password-change' ? 'password-change' : 'reset'
));
document.querySelectorAll('[data-action="add-account"]').forEach((button) => button.addEventListener('click', () => openLoginModal()));
elements.addAccount.addEventListener('click', () => openLoginModal());
elements.platformSignin.addEventListener('click', () => showPlatformLogin());
elements.platformAuthClose.addEventListener('click', closePlatformAuthModal);
elements.platformLoginModal.addEventListener('click', (event) => {
  if (event.target === elements.platformLoginModal) closePlatformAuthModal();
});
elements.platformAccount.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePlatformAccountMenu();
});
elements.platformAccountChangePassword.addEventListener('click', (event) => {
  event.stopPropagation();
  openPasswordChange();
});
elements.platformAccountLogout.addEventListener('click', async (event) => {
  event.stopPropagation();
  closePlatformAccountMenu();
  await logoutPlatform();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.platform-account-wrap')) closePlatformAccountMenu();
});
elements.platformLoginForm.addEventListener('submit', submitLoginForm);
document.querySelector('#platform-register-form').addEventListener('submit', submitRegistrationForm);
document.querySelector('#platform-reset-form').addEventListener('submit', submitResetForm);
elements.platformWechatStart.addEventListener('click', () => void beginWechatLogin());
elements.platformWechatRefresh.addEventListener('click', () => void refreshWechatLogin());
document.querySelectorAll('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => togglePasswordVisibility(button)));
elements.platformWechatBack.addEventListener('click', async () => {
  clearWechatPollTimer();
  await window.pddMonitor.platform.wechatCancel();
  setPlatformAuthMode('login');
});
elements.teamActionForm.addEventListener('submit', submitTeamAction);
elements.teamActionCancel.addEventListener('click', closeTeamAction);
elements.teamActionClose.addEventListener('click', closeTeamAction);
elements.teamActionModal.addEventListener('click', (event) => { if (event.target === elements.teamActionModal) closeTeamAction(); });
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => { elements.modal.hidden = true; }));
document.querySelectorAll('[data-close-confirm-modal]').forEach((button) => button.addEventListener('click', () => closeConfirmModal(false)));
elements.confirmModal.addEventListener('click', (event) => { if (event.target === elements.confirmModal) closeConfirmModal(false); });
elements.confirmSubmit.addEventListener('click', () => closeConfirmModal(true));
elements.startLogin.addEventListener('click', beginLogin);
elements.completeLogin.addEventListener('click', completeLogin);
elements.pageBack.addEventListener('click', () => { showView('accounts'); loadAccounts(); });
document.querySelector('#sync-products').addEventListener('click', syncProducts);
document.querySelector('#product-search').addEventListener('input', () => { state.productPage = 1; renderProducts(); });
document.querySelector('#product-status').addEventListener('change', () => { state.productPage = 1; renderProducts(); });
elements.productsPagePrev.addEventListener('click', () => { if (state.productPage > 1) { state.productPage -= 1; renderProducts(); } });
elements.productsPageNext.addEventListener('click', () => { state.productPage += 1; renderProducts(); });
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
document.querySelectorAll('[data-team-tab]').forEach((button) => button.addEventListener('click', () => setTeamTab(button.dataset.teamTab)));
document.querySelectorAll('[data-wallet-tab]').forEach((button) => button.addEventListener('click', () => setWalletTab(button.dataset.walletTab)));
elements.paymentRefreshOrder.addEventListener('click', () => void refreshPaymentOrder(true, { sync: true }));
elements.paymentSimulate.addEventListener('click', () => void simulatePayment());
elements.paymentCloseOrder.addEventListener('click', () => void closePurchaseOrder());

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!elements.confirmModal.hidden) closeConfirmModal(false);
  else if (!elements.platformLoginModal.hidden) closePlatformAuthModal();
});

window.pddMonitor.onAccountsChanged(() => loadAccounts());
window.pddMonitor.onPayWindowClosed(() => {
  if (state.purchase.order) void refreshPaymentOrder(false, { sync: true });
});
window.pddMonitor.onPlatformChanged((payload) => {
  if (payload?.status === 'signed_in') {
    state.platform.status = 'signed_in';
    state.platform.profile = payload.profile || state.platform.profile;
    state.platform.security = payload.security || state.platform.security;
    state.platform.accountEmail = payload.accountEmail || state.platform.accountEmail;
    setPlatformShell('signed_in');
    return;
  }
  if (payload?.status === 'signed_out') {
    state.platform = { status: 'signed_out', profile: null, security: null, accountEmail: null };
    state.mart = { linked: false, user: null, teams: [], team: null, teamId: null, membership: null, members: [], wallet: null, packages: [], transactions: [], transactionTotal: 0, preferencesLoaded: false };
    setPlatformShell('signed_out');
    showPlatformLogin();
  }
});
window.pddMonitor.onMartChanged((payload) => {
  state.mart.linked = Boolean(payload?.linked);
  state.mart.user = payload?.user || null;
  if (!state.mart.linked) return;
  if (!elements.teamSummary || elements.teamSummary.closest('.view')?.hidden === false) void loadTeamData();
});

refreshIcons();
setPlatformShell('loading');
loadPlatformState();
