// Local-only Electron integration test. All HTTPS requests in this isolated session are intercepted.
const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MerchantSessionManager } = require('../../src/main/merchant-session');
const { PddActivityAdapter } = require('../../src/main/pdd-adapter');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'elunvi-page-test-'));
app.setPath('userData', temporary);
app.on('window-all-closed', () => {});
const watchdog = setTimeout(() => { console.error('Electron integration deadline exceeded'); app.exit(1); }, 30_000);

const html = `<!doctype html><meta charset="utf-8"><button id="query">查询</button>
<ul class="ant-pagination"><li class="ant-pagination-item-active" aria-current="page">1</li>
<li title="1"><button id="first">1</button></li><li title="下一页"><button id="next" aria-label="下一页">下一页</button></li></ul>
<script>
let page = 1;
async function load(target) {
  document.querySelector('#next').disabled = true;
  const response = await fetch('/lakemms/bid/query/bidList', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Anti-Content': 'fixture-generated-by-page' },
    body: JSON.stringify({ page_number: target, page_size: 10, status_list: [501] }) });
  await response.json(); page = target;
  document.querySelector('[aria-current]').textContent = String(page);
  document.querySelector('#next').disabled = false;
}
document.querySelector('#query').onclick = () => load(1);
document.querySelector('#first').onclick = () => load(1);
document.querySelector('#next').onclick = () => load(page + 1);
load(1);
</script>`;

app.whenReady().then(async () => {
  let manager;
  try {
    const partition = `test-${process.pid}`;
    const isolated = session.fromPartition(partition);
    let navigations = 0;
    const pages = [];
    let failure = false;
    isolated.protocol.handle('https', async request => {
      const url = new URL(request.url);
      if (url.hostname !== 'mms.pinduoduo.com') return new Response('', { status: 404 });
      if (url.pathname === '/act-bidding/market-sign-list') {
        navigations++;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      }
      if (url.pathname !== '/lakemms/bid/query/bidList') return new Response('', { status: 404 });
      const body = await request.json(); pages.push(body.page_number);
      assert.equal(request.headers.get('Anti-Content'), 'fixture-generated-by-page');
      if (failure) return Response.json({ error_code: 54001, error_msg: '测试风控' });
      const start = (body.page_number - 1) * 10;
      return Response.json({ success: true, result: { total: 21, result: Array.from({ length: Math.min(10, 21 - start) }, (_, i) => ({ my_bid_goods_id: start + i + 1 })) } });
    });
    manager = new MerchantSessionManager({ createWindow: options => new BrowserWindow(options), partitionForAccount: () => partition });
    const adapter = new PddActivityAdapter({ sessions: manager, pageDelayMs: () => 0, pageTimeoutMs: 3000 });
    assert.equal((await adapter.syncProducts({ id: 'test' })).length, 21);
    assert.equal((await adapter.syncProducts({ id: 'test' })).length, 21);
    assert.equal(navigations, 1);
    assert.deepEqual(pages, [1, 2, 3, 1, 2, 3]);
    const entry = await manager.ensureMonitoringPage('test');
    assert.equal(entry.window.isVisible(), false);
    failure = true;
    const closed = new Promise(resolve => entry.window.once('closed', resolve));
    await assert.rejects(adapter.syncProducts({ id: 'test' }), { apiCode: 54001 });
    assert.deepEqual(pages, [1, 2, 3, 1, 2, 3, 1]);
    assert.equal(navigations, 1);
    await closed;
    assert.equal(entry.window.isDestroyed(), true);
    console.log('PASS Electron: real hidden page + CDP, two fresh 3-page syncs, one navigation, page-generated headers, 54001 stops without retry.');
    clearTimeout(watchdog); app.exit(0);
  } catch (error) {
    console.error(error); manager?.closeAll(); clearTimeout(watchdog); app.exit(1);
  }
});
process.on('exit', () => fs.rmSync(temporary, { recursive: true, force: true }));
