const crypto = require('node:crypto');

const teamBillingHeader = 'wallet-v1';

function randomId() {
  return crypto.randomUUID();
}

function toPaymentContext(value) {
  if (!value) return null;
  return {
    walletOwnerId: value.wallet_owner_id || value.walletOwnerId,
    context: value.context
  };
}

function toSecurity(value) {
  const source = value || {};
  return {
    wechatBound: Boolean(source.wechat_bound ?? source.wechatBound),
    maskedEmail: source.masked_email ?? source.maskedEmail ?? null,
    passwordConfigured: Boolean(source.password_configured ?? source.passwordConfigured),
    availableActions: Array.isArray(source.available_actions)
      ? source.available_actions
      : Array.isArray(source.availableActions) ? source.availableActions : []
  };
}

function toWallet(value) {
  if (!value) return null;
  return {
    walletOwnerId: value.wallet_owner_id || value.walletOwnerId,
    billingContext: value.billing_context || value.billingContext,
    displayName: value.display_name ?? value.displayName ?? '',
    role: value.role,
    status: value.status,
    canSpend: Boolean(value.can_spend ?? value.canSpend),
    canRecharge: Boolean(value.can_recharge ?? value.canRecharge),
    availableMicroPoints: String(value.available_micro_points ?? value.availableMicroPoints ?? '0'),
    reservedMicroPoints: String(value.reserved_micro_points ?? value.reservedMicroPoints ?? '0'),
    memberMonthlyUsage: value.member_monthly_usage ?? value.memberMonthlyUsage ?? null
  };
}

function toCheckout(value) {
  if (!value) return null;
  return {
    checkoutId: value.checkout_id || value.checkoutId,
    orderNo: value.order_no || value.orderNo,
    productCode: value.product_code || value.productCode,
    clientId: value.client_id || value.clientId,
    packageCode: value.package_code || value.packageCode,
    currency: value.currency,
    amountFen: String(value.amount_fen ?? value.amountFen ?? '0'),
    paidMicroPoints: String(value.paid_micro_points ?? value.paidMicroPoints ?? '0'),
    bonusMicroPoints: String(value.bonus_micro_points ?? value.bonusMicroPoints ?? '0'),
    status: value.status || value.state,
    expiresAt: value.expires_at || value.expiresAt,
    paymentContext: toPaymentContext(value.payment_context || value.paymentContext)
  };
}

function toAttempt(value) {
  if (!value) return null;
  return {
    attemptId: value.attempt_id || value.attemptId,
    checkoutId: value.checkout_id || value.checkoutId,
    channel: value.channel,
    externalOrderNo: value.external_order_no || value.externalOrderNo,
    status: value.status || value.state,
    qrPayload: value.qr_payload ?? value.qrPayload ?? null,
    qrExpiresAt: value.qr_expires_at ?? value.qrExpiresAt ?? null
  };
}

class PlatformService {
  constructor({ client, session, config, fetchImpl = globalThis.fetch?.bind(globalThis) }) {
    this.client = client;
    this.session = session;
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.registrationFlows = new Map();
    this.wechatFlow = null;
  }

  async requireSignedIn() {
    if (!(await this.session.accessToken())) throw new Error('请先登录 Elunvi 账号');
  }

