const path = require('node:path');
const { BrowserWindow } = require('electron');
const syncLog = require('./sync-log');
const { describeSession } = require('./session-info');
const { setTimeout: delay } = require('node:timers/promises');

const BID_PAGE_URL = 'https://mms.pinduoduo.com/act-bidding/market-sign-list?activity_status=IN_PROGRESS';

const NEXT_CLICK_SCRIPT = `(() => {
  const next = document.querySelector('li[class*="PGT_next"]');
  if (!next || /PGT_disabled/.test(String(next.className))) return false;
  next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
})()`;

function readEntriesScript(fromIndex) {
  return `(() => {
    const list = window.__cueBidList || [];
    return JSON.stringify(list.slice(${Number(fromIndex) || 0}).map((entry) => ({ page: entry.page, payload: entry.payload })));
  })()`;
}

async function readEntries(window, fromIndex) {
  const raw = await window.webContents.executeJavaScript(readEntriesScript(fromIndex)).catch(() => '[]');
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function payloadPage(payload) {
  return Number(payload?.result?.page_number) || null;
}

// 静默窗口打开报名列表页，让页面自己一页页请求，我们只负责收响应（不挂调试协议，避免被识别成自动化）
async function collectBidListPayloads({
  partition,
  signal,
  maxPages = 100,
  pageDelayMs = () => 800,
  timeoutMs = 120_000,
  pollMs = 500
}) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      partition,
      preload: path.join(__dirname, 'pdd-page-hook.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  try {
    const cookieSummary = await describeSession(partition);
    syncLog.append('list', '打开报名列表页', BID_PAGE_URL);
    syncLog.append('list', '开始前登录态', cookieSummary);
    window.webContents.on('did-navigate', (_event, url) => syncLog.append('list', '页面跳转', url));
    window.webContents.on('did-fail-load', (_event, code, description, url) => {
      syncLog.append('list', '页面加载失败', `${code} ${description} | ${url}`);
    });
    const loadStartedAt = Date.now();
    await window.loadURL(BID_PAGE_URL).catch((error) => {
      syncLog.append('list', 'loadURL 抛错', error.message);
    });
    syncLog.append('list', '首屏页面就绪', `用时 ${Date.now() - loadStartedAt}ms | 当前地址 ${window.isDestroyed() ? '(窗口已关)' : window.webContents.getURL()}`);

    const byPage = new Map();
    const collect = (entries) => {
      for (const entry of entries) {
        const payload = entry?.payload;
        if (!payload?.result) continue;
        const page = Number(entry.page) || payloadPage(payload) || byPage.size + 1;
        byPage.set(page, payload);
      }
    };
    const waitForNewPage = async (currentSize, deadline, startIndex = 0) => {
      let index = startIndex;
      while (Date.now() < deadline && !signal?.aborted) {
        const entries = await readEntries(window, index);
        if (entries.length) {
          index += entries.length;
          collect(entries);
          if (byPage.size > currentSize) return index;
        }
        await delay(pollMs);
      }
      return null;
    };

    const deadline = Date.now() + timeoutMs;
    const firstWaitAt = Date.now();
    let index = await waitForNewPage(0, deadline);
    if (index === null) {
      const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
      // 页面自己没发出列表请求：把停在哪儿、页面在说什么记下来（排障全靠它）
      const pageDetail = window.isDestroyed()
        ? ''
        : await window.webContents
          .executeJavaScript(`(() => {
            const text = String(document.body && document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160);
            return JSON.stringify({
              title: document.title || '',
              readyState: document.readyState,
              hasPassword: Boolean(document.querySelector('input[type=password]')),
              hasQr: Boolean(document.querySelector('img[src*="qr"], canvas, .qrcode, [class*="qrcode" i]')),
              text
            });
          })()`)
          .catch((error) => JSON.stringify({ error: error.message }));
      const parsed = (() => { try { return JSON.parse(pageDetail); } catch { return {}; } })();
      const bits = [
        `停留页面: ${finalUrl || '(未知)'}`,
        parsed.title ? `标题: ${parsed.title}` : '',
        parsed.readyState ? `readyState: ${parsed.readyState}` : '',
        parsed.hasPassword ? '页面含密码输入框' : '',
        parsed.hasQr ? '页面含二维码元素' : '',
        parsed.text ? `页面提示: ${parsed.text}` : '',
        parsed.error ? `页面读取失败: ${parsed.error}` : '',
        `等待了 ${Math.round(timeoutMs / 1000)}s`,
      ].filter(Boolean);
      syncLog.append('list', '没等到列表请求', bits.join(' | '));
      return { payloads: [], finalUrl };
    }

    const first = byPage.get(1) || [...byPage.values()][0];
    syncLog.append('list', '第 1 页已抓取', `${Array.isArray(first?.result?.result) ? first.result.result.length : 0} 条 | 用时 ${Math.round((Date.now() - firstWaitAt) / 1000)}s`);
    const total = Number(first?.result?.total);
    const pageSize = Array.isArray(first?.result?.result) ? first.result.result.length : 0;
    const expectedPages = Number.isSafeInteger(total) && total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : null;
    const pageLimit = Math.max(1, Math.min(Number(maxPages) || 1, expectedPages || Number(maxPages) || 1));

    while (byPage.size < pageLimit && Date.now() < deadline && !signal?.aborted) {
      const clicked = await window.webContents.executeJavaScript(NEXT_CLICK_SCRIPT).catch(() => false);
      if (!clicked) break;
      const before = byPage.size;
      const clickAt = Date.now();
      await delay(pageDelayMs());
      const next = await waitForNewPage(before, Math.min(deadline, Date.now() + 15_000), index);
      if (next === null) {
        syncLog.append('list', `第 ${before + 1} 页没等到数据`, `点击下一页后 ${Math.round((Date.now() - clickAt) / 1000)}s 无响应`);
        break;
      }
      index = next;
      const captured = byPage.get(before + 1) || [...byPage.values()].pop();
      const count = Array.isArray(captured?.result?.result) ? captured.result.result.length : 0;
      syncLog.append('list', `第 ${before + 1} 页已抓取`, `${count} 条 | 用时 ${Math.round((Date.now() - clickAt) / 1000)}s`);
    }
    const payloads = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([, payload]) => payload);
    const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
    const itemCount = payloads.reduce((sum, payload) => sum + (Array.isArray(payload?.result?.result) ? payload.result.result.length : 0), 0);
    syncLog.append('list', '列表读取完成', `抓到 ${payloads.length} 页 / 预计 ${pageLimit} 页 | 合计 ${itemCount} 条 | 总数字段 ${total}`);
    return { payloads, finalUrl };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

module.exports = { BID_PAGE_URL, collectBidListPayloads };
