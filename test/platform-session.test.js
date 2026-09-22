const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformSession, MemoryTokenStore } = require('../src/main/platform-session');

test('PlatformSession stores tokens and serializes concurrent refreshes', async () => {
  const store = new MemoryTokenStore();
  const session = new PlatformSession({ tokenStore: store });
  await session.save({ accessToken: 'old-access', refreshToken: 'refresh-1' });
  await session.saveAccountEmail('person@example.com');

  let refreshCount = 0;
  const refresh = () => {
    refreshCount += 1;
    return new Promise((resolve) => setTimeout(() => resolve({
      accessToken: 'new-access', refreshToken: 'refresh-2'
    }), 5));
  };

  const [first, second] = await Promise.all([
    session.refresh(refresh),
    session.refresh(refresh)
  ]);

  assert.equal(refreshCount, 1);
  assert.equal(first.accessToken, 'new-access');
  assert.equal(second.refreshToken, 'refresh-2');
  assert.equal((await session.tokens()).accessToken, 'new-access');
  assert.equal(await session.accountEmail(), 'person@example.com');
});

test('PlatformSession clear removes persisted credentials', async () => {
  const store = new MemoryTokenStore({ accessToken: 'a', refreshToken: 'r' });
  const session = new PlatformSession({ tokenStore: store });
  await session.clear();
  assert.equal(await session.tokens(), null);
});

test('PlatformSession keeps the authenticated email with encrypted credentials', async () => {
  const store = new MemoryTokenStore({ accessToken: 'a', refreshToken: 'r' });
  const session = new PlatformSession({ tokenStore: store });
  await session.saveAccountEmail('person@example.com');
  assert.equal(await session.accountEmail(), 'person@example.com');
  assert.equal((await session.tokens()).accessToken, 'a');
});
