const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AdapterResponseError,
  PddActivityAdapter,
  buildBidListRequest,
  mapBidListResponse
} = require('../src/main/pdd-adapter');

function responseRows(start, count) {
  return Array.from({ length: count }, (_, index) => ({
    my_bid_goods_id: start + index,
    my_bid_goods_name: `商品 ${start + index}`,
    activity_id: 24109,
    activity_name: '营销竞价',
    activity_status: 101,
    mall_bid_price: '100000',
    left_activity_quantity: 3,
    enroll_end_time: 1988096400000,
    image_url: '',
    my_bid_goods_url: ''
  }));
}

test('PddActivityAdapter fetches every bid-list page with page_size 10', async () => {
  const requests = [];
  const payloads = [
    { success: true, result: { total: 11, result: responseRows(1, 10) } },
    { success: true, result: { total: 11, result: responseRows(11, 1) } }
  ];
  const window = {
    isDestroyed: () => false,
    webContents: { executeJavaScript: async (script) => { requests.push(script); return payloads.shift(); } }
  };
  const adapter = new PddActivityAdapter({ getLoginWindow: () => window, getAntiContent: () => 'anti-content-test' });

  const products = await adapter.syncProducts({ id: 'account-1' });

  assert.equal(products.length, 11);
  assert.match(requests[0], /page_number\\":1/);
  assert.match(requests[0], /page_size\\":10/);
  assert.match(requests[0], /Anti-Content/);
  assert.match(requests[1], /page_number\\":2/);
});

test('buildBidListRequest matches the merchant page request contract', () => {
  assert.deepEqual(buildBidListRequest(1), {
    page_number: 1,
    page_size: 10,
    activity_type_list: [205, 212, 219, 220, 221, 223, 213, 216, 218, 211, 215, 217, 224, 214],
    status_list: [501],
    is_wait_handle_invite_cut_price: false,
    standard_temp_id_list: [],
    activity_sub_type_list: []
  });
});

test('PddActivityAdapter prepares the merchant page before an unsigned sync', async () => {
  let antiContent = '';
  let ensured = 0;
  const requests = [];
  const window = {
    isDestroyed: () => false,
    webContents: { executeJavaScript: async (script) => {
      requests.push(script);
      return { success: true, error_code: 1000000, error_msg: null, result: { total: 0, result: [] } };
    } }
  };
  const adapter = new PddActivityAdapter({
    getLoginWindow: () => window,
    getAntiContent: () => antiContent,
    ensureBidPage: async () => { ensured += 1; antiContent = 'anti-content-test'; }
  });

  const products = await adapter.syncProducts({ id: 'account-1' });

  assert.deepEqual(products, []);
  assert.equal(ensured, 1);
  assert.match(requests[0], /anti-content-test/);
});

test('PddActivityAdapter refreshes the merchant page once after an expired anti-content response', async () => {
  let antiContent = 'stale-anti-content';
  const ensureOptions = [];
  const payloads = [
    { success: false, error_code: 54001, error_msg: '操作太过频繁，请稍后再试！', result: {} },
    { success: true, error_code: 1000000, error_msg: null, result: { total: 0, result: [] } }
  ];
  const window = {
    isDestroyed: () => false,
    webContents: { executeJavaScript: async () => payloads.shift() }
  };
  const adapter = new PddActivityAdapter({
    getLoginWindow: () => window,
    getAntiContent: () => antiContent,
    ensureBidPage: async (_accountId, _window, options) => {
      ensureOptions.push(options);
      antiContent = 'fresh-anti-content';
    }
  });

  const products = await adapter.syncProducts({ id: 'account-1' });

  assert.deepEqual(products, []);
  assert.deepEqual(ensureOptions, [{ refresh: true }]);
});

test('mapBidListResponse surfaces the API business error code', () => {
  assert.throws(
    () => mapBidListResponse({
      error_code: 54001,
      error_msg: '操作太过频繁，请稍后再试！',
      result: { verifyAuthToken: 'redacted-in-test' }
    }),
    (error) => error instanceof AdapterResponseError
      && error.apiCode === 54001
      && error.message === '操作太过频繁，请稍后再试！'
  );
});

test('a repeated 54001 stops after one refresh', async () => {
  let calls = 0;
  let refreshes = 0;
  const window = { isDestroyed: () => false, webContents: {
    executeJavaScript: async () => {
      calls += 1;
      return { error_code: 54001, error_msg: '操作太过频繁，请稍后再试！' };
    }
  } };
  const adapter = new PddActivityAdapter({
    getLoginWindow: () => window,
    getAntiContent: () => 'test-value',
    ensureBidPage: async () => { refreshes += 1; }
  });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), { apiCode: 54001 });
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test('failed signature refresh does not send an unsigned retry', async () => {
  let signature = 'test-value';
  let calls = 0;
  const window = { isDestroyed: () => false, webContents: {
    executeJavaScript: async () => {
      calls += 1;
      return { error_code: 54001, error_msg: '操作太过频繁，请稍后再试！' };
    }
  } };
  const adapter = new PddActivityAdapter({
    getLoginWindow: () => window,
    getAntiContent: () => signature,
    ensureBidPage: async () => { signature = ''; }
  });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), { code: 'ADAPTER_NOT_CONFIGURED' });
  assert.equal(calls, 1);
});
