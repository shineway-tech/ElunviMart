const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PddActivityAdapter,
  AdapterResponseError,
  BID_LIST_PAGE_SIZE,
  BID_LIST_PATH,
  buildBidListRequest,
  executeBidListRequest,
  mapBidListResponse
} = require('../src/main/pdd-adapter');

const item = id => ({ my_bid_goods_id: String(id), my_bid_goods_name: `商品 ${id}` });
const payload = (total, ids) => ({ success: true, result: { total, result: ids.map(item) } });

test('builds the optimized bid-list request with 40 rows per page', () => {
  assert.equal(BID_LIST_PAGE_SIZE, 40);
  assert.equal(BID_LIST_PATH, '/lakemms/bid/query/bidList');
  assert.deepEqual(buildBidListRequest(3), {
    page_number: 3,
    page_size: 40,
    activity_type_list: [205, 212, 219, 220, 221, 223, 213, 216, 218, 211, 215, 217, 224, 214],
    status_list: [501],
    is_wait_handle_invite_cut_price: false,
    standard_temp_id_list: [],
    activity_sub_type_list: []
  });
});

test('executes the list request in the logged-in page with the captured Anti-Content', async () => {
  let script = '';
  const window = { webContents: { executeJavaScript: async value => { script = value; return payload(0, []); } } };
  const result = await executeBidListRequest(window, buildBidListRequest(1), 'page-token');
  assert.equal(result.result.total, 0);
  assert.match(script, /fetch\("\/lakemms\/bid\/query\/bidList"/);
  assert.match(script, /\\"page_size\\":40/);
  assert.match(script, /"Anti-Content":"page-token"/);
});

function setup(payloads, options = {}) {
  const calls = [];
  let refreshed = 0;
  let token = 'initial-token';
  const window = { isDestroyed: () => false, webContents: {
    executeJavaScript: async script => {
      calls.push(script);
      const next = payloads.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    getURL: () => 'https://mms.pinduoduo.com/act-bidding/market-sign-list'
  } };
  const adapter = new PddActivityAdapter({
    getLoginWindow: () => window,
    getAntiContent: () => token,
    ensureBidPage: async (_id, _window, args = {}) => { if (args.refresh) { refreshed++; token = `token-${refreshed + 1}`; } },
    pageDelayMs: () => 0,
    ...options
  });
  return { adapter, calls, get refreshed() { return refreshed; } };
}

test('collects all pages with 40 rows per request', async () => {
  const firstPage = Array.from({ length: 40 }, (_, index) => index + 1);
  const f = setup([payload(41, firstPage), payload(41, [41])]);
  const products = await f.adapter.syncProducts({ id: 'shop' });
  assert.equal(products.length, 41);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[0], /\\"page_number\\":1/);
  assert.match(f.calls[0], /\\"page_size\\":40/);
  assert.match(f.calls[1], /\\"page_number\\":2/);
});

test('refreshes the page-generated Anti-Content once after 54001', async () => {
  const f = setup([new AdapterResponseError('操作太过频繁', 54001), payload(0, [])]);
  assert.deepEqual(await f.adapter.syncProducts({ id: 'shop' }), []);
  assert.equal(f.refreshed, 1);
  assert.equal(f.calls.length, 2);
});

for (const [name, pages] of [
  ['missing rows', [payload(41, Array.from({ length: 40 }, (_, i) => i + 1)), payload(41, [])]],
  ['duplicate product', [payload(41, Array.from({ length: 40 }, (_, i) => i + 1)), payload(41, [1])]],
  ['changed total', [payload(41, Array.from({ length: 40 }, (_, i) => i + 1)), payload(42, [41, 42])]],
  ['excess rows', [payload(1, [1, 2])]]
]) {
  test(`rejects ${name} without returning a partial snapshot`, async () => {
    const f = setup(pages);
    await assert.rejects(f.adapter.syncProducts({ id: 'shop' }));
  });
}

test('requires a logged-in merchant window and captured Anti-Content', async () => {
  const adapter = new PddActivityAdapter({ getLoginWindow: () => null });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), { code: 'ADAPTER_NOT_CONFIGURED' });
});

test('business errors preserve the API error code', () => {
  assert.throws(() => mapBidListResponse({ error_code: 54001, error_msg: '操作太过频繁' }), { apiCode: 54001 });
});
