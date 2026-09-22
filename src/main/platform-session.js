'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FILE_NAME = 'platform-session.bin';
const PREFIX = 'encrypted:';

class SafeTokenStore {
  constructor({ userDataPath, safeStorage, fsImpl = fs, pathImpl = path }) {
    if (!userDataPath) throw new Error('平台会话存储目录不能为空');
    this.filename = pathImpl.join(userDataPath, FILE_NAME);
    this.safeStorage = safeStorage;
    this.fs = fsImpl;
    this.path = pathImpl;
  }

  load() {
    let encoded;
    try {
      encoded = this.fs.readFileSync(this.filename, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      this.clear();
      return null;
    }
    if (!encoded.startsWith(PREFIX) || !this.safeStorage?.isEncryptionAvailable?.()) {
      this.clear();
      return null;
    }
    try {
      const plaintext = this.safeStorage.decryptString(Buffer.from(encoded.slice(PREFIX.length), 'base64'));
      const value = JSON.parse(plaintext);
      if (!isTokenMetadata(value)) throw new Error('平台会话格式无效');
      return value;
    } catch {
      this.clear();
      return null;
    }
  }

  save(value) {
    if (!this.safeStorage?.isEncryptionAvailable?.()) throw new Error('系统安全存储暂不可用，无法保存平台登录状态');
    if (!isTokenMetadata(value)) throw new Error('平台会话格式无效');
    const encrypted = this.safeStorage.encryptString(JSON.stringify(value));
    const encoded = `${PREFIX}${Buffer.from(encrypted).toString('base64')}`;
    const temporary = `${this.filename}.${process.pid}.${Date.now()}.tmp`;
    this.fs.writeFileSync(temporary, encoded, { mode: 0o600 });
    try {
      this.fs.renameSync(temporary, this.filename);
    } catch (error) {
      try { this.fs.unlinkSync(temporary); } catch {}
      throw error;
    }
  }

  clear() {
    try {
      this.fs.unlinkSync(this.filename);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function isTokenMetadata(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && typeof value.refreshToken === 'string' && value.refreshToken.length > 0
    && typeof value.accessExpiresAt === 'string' && value.accessExpiresAt.length > 0
    && typeof value.refreshExpiresAt === 'string' && value.refreshExpiresAt.length > 0;
}

module.exports = { SafeTokenStore, isTokenMetadata };
