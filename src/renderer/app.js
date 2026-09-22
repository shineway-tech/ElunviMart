const state = {
  platform: { status: 'loading', profile: null, team: null, billing: null },
  accounts: [],
  currentAccount: null,
  products: [],
  productPage: 1,
  syncCooldownUntilByAccount: new Map(),
  syncCooldownTimer: null,
  syncInProgress: false,
  loginAccountId: null,
  loginMode: 'create',
  pendingRemoval: null,
  paymentContext: null,
  paymentOrder: null,
  paymentAttempt: null,
  paymentTimer: null,
  teamHistoryKind: 'usage',
  teamActionMode: null,
  platformAuthMode: 'login',
  platformAuthChallengeId: null,
  wechatExpiresAt: null,
  wechatPollTimer: null
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
  productsPagination: document.querySelector('#products-pagination'),
  productsPaginationSummary: document.querySelector('#products-pagination-summary'),
  productsPageCurrent: document.querySelector('#products-page-current'),
  productsPagePrev: document.querySelector('#products-page-prev'),
  productsPageNext: document.querySelector('#products-page-next'),
  syncProducts: document.querySelector('#sync-products'),
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
  confirmRemoveAccount: document.querySelector('#confirm-remove-account'),
  platformSignin: document.querySelector('#platform-signin'),
  platformAccount: document.querySelector('#platform-account'),
  platformAccountName: document.querySelector('#platform-account-name'),
  platformAccountMeta: document.querySelector('#platform-account-meta'),
  platformLoginModal: document.querySelector('#platform-login-modal'),
  platformLoginForm: document.querySelector('#platform-login-form'),
  platformLoginClose: document.querySelector('#platform-login-close'),
  platformLoginSubmit: document.querySelector('#platform-login-submit'),
  platformLoginError: document.querySelector('#platform-login-error'),
  platformLoginErrorText: document.querySelector('#platform-login-error-text'),
  platformAuthCopy: document.querySelector('#platform-auth-copy'),
  platformAuthLinks: document.querySelector('#platform-auth-links'),
  platformAuthLinksCopy: document.querySelector('#platform-auth-links-copy'),
  platformAuthRegisterLink: document.querySelector('#platform-auth-register-link'),
  platformAuthResetLink: document.querySelector('#platform-auth-reset-link'),
  platformAuthLoginLink: document.querySelector('#platform-auth-login-link'),
  platformEmailField: document.querySelector('#platform-email-field'),
  platformCodeField: document.querySelector('#platform-code-field'),
  platformCode: document.querySelector('#platform-code'),
  platformRequestCode: document.querySelector('#platform-request-code'),
  platformPassword: document.querySelector('#platform-password'),
  platformPasswordField: document.querySelector('#platform-password-field'),
  platformConfirmPasswordField: document.querySelector('#platform-confirm-password-field'),
  platformConfirmPassword: document.querySelector('#platform-confirm-password'),
  platformLoginActions: document.querySelector('#platform-login-actions'),
  platformAuthDivider: document.querySelector('#platform-auth-divider'),
  platformWechatStart: document.querySelector('#platform-wechat-start'),
  platformWechatPanel: document.querySelector('#platform-wechat-panel'),
  platformWechatFrame: document.querySelector('#platform-wechat-frame'),
  platformWechatStatus: document.querySelector('#platform-wechat-status'),
  platformWechatCountdown: document.querySelector('#platform-wechat-countdown'),
  platformWechatBack: document.querySelector('#platform-wechat-back'),
  walletContexts: document.querySelector('#wallet-context-list'),
  walletTransactions: document.querySelector('#wallet-transactions-list'),
  teamSummary: document.querySelector('#team-summary-card'),
  teamMembers: document.querySelector('#team-members-list'),
  teamHistory: document.querySelector('#team-history-list'),
  paymentContexts: document.querySelector('#payment-context-options'),
  paymentPackages: document.querySelector('#payment-package-list'),
  paymentStatusCard: document.querySelector('#payment-status-card'),
  paymentStatusCopy: document.querySelector('#payment-status-copy'),
  paymentOrderDetail: document.querySelector('#payment-order-detail'),
  paymentCloseOrder: document.querySelector('#payment-close-order'),
  paymentRefreshOrder: document.querySelector('#payment-refresh-order'),
  teamActionModal: document.querySelector('#team-action-modal'),
  teamActionForm: document.querySelector('#team-action-form'),
  teamActionTitle: document.querySelector('#team-action-title'),
  teamActionDescription: document.querySelector('#team-action-description'),
  teamActionName: document.querySelector('#team-action-name'),
  teamActionEmail: document.querySelector('#team-action-email'),
  teamActionDisplay: document.querySelector('#team-action-display'),
  teamNameField: document.querySelector('#team-name-field'),
  teamEmailField: document.querySelector('#team-email-field'),
  teamDisplayField: document.querySelector('#team-display-field'),
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
  elements.notice.querySelector('span').textContent = message;
  elements.notice.classList.toggle('is-error', error);
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
}

