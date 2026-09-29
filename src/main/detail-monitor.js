const MIN_STEP_MS = 20_000;
// 巡检只占周期的一半时间，保证一轮能在下一轮开始前跑完（否则下一轮会被防重入跳过）
const SWEEP_CYCLE_SHARE = 0.5;

function detailIdsOf(product) {
  const raw = product?.raw || {};
  const ids = {
    activityId: raw.activity_id,
    activityGoodsId: raw.activity_goods_id,
    goodsId: raw.bid_goods_id ?? raw.my_bid_goods_id,
    templateGoodsPkId: raw.template_goods_pk_id,
    activityType: raw.activity_type
  };
  return ids.activityGoodsId && ids.goodsId ? ids : null;
}

// 商品级"全部规格已中标"（且明细里每条都是曝光中）就没必要再抓了
function isFullyWon(product, rows) {
  if (String(product?.activityStatus || '') !== 'all_sku_win_bid') return false;
  if (!Array.isArray(rows) || !rows.length) return true;
  return rows.every((row) => row.winStatus === '曝光中');
}

// 与上一份 SKU 快照对比，只报"中标状态"的变化（新增规格不算变化，避免刷屏）
function diffDetailRows(previousRows, rows, changedAt = new Date().toISOString()) {
  const previous = new Map();
  for (const row of Array.isArray(previousRows) ? previousRows : []) {
    previous.set(String(row.templateSkuId || row.referenceSpec || ''), row);
  }
  const changes = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row.templateSkuId || row.referenceSpec || '');
    const before = previous.get(key);
    if (!before || before.winStatus === row.winStatus) continue;
    changes.push({
      scope: 'sku',
      target: String(row.referenceSpec || row.bidSpec || ''),
      from: String(before.winStatus || ''),
      to: String(row.winStatus || ''),
      changedAt
    });
  }
  return changes;
}

// 本轮要抓哪些商品：有报名 ID、不是全中标、距上次抓取超过 intervalMs，最久没抓的优先
function selectDetailCandidates({ products, detailByProductId, intervalMs, batchSize, now = Date.now() }) {
  const stage = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    if (!detailIdsOf(product)) continue;
    const key = String(product.id);
    stage.set(key, detailByProductId?.[key] || null);
  }
  const candidates = [];
  for (const product of Array.isArray(products) ? products : []) {
    const key = String(product.id);
    if (!stage.has(key)) continue;
    const detail = stage.get(key) || null;
    if (isFullyWon(product, detail?.rows)) continue;
    const fetchedAt = detail ? Date.parse(detail.fetchedAt) : 0;
    const safeFetchedAt = Number.isFinite(fetchedAt) ? fetchedAt : 0;
    if (now - safeFetchedAt < intervalMs) continue;
    candidates.push({ product, fetchedAt: safeFetchedAt });
  }
  candidates.sort((a, b) => a.fetchedAt - b.fetchedAt);
  // batchSize <= 0 表示"不限量"：每轮把所有到期的商品都覆盖一遍
  const requested = Number(batchSize);
  const limit = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : candidates.length;
  return candidates.slice(0, Math.max(1, limit)).map((entry) => entry.product);
}

