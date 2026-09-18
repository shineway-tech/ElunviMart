const test = require('node:test');
const assert = require('node:assert/strict');
const { PddActivityAdapter } = require('../src/main/pdd-adapter');

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

test('PddActivityAdapter fetches every bid-list page with page_size 40', async () => {
  const requests = [];
  const payloads = [
    { success: true, result: { total: 41, result: responseRows(1, 40) } },
    { success: true, result: { total: 41, result: responseRows(41, 1) } }
  ];
  const window = {
    isDestroyed: () => false,
    webContents: { executeJavaScript: async (script) => { requests.push(script); return payloads.shift(); } }
  };
  const adapter = new PddActivityAdapter({ getLoginWindow: () => window });

  const products = await adapter.syncProducts({ id: 'account-1' });

  assert.equal(products.length, 41);
  assert.match(requests[0], /page\\":1/);
  assert.match(requests[0], /page_size\\":40/);
  assert.match(requests[1], /page\\":2/);
});
