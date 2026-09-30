// 报告上传：后端 /v1/app/reports 返回 { err_code, data: { object_key, url } }，
// 这里统一解包出公开链接——少解一层 data 会让通知里缺链接（踩过）
async function uploadReport(client, { title, html }) {
  if (!client) return '';
  const { data } = await client.request('/v1/app/reports', { method: 'POST', body: { title, html } });
  return String(data?.url || '');
}

module.exports = { uploadReport };