function isPlatformSignedIn() {
  return state.platform.status === 'signed_in' && Boolean(state.platform.profile);
}

function formatMicroPoints(value) {
  try {
    const points = BigInt(String(value ?? '0'));
    const whole = points / 1000000n;
    const fraction = String(points % 1000000n).padStart(6, '0').replace(/0+$/u, '');
    return fraction ? `${whole}.${fraction}` : String(whole);
  } catch {
    return '—';
  }
}

function billingContextName(context, wallet) {
  return context?.kind === 'team' ? (wallet?.displayName || '团队钱包') : '个人钱包';
}

function setPlatformShell(status) {
  const signedIn = status === 'signed_in';
  state.platform.status = status;
  elements.platformSignin.hidden = signedIn;
  elements.platformAccount.hidden = !signedIn;
  document.querySelectorAll('.platform-nav').forEach((button) => { button.hidden = !signedIn; });
  elements.addAccount.disabled = !signedIn;
  if (signedIn) {
    const profile = state.platform.profile || {};
    elements.platformAccountName.textContent = profile.displayName || 'Elunvi 用户';
    elements.platformAccountMeta.textContent = profile.userId ? `用户 ID ${String(profile.userId).slice(0, 8)}` : '已登录';
  } else {
    elements.platformAccountName.textContent = '未登录';
    elements.platformAccountMeta.textContent = '登录后使用软件';
  }
}

function showPlatformLogin(message = '') {
  clearWechatPollTimer();
  setPlatformAuthMode('login');
  elements.platformLoginError.hidden = !message;
  elements.platformLoginErrorText.textContent = message;
  elements.platformLoginModal.hidden = false;
  document.querySelector('#platform-email').focus();
}

function clearWechatPollTimer() {
  if (state.wechatPollTimer) window.clearTimeout(state.wechatPollTimer);
  state.wechatPollTimer = null;
  state.wechatExpiresAt = null;
}

function setPlatformAuthMode(mode) {
  state.platformAuthMode = mode;
  state.platformAuthChallengeId = null;
  const isWechat = mode === 'wechat';
  const isBinding = mode === 'email-binding';
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  document.querySelector('#platform-login-title').textContent = isWechat ? '微信扫码登录' : isBinding ? '绑定邮箱' : isLogin ? '登录' : isRegister ? '注册' : '忘记密码';
  const login = mode === 'login';
  const register = isRegister;
  elements.platformAuthCopy.hidden = isWechat;
  elements.platformEmailField.hidden = isWechat;
  elements.platformCodeField.hidden = isLogin || isWechat;
  elements.platformPasswordField.hidden = isWechat;
  elements.platformConfirmPasswordField.hidden = login || isWechat || isBinding;
  elements.platformLoginActions.hidden = isWechat;
  elements.platformWechatStart.hidden = !isLogin;
  elements.platformAuthDivider.hidden = !isLogin;
  elements.platformWechatPanel.hidden = !isWechat;
  elements.platformAuthLinks.hidden = isWechat || isBinding;
  elements.platformAuthLinksCopy.textContent = isLogin ? '还没有 Elunvi 账号？' : '已有 Elunvi 账号？';
  elements.platformAuthRegisterLink.hidden = !isLogin;
  elements.platformAuthResetLink.hidden = !isLogin;
  elements.platformAuthLoginLink.hidden = isLogin;
  elements.platformLoginError.hidden = true;
  if (!isWechat) elements.platformWechatFrame.src = 'about:blank';
  document.querySelectorAll('[data-platform-auth-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.platformAuthMode === mode);
    button.setAttribute('aria-selected', button.dataset.platformAuthMode === mode ? 'true' : 'false');
  });
  elements.platformAuthCopy.textContent = isBinding ? '为微信账号绑定邮箱' : login ? '使用 Elunvi 账号继续' : register ? '创建账号后即可使用 Mart' : '输入验证码并设置新密码';
  elements.platformPasswordField.hidden = isWechat;
  elements.platformPassword.required = mode !== 'login' && !isBinding;
  elements.platformPassword.autocomplete = register || mode === 'reset' ? 'new-password' : 'current-password';
  elements.platformConfirmPasswordField.hidden = login || isWechat || isBinding;
  elements.platformConfirmPassword.required = !login && !isBinding;
  elements.platformLoginSubmit.querySelector('span').textContent = isBinding ? (state.platformAuthChallengeId ? '完成绑定' : '先获取验证码') : login ? '登录' : register ? (state.platformAuthChallengeId ? '完成注册' : '先获取验证码') : (state.platformAuthChallengeId ? '重置密码' : '先获取验证码');
  elements.platformRequestCode.textContent = state.platformAuthChallengeId ? '重新获取' : '获取验证码';
  elements.platformLoginError.hidden = true;
}

