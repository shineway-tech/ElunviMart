const test = require('node:test');
const assert = require('node:assert/strict');
const { ELUNVI_PLATFORM_CONFIG, validatePlatformConfig } = require('../src/main/platform-config');

test('public platform configuration contains the provisioned clients and scopes', () => {
  assert.equal(ELUNVI_PLATFORM_CONFIG.productCode, 'elunvi-mart');
  assert.equal(ELUNVI_PLATFORM_CONFIG.clients.darwin, 'elunvi-mart-macos');
  assert.equal(ELUNVI_PLATFORM_CONFIG.clients.win32, 'elunvi-mart-windows');
  assert.deepEqual(ELUNVI_PLATFORM_CONFIG.scopes, ['profile:read', 'wallet:read', 'payments:read', 'payments:write']);
  assert.doesNotMatch(JSON.stringify(ELUNVI_PLATFORM_CONFIG), /password|secret|token/i);
});

test('platform configuration validation rejects unsafe or mismatched values', () => {
  const base = { ...ELUNVI_PLATFORM_CONFIG, clientId: ELUNVI_PLATFORM_CONFIG.clients.darwin };
  assert.equal(validatePlatformConfig(base), base);
  assert.throws(() => validatePlatformConfig({ ...base, apiBaseUrl: 'http://platform.example' }), /HTTPS/);
  assert.throws(() => validatePlatformConfig({ ...base, productCode: 'other' }), /产品代码/);
  assert.throws(() => validatePlatformConfig({ ...base, clientId: 'invented-client' }), /client ID/);
  assert.throws(() => validatePlatformConfig({ ...base, scopes: ['profile:read'] }), /scopes/);
});
