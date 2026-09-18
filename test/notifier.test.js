const test = require('node:test');
const assert = require('node:assert/strict');
const { assertWebhook, signDingTalk } = require('../src/main/notifier');

test('assertWebhook accepts only the official robot webhook hosts', () => {
  assert.equal(assertWebhook('wecom', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test').hostname, 'qyapi.weixin.qq.com');
  assert.equal(assertWebhook('dingtalk', 'https://oapi.dingtalk.com/robot/send?access_token=test').hostname, 'oapi.dingtalk.com');
  assert.throws(() => assertWebhook('wecom', 'https://example.com/webhook'), /支持/);
  assert.throws(() => assertWebhook('dingtalk', 'http://oapi.dingtalk.com/robot/send'), /支持/);
});

test('signDingTalk adds a timestamp and signature when a secret exists', () => {
  const url = new URL('https://oapi.dingtalk.com/robot/send?access_token=test');
  signDingTalk(url, 'SEC-test');
  assert.match(url.searchParams.get('timestamp'), /^\d+$/);
  assert.ok(url.searchParams.get('sign'));
});
