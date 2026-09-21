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

module.exports = { ELUNVI_PLATFORM_CONFIG };
