class PlatformApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 0, requestId = null, retryable = false, details = {} } = {}) {
    super(message);
    this.name = 'PlatformApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
    this.details = details;
  }
}

function joinUrl(base, pathname) {
  if (!String(pathname).startsWith('/v1/')) throw new Error('Platform 请求路径必须是 /v1/ 相对路径');
  return `${String(base).replace(/\/$/u, '')}${pathname}`;
}

class PlatformClient {
  constructor({ apiBaseUrl, clientId, session, fetchImpl = globalThis.fetch, timeoutMs = 15_000, refresh }) {
    if (!apiBaseUrl || !clientId || !session) throw new Error('Platform client 配置不完整');
    this.apiBaseUrl = apiBaseUrl;
    this.clientId = clientId;
    this.session = session;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.refreshFn = refresh || ((refreshToken) => this._refresh(refreshToken));
  }

  async _refresh(refreshToken) {
    try {
      const response = await this._requestOnce('/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
        auth: false
      });
      const data = response.data || {};
      // 平台返回 snake_case，会话层只认 camelCase：不映射就会继续用旧令牌，
      // 下次再拿旧 refresh token 去刷就是重放，平台会撤销整个会话族（用户被动登出）
      console.error('[platform] session refreshed');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        ...(data.access_expires_at ? { accessExpiresAt: data.access_expires_at } : {}),
        ...(data.refresh_expires_at ? { refreshExpiresAt: data.refresh_expires_at } : {})
      };
    } catch (error) {
      console.error(`[platform] refresh failed code=${error.code} status=${error.status} message=${error.message}`);
      throw error;
    }
  }

  async request(pathname, { method = 'GET', body, headers = {}, idempotencyKey, auth = true, retryAuth = true } = {}) {
    try {
      return await this._requestOnce(pathname, { method, body, headers, idempotencyKey, auth });
    } catch (error) {
      if (!(error instanceof PlatformApiError) || error.status !== 401 || !auth || !retryAuth) throw error;
      console.error(`[platform] ${pathname} got 401 (code=${error.code}), refreshing session`);
      await this.session.refresh(this.refreshFn);
      return this._requestOnce(pathname, { method, body, headers, idempotencyKey, auth });
    }
  }

  async _requestOnce(pathname, { method, body, headers = {}, idempotencyKey, auth }) {
    const requestHeaders = {
      accept: 'application/json',
      'x-elunvi-client-id': this.clientId,
      ...headers
    };
    if (body !== undefined) {
      requestHeaders['content-type'] = 'application/json';
    }
    if (idempotencyKey) requestHeaders['idempotency-key'] = idempotencyKey;
    if (auth) {
      const token = await this.session.accessToken();
      if (token) requestHeaders.authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(joinUrl(this.apiBaseUrl, pathname), {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const requestId = response.headers?.get?.('x-request-id') || null;
      const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
      if (!response.ok) {
        const error = payload?.error || {};
        throw new PlatformApiError(error.message || 'Platform 请求失败', {
          code: error.code || 'API_ERROR',
          status: response.status,
          requestId: error.request_id || requestId,
          retryable: Boolean(error.retryable),
          details: error.details || {}
        });
      }
      return { data: payload, requestId, status: response.status };
    } catch (error) {
      if (error instanceof PlatformApiError) throw error;
      if (error?.name === 'AbortError') throw new PlatformApiError('Platform 请求超时，请稍后重试', { code: 'PLATFORM_TIMEOUT', retryable: true });
      throw new PlatformApiError('无法连接 Platform，请检查网络后重试', { code: 'PLATFORM_UNAVAILABLE', retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { PlatformClient, PlatformApiError };
