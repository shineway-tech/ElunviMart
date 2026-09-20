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

class PddActivityAdapter {
  constructor({ sessions, pageDelayMs = () => 1000, pageTimeoutMs = 15_000, maxPages = 100, maxProducts = 2000, syncTimeoutMs = 300_000 }) {
    Object.assign(this, { sessions, pageDelayMs, pageTimeoutMs, maxPages, maxProducts, syncTimeoutMs });
  }

  async syncProducts(account, { signal } = {}) {
    const timeout = AbortSignal.timeout(this.syncTimeoutMs);
    const boundedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const products = [];
    const ids = new Set();
    let total;
    let query;
    let pageSize;
    try {
      for (let page = 1; page <= this.maxPages; page++) {
        boundedSignal.throwIfAborted();
        if (page > 1) {
          const { setTimeout: delay } = require('node:timers/promises');
          await delay(this.pageDelayMs(), undefined, { signal: boundedSignal });
        }
        const result = await this.sessions.readPage(account.id, {
          page, expectedQuery: query, timeoutMs: this.pageTimeoutMs, signal: boundedSignal
        });
        if (page === 1) {
          total = result.total;
          query = result.query;
          pageSize = Number(query?.page_size);
          if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) {
            throw new AdapterResponseError('营销列表总数或分页参数无效');
          }
          if (total > this.maxProducts || Math.ceil(total / pageSize) > this.maxPages) {
            throw new AdapterResponseError('营销商品数量或页数超过同步上限，保留原缓存');
          }
        }
        if (result.page !== page || result.total !== total ||
            result.products.length !== Math.min(pageSize, total - products.length)) {
          throw new AdapterResponseError('营销列表分页不完整或总数已变化，保留原缓存');
        }
        for (const product of result.products) {
          if (!product.id || ids.has(product.id)) throw new AdapterResponseError('营销列表缺少商品 ID 或包含重复商品，保留原缓存');
          ids.add(product.id);
          products.push(product);
        }
        if (products.length === total) return products;
      }
      throw new AdapterResponseError('营销列表页数超过同步上限');
    } catch (error) {
      this.sessions.close(account.id);
      throw error;
    }
  }
}

module.exports = { AdapterNotConfiguredError, AdapterResponseError, PddActivityAdapter, mapActivityStatus, mapBidListResponse };
