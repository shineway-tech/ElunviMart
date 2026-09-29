const BID_LIST_PAGE_SIZE = 40;
const DEFAULT_PAGE_DELAY_MIN_MS = 2_000;
const DEFAULT_PAGE_DELAY_MAX_MS = 4_000;

function randomPageDelayMs(random = Math.random) {
  const sample = Number(random());
  const ratio = Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0;
  return Math.round(DEFAULT_PAGE_DELAY_MIN_MS + (DEFAULT_PAGE_DELAY_MAX_MS - DEFAULT_PAGE_DELAY_MIN_MS) * ratio);
}

class AdapterNotConfiguredError extends Error {
  constructor(message = '尚未配置拼多多营销活动商品接口，当前继续显示本地缓存', { accountOffline = true } = {}) {
    super(message);
    this.name = 'AdapterNotConfiguredError';
    this.code = 'ADAPTER_NOT_CONFIGURED';
    this.accountOffline = accountOffline;
  }
}

class AdapterResponseError extends Error {
  constructor(message, apiCode = null, status = 0) {
    super(message);
    this.name = 'AdapterResponseError';
    this.code = 'ADAPTER_RESPONSE_ERROR';
    this.apiCode = apiCode;
    this.status = Number.isFinite(Number(status)) ? Number(status) : 0;
  }
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
    throw new AdapterResponseError('有一条报名记录缺少商品 ID，这次跳过。');
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
  if (!payload) throw new AdapterResponseError('拼多多这次没返回数据，请稍后重试。');
  const apiCode = Number(payload.error_code);
  if (payload.success === false || (Number.isFinite(apiCode) && apiCode !== 1000000)) {
    throw new AdapterResponseError(payload.error_msg || `拼多多这次返回了一个错误（错误码 ${payload.error_code}），请稍后重试。`, apiCode);
  }
  const rows = payload.result?.result;
  if (!Array.isArray(rows)) throw new AdapterResponseError('拼多多返回的数据看不懂了，请稍后重试。');
  return rows.map(mapBidItem);
}

function validateTotal(payload) {
  const raw = payload?.result?.total;
  const total = Number(raw);
  const valid = typeof raw === 'number' || (typeof raw === 'string' && /^(0|[1-9]\d*)$/.test(raw));
  if (!valid || !Number.isSafeInteger(total) || total < 0) {
    throw new AdapterResponseError('读到的商品总数不对，已保留原有数据，稍后会自动重试。');
  }
  return total;
}

function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason || new Error('请求已取消'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason || new Error('请求已取消'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (error) => { signal.removeEventListener('abort', onAbort); reject(error); }
    );
  });
}

function isMerchantLoginUrl(url) {
  return /mms\.pinduoduo\.com\/login/i.test(String(url || ''));
}

class PddActivityAdapter {
  constructor({ collectPayloads, pageDelayMs = randomPageDelayMs, maxPages = 100, maxProducts = 2000, syncTimeoutMs = 300_000 }) {
    Object.assign(this, { collectPayloads, pageDelayMs, maxPages, maxProducts, syncTimeoutMs });
  }

  // 列表数据来自"静默打开报名列表页、页面自己请求、我们收响应"，不再由我们重放 bidList
  async syncProducts(account, { signal } = {}) {
    const timeout = AbortSignal.timeout(this.syncTimeoutMs);
    const boundedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const { payloads, finalUrl } = await raceWithAbort(this.collectPayloads(account, {
      signal: boundedSignal,
      maxPages: this.maxPages,
      pageDelayMs: this.pageDelayMs
    }), boundedSignal);
    boundedSignal.throwIfAborted();
    if (!Array.isArray(payloads) || !payloads.length) {
      throw new AdapterNotConfiguredError('没有读到拼多多营销活动列表，请先完成商家后台登录', { accountOffline: isMerchantLoginUrl(finalUrl) });
    }

    const products = [];
    const ids = new Set();
    let total = null;
    for (const payload of payloads) {
      const pageProducts = mapBidListResponse(payload);
      const pageTotal = validateTotal(payload);
      if (total === null) {
        total = pageTotal;
        if (total > this.maxProducts || Math.ceil(total / BID_LIST_PAGE_SIZE) > this.maxPages) {
          throw new AdapterResponseError('这个店铺的营销商品太多了，超出了单次同步上限。本次保留原有数据。');
        }
      } else if (pageTotal !== total) {
        throw new AdapterResponseError('同步过程中商品数量发生了变化，已保留原有数据，稍后会自动重试。');
      }
      for (const product of pageProducts) {
        if (!product.id || ids.has(product.id)) throw new AdapterResponseError('这次同步的商品数据有点异常，已保留原有数据，稍后会自动重试。');
        ids.add(product.id);
        products.push(product);
      }
    }
    if (products.length !== total) throw new AdapterResponseError('这次同步拿到的商品列表不完整，已保留原有数据，稍后会自动重试。');
    return products;
  }
}

module.exports = {
  AdapterNotConfiguredError,
  AdapterResponseError,
  BID_LIST_PAGE_SIZE,
  PddActivityAdapter,
  isMerchantLoginUrl,
  mapActivityStatus,
  mapBidListResponse,
  randomPageDelayMs,
  validateTotal
};
