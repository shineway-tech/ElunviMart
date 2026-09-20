const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { SqliteStore } = require('../src/main/store');
const { SyncQueue } = require('../src/main/sync-queue');
const { PddActivityAdapter, AdapterResponseError } = require('../src/main/pdd-adapter');
const source = path.resolve(__dirname, '../src/main/main.js');
const localRequire = createRequire(source);
function setup(t) {
  const store = new SqliteStore(':memory:');
  t.after(() => store.close());
  store.upsertAccount({ id: 'a', displayName: 'test' });
  store.setProducts('a', [{ id: 'old', status: 'active', activityStatus: 'all_sku_win_bid' }]);
  const queue = new SyncQueue({ loadState: id => store.getSyncState(id), saveState: (id, value) => store.setSyncState(id, value) });
  const notifications = [];
  const context = vm.createContext({
    require: name => name === 'electron' ? { app: { setName() {}, on() {}, whenReady: () => ({ then() {} }) } }
      : name === './notifier' ? { sendConfiguredNotifications: async (_settings, alert) => { notifications.push(alert); return []; } }
        : localRequire(name),
    process, console, structuredClone, __dirname: path.dirname(source), fixtureStore: store, fixtureQueue: queue
  });
  vm.runInContext(fs.readFileSync(source, 'utf8'), context);
  vm.runInContext('store = fixtureStore; syncQueue = fixtureQueue;', context);
  return { store, queue, notifications, sync: vm.runInContext('syncAccount', context) };
}
test('an incomplete snapshot cannot overwrite cached products or send dropped-product alerts', async t => {
  const f = setup(t);
  const adapter = new PddActivityAdapter({ pageDelayMs: () => 0, sessions: {
    readPage: async () => ({ page: 1, total: 11, products: [], query: { page_size: 10 } }), close() {}
  } });
  await assert.rejects(f.sync(adapter, 'a'), /不完整/);
  assert.deepEqual(f.store.getProducts('a').map(p => p.id), ['old']);
  assert.equal(f.store.getAccount('a').lastSyncAt, null);
  assert.equal(f.notifications.length, 0);
});
test('54001 preserves the online state and blocks immediate manual re-entry', async t => {
  const f = setup(t);
  let calls = 0;
  const adapter = { syncProducts: async () => { calls++; throw new AdapterResponseError('操作太过频繁', 54001); } };
  await assert.rejects(f.sync(adapter, 'a'), { apiCode: 54001 });
  await assert.rejects(f.sync(adapter, 'a'), { code: 'SYNC_BACKOFF' });
  assert.equal(calls, 1);
  assert.equal(f.store.getAccount('a').status, 'active');
  assert.deepEqual(f.store.getProducts('a').map(p => p.id), ['old']);
});
test('removing an account during a fetch prevents stale writes and notifications', async t => {
  const f = setup(t);
  let release;
  const pending = f.sync({ syncProducts: () => new Promise(resolve => { release = resolve; }) }, 'a');
  f.queue.cancel('a'); f.store.removeAccount('a');
  release([{ id: 'new', status: 'active' }]);
  await assert.rejects(pending, /取消/);
  assert.equal(f.store.getAccount('a'), null);
  assert.deepEqual(f.store.getProducts('a'), []);
  assert.equal(f.notifications.length, 0);
});
