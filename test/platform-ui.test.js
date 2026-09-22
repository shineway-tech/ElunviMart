const test = require('node:test');
const assert = require('node:assert/strict');
const {
  maskUserId,
  paymentLabel,
  toPlatformViewModel,
  createIdempotencyKey
} = require('../src/renderer/platform-ui');

test('platform view model separates logged-out state from merchant accounts', () => {
  const model = toPlatformViewModel({ authenticated: false, profile: null, wallet: null, packages: [] });
  assert.equal(model.loginVisible, true);
  assert.equal(model.accountVisible, false);
  assert.equal(model.walletText, '登录后查看');
  assert.equal(model.paymentDisabled, true);
});

test('platform view model masks platform identity and formats manual review safely', () => {
  const model = toPlatformViewModel({
    authenticated: true,
    profile: { userId: '01a0c4d1-5d74-7573-be4f-321e6719173e', displayName: '平台用户', avatarUrl: null },
    wallet: { availableMicroPoints: '120000' },
    packages: [{ packageCode: 'starter', amountFen: '100', totalMicroPoints: '10000' }],
    attempt: { state: 'manual_review', qrPayload: 'weixin://pay' },
    checkout: { state: 'manual_review' }
  });
  assert.equal(model.loginVisible, false);
  assert.equal(model.accountVisible, true);
  assert.equal(model.userIdText, maskUserId('01a0c4d1-5d74-7573-be4f-321e6719173e'));
  assert.equal(model.walletText, '120,000');
  assert.equal(model.paymentStatus, '支付待人工确认');
  assert.equal(model.paymentDisabled, false);
  assert.equal(model.qrPayload, 'weixin://pay');
});

test('payment states never present manual review or expired as paid', () => {
  assert.equal(paymentLabel('paid'), '充值成功');
  assert.equal(paymentLabel('manual_review'), '支付待人工确认');
  assert.equal(paymentLabel('expired'), '订单已过期');
  assert.notEqual(paymentLabel('manual_review'), '充值成功');
});

test('idempotency keys are non-empty and unique-shaped', () => {
  const key = createIdempotencyKey();
  assert.match(key, /^[0-9a-f-]{20,}$/i);
});
