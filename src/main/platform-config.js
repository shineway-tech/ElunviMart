'use strict';

const ELUNVI_PLATFORM_CONFIG = Object.freeze({
  apiBaseUrl: 'https://elunvi-api.honeykid.cn',
  productCode: 'elunvi-mart',
  clients: Object.freeze({
    darwin: 'elunvi-mart-macos',
    win32: 'elunvi-mart-windows'
  }),
  scopes: Object.freeze(['profile:read', 'wallet:read', 'payments:read', 'payments:write']),
  redirectUri: 'elunvi-mart://auth/callback'
});

function validatePlatformConfig(config) {
  if (!config || config.productCode !== 'elunvi-mart') throw new Error('平台产品代码无效');
  const apiUrl = new URL(config.apiBaseUrl);
  if (apiUrl.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(apiUrl.hostname))) throw new Error('平台 API 必须使用 HTTPS');
  if (!config.clientId || !Object.values(config.clients || {}).includes(config.clientId)) throw new Error('平台 client ID 无效');
  const requiredScopes = ['profile:read', 'wallet:read', 'payments:read', 'payments:write'];
  if (!Array.isArray(config.scopes) || requiredScopes.some((scope) => !config.scopes.includes(scope))) throw new Error('平台 scopes 不完整');
  if (typeof config.redirectUri !== 'string' || !config.redirectUri.startsWith('elunvi-mart://')) throw new Error('平台回调地址无效');
  return config;
}

module.exports = { ELUNVI_PLATFORM_CONFIG, validatePlatformConfig };
