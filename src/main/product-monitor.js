const WATCHED_STATUSES = new Set(['suspected', 'lost']);
const ACTIVITY_STATUS_LABELS = Object.freeze({
  all_sku_win_bid: '全部规格已中标',
  partial_sku_win_bid: '部分规格未中标',
  all_sku_not_win_bid: '全部规格未中标',
  lost: '已掉标',
  unknown: '状态异常'
});

function productKey(product) {
  return String(product.id || '');
}

function normalizeProducts(products, now = new Date().toISOString()) {
  if (!Array.isArray(products)) throw new Error('营销活动商品接口返回的数据格式不正确');

  const seen = new Set();
  return products.map((product) => {
    const id = productKey(product);
    if (!id) throw new Error('营销活动商品缺少商品 ID');
    if (seen.has(id)) throw new Error(`营销活动商品存在重复 ID：${id}`);
    seen.add(id);
    return { ...product, id, updatedAt: product.updatedAt || now };
  });
}

// The activity adapter must return a complete snapshot, not a paginated page.
// A product missing from that snapshot is treated as no longer participating.
function reconcileProducts(previousProducts, incomingProducts, now = new Date().toISOString()) {
  const previous = normalizeProducts(previousProducts, now);
  const incoming = normalizeProducts(incomingProducts, now);
  const previousById = new Map(previous.map((product) => [product.id, product]));
  const incomingIds = new Set(incoming.map((product) => product.id));
  const products = incoming.map((product) => ({ ...previousById.get(product.id), ...product, updatedAt: now }));

  for (const product of previous) {
    if (incomingIds.has(product.id)) continue;
    if (product.status === 'lost') {
      products.push(product);
      continue;
    }
    products.push({ ...product, status: 'lost', lostAt: now, updatedAt: now });
  }

  const changes = products.flatMap((product) => {
    const previousProduct = previousById.get(product.id);
    if (!previousProduct || !WATCHED_STATUSES.has(product.status) || previousProduct.status === product.status) return [];
    return [{ product, previousStatus: previousProduct.status || 'unknown' }];
  });

  return { products, changes };
}

function buildStatusAlert(account, change) {
  const status = change.product.status === 'lost' ? '已掉标' : '疑似掉标';
  const title = `百亿补贴${status}`;
  const body = [
    `店铺：${account.displayName}`,
    `商品：${change.product.name || change.product.id}`,
    `商品 ID：${change.product.id}`,
    `状态：${status}`
  ].join('\n');
  return { title, body };
}

function activityStatusKey(product) {
  if (product?.status === 'lost') return 'lost';
  if (product?.raw?.all_sku_win_bid === true || product?.activityStatus === 'all_sku_win_bid') return 'all_sku_win_bid';
  if (Number(product?.raw?.target_activity_status) === 2 || product?.activityStatus === 'partial_sku_win_bid') return 'partial_sku_win_bid';
  if (Number(product?.raw?.target_activity_status) === 3 || product?.activityStatus === 'all_sku_not_win_bid') return 'all_sku_not_win_bid';
  return 'unknown';
}

function summarizeActivityStatuses(products) {
  const counts = Object.fromEntries(Object.keys(ACTIVITY_STATUS_LABELS).map((key) => [key, 0]));
  for (const product of products) counts[activityStatusKey(product)] += 1;
  return counts;
}

function buildActivitySummaryAlert(account, products) {
  const counts = summarizeActivityStatuses(products);
  const primaryStatusKeys = ['all_sku_win_bid', 'partial_sku_win_bid', 'all_sku_not_win_bid'];
  const lines = primaryStatusKeys.map((key) => `${ACTIVITY_STATUS_LABELS[key]}：${counts[key]}`);
  for (const key of ['lost', 'unknown']) {
    if (counts[key] > 0) lines.push(`${ACTIVITY_STATUS_LABELS[key]}：${counts[key]}`);
  }
  return {
    title: '营销活动商品状态汇总',
    body: [`店铺：${account.displayName}`, `商品总数：${products.length}`, ...lines].join('\n')
  };
}

function buildAccountOfflineAlert(account, reason = '') {
  return {
    title: '拼多多商家账号已掉线',
    body: [
      `店铺：${account.displayName}`,
      '状态：需要重新登录',
      reason ? `原因：${reason}` : '',
      '请重新登录商家后台后恢复自动监控。'
    ].filter(Boolean).join('\n')
  };
}

function isAbnormalActivityProduct(product) {
  return activityStatusKey(product) !== 'all_sku_win_bid';
}

function hasAbnormalActivityProducts(products) {
  return Array.isArray(products) && products.some(isAbnormalActivityProduct);
}

module.exports = {
  normalizeProducts,
  reconcileProducts,
  buildStatusAlert,
  buildActivitySummaryAlert,
  buildAccountOfflineAlert,
  activityStatusKey,
  summarizeActivityStatuses,
  isAbnormalActivityProduct,
  hasAbnormalActivityProducts
};