  async getProfile() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/profile');
    const value = response.data;
    return {
      userId: value.user_id || value.userId,
      displayName: value.display_name || value.displayName || '',
      avatarUrl: value.avatar_url ?? value.avatarUrl ?? null,
      requestId: response.requestId
    };
  }

  async getSecurity() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/security');
    return toSecurity(response.data);
  }

  async requestAuthenticatedEmailBindingCode(email) {
    await this.requireSignedIn();
    if (!String(email || '').trim()) throw new Error('请输入邮箱');
    const response = await this.client.request('/v1/me/email-binding-challenges', {
      method: 'POST',
      body: { email: String(email).trim() }
    });
    return { challengeId: response.data.challenge_id, expiresAt: response.data.expires_at };
  }

  async completeAuthenticatedEmailBinding({ challengeId, code }) {
    await this.requireSignedIn();
    if (!String(challengeId || '').trim() || !String(code || '').trim()) {
      throw new Error('验证码不能为空');
    }
    const response = await this.client.request('/v1/me/email-binding', {
      method: 'POST',
      body: { challenge_id: challengeId, code }
    });
    return toSecurity(response.data);
  }

  async getTeamAccountState() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/team-account-state');
    return response.data;
  }

  async getTeams() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/teams');
    return response.data;
  }

  async getTeamMembers(teamId) {
    await this.requireSignedIn();
    const response = await this.client.request(`/v1/teams/${encodeURIComponent(teamId)}/members`);
    return response.data;
  }

  async createTeam(name) {
    if (!String(name || '').trim()) throw new Error('请输入团队名称');
    return this.teamAction({ path: '/v1/teams', method: 'POST', body: { name: String(name).trim() } });
  }

  async addTeamMember({ teamId, mode = 'existing', email, displayName = '' }) {
    if (!teamId || !String(email || '').trim()) throw new Error('请输入成员邮箱');
    const body = { mode, email: String(email).trim() };
    if (mode === 'new') body.display_name = String(displayName || '').trim();
    return this.teamAction({
      path: `/v1/teams/${encodeURIComponent(teamId)}/members`,
      method: 'POST',
      body
    });
  }

  async respondToTeamRequest(requestId, action) {
    if (!['accept', 'reject'].includes(action)) throw new Error('团队邀请操作无效');
    return this.teamAction({
      path: `/v1/me/team-requests/${encodeURIComponent(requestId)}/${action}`,
      method: 'POST',
      body: {}
    });
  }

  async getBillingContexts() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/billing-contexts', {
      headers: { 'X-Elunvi-Billing-Contract': teamBillingHeader }
    });
    const data = response.data || {};
    return {
      teamBillingAvailable: Boolean(data.team_billing_available ?? data.teamBillingAvailable),
      contexts: (data.contexts || []).map(toWallet)
    };
  }

  async getWallet(walletOwnerId) {
    await this.requireSignedIn();
    const response = await this.client.request(`/v1/me/wallets/${encodeURIComponent(walletOwnerId)}`, {
      headers: { 'X-Elunvi-Billing-Contract': teamBillingHeader }
    });
    return toWallet({ ...response.data, wallet_owner_id: walletOwnerId });
  }

  async getPersonalWallet() {
    await this.requireSignedIn();
    const response = await this.client.request('/v1/me/wallet');
    return response.data;
  }

  async getWalletTransactions(cursor = null) {
    await this.requireSignedIn();
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await this.client.request(`/v1/me/wallet/transactions${query}`);
    return response.data;
  }

  async getTeamHistory(teamId, kind = 'usage', cursor = null) {
    await this.requireSignedIn();
    if (!['usage', 'topup'].includes(kind)) throw new Error('团队流水类型无效');
    const path = kind === 'usage' ? 'transactions' : 'recharges';
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    const response = await this.client.request(`/v1/teams/${encodeURIComponent(teamId)}/${path}?${query}`);
    return response.data;
  }

  async listPaymentPackages(amountFen = null) {
    await this.requireSignedIn();
    const query = amountFen ? `?amount_fen=${encodeURIComponent(amountFen)}` : '';
    const response = await this.client.request(`/v1/payments/packages${query}`);
    return response.data;
  }

  async createCheckout({ packageCode, billingContext = null, idempotencyKey = randomId(), recoverOriginal = false }) {
    await this.requireSignedIn();
    if (!packageCode) throw new Error('请选择充值套餐');
    if (billingContext?.kind === 'team' && !recoverOriginal) {
      const contexts = await this.getBillingContexts();
      const wallet = contexts.contexts.find((item) => item.billingContext?.kind === 'team' && item.billingContext.team_id === billingContext.team_id);
      if (!contexts.teamBillingAvailable || !wallet?.canSpend || !wallet?.canRecharge || wallet.role !== 'owner') {
        throw new Error('当前团队钱包不可充值');
      }
    }
    const body = { package_code: packageCode };
    if (billingContext) body.billing_context = billingContext;
    const response = await this.client.request('/v1/payments/checkouts', {
      method: 'POST',
      body,
      idempotencyKey,
      ...(billingContext ? { headers: { 'X-Elunvi-Billing-Contract': teamBillingHeader } } : {})
    });
    const checkout = toCheckout(response.data);
    if (billingContext && JSON.stringify(checkout.paymentContext?.context) !== JSON.stringify(billingContext)) {
      throw new Error('支付身份不一致，订单未被接受');
    }
    return checkout;
  }

  async createPaymentAttempt(checkoutId, channel) {
    await this.requireSignedIn();
    const response = await this.client.request(`/v1/payments/checkouts/${encodeURIComponent(checkoutId)}/attempts`, {
      method: 'POST',
      body: { channel }
    });
    return toAttempt(response.data);
  }

  async getCheckout(checkoutId, paymentContext = null) {
    await this.requireSignedIn();
    const response = await this.client.request(`/v1/payments/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: paymentContext ? { 'X-Elunvi-Billing-Contract': teamBillingHeader } : {}
    });
    const checkout = toCheckout(response.data);
    if (paymentContext && JSON.stringify(checkout.paymentContext?.context) !== JSON.stringify(paymentContext)) {
      throw new Error('支付身份已发生变化，已停止恢复订单');
    }
    return checkout;
  }

  async closeCheckout(checkoutId) {
    await this.requireSignedIn();
    const response = await this.client.request(`/v1/payments/checkouts/${encodeURIComponent(checkoutId)}/close`, { method: 'POST' });
    return toCheckout(response.data);
  }

  async requestPasswordResetCode(email) {
    if (!String(email || '').trim()) throw new Error('请输入邮箱');
    const response = await this.client.request('/v1/auth/email/password-reset-challenges', {
      method: 'POST', auth: false, body: { email: String(email).trim() }
    });
    return { challengeId: response.data.challenge_id, expiresAt: response.data.expires_at };
  }

  async resetPassword({ challengeId, code, newPassword }) {
    if (!String(challengeId || '').trim() || !String(code || '').trim() || !String(newPassword || '').trim()) {
      throw new Error('验证码和新密码不能为空');
    }
    await this.client.request('/v1/auth/email/password-resets', {
      method: 'POST', auth: false,
      body: { challenge_id: challengeId, code, password: newPassword }
    });
    return true;
  }

  async requestRegistrationCode(email) {
    if (!String(email || '').trim()) throw new Error('请输入邮箱');
    const flow = await this.createDeviceFlow();
    const challenge = await this.client.request('/v1/auth/email/registration-challenges', {
      method: 'POST', auth: false, body: { email: String(email || '').trim() }
    });
    const result = { challengeId: challenge.data.challenge_id, expiresAt: challenge.data.expires_at };
    this.registrationFlows.set(result.challengeId, { flow, email: String(email || '').trim() });
    return result;
  }

  async completeRegistration({ challengeId, code, password }) {
    const pending = this.registrationFlows.get(challengeId);
    if (!pending) throw new Error('注册验证码已过期，请重新获取');
    if (!String(code || '').trim() || !String(password || '').trim()) throw new Error('验证码和密码不能为空');
    this.registrationFlows.delete(challengeId);
    await this.client.request('/v1/auth/email/registrations', {
      method: 'POST', auth: false,
      body: {
        challenge_id: challengeId,
        code,
        device_session_id: pending.flow.deviceSessionId,
        password
      }
    });
    await this.exchangeDeviceFlow(pending.flow);
    return this.getProfile();
  }

  async loginWithPassword(email, password) {
    const flow = await this.createDeviceFlow();
    await this.client.request('/v1/auth/email/password-login', {
      method: 'POST',
      auth: false,
      body: { device_session_id: flow.deviceSessionId, email, password }
    });
    await this.exchangeDeviceFlow(flow);
    return this.getProfile();
  }

  async createDeviceFlow() {
    const pkce = createPkce();
    const response = await this.client.request('/v1/auth/device-sessions', {
      method: 'POST',
      auth: false,
      body: {
        client_id: this.config.clientId,
        pkce_method: 'S256',
        pkce_challenge: pkce.challenge,
        scopes: [...this.config.scopes],
        redirect_uri: this.config.redirectUri
      }
    });
    const device = response.data;
    return {
      deviceSessionId: device.device_session_id,
      deviceSecret: device.device_secret,
      verifier: pkce.verifier,
      authorizationUrl: device.wechat_start_uri ? new URL(device.wechat_start_uri, this.config.apiBaseUrl).toString() : null,
      expiresAt: device.expires_at,
      pollIntervalSeconds: device.poll_interval_seconds
    };
  }

  async exchangeDeviceFlow(flow) {
    const tokenResponse = await this.client.request(`/v1/auth/device-sessions/${encodeURIComponent(flow.deviceSessionId)}/token`, {
      method: 'POST',
      auth: false,
      body: { device_secret: flow.deviceSecret, pkce_verifier: flow.verifier, response_mode: 'token' }
    });
    await this.session.save({
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      accessExpiresAt: tokenResponse.data.access_expires_at,
      refreshExpiresAt: tokenResponse.data.refresh_expires_at
    });
    return tokenResponse.data;
  }

  async startWechatLogin() {
    this.wechatFlow = await this.createDeviceFlow();
    // Mart uses a one-second status check regardless of Platform's suggested interval.
    this.wechatFlow.pollIntervalSeconds = 1;
    const wechatStartUri = resolveWechatStartUri(this.wechatFlow.authorizationUrl, this.config, this.wechatFlow.deviceSessionId);
    const { imageUrl: qrImageUrl, pageUrl: authorizationUrl, qrUuid } = await fetchWechatQrPage(wechatStartUri, this.fetchImpl);
    this.wechatFlow.authorizationUrl = authorizationUrl;
    this.wechatFlow.qrUuid = qrUuid;
    this.wechatFlow.qrPollPromise = null;
    this.wechatFlow.qrAuthorized = false;
    this.wechatFlow.qrScanned = false;
    return {
      wechatStartUri,
      authorizationUrl,
      qrImageUrl,
      expiresAt: this.wechatFlow.expiresAt,
      pollIntervalSeconds: this.wechatFlow.pollIntervalSeconds
    };
  }

  async pollWechatLogin() {
    if (!this.wechatFlow) throw new Error('微信登录已过期，请重新开始');
    const flow = this.wechatFlow;
    if (flow.expiresAt && Date.now() >= Date.parse(flow.expiresAt)) {
      this.wechatFlow = null;
      return { state: 'expired' };
    }
    startWechatQrWatcher(this, flow);
    if (flow.qrScanned && !flow.qrAuthorized) {
      return { state: 'scanned', retryAfterSeconds: flow.pollIntervalSeconds };
    }
    try {
      const tokenResponse = await this.client.request(`/v1/auth/device-sessions/${encodeURIComponent(flow.deviceSessionId)}/token`, {
        method: 'POST',
      auth: false,
      retryAuth: false,
        body: { device_secret: flow.deviceSecret, pkce_verifier: flow.verifier, response_mode: 'token' }
      });
      await this.session.save({
        accessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
        accessExpiresAt: tokenResponse.data.access_expires_at,
        refreshExpiresAt: tokenResponse.data.refresh_expires_at
      });
      this.wechatFlow = null;
      return { state: 'signed_in', profile: await this.getProfile() };
    } catch (error) {
      if (error.status === 401 || (error.status === 429 && error.code === 'AUTH_REQUIRED')) {
        return { state: 'pending', retryAfterSeconds: flow.pollIntervalSeconds };
      }
      if (error.status === 409 && error.code === 'AUTH_EMAIL_BINDING_REQUIRED') {
        return { state: 'binding_required' };
      }
      throw error;
    }
  }

  async requestEmailBindingCode(email) {
    if (!this.wechatFlow) throw new Error('微信登录已过期，请重新开始');
    if (!String(email || '').trim()) throw new Error('请输入邮箱');
    const response = await this.client.request(`/v1/auth/device-sessions/${encodeURIComponent(this.wechatFlow.deviceSessionId)}/email-binding-challenges`, {
      method: 'POST',
      auth: false,
      body: { email: String(email).trim() }
    });
    this.wechatFlow.emailBindingChallengeId = response.data.challenge_id;
    return { challengeId: this.wechatFlow.emailBindingChallengeId, expiresAt: response.data.expires_at };
  }

  async completeEmailBinding({ challengeId, code, newPassword = '' }) {
    if (!this.wechatFlow || this.wechatFlow.emailBindingChallengeId !== challengeId) throw new Error('邮箱绑定验证码已过期，请重新获取');
    if (!String(code || '').trim()) throw new Error('请输入邮箱验证码');
    const body = { challenge_id: challengeId, code: String(code).trim() };
    if (String(newPassword || '').trim()) body.new_password = String(newPassword);
    await this.client.request(`/v1/auth/device-sessions/${encodeURIComponent(this.wechatFlow.deviceSessionId)}/email-binding`, {
      method: 'POST',
      auth: false,
      body
    });
    const flow = this.wechatFlow;
    this.wechatFlow = null;
    await this.exchangeDeviceFlow(flow);
    return this.getProfile();
  }

  cancelWechatLogin() {
    this.wechatFlow = null;
  }

  async logout() {
    this.wechatFlow = null;
    const token = await this.session.accessToken();
    if (token) {
      try { await this.client.request('/v1/auth/logout', { method: 'POST', retryAuth: false }); } catch {}
    }
    await this.session.clear();
  }

  async teamAction(action) {
    await this.requireSignedIn();
    const key = action.idempotencyKey || randomId();
    const common = { method: action.method || 'POST', idempotencyKey: key };
    return this.client.request(action.path, { ...common, body: action.body }).then((response) => response.data);
  }
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function resolveWechatStartUri(value, config, deviceSessionId) {
  if (!value) throw new Error('Platform 未返回微信登录地址');
  let parsed;
  let base;
  try {
    base = new URL(config.apiBaseUrl);
    parsed = new URL(value, base);
  } catch {
    throw new Error('微信登录地址无效');
  }
  if (parsed.origin !== base.origin || parsed.pathname !== '/v1/auth/wechat/start' || parsed.searchParams.get('device_session_id') !== deviceSessionId) {
    throw new Error('微信登录地址不受支持');
  }
  return parsed.toString();
}

async function fetchWechatQrPage(startUri, fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持微信二维码加载');
  let response;
  try {
    response = await fetchImpl(startUri, { redirect: 'follow' });
  } catch {
    throw new Error('微信二维码页面暂时无法加载，请检查网络后重试');
  }
  if (!response.ok) throw new Error('微信二维码页面暂时无法加载，请稍后重试');
  let pageUrl;
  try { pageUrl = new URL(response.url || startUri); } catch { throw new Error('微信二维码地址无效'); }
  if (pageUrl.origin !== 'https://open.weixin.qq.com' || pageUrl.pathname !== '/connect/qrconnect') {
    throw new Error('微信二维码地址不受支持');
  }
  const html = await response.text();
  const match = html.match(/<img\b[^>]*class=["'][^"']*js_qrcode_img[^"']*["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*js_qrcode_img[^"']*["']/i);
  if (!match) throw new Error('微信二维码暂时没有生成，请稍后重试');
  let imageUrl;
  try { imageUrl = new URL(match[1], pageUrl); } catch { throw new Error('微信二维码地址无效'); }
  if (imageUrl.origin !== pageUrl.origin || !imageUrl.pathname.startsWith('/connect/qrcode/')) {
    throw new Error('微信二维码地址不受支持');
  }
  return { imageUrl: imageUrl.toString(), pageUrl: pageUrl.toString(), qrUuid: imageUrl.pathname.split('/').pop() };
}

function startWechatQrWatcher(service, flow) {
  if (!flow.qrUuid || flow.qrPollPromise || flow.qrAuthorized || flow.qrCallbackStarted) return;
  flow.qrPollPromise = watchWechatQr(service, flow)
    .catch(() => {})
    .finally(() => { flow.qrPollPromise = null; });
}

async function watchWechatQr(service, flow) {
  let lastErrorCode = null;
  while (service.wechatFlow === flow && (!flow.expiresAt || Date.now() < Date.parse(flow.expiresAt))) {
    const result = await fetchWechatQrStatus(flow.qrUuid, service.fetchImpl, lastErrorCode);
    if (!result) return;
    lastErrorCode = result.errorCode;
    if (result.errorCode === 405 && result.code) {
      flow.qrCallbackStarted = true;
      await completeWechatQrCallback(flow, service.config, result.code, service.fetchImpl);
      if (service.wechatFlow === flow) flow.qrAuthorized = true;
      return;
    }
    if (result.errorCode === 404) {
      flow.qrScanned = true;
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    if (result.errorCode === 402) {
      flow.qrExpired = true;
      return;
    }
    if (result.errorCode === 403) {
      flow.qrCancelled = true;
      return;
    }
    if (result.errorCode === 666) return;
  }
}

async function fetchWechatQrStatus(qrUuid, fetchImpl, lastErrorCode = null) {
  if (typeof fetchImpl !== 'function') return null;
  const query = new URLSearchParams({ uuid: qrUuid });
  if (Number.isFinite(lastErrorCode)) query.set('last', String(lastErrorCode));
  const url = `https://long.open.weixin.qq.com/connect/l/qrconnect?${query.toString()}`;
  let response;
  try {
    response = await fetchImpl(url, { redirect: 'follow' });
  } catch {
    return null;
  }
  if (!response?.ok) return null;
  const body = await response.text();
  const errorCode = Number(body.match(/window\.wx_errcode\s*=\s*(-?\d+)/u)?.[1]);
  if (!Number.isFinite(errorCode)) return null;
  const code = body.match(/window\.wx_code\s*=\s*['"]([^'"]*)['"]/u)?.[1] || '';
  return { errorCode, code };
}

async function completeWechatQrCallback(flow, config, code, fetchImpl) {
  let pageUrl;
  try { pageUrl = new URL(flow.authorizationUrl); } catch { throw new Error('微信登录地址无效'); }
  const redirectValue = pageUrl.searchParams.get('redirect_uri');
  const state = pageUrl.searchParams.get('state');
  if (!redirectValue || !state) throw new Error('微信回调参数缺失');
  let callbackUrl;
  let apiBase;
  try {
    apiBase = new URL(config.apiBaseUrl);
    callbackUrl = new URL(redirectValue);
  } catch {
    throw new Error('微信回调地址无效');
  }
  if (callbackUrl.origin !== apiBase.origin || callbackUrl.pathname !== '/v1/auth/wechat/callback') {
    throw new Error('微信回调地址不受支持');
  }
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', state);
  const response = await fetchImpl(callbackUrl.toString(), { redirect: 'manual' });
  if (!response?.ok) throw new Error('Platform 未确认微信登录');
}

module.exports = {
  PlatformService,
  teamBillingHeader,
  toWallet,
  toCheckout,
  toAttempt,
  createPkce
};
