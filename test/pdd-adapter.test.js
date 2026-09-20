const test = require('node:test');
const assert = require('node:assert/strict');
const { PddActivityAdapter, AdapterResponseError, mapBidListResponse } = require('../src/main/pdd-adapter');
const rows = (start, count) => Array.from({ length: count }, (_, i) => ({ id: String(start + i), status: 'active' }));
const result = (page, total, products) => ({ page, total, products, query: { page_number: page, page_size: 10, status_list: [501] } });
function setup(pages, options = {}) {
  const actions = [];
  let closed = 0;
  const sessions = {
    readPage: async (id, args) => {
      actions.push([id, args.page]);
      const value = pages.shift();
      if (value instanceof Error) throw value;
      return value;
    },
    close: () => { closed++; }
  };
  const adapter = new PddActivityAdapter({ sessions, pageDelayMs: () => 0, ...options });
  return { adapter, actions, get closed() { return closed; } };
}
test('collects a complete three-page snapshot through page actions', async () => {
  const f = setup([result(1, 21, rows(1, 10)), result(2, 21, rows(11, 10)), result(3, 21, rows(21, 1))]);
  const products = await f.adapter.syncProducts({ id: 'shop' });
  assert.equal(products.length, 21);
  assert.deepEqual(f.actions, [['shop', 1], ['shop', 2], ['shop', 3]]);
});
test('each sync starts with a fresh page action, never reuses last snapshot', async () => {
  const f = setup([result(1, 0, []), result(1, 1, rows(99, 1))]);
  assert.deepEqual(await f.adapter.syncProducts({ id: 'shop' }), []);
  assert.equal((await f.adapter.syncProducts({ id: 'shop' }))[0].id, '99');
});
for (const [name, pages, opts] of [
  ['missing page', [result(1, 11, rows(1, 10)), result(2, 11, [])], {}],
  ['duplicate product', [result(1, 11, rows(1, 10)), result(2, 11, rows(1, 1))], {}],
  ['changed total', [result(1, 11, rows(1, 10)), result(2, 12, rows(11, 2))], {}],
  ['wrong page', [result(1, 11, rows(1, 10)), result(3, 11, rows(11, 1))], {}],
  ['excess rows', [result(1, 1, rows(1, 2))], {}],
  ['page budget', [result(1, 21, rows(1, 10))], { maxPages: 2 }],
  ['product budget', [result(1, 21, rows(1, 10))], { maxProducts: 20 }],
  ['timeout', [new Error('等待响应超时')], {}]
]) {
  test(`rejects ${name}, closes session and never returns a partial snapshot`, async () => {
    const f = setup(pages, opts);
    await assert.rejects(f.adapter.syncProducts({ id: 'shop' }));
    assert.equal(f.closed, 1);
    if (name.includes('budget')) assert.equal(f.actions.length, 1);
  });
}
test('54001 is propagated without any refresh or immediate retry', async () => {
  const f = setup([new AdapterResponseError('操作太过频繁', 54001)]);
  await assert.rejects(f.adapter.syncProducts({ id: 'shop' }), { apiCode: 54001 });
  assert.equal(f.actions.length, 1);
});
test('business errors preserve the API error code', () => {
  assert.throws(() => mapBidListResponse({ error_code: 54001, error_msg: '操作太过频繁' }), { apiCode: 54001 });
});
