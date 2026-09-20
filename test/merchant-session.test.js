const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { MerchantSessionManager } = require('../src/main/merchant-session');
class FakeWindow extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.urls = []; this.url = 'about:blank'; this.closed = false;
    this.webContents = new EventEmitter();
    this.webContents.getURL = () => this.url;
    this.webContents.setWindowOpenHandler = () => {};
    this.webContents.stop = () => {};
    this.webContents.executeJavaScript = async () => ({ clicked: true });
  }
  async loadURL(url) { this.urls.push(url); this.url = url; }
  isDestroyed() { return this.closed; }
  close() { this.closed = true; this.emit('closed'); }
}
function setup() {
  const windows = [];
  const events = [];
  const manager = new MerchantSessionManager({
    createWindow: options => { const w = new FakeWindow(options); windows.push(w); return w; },
    createCapture: () => ({
      attach: async () => { events.push('attach'); },
      collectPage: async ({ page, trigger }) => { events.push(`listen ${page}`); await trigger(); return { page, total: 0, products: [] }; },
      close: () => events.push('close'), cancel() {}
    })
  });
  return { manager, windows, events };
}
test('creates an isolated hidden window, enabling capture before any merchant navigation', async () => {
  const f = setup();
  await f.manager.readPage('shop', { page: 1 });
  const w = f.windows[0];
  assert.equal(w.options.show, false);
  assert.equal(w.options.webPreferences.partition, 'persist:pdd-account-shop');
  assert.deepEqual(f.events.slice(0, 2), ['attach', 'listen 1']);
  assert.equal(w.urls.filter(url => url.startsWith('https://')).length, 1);
  f.manager.closeAll();
});
test('second sync uses the page query control without a reload', async () => {
  const f = setup();
  await f.manager.readPage('shop', { page: 1 });
  const w = f.windows[0];
  let actions = 0;
  w.webContents.executeJavaScript = async () => { actions++; return { clicked: true }; };
  await f.manager.readPage('shop', { page: 1 });
  await f.manager.readPage('shop', { page: 2 });
  assert.equal(actions, 2);
  assert.equal(w.urls.filter(url => url.startsWith('https://')).length, 1);
  f.manager.closeAll();
});
test('failed initial navigation is removed so the next attempt can recover', async () => {
  const f = setup();
  const session = await f.manager.ensureMonitoringPage('shop');
  session.window.loadURL = async () => { throw new Error('navigation failed'); };
  await assert.rejects(f.manager.readPage('shop', { page: 1 }), /navigation failed/);
  assert.equal(session.window.closed, true);
  await f.manager.readPage('shop', { page: 1 });
  assert.equal(f.windows.length, 2);
  f.manager.closeAll();
});
test('login redirection is classified as needs_login', async () => {
  const f = setup();
  const session = await f.manager.ensureMonitoringPage('shop');
  session.window.loadURL = async () => { session.window.url = 'https://mms.pinduoduo.com/login'; };
  await assert.rejects(f.manager.readPage('shop', { page: 1 }), { code: 'ADAPTER_NOT_CONFIGURED' });
});
test('closing releases capture exactly once, including the closed event', async () => {
  const f = setup();
  const session = await f.manager.ensureMonitoringPage('shop');
  f.manager.close('shop');
  assert.equal(session.window.closed, true);
  assert.equal(f.events.filter(x => x === 'close').length, 1);
});
