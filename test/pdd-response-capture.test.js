const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PddResponseCapture, isBidListResponse, parseBidListResponseBody } = require('../src/main/pdd-response-capture');
const url = 'https://mms.pinduoduo.com/lakemms/bid/query/bidList';
const query = { page_number: 1, page_size: 10, status_list: [501] };
const empty = { success: true, result: { total: 0, result: [] } };
const tick = () => new Promise(setImmediate);

async function setup(t) {
  const debug = new EventEmitter();
  let attached = false;
  debug.attach = () => { attached = true; };
  debug.detach = () => { attached = false; debug.emit('detach', {}, 'closed'); };
  debug.isAttached = () => attached;
  const bodies = new Map();
  const commands = [];
  debug.sendCommand = async (method, params) => {
    commands.push(method);
    if (method === 'Network.getResponseBody') return bodies.get(params.requestId);
    return {};
  };
  const capture = new PddResponseCapture();
  await capture.attach({ debugger: debug });
  t.after(() => capture.close());
  const emit = (method, params) => debug.emit('message', {}, `Network.${method}`, params);
  const request = (id, data = query, method = 'POST', target = url) => emit('requestWillBeSent', {
    requestId: id, request: { url: target, method, postData: JSON.stringify(data) }
  });
  const response = (id, payload = empty, status = 200, base64 = false) => {
    bodies.set(id, { body: base64 ? Buffer.from(JSON.stringify(payload)).toString('base64') : JSON.stringify(payload), base64Encoded: base64 });
    emit('responseReceived', { requestId: id, response: { url, status } });
  };
  return { capture, debug, commands, emit, request, response };
}

test('only the exact HTTPS merchant endpoint is accepted', () => {
  assert.equal(isBidListResponse(url), true);
  for (const target of [url.replace('mms.', 'evil.'), url.replace('https:', 'http:'), `${url}/other`, 'invalid']) {
    assert.equal(isBidListResponse(target), false);
  }
});

test('requires a valid total before accepting a complete empty snapshot', () => {
  assert.deepEqual(parseBidListResponseBody(JSON.stringify(empty)), { total: 0, products: [] });
  for (const total of [undefined, null, '', -1, 1.5, 'bad']) {
    assert.throws(() => parseBidListResponseBody(JSON.stringify({ success: true, result: { total, result: [] } })), /总数/);
  }
  assert.throws(() => parseBidListResponseBody('{'), /JSON/);
});

test('reads response body only after loadingFinished, including base64 data', async (t) => {
  const f = await setup(t);
  const pending = f.capture.collectPage({ page: 1, timeoutMs: 100, trigger: async () => {
    f.request('a'); f.response('a', empty, 200, true);
    await tick();
    assert.equal(f.commands.includes('Network.getResponseBody'), false);
    f.emit('loadingFinished', { requestId: 'a' });
  } });
  const result = await pending;
  assert.equal(result.total, 0);
  assert.equal(result.page, 1);
  assert.deepEqual(result.query, query);
});

test('ignores old request IDs, foreign hosts, GETs and responses for another page', async (t) => {
  const f = await setup(t);
  f.request('old');
  const result = await f.capture.collectPage({ page: 1, timeoutMs: 100, trigger: async () => {
    for (const id of ['old', 'get', 'foreign', 'page2']) {
      if (id === 'get') f.request(id, query, 'GET');
      if (id === 'foreign') f.request(id, query, 'POST', url.replace('mms.', 'evil.'));
      if (id === 'page2') f.request(id, { ...query, page_number: 2 });
      f.response(id); f.emit('loadingFinished', { requestId: id });
    }
    f.request('fresh'); f.response('fresh'); f.emit('loadingFinished', { requestId: 'fresh' });
  } });
  assert.equal(result.requestId, 'fresh');
});

for (const [name, run, pattern] of [
  ['HTTP 403', f => { f.request('a'); f.response('a', empty, 403); }, /HTTP 403/],
  ['54001', f => { f.request('a'); f.response('a', { error_code: 54001, error_msg: '操作太过频繁' }); f.emit('loadingFinished', { requestId: 'a' }); }, /操作太过频繁/],
  ['network failure', f => { f.request('a'); f.emit('loadingFailed', { requestId: 'a', errorText: 'ERR_FAILED' }); }, /加载失败/],
  ['detach', f => f.debug.emit('detach', {}, 'target_closed'), /断开/],
  ['changed filters', f => f.request('a', { ...query, status_list: [999] }), /筛选/]
]) {
  test(`rejects ${name} without waiting for a retry`, async t => {
    const f = await setup(t);
    await assert.rejects(f.capture.collectPage({ page: 1, timeoutMs: 100, trigger: () => run(f) }), pattern);
  });
}

test('failed actions and timeouts clean up; late responses cannot satisfy next run', async t => {
  const f = await setup(t);
  await assert.rejects(f.capture.collectPage({ page: 1, timeoutMs: 10, trigger: () => { f.request('late'); } }), /超时/);
  await assert.rejects(f.capture.collectPage({ page: 1, timeoutMs: 10, trigger: () => { throw new Error('missing control'); } }), /missing control/);
  await assert.rejects(f.capture.collectPage({ page: 1, timeoutMs: 10, trigger: () => {
    f.response('late'); f.emit('loadingFinished', { requestId: 'late' });
  } }), /超时/);
});

test('close cancels pending wait, removes listeners and detaches debugger', async t => {
  const f = await setup(t);
  const pending = f.capture.collectPage({ page: 1, timeoutMs: 100, trigger: () => {} });
  f.capture.close();
  await assert.rejects(pending, /关闭/);
  assert.equal(f.debug.isAttached(), false);
  assert.equal(f.debug.listenerCount('message'), 0);
});

test('attach errors are propagated instead of silently timing out', async () => {
  const debug = new EventEmitter();
  debug.attach = () => { throw new Error('attach failed'); };
  debug.isAttached = () => false;
  const capture = new PddResponseCapture();
  await assert.rejects(capture.attach({ debugger: debug }), /attach failed/);
  assert.equal(debug.listenerCount('message'), 0);
});
