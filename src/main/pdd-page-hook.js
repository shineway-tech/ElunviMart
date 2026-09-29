// preload 钩子（与页面同世界）：只记录"页面自己发出的请求"的响应，我们绝不主动发请求
const TARGETS = [
  '/lakemms/bid/query/bidList',
  '/earth/api/mallInfo/commonMallInfo',
  '/earth/api/mallInfo/querySimpleCredential'
];

(() => {
  if (window.__cueHooked) return;
  window.__cueHooked = true;
  window.__cueBidList = [];
  window.__cueMallInfo = [];

  const matchTarget = (url) => (typeof url === 'string' ? TARGETS.find((target) => url.indexOf(target) !== -1) : null);

  const record = (target, body, payload) => {
    if (!payload) return;
    if (target.indexOf('bidList') !== -1) {
      if (!payload.result) return;
      let page = null;
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});
        page = Number(parsed.page_number) || null;
      } catch {}
      window.__cueBidList.push({ page, at: Date.now(), payload });
      return;
    }
    window.__cueMallInfo.push({ at: Date.now(), payload });
  };

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : input && input.url;
      const promise = origFetch.apply(this, arguments);
      const target = matchTarget(url);
      if (target) {
        promise
          .then((response) => response.clone().json().then((payload) => record(target, init && init.body, payload)).catch(() => {}))
          .catch(() => {});
      }
      return promise;
    };
  }

  if (window.XMLHttpRequest) {
    const origOpen = window.XMLHttpRequest.prototype.open;
    const origSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      this.__cueUrl = String(url);
      return origOpen.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.send = function (body) {
      const target = matchTarget(this.__cueUrl);
      if (target) {
        this.addEventListener('load', () => {
          try { record(target, body, JSON.parse(this.responseText)); } catch {}
        });
      }
      return origSend.apply(this, arguments);
    };
  }
})();
