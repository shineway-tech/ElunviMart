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
  constructor({ client, session, config }) {
    this.client = client;
    this.session = session;
    this.config = config;
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
    return response.data;
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
      authorizationUrl: device.wechat_start_uri ? `${this.config.apiBaseUrl}${device.wechat_start_uri}` : null,
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
    return {
      authorizationUrl: this.wechatFlow.authorizationUrl,
      expiresAt: this.wechatFlow.expiresAt,
      pollIntervalSeconds: this.wechatFlow.pollIntervalSeconds
    };
  }

  async completeWechatLogin() {
    if (!this.wechatFlow) throw new Error('微信登录已过期，请重新开始');
    const flow = this.wechatFlow;
    this.wechatFlow = null;
    await this.exchangeDeviceFlow(flow);
    return this.getProfile();
  }

  async logout() {
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

module.exports = {
  PlatformService,
  teamBillingHeader,
  toWallet,
  toCheckout,
  toAttempt,
  createPkce
};
