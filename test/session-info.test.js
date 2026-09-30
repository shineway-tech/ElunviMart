const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCookieSummary, summarizeCookies } = require('../src/main/session-info');

test('cookie summary counts live cookies and flags login state without leaking values', () => {
  const summary = summarizeCookies([
    { name: 'api_uid', expired: false, value: 'secret-value' },
    { name: 'rckk', expired: false, value: 'secret-value' },
    { name: 'stale', expired: true, value: 'x' },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.alive, 2);
  assert.equal(summary.hasLoginCookie, true);
  const text = formatCookieSummary(summary);
  assert.match(text, /mms cookie 有效 2\/3/);
  assert.match(text, /有 api_uid/);
  assert.match(text, /api_uid/);
  assert.doesNotMatch(text, /secret-value/, '只记名字不记值');
});

test('cookie summary says so when the session looks logged out', () => {
  const text = formatCookieSummary(summarizeCookies([{ name: 'foo', expired: false }]));
  assert.match(text, /没有 api_uid/);
  assert.match(formatCookieSummary(summarizeCookies([])), /有效 0\/0/);
});
