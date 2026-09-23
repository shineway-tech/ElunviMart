const state = {
  platform: { status: 'loading', profile: null, security: null, accountEmail: null },
  mart: {
    linked: false,
    user: null,
    teams: [],
    team: null,
    membership: null,
    members: [],
    wallet: null,
    packages: [],
    transactions: []
  },
  purchase: { kind: null, order: null, attempt: null },
  orderPollTimer: null,
  accounts: [],
  currentAccount: null,
  products: [],
  productPage: 1,
  syncCooldownUntilByAccount: new Map(),
  syncCooldownTimer: null,
  toastTimer: null,
  syncInProgress: false,
  loginAccountId: null,
  loginMode: 'create',
  pendingRemoval: null,
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
  removeAccountModal: document.querySelector('#remove-account-modal'),
  removeAccountDescription: document.querySelector('#remove-account-description'),
  confirmRemoveAccount: document.querySelector('#confirm-remove-account'),
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
  walletTransactions: document.querySelector('#wallet-transactions-list'),
  teamSummary: document.querySelector('#team-summary-card'),
  teamPlans: document.querySelector('#team-plan-list'),
  teamMembers: document.querySelector('#team-members-list'),
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

function renderPlatformAvatarInto(container, profile) {
  if (!container) return;
  container.replaceChildren();
  if (profile?.avatarUrl) {
    const image = document.createElement('img');
    image.src = profile.avatarUrl.replace(/^http:/, 'https:');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      container.replaceChildren(createIcon('user-round'));
      refreshIcons();
    }, { once: true });
    container.append(image);
  } else {
    container.append(createIcon('user-round'));
  }
  refreshIcons();
}

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, timeZone: LOCAL_TIME_ZONE
});

function formatDate(value, emptyLabel = '尚未同步') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return LOCAL_DATE_FORMATTER.format(date);
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

function renderPlatformAvatar(profile) {
  renderPlatformAvatarInto(elements.platformAccountAvatar, profile);
  renderPlatformAvatarInto(elements.platformAccountMenuAvatar, profile);
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
    const email = state.platform.security?.maskedEmail || state.platform.accountEmail || 'Elunvi 用户';
    const displayName = profile.displayName || email;
    renderPlatformAvatar(profile);
    elements.platformAccountMenuEmail.textContent = email;
    elements.platformAccountMenuName.textContent = displayName;
    elements.platformAccountName.textContent = profile.avatarUrl ? displayName : email;
    elements.platformAccountMeta.textContent = profile.avatarUrl ? email : (profile.displayName || 'Elunvi 用户');
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

async function loadWalletData() {
  elements.walletSummary.replaceChildren();
  elements.walletPackages.replaceChildren();
  elements.walletTransactions.replaceChildren();
  if (!isMartLinked()) {
    renderSignedOutState(elements.walletSummary);
    return;
  }
  if (!state.mart.team) await loadTeamData();
  const team = state.mart.team;
  if (!team) {
    renderEmptyState(elements.walletSummary, '当前账号还没有团队，暂时无法使用团队积分。');
    return;
  }
  try {
    const [wallet, packages, transactions] = await Promise.all([
      window.pddMonitor.mart.wallet(team.id),
      window.pddMonitor.mart.walletPackages(),
      window.pddMonitor.mart.walletTransactions({ teamId: team.id, limit: 20 })
    ]);
    state.mart.wallet = wallet.wallet;
    state.mart.packages = packages.packages || [];
    state.mart.transactions = transactions.transactions || [];
    renderWalletSummary(team);
    renderWalletPackages(team);
    renderWalletTransactions();
  } catch (error) {
    showNotice(error.message || '积分信息暂时无法加载', true);
    renderEmptyState(elements.walletSummary, '积分信息暂时无法加载，请稍后重试。', '重新加载', () => void loadWalletData());
  }
}

function renderWalletSummary(team) {
  elements.walletSummary.replaceChildren();
  const wallet = state.mart.wallet || { balance_points: 0 };
  const heading = document.createElement('h3');
  heading.textContent = team.name || '我的团队';
  const value = document.createElement('strong');
  value.className = 'wallet-balance-value';
  value.textContent = formatPoints(wallet.balance_points);
  const unit = document.createElement('span');
  unit.className = 'wallet-balance-unit';
  unit.textContent = '积分可用余额';
  const meta = document.createElement('p');
  meta.className = 'empty-copy';
  meta.textContent = team.role === MEMBER_ROLE_OWNER
    ? '负责人和成员共享该账户，充值 1 元到账 100 积分。'
    : '团队积分由负责人充值，成员可直接查看余额和流水。';
  elements.walletSummary.append(heading, value, unit, meta);
  refreshIcons();
}

function renderWalletPackages(team) {
  elements.walletPackages.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const packages = state.mart.packages || [];
  if (!packages.length) {
    renderEmptyState(elements.walletPackages, '暂无可购买的充值档位。');
    return;
  }
  for (const item of packages) {
    const card = document.createElement('article');
    card.className = 'payment-package';
    const title = document.createElement('strong');
    title.textContent = `${formatPoints(item.points)} 积分`;
    const price = document.createElement('span');
    price.className = 'payment-package-price';
    price.textContent = formatYuan(item.payable_fen);
    if (item.payable_fen < item.price_fen) {
      const original = document.createElement('small');
      original.className = 'payment-package-original';
      original.textContent = formatYuan(item.price_fen);
      price.append(' ', original);
    }
    const actions = document.createElement('div');
    const recharge = document.createElement('button');
    recharge.className = 'button button-primary';
    recharge.type = 'button';
    recharge.textContent = '充值';
    recharge.disabled = !isOwner;
    if (isOwner) recharge.addEventListener('click', () => void startRechargePurchase(item));
    actions.append(recharge);
    card.append(title, price, actions);
    elements.walletPackages.append(card);
  }
  if (!isOwner) {
    const hint = document.createElement('p');
    hint.className = 'empty-copy';
    hint.textContent = '只有团队负责人可以充值。';
    elements.walletPackages.append(hint);
  }
}

function renderWalletTransactions() {
  const container = elements.walletTransactions;
  container.replaceChildren();
  const rows = state.mart.transactions || [];
  if (!rows.length) {
    renderEmptyState(container, '暂无积分流水');
    return;
  }
  for (const row of rows) {
    const item = document.createElement('article');
    item.className = 'finance-row';
    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = row.memo || '积分变动';
    const meta = document.createElement('small');
    meta.textContent = formatDate(row.created_at, '时间待同步');
    left.append(title, meta);
    const right = document.createElement('div');
    right.className = 'finance-row-value';
    const delta = document.createElement('strong');
    delta.textContent = `${row.points > 0 ? '+' : ''}${formatPoints(row.points)}`;
    const after = document.createElement('small');
    after.textContent = `余额 ${formatPoints(row.balance_after)}`;
    right.append(delta, after);
    item.append(left, right);
    container.append(item);
  }
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
    const teams = await window.pddMonitor.mart.teams();
    state.mart.teams = teams.teams || [];
    state.mart.team = teams.default_team || state.mart.teams[0] || null;
    const team = state.mart.team;
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
  } catch (error) {
    showNotice(error.message || '团队信息暂时无法加载', true);
    renderEmptyState(elements.teamSummary, '团队信息暂时无法加载，请稍后重试。', '重新加载', () => void loadTeamData());
  }
}

