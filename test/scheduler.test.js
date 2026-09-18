const test = require('node:test');
const assert = require('node:assert/strict');
const { randomDelayMs } = require('../src/main/scheduler');

test('randomDelayMs stays within the configured interval', () => {
  assert.equal(randomDelayMs(10, 20, () => 0), 10 * 60_000);
  assert.equal(randomDelayMs(10, 20, () => 1), 20 * 60_000);
  assert.equal(randomDelayMs(10, 20, () => 0.5), 15 * 60_000);
});

test('randomDelayMs normalizes invalid ranges', () => {
  assert.equal(randomDelayMs(0, 0, () => 0.5), 60_000);
  assert.equal(randomDelayMs(20, 10, () => 0.5), 20 * 60_000);
});