async function requestPlatformCode() {
  const email = document.querySelector('#platform-email').value.trim();
  if (!email) {
    elements.platformLoginErrorText.textContent = '请先输入邮箱';
    elements.platformLoginError.hidden = false;
    return;
  }
  elements.platformRequestCode.disabled = true;
  elements.platformLoginError.hidden = true;
  try {
    const result = state.platformAuthMode === 'register'
      ? await window.pddMonitor.platform.requestRegistrationCode(email)
      : state.platformAuthMode === 'email-binding'
        ? await window.pddMonitor.platform.emailBindingCode(email)
        : await window.pddMonitor.platform.requestPasswordResetCode(email);
    setPlatformAuthMode(state.platformAuthMode);
    state.platformAuthChallengeId = result.challengeId;
    elements.platformLoginSubmit.querySelector('span').textContent = state.platformAuthMode === 'register' ? '完成注册' : '重置密码';
    elements.platformRequestCode.textContent = '重新获取';
    elements.platformCode.focus();
    elements.platformLoginErrorText.textContent = '验证码已发送，请检查邮箱。';
    elements.platformLoginError.hidden = false;
  } catch (error) {
    elements.platformLoginErrorText.textContent = friendlyError(error) || '验证码发送失败，请稍后重试';
    elements.platformLoginError.hidden = false;
  } finally {
    elements.platformRequestCode.disabled = false;
  }
}

function closePlatformLogin() {
  if (state.platform.status !== 'signed_in') return;
  clearWechatPollTimer();
  if (state.platformAuthMode === 'wechat' || state.platformAuthMode === 'email-binding') void window.pddMonitor.platform.wechatCancel();
  elements.platformLoginModal.hidden = true;
}

