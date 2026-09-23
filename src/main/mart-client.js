class MartApiError extends Error {
  constructor(message, { code = 0, status = 0 } = {}) {
    super(message);
    this.name = 'MartApiError';
    this.code = code;
    this.status = status;
  }
}

function joinUrl(base, pathname) {
  if (!String(pathname).startsWith('/v1/')) throw new Error('Mart 请求路径必须是 /v1/ 相对路径');
  return `${String(base).replace(/\/$/u, '')}${pathname}`;
}

function expiresAtFromSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return new Date(Date.now() + value * 1000).toISOString();
}

class MartClient {
  constructor({ apiBaseUrl, session, fetchImpl = globalThis.fetch, timeoutMs = 15_000 }) {
    if (!apiBaseUrl || !session) throw new Error('Mart client 配置不完整');
    this.apiBaseUrl = apiBaseUrl;
    this.session = session;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  // 会话过期时刷新一次并重放原请求；刷新令牌一次性使用，重放会直接失败
  async request(pathname, { method = 'GET', body, auth = true, retryAuth = true } = {}) {
    try {
      return await this._requestOnce(pathname, { method, body, auth });
    } catch (error) {
      if (!(error instanceof MartApiError) || error.status !== 401 || !auth || !retryAuth) throw error;
      await this.session.refresh((refreshToken) => this._refresh(refreshToken));
      return this._requestOnce(pathname, { method, body, auth });
    }
  }

  async _refresh(refreshToken) {
    const { data } = await this._requestOnce('/v1/auth/refresh', {
      method: 'POST',
      auth: false,
      body: { refresh_token: refreshToken }
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      ...(expiresAtFromSeconds(data.expires_in) ? { accessExpiresAt: expiresAtFromSeconds(data.expires_in) } : {})
    };
  }

  async _requestOnce(pathname, { method, body, auth }) {
    const url = joinUrl(this.apiBaseUrl, pathname);
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      const token = await this.session.accessToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
      if (!response.ok || payload?.err_code !== 0) {
        throw new MartApiError(payload?.err_msg || 'Mart 请求失败', {
          code: payload?.err_code ?? 0,
          status: response.status
        });
      }
      return { data: payload.data, status: response.status };
    } catch (error) {
      if (error instanceof MartApiError) throw error;
      if (error?.name === 'AbortError') throw new MartApiError('Mart 请求超时，请稍后重试', { code: 0, status: 0 });
      throw new MartApiError('无法连接 Mart 服务，请检查网络后重试', { code: 0, status: 0 });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { MartClient, MartApiError };
