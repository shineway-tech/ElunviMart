const test = require('node:test');
const assert = require('node:assert/strict');
const { MartClient } = require('../src/main/mart-client');
const { MartService } = require('../src/main/mart-service');
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

function makeService({ platformTokens = { accessToken: 'platform-access', refreshToken: 'platform-refresh' }, fetchImpl }) {
  const platformSession = new PlatformSession({
    tokenStore: new MemoryTokenStore(platformTokens)
  });
  const session = new PlatformSession({ tokenStore: new MemoryTokenStore(), label: 'Mart' });
  const client = new MartClient({ apiBaseUrl: 'https://mart.test', session, fetchImpl });
  return { service: new MartService({ client, session, platformSession }), session };
}

test('linkFromPlatform exchanges the platform token and persists the mart session', async () => {
  const calls = [];
  const { service, session } = makeService({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, envelope({
        access_token: 'mart-access',
        refresh_token: 'mart-refresh',
        expires_in: 900,
        user: { id: 7, display_name: '张三', avatar_url: '' },
        default_team: { id: 3, name: '张三的团队', role: 1 }
      }));
    }
  });

  const summary = await service.linkFromPlatform();
  assert.equal(calls[0].url, 'https://mart.test/v1/auth/platform/exchange');
  assert.equal(calls[0].init.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), { access_token: 'platform-access' });
  assert.equal(summary.default_team.name, '张三的团队');

  const persisted = await session.tokens();
  assert.equal(persisted.accessToken, 'mart-access');
  assert.equal(persisted.refreshToken, 'mart-refresh');
  assert.ok(persisted.accessExpiresAt);
});

test('linkFromPlatform forwards the account email so Mart can name email-only users', async () => {
  const calls = [];
  const { service } = makeService({
    platformTokens: { accessToken: 'platform-access', refreshToken: 'platform-refresh', accountEmail: '350179435@qq.com' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, envelope({ access_token: 'a', refresh_token: 'b', user: {}, default_team: {} }));
    }
  });

  await service.linkFromPlatform();
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    access_token: 'platform-access',
    account_email: '350179435@qq.com'
  });
});

test('linkFromPlatform requires a platform session', async () => {
  const { service } = makeService({ platformTokens: null, fetchImpl: async () => response(200, envelope({})) });
  await assert.rejects(() => service.linkFromPlatform(), /请先登录 Elunvi 账号/);
});

test('status reports the link state and hydrates the summary from /v1/me', async () => {
  let meCalls = 0;
  const { service, session } = makeService({
    fetchImpl: async (url) => {
      if (url.endsWith('/v1/me')) {
        meCalls += 1;
        return response(200, envelope({
          user: { id: 7, display_name: '张三', avatar_url: '' },
          teams: [{ id: 3, name: '张三的团队', role: 1 }],
          default_team: { id: 3, name: '张三的团队', role: 1 }
        }));
      }
      return response(404, { err_code: 12000, err_msg: '资源不存在' });
    }
  });

  assert.deepEqual(await service.status(), { linked: false, user: null, default_team: null });

  await session.save({ accessToken: 'mart-access', refreshToken: 'mart-refresh' });
  const first = await service.status();
  assert.equal(first.linked, true);
  assert.equal(first.default_team.id, 3);
  assert.equal(meCalls, 1);

  await service.status();
  assert.equal(meCalls, 1, '缓存命中时不再请求 /v1/me');
  await service.status({ refresh: true });
  assert.equal(meCalls, 2);
});

test('status keeps the link state when the backend is unreachable', async () => {
  const { service, session } = makeService({
    fetchImpl: async () => { throw new Error('offline'); }
  });
  await session.save({ accessToken: 'mart-access', refreshToken: 'mart-refresh' });

  const status = await service.status();
  assert.equal(status.linked, true);
  assert.equal(status.user, null);
  assert.ok(status.error);
});

test('logout revokes the mart session and clears local credentials', async () => {
  const calls = [];
  const { service, session } = makeService({
    fetchImpl: async (url, init) => {
      calls.push({ url, body: init.body });
      return response(200, envelope({ ok: true }));
    }
  });
  await session.save({ accessToken: 'mart-access', refreshToken: 'mart-refresh' });

  await service.logout();
  assert.equal(calls[0].url, 'https://mart.test/v1/auth/logout');
  assert.deepEqual(JSON.parse(calls[0].body), { refresh_token: 'mart-refresh' });
  assert.equal(await session.tokens(), null);
  assert.deepEqual(await service.status(), { linked: false, user: null, default_team: null });
});
