'use strict';

const crypto = require('node:crypto');

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

class PlatformClient {
  constructor({ config, fetchImpl = globalThis.fetch.bind(globalThis), tokenStore, timeoutMs = 15000 }) {
    if (!config || !config.apiBaseUrl || !config.clientId) throw new Error('平台配置不完整');
    const apiUrl = new URL(config.apiBaseUrl);
    if (apiUrl.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(apiUrl.hostname))) {
      throw new Error('平台 API 必须使用 HTTPS');
    }
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.tokenStore = tokenStore;
    this.timeoutMs = timeoutMs;
    this.accessToken = null;
    this.accessExpiresAt = null;
  }

  hasSession() {
    return Boolean(this.accessToken);
  }

  async startWechatLogin() {
    const pkce = createPkce();
    const response = await this.request('POST', '/v1/auth/device-sessions', {
      client_id: this.config.clientId,
      pkce_method: 'S256',
      pkce_challenge: pkce.challenge,
      scopes: [...this.config.scopes],
      redirect_uri: this.config.redirectUri
    });
    const value = record(response.data, 'device session');
    const flow = {
      deviceSessionId: text(value.device_session_id, 'device session'),
      deviceSecret: text(value.device_secret, 'device session'),
      verifier: pkce.verifier,
      userCode: text(value.user_code, 'device session'),
      expiresAt: timestamp(value.expires_at, 'device session'),
      pollIntervalSeconds: integer(value.poll_interval_seconds, 'device session'),
      authorizationUrl: new URL(relativePath(value.wechat_start_uri, 'device session'), this.config.apiBaseUrl).toString()
    };
    return flow;
  }

  async completeWechatLogin(flow) {
    if (!flow?.deviceSessionId || !flow?.deviceSecret || !flow?.verifier) throw new Error('微信登录事务无效');
    return this.exchangeDeviceSession(flow);
  }

  async loginWithPassword({ email, password }) {
    const flow = await this.startDeviceFlow();
    await this.request('POST', '/v1/auth/email/password-login', {
      device_session_id: flow.deviceSessionId,
      email: String(email || '').trim(),
      password: String(password || '')
    });
    return this.exchangeDeviceSession(flow);
  }

  async exchangeDeviceSession(flow) {
    const response = await this.request('POST', `/v1/auth/device-sessions/${encodeURIComponent(flow.deviceSessionId)}/token`, {
      device_secret: flow.deviceSecret,
      pkce_verifier: flow.verifier,
      response_mode: 'token'
    });
    return this.acceptTokens(response);
  }

  async refresh() {
    const stored = this.tokenStore?.load?.();
    if (!stored?.refreshToken) {
      this.clearMemory();
      throw new PlatformApiError('平台登录已失效，请重新登录', { code: 'AUTH_REQUIRED', status: 401 });
    }
    try {
      const response = await this.request('POST', '/v1/auth/refresh', { refresh_token: stored.refreshToken });
      return this.acceptTokens(response);
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  async logout() {
    try {
      if (this.accessToken) await this.request('POST', '/v1/auth/logout');
    } finally {
      this.clearSession();
    }
  }

  async getProfile() {
    const response = await this.request('GET', '/v1/me/profile');
    const value = exactRecord(response.data, ['user_id', 'display_name', 'avatar_url', 'profile_updated_at'], 'profile');
    return {
      userId: uuid(value.user_id, 'profile'),
      displayName: text(value.display_name, 'profile'),
      avatarUrl: nullableHttpsUrl(value.avatar_url, 'profile'),
      profileUpdatedAt: timestamp(value.profile_updated_at, 'profile'),
      requestId: response.requestId
    };
  }

  async getWallet() {
    const response = await this.request('GET', '/v1/me/wallet');
    const value = exactRecord(response.data, ['product_code', 'available_micro_points'], 'wallet');
    if (value.product_code !== this.config.productCode) throw invalid('钱包归属');
    return { productCode: this.config.productCode, availableMicroPoints: points(value.available_micro_points, 'wallet'), requestId: response.requestId };
  }

  async getPackages() {
    const response = await this.request('GET', '/v1/payments/packages');
    if (!Array.isArray(response.data)) throw invalid('点数套餐');
    return response.data.map((value) => {
      const item = exactRecord(value, ['package_code', 'amount_fen', 'currency', 'paid_micro_points', 'bonus_micro_points', 'total_micro_points'], '点数套餐');
      if (item.currency !== 'CNY') throw invalid('点数套餐');
      return { packageCode: text(item.package_code, '点数套餐'), amountFen: points(item.amount_fen, '点数套餐'), currency: 'CNY', paidMicroPoints: points(item.paid_micro_points, '点数套餐'), bonusMicroPoints: points(item.bonus_micro_points, '点数套餐'), totalMicroPoints: points(item.total_micro_points, '点数套餐') };
    });
  }

  async createCheckout(packageCode, idempotencyKey) {
    const response = await this.request('POST', '/v1/payments/checkouts', { package_code: text(packageCode, '套餐') }, idempotencyKey);
    return this.mapCheckout(response);
  }

  async createPaymentAttempt(checkoutId, channel) {
    if (!['wechat', 'alipay'].includes(channel)) throw new Error('不支持的支付渠道');
    const response = await this.request('POST', `/v1/payments/checkouts/${encodeURIComponent(checkoutId)}/attempts`, { channel });
    const value = exactRecord(response.data, ['attempt_id', 'checkout_id', 'channel', 'external_order_no', 'status', 'qr_payload', 'qr_expires_at'], '支付尝试');
    if (value.checkout_id !== checkoutId || value.channel !== channel) throw invalid('支付尝试归属');
    return { attemptId: text(value.attempt_id, '支付尝试'), checkoutId, channel, externalOrderNo: text(value.external_order_no, '支付尝试'), state: attemptState(value.status), qrPayload: nullableText(value.qr_payload, '支付尝试'), qrExpiresAt: nullableTimestamp(value.qr_expires_at, '支付尝试'), requestId: response.requestId };
  }

  async getCheckout(checkoutId) {
    const response = await this.request('GET', `/v1/payments/checkouts/${encodeURIComponent(checkoutId)}`);
    return this.mapCheckout(response, checkoutId);
  }

  async closeCheckout(checkoutId) {
    const response = await this.request('POST', `/v1/payments/checkouts/${encodeURIComponent(checkoutId)}/close`);
    return this.mapCheckout(response, checkoutId);
  }

  clearSession() {
    this.clearMemory();
    this.tokenStore?.clear?.();
  }

  clearMemory() {
    this.accessToken = null;
    this.accessExpiresAt = null;
  }

  async startDeviceFlow() {
    const flow = await this.startWechatLogin();
    return { deviceSessionId: flow.deviceSessionId, deviceSecret: flow.deviceSecret, verifier: flow.verifier };
  }

  async acceptTokens(response) {
    const value = exactRecord(response.data, ['access_token', 'refresh_token', 'access_expires_at', 'refresh_expires_at'], '平台会话');
    const metadata = { refreshToken: text(value.refresh_token, '平台会话'), accessExpiresAt: timestamp(value.access_expires_at, '平台会话'), refreshExpiresAt: timestamp(value.refresh_expires_at, '平台会话') };
    this.accessToken = text(value.access_token, '平台会话');
    this.accessExpiresAt = metadata.accessExpiresAt;
    this.tokenStore?.save?.(metadata);
    return { accessExpiresAt: metadata.accessExpiresAt, refreshExpiresAt: metadata.refreshExpiresAt, requestId: response.requestId };
  }

  mapCheckout(response, expectedId = null) {
    const value = exactRecord(response.data, ['checkout_id', 'order_no', 'product_code', 'client_id', 'package_code', 'amount_fen', 'currency', 'paid_micro_points', 'bonus_micro_points', 'status', 'expires_at'], '支付订单');
    if ((expectedId && value.checkout_id !== expectedId) || value.product_code !== this.config.productCode || value.client_id !== this.config.clientId) throw invalid('支付订单归属');
    if (!['pending', 'paid', 'closed', 'manual_review'].includes(value.status) || value.currency !== 'CNY') throw invalid('支付订单');
    return { checkoutId: text(value.checkout_id, '支付订单'), orderNo: text(value.order_no, '支付订单'), productCode: this.config.productCode, clientId: this.config.clientId, packageCode: text(value.package_code, '支付订单'), amountFen: points(value.amount_fen, '支付订单'), currency: 'CNY', paidMicroPoints: points(value.paid_micro_points, '支付订单'), bonusMicroPoints: points(value.bonus_micro_points, '支付订单'), state: value.status, expiresAt: timestamp(value.expires_at, '支付订单'), requestId: response.requestId };
  }

  async request(method, requestPath, body, idempotencyKey) {
    const headers = new Headers({ accept: 'application/json', 'x-elunvi-client-id': this.config.clientId });
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (idempotencyKey !== undefined) {
      if (!String(idempotencyKey).trim()) throw new Error('幂等键不能为空');
      headers.set('idempotency-key', String(idempotencyKey));
    }
    if (this.accessToken) headers.set('authorization', `Bearer ${this.accessToken}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl.replace(/\/$/u, '')}${requestPath}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const requestId = response.headers.get('x-request-id');
      const payload = await readResponse(response);
      if (!response.ok) throw apiError(response.status, requestId, payload);
      return { data: payload, requestId, status: response.status };
    } catch (error) {
      if (error?.name === 'AbortError') throw new PlatformApiError('平台请求超时，请稍后重试', { code: 'NETWORK_TIMEOUT', retryable: true });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
function apiError(status, requestId, payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.error : null;
  return new PlatformApiError(typeof body?.message === 'string' ? body.message : '平台请求失败', { code: typeof body?.code === 'string' ? body.code : 'API_ERROR', status, requestId: typeof body?.request_id === 'string' ? body.request_id : requestId, retryable: body?.retryable === true, details: body?.details && typeof body.details === 'object' ? body.details : {} });
}
async function readResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!/application\/json(?:\s*;|$)/iu.test(contentType)) throw new PlatformApiError('平台返回格式无效', { code: 'INVALID_RESPONSE' });
  try { return await response.json(); } catch { throw new PlatformApiError('平台返回格式无效', { code: 'INVALID_RESPONSE' }); }
}
function record(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(name); return value; }
function exactRecord(value, keys, name) { const result = record(value, name); if (Object.keys(result).length !== keys.length || keys.some((key) => !(key in result))) throw invalid(name); return result; }
function text(value, name) { if (typeof value !== 'string' || value.length === 0) throw invalid(name); return value; }
function nullableText(value, name) { if (value === null) return null; return text(value, name); }
function uuid(value, name) { const result = text(value, name); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) throw invalid(name); return result; }
function timestamp(value, name) { const result = text(value, name); if (Number.isNaN(Date.parse(result))) throw invalid(name); return result; }
function nullableTimestamp(value, name) { if (value === null) return null; return timestamp(value, name); }
function integer(value, name) { if (!Number.isInteger(value)) throw invalid(name); return value; }
function points(value, name) { const result = text(value, name); if (!/^(0|[1-9][0-9]*)$/u.test(result)) throw invalid(name); return result; }
function relativePath(value, name) { const result = text(value, name); if (!result.startsWith('/v1/') || result.startsWith('//')) throw invalid(name); return result; }
function nullableHttpsUrl(value, name) { if (value === null) return null; const result = text(value, name); try { if (new URL(result).protocol !== 'https:') throw new Error(); } catch { throw invalid(name); } return result; }
function invalid(name) { return new PlatformApiError(`${name}响应格式无效`, { code: 'INVALID_RESPONSE' }); }
function attemptState(status) { if (status === 'created' || status === 'awaiting_payment') return 'awaiting_payment'; if (status === 'succeeded') return 'confirming'; if (status === 'expired' || status === 'failed') return 'failed'; if (status === 'uncertain' || status === 'manual_review') return 'manual_review'; throw invalid('支付尝试状态'); }

module.exports = { PlatformClient, PlatformApiError, createPkce };
