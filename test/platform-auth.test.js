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

test('PlatformService changes the authenticated password through an email challenge', async () => {
  const calls = [];
  const service = new PlatformService({
    client: {
      request: async (path, options) => {
        calls.push({ path, options });
        if (path === '/v1/auth/email/password-reset-challenges') return { data: { challenge_id: 'password-change-1', expires_at: '2026-09-22T08:00:00Z' } };
        if (path === '/v1/me/password') return { data: { password_configured: true, available_actions: [] } };
        throw new Error(`unexpected path ${path}`);
      }
    },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'access', refreshToken: 'refresh' }) }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  const challenge = await service.requestAuthenticatedPasswordCode('person@example.com');
  const security = await service.completeAuthenticatedPassword({ challengeId: challenge.challengeId, code: '123456', newPassword: 'new-password-1' });
  assert.equal(security.passwordConfigured, true);
  assert.deepEqual(calls.map((call) => call.path), ['/v1/auth/email/password-reset-challenges', '/v1/me/password']);
  assert.equal(calls[0].options.auth, false);
  assert.deepEqual(calls[1].options.body, { challenge_id: 'password-change-1', code: '123456', new_password: 'new-password-1' });
});

test('PlatformService resolves a masked password-change email from the authenticated login', async () => {
  const calls = [];
  const service = new PlatformService({
    client: { request: async (path, options) => {
      calls.push({ path, options });
      return { data: { challenge_id: 'password-change-2', expires_at: '2026-09-22T08:00:00Z' } };
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'access', refreshToken: 'refresh' }) }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  service.authenticatedEmail = 'person@example.com';
  await service.requestAuthenticatedPasswordCode('p***@example.com');
  assert.deepEqual(calls[0].options.body, { email: 'person@example.com' });
});

test('PlatformService binds an email for an authenticated user', async () => {
  const calls = [];
  const service = new PlatformService({
    client: {
      request: async (path, options) => {
        calls.push({ path, options });
        if (path.endsWith('/email-binding-challenges')) return { data: { challenge_id: 'account-binding-1', expires_at: '2026-09-22T08:00:00Z' } };
        if (path === '/v1/me/email-binding') return { data: { masked_email: 'p***@example.com', available_actions: [] } };
        throw new Error(`unexpected path ${path}`);
      }
    },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore({ accessToken: 'access', refreshToken: 'refresh' }) }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] }
  });
  const challenge = await service.requestAuthenticatedEmailBindingCode('person@example.com');
  assert.deepEqual(challenge, { challengeId: 'account-binding-1', expiresAt: '2026-09-22T08:00:00Z' });
  const security = await service.completeAuthenticatedEmailBinding({ challengeId: challenge.challengeId, code: '123456' });
  assert.equal(security.maskedEmail, 'p***@example.com');
  assert.deepEqual(calls.map((call) => call.path), ['/v1/me/email-binding-challenges', '/v1/me/email-binding']);
  assert.deepEqual(calls[0].options.body, { email: 'person@example.com' });
  assert.deepEqual(calls[1].options.body, { challenge_id: 'account-binding-1', code: '123456' });
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
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-wechat', device_secret: 'secret-wechat', expires_at: new Date(Date.now() + 60_000).toISOString(), poll_interval_seconds: 5, wechat_start_uri: '/v1/auth/wechat/start?device_session_id=device-wechat' } };
      if (path.endsWith('/token')) {
        tokenPolls += 1;
        if (tokenPolls === 1) throw Object.assign(new Error('pending'), { status: 429, code: 'AUTH_REQUIRED' });
        if (tokenPolls === 2) throw Object.assign(new Error('binding'), { status: 409, code: 'AUTH_EMAIL_BINDING_REQUIRED' });
        return { data: { access_token: 'wechat-access', refresh_token: 'wechat-refresh' } };
      }
      if (path.endsWith('/email-binding-challenges')) return { data: { challenge_id: 'binding-1', expires_at: new Date(Date.now() + 60_000).toISOString() } };
      if (path.endsWith('/email-binding')) return { data: undefined };
      if (path === '/v1/me/profile') return { data: { user_id: 'wechat-user', display_name: 'WeChat User' } };
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] },
    fetchImpl: async () => ({ ok: true, url: 'https://open.weixin.qq.com/connect/qrconnect', text: async () => '<img class="js_qrcode_img" src="/connect/qrcode/test-code">' })
  });
  const started = await service.startWechatLogin();
  assert.equal(started.pollIntervalSeconds, 1);
  assert.match(started.wechatStartUri, /\/v1\/auth\/wechat\/start/);
  assert.equal(started.authorizationUrl, 'https://open.weixin.qq.com/connect/qrconnect');
  assert.equal(started.qrImageUrl, 'https://open.weixin.qq.com/connect/qrcode/test-code');
  assert.deepEqual(await service.pollWechatLogin(), { state: 'pending', retryAfterSeconds: 1 });
  assert.deepEqual(await service.pollWechatLogin(), { state: 'binding_required' });
  const challenge = await service.requestEmailBindingCode('person@example.com');
  assert.equal(challenge.challengeId, 'binding-1');
  const profile = await service.completeEmailBinding({ challengeId: challenge.challengeId, code: '123456' });
  assert.equal(profile.userId, 'wechat-user');
  assert.equal(calls.some((call) => call.path.endsWith('/email-binding')), true);
});

