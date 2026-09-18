const BID_LIST_PATH = '/lakemms/bid/query/bidList';
const BID_LIST_PAGE_SIZE = 10;
const BID_ACTIVITY_TYPES = Object.freeze([205, 212, 219, 220, 221, 223, 213, 216, 218, 211, 215, 217, 224, 214]);

class AdapterNotConfiguredError extends Error {
  constructor(message = '尚未配置拼多多营销活动商品接口，当前继续显示本地缓存') {
    super(message);
    this.name = 'AdapterNotConfiguredError';
    this.code = 'ADAPTER_NOT_CONFIGURED';
  }
}

class AdapterResponseError extends Error {
  constructor(message, apiCode = null) {
    super(message);
    this.name = 'AdapterResponseError';
    this.code = 'ADAPTER_RESPONSE_ERROR';
    this.apiCode = apiCode;
  }
}

function buildBidListRequest(page = 1) {
  return {
    page_number: page,
    page_size: BID_LIST_PAGE_SIZE,
    activity_type_list: [...BID_ACTIVITY_TYPES],
    status_list: [501],
    is_wait_handle_invite_cut_price: false,
    standard_temp_id_list: [],
    activity_sub_type_list: []
  };
}

function isoDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapActivityStatus(item) {
  if (item.all_sku_win_bid === true) return 'all_sku_win_bid';
  if (Number(item.target_activity_status) === 2) return 'partial_sku_win_bid';
  if (Number(item.target_activity_status) === 3) return 'all_sku_not_win_bid';
  return 'unknown';
}

function mapBidItem(item) {
  const id = item.my_bid_goods_id || item.bid_goods_id || item.goods_id;
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new AdapterResponseError('营销竞价报名记录缺少商品 ID');
  }
  return {
    id: String(id),
    name: String(item.my_bid_goods_name || item.template_goods_name || `商品 ${id}`),
    myBidProductName: String(item.my_bid_goods_name || ''),
    myBidProductId: item.my_bid_goods_id === undefined ? String(id) : String(item.my_bid_goods_id),
    activityId: item.activity_id === undefined ? '' : String(item.activity_id),
    activityName: String(item.activity_name || ''),
    activityProductName: String(item.template_goods_name || ''),
    activityPrice: String(item.mall_bid_price || ''),
    activityStock: item.left_activity_quantity == null ? null : Number(item.left_activity_quantity),
    endsAt: isoDate(item.enroll_end_time),
    enrolledAt: isoDate(item.enroll_time),
    imageUrl: String(item.my_bid_goods_url || item.image_url || ''),
    templateImageUrl: String(item.image_url || ''),
    activityStatus: mapActivityStatus(item),
    status: 'active',
    source: 'pdd-bid-list',
    raw: item
  };
}

function mapBidListResponse(payload) {
  if (!payload) throw new AdapterResponseError('营销竞价接口返回为空');
  const apiCode = Number(payload.error_code);
  if (payload.success === false || (Number.isFinite(apiCode) && apiCode !== 1000000)) {
    throw new AdapterResponseError(payload.error_msg || `营销竞价接口返回失败（错误码 ${payload.error_code}）`, apiCode);
  }
  const rows = payload.result?.result;
  if (!Array.isArray(rows)) throw new AdapterResponseError('营销竞价接口返回的数据格式不正确');
  return rows.map(mapBidItem);
}

async function executeBidListRequest(window, request, antiContent = '') {
  const body = JSON.stringify(request);
  const headers = { 'content-type': 'application/json' };
  if (antiContent) headers['Anti-Content'] = antiContent;
  return window.webContents.executeJavaScript(`(async () => {
    const response = await fetch(${JSON.stringify(BID_LIST_PATH)}, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: ${JSON.stringify(headers)}, body: ${JSON.stringify(body)}
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('营销竞价接口返回的不是 JSON'); }
    if (!response.ok) throw new Error('营销竞价接口请求失败（HTTP ' + response.status + '）');
    return payload;
  })()`);
}

class PddActivityAdapter {
  constructor({ getLoginWindow, getAntiContent = () => '', ensureBidPage = async () => {} }) {
    this.getLoginWindow = getLoginWindow;
    this.getAntiContent = getAntiContent;
    this.ensureBidPage = ensureBidPage;
  }

  async syncProducts(account) {
    const window = this.getLoginWindow(account.id);
    if (!window || window.isDestroyed()) throw new AdapterNotConfiguredError();
    if (!this.getAntiContent(account.id)) await this.ensureBidPage(account.id, window);
    if (!this.getAntiContent(account.id)) {
      throw new AdapterNotConfiguredError('尚未捕获拼多多后台请求签名，请先完成商家后台登录');
    }
    const products = [];
    let page = 1;
    let total = Infinity;
    let refreshed = false;
    while (products.length < total) {
      try {
        const payload = await executeBidListRequest(window, buildBidListRequest(page), this.getAntiContent(account.id));
        const pageProducts = mapBidListResponse(payload);
        const pageTotal = Number(payload.result?.total);
        total = Number.isFinite(pageTotal) ? pageTotal : pageProducts.length;
        products.push(...pageProducts);
        refreshed = false;
        if (!pageProducts.length || pageProducts.length < BID_LIST_PAGE_SIZE) break;
        page += 1;
      } catch (error) {
        if (error.apiCode !== 54001 || refreshed) throw error;
        await this.ensureBidPage(account.id, window, { refresh: true });
        if (!this.getAntiContent(account.id)) {
          throw new AdapterNotConfiguredError('后台请求签名未能刷新，请检查商家后台登录状态');
        }
        refreshed = true;
      }
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
  mapActivityStatus,
  mapBidListResponse
};
