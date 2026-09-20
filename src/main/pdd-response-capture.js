const { AdapterResponseError, mapBidListResponse } = require('./pdd-adapter');

function isBidListResponse(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://mms.pinduoduo.com' && url.pathname === '/lakemms/bid/query/bidList';
  } catch { return false; }
}

function parseBidListResponseBody(body) {
  let payload;
  try { payload = JSON.parse(body); } catch { throw new AdapterResponseError('营销竞价接口返回的不是 JSON'); }
  const products = mapBidListResponse(payload);
  const rawTotal = payload?.result?.total;
  const total = Number(rawTotal);
  const numericTotal = typeof rawTotal === 'number' || (typeof rawTotal === 'string' && /^(0|[1-9]\d*)$/.test(rawTotal));
  if (!numericTotal || !Number.isSafeInteger(total) || total < 0) {
    throw new AdapterResponseError('营销竞价商品总数无效，保留原缓存');
  }
  return { total, products };
}

// Compare all filters, independently of property order. Never retain request headers.
function queryKey(query) {
  const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
  const { page_number: _page, ...filters } = query;
  return JSON.stringify(normalize(filters));
}

function isPrimaryQuery(query) {
  return Array.isArray(query.status_list) && query.status_list.length > 0;
}

class PddResponseCapture {
  constructor() {
    this.debuggerSession = null;
    this.active = null;
    this.onMessage = this.onMessage.bind(this);
    this.onDetach = () => this.cancel(new Error('营销页面网络监听已断开'));
  }

  async attach(webContents) {
    this.close();
    const debug = webContents.debugger;
    if (debug.isAttached()) throw new Error('营销页面已有调试会话，请关闭开发者工具');
    debug.attach('1.3');
    this.debuggerSession = debug;
    debug.on('message', this.onMessage);
    debug.on('detach', this.onDetach);
    try { await debug.sendCommand('Network.enable'); } catch (error) { this.close(); throw error; }
  }

  async collectPage({ page, trigger, expectedQuery, timeoutMs = 15_000, signal }) {
    if (!this.debuggerSession?.isAttached()) throw new Error('营销页面网络监听未连接');
    if (this.active) throw new Error('正在等待营销页面响应');
    signal?.throwIfAborted();
    let resolve;
    let reject;
    const response = new Promise((yes, no) => { resolve = yes; reject = no; });
    const active = { page, expectedQuery, requests: new Map(), resolve, reject, fallbackTimer: null };
    this.active = active;
    const action = Promise.resolve().then(() => { signal?.throwIfAborted(); return trigger(); });
    // The deadline must also cover a stalled navigation after its response arrived.
    const deadline = new Promise((_, no) => { active.reject = error => { reject(error); no(error); }; });
    const timeoutAbort = () => active.reject(signal.reason || new Error('同步已取消'));
    signal?.addEventListener('abort', timeoutAbort, { once: true });
    const boundedTimer = setTimeout(() => active.reject(new Error(`等待营销竞价第 ${page} 页响应超时`)), timeoutMs);
    try {
      const [result] = await Promise.race([Promise.all([response, action]), deadline]);
      return result;
    } finally {
      clearTimeout(boundedTimer);
      if (active.fallbackTimer) clearTimeout(active.fallbackTimer);
      signal?.removeEventListener('abort', timeoutAbort);
      if (this.active === active) this.active = null;
    }
  }

  onMessage(_event, method, params = {}) {
    const active = this.active;
    if (!active) return;
    try {
      if (method === 'Network.requestWillBeSent') {
        const request = params.request;
        if (request?.method !== 'POST' || !isBidListResponse(request.url)) return;
        let query;
        try { query = JSON.parse(request.postData); } catch { throw new AdapterResponseError('无法识别营销页面请求参数'); }
        if (Number(query.page_number) !== active.page) return;
        if (!Number.isSafeInteger(Number(query.page_size)) || Number(query.page_size) < 1 ||
            !Array.isArray(query.status_list) ||
            (query.status_list.length !== 0 && (query.status_list.length !== 1 || Number(query.status_list[0]) !== 501)) ||
            (active.expectedQuery && queryKey(query) !== queryKey(active.expectedQuery))) {
          throw new AdapterResponseError('营销页面筛选条件已变化，保留原缓存');
        }
        active.requests.set(params.requestId, { query });
        return;
      }
      const request = active.requests.get(params.requestId);
      if (!request) return;
      if (method === 'Network.responseReceived') {
        if (!isBidListResponse(params.response?.url)) throw new AdapterResponseError('营销页面响应地址已变化');
        request.status = Number(params.response.status);
        if (request.status < 200 || request.status >= 300) throw new AdapterResponseError(`营销竞价接口请求失败（HTTP ${request.status}）`);
      } else if (method === 'Network.loadingFailed') {
        throw new AdapterResponseError('营销页面请求加载失败');
      } else if (method === 'Network.loadingFinished' && request.status && !request.reading) {
        request.reading = true;
        this.readBody(active, params.requestId, request).catch(error => {
          if (this.active === active) active.reject(error);
        });
      }
    } catch (error) { active.reject(error); }
  }

  async readBody(active, requestId, request) {
    const bodyResult = await this.debuggerSession.sendCommand('Network.getResponseBody', { requestId });
    if (this.active !== active) return;
    const body = bodyResult.base64Encoded ? Buffer.from(bodyResult.body, 'base64').toString('utf8') : bodyResult.body;
    const parsed = { page: active.page, query: request.query, requestId, ...parseBidListResponseBody(body) };
    request.result = parsed;
    if (isPrimaryQuery(request.query)) {
      active.resolve(parsed);
      return;
    }
    // PDD sometimes emits an unfiltered same-page request alongside the normal
    // status=501 request. Keep it as a fallback, but let the primary request win.
    const primaryPending = [...active.requests.values()].some(candidate =>
      !candidate.ignored && isPrimaryQuery(candidate.query));
    if (primaryPending) return;
    if (active.fallbackTimer) clearTimeout(active.fallbackTimer);
    active.fallbackTimer = setTimeout(() => {
      active.fallbackTimer = null;
      if (this.active !== active) return;
      const primary = [...active.requests.values()].find(candidate =>
        !candidate.ignored && isPrimaryQuery(candidate.query));
      if (!primary) active.resolve(parsed);
    }, 0);
  }

  cancel(error = new Error('营销页面响应捕获已关闭')) { this.active?.reject(error); }

  close() {
    this.cancel();
    const debug = this.debuggerSession;
    this.debuggerSession = null;
    if (!debug) return;
    debug.removeListener('message', this.onMessage);
    debug.removeListener('detach', this.onDetach);
    if (debug.isAttached()) debug.detach();
  }
}

module.exports = { PddResponseCapture, isBidListResponse, parseBidListResponseBody };
