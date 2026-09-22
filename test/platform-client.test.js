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
