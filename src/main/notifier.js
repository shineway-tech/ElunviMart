const crypto = require('node:crypto');
const { Notification } = require('electron');

function assertWebhook(kind, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Webhook 地址格式不正确');
  }
  const allowedHosts = kind === 'wecom'
    ? new Set(['qyapi.weixin.qq.com'])
    : new Set(['oapi.dingtalk.com', 'api.dingtalk.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new Error('Webhook 地址不是受支持的企业微信或钉钉地址');
  }
  return url;
}

function signDingTalk(url, secret) {
  if (!secret) return url;
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const signature = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('sign', signature);
  return url;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`消息发送失败（HTTP ${response.status}）`);
  return data;
}

async function sendChannelMessage(kind, config, message) {
  if (kind === 'desktop') {
    if (!Notification.isSupported()) throw new Error('当前系统不支持桌面通知');
    new Notification({ title: message.title, body: message.body }).show();
    return { ok: true };
  }
  const url = assertWebhook(kind, config.webhook);
  const content = `${message.title}\n${message.body}`;
  if (kind === 'wecom') {
    const result = await postJson(url, { msgtype: 'text', text: { content } });
    if (result.errcode && result.errcode !== 0) throw new Error(result.errmsg || '企业微信返回发送失败');
    return { ok: true };
  }
  signDingTalk(url, config.secret);
  const result = await postJson(url, { msgtype: 'text', text: { content } });
  if (result.errcode && result.errcode !== 0) throw new Error(result.errmsg || '钉钉返回发送失败');
  return { ok: true };
}

async function sendConfiguredNotifications(settings, message) {
  const tasks = [];
  if (settings.notifications.desktop) tasks.push(['desktop', {}]);
  for (const kind of ['wecom', 'dingtalk']) {
    const config = settings.notifications[kind];
    if (config.enabled && config.webhook) tasks.push([kind, config]);
  }
  const results = await Promise.allSettled(tasks.map(([kind, config]) => sendChannelMessage(kind, config, message)));
  return results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
}

async function sendChannelTest(kind, config) {
  const name = kind === 'wecom' ? '企业微信' : kind === 'dingtalk' ? '钉钉' : '桌面通知';
  return sendChannelMessage(kind, config, { title: 'Elunvi Mart', body: `${name}测试消息发送成功` });
}

module.exports = { assertWebhook, signDingTalk, sendChannelMessage, sendConfiguredNotifications, sendChannelTest };
