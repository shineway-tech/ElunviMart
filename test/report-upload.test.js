const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadReport } = require('../src/main/report-upload');

test('uploadReport unwraps the response envelope into a public link', async () => {
  const calls = [];
  const client = {
    request: async (pathname, options) => {
      calls.push({ pathname, options });
      return { err_code: 0, err_msg: '', data: { object_key: 'reports/2026-09-30/abcd.html', url: 'https://elunvi-mart.honeykid.cn/reports/2026-09-30/abcd.html' } };
    }
  };
  const link = await uploadReport(client, { title: '拼多多中标变化：测试店', html: '<p>x</p>' });
  // 少解一层 data 就会出现"提醒里没有链接"，这里把契约钉住
  assert.equal(link, 'https://elunvi-mart.honeykid.cn/reports/2026-09-30/abcd.html');
  assert.equal(calls[0].pathname, '/v1/app/reports');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.body, { title: '拼多多中标变化：测试店', html: '<p>x</p>' });
});

test('uploadReport degrades to an empty link when the client is missing or the url is absent', async () => {
  assert.equal(await uploadReport(null, { title: 't', html: '<p>x</p>' }), '');
  const noUrl = { request: async () => ({ data: { object_key: 'k' } }) };
  assert.equal(await uploadReport(noUrl, { title: 't', html: '<p>x</p>' }), '');
});

test('uploadReport surfaces upload failures so the caller can log them', async () => {
  const failing = { request: async () => { throw new Error('HTTP 502'); } };
  await assert.rejects(uploadReport(failing, { title: 't', html: '<p>x</p>' }), /HTTP 502/);
});
