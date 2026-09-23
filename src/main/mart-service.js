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
}

module.exports = { MartService };
