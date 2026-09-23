const test = require('node:test');
const assert = require('node:assert/strict');
const { MartClient, MartApiError } = require('../src/main/mart-client');
const { PlatformSession, MemoryTokenStore } = require('../src/main/platform-session');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body
  };
}

const envelope = (data) => ({ err_code: 0, err_msg: '', data });

test('MartClient sends the mart session token and unwraps the envelope', async () => {
  const calls = [];
  const session = new PlatformSession({
    tokenStore: new MemoryTokenStore({ accessToken: 'mart-access', refreshToken: 'mart-refresh' }),
    label: 'Mart'
  });
  const client = new MartClient({
    apiBaseUrl: 'https://mart.test/',
    session,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, envelope({ user: { id: 1 } }));
    }
  });

  const result = await client.request('/v1/me');
  assert.deepEqual(result.data, { user: { id: 1 } });
  assert.equal(calls[0].url, 'https://mart.test/v1/me');
  assert.equal(calls[0].init.headers.authorization, 'Bearer mart-access');
});

test('MartClient refreshes once after a 401 and retries the original request', async () => {
  const authorizations = [];
  const session = new PlatformSession({
    tokenStore: new MemoryTokenStore({ accessToken: 'old', refreshToken: 'mart-refresh' }),
    label: 'Mart'
  });
  const client = new MartClient({
    apiBaseUrl: 'https://mart.test',
    session,
    fetchImpl: async (url, init) => {
      if (url.endsWith('/v1/auth/refresh')) {
        assert.deepEqual(JSON.parse(init.body), { refresh_token: 'mart-refresh' });
        return response(200, envelope({ access_token: 'new', refresh_token: 'mart-refresh-2', expires_in: 900 }));
      }
      authorizations.push(init.headers.authorization);
      if (authorizations.length === 1) return response(401, { err_code: 14000, err_msg: '登录状态已失效，请重新登录' });
      return response(200, envelope({ user: { id: 1 } }));
    }
  });

  const result = await client.request('/v1/me');
  assert.equal(result.data.user.id, 1);
  assert.deepEqual(authorizations, ['Bearer old', 'Bearer new']);
  const persisted = await session.tokens();
  assert.equal(persisted.accessToken, 'new');
  assert.equal(persisted.refreshToken, 'mart-refresh-2');
  assert.ok(persisted.accessExpiresAt);
});

test('MartClient surfaces business error codes and rejects non /v1 paths', async () => {
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore(), label: 'Mart' });
  const client = new MartClient({
    apiBaseUrl: 'https://mart.test',
    session,
    fetchImpl: async () => response(400, { err_code: 11000, err_msg: '参数错误' })
  });

  await assert.rejects(() => client.request('/v1/teams'), (error) => {
    assert.ok(error instanceof MartApiError);
    assert.equal(error.code, 11000);
    assert.equal(error.status, 400);
    return true;
  });

  await assert.rejects(() => client.request('/health'), /必须是 \/v1\/ 相对路径/);
});

test('MartClient reports connection failures without a session', async () => {
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore(), label: 'Mart' });
  const client = new MartClient({
    apiBaseUrl: 'https://mart.test',
    session,
    fetchImpl: async () => { throw new Error('offline'); }
  });

  await assert.rejects(() => client.request('/v1/me'), (error) => {
    assert.equal(error.message, '无法连接 Mart 服务，请检查网络后重试');
    return true;
  });
});
