const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformClient, PlatformApiError } = require('../src/main/platform-client');
const { PlatformSession, MemoryTokenStore } = require('../src/main/platform-session');

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    json: async () => body
  };
}

test('PlatformClient adds client and bearer headers and parses JSON', async () => {
  const calls = [];
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'access-1', refreshToken: 'refresh-1' }) });
  const client = new PlatformClient({
    apiBaseUrl: 'https://example.test',
    clientId: 'elunvi-mart-macos',
    session,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { ok: true }, { 'x-request-id': 'req-1' });
    }
  });

  const result = await client.request('/v1/me/profile');
  assert.deepEqual(result, { data: { ok: true }, requestId: 'req-1', status: 200 });
  assert.equal(calls[0].url, 'https://example.test/v1/me/profile');
  assert.equal(calls[0].init.headers.authorization, 'Bearer access-1');
  assert.equal(calls[0].init.headers['x-elunvi-client-id'], 'elunvi-mart-macos');
});

test('PlatformClient refreshes once after a 401 and retries the original request', async () => {
  const calls = [];
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'old', refreshToken: 'refresh' }) });
  let refreshCount = 0;
  const client = new PlatformClient({
    apiBaseUrl: 'https://example.test',
    clientId: 'elunvi-mart-macos',
    session,
    fetchImpl: async (_url, init) => {
      calls.push(init.headers.authorization);
      if (calls.length === 1) return response(401, { error: { code: 'AUTH_REQUIRED', message: 'expired' } });
      return response(200, { ok: true });
    },
    refresh: async (refreshToken) => {
      refreshCount += 1;
      assert.equal(refreshToken, 'refresh');
      return { accessToken: 'new', refreshToken: 'refresh-new' };
    }
  });

  const result = await client.request('/v1/me/profile');
  assert.deepEqual(result.data, { ok: true });
  assert.equal(refreshCount, 1);
  assert.deepEqual(calls, ['Bearer old', 'Bearer new']);
});

test('the built-in refresh adopts the snake_case token payload', async () => {
  const calls = [];
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'access-1', refreshToken: 'refresh-1' }) });
  const client = new PlatformClient({
    apiBaseUrl: 'https://example.test',
    clientId: 'elunvi-mart-macos',
    session,
    fetchImpl: async (url, init) => {
      calls.push({ url, auth: init.headers.authorization, body: init.body });
      if (url.endsWith('/v1/auth/refresh')) {
        return response(200, {
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          access_expires_at: '2026-09-27T09:15:00Z',
          refresh_expires_at: '2026-10-27T09:00:00Z'
        });
      }
      const profileCalls = calls.filter((call) => call.url.endsWith('/v1/me/profile'));
      if (profileCalls.length === 1) return response(401, { error: { code: 'AUTH_REQUIRED', message: 'expired' } });
      return response(200, { user_id: 'u1' });
    }
  });

  const result = await client.request('/v1/me/profile');
  assert.deepEqual(result.data, { user_id: 'u1' });

  const tokens = await session.tokens();
  assert.equal(tokens.accessToken, 'access-2', '会话必须换上新 access token');
  assert.equal(tokens.refreshToken, 'refresh-2', '会话必须换上新 refresh token，否则下次刷新就是重放，平台会撤销整个会话族');
  assert.equal(tokens.accessExpiresAt, '2026-09-27T09:15:00Z', '新到期时间要跟着存下来');
  assert.equal(tokens.refreshExpiresAt, '2026-10-27T09:00:00Z');

  const refreshCall = calls.find((call) => call.url.endsWith('/v1/auth/refresh'));
  assert.deepEqual(JSON.parse(refreshCall.body), { refresh_token: 'refresh-1' }, '刷新请求带的是会话里的 refresh token');
  assert.equal(calls[calls.length - 1].auth, 'Bearer access-2', '重放的原请求要用新令牌');
});

test('PlatformClient exposes structured API errors', async () => {
  const client = new PlatformClient({
    apiBaseUrl: 'https://example.test',
    clientId: 'elunvi-mart-macos',
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    fetchImpl: async () => response(403, { error: { code: 'TEAM_OWNER_REQUIRED', message: 'owner only', retryable: false } })
  });

  await assert.rejects(() => client.request('/v1/me/billing-contexts'), (error) => {
    assert.ok(error instanceof PlatformApiError);
    assert.equal(error.code, 'TEAM_OWNER_REQUIRED');
    assert.equal(error.status, 403);
    return true;
  });
});
