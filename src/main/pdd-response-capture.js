const { AdapterResponseError, mapBidListResponse } = require('./pdd-adapter');

const BID_LIST_PATH = '/lakemms/bid/query/bidList';
const DEFAULT_MAX_BUFFERED_RESPONSES = 20;

function isBidListResponse(url) {
  try {
    return new URL(url).pathname === BID_LIST_PATH;
  } catch {
    return false;
  }
}

function parseBidListResponseBody(body) {
  let payload;
  try {
    payload = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    throw new AdapterResponseError('营销竞价接口返回的不是 JSON');
  }
  const products = mapBidListResponse(payload);
  const total = Number(payload?.result?.total);
  return { total: Number.isFinite(total) ? total : products.length, products };
}

function postDataPage(request) {
  if (!request?.postData) return null;
  try {
    const payload = JSON.parse(request.postData);
    const page = Number(payload.page_number);
    return Number.isInteger(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

async function sendCommand(debuggerSession, method, params) {
  if (typeof debuggerSession.sendCommand === 'function') return debuggerSession.sendCommand(method, params);
  if (typeof debuggerSession.send === 'function') return debuggerSession.send(method, params);
  throw new Error('页面调试会话不支持发送 Network 命令');
}

class PddResponseCapture {
  constructor({ maxBufferedResponses = DEFAULT_MAX_BUFFERED_RESPONSES } = {}) {
    this.maxBufferedResponses = Math.max(1, Number(maxBufferedResponses) || DEFAULT_MAX_BUFFERED_RESPONSES);
    this.debuggerSession = null;
    this.webContents = null;
    this.requestPages = new Map();
    this.buffered = new Map();
    this.waiters = new Map();
    this.onMessage = this.onMessage.bind(this);
  }

  attach(webContents) {
    this.detach();
    if (!webContents?.debugger) throw new Error('营销页面不支持网络响应捕获');
    this.webContents = webContents;
    this.debuggerSession = webContents.debugger;
    this.debuggerSession.on('message', this.onMessage);
    Promise.resolve()
      .then(() => this.debuggerSession.attach?.('1.3'))
      .then(() => sendCommand(this.debuggerSession, 'Network.enable'))
      .catch(() => {});
    return this;
  }

  detach() {
    if (this.debuggerSession?.removeListener) this.debuggerSession.removeListener('message', this.onMessage);
    this.requestPages.clear();
    this.debuggerSession = null;
    this.webContents = null;
  }

  async onMessage(_event, method, params = {}) {
    if (method === 'Network.requestWillBeSent') {
      const page = postDataPage(params.request);
      if (page && isBidListResponse(params.request?.url)) this.requestPages.set(params.requestId, page);
      return;
    }
    if (method !== 'Network.responseReceived' || !isBidListResponse(params.response?.url)) return;
    const page = this.requestPages.get(params.requestId) || null;
    this.requestPages.delete(params.requestId);
    try {
      if (Number(params.response?.status) < 200 || Number(params.response?.status) >= 300) {
        throw new AdapterResponseError(`营销竞价接口请求失败（HTTP ${params.response?.status}）`);
      }
      const bodyResult = await sendCommand(this.debuggerSession, 'Network.getResponseBody', { requestId: params.requestId });
      const parsed = parseBidListResponseBody(bodyResult?.body || '');
      this.resolvePage({ page, ...parsed, requestId: params.requestId });
    } catch (error) {
      this.rejectPage(page, error);
    }
  }

  resolvePage(result) {
    const waiters = this.waiters.get(result.page);
    if (waiters?.length) {
      const waiter = waiters.shift();
      if (!waiters.length) this.waiters.delete(result.page);
      clearTimeout(waiter.timer);
      waiter.resolve(result);
      return;
    }
    const buffered = this.buffered.get(result.page) || [];
    buffered.push(result);
    while (buffered.length > this.maxBufferedResponses) buffered.shift();
    this.buffered.set(result.page, buffered);
  }

  rejectPage(page, error) {
    const waiters = this.waiters.get(page);
    if (waiters?.length) {
      const waiter = waiters.shift();
      if (!waiters.length) this.waiters.delete(page);
      clearTimeout(waiter.timer);
      waiter.reject(error);
      return;
    }
    const buffered = this.buffered.get(page) || [];
    buffered.push({ page, error });
    while (buffered.length > this.maxBufferedResponses) buffered.shift();
    this.buffered.set(page, buffered);
  }

  waitForPage({ page, timeoutMs = 15_000 }) {
    const buffered = this.buffered.get(page);
    if (buffered?.length) {
      const result = buffered.shift();
      if (!buffered.length) this.buffered.delete(page);
      return result.error ? Promise.reject(result.error) : Promise.resolve(result);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.waiters.get(page) || [];
        const index = waiters.findIndex((item) => item.resolve === resolve);
        if (index >= 0) waiters.splice(index, 1);
        if (!waiters.length) this.waiters.delete(page);
        reject(new Error(`等待营销竞价第 ${page} 页响应超时`));
      }, timeoutMs);
      const waiters = this.waiters.get(page) || [];
      waiters.push({ resolve, reject, timer });
      this.waiters.set(page, waiters);
    });
  }

  async requestPage(webContents, { path = BID_LIST_PATH, request, headers = {} }) {
    const script = `(async () => {
      const response = await fetch(${JSON.stringify(path)}, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: ${JSON.stringify({ 'content-type': 'application/json', ...headers })},
        body: ${JSON.stringify(JSON.stringify(request || {}))}
      });
      if (!response.ok) throw new Error('营销竞价接口请求失败（HTTP ' + response.status + '）');
      return true;
    })()`;
    return webContents.executeJavaScript(script);
  }

  close() {
    const error = new Error('营销竞价响应捕获已关闭');
    for (const waiters of this.waiters.values()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    }
    this.waiters.clear();
    this.buffered.clear();
    this.detach();
  }
}

module.exports = { PddResponseCapture, isBidListResponse, parseBidListResponseBody };
