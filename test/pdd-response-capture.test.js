const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  PddResponseCapture,
  isBidListResponse,
  parseBidListResponseBody
} = require('../src/main/pdd-response-capture');

function createDebugger() {
  const debuggerEmitter = new EventEmitter();
  debuggerEmitter.bodies = new Map();
  debuggerEmitter.send = async (method, params) => {
    if (method === 'Network.enable') return {};
    if (method === 'Network.getResponseBody') return { body: debuggerEmitter.bodies.get(params.requestId), base64Encoded: false };
    throw new Error(`unexpected debugger method: ${method}`);
  };
  debuggerEmitter.attach = async () => {};
  debuggerEmitter.detach = async () => {};
  return debuggerEmitter;
}

function createWebContents(debuggerEmitter) {
  return { debugger: debuggerEmitter, executeJavaScript: async () => null };
}

function emitBidResponse(debuggerEmitter, { requestId, page, body, status = 200 }) {
  debuggerEmitter.emit('message', {}, 'Network.requestWillBeSent', {
    requestId,
    request: {
      method: 'POST',
      url: 'https://mms.pinduoduo.com/lakemms/bid/query/bidList',
      postData: JSON.stringify({ page_number: page, page_size: 10 })
    }
  });
  debuggerEmitter.bodies.set(requestId, JSON.stringify(body));
  debuggerEmitter.emit('message', {}, 'Network.responseReceived', {
    requestId,
    response: {
      url: 'https://mms.pinduoduo.com/lakemms/bid/query/bidList',
      status
    }
  });
}

test('isBidListResponse only accepts the merchant bid list endpoint', () => {
  assert.equal(isBidListResponse('https://mms.pinduoduo.com/lakemms/bid/query/bidList'), true);
  assert.equal(isBidListResponse('https://mms.pinduoduo.com/lakemms/bid/query/bidList?x=1'), true);
  assert.equal(isBidListResponse('https://mms.pinduoduo.com/earth/api/mallInfo/commonMallInfo'), false);
});

test('parseBidListResponseBody maps a valid response and rejects malformed JSON', () => {
  const result = parseBidListResponseBody(JSON.stringify({ success: true, result: { total: 0, result: [] } }));
  assert.deepEqual(result, { total: 0, products: [] });
  assert.throws(() => parseBidListResponseBody('{bad-json'), /不是 JSON/);
});

test('captures a page response body by matching its request id', async () => {
  const debuggerEmitter = createDebugger();
  const capture = new PddResponseCapture();
  capture.attach(createWebContents(debuggerEmitter));
  const pending = capture.waitForPage({ page: 1, timeoutMs: 100 });
  emitBidResponse(debuggerEmitter, {
    requestId: 'req-1',
    page: 1,
    body: { success: true, result: { total: 1, result: [{ my_bid_goods_id: 1 }] } }
  });
  const result = await pending;
  assert.equal(result.page, 1);
  assert.equal(result.total, 1);
  assert.equal(result.products[0].id, '1');
  capture.close();
});

test('buffers a response that arrives before a waiter is registered', async () => {
  const debuggerEmitter = createDebugger();
  const capture = new PddResponseCapture();
  capture.attach(createWebContents(debuggerEmitter));
  emitBidResponse(debuggerEmitter, {
    requestId: 'req-2',
    page: 2,
    body: { success: true, result: { total: 2, result: [] } }
  });
  const result = await capture.waitForPage({ page: 2, timeoutMs: 100 });
  assert.equal(result.page, 2);
  capture.close();
});

test('rejects a non-success response and times out when no response arrives', async () => {
  const debuggerEmitter = createDebugger();
  const capture = new PddResponseCapture();
  capture.attach(createWebContents(debuggerEmitter));
  const failed = capture.waitForPage({ page: 1, timeoutMs: 100 });
  emitBidResponse(debuggerEmitter, {
    requestId: 'req-3',
    page: 1,
    status: 403,
    body: { success: false, error_code: 54001, error_msg: 'expired' }
  });
  await assert.rejects(failed, /HTTP 403/);
  await assert.rejects(capture.waitForPage({ page: 9, timeoutMs: 5 }), /超时/);
  capture.close();
});

test('requestPage runs pagination inside the page context', async () => {
  const debuggerEmitter = createDebugger();
  let executedScript = '';
  const webContents = {
    debugger: debuggerEmitter,
    executeJavaScript: async (script) => { executedScript = script; return { accepted: true }; }
  };
  const capture = new PddResponseCapture();
  capture.attach(webContents);
  const result = await capture.requestPage(webContents, { page: 2, request: { page_number: 2, page_size: 10 } });
  assert.deepEqual(result, { accepted: true });
  assert.match(executedScript, /page_number/);
  capture.close();
});
