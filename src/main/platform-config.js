const PLATFORM_API_BASE_URL = 'https://elunvi-api.honeykid.cn';
const PRODUCT_CODE = 'elunvi-mart';
const REDIRECT_URI = 'elunvi-mart://auth/callback';
const SCOPES = Object.freeze(['profile:read', 'wallet:read', 'payments:read', 'payments:write']);

function platformConfigFor(platform = process.platform) {
  return Object.freeze({
    apiBaseUrl: PLATFORM_API_BASE_URL,
    productCode: PRODUCT_CODE,
    clientId: platform === 'win32' ? 'elunvi-mart-windows' : 'elunvi-mart-macos',
    redirectUri: REDIRECT_URI,
    scopes: [...SCOPES]
  });
}

module.exports = { platformConfigFor };
