const fs = require('node:fs');
const path = require('node:path');

function copyTokens(tokens) {
  if (!tokens) return null;
  return {
    accessToken: String(tokens.accessToken),
    refreshToken: String(tokens.refreshToken),
    ...(tokens.accessExpiresAt ? { accessExpiresAt: String(tokens.accessExpiresAt) } : {}),
    ...(tokens.refreshExpiresAt ? { refreshExpiresAt: String(tokens.refreshExpiresAt) } : {}),
    ...(tokens.accountEmail ? { accountEmail: String(tokens.accountEmail) } : {})
  };
}

class MemoryTokenStore {
  constructor(initial = null) {
    this.value = copyTokens(initial);
  }

  async load() { return copyTokens(this.value); }
  async save(tokens) { this.value = copyTokens(tokens); }
  async clear() { this.value = null; }
}

class SafeStorageTokenStore {
  constructor({ filePath, safeStorage }) {
    this.filePath = filePath;
    this.safeStorage = safeStorage;
  }

  async load() {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      const encoded = fs.readFileSync(this.filePath, 'utf8');
      const text = this.safeStorage.decryptString(Buffer.from(encoded, 'base64'));
      return copyTokens(JSON.parse(text));
    } catch {
      return null;
    }
  }

  async save(tokens) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储暂不可用，无法保存登录会话');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const encrypted = this.safeStorage.encryptString(JSON.stringify(copyTokens(tokens)));
    fs.writeFileSync(this.filePath, encrypted.toString('base64'), { mode: 0o600 });
  }

  async clear() {
    try { fs.rmSync(this.filePath, { force: true }); } catch {}
  }
}

class PlatformSession {
  constructor({ tokenStore }) {
    if (!tokenStore) throw new Error('tokenStore is required');
    this.tokenStore = tokenStore;
    this.refreshPromise = null;
  }

  tokens() { return this.tokenStore.load(); }

  async accessToken() {
    return (await this.tokens())?.accessToken || null;
  }

  async accountEmail() {
    return (await this.tokens())?.accountEmail || null;
  }

  async save(tokens) {
    const current = await this.tokens();
    const normalized = copyTokens({ ...current, ...tokens });
    if (!normalized?.accessToken || !normalized?.refreshToken) throw new Error('Platform 会话响应无效');
    await this.tokenStore.save(normalized);
    return normalized;
  }

  async saveAccountEmail(email) {
    const current = await this.tokens();
    if (!current) return null;
    const normalized = copyTokens({ ...current, accountEmail: String(email || '').trim() });
    await this.tokenStore.save(normalized);
    return normalized.accountEmail || null;
  }

  async clear() {
    this.refreshPromise = null;
    await this.tokenStore.clear();
  }

  async refresh(refreshFn) {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const current = await this.tokens();
      if (!current?.refreshToken) throw new Error('Platform 会话已失效，请重新登录');
      const next = await refreshFn(current.refreshToken);
      return this.save(next);
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }
}

module.exports = { PlatformSession, MemoryTokenStore, SafeStorageTokenStore };
