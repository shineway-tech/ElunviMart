function expiresAtFromSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return new Date(Date.now() + value * 1000).toISOString();
}

class MartService {
  constructor({ client, session, platformSession }) {
    if (!client || !session || !platformSession) throw new Error('Mart service 配置不完整');
    this.client = client;
    this.session = session;
    this.platformSession = platformSession;
    this.summary = null;
  }

  // 平台登录成功后调用：用平台 access token 换 Mart session，用户和默认团队由 Mart 侧沉淀
  async linkFromPlatform() {
    const platformToken = await this.platformSession.accessToken();
    if (!platformToken) throw new Error('请先登录 Elunvi 账号');
    const { data } = await this.client.request('/v1/auth/platform/exchange', {
      method: 'POST',
      auth: false,
      body: { access_token: platformToken }
    });
    await this.session.save({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      ...(expiresAtFromSeconds(data.expires_in) ? { accessExpiresAt: expiresAtFromSeconds(data.expires_in) } : {})
    });
    this.summary = { user: data.user, default_team: data.default_team };
    return this.summary;
  }

  async status({ refresh = false } = {}) {
    const tokens = await this.session.tokens();
    if (!tokens?.refreshToken) return { linked: false, user: null, default_team: null };
    if (this.summary && !refresh) return { linked: true, ...this.summary };
    try {
      const { data } = await this.client.request('/v1/me');
      this.summary = { user: data.user, default_team: data.default_team };
      return { linked: true, ...this.summary };
    } catch (error) {
      this.summary = null;
      return {
        linked: true,
        user: null,
        default_team: null,
        error: error.message || 'Mart 状态暂时不可用'
      };
    }
  }

  async logout() {
    const tokens = await this.session.tokens();
    this.summary = null;
    await this.session.clear();
    if (!tokens?.refreshToken) return { ok: true };
    try {
      await this.client.request('/v1/auth/logout', {
        method: 'POST',
        auth: false,
        body: { refresh_token: tokens.refreshToken }
      });
    } catch {
      // 本地会话已清除；远端撤销失败不阻断退出
    }
    return { ok: true };
  }

  async listTeams() {
    const { data } = await this.client.request('/v1/teams');
    return data;
  }

  async listMembers(teamId) {
    const { data } = await this.client.request(`/v1/teams/${encodeURIComponent(teamId)}/members`);
    return data;
  }

  async inviteMember({ teamId, email }) {
    const { data } = await this.client.request(`/v1/teams/${encodeURIComponent(teamId)}/invitations`, {
      method: 'POST',
      body: { email }
    });
    return data;
  }

  async removeMember({ teamId, memberId }) {
    const { data } = await this.client.request(
      `/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' }
    );
    return data;
  }

  async leaveTeam(teamId) {
    const { data } = await this.client.request(`/v1/teams/${encodeURIComponent(teamId)}/leave`, {
      method: 'POST'
    });
    return data;
  }

  async acceptInvitation(code) {
    const { data } = await this.client.request('/v1/invitations/accept', {
      method: 'POST',
      body: { code }
    });
    return data;
  }

  async membership(teamId) {
    const { data } = await this.client.request(`/v1/membership?team_id=${encodeURIComponent(teamId)}`);
    return data;
  }

  async quoteMembership({ teamId, planId }) {
    const { data } = await this.client.request('/v1/membership/quote', {
      method: 'POST',
      body: { team_id: teamId, plan_id: planId }
    });
    return data;
  }

  async createMembershipOrder({ teamId, quoteId, idempotencyKey = '' }) {
    const { data } = await this.client.request('/v1/membership/orders', {
      method: 'POST',
      body: { team_id: teamId, quote_id: quoteId, idempotency_key: idempotencyKey }
    });
    return data.order;
  }

  async wallet(teamId) {
    const { data } = await this.client.request(`/v1/wallet?team_id=${encodeURIComponent(teamId)}`);
    return data;
  }

  async walletPackages() {
    const { data } = await this.client.request('/v1/wallet/packages');
    return data;
  }

  async walletTransactions({ teamId, limit = 20, offset = 0 }) {
    const { data } = await this.client.request(
      `/v1/wallet/transactions?team_id=${encodeURIComponent(teamId)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
    );
    return data;
  }

  async createRechargeOrder({ teamId, packageId, idempotencyKey = '' }) {
    const { data } = await this.client.request('/v1/wallet/recharge-orders', {
      method: 'POST',
      body: { team_id: teamId, package_id: packageId, idempotency_key: idempotencyKey }
    });
    return data.order;
  }

  async order(orderId) {
    const { data } = await this.client.request(`/v1/orders/${encodeURIComponent(orderId)}`);
    return data.order;
  }

  // 购买记录：bizType 1 = 会员，2 = 积分充值，不传则全部
  async listOrders({
    teamId, bizType = null, limit = 20, offset = 0,
  }) {
    const query = new URLSearchParams({ team_id: String(teamId), limit: String(limit), offset: String(offset) });
    if (bizType) query.set('biz_type', String(bizType));
    const { data } = await this.client.request(`/v1/orders?${query.toString()}`);
    return data;
  }

  async createPaymentAttempt({ orderId, channel = 'mock' }) {
    const { data } = await this.client.request(
      `/v1/orders/${encodeURIComponent(orderId)}/payment-attempts`,
      { method: 'POST', body: { channel } }
    );
    return data;
  }

  async closeOrder(orderId) {
    const { data } = await this.client.request(
      `/v1/orders/${encodeURIComponent(orderId)}/close`,
      { method: 'POST' }
    );
    return data.order;
  }

  // 主动查单：本地没有公网回调地址时用渠道结果结单
  async syncOrder(orderId) {
    const { data } = await this.client.request(
      `/v1/orders/${encodeURIComponent(orderId)}/payment-sync`,
      { method: 'POST' }
    );
    return data.order;
  }

  // 本地调试用：以模拟渠道身份回调，替代真实渠道的服务端通知
  async simulatePayment(orderId) {
    const order = await this.order(orderId);
    if (!order?.channel_order_no) throw new Error('订单还没有支付参数，请先发起支付');
    const { data } = await this.client.request('/v1/payment-callbacks/mock', {
      method: 'POST',
      auth: false,
      body: { channel_order_no: order.channel_order_no, paid: true }
    });
    return data;
  }
}

module.exports = { MartService };