function renderWalletContexts() {
  const contexts = state.platform.billing?.contexts || [];
  elements.walletContexts.replaceChildren();
  elements.paymentContexts.replaceChildren();
  for (const wallet of contexts) {
    const context = wallet.billingContext;
    const name = billingContextName(context, wallet);
    const card = document.createElement('article');
    card.className = `wallet-card${state.paymentContext && JSON.stringify(state.paymentContext) === JSON.stringify(context) ? ' is-selected' : ''}`;
    const title = document.createElement('div');
    title.className = 'wallet-card-title';
    title.append(createIcon(context?.kind === 'team' ? 'users' : 'user-round'));
    const titleText = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = name;
    const meta = document.createElement('small');
    meta.textContent = wallet.status === 'active' ? (wallet.role === 'owner' ? '负责人 · 可充值' : '可用支付身份') : '当前不可用';
    titleText.append(heading, meta);
    title.append(titleText);
    const balance = document.createElement('strong');
    balance.className = 'wallet-balance';
    balance.textContent = formatMicroPoints(wallet.availableMicroPoints);
    const unit = document.createElement('small');
    unit.textContent = '点可用余额';
    const actions = document.createElement('div');
    actions.className = 'wallet-card-actions';
    const choose = document.createElement('button');
    choose.className = 'button';
    choose.type = 'button';
    choose.textContent = state.paymentContext && JSON.stringify(state.paymentContext) === JSON.stringify(context) ? '当前付款身份' : '选择付款身份';
    choose.disabled = wallet.status !== 'active' || !wallet.canSpend;
    choose.addEventListener('click', () => {
      state.paymentContext = context;
      renderWalletContexts();
      showView('payment');
    });
    actions.append(choose);
    if (wallet.canRecharge && wallet.status === 'active') {
      const recharge = document.createElement('button');
      recharge.className = 'button button-primary';
      recharge.type = 'button';
      recharge.textContent = '充值';
      recharge.addEventListener('click', () => {
        state.paymentContext = context;
        renderWalletContexts();
        showView('payment');
      });
      actions.append(recharge);
    }
    card.append(title, balance, unit, actions);
    elements.walletContexts.append(card);

    const option = document.createElement('button');
    option.className = `payment-context-option${state.paymentContext && JSON.stringify(state.paymentContext) === JSON.stringify(context) ? ' is-selected' : ''}`;
    option.type = 'button';
    option.disabled = wallet.status !== 'active' || !wallet.canSpend;
    option.textContent = `${name} · ${formatMicroPoints(wallet.availableMicroPoints)} 点`;
    option.addEventListener('click', () => { state.paymentContext = context; renderWalletContexts(); });
    elements.paymentContexts.append(option);
  }
  if (!contexts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = '暂时没有可用的钱包信息，请刷新重试。';
    elements.walletContexts.append(empty);
    elements.paymentContexts.append(empty.cloneNode(true));
  }
  refreshIcons();
}

function renderTransactions(container, page, emptyText = '暂无流水') {
  container.replaceChildren();
  const rows = page?.items || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  for (const row of rows) {
    const item = document.createElement('article');
    item.className = 'finance-row';
    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = row.order_no || row.orderNo || row.event_type || row.business_type || '钱包流水';
    const meta = document.createElement('small');
    meta.textContent = row.created_at || row.createdAt || row.settled_at || '时间待同步';
    left.append(title, meta);
    const right = document.createElement('div');
    right.className = 'finance-row-value';
    const amount = row.amount_fen != null ? `¥${(Number(row.amount_fen) / 100).toFixed(2)}` : `${formatMicroPoints(row.charged_micro_points || row.amount_micro_points || row.available_delta_micro_points)} 点`;
    right.textContent = amount;
    item.append(left, right);
    container.append(item);
  }
}

async function loadWalletData() {
  try {
    state.platform.billing = await window.pddMonitor.platform.billingContexts();
    renderWalletContexts();
    const transactions = await window.pddMonitor.platform.walletTransactions();
    renderTransactions(elements.walletTransactions, transactions);
  } catch (error) {
    showNotice(error.message || '钱包信息暂时无法加载', true);
    renderWalletContexts();
    renderTransactions(elements.walletTransactions, null, '钱包流水暂时无法加载');
  }
}

function openTeamAction(mode) {
  state.teamActionMode = mode;
  elements.teamActionError.hidden = true;
  elements.teamActionForm.reset();
  const creating = mode === 'create';
  elements.teamActionTitle.textContent = creating ? '创建团队' : '添加团队成员';
  elements.teamActionDescription.textContent = creating ? '创建后你会成为团队负责人。店铺和监控数据仍然保存在各自电脑。' : '可以添加已有 Elunvi 用户，成员接受后才会加入团队。';
  elements.teamNameField.hidden = !creating;
  elements.teamEmailField.hidden = creating;
  elements.teamDisplayField.hidden = creating;
  elements.teamActionSubmit.textContent = creating ? '创建团队' : '发送邀请';
  elements.teamActionModal.hidden = false;
  (creating ? elements.teamActionName : elements.teamActionEmail).focus();
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
    if (mode === 'create') {
      await window.pddMonitor.platform.createTeam(elements.teamActionName.value.trim());
    } else {
      const teamId = state.platform.team?.teams?.team?.id;
      if (!teamId) throw new Error('当前没有可操作的团队');
      await window.pddMonitor.platform.addTeamMember({
        teamId,
        mode: 'existing',
        email: elements.teamActionEmail.value.trim()
      });
    }
    closeTeamAction();
    await loadTeamData();
    showNotice(mode === 'create' ? '团队已创建' : '成员邀请已发送');
  } catch (error) {
    elements.teamActionErrorText.textContent = error.message || '操作没有完成，请稍后重试';
    elements.teamActionError.hidden = false;
  } finally {
    elements.teamActionSubmit.disabled = false;
  }
}

