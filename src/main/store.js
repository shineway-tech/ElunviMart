const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DATA = Object.freeze({
  version: 1,
  accounts: [],
  products: {},
  settings: {
    intervalMinMinutes: 30,
    intervalMaxMinutes: 60,
    detailIntervalMinutes: 30,
    detailBatchSize: 0,   // 0 = 每轮覆盖全部到期商品
    notifications: {
      desktop: true,
      wecom: { enabled: false, webhook: '' },
      dingtalk: { enabled: false, webhook: '', secret: '' }
    }
  }
});

function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }

function mergeSettings(settings = {}) {
  const defaults = cloneDefaults().settings;
  return {
    ...defaults,
    ...settings,
    notifications: {
      ...defaults.notifications,
      ...(settings.notifications || {}),
      wecom: { ...defaults.notifications.wecom, ...(settings.notifications?.wecom || {}) },
      dingtalk: { ...defaults.notifications.dingtalk, ...(settings.notifications?.dingtalk || {}) }
    }
  };
}

function accountFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    mallId: row.mall_id || '',
    status: row.status,
    productCount: row.product_count,
    notificationsEnabled: row.notifications_enabled === undefined ? true : Number(row.notifications_enabled) !== 0,
    lastSyncAt: row.last_sync_at || null,
    lastSyncSource: row.last_sync_source || '',
    lastSyncError: row.last_sync_error || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class SqliteStore {
  constructor(filePath, { legacyJsonPath = '' } = {}) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec('PRAGMA foreign_keys = ON');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '',
        mall_id TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', product_count INTEGER NOT NULL DEFAULT 0,
        notifications_enabled INTEGER NOT NULL DEFAULT 1,
        last_sync_at TEXT, last_sync_source TEXT NOT NULL DEFAULT '', last_sync_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        account_id TEXT NOT NULL, product_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        lost_at TEXT, updated_at TEXT, data_json TEXT NOT NULL,
        PRIMARY KEY (account_id, product_id), FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS products_account_idx ON products(account_id);
      CREATE TABLE IF NOT EXISTS product_details (
        account_id TEXT NOT NULL, product_id TEXT NOT NULL,
        fetched_at TEXT NOT NULL, data_json TEXT NOT NULL,
        PRIMARY KEY (account_id, product_id), FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS product_detail_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL, product_id TEXT NOT NULL, changed_at TEXT NOT NULL,
        scope TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
        from_status TEXT NOT NULL DEFAULT '', to_status TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS product_detail_changes_idx ON product_detail_changes(account_id, product_id, id DESC);
      CREATE TABLE IF NOT EXISTS sync_backoff (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        failures INTEGER NOT NULL DEFAULT 0, next_allowed_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
    this.ensureSettings();
    if (legacyJsonPath) this.migrateLegacyJson(legacyJsonPath);
    this.migrateAccountColumns();
  }

  // 老库补列：每个店铺的独立通知开关（默认开）
  migrateAccountColumns() {
    const columns = this.database.prepare('PRAGMA table_info(accounts)').all().map((row) => row.name);
    if (!columns.includes('notifications_enabled')) {
      this.database.exec('ALTER TABLE accounts ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1');
    }
  }

  ensureSettings() {
    if (!this.database.prepare('SELECT id FROM settings WHERE id = 1').get()) this.setSettings(cloneDefaults().settings);
  }

  migrateLegacyJson(legacyJsonPath) {
    if (!fs.existsSync(legacyJsonPath)) return;
    if (this.database.prepare('SELECT 1 FROM accounts LIMIT 1').get() || this.database.prepare('SELECT 1 FROM products LIMIT 1').get()) return;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')); } catch { return; }
    this.database.exec('BEGIN');
    try {
      for (const account of Array.isArray(parsed.accounts) ? parsed.accounts : []) this.upsertAccount(account);
      for (const [accountId, products] of Object.entries(parsed.products || {})) this.setProducts(accountId, products);
      if (parsed.settings) this.setSettings(parsed.settings);
      this.database.exec('COMMIT');
      fs.renameSync(legacyJsonPath, `${legacyJsonPath}.backup`);
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  getAccounts() { return this.database.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all().map(accountFromRow); }

  getAccount(id) { return accountFromRow(this.database.prepare('SELECT * FROM accounts WHERE id = ?').get(id)); }

  findAccountByMallId(mallId, excludeId = '') {
    const normalizedMallId = String(mallId || '').trim();
    if (!normalizedMallId) return null;
    const row = excludeId
      ? this.database.prepare('SELECT * FROM accounts WHERE mall_id = ? AND id != ? LIMIT 1').get(normalizedMallId, excludeId)
      : this.database.prepare('SELECT * FROM accounts WHERE mall_id = ? LIMIT 1').get(normalizedMallId);
    return accountFromRow(row);
  }

  upsertAccount(account) {
    const now = new Date().toISOString();
    const value = {
      id: String(account.id), displayName: String(account.displayName || ''), avatarUrl: String(account.avatarUrl || ''),
      mallId: String(account.mallId || ''), status: String(account.status || 'active'), productCount: Number(account.productCount || 0),
      notificationsEnabled: account.notificationsEnabled === false ? 0 : 1,
      lastSyncAt: account.lastSyncAt || null, lastSyncSource: String(account.lastSyncSource || ''), lastSyncError: String(account.lastSyncError || ''),
      createdAt: account.createdAt || now, updatedAt: account.updatedAt || now
    };
    this.database.prepare(`
      INSERT INTO accounts (id, display_name, avatar_url, mall_id, status, product_count, notifications_enabled, last_sync_at, last_sync_source, last_sync_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, mall_id=excluded.mall_id,
        status=excluded.status, product_count=excluded.product_count, notifications_enabled=excluded.notifications_enabled,
        last_sync_at=excluded.last_sync_at,
        last_sync_source=excluded.last_sync_source, last_sync_error=excluded.last_sync_error, updated_at=excluded.updated_at
    `).run(value.id, value.displayName, value.avatarUrl, value.mallId, value.status, value.productCount, value.notificationsEnabled, value.lastSyncAt, value.lastSyncSource, value.lastSyncError, value.createdAt, value.updatedAt);
    return this.getAccount(value.id);
  }

  updateAccount(id, changes) {
    const account = this.getAccount(id);
    if (!account) throw new Error('商家账号不存在');
    return this.upsertAccount({ ...account, ...changes, id, updatedAt: new Date().toISOString() });
  }

  removeAccount(id) { this.database.prepare('DELETE FROM accounts WHERE id = ?').run(id); }

  getProducts(accountId) { return this.database.prepare('SELECT data_json FROM products WHERE account_id = ? ORDER BY rowid ASC').all(accountId).map((row) => JSON.parse(row.data_json)); }

  setProducts(accountId, products) {
    this.database.prepare('DELETE FROM products WHERE account_id = ?').run(accountId);
    const insert = this.database.prepare('INSERT INTO products (account_id, product_id, status, lost_at, updated_at, data_json) VALUES (?, ?, ?, ?, ?, ?)');
    for (const product of products) insert.run(accountId, String(product.id), String(product.status || 'active'), product.lostAt || null, product.updatedAt || null, JSON.stringify(product));
  }

  // 报名详情（规格行）按商品缓存，避免每次都开页面去拼多多读
  getProductDetail(accountId, productId) {
    const row = this.database
      .prepare('SELECT fetched_at AS fetchedAt, data_json AS dataJson FROM product_details WHERE account_id = ? AND product_id = ?')
      .get(String(accountId), String(productId));
    if (!row) return null;
    try {
      return { rows: JSON.parse(row.dataJson), fetchedAt: row.fetchedAt };
    } catch {
      return null;
    }
  }

  setProductDetail(accountId, productId, { rows, fetchedAt }) {
    if (!this.getAccount(accountId)) return false;
    this.database.prepare(`INSERT INTO product_details (account_id, product_id, fetched_at, data_json) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, product_id) DO UPDATE SET fetched_at=excluded.fetched_at, data_json=excluded.data_json`)
      .run(String(accountId), String(productId), String(fetchedAt), JSON.stringify(rows));
    return true;
  }

  // 明细变化事件：商品级（scope=product）与 SKU 级（scope=sku，target=规格名）
  addProductDetailChanges(accountId, productId, changes) {
    if (!this.getAccount(accountId) || !Array.isArray(changes) || !changes.length) return 0;
    const insert = this.database.prepare(`INSERT INTO product_detail_changes
      (account_id, product_id, changed_at, scope, target, from_status, to_status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    this.database.exec('BEGIN');
    try {
      for (const change of changes) {
        insert.run(
          String(accountId), String(productId), String(change.changedAt || new Date().toISOString()),
          String(change.scope || 'sku'), String(change.target || ''),
          String(change.from || ''), String(change.to || '')
        );
      }
      this.database.exec('COMMIT');
      return changes.length;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  getProductDetailChanges(accountId, productId, limit = 10) {
    const rows = this.database.prepare(`SELECT changed_at AS changedAt, scope, target, from_status AS fromStatus, to_status AS toStatus
      FROM product_detail_changes WHERE account_id = ? AND product_id = ? ORDER BY id DESC LIMIT ?`)
      .all(String(accountId), String(productId), Math.max(1, Number(limit) || 10));
    return rows.map((row) => ({
      changedAt: row.changedAt,
      scope: row.scope,
      target: row.target,
      from: row.fromStatus,
      to: row.toStatus
    }));
  }

  getSyncState(accountId) {
    const row = this.database.prepare('SELECT failures, next_allowed_at AS nextAllowedAt FROM sync_backoff WHERE account_id = ?').get(accountId);
    return row ? { ...row } : null;
  }

  setSyncState(accountId, { failures, nextAllowedAt }) {
    // An account may have been removed while a request or notification was in flight.
    if (!this.getAccount(accountId)) return;
    this.database.prepare(`INSERT INTO sync_backoff (account_id, failures, next_allowed_at) VALUES (?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET failures=excluded.failures, next_allowed_at=excluded.next_allowed_at`)
      .run(accountId, failures, nextAllowedAt);
  }

  getSettings() {
    const row = this.database.prepare('SELECT data_json FROM settings WHERE id = 1').get();
    return mergeSettings(row ? JSON.parse(row.data_json) : {});
  }

  // 轻量界面偏好（例如上次选中的团队），每个平台账号一个库，天然按用户隔离
  getPreference(key) {
    const row = this.database.prepare('SELECT value FROM preferences WHERE key = ?').get(String(key));
    return row ? row.value : null;
  }

  setPreference(key, value) {
    this.database.prepare(`
      INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(String(key), String(value ?? ''), new Date().toISOString());
    return true;
  }

  setSettings(settings) {
    const normalized = mergeSettings(settings);
    this.database.prepare('INSERT INTO settings (id, data_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json').run(JSON.stringify(normalized));
    return this.getSettings();
  }

  close() { this.database.close(); }
}

module.exports = { SqliteStore, DEFAULT_DATA };