test('PlatformService completes the WeChat callback through the long-poll result', async () => {
  const calls = [];
  let tokenPolls = 0;
  const fetchCalls = [];
  const service = new PlatformService({
    client: { request: async (path, options) => {
      calls.push({ path, options });
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-wechat-callback', device_secret: 'secret-wechat-callback', expires_at: new Date(Date.now() + 60_000).toISOString(), poll_interval_seconds: 5, wechat_start_uri: '/v1/auth/wechat/start?device_session_id=device-wechat-callback' } };
      if (path.endsWith('/token')) {
        tokenPolls += 1;
        if (tokenPolls === 1) throw Object.assign(new Error('pending'), { status: 429, code: 'AUTH_REQUIRED' });
        return { data: { access_token: 'wechat-access', refresh_token: 'wechat-refresh' } };
      }
      if (path === '/v1/me/profile') return { data: { user_id: 'wechat-user', display_name: 'WeChat User' } };
      if (path === '/v1/me/security') return { data: { masked_email: 'u***@example.com', available_actions: [] } };
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] },
    fetchImpl: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).startsWith('https://long.open.weixin.qq.com/')) return { ok: true, status: 200, text: async () => "window.wx_errcode=405;window.wx_code='approved-code';" };
      if (String(url).startsWith('https://elunvi-api.honeykid.cn/v1/auth/wechat/callback')) return { ok: true, status: 204, text: async () => '' };
      return { ok: true, status: 200, url: 'https://open.weixin.qq.com/connect/qrconnect?redirect_uri=https%3A%2F%2Felunvi-api.honeykid.cn%2Fv1%2Fauth%2Fwechat%2Fcallback&state=state-callback', text: async () => '<img class="js_qrcode_img" src="/connect/qrcode/qr-callback">' };
    }
  });
  await service.startWechatLogin();
  assert.deepEqual(await service.pollWechatLogin(), { state: 'pending', retryAfterSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const profile = await service.pollWechatLogin();
  assert.equal(profile.state, 'signed_in');
  assert.equal(fetchCalls.some((url) => url.startsWith('https://long.open.weixin.qq.com/')), true);
  assert.equal(fetchCalls.some((url) => url.includes('code=approved-code') && url.includes('state=state-callback')), true);
  assert.equal(calls.some((call) => call.path.endsWith('/token')), true);
});

