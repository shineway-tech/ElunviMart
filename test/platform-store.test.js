const test = require('node:test');
const assert = require('node:assert/strict');
const { platformConfigFor } = require('../src/main/platform-config');

test('platformConfigFor selects the Mart desktop client without changing product identity', () => {
  const config = platformConfigFor('darwin');
  assert.equal(config.productCode, 'elunvi-mart');
  assert.equal(config.clientId, 'elunvi-mart-macos');
  assert.equal(config.redirectUri, 'elunvi-mart://auth/callback');
  assert.deepEqual(config.scopes, ['profile:read', 'wallet:read', 'payments:read', 'payments:write']);
});

test('platformConfigFor selects the Windows client for win32', () => {
  assert.equal(platformConfigFor('win32').clientId, 'elunvi-mart-windows');
});
