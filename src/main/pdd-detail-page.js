const { BrowserWindow } = require('electron');
const syncLog = require('./sync-log');
const { setTimeout: delay } = require('node:timers/promises');

const DETAIL_PAGE_BASE = 'https://mms.pinduoduo.com/act-bidding/ten-billion-bid-detail';

// 与商家后台「查看报名详情」同一个页面，参数就是列表接口里带的那几个 id
function buildDetailUrl(ids = {}) {
  const params = new URLSearchParams({
    id: String(ids.activityId || ''),
    enrollId: String(ids.activityGoodsId || ''),
    bidGoodsId: String(ids.templateGoodsPkId || ''),
    goodsId: String(ids.goodsId || ''),
    bannerType: String(ids.activityType || '')
  });
  return `${DETAIL_PAGE_BASE}?${params.toString()}`;
}

// 页面里自己会带签名请求接口，我们只按表头把规格表抓成二维数组
const SCRAPE_SCRIPT = `(() => {
  const wanted = ['参考商品规格', '竞价商品规格', '线上库存', '拼单价', '参考价', '报名商品报名价', '中标状态'];
  const norm = (value) => String(value || '').replace(/\\u00a0/g, ' ').trim();
  for (const table of document.querySelectorAll('table')) {
    const headers = [...table.querySelectorAll('thead th')].map((th) => norm(th.innerText));
    const matched = wanted.filter((name) => headers.some((header) => header.includes(name)));
    if (matched.length < wanted.length - 1) continue;
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => ({
      lines: td.innerText.split('\\n').map(norm).filter(Boolean),
      image: String(td.querySelector('img')?.getAttribute('src') || '').trim()
    })));
    if (!rows.length) continue;
    return { headers, rows };
  }
  return null;
})()`;

const TAGS = new Set(['选报规格', '必报规格', '终止竞标', '已有其余商品提报']);

function specText(lines) {
  const kept = (Array.isArray(lines) ? lines : []).filter((line) => !TAGS.has(line));
  return kept.join(' ').trim();
}

function cellText(cell) {
  if (!cell) return '';
  if (Array.isArray(cell)) return cell.join(' ').trim();
  const lines = Array.isArray(cell.lines) ? cell.lines : [];
  return lines.join(' ').trim();
}

function cellImage(cell) {
  return cell && typeof cell === 'object' && typeof cell.image === 'string' ? cell.image.trim() : '';
}

function cellAt(cells, indexes, name) {
  const index = indexes[name];
  return index === undefined ? '' : cellText(cells[index]);
}

// headers 里的列顺序可能变，按名字定位、缺列就留空
function parseDetailTable(table) {
  if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return [];
  const indexes = {};
  for (const [index, header] of table.headers.entries()) {
    if (header.includes('参考商品规格')) indexes.referenceSpec = index;
    else if (header.includes('竞价商品规格')) indexes.bidSpec = index;
    else if (header.includes('线上库存')) indexes.stock = index;
    else if (header.includes('拼单价')) indexes.groupPrice = index;
    else if (header.includes('参考价')) indexes.referencePrice = index;
    else if (header.includes('报名商品报名价')) indexes.bidPrice = index;
    else if (header.includes('中标状态')) indexes.winStatus = index;
  }
  return table.rows.map((cells) => {
    const referenceCell = indexes.referenceSpec === undefined ? null : cells[indexes.referenceSpec];
    const referenceLines = Array.isArray(referenceCell?.lines) ? referenceCell.lines : (Array.isArray(referenceCell) ? referenceCell : []);
    return {
      referenceSpec: specText(referenceLines),
      referenceImage: cellImage(referenceCell),
      bidSpec: cellAt(cells, indexes, 'bidSpec'),
      bidImage: cellImage(indexes.bidSpec === undefined ? null : cells[indexes.bidSpec]),
      stock: cellAt(cells, indexes, 'stock'),
      groupPrice: cellAt(cells, indexes, 'groupPrice'),
      referencePrice: cellAt(cells, indexes, 'referencePrice'),
      bidPrice: cellAt(cells, indexes, 'bidPrice'),
      winStatus: cellAt(cells, indexes, 'winStatus')
    };
  });
}

// 登录失效时拼多多会把页面跳到登录页：URL 或页面文案（扫码登录/账号登录）都能认出来
const LOGIN_URL_PATTERN = /mms\.pinduoduo\.com\/login/i;
const LOGIN_TEXT_PATTERN = /扫码登录|账号登录|请先登录|还没有店铺/;

function isLoginPage({ url = '', text = '' } = {}) {
  return LOGIN_URL_PATTERN.test(String(url)) || LOGIN_TEXT_PATTERN.test(String(text));
}

// 静默窗口：同一 partition（带着登录态）打开拼多多自己的详情页，等表格渲染出来再抓
async function fetchDetailPage({ partition, url, timeoutMs = 25_000, pollMs = 500 }) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  try {
    await window.loadURL(url).catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
      // 掉登录就直接返回，不用白等超时
      if (isLoginPage({ url: finalUrl })) {
        syncLog.append('detail', '详情页被跳到登录页', finalUrl || '(未知地址)');
        return { table: null, pageText: '', finalUrl, loginRequired: true };
      }
      if (window.isDestroyed()) return { table: null, pageText: '', finalUrl: '', loginRequired: false };
      const table = await window.webContents.executeJavaScript(SCRAPE_SCRIPT).catch(() => null);
      if (table) return { table, pageText: '', finalUrl, loginRequired: false };
      await delay(pollMs);
    }
    const pageText = await window.webContents
      .executeJavaScript('String(document.body && document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 120)')
      .catch(() => '');
    const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
    const loginRequired = isLoginPage({ url: finalUrl, text: pageText });
    syncLog.append('detail', loginRequired ? '详情页需要登录' : '详情页没渲染出规格表', `停留页面: ${finalUrl || '(未知)'}${pageText ? ` | 页面提示: ${pageText}` : ''}`);
    return { table: null, pageText, finalUrl, loginRequired };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

module.exports = { DETAIL_PAGE_BASE, buildDetailUrl, fetchDetailPage, isLoginPage, parseDetailTable, specText };
