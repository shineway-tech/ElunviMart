const { setTimeout: delay } = require('node:timers/promises');
const { PddResponseCapture } = require('./pdd-response-capture');
const { AdapterNotConfiguredError } = require('./pdd-adapter');
const { clickBidPageControl } = require('./bid-page-controls');
const DEFAULT_BID_PAGE_URL = 'https://mms.pinduoduo.com/act-bidding/market-sign-list?activity_status=IN_PROGRESS';

function checkLogin(webContents) {
  if (/\/login/i.test(webContents.getURL())) throw new AdapterNotConfiguredError('商家后台登录失效，请重新登录');
}

class MerchantSessionManager {
  constructor({ createWindow, createCapture = () => new PddResponseCapture(), partitionForAccount = id => `persist:pdd-account-${id}` } = {}) {
    Object.assign(this, { createWindow, createCapture, partitionForAccount });
    this.sessions = new Map();
  }

  async ensureMonitoringPage(accountId) {
    const key = String(accountId);
    let entry = this.sessions.get(key);
    if (entry && !entry.window.isDestroyed()) { await entry.ready; return entry; }
    const window = this.createWindow({
      width: 1180, height: 820, show: false, title: 'Elunvi Mart - 营销竞价监控',
      webPreferences: { partition: this.partitionForAccount(accountId), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    const capture = this.createCapture();
    entry = { window, webContents: window.webContents, capture, loaded: false };
    this.sessions.set(key, entry);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const checkNavigation = () => {
      try { checkLogin(window.webContents); } catch (error) { capture.cancel(error); }
    };
    window.webContents.on('did-navigate', checkNavigation);
    window.webContents.on('did-navigate-in-page', checkNavigation);
    window.webContents.on('render-process-gone', () => this.close(key));
    window.on('closed', () => {
      if (this.sessions.get(key) === entry) { this.sessions.delete(key); capture.close(); }
    });
    entry.ready = (async () => {
      // CDP commands can stall on an uninitialized target. Initialize without any merchant request.
      await window.loadURL('about:blank');
      if (this.sessions.get(key) !== entry) throw new Error('监控窗口已关闭');
      await capture.attach(window.webContents);
    })();
    let timer;
    try {
      await Promise.race([entry.ready, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('监控窗口初始化超时')), 15_000);
      })]);
      return entry;
    } catch (error) { this.close(key); throw error; } finally { clearTimeout(timer); }
  }

  async readPage(accountId, { page, expectedQuery, timeoutMs = 15_000, signal } = {}) {
    signal?.throwIfAborted();
    const entry = await this.ensureMonitoringPage(accountId);
    try {
      signal?.throwIfAborted();
      return await entry.capture.collectPage({ page, expectedQuery, timeoutMs, signal, trigger: async () => {
        if (!entry.loaded) {
          if (page !== 1) throw new Error('营销页面尚未加载第一页');
          await entry.window.loadURL(DEFAULT_BID_PAGE_URL);
          checkLogin(entry.webContents);
          entry.loaded = true;
          return;
        }
        checkLogin(entry.webContents);
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          signal?.throwIfAborted();
          if (entry.window.isDestroyed()) throw new Error('监控窗口已关闭');
          const result = await entry.webContents.executeJavaScript(`(${clickBidPageControl.toString()})(${JSON.stringify(page)})`);
          if (result?.clicked) return;
          await delay(200, undefined, { signal });
        }
        throw new Error('未找到可用的营销查询或下一页控件，已停止同步并保留缓存');
      } });
    } catch (error) { this.close(accountId); throw error; }
  }

  close(accountId) {
    const key = String(accountId);
    const entry = this.sessions.get(key);
    if (!entry) return;
    this.sessions.delete(key);
    entry.capture.close();
    if (!entry.window.isDestroyed()) { entry.webContents.stop(); entry.window.close(); }
  }

  closeAll() { for (const key of [...this.sessions.keys()]) this.close(key); }
}
module.exports = { MerchantSessionManager, DEFAULT_BID_PAGE_URL };