function renderTeamSummary(team, membership) {
  elements.teamSummary.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const heading = document.createElement('h3');
  heading.textContent = team.name || '我的团队';
  const meta = document.createElement('p');
  meta.textContent = isOwner ? '你是该团队的负责人' : '你是该团队的成员';
  elements.teamSummary.append(heading, meta);

  const subscription = membership?.subscription || null;
  const quota = membership?.quota || {};
  const planLine = document.createElement('p');
  planLine.className = 'team-plan-line';
  planLine.textContent = subscription?.active
    ? `当前会员：${subscription.plan?.name || '已开通'} · 到期 ${formatDate(subscription.expires_at, '待确认')}`
    : '当前没有生效的会员，成员仅限负责人自己';
  const quotaLine = document.createElement('p');
  quotaLine.className = 'empty-copy';
  quotaLine.textContent = `成员 ${quota.used_members ?? 1}/${quota.max_members ?? 1} · 可管理店铺 ${quota.max_shops ?? 0} 家`;
  elements.teamSummary.append(planLine, quotaLine);

  const actions = document.createElement('div');
  actions.className = 'team-summary-actions';
  if (isOwner) {
    const invite = document.createElement('button');
    invite.className = 'button button-primary';
    invite.type = 'button';
    invite.textContent = '邀请成员';
    invite.addEventListener('click', () => openTeamAction('invite'));
    actions.append(invite);
  } else {
    const leave = document.createElement('button');
    leave.className = 'button';
    leave.type = 'button';
    leave.textContent = '退出团队';
    leave.addEventListener('click', () => void leaveCurrentTeam(team));
    actions.append(leave);
  }
  const join = document.createElement('button');
  join.className = 'button';
  join.type = 'button';
  join.textContent = '输入邀请码加入团队';
  join.addEventListener('click', () => openTeamAction('join'));
  actions.append(join);
  elements.teamSummary.append(actions);
  refreshIcons();
}

