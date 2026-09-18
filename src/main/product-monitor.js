const WATCHED_STATUSES = new Set(['suspected', 'lost']);

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

module.exports = { normalizeProducts, reconcileProducts, buildStatusAlert };
