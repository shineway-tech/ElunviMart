// 会话诊断信息：只记 cookie 的数量与名字，绝不记录取值
// mms 侧的登录态是 api_uid + 一组滚动 key（rckk/ru1k/ru2k…），PASS_ID 那套是老的
const LOGIN_COOKIE_HINTS = ['api_uid', 'rckk', 'PASS_ID', 'PDD_USER_ID'];

function summarizeCookies(cookies = []) {
  const list = Array.isArray(cookies) ? cookies : [];
  const alive = list.filter((cookie) => !cookie.expired);
  const names = [...new Set(alive.map((cookie) => String(cookie.name || '')).filter(Boolean))];
  const hints = LOGIN_COOKIE_HINTS.filter((name) => names.some((item) => item.toLowerCase() === name.toLowerCase()));
  return {
    total: list.length,
    alive: alive.length,
    names: names.slice(0, 10),
    hasLoginCookie: hints.length > 0,
  };
}

function formatCookieSummary(summary) {
  const suffix = summary.names.length ? ` [${summary.names.join(',')}]` : '';
  return `mms cookie 有效 ${summary.alive}/${summary.total} | ${summary.hasLoginCookie ? '有 api_uid（像已登录）' : '没有 api_uid（可能未登录）'}${suffix}`;
}

// 需要 electron 的分区对象；拿不到就返回一句说明，不影响主流程
async function describeSession(partition, { session } = {}) {
  try {
    const target = session || require('electron').session.fromPartition(partition);
    const cookies = await target.cookies.get({ domain: 'pinduoduo.com' });
    return formatCookieSummary(summarizeCookies(cookies));
  } catch (error) {
    return `cookie 读取失败: ${error.message}`;
  }
}

module.exports = { describeSession, formatCookieSummary, summarizeCookies, LOGIN_COOKIE_HINTS };
