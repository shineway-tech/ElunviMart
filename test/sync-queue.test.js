const test = require('node:test');
const assert = require('node:assert/strict');
const { SyncQueue } = require('../src/main/sync-queue');
const tick = () => new Promise(setImmediate);

test('same-account work cannot overlap; different accounts run independently', async () => {
  const queue = new SyncQueue();
  let release;
  const first = queue.run('a', () => new Promise(resolve => { release = resolve; }));
  await tick();
  await assert.rejects(queue.run('a', () => {}), { code: 'SYNC_BUSY' });
  assert.deepEqual(await queue.run('a', () => {}, { source: 'scheduled' }), { skipped: true });
  assert.equal(await queue.run('b', () => 42), 42);
  release(1); assert.equal(await first, 1);
  assert.equal(queue.isRunning('a'), false);
});
test('54001 backs off, persists across restarts, and manual sync cannot bypass it', async () => {
  let clock = 0;
  const states = new Map();
  const options = { now: () => clock, loadState: id => states.get(id), saveState: (id, state) => states.set(id, state) };
  let queue = new SyncQueue(options);
  const fail = () => { throw Object.assign(new Error('频繁'), { apiCode: 54001 }); };
  await assert.rejects(queue.run('a', fail));
  assert.equal(queue.remainingMs('a'), 30 * 60_000);
  queue = new SyncQueue(options);
  await assert.rejects(queue.run('a', () => {}), { code: 'SYNC_BACKOFF' });
  assert.deepEqual(await queue.run('a', () => {}, { source: 'scheduled' }), { skipped: true });
  clock += 30 * 60_000;
  await assert.rejects(queue.run('a', fail));
  assert.equal(queue.remainingMs('a'), 60 * 60_000);
  clock += 60 * 60_000;
  await queue.run('a', () => true);
  assert.equal(queue.remainingMs('a'), 0);
});
test('cancel aborts active task without recording another failure after removal', async () => {
  let writes = 0;
  const queue = new SyncQueue({ saveState: () => { writes++; } });
  const pending = queue.run('a', signal => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await tick(); queue.cancel('a');
  await assert.rejects(pending, /取消/);
  assert.equal(writes, 0);
  assert.equal(queue.isRunning('a'), false);
});