function renderTeam(teamData) {
  state.platform.team = teamData;
  const snapshot = teamData?.teams || {};
  const team = snapshot.team || null;
  const topupTab = document.querySelector('[data-team-history="topup"]');
  if (topupTab) {
    topupTab.hidden = team?.role !== 'owner';
    if (team?.role !== 'owner' && state.teamHistoryKind === 'topup') state.teamHistoryKind = 'usage';
  }
  elements.teamSummary.replaceChildren();
  elements.teamMembers.replaceChildren();
  if (!team) {
    const copy = document.createElement('p');
    copy.className = 'empty-copy';
    copy.textContent = '当前账号还没有团队，可以继续以个人身份使用 Mart。';
    const action = document.createElement('button');
    action.className = 'button button-primary';
    action.type = 'button';
    action.textContent = '创建团队';
    action.addEventListener('click', () => openTeamAction('create'));
    elements.teamSummary.append(copy, action);
    elements.teamHistory.replaceChildren();
    return;
  }
  const heading = document.createElement('h3');
  heading.textContent = team.name || '我的团队';
  const meta = document.createElement('p');
  meta.textContent = `${team.role === 'owner' ? '负责人' : '成员'} · ${team.status === 'active' ? '正常' : '已暂停'}`;
  const action = document.createElement('button');
  action.className = 'button button-primary';
  action.type = 'button';
  action.textContent = team.role === 'owner' ? '添加成员' : '刷新成员';
  action.addEventListener('click', () => team.role === 'owner' ? openTeamAction('add') : void loadTeamData());
  elements.teamSummary.append(heading, meta, action);
  const pendingRequests = (snapshot.requests || []).filter((request) => request.status === 'pending');
  for (const request of pendingRequests) {
    const invite = document.createElement('div');
    invite.className = 'team-invite';
    const inviteCopy = document.createElement('span');
    inviteCopy.textContent = `收到来自 ${request.owner_display_name || request.owner_masked_email || '团队负责人'} 的「${request.team_name}」邀请`;
    const inviteActions = document.createElement('span');
    inviteActions.className = 'team-invite-actions';
    for (const decision of ['accept', 'reject']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = decision === 'accept' ? 'button button-primary' : 'button';
      button.textContent = decision === 'accept' ? '接受' : '拒绝';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.pddMonitor.platform.respondTeamRequest({ requestId: request.id, action: decision });
          await loadTeamData();
          showNotice(decision === 'accept' ? '已加入团队' : '已拒绝团队邀请');
        } catch (error) {
          showNotice(error.message || '团队邀请状态暂时无法更新', true);
          button.disabled = false;
        }
      });
      inviteActions.append(button);
    }
    invite.append(inviteCopy, inviteActions);
    elements.teamSummary.append(invite);
  }
  const members = teamData.members?.members || [];
  if (!members.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = '成员信息暂时无法加载。';
    elements.teamMembers.append(empty);
  } else {
    for (const member of members) {
      const row = document.createElement('div');
      row.className = 'team-member-row';
      const name = document.createElement('strong');
      name.textContent = member.display_name || member.masked_email || '未命名成员';
      const status = document.createElement('small');
      status.textContent = `${member.role === 'owner' ? '负责人' : '成员'} · ${member.status}`;
      row.append(name, status);
      elements.teamMembers.append(row);
    }
  }
  refreshIcons();
}

async function loadTeamData() {
  try {
    const teamData = await window.pddMonitor.platform.team();
    if (teamData?.teams?.team) {
      teamData.members = await window.pddMonitor.platform.teamMembers(teamData.teams.team.id);
    }
    renderTeam(teamData);
    const teamId = teamData?.teams?.team?.id;
    if (teamId) {
      const history = await window.pddMonitor.platform.teamHistory({ teamId, kind: state.teamHistoryKind });
      renderTransactions(elements.teamHistory, history, '暂无团队流水');
    }
  } catch (error) {
    showNotice(error.message || '团队信息暂时无法加载', true);
    renderTeam(null);
  }
}