// 把"本轮可用时长"平摊到每个商品上，取随机间隔（0.5~1.5 倍），并设下限避免过于密集
function sweepStepMs({ batchSize, cycleMinutes, random = Math.random }) {
  const count = Math.max(1, Number(batchSize) || 1);
  const budgetMs = Math.max(60_000, (Number(cycleMinutes) || 15) * SWEEP_CYCLE_SHARE * 60_000);
  const base = budgetMs / count;
  const jitter = 0.5 + Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.max(MIN_STEP_MS, Math.round(base * jitter));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function imageTag(url, className) {
  const src = String(url || '').trim();
  if (!src) return '';
  return `<img class="${className}" src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer">`;
}

// 报告按商品分组：每个商品一张可折叠卡片（商品图 + 名称 + 活动信息），窄屏自动改成竖排卡片
function buildDetailReportHtml(account, changes, roundAt) {
  const list = Array.isArray(changes) ? changes : [];
  const groups = new Map();
  for (const change of list) {
    const key = String(change.productId || change.productName || '');
    if (!groups.has(key)) {
      groups.set(key, {
        productName: change.productName || key,
        productCode: change.productCode || '',
        activityName: change.activityName || '',
        activityId: change.activityId || '',
        productImage: change.productImage || '',
        items: []
      });
    }
    groups.get(key).items.push(change);
  }
  const sections = [...groups.values()].map((group) => {
    const rows = group.items.map((item) => `<tr>
<td class="sku">${imageTag(item.skuImage, 'sku-img')}<span class="spec">${escapeHtml(item.target || '规格')}</span></td>
<td class="from" data-label="原状态">${escapeHtml(item.from || '未知')}</td>
<td class="to" data-label="现状态">${escapeHtml(item.to || '未知')}</td>
</tr>`).join('');
    const meta = [
      group.activityName ? `活动：${escapeHtml(group.activityName)}` : '',
      group.activityId ? `活动 ID ${escapeHtml(group.activityId)}` : '',
      group.productCode ? `商品 ID ${escapeHtml(group.productCode)}` : ''
    ].filter(Boolean).join(' · ');
    return `<details class="product" open>
<summary>
${imageTag(group.productImage, 'product-img')}
<span class="product-main"><span class="product-name">${escapeHtml(group.productName)}</span><span class="product-meta">${meta}</span></span>
<span class="count">${group.items.length} 项</span>
<span class="chev" aria-hidden="true"></span>
</summary>
<div class="table-wrap"><table><thead><tr><th>规格</th><th>原状态</th><th>现状态</th></tr></thead><tbody>${rows}</tbody></table></div>
</details>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>拼多多中标变化 · ${escapeHtml(account.displayName)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:18px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#202124;background:#f4f5f7;-webkit-text-size-adjust:100%}
h1{margin:0 0 4px;font-size:17px;line-height:1.4}
p.meta{margin:0 0 12px;color:#70757c;font-size:12px;line-height:1.5}
.bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;color:#70757c;font-size:12px}
.bar button{min-height:30px;padding:4px 10px;border:1px solid #e1e4e8;border-radius:6px;color:#202124;background:#fff;font:inherit;font-size:12px;cursor:pointer}
details.product{margin-bottom:10px;border:1px solid #e1e4e8;border-radius:8px;background:#fff;overflow:hidden}
details.product summary{display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer;list-style:none}
details.product summary::-webkit-details-marker{display:none}
details.product[open] summary{border-bottom:1px solid #e1e4e8}
.product-img{width:42px;height:42px;flex:0 0 auto;border-radius:7px;object-fit:cover;background:#f7f8fa}
.product-main{min-width:0;flex:1;display:block}
.product-name{display:block;font-size:13px;font-weight:500;line-height:1.45;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.product-meta{display:block;margin-top:3px;color:#70757c;font-size:12px;line-height:1.5;word-break:break-word}
.count{flex:0 0 auto;padding:3px 8px;border-radius:5px;color:#d93025;background:#fff0ee;font-size:12px;white-space:nowrap}
.chev{flex:0 0 auto;width:8px;height:8px;border-right:1.6px solid #b9bec6;border-bottom:1.6px solid #b9bec6;transform:rotate(-45deg);transition:transform .15s}
details.product[open] .chev{transform:rotate(45deg)}
table{width:100%;border-collapse:collapse}
th,td{padding:9px 12px;border-bottom:1px solid #e1e4e8;font-size:13px;text-align:left;vertical-align:top}
th{background:#f7f8fa;color:#70757c;font-weight:500;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td.sku{display:flex;align-items:center;gap:8px}
.sku-img{width:28px;height:28px;flex:0 0 auto;border-radius:5px;object-fit:cover;background:#f7f8fa}
td.from{color:#70757c;white-space:nowrap}
td.to{color:#202124}
@media (max-width:560px){
  body{padding:12px}
  h1{font-size:16px}
  .product-name{-webkit-line-clamp:4}
  .product-meta{font-size:11.5px}
  thead{display:none}
  table,tbody,tr,td{display:block;width:auto}
  tr{padding:10px 12px;border-bottom:1px solid #e1e4e8}
  tbody tr:last-child{border-bottom:0}
  td{padding:0;border:0}
  td.from,td.to{margin-top:5px;font-size:12px}
  td.from:before,td.to:before{content:attr(data-label) "：";color:#70757c}
  td.to{font-weight:500}
}
</style></head>
<body><h1>拼多多中标变化 · ${escapeHtml(account.displayName)}</h1>
<p class="meta">店铺 ID ${escapeHtml(account.mallId || '-')} · 检测时间 ${escapeHtml(new Date(roundAt).toLocaleString('zh-CN', { hour12: false }))}</p>
<div class="bar"><span>共 ${list.length} 项变化 · ${groups.size} 个商品</span><button id="toggle" type="button">全部折叠</button></div>
${sections}
<script>
(function(){
  var items = document.querySelectorAll('details.product');
  var button = document.getElementById('toggle');
  function sync(){
    var allOpen = Array.prototype.every.call(items, function(item){ return item.open; });
    button.textContent = allOpen ? '全部折叠' : '全部展开';
  }
  // 手机上默认折叠，先看商品列表再按需展开
  if (window.innerWidth < 600) Array.prototype.forEach.call(items, function(item){ item.open = false; });
  button.addEventListener('click', function(){
    var allOpen = Array.prototype.every.call(items, function(item){ return item.open; });
    Array.prototype.forEach.call(items, function(item){ item.open = !allOpen; });
    sync();
  });
  Array.prototype.forEach.call(items, function(item){ item.addEventListener('toggle', sync); });
  sync();
})();
</script></body></html>`;
}

module.exports = { MIN_STEP_MS, SWEEP_CYCLE_SHARE, buildDetailReportHtml, detailIdsOf, escapeHtml, diffDetailRows, isFullyWon, selectDetailCandidates, sweepStepMs };
