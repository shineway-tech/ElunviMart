const path = require('node:path');
const { BrowserWindow } = require('electron');
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
    await window.loadURL(BID_PAGE_URL).catch(() => {});

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
    let index = await waitForNewPage(0, deadline);
    if (index === null) {
      const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
      return { payloads: [], finalUrl };
    }

    const first = byPage.get(1) || [...byPage.values()][0];
    const total = Number(first?.result?.total);
    const pageSize = Array.isArray(first?.result?.result) ? first.result.result.length : 0;
    const expectedPages = Number.isSafeInteger(total) && total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : null;
    const pageLimit = Math.max(1, Math.min(Number(maxPages) || 1, expectedPages || Number(maxPages) || 1));

    while (byPage.size < pageLimit && Date.now() < deadline && !signal?.aborted) {
      const clicked = await window.webContents.executeJavaScript(NEXT_CLICK_SCRIPT).catch(() => false);
      if (!clicked) break;
      const before = byPage.size;
      await delay(pageDelayMs());
      const next = await waitForNewPage(before, Math.min(deadline, Date.now() + 15_000), index);
      if (next === null) break;
      index = next;
    }
    const payloads = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([, payload]) => payload);
    const finalUrl = window.isDestroyed() ? '' : window.webContents.getURL();
    return { payloads, finalUrl };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

module.exports = { BID_PAGE_URL, collectBidListPayloads };
