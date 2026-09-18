const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SqliteStore } = require('../src/main/store');

test('SqliteStore persists account, product cache and settings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pdd-monitor-test-'));
  const file = path.join(directory, 'monitor.db');
  const store = new SqliteStore(file);
  store.upsertAccount({ id: 'a1', displayName: '测试店铺', createdAt: '2026-09-17T00:00:00.000Z' });
  store.setProducts('a1', [{ id: 'p1', name: '测试商品', status: 'active' }]);
  store.setSettings({ intervalMinMinutes: 10, intervalMaxMinutes: 20, notifications: { desktop: true } });
  const restored = new SqliteStore(file);
  assert.equal(restored.getAccount('a1').displayName, '测试店铺');
  assert.equal(restored.getProducts('a1')[0].id, 'p1');
  assert.equal(restored.getSettings().intervalMaxMinutes, 20);
  store.close();
  restored.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
