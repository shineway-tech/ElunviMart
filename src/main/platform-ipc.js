'use strict';

function registerPlatformIpc(ipcMain, { client, shell }) {
  let pendingWechatFlow = null;

  const snapshot = async () => {
    if (!client.hasSession()) return { authenticated: false, profile: null, wallet: null, lastError: null };
    try {
      const [profile, wallet] = await Promise.all([client.getProfile(), client.getWallet()]);
      return { authenticated: true, profile, wallet, lastError: null };
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED' || error?.status === 401) client.clearSession();
      return { authenticated: false, profile: null, wallet: null, lastError: publicError(error) };
    }
  };

  const afterLogin = async () => {
    const result = await snapshot();
    if (!result.authenticated) throw publicException(result.lastError);
    return result;
  };

  ipcMain.handle('platform:status', () => snapshot());
  ipcMain.handle('platform:login:password', async (_event, input) => {
    assertCredentials(input);
    await client.loginWithPassword({ email: input.email, password: input.password });
    return afterLogin();
  });
  ipcMain.handle('platform:login:startWechat', async () => {
    const flow = await client.startWechatLogin();
    assertAuthorizationUrl(flow.authorizationUrl, client.config?.apiBaseUrl);
    pendingWechatFlow = flow;
    await shell.openExternal(flow.authorizationUrl);
    return {
      authorizationUrl: flow.authorizationUrl,
      userCode: flow.userCode,
      expiresAt: flow.expiresAt,
      pollIntervalSeconds: flow.pollIntervalSeconds
    };
  });
  ipcMain.handle('platform:login:completeWechat', async () => {
    if (!pendingWechatFlow) throw new Error('微信登录事务不存在，请重新开始登录');
    try {
      await client.completeWechatLogin(pendingWechatFlow);
      pendingWechatFlow = null;
      return afterLogin();
    } catch (error) {
      if (['AUTH_PENDING', 'DEVICE_SESSION_PENDING', 'LOGIN_PENDING'].includes(error?.code)
        || (error?.code === 'AUTH_REQUIRED' && (error?.status === 409 || error?.retryable === true))) {
        return { state: 'pending' };
      }
      if (error?.code === 'DEVICE_SESSION_EXPIRED' || (error?.code === 'AUTH_REQUIRED' && error?.status !== 409)) pendingWechatFlow = null;
      throw error;
    }
  });
  ipcMain.handle('platform:refresh', async () => {
    await client.refresh();
    return afterLogin();
  });
  ipcMain.handle('platform:logout', async () => {
    pendingWechatFlow = null;
    await client.logout();
    return true;
  });
  ipcMain.handle('platform:packages', async () => client.getPackages());
  ipcMain.handle('platform:checkout', async (_event, input) => {
    if (!input || typeof input.packageCode !== 'string' || typeof input.idempotencyKey !== 'string') throw new Error('充值套餐和幂等键不能为空');
    return client.createCheckout(input.packageCode, input.idempotencyKey);
  });
  ipcMain.handle('platform:payment', async (_event, input) => {
    if (!input || !['wechat', 'alipay'].includes(input.channel)) throw new Error('不支持的支付渠道');
    if (typeof input.checkoutId !== 'string' || !input.checkoutId) throw new Error('支付订单不存在');
    return client.createPaymentAttempt(input.checkoutId, input.channel);
  });
  ipcMain.handle('platform:getCheckout', (_event, checkoutId) => client.getCheckout(requireText(checkoutId, '支付订单')));
  ipcMain.handle('platform:checkout:close', (_event, checkoutId) => client.closeCheckout(requireText(checkoutId, '支付订单')));
}

function assertCredentials(input) {
  if (!input || typeof input.email !== 'string' || !input.email.trim() || typeof input.password !== 'string' || !input.password) throw new Error('请输入平台邮箱和密码');
}

function assertAuthorizationUrl(value, apiBaseUrl) {
  let url;
  try { url = new URL(value); } catch { throw new Error('平台登录地址无效'); }
  if (url.protocol !== 'https:' || (apiBaseUrl && url.origin !== new URL(apiBaseUrl).origin)) throw new Error('平台登录地址无效');
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}不能为空`);
  return value;
}

function publicError(error) {
  return { code: String(error?.code || 'PLATFORM_ERROR'), message: String(error?.message || '平台操作失败'), requestId: error?.requestId || null, retryable: error?.retryable === true };
}

function publicException(error) {
  const result = new Error(error?.message || '平台操作失败');
  result.code = error?.code || 'PLATFORM_ERROR';
  result.requestId = error?.requestId || null;
  result.retryable = error?.retryable === true;
  return result;
}

module.exports = { registerPlatformIpc, publicError };
