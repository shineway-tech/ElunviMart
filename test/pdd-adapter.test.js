const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AdapterNotConfiguredError,
  AdapterResponseError,
  PddActivityAdapter,
  isMerchantLoginUrl,
  mapBidListResponse,
  randomPageDelayMs,
  validateTotal
} = require('../src/main/pdd-adapter');

const item = id => ({ my_bid_goods_id: String(id), my_bid_goods_name: `商品 ${id}` });
const payload = (total, ids) => ({ success: true, result: { total, result: ids.map(item) } });

function adapterWith(payloads, extra = {}) {
  return new PddActivityAdapter({
    collectPayloads: async () => ({ payloads, finalUrl: 'https://mms.pinduoduo.com/act-bidding/market-sign-list' }),
    pageDelayMs: () => 0,
    ...extra
  });
}

test('maps a captured bid list payload into products', () => {
  const [product] = mapBidListResponse(payload(1, [42]));
  assert.equal(product.id, '42');
  assert.equal(product.name, '商品 42');
  assert.equal(product.activityStatus, 'unknown');
  assert.equal(product.source, 'pdd-bid-list');
  assert.equal(validateTotal(payload(7, [])), 7);
});

test('keeps page delay inside the conservative 2-4 second range', () => {
  assert.equal(randomPageDelayMs(() => 0), 2_000);
  assert.equal(randomPageDelayMs(() => 1), 4_000);
});

test('collects every captured page into one product list', async () => {
  const adapter = adapterWith([payload(3, [1, 2]), payload(3, [3])]);
  assert.deepEqual((await adapter.syncProducts({ id: 'shop' })).map(p => p.id), ['1', '2', '3']);
});

test('keeps the cache when the captured pages do not add up', async () => {
  const adapter = adapterWith([payload(5, [1, 2])]);
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), /列表不完整|保留原有数据/);
});

test('rejects duplicate products across pages', async () => {
  const adapter = adapterWith([payload(3, [1, 2]), payload(3, [2, 3])]);
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), /数据有点异常|保留原有数据/);
});

test('requires a merchant login when no list payload arrives', async () => {
  const adapter = new PddActivityAdapter({
    collectPayloads: async () => ({ payloads: [], finalUrl: 'https://mms.pinduoduo.com/login/?redirectUrl=x' }),
    pageDelayMs: () => 0
  });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), (error) => {
    assert.equal(error instanceof AdapterNotConfiguredError, true);
    assert.equal(error.accountOffline, true);
    return true;
  });
});

test('keeps the account online when the list page simply had no data', async () => {
  const adapter = new PddActivityAdapter({
    collectPayloads: async () => ({ payloads: [], finalUrl: 'https://mms.pinduoduo.com/act-bidding/market-sign-list?activity_status=IN_PROGRESS' }),
    pageDelayMs: () => 0
  });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), (error) => {
    assert.equal(error.accountOffline, false);
    return true;
  });
});

test('aborts when the page never produces a list', async () => {
  const adapter = new PddActivityAdapter({
    collectPayloads: () => new Promise(() => {}),
    syncTimeoutMs: 20,
    pageDelayMs: () => 0
  });
  await assert.rejects(adapter.syncProducts({ id: 'shop' }), (error) => /abort/i.test(`${error.name} ${error.message}`));
});

test('business errors preserve the API error code', () => {
  assert.throws(() => mapBidListResponse({ error_code: 54001, error_msg: '操作太过频繁' }), { apiCode: 54001 });
});

test('detects a merchant window bounced to the login page', () => {
  assert.equal(isMerchantLoginUrl('https://mms.pinduoduo.com/login/?redirectUrl=https%3A%2F%2Fmms.pinduoduo.com%2Fhome%2F'), true);
  assert.equal(isMerchantLoginUrl('https://mms.pinduoduo.com/act-bidding/market-sign-list?activity_status=ALL'), false);
  assert.equal(isMerchantLoginUrl(''), false);
});

test('maps the activity status from the merchant payload', () => {
  assert.equal(mapBidListResponse({ success: true, result: { total: 1, result: [{ my_bid_goods_id: '1', all_sku_win_bid: true }] } })[0].activityStatus, 'all_sku_win_bid');
  assert.equal(mapBidListResponse({ success: true, result: { total: 1, result: [{ my_bid_goods_id: '1', target_activity_status: 3 }] } })[0].activityStatus, 'all_sku_not_win_bid');
});

test('reports an invalid total instead of caching a half list', () => {
  assert.throws(() => validateTotal({ result: { total: 'abc' } }), AdapterResponseError);
});
