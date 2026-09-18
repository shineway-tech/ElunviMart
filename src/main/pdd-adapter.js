const BID_LIST_PATH = '/lakemms/bid/query/bidList';
const BID_LIST_PAGE_SIZE = 40;

class AdapterNotConfiguredError extends Error {
  constructor() {
    super('尚未配置拼多多营销活动商品接口，当前继续显示本地缓存');
    this.name = 'AdapterNotConfiguredError';
    this.code = 'ADAPTER_NOT_CONFIGURED';
  }
}

class AdapterResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdapterResponseError';
    this.code = 'ADAPTER_RESPONSE_ERROR';
  }
}

function buildBidListRequest(page = 1) {
  return { page, page_size: BID_LIST_PAGE_SIZE, activity_status: 101 };
}

function isoDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapBidItem(item) {
  const id = item.my_bid_goods_id || item.bid_goods_id || item.goods_id;
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new AdapterResponseError('营销竞价报名记录缺少商品 ID');
  }
  return {
    id: String(id),
    name: String(item.my_bid_goods_name || item.template_goods_name || `商品 ${id}`),
    activityId: item.activity_id === undefined ? '' : String(item.activity_id),
    activityName: String(item.activity_name || ''),
    activityPrice: String(item.mall_bid_price || ''),
    activityStock: item.left_activity_quantity == null ? null : Number(item.left_activity_quantity),
    endsAt: isoDate(item.enroll_end_time),
    enrolledAt: isoDate(item.enroll_time),
    imageUrl: String(item.my_bid_goods_url || item.image_url || ''),
    templateImageUrl: String(item.image_url || ''),
    status: 'active',
    source: 'pdd-bid-list',
    raw: item
  };
}

function mapBidListResponse(payload) {
  if (!payload || payload.success === false) {
    throw new AdapterResponseError(payload?.error_msg || '营销竞价接口返回失败');
  }
  const rows = payload.result?.result;
  if (!Array.isArray(rows)) throw new AdapterResponseError('营销竞价接口返回的数据格式不正确');
  return rows.map(mapBidItem);
}

async function executeBidListRequest(window, request) {
  const body = JSON.stringify(request);
  return window.webContents.executeJavaScript(`(async () => {
    const response = await fetch(${JSON.stringify(BID_LIST_PATH)}, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(body)}
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('营销竞价接口返回的不是 JSON'); }
    if (!response.ok) throw new Error('营销竞价接口请求失败（HTTP ' + response.status + '）');
    return payload;
  })()`);
}

class PddActivityAdapter {
  constructor({ getLoginWindow }) {
    this.getLoginWindow = getLoginWindow;
  }

  async syncProducts(account) {
    const window = this.getLoginWindow(account.id);
    if (!window || window.isDestroyed()) throw new AdapterNotConfiguredError();
    const products = [];
    let page = 1;
    let total = Infinity;
    while (products.length < total) {
      const payload = await executeBidListRequest(window, buildBidListRequest(page));
      const pageProducts = mapBidListResponse(payload);
      const pageTotal = Number(payload.result?.total);
      total = Number.isFinite(pageTotal) ? pageTotal : pageProducts.length;
      products.push(...pageProducts);
      if (!pageProducts.length || pageProducts.length < BID_LIST_PAGE_SIZE) break;
      page += 1;
    }
    return products;
  }
}

module.exports = {
  AdapterNotConfiguredError,
  AdapterResponseError,
  BID_LIST_PAGE_SIZE,
  BID_LIST_PATH,
  PddActivityAdapter,
  buildBidListRequest,
  mapBidListResponse
};
