const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DATA = Object.freeze({
  version: 1,
  accounts: [],
  products: {},
  settings: {
    intervalMinMinutes: 10,
    intervalMaxMinutes: 20,
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
        last_sync_at TEXT, last_sync_source TEXT NOT NULL DEFAULT '', last_sync_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        account_id TEXT NOT NULL, product_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        lost_at TEXT, updated_at TEXT, data_json TEXT NOT NULL,
        PRIMARY KEY (account_id, product_id), FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS products_account_idx ON products(account_id);
      CREATE TABLE IF NOT EXISTS sync_backoff (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        failures INTEGER NOT NULL DEFAULT 0, next_allowed_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data_json TEXT NOT NULL);
    `);
    this.ensureSettings();
    if (legacyJsonPath) this.migrateLegacyJson(legacyJsonPath);
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
      lastSyncAt: account.lastSyncAt || null, lastSyncSource: String(account.lastSyncSource || ''), lastSyncError: String(account.lastSyncError || ''),
      createdAt: account.createdAt || now, updatedAt: account.updatedAt || now
    };
    this.database.prepare(`
      INSERT INTO accounts (id, display_name, avatar_url, mall_id, status, product_count, last_sync_at, last_sync_source, last_sync_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, mall_id=excluded.mall_id,
        status=excluded.status, product_count=excluded.product_count, last_sync_at=excluded.last_sync_at,
        last_sync_source=excluded.last_sync_source, last_sync_error=excluded.last_sync_error, updated_at=excluded.updated_at
    `).run(value.id, value.displayName, value.avatarUrl, value.mallId, value.status, value.productCount, value.lastSyncAt, value.lastSyncSource, value.lastSyncError, value.createdAt, value.updatedAt);
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

  setSettings(settings) {
    const normalized = mergeSettings(settings);
    this.database.prepare('INSERT INTO settings (id, data_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json').run(JSON.stringify(normalized));
    return this.getSettings();
  }

  close() { this.database.close(); }
}

module.exports = { SqliteStore, DEFAULT_DATA };
