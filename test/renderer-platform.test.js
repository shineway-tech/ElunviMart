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
  assert.match(html, /id="platform-wechat-start"/);
  assert.match(html, /id="platform-wechat-frame"/);
  assert.match(html, /class="platform-auth-brand"/);
  assert.match(html, /id="platform-auth-register-link"/);
  assert.match(html, /id="platform-auth-reset-link"/);
  assert.match(html, /id="platform-auth-inline-error"/);
  assert.match(html, /platform-auth-illustration\.png/);
  assert.match(html, /本地商家的店铺监控助手/);
  assert.match(html, /更专注，更高效/);
  assert.match(html, /让生意更清楚/);
  assert.match(html, /data-password-toggle="platform-password"/);
  assert.match(html, /assets\/wechat-mark\.svg/);
  assert.doesNotMatch(html, /id="platform-auth-tabs"/);
});
