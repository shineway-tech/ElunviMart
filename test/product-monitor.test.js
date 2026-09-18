const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reconcileProducts,
  buildStatusAlert,
  buildActivitySummaryAlert,
  buildAccountOfflineAlert,
  isAbnormalActivityProduct,
  hasAbnormalActivityProducts
} = require('../src/main/product-monitor');
const { buildBidListRequest, mapActivityStatus, mapBidListResponse } = require('../src/main/pdd-adapter');

test('buildBidListRequest uses the bid list pagination contract', () => {
  assert.deepEqual(buildBidListRequest(), {
    page_number: 1,
    page_size: 10,
    activity_type_list: [205, 212, 219, 220, 221, 223, 213, 216, 218, 211, 215, 217, 224, 214],
    status_list: [501],
    is_wait_handle_invite_cut_price: false,
    standard_temp_id_list: [],
    activity_sub_type_list: []
  });
});

test('mapBidListResponse maps bid registrations into monitor products', () => {
  const result = mapBidListResponse({
    success: true,
    result: {
      total: 1,
      result: [{
        activity_id: 24109,
        activity_name: '小米混合补贴竞价',
        activity_status: 101,
        activity_type: 205,
        enroll_end_time: 1988096400000,
        template_goods_name: '小米平板 RedmiPad 2',
        image_url: 'https://img.example/template.jpg',
        bid_goods_id: 1005058300239,
        my_bid_goods_id: 1005058300239,
        my_bid_goods_name: '小米红米平板',
        my_bid_goods_url: 'https://img.example/product.jpg',
        mall_bid_price: '132000-175900',
        left_activity_quantity: 11,
        enroll_time: 1789552007995,
        bid_audit_status: 2,
        all_sku_win_bid: false,
        target_activity_status: 2
      }]
    }
  });

  assert.deepEqual(result, [{
    id: '1005058300239',
    name: '小米红米平板',
    myBidProductName: '小米红米平板',
    myBidProductId: '1005058300239',
    activityId: '24109',
    activityName: '小米混合补贴竞价',
    activityProductName: '小米平板 RedmiPad 2',
    activityPrice: '132000-175900',
    activityStock: 11,
    endsAt: '2032-12-31T09:00:00.000Z',
    enrolledAt: '2026-09-16T09:46:47.995Z',
    imageUrl: 'https://img.example/product.jpg',
    templateImageUrl: 'https://img.example/template.jpg',
    activityStatus: 'partial_sku_win_bid',
    status: 'active',
    source: 'pdd-bid-list',
    raw: {
      activity_id: 24109,
      activity_name: '小米混合补贴竞价',
      activity_status: 101,
      activity_type: 205,
      enroll_end_time: 1988096400000,
      template_goods_name: '小米平板 RedmiPad 2',
      image_url: 'https://img.example/template.jpg',
      bid_goods_id: 1005058300239,
      my_bid_goods_id: 1005058300239,
      my_bid_goods_name: '小米红米平板',
      my_bid_goods_url: 'https://img.example/product.jpg',
      mall_bid_price: '132000-175900',
      left_activity_quantity: 11,
      enroll_time: 1789552007995,
      bid_audit_status: 2,
      all_sku_win_bid: false,
      target_activity_status: 2
    }
  }]);
});

test('mapActivityStatus matches the merchant page labels', () => {
  assert.equal(mapActivityStatus({ all_sku_win_bid: true, is_unqualified: true }), 'all_sku_win_bid');
  assert.equal(mapActivityStatus({ all_sku_win_bid: false, target_activity_status: 2 }), 'partial_sku_win_bid');
  assert.equal(mapActivityStatus({ all_sku_win_bid: false, target_activity_status: 3 }), 'all_sku_not_win_bid');
  assert.equal(mapActivityStatus({ all_sku_win_bid: false }), 'unknown');
});

test('mapBidListResponse accepts an empty complete snapshot', () => {
  assert.deepEqual(mapBidListResponse({ success: true, result: { total: 0, result: [] } }), []);
});

test('reconcileProducts marks a missing product as lost and reports one change', () => {
  const now = '2026-09-17T01:02:03.000Z';
  const result = reconcileProducts([
    { id: 'a', name: '仍在活动', status: 'active' },
    { id: 'b', name: '已离开活动', status: 'active' }
  ], [{ id: 'a', name: '仍在活动', status: 'active' }], now);
  assert.equal(result.products.find((item) => item.id === 'b').status, 'lost');
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].product.id, 'b');
});

test('reconcileProducts keeps a previously lost product in the local history', () => {
  const first = reconcileProducts([{ id: 'b', name: '已离开活动', status: 'active' }], []);
  const second = reconcileProducts(first.products, []);
  assert.equal(second.products.length, 1);
  assert.equal(second.products[0].status, 'lost');
  assert.equal(second.changes.length, 0);
});

test('reconcileProducts does not alert for a first snapshot', () => {
  const result = reconcileProducts([], [{ id: 'a', name: '新商品', status: 'lost' }]);
  assert.equal(result.changes.length, 0);
});

test('buildStatusAlert includes the shop and product identifiers', () => {
  const message = buildStatusAlert({ displayName: '测试店铺' }, { product: { id: '123', name: '测试商品', status: 'lost' } });
  assert.match(message.title, /已掉标/);
  assert.match(message.body, /测试店铺/);
  assert.match(message.body, /商品 ID：123/);
});

test('isAbnormalActivityProduct matches the all-sku-win rule', () => {
  assert.equal(isAbnormalActivityProduct({ activityStatus: 'all_sku_win_bid', status: 'active' }), false);
  assert.equal(isAbnormalActivityProduct({ raw: { all_sku_win_bid: true }, activityStatus: 'unknown', status: 'active' }), false);
  assert.equal(isAbnormalActivityProduct({ activityStatus: 'partial_sku_win_bid', status: 'active' }), true);
  assert.equal(isAbnormalActivityProduct({ activityStatus: 'all_sku_win_bid', status: 'lost' }), true);
  assert.equal(hasAbnormalActivityProducts([{ activityStatus: 'all_sku_win_bid', status: 'active' }]), false);
  assert.equal(hasAbnormalActivityProducts([{ activityStatus: 'partial_sku_win_bid', status: 'active' }]), true);
});

test('activity summary and offline alerts include the shop and status counts', () => {
  const summary = buildActivitySummaryAlert({ displayName: '测试店铺' }, [
    { activityStatus: 'all_sku_win_bid', status: 'active' },
    { activityStatus: 'partial_sku_win_bid', status: 'active' },
    { activityStatus: 'all_sku_not_win_bid', status: 'active' }
  ]);
  assert.match(summary.title, /状态汇总/);
  assert.match(summary.body, /测试店铺/);
  assert.match(summary.body, /全部规格已中标：1/);
  assert.match(summary.body, /部分规格未中标：1/);
  assert.match(summary.body, /全部规格未中标：1/);

  const offline = buildAccountOfflineAlert({ displayName: '测试店铺' });
  assert.match(offline.title, /掉线/);
  assert.match(offline.body, /重新登录/);
});