test('PlatformService requires authenticated email binding after a WeChat token is issued', async () => {
  const service = new PlatformService({
    client: { request: async (path) => {
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-wechat-account-binding', device_secret: 'secret-wechat-account-binding', expires_at: new Date(Date.now() + 60_000).toISOString(), poll_interval_seconds: 1, wechat_start_uri: '/v1/auth/wechat/start?device_session_id=device-wechat-account-binding' } };
      if (path.endsWith('/token')) return { data: { access_token: 'wechat-access', refresh_token: 'wechat-refresh' } };
      if (path === '/v1/me/profile') return { data: { user_id: 'wechat-user', display_name: 'WeChat User' } };
      if (path === '/v1/me/security') return { data: { masked_email: null, available_actions: ['bind_email'] } };
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] },
    fetchImpl: async (url) => {
      if (String(url).startsWith('https://long.open.weixin.qq.com/')) return { ok: true, status: 200, text: async () => "window.wx_errcode=405;window.wx_code='approved-code';" };
      if (String(url).startsWith('https://elunvi-api.honeykid.cn/v1/auth/wechat/callback')) return { ok: true, status: 204, text: async () => '' };
      return { ok: true, status: 200, url: 'https://open.weixin.qq.com/connect/qrconnect?redirect_uri=https%3A%2F%2Felunvi-api.honeykid.cn%2Fv1%2Fauth%2Fwechat%2Fcallback&state=state-account-binding', text: async () => '<img class="js_qrcode_img" src="/connect/qrcode/qr-account-binding">' };
    }
  });
  await service.startWechatLogin();
  assert.deepEqual(await service.pollWechatLogin(), { state: 'binding_required', bindingKind: 'account', profile: { userId: 'wechat-user', displayName: 'WeChat User', avatarUrl: null, requestId: undefined } });
  assert.ok(service.wechatFlow);
  service.cancelWechatLogin();
});

test('PlatformService exposes a scanned state before WeChat confirmation', async () => {
  let tokenPolls = 0;
  let qrPolls = 0;
  const qrUrls = [];
  const service = new PlatformService({
    client: { request: async (path) => {
      if (path === '/v1/auth/device-sessions') return { data: { device_session_id: 'device-wechat-scanned', device_secret: 'secret-wechat-scanned', expires_at: new Date(Date.now() + 60_000).toISOString(), poll_interval_seconds: 5, wechat_start_uri: '/v1/auth/wechat/start?device_session_id=device-wechat-scanned' } };
      if (path.endsWith('/token')) {
        tokenPolls += 1;
        throw Object.assign(new Error('pending'), { status: 429, code: 'AUTH_REQUIRED' });
      }
      throw new Error(`unexpected path ${path}`);
    } },
    session: new PlatformSession({ tokenStore: new MemoryTokenStore() }),
    config: { apiBaseUrl: 'https://elunvi-api.honeykid.cn', clientId: 'elunvi-mart-macos', redirectUri: 'elunvi-mart://auth/callback', scopes: [] },
    fetchImpl: async (url) => {
      if (String(url).startsWith('https://long.open.weixin.qq.com/')) {
        qrUrls.push(String(url));
        qrPolls += 1;
        if (qrPolls === 1) return { ok: true, status: 200, text: async () => 'window.wx_errcode=404;window.wx_code=\'\';' };
        if (new URL(url).searchParams.get('last') === '404') return { ok: true, status: 200, text: async () => "window.wx_errcode=405;window.wx_code='approved-code';" };
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true, status: 200, text: async () => 'window.wx_errcode=408;window.wx_code=\'\';' };
      }
      if (String(url).startsWith('https://elunvi-api.honeykid.cn/v1/auth/wechat/callback')) return { ok: true, status: 204, text: async () => '' };
      return { ok: true, status: 200, url: 'https://open.weixin.qq.com/connect/qrconnect?redirect_uri=https%3A%2F%2Felunvi-api.honeykid.cn%2Fv1%2Fauth%2Fwechat%2Fcallback&state=state-scanned', text: async () => '<img class="js_qrcode_img" src="/connect/qrcode/qr-scanned">' };
    }
  });
  await service.startWechatLogin();
  assert.deepEqual(await service.pollWechatLogin(), { state: 'pending', retryAfterSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(await service.pollWechatLogin(), { state: 'scanned', retryAfterSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.deepEqual(await service.pollWechatLogin(), { state: 'pending', retryAfterSeconds: 1 });
  assert.equal(qrUrls.some((url) => new URL(url).searchParams.get('last') === '404'), true);
  assert.equal(tokenPolls, 2);
  service.cancelWechatLogin();
});
