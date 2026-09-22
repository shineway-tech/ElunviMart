const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('renderer exposes a clear signed-out entry and signed-in finance surfaces', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  assert.match(html, /id="platform-login-modal"/);
  assert.match(html, /id="platform-account"/);
  assert.match(html, /id="wallet-view"/);
  assert.match(html, /id="team-view"/);
  assert.match(html, /id="payment-view"/);
  assert.match(html, /data-platform-auth-mode="register"/);
  assert.match(html, /id="platform-request-code"/);
});