async function loadPaymentPackages() {
  try {
    const packages = await window.pddMonitor.platform.packages();
    elements.paymentPackages.replaceChildren();
    for (const item of packages || []) {
      const card = document.createElement('article');
      card.className = 'payment-package';
      const title = document.createElement('strong');
      title.textContent = item.package_code || item.packageCode || '充值套餐';
      const points = document.createElement('span');
      points.textContent = `${formatMicroPoints(item.total_micro_points || item.totalMicroPoints || item.paid_micro_points || item.paidMicroPoints)} 点`;
      const price = document.createElement('small');
      price.textContent = `¥${(Number(item.amount_fen || item.amountFen || 0) / 100).toFixed(2)}`;
      const actions = document.createElement('div');
      for (const channel of ['wechat', 'alipay']) {
        const button = document.createElement('button');
        button.className = 'button button-primary';
        button.type = 'button';
        button.textContent = channel === 'wechat' ? '微信支付' : '支付宝';
        button.addEventListener('click', () => startPayment(item.package_code || item.packageCode, channel));
        actions.append(button);
      }
      card.append(title, points, price, actions);
      elements.paymentPackages.append(card);
    }
    if (!(packages || []).length) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = '暂无可购买套餐。';
      elements.paymentPackages.append(empty);
    }
  } catch (error) {
    elements.paymentPackages.textContent = error.message || '充值套餐暂时无法加载';
  }
}

async function startPayment(packageCode, channel) {
  if (!state.paymentContext) {
    showNotice('请先选择个人或团队付款身份', true);
    return;
  }
  try {
    const checkout = await window.pddMonitor.platform.createCheckout({
      packageCode,
      billingContext: state.paymentContext,
      idempotencyKey: crypto.randomUUID()
    });
    state.paymentOrder = checkout;
    state.paymentAttempt = await window.pddMonitor.platform.createPaymentAttempt({ checkoutId: checkout.checkoutId, channel });
    renderPaymentOrder();
    if (state.paymentTimer) window.clearInterval(state.paymentTimer);
    state.paymentTimer = window.setInterval(() => { void refreshPaymentOrder(false); }, 3000);
  } catch (error) {
    showNotice(error.message || '支付订单创建失败', true);
  }
}

function renderPaymentOrder() {
  const order = state.paymentOrder;
  const attempt = state.paymentAttempt;
  elements.paymentStatusCard.hidden = !order;
  if (!order) return;
  elements.paymentStatusCopy.textContent = `订单 ${order.orderNo || order.checkoutId} · ${order.status || 'pending'}`;
  elements.paymentOrderDetail.replaceChildren();
  const copy = document.createElement('p');
  copy.textContent = attempt?.qrPayload ? `请使用${attempt.channel === 'wechat' ? '微信' : '支付宝'}打开支付入口。` : '已创建支付订单，等待支付状态更新。';
  elements.paymentOrderDetail.append(copy);
  if (attempt?.qrPayload) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button button-primary';
    open.textContent = attempt.channel === 'wechat' ? '打开微信支付' : '打开支付宝';
    open.addEventListener('click', async () => {
      try { await window.pddMonitor.platform.openPayment(attempt.qrPayload); } catch (error) { showNotice(error.message, true); }
    });
    elements.paymentOrderDetail.append(open);
  }
}

async function refreshPaymentOrder(showFeedback = true) {
  if (!state.paymentOrder) return;
  try {
    state.paymentOrder = await window.pddMonitor.platform.getCheckout({ checkoutId: state.paymentOrder.checkoutId, paymentContext: state.paymentContext });
    renderPaymentOrder();
    if (state.paymentOrder.status === 'paid') {
      if (state.paymentTimer) window.clearInterval(state.paymentTimer);
      await loadWalletData();
      if (showFeedback) showNotice('支付成功，钱包余额已刷新');
    }
  } catch (error) {
    if (showFeedback) showNotice(error.message || '支付状态暂时无法确认', true);
  }
}

async function logoutPlatform() {
  if (!window.confirm('退出 Elunvi 账号后，监控任务会暂停。确定退出吗？')) return;
  await window.pddMonitor.platform.logout();
  state.accounts = [];
  state.platform = { status: 'signed_out', profile: null, team: null, billing: null };
  setPlatformShell('signed_out');
  document.querySelectorAll('.view').forEach((view) => { view.hidden = true; });
  showPlatformLogin();
}

