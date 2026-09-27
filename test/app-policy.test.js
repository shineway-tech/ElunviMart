const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchPolicy, isBelowMinVersion, versionParts } = require('../src/main/app-policy');

test('version comparison follows numeric order', () => {
  assert.equal(isBelowMinVersion('1.0.0', ''), false, '没配最低版本就不强制');
  assert.equal(isBelowMinVersion('1.0.0', '1.0.0'), false, '等于最低版本不算低');
  assert.equal(isBelowMinVersion('1.0.0', '1.0.1'), true);
  assert.equal(isBelowMinVersion('1.9.9', '1.10.0'), true, '按数字比，不是字符串比');
  assert.equal(isBelowMinVersion('v1.2.3', '1.2.4'), true, '带 v 前缀也能比');
  assert.equal(isBelowMinVersion('garbage', '1.0.0'), false, '版本号异常时不阻断用户');
  assert.deepEqual(versionParts('v2.10.3'), [2, 10, 3]);
  assert.equal(versionParts('nope'), null);
});

test('fetchPolicy reads the backend policy endpoint', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ err_code: 0, data: { min_client_version: ' 1.1.0 ', download_url: 'https://static.honeykid.cn/public/elunvi_mart', note: ' 请更新 ' } })
    };
  };

  const policy = await fetchPolicy({ apiBaseUrl: 'https://elunvi-mart-api.honeykid.cn/', fetchImpl });
  assert.deepEqual(policy, {
    minClientVersion: '1.1.0',
    downloadUrl: 'https://static.honeykid.cn/public/elunvi_mart',
    note: '请更新'
  });
  assert.equal(calls[0].url, 'https://elunvi-mart-api.honeykid.cn/v1/app/policy');

  const failing = await fetchPolicy({ apiBaseUrl: 'https://x', fetchImpl: async () => ({ ok: false }) });
  assert.equal(failing, null, '拿不到策略时不阻断');

  const throwing = await fetchPolicy({ apiBaseUrl: 'https://x', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(throwing, null);
  assert.equal(await fetchPolicy({ apiBaseUrl: '' }), null);
});
