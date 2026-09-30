const test = require('node:test');
const assert = require('node:assert/strict');
const syncLog = require('../src/main/sync-log');

test('sync log keeps a bounded ring buffer and formats a pasteable block', () => {
  syncLog.clear();
  syncLog.append('sync', '开始手动同步', '店铺: 朝气数码专营店');
  syncLog.append('list', '没等到列表请求', '停留页面: https://mms.pinduoduo.com/login/ | 页面提示: 扫码登录 账号登录');
  const text = syncLog.format({ 版本: '1.0.0', 系统: 'darwin 25.6.0', 店铺: '朝气数码专营店(active)' });
  assert.match(text, /=== Elunvi Mart 同步诊断日志 ===/);
  assert.match(text, /版本: 1\.0\.0/);
  assert.match(text, /\[sync\] 开始手动同步 \| 店铺: 朝气数码专营店/);
  assert.match(text, /\[list\] 没等到列表请求 \| 停留页面: https:\/\/mms\.pinduoduo\.com\/login\//);
  assert.match(text, /=== 日志结束 ===/);

  for (let index = 0; index < syncLog.MAX_ENTRIES + 20; index += 1) {
    syncLog.append('sync', `第 ${index} 条`);
  }
  assert.equal(syncLog.snapshot().length, syncLog.MAX_ENTRIES, '超出上限只留最近若干条');

  syncLog.clear();
  assert.equal(syncLog.snapshot().length, 0);
});
