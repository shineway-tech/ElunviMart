const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { registerPlatformIpc } = require('../src/main/platform-ipc');

function setup(client) {
  const handlers = new Map();
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) };
  const opened = [];
  registerPlatformIpc(ipcMain, { client, shell: { openExternal: async (url) => opened.push(url) } });
  return { handlers, opened };
}
function snapshot() { return { profile: { userId: 'u', displayName: 'User' }, wallet: { productCode: 'elunvi-mart', availableMicroPoints: '10' } }; }

test('platform IPC exposes status, login, logout, checkout and payment handlers without secrets', async () => {
  const calls = [];
  const client = {
    hasSession: () => true,
    getProfile: async () => snapshot().profile,
    getWallet: async () => snapshot().wallet,
    loginWithPassword: async (input) => { calls.push(['login', input]); return { accessExpiresAt: 'a', refreshExpiresAt: 'b' }; },
    startWechatLogin: async () => ({ authorizationUrl: 'https://elunvi-api.honeykid.cn/v1/auth/device-sessions/x/wechat', userCode: 'ABCD', expiresAt: 'e', pollIntervalSeconds: 1, deviceSessionId: 'x', deviceSecret: 'secret', verifier: 'verifier' }),
    completeWechatLogin: async () => ({ accessExpiresAt: 'a', refreshExpiresAt: 'b' }),
    refresh: async () => ({ accessExpiresAt: 'a', refreshExpiresAt: 'b' }),
    logout: async () => calls.push(['logout']),
    getPackages: async () => [{ packageCode: 'starter' }],
    createCheckout: async (...args) => { calls.push(['checkout', ...args]); return { checkoutId: 'c', state: 'pending' }; },
    createPaymentAttempt: async (...args) => { calls.push(['payment', ...args]); return { checkoutId: 'c', state: 'manual_review' }; },
    getCheckout: async (id) => ({ checkoutId: id, state: 'paid' }),
    closeCheckout: async (id) => ({ checkoutId: id, state: 'closed' })
  };
  const { handlers, opened } = setup(client);
  const status = await handlers.get('platform:status')();
  assert.equal(status.authenticated, true);
  assert.equal(status.wallet.availableMicroPoints, '10');
  const login = await handlers.get('platform:login:password')(null, { email: 'a@example.com', password: 'pw' });
  assert.equal(login.authenticated, true);
  assert.deepEqual(calls[0], ['login', { email: 'a@example.com', password: 'pw' }]);
  const start = await handlers.get('platform:login:startWechat')();
  assert.deepEqual(start, { authorizationUrl: 'https://elunvi-api.honeykid.cn/v1/auth/device-sessions/x/wechat', userCode: 'ABCD', expiresAt: 'e', pollIntervalSeconds: 1 });
  assert.deepEqual(opened, [start.authorizationUrl]);
  const completed = await handlers.get('platform:login:completeWechat')();
  assert.equal(completed.authenticated, true);
  assert.deepEqual(await handlers.get('platform:packages')(), [{ packageCode: 'starter' }]);
  await handlers.get('platform:checkout')(null, { packageCode: 'starter', idempotencyKey: 'key' });
  await handlers.get('platform:payment')(null, { checkoutId: 'c', channel: 'wechat' });
  assert.equal((await handlers.get('platform:getCheckout')(null, 'c')).state, 'paid');
  assert.equal((await handlers.get('platform:checkout:close')(null, 'c')).state, 'closed');
  const result = await handlers.get('platform:logout')();
  assert.equal(result, true);
  assert.equal(calls.some(([name]) => name === 'logout'), true);
  const serialized = JSON.stringify({ start, completed, status });
  assert.doesNotMatch(serialized, /accessToken|refreshToken|deviceSecret|verifier|pkce/i);
});

test('platform IPC rejects unsafe payment channels and keeps pending WeChat flow for pending responses', async () => {
  const client = {
    hasSession: () => false,
    startWechatLogin: async () => ({ authorizationUrl: 'https://elunvi-api.honeykid.cn/v1/auth/device-sessions/x/wechat', userCode: 'ABCD', expiresAt: 'e', pollIntervalSeconds: 1, deviceSessionId: 'x', deviceSecret: 's', verifier: 'v' }),
    completeWechatLogin: async () => { const error = new Error('not yet'); error.code = 'AUTH_PENDING'; throw error; },
    createPaymentAttempt: async () => { throw new Error('should not call'); },
    logout: async () => {}
  };
  const { handlers } = setup(client);
  await handlers.get('platform:login:startWechat')();
  assert.deepEqual(await handlers.get('platform:login:completeWechat')(), { state: 'pending' });
  await assert.rejects(() => handlers.get('platform:payment')(null, { checkoutId: 'c', channel: 'bank' }), /支付渠道/);
});

test('WeChat exchange treats the platform 409 AUTH_REQUIRED response as pending authorization', async () => {
  let attempts = 0;
  let authenticated = false;
  const client = {
    hasSession: () => authenticated,
    startWechatLogin: async () => ({ authorizationUrl: 'https://elunvi-api.honeykid.cn/v1/auth/wechat/start', userCode: 'ABCD', expiresAt: 'e', pollIntervalSeconds: 1, deviceSessionId: 'x', deviceSecret: 's', verifier: 'v' }),
    completeWechatLogin: async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('The user has not completed authorization');
        error.code = 'AUTH_REQUIRED';
        error.status = 409;
        error.retryable = true;
        throw error;
      }
      authenticated = true;
      return { accessExpiresAt: 'a', refreshExpiresAt: 'b' };
    },
    getProfile: async () => ({ userId: 'u', displayName: 'User' }),
    getWallet: async () => ({ productCode: 'elunvi-mart', availableMicroPoints: '1' })
  };
  const { handlers } = setup(client);
  await handlers.get('platform:login:startWechat')();
  assert.deepEqual(await handlers.get('platform:login:completeWechat')(), { state: 'pending' });
  assert.equal((await handlers.get('platform:login:completeWechat')()).authenticated, true);
});

test('preload contains only named platform methods and no raw ipcRenderer exposure', () => {
  const source = fs.readFileSync('src/renderer/preload.js', 'utf8');
  const calls = [];
  let exposed;
  vm.runInNewContext(source, { require: (name) => name === 'electron' ? { contextBridge: { exposeInMainWorld: (_name, value) => { exposed = value; } }, ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve(); }, on: () => {} } } : require(name) });
  assert.ok(exposed.platform);
  assert.equal(typeof exposed.platform.status, 'function');
  assert.equal(typeof exposed.platform.loginWithPassword, 'function');
  assert.equal(typeof exposed.platform.createPaymentAttempt, 'function');
  assert.equal(exposed.platform.ipcRenderer, undefined);
  exposed.platform.createPaymentAttempt('checkout', 'wechat');
  assert.equal(calls.at(-1)[0], 'platform:payment');
  assert.equal(calls.at(-1)[1].checkoutId, 'checkout');
  assert.equal(calls.at(-1)[1].channel, 'wechat');
});
