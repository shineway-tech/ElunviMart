const test = require('node:test');
const assert = require('node:assert/strict');
const { MonitorScheduler, randomDelayMs } = require('../src/main/scheduler');

test('randomDelayMs stays within the configured interval', () => {
  assert.equal(randomDelayMs(10, 20, () => 0), 10 * 60_000);
  assert.equal(randomDelayMs(10, 20, () => 1), 20 * 60_000);
  assert.equal(randomDelayMs(10, 20, () => 0.5), 15 * 60_000);
});

test('randomDelayMs normalizes invalid ranges', () => {
  assert.equal(randomDelayMs(0, 0, () => 0.5), 60_000);
  assert.equal(randomDelayMs(20, 10, () => 0.5), 20 * 60_000);
});

test('MonitorScheduler keeps an independent timer for each active account', () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const timers = [];
  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = () => {};
  try {
    const scheduler = new MonitorScheduler(async () => {}, () => [
      { id: 'shop-a', status: 'active' },
      { id: 'shop-b', status: 'active' },
      { id: 'shop-c', status: 'needs_login' }
    ]);
    scheduler.configure({ intervalMinMinutes: 10, intervalMaxMinutes: 20 });
    assert.equal(timers.length, 3);
    assert.deepEqual([...scheduler.timers.keys()].sort(), ['shop-a', 'shop-b', 'shop-c']);
    scheduler.stop();
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});
