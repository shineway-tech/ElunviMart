const test = require('node:test');
const assert = require('node:assert/strict');
const { MIN_STEP_MS, buildDetailReportHtml, detailIdsOf, diffDetailRows, isFullyWon, selectDetailCandidates, sweepStepMs } = require('../src/main/detail-monitor');

const productWithIds = (id, activityStatus = 'partial_sku_win_bid') => ({
  id: String(id),
  activityStatus,
  raw: { activity_id: '1', activity_goods_id: '2', bid_goods_id: '3', template_goods_pk_id: '4', activity_type: 205 }
});

test('reads the detail ids from the stored raw product', () => {
  assert.deepEqual(detailIdsOf(productWithIds('7')), { activityId: '1', activityGoodsId: '2', goodsId: '3', templateGoodsPkId: '4', activityType: 205 });
  assert.equal(detailIdsOf({ id: 'x', raw: {} }), null);
});

test('skips products whose every sku already wins', () => {
  const rows = [{ templateSkuId: 'a', winStatus: '曝光中' }, { templateSkuId: 'b', winStatus: '曝光中' }];
  assert.equal(isFullyWon(productWithIds('1', 'all_sku_win_bid'), rows), true);
  assert.equal(isFullyWon(productWithIds('1', 'all_sku_win_bid'), null), true);
  assert.equal(isFullyWon(productWithIds('1', 'all_sku_win_bid'), [{ templateSkuId: 'a', winStatus: '等待曝光中' }]), false);
  assert.equal(isFullyWon(productWithIds('1', 'partial_sku_win_bid'), rows), false);
});

test('diffs sku win status against the previous snapshot', () => {
  const previous = [{ templateSkuId: 'a', referenceSpec: '规格A', winStatus: '等待曝光中' }, { templateSkuId: 'b', referenceSpec: '规格B', winStatus: '曝光中' }];
  const rows = [{ templateSkuId: 'a', referenceSpec: '规格A', winStatus: '曝光中' }, { templateSkuId: 'b', referenceSpec: '规格B', winStatus: '曝光中' }, { templateSkuId: 'c', referenceSpec: '规格C', winStatus: '暂无选标资格' }];
  const changes = diffDetailRows(previous, rows, '2026-09-29T00:00:00.000Z');
  assert.deepEqual(changes, [{ scope: 'sku', target: '规格A', from: '等待曝光中', to: '曝光中', changedAt: '2026-09-29T00:00:00.000Z' }]);
  assert.deepEqual(diffDetailRows(null, rows), [], '第一次抓取不算变化');
});

test('batch size 0 means "cover every due product this round"', () => {
  const products = [productWithIds(1), productWithIds(2), productWithIds(3)];
  const picked = selectDetailCandidates({ products, detailByProductId: {}, intervalMs: 30 * 60_000, batchSize: 0, now: Date.now() });
  assert.deepEqual(picked.map((p) => p.id), ['1', '2', '3']);
});

test('picks due candidates oldest-first and honours the batch size', () => {
  const products = [productWithIds(1), productWithIds(2, 'all_sku_win_bid'), productWithIds(3), productWithIds(4)];
  const now = Date.parse('2026-09-29T12:00:00.000Z');
  const detailByProductId = {
    1: { rows: [{ templateSkuId: 'a', winStatus: '曝光中' }], fetchedAt: '2026-09-29T11:00:00.000Z' },
    3: { rows: [{ templateSkuId: 'a', winStatus: '曝光中' }], fetchedAt: '2026-09-29T10:00:00.000Z' }
  };
  const picked = selectDetailCandidates({ products, detailByProductId, intervalMs: 30 * 60_000, batchSize: 1, now });
  assert.deepEqual(picked.map((p) => p.id), ['4'], '从没抓过的最先，全中标的跳过');
  const all = selectDetailCandidates({ products, detailByProductId, intervalMs: 30 * 60_000, batchSize: 10, now });
  assert.deepEqual(all.map((p) => p.id), ['4', '3', '1'], '最久没抓的优先');
});

test('spreads half the cycle over the batch with jitter and a floor', () => {
  // 34 个商品、45 分钟周期 → 22.5 分钟预算 ÷ 34 ≈ 40 秒/个
  assert.equal(sweepStepMs({ batchSize: 34, cycleMinutes: 45, random: () => 0.5 }), 39_706);
  // 单个商品时：15 分钟的一半 × 1.5 抖动 = 11.25 分钟
  assert.equal(sweepStepMs({ batchSize: 1, cycleMinutes: 15, random: () => 1 }), 675_000);
  assert.equal(sweepStepMs({ batchSize: 100, cycleMinutes: 5, random: () => 0 }), MIN_STEP_MS);
});

test('report groups changes by product and keeps the images', () => {
  const changes = [
    { productId: '1', productName: '商品A', productCode: '1001', activityName: '竞价A', activityId: '24110', productImage: 'https://img/a.jpeg', target: '规格一', from: '等待曝光中', to: '曝光中', skuImage: 'https://img/sku1.jpeg' },
    { productId: '1', productName: '商品A', target: '规格二', from: '曝光中', to: '暂无选标资格', skuImage: 'https://img/sku2.jpeg' },
    { productId: '2', productName: '商品B', target: '规格三', from: '曝光中', to: '等待曝光中' }
  ];
  const html = buildDetailReportHtml({ displayName: '测试店铺', mallId: '349630343' }, changes, '2026-09-29T14:00:00.000Z');
  assert.match(html, /<img class="product-img" src="https:\/\/img\/a\.jpeg"/);
  assert.match(html, /<img class="sku-img" src="https:\/\/img\/sku1\.jpeg"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /共 3 项变化 · 2 个商品/);
  assert.match(html, /商品 ID 1001/);
  assert.equal((html.match(/<details class="product"/g) || []).length, 2, '同一个商品的变化归到一张可折叠卡片');
  // 可折叠 + 手机适配
  assert.match(html, /<summary>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /@media \(max-width:560px\)/);
  assert.match(html, /data-label="原状态"/);
  assert.match(html, /id="toggle"/);
  assert.match(html, /window\.innerWidth < 600/);
  const plain = buildDetailReportHtml({ displayName: '店铺' }, [{ productId: '9', productName: '无图商品', target: '规格', from: 'A', to: 'B' }], '2026-09-29T14:00:00.000Z');
  assert.doesNotMatch(plain, /<img/, '没有图片时不渲染 img');
});
