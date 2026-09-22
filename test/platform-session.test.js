const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SafeTokenStore } = require('../src/main/platform-session');

function makeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`cipher:${value}`, 'utf8'),
    decryptString: (value) => {
      const text = Buffer.from(value).toString('utf8');
      if (!text.startsWith('cipher:')) throw new Error('bad ciphertext');
      return text.slice(7);
    }
  };
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'elunvi-mart-platform-'));
}

test('SafeTokenStore starts empty and round-trips only encrypted refresh metadata', () => {
  const dir = tempDir();
  const store = new SafeTokenStore({ userDataPath: dir, safeStorage: makeStorage() });
  assert.equal(store.load(), null);
  store.save({ refreshToken: 'refresh-1', accessExpiresAt: '2026-09-22T01:00:00Z', refreshExpiresAt: '2026-10-22T01:00:00Z' });
  const raw = fs.readFileSync(path.join(dir, 'platform-session.bin'), 'utf8');
  assert.match(raw, /^encrypted:/);
  assert.doesNotMatch(raw, /access-1/);
  assert.deepEqual(store.load(), { refreshToken: 'refresh-1', accessExpiresAt: '2026-09-22T01:00:00Z', refreshExpiresAt: '2026-10-22T01:00:00Z' });
});

test('SafeTokenStore atomically replaces data and clear removes it', () => {
  const dir = tempDir();
  const store = new SafeTokenStore({ userDataPath: dir, safeStorage: makeStorage() });
  store.save({ refreshToken: 'old', accessExpiresAt: '2026-09-22T01:00:00Z', refreshExpiresAt: '2026-10-22T01:00:00Z' });
  store.save({ refreshToken: 'new', accessExpiresAt: '2026-09-22T02:00:00Z', refreshExpiresAt: '2026-10-22T02:00:00Z' });
  assert.equal(store.load().refreshToken, 'new');
  store.clear();
  assert.equal(store.load(), null);
});

test('SafeTokenStore clears malformed or undecryptable files', () => {
  const dir = tempDir();
  const filename = path.join(dir, 'platform-session.bin');
  fs.writeFileSync(filename, 'not-encrypted');
  const store = new SafeTokenStore({ userDataPath: dir, safeStorage: makeStorage() });
  assert.equal(store.load(), null);
  assert.equal(fs.existsSync(filename), false);
  fs.writeFileSync(filename, 'encrypted:bm90LWFjdHVhbA==');
  assert.equal(store.load(), null);
  assert.equal(fs.existsSync(filename), false);
});

test('SafeTokenStore refuses to save when OS encryption is unavailable', () => {
  const dir = tempDir();
  const safeStorage = { isEncryptionAvailable: () => false };
  const store = new SafeTokenStore({ userDataPath: dir, safeStorage });
  assert.throws(() => store.save({ refreshToken: 'x', accessExpiresAt: 'a', refreshExpiresAt: 'b' }), /安全存储/);
});
