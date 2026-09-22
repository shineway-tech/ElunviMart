const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformService } = require('../src/main/platform-service');
const { PlatformSession, MemoryTokenStore } = require('../src/main/platform-session');

test('PlatformService requests a password reset code through Platform', async () => {
  const calls = [];
  const service = new PlatformService({
    client: { request: async (path, options) => {
      calls.push({ path, options });
      return { data: { challenge_id: 'challenge-1', expires_at: '2026-09-22T08:00:00Z' } };
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  const result = await service.requestPasswordResetCode('person@example.com');
  assert.equal(result.challengeId, 'challenge-1');
  assert.equal(calls[0].path, '/v1/auth/email/password-reset-challenges');
  assert.deepEqual(calls[0].options.body, { email: 'person@example.com' });
});

test('PlatformService validates the password reset payload before sending it', async () => {
  const service = new PlatformService({
    client: { request: async () => ({ data: {} }) },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  await assert.rejects(() => service.resetPassword({ challengeId: '', code: '', newPassword: '' }), /验证码和新密码不能为空/);
});

test('PlatformService keeps the device flow while registering an email account', async () => {
  const calls = [];
  const service = new PlatformService({
    client: { request: async (path, options) => {
      calls.push({ path, options });
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-1', device_secret: 'secret-1', expires_at: '2026-09-22T08:00:00Z', poll_interval_seconds: 2 } };
      if (path === '/v1/auth/email/registration-challenges') return { data: { challenge_id: 'challenge-2', expires_at: '2026-09-22T08:05:00Z' } };
      if (path === '/v1/auth/email/registrations') return { data: undefined };
      if (path === '/v1/auth/device-sessions/device-1/token') return { data: { access_token: 'access-1', refresh_token: 'refresh-1' } };
      if (path === '/v1/me/profile') return { data: { user_id: 'user-1', display_name: 'Mart User' } };
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  const challenge = await service.requestRegistrationCode('person@example.com');
  const profile = await service.completeRegistration({ challengeId: challenge.challengeId, code: '123456', password: 'password-1' });
  assert.equal(profile.userId, 'user-1');
  assert.equal(calls[2].options.body.device_session_id, 'device-1');
  assert.equal(calls[3].options.body.pkce_verifier.length > 0, true);
});

test('PlatformService polls WeChat device login and supports required email binding', async () => {
  const calls = [];
  let tokenPolls = 0;
  const service = new PlatformService({
    client: { request: async (path, options) => {
      calls.push({ path, options });
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-wechat', device_secret: 'secret-wechat', expires_at: new Date(Date.now() + 60_000).toISOString(), poll_interval_seconds: 1, wechat_start_uri: '/v1/auth/wechat/start?device_session_id=device-wechat' } };
      if (path.endsWith('/token')) {
        tokenPolls += 1;
        if (tokenPolls === 1) throw Object.assign(new Error('pending'), { status: 401 });
        if (tokenPolls === 2) throw Object.assign(new Error('binding'), { status: 409, code: 'AUTH_EMAIL_BINDING_REQUIRED' });
        return { data: { access_token: 'wechat-access', refresh_token: 'wechat-refresh' } };
      }
      if (path.endsWith('/email-binding-challenges')) return { data: { challenge_id: 'binding-1', expires_at: new Date(Date.now() + 60_000).toISOString() } };
      if (path.endsWith('/email-binding')) return { data: undefined };
      if (path === '/v1/me/profile') return { data: { user_id: 'wechat-user', display_name: 'WeChat User' } };
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  const started = await service.startWechatLogin();
  assert.match(started.wechatStartUri, /\/v1\/auth\/wechat\/start/);
  assert.deepEqual(await service.pollWechatLogin(), { state: 'pending', retryAfterSeconds: 1 });
  assert.deepEqual(await service.pollWechatLogin(), { state: 'binding_required' });
  const challenge = await service.requestEmailBindingCode('person@example.com');
  assert.equal(challenge.challengeId, 'binding-1');
  const profile = await service.completeEmailBinding({ challengeId: challenge.challengeId, code: '123456' });
  assert.equal(profile.userId, 'wechat-user');
  assert.equal(calls.some((call) => call.path.endsWith('/email-binding')), true);
});
