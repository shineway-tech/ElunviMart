(function initPlatformUi(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ElunviPlatformUI = factory();
}(typeof globalThis === 'object' ? globalThis : this, function platformUiFactory() {
  function maskUserId(value) {
    const text = String(value || '');
    if (text.length <= 8) return text ? `${text.slice(0, 2)}****` : '未提供';
    return `${text.slice(0, 4)}****${text.slice(-4)}`;
  }

  function formatPoints(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) return '—';
    return Number(text).toLocaleString('zh-CN');
  }

  function paymentLabel(state) {
    return {
      pending: '等待支付',
      awaiting_payment: '等待支付',
      confirming: '平台确认中',
      paid: '充值成功',
      closed: '订单已关闭',
      failed: '支付失败',
      manual_review: '支付待人工确认',
      expired: '订单已过期'
    }[state] || '尚未发起支付';
  }

  function toPlatformViewModel(state = {}) {
    const authenticated = state.authenticated === true;
    const profile = state.profile || {};
    const wallet = state.wallet || {};
    const packages = Array.isArray(state.packages) ? state.packages : [];
    const attemptState = state.attempt?.state;
    const checkoutState = state.checkout?.state;
    const paymentState = attemptState || checkoutState || null;
    return {
      loginVisible: !authenticated,
      accountVisible: authenticated,
      userName: profile.displayName || '平台用户',
      userIdText: maskUserId(profile.userId),
      walletText: authenticated ? formatPoints(wallet.availableMicroPoints) : '登录后查看',
      packages,
      paymentStatus: paymentLabel(paymentState),
      qrPayload: state.attempt?.qrPayload || '',
      paymentDisabled: !authenticated || packages.length === 0 || state.paymentBusy === true,
      errorText: state.lastError?.message || state.errorMessage || ''
    };
  }

  function createIdempotencyKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderPlatform(root, state) {
    const model = toPlatformViewModel(state);
    const setText = (selector, value) => { const element = root.querySelector(selector); if (element) element.textContent = value; };
    const setHidden = (selector, hidden) => { const element = root.querySelector(selector); if (element) element.hidden = hidden; };
    setHidden('#platform-login-card', !model.loginVisible);
    setHidden('#platform-account-card', !model.accountVisible);
    setText('#platform-user-name', model.userName);
    setText('#platform-user-id', model.userIdText);
    setText('#platform-wallet-balance', model.walletText);
    setText('#platform-payment-status', model.paymentStatus);
    setText('#platform-payment-qr', model.qrPayload || '支付二维码将在创建支付后显示');
    setText('#platform-error', model.errorText);
    setHidden('#platform-error', !model.errorText);
    const packageSelect = root.querySelector('#platform-package');
    if (packageSelect) {
      packageSelect.replaceChildren(...model.packages.map((item) => {
        const option = root.ownerDocument.createElement('option');
        option.value = item.packageCode;
        option.textContent = `${item.packageCode} · ¥${(Number(item.amountFen) / 100).toFixed(2)} · ${formatPoints(item.totalMicroPoints)} 点`;
        return option;
      }));
    }
    const payButton = root.querySelector('#platform-pay');
    if (payButton) payButton.disabled = model.paymentDisabled;
    return model;
  }

  return { maskUserId, formatPoints, paymentLabel, toPlatformViewModel, createIdempotencyKey, renderPlatform };
}));