function renderTeamPlans(team, membership) {
  elements.teamPlans.replaceChildren();
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const current = membership?.subscription?.active ? membership.subscription.plan : null;
  if (!isOwner) {
    renderEmptyState(elements.teamPlans, '会员由团队负责人购买和管理。');
    return;
  }
  for (const plan of membership?.plans || []) {
    const card = document.createElement('article');
    card.className = 'payment-package';
    const title = document.createElement('strong');
    title.textContent = plan.name;
    const price = document.createElement('span');
    price.className = 'payment-package-price';
    price.textContent = `${formatYuan(plan.price_fen)}/月`;
    const limits = document.createElement('small');
    limits.textContent = `${plan.max_members} 个成员 · 每个成员可管理 ${plan.max_shops} 家店铺`;
    const actions = document.createElement('div');
    const button = document.createElement('button');
    button.className = 'button button-primary';
    button.type = 'button';
    let label = '购买';
    if (current) {
      if (plan.id === current.id) label = '续期一个月';
      else if (plan.sort_order > current.sort_order) label = '升级（补差价）';
      else {
        label = '到期后可购买';
        button.disabled = true;
      }
    }
    button.textContent = label;
    if (!button.disabled) button.addEventListener('click', () => void startMembershipPurchase(plan));
    actions.append(button);
    card.append(title, price, limits, actions);
    elements.teamPlans.append(card);
  }
}

function renderTeamMembers(team) {
  const isOwner = team.role === MEMBER_ROLE_OWNER;
  const members = state.mart.members || [];
  elements.teamMembers.replaceChildren();
  if (!members.length) {
    renderEmptyState(elements.teamMembers, '成员列表暂时无法加载。');
    return;
  }
  for (const member of members) {
    const row = document.createElement('div');
    row.className = 'team-member-row';
    const name = document.createElement('strong');
    name.textContent = member.display_name || '未命名成员';
    const meta = document.createElement('small');
    meta.textContent = `${member.role === MEMBER_ROLE_OWNER ? '负责人' : '成员'} · 加入于 ${formatDate(member.joined_at, '待确认')}`;
    row.append(name, meta);
    if (isOwner && member.role !== MEMBER_ROLE_OWNER) {
      const remove = document.createElement('button');
      remove.className = 'button';
      remove.type = 'button';
      remove.textContent = '移除';
      remove.addEventListener('click', () => void removeTeamMember(member));
      row.append(remove);
    }
    elements.teamMembers.append(row);
  }
}

async function removeTeamMember(member) {
  const team = state.mart.team;
  if (!team) return;
  if (!window.confirm(`移除「${member.display_name || '该成员'}」后，对方立即失去团队权限。确定移除吗？`)) return;
  try {
    await window.pddMonitor.mart.removeMember({ teamId: team.id, memberId: member.id });
    await loadTeamData();
    showNotice('成员已移除');
  } catch (error) {
    showNotice(error.message || '移除成员失败', true);
  }
}

async function leaveCurrentTeam(team) {
  if (!window.confirm(`退出「${team.name || '该团队'}」后将失去团队资源和会员权益。确定退出吗？`)) return;
  try {
    await window.pddMonitor.mart.leaveTeam(team.id);
    state.mart.team = null;
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
  if (kind === 'membership') return `${subject?.name || '会员'} · 一个月`;
  if (kind === 'recharge') return `${formatPoints(order?.quote_snapshot?.points || subject?.points || 0)} 积分`;
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
    if (fresh.status === 4) {
      stopOrderPolling();
      await Promise.all([loadTeamData(), loadWalletData()]);
      showNotice(state.purchase.kind === 'membership' ? '会员已生效' : '充值已到账');
    } else if (showFeedback) {
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
  if (!window.confirm('退出 Elunvi 账号后，监控任务会暂停。确定退出吗？')) return;
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
  showNotice('已登录 Elunvi，当前电脑上的店铺数据已准备就绪');
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
document.querySelectorAll('[data-close-remove-modal]').forEach((button) => button.addEventListener('click', closeRemoveAccountModal));
elements.removeAccountModal.addEventListener('click', (event) => { if (event.target === elements.removeAccountModal) closeRemoveAccountModal(); });
elements.confirmRemoveAccount.addEventListener('click', removeAccount);
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
document.querySelector('#wallet-refresh').addEventListener('click', () => void loadWalletData());
document.querySelector('#team-refresh').addEventListener('click', () => void loadTeamData());
elements.paymentRefreshOrder.addEventListener('click', () => void refreshPaymentOrder(true, { sync: true }));
elements.paymentSimulate.addEventListener('click', () => void simulatePayment());
elements.paymentCloseOrder.addEventListener('click', () => void closePurchaseOrder());

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!elements.removeAccountModal.hidden) closeRemoveAccountModal();
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
    state.mart = { linked: false, user: null, teams: [], team: null, membership: null, members: [], wallet: null, packages: [], transactions: [] };
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
