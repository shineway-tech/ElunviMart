const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformClient, PlatformApiError } = require('../src/main/platform-client');
const { ELUNVI_PLATFORM_CONFIG } = require('../src/main/platform-config');

const config = { ...ELUNVI_PLATFORM_CONFIG, clientId: ELUNVI_PLATFORM_CONFIG.clients.darwin };
const uuid = '01a0c4d1-5d74-7573-be4f-321e6719173d';
const userId = '01a0c4d1-5d74-7573-be4f-321e6719173e';

function response(body, status = 200, headers = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-test', ...headers }
  });
}
function queueFetch(items) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, headers: new Headers(init.headers) });
    const next = items.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return typeof next === 'function' ? next(url, init) : next;
  };
  fetch.calls = calls;
  return fetch;
}
function tokenStore(initial = null) {
  let value = initial;
  return { load: () => value, save: (next) => { value = next; }, clear: () => { value = null; } };
}
function client(fetch, store = tokenStore()) {
  return new PlatformClient({ config, fetchImpl: fetch, tokenStore: store });
}
function deviceSession() {
  return { device_session_id: uuid, device_secret: 'device-secret', user_code: 'ABCD-1234', expires_at: '2026-09-22T02:00:00Z', poll_interval_seconds: 2, wechat_start_uri: `/v1/auth/device-sessions/${uuid}/wechat` };
}
function token() {
  return { access_token: 'access-1', refresh_token: 'refresh-1', access_expires_at: '2026-09-22T01:00:00Z', refresh_expires_at: '2026-10-22T01:00:00Z' };
}
function profile() {
  return { user_id: userId, display_name: '测试用户', avatar_url: null, profile_updated_at: '2026-09-22T00:00:00Z' };
}
function wallet() { return { product_code: 'elunvi-mart', available_micro_points: '120000' }; }

test('startWechatLogin creates PKCE device flow and validates public authorization URL', async () => {
  const fetch = queueFetch([response(deviceSession())]);
  const flow = await client(fetch).startWechatLogin();
  assert.match(flow.authorizationUrl, /^https:\/\/elunvi-api\.honeykid\.cn\/v1\/auth\/device-sessions\//);
  assert.equal(flow.pollIntervalSeconds, 2);
  assert.equal(flow.deviceSessionId, uuid);
  assert.ok(flow.deviceSecret);
  assert.ok(flow.verifier);
  const body = JSON.parse(fetch.calls[0].init.body);
  assert.equal(body.client_id, config.clientId);
  assert.equal(body.redirect_uri, config.redirectUri);
  assert.equal(fetch.calls[0].headers.get('x-elunvi-client-id'), config.clientId);
});

test('password login exchanges tokens, stores refresh metadata, and sends no password after login', async () => {
  const fetch = queueFetch([response(deviceSession()), response({ ok: true }), response(token())]);
  const store = tokenStore();
  const result = await client(fetch, store).loginWithPassword({ email: 'person@example.com', password: 'secret-pass' });
  assert.equal(result.accessExpiresAt, token().access_expires_at);
  assert.deepEqual(store.load(), { refreshToken: 'refresh-1', accessExpiresAt: token().access_expires_at, refreshExpiresAt: token().refresh_expires_at });
  assert.equal(JSON.parse(fetch.calls[1].init.body).email, 'person@example.com');
  assert.equal(JSON.parse(fetch.calls[1].init.body).password, 'secret-pass');
  assert.equal(JSON.parse(fetch.calls[2].init.body).response_mode, 'token');
});

test('profile and wallet reject wrong product attribution', async () => {
  const fetch = queueFetch([response(profile()), response({ product_code: 'other', available_micro_points: '1' })]);
  const platform = client(fetch);
  platform.accessToken = 'access-1';
  assert.deepEqual(await platform.getProfile(), { userId, displayName: '测试用户', avatarUrl: null, profileUpdatedAt: '2026-09-22T00:00:00Z', requestId: 'req-test' });
  await assert.rejects(() => platform.getWallet(), /归属|attribution/);
});

test('checkout, payment attempt, and close carry headers and preserve manual review', async () => {
  const checkout = { checkout_id: uuid, order_no: 'ORDER-1', product_code: 'elunvi-mart', client_id: config.clientId, package_code: 'starter', amount_fen: '100', currency: 'CNY', paid_micro_points: '10000', bonus_micro_points: '0', status: 'pending', expires_at: '2026-09-22T01:00:00Z' };
  const attempt = { attempt_id: userId, checkout_id: uuid, channel: 'wechat', external_order_no: 'WX-1', status: 'uncertain', qr_payload: 'weixin://pay', qr_expires_at: '2026-09-22T01:00:00Z' };
  const fetch = queueFetch([response([ { package_code: 'starter', amount_fen: '100', currency: 'CNY', paid_micro_points: '10000', bonus_micro_points: '0', total_micro_points: '10000' } ]), response(checkout, 201), response(attempt, 201), response({ ...checkout, status: 'manual_review' }), response({ ...checkout, status: 'closed' })]);
  const platform = client(fetch);
  platform.accessToken = 'access-1';
  assert.equal((await platform.getPackages())[0].packageCode, 'starter');
  await platform.createCheckout('starter', 'idempotency-1');
  const payment = await platform.createPaymentAttempt(uuid, 'wechat');
  assert.equal(payment.state, 'manual_review');
  assert.equal((await platform.getCheckout(uuid)).state, 'manual_review');
  assert.equal((await platform.closeCheckout(uuid)).state, 'closed');
  assert.equal(fetch.calls[1].headers.get('idempotency-key'), 'idempotency-1');
  assert.equal(fetch.calls[2].headers.get('authorization'), 'Bearer access-1');
});

test('refresh rejection clears stored session and maps safe API error', async () => {
  const store = tokenStore({ refreshToken: 'refresh-1', accessExpiresAt: 'a', refreshExpiresAt: 'b' });
  const fetch = queueFetch([response({ error: { code: 'AUTH_REQUIRED', message: 'expired', retryable: false } }, 401)]);
  const platform = client(fetch, store);
  await assert.rejects(() => platform.refresh(), (error) => error instanceof PlatformApiError && error.code === 'AUTH_REQUIRED');
  assert.equal(store.load(), null);
  assert.equal(platform.accessToken, null);
});

test('unknown payment channel is rejected before network access', async () => {
  const fetch = queueFetch([]);
  const platform = client(fetch);
  await assert.rejects(() => platform.createPaymentAttempt(uuid, 'bank'), /支付渠道/);
  assert.equal(fetch.calls.length, 0);
});
