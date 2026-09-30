const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDetailUrl, isLoginPage, parseDetailTable, specText } = require('../src/main/pdd-detail-page');

test('builds the same detail url the merchant backend opens', () => {
  assert.equal(
    buildDetailUrl({
      activityId: '24110',
      activityGoodsId: '11283183856643',
      templateGoodsPkId: '20720152',
      goodsId: '983324669443',
      activityType: 205
    }),
    'https://mms.pinduoduo.com/act-bidding/ten-billion-bid-detail?id=24110&enrollId=11283183856643&bidGoodsId=20720152&goodsId=983324669443&bannerType=205'
  );
});

test('parses the scraped spec table by header name', () => {
  const cell = (text, image) => ({ lines: text.split(' | '), image: image || '' });
  const table = {
    headers: ['参考商品规格', '竞价商品规格', '线上库存', '拼单价(元)', '参考价(元)', '报名商品报名价(元)', '规格中标状态', '曝光顺序'],
    rows: [
      [cell('选报规格 | 天青色，4GB+128GB，Wifi版', 'https://img/a.jpeg'), cell('天青色，4GB+128GB，Wifi版', 'https://img/b.jpeg'), cell('40'), cell('1099.00'), cell('1068.00'), cell('1065.50'), cell('等待曝光中'), cell('3')],
      [cell('必报规格 | 黑色'), cell('黑色 | 8GB+256GB'), cell('2'), cell('3699.00'), cell(''), cell('2960.00'), cell('暂无选标资格'), cell('1')]
    ]
  };
  assert.deepEqual(parseDetailTable(table), [
    { referenceSpec: '天青色，4GB+128GB，Wifi版', referenceImage: 'https://img/a.jpeg', bidSpec: '天青色，4GB+128GB，Wifi版', bidImage: 'https://img/b.jpeg', stock: '40', groupPrice: '1099.00', referencePrice: '1068.00', bidPrice: '1065.50', winStatus: '等待曝光中' },
    { referenceSpec: '黑色', referenceImage: '', bidSpec: '黑色 8GB+256GB', bidImage: '', stock: '2', groupPrice: '3699.00', referencePrice: '', bidPrice: '2960.00', winStatus: '暂无选标资格' }
  ]);
});

test('keeps working when a column is missing or the table is empty', () => {
  assert.deepEqual(parseDetailTable(null), []);
  const rows = parseDetailTable({ headers: ['参考商品规格', '规格中标状态'], rows: [[{ lines: ['选报规格', '规格A'] }, { lines: ['曝光中'] }]] });
  assert.equal(rows[0].referenceSpec, '规格A');
  assert.equal(rows[0].winStatus, '曝光中');
  assert.equal(rows[0].groupPrice, '');
});

test('strips the enrollment tags from the reference spec cell', () => {
  assert.equal(specText(['选报规格', '规格A']), '规格A');
  assert.equal(specText(['必报规格', '已有其余商品提报', '规格B']), '规格B');
});

test('the list sync uses a preload capture hook instead of a devtools debugger', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const page = fs.readFileSync(path.join(__dirname, '../src/main/pdd-bid-page.js'), 'utf8');
  const hook = fs.readFileSync(path.join(__dirname, '../src/main/pdd-page-hook.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  // 挂调试协议会被拼多多识别成自动化（实测会被弹回登录页），必须走 preload
  assert.doesNotMatch(page, /debugger\.attach|sendCommand/);
  assert.match(page, /preload: path\.join\(__dirname, 'pdd-page-hook\.js'\)/);
  assert.match(page, /contextIsolation: false/);
  assert.match(hook, /\/lakemms\/bid\/query\/bidList/);
  assert.match(hook, /window\.__cueBidList/);
  assert.match(hook, /window\.__cueMallInfo/);
  // 只收页面自己发的请求，不主动 fetch
  assert.doesNotMatch(hook, /origFetch\(/);
  // 登录窗口也挂钩子读店铺资料，主进程里不再有我们发起的拼多多接口调用
  assert.match(main, /preload: path\.join\(__dirname, 'pdd-page-hook\.js'\)/);
  assert.match(main, /window\.__cueMallInfo/);
  assert.doesNotMatch(main, /fetch\('\/earth\/api/);
  // 店铺资料读页面自身状态（localStorage.new_userinfo + DOM），不调接口
  assert.match(main, /localStorage\.getItem\('new_userinfo'\)/);
  assert.match(main, /mall\.mall_name/);
  assert.doesNotMatch(main, /fetch\('\/lakemms/);
});

test('recognises the merchant login page so a dead session is reported as offline', () => {
  assert.equal(isLoginPage({ url: 'https://mms.pinduoduo.com/login/?redirectUrl=x' }), true);
  assert.equal(isLoginPage({ text: '扫码登录 账号登录 打开拼多多商家版App扫码登录' }), true, '跳到登录页时按文案也能认出来');
  assert.equal(isLoginPage({ text: '还没有店铺？0元开店 商家入驻' }), true);
  assert.equal(isLoginPage({ url: 'https://mms.pinduoduo.com/act-bidding/ten-billion-bid-detail?a=1' }), false);
  assert.equal(isLoginPage({ url: '', text: '参考商品规格 竞价商品规格 中标状态' }), false);
  assert.equal(isLoginPage(), false);
});