async function loadPlatformState() {
  try {
    const result = await window.pddMonitor.platform.state();
    if (result.status === 'signed_in') {
      state.platform.status = 'signed_in';
      state.platform.profile = result.profile;
      setPlatformShell('signed_in');
      await loadAccounts();
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
  } else if (name === 'wallet') {
    elements.title.textContent = '钱包与支付';
    void loadWalletData();
  } else if (name === 'team') {
    elements.title.textContent = '我的团队';
    void loadTeamData();
  } else if (name === 'payment') {
    elements.title.textContent = '充值';
    void loadWalletData();
    void loadPaymentPackages();
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
      <td><span class="status ${Number(account.abnormalProductCount || 0) > 0 ? 'status-lost' : 'status-active'}">${Number(account.abnormalProductCount || 0)} 个</span></td>
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

async function submitPlatformLogin(event) {
  event.preventDefault();
  const submit = elements.platformLoginSubmit;
  const email = document.querySelector('#platform-email').value.trim();
  const password = document.querySelector('#platform-password').value;
  const code = elements.platformCode.value.trim();
  const confirmPassword = elements.platformConfirmPassword.value;
  if (!email || (state.platformAuthMode === 'login' && !password)) return;
  if (state.platformAuthMode !== 'login' && !state.platformAuthChallengeId) {
    await requestPlatformCode();
    return;
  }
  if (state.platformAuthMode === 'email-binding' && !code) {
    elements.platformLoginErrorText.textContent = '请输入邮箱验证码';
    elements.platformLoginError.hidden = false;
    return;
  }
  if (state.platformAuthMode !== 'login' && state.platformAuthMode !== 'email-binding' && (!code || !confirmPassword || password !== confirmPassword)) {
    elements.platformLoginErrorText.textContent = password !== confirmPassword ? '两次输入的密码不一致' : '请输入验证码和确认密码';
    elements.platformLoginError.hidden = false;
    return;
  }
  submit.disabled = true;
  elements.platformLoginError.hidden = true;
  try {
    let result;
    if (state.platformAuthMode === 'login') {
      result = await window.pddMonitor.platform.login({ email, password });
    } else if (state.platformAuthMode === 'register') {
      result = await window.pddMonitor.platform.completeRegistration({ challengeId: state.platformAuthChallengeId, code, password });
    } else if (state.platformAuthMode === 'email-binding') {
      result = await window.pddMonitor.platform.emailBindingComplete({ challengeId: state.platformAuthChallengeId, code, newPassword: password || '' });
    } else {
      await window.pddMonitor.platform.resetPassword({ challengeId: state.platformAuthChallengeId, code, newPassword: password });
      setPlatformAuthMode('login');
      elements.platformPassword.value = '';
      elements.platformConfirmPassword.value = '';
      elements.platformCode.value = '';
      elements.platformLoginErrorText.textContent = '密码已重置，请使用新密码登录。';
      elements.platformLoginError.hidden = false;
      return;
    }
    await finishPlatformSignIn(result.profile);
  } catch (error) {
    elements.platformLoginErrorText.textContent = friendlyError(error) || '登录失败，请稍后重试';
    elements.platformLoginError.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

async function finishPlatformSignIn(profile) {
  clearWechatPollTimer();
  state.platform.status = 'signed_in';
  state.platform.profile = profile;
  elements.platformLoginModal.hidden = true;
  setPlatformShell('signed_in');
  await loadAccounts();
  showView('accounts');
  showNotice('已登录 Elunvi，当前电脑上的店铺数据已准备就绪');
}

async function beginWechatLogin() {
  elements.platformWechatStart.disabled = true;
  elements.platformLoginError.hidden = true;
  try {
    const result = await window.pddMonitor.platform.wechatStart();
    state.wechatExpiresAt = result.expiresAt;
    setPlatformAuthMode('wechat');
    elements.platformWechatFrame.src = result.qrImageUrl;
    elements.platformWechatStatus.textContent = '请使用微信扫描二维码';
    elements.platformLoginModal.hidden = false;
    void pollWechatLogin(result.pollIntervalSeconds);
  } catch (error) {
    elements.platformLoginErrorText.textContent = friendlyError(error) || '微信登录暂时无法开始';
    elements.platformLoginError.hidden = false;
  } finally {
    elements.platformWechatStart.disabled = false;
  }
}

async function pollWechatLogin(retryAfterSeconds = 1) {
  if (state.platformAuthMode !== 'wechat') return;
  const remaining = Date.parse(state.wechatExpiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    clearWechatPollTimer();
    elements.platformWechatStatus.textContent = '二维码已过期，请返回后重新扫码';
    return;
  }
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  elements.platformWechatCountdown.textContent = `二维码将在 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} 后过期`;
  try {
    const result = await window.pddMonitor.platform.wechatPoll();
    if (state.platformAuthMode !== 'wechat') return;
    if (result.state === 'signed_in') {
      await finishPlatformSignIn(result.profile);
      return;
    }
    if (result.state === 'binding_required') {
      clearWechatPollTimer();
      setPlatformAuthMode('email-binding');
      elements.platformEmail.focus();
      return;
    }
    if (result.state === 'expired') {
      clearWechatPollTimer();
      elements.platformWechatStatus.textContent = '二维码已过期，请返回后重新扫码';
      return;
    }
    const next = Math.max(1, Number(result.retryAfterSeconds || retryAfterSeconds || 1));
    state.wechatPollTimer = window.setTimeout(() => void pollWechatLogin(next), Math.min(next * 1000, remaining));
  } catch (error) {
    clearWechatPollTimer();
    elements.platformWechatStatus.textContent = friendlyError(error) || '微信登录暂时无法确认，请重试';
  }
}

document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-platform-auth-mode]').forEach((button) => button.addEventListener('click', () => setPlatformAuthMode(button.dataset.platformAuthMode)));
elements.platformRequestCode.addEventListener('click', () => void requestPlatformCode());
document.querySelectorAll('[data-action="add-account"]').forEach((button) => button.addEventListener('click', () => openLoginModal()));
elements.addAccount.addEventListener('click', () => openLoginModal());
elements.platformSignin.addEventListener('click', () => showPlatformLogin());
elements.platformAccount.addEventListener('click', logoutPlatform);
elements.platformLoginForm.addEventListener('submit', submitPlatformLogin);
elements.platformWechatStart.addEventListener('click', () => void beginWechatLogin());
document.querySelectorAll('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => togglePasswordVisibility(button)));
elements.platformWechatBack.addEventListener('click', async () => {
  clearWechatPollTimer();
  await window.pddMonitor.platform.wechatCancel();
  setPlatformAuthMode('login');
});
elements.platformLoginClose.addEventListener('click', closePlatformLogin);
// The redesigned auth surface uses the close icon as its only dismiss action.
elements.platformLoginModal.addEventListener('click', (event) => { if (event.target === elements.platformLoginModal) closePlatformLogin(); });
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
document.querySelectorAll('[data-team-history]').forEach((button) => button.addEventListener('click', async () => {
  state.teamHistoryKind = button.dataset.teamHistory;
  document.querySelectorAll('[data-team-history]').forEach((item) => item.classList.toggle('is-active', item === button));
  const teamId = state.platform.team?.teams?.team?.id;
  if (!teamId) return;
  try {
    const page = await window.pddMonitor.platform.teamHistory({ teamId, kind: state.teamHistoryKind });
    renderTransactions(elements.teamHistory, page, '暂无团队流水');
  } catch (error) {
    showNotice(error.message || '团队流水暂时无法加载', true);
  }
}));
elements.paymentRefreshOrder.addEventListener('click', () => void refreshPaymentOrder(true));
elements.paymentCloseOrder.addEventListener('click', async () => {
  if (!state.paymentOrder) return;
  try {
    state.paymentOrder = await window.pddMonitor.platform.closeCheckout(state.paymentOrder.checkoutId);
    if (state.paymentTimer) window.clearInterval(state.paymentTimer);
    renderPaymentOrder();
    showNotice('支付订单已关闭');
  } catch (error) {
    showNotice(error.message || '订单暂时无法关闭', true);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.removeAccountModal.hidden) closeRemoveAccountModal();
});

window.pddMonitor.onAccountsChanged(() => loadAccounts());
window.pddMonitor.onPlatformChanged((payload) => {
  if (payload?.status === 'signed_out') {
    state.platform = { status: 'signed_out', profile: null, team: null, billing: null };
    setPlatformShell('signed_out');
    showPlatformLogin();
  }
});

refreshIcons();
setPlatformShell('loading');
loadPlatformState();
