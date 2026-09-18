const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SqliteStore } = require('../src/main/store');

test('SqliteStore persists accounts, products and settings in SQLite', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pdd-monitor-sqlite-'));
  const file = path.join(directory, 'monitor.db');
  const store = new SqliteStore(file);
  store.upsertAccount({
    id: 'a1',
    displayName: '测试店铺',
    avatarUrl: 'https://example.com/avatar.png',
    createdAt: '2026-09-17T00:00:00.000Z'
  });
  store.setProducts('a1', [{ id: 'p1', name: '测试商品', status: 'active' }]);
  store.setSettings({ intervalMinMinutes: 10, intervalMaxMinutes: 20, notifications: { desktop: true } });

  const restored = new SqliteStore(file);
  assert.equal(restored.getAccount('a1').avatarUrl, 'https://example.com/avatar.png');
  assert.equal(restored.getProducts('a1')[0].id, 'p1');
  assert.equal(restored.getSettings().intervalMaxMinutes, 20);
  restored.close();
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('SqliteStore migrates the legacy JSON file once', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pdd-monitor-migrate-'));
  const jsonFile = path.join(directory, 'monitor-data.json');
  fs.writeFileSync(jsonFile, JSON.stringify({
    version: 1,
    accounts: [{ id: 'a1', displayName: '旧店铺', avatarUrl: '', createdAt: '2026-09-17T00:00:00.000Z' }],
    products: { a1: [{ id: 'p1', name: '旧商品', status: 'active' }] },
    settings: { intervalMinMinutes: 5, intervalMaxMinutes: 15, notifications: { desktop: false } }
  }));
  const store = new SqliteStore(path.join(directory, 'monitor.db'), { legacyJsonPath: jsonFile });

  assert.equal(store.getAccount('a1').displayName, '旧店铺');
  assert.equal(store.getProducts('a1')[0].name, '旧商品');
  assert.equal(store.getSettings().intervalMinMinutes, 5);
  assert.equal(fs.existsSync(`${jsonFile}.backup`), true);
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('SqliteStore finds an existing shop by mall id while excluding the current account', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pdd-monitor-duplicate-'));
  const store = new SqliteStore(path.join(directory, 'monitor.db'));
  store.upsertAccount({ id: 'a1', displayName: '店铺一', mallId: 'mall-1', createdAt: '2026-09-17T00:00:00.000Z' });
  store.upsertAccount({ id: 'a2', displayName: '店铺二', mallId: 'mall-2', createdAt: '2026-09-17T00:00:01.000Z' });

  assert.equal(store.findAccountByMallId('mall-1').id, 'a1');
  assert.equal(store.findAccountByMallId('mall-1', 'a1'), null);
  assert.equal(store.findAccountByMallId('missing'), null);

  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
