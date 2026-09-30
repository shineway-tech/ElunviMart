// 客户端版本策略：向后端要 /v1/app/policy，判断自己是否被要求强制更新
function versionParts(version) {
  const matched = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/u);
  return matched ? [Number(matched[1]), Number(matched[2]), Number(matched[3])] : null;
}

function isBelowMinVersion(currentVersion, minVersion) {
  const min = String(minVersion || '').trim();
  if (!min) return false;
  const current = versionParts(currentVersion);
  const target = versionParts(min);
  if (!current || !target) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== target[index]) return current[index] < target[index];
  }
  return false;
}

// 拿不到策略（断网、后端没升级）时按"不强制"处理，不能把用户挡在门外
async function fetchPolicy({ apiBaseUrl, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  if (!apiBaseUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${String(apiBaseUrl).replace(/\/$/u, '')}/v1/app/policy`, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const data = payload?.data || {};
    const cost = Number(data.price_search?.cost_points);
    return {
      minClientVersion: String(data.min_client_version || '').trim(),
      downloadUrl: String(data.download_url || '').trim(),
      note: String(data.note || '').trim(),
      // 比价每次扣多少积分随策略下发，取不到按 10 处理
      priceSearchCostPoints: Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 10
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchPolicy, isBelowMinVersion, versionParts };
