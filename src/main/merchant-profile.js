function normalizeMerchantProfile(profile = {}) {
  return {
    displayName: String(profile.displayName || '').trim(),
    avatarUrl: String(profile.avatarUrl || '').trim(),
    mallId: profile.mallId === undefined || profile.mallId === null ? '' : String(profile.mallId).trim()
  };
}

const PROFILE_KEYS = {
  displayName: ['mall_name', 'shop_name', 'store_name', 'merchant_name', 'mallName', 'shopName', 'storeName', 'merchantName'],
  avatarUrl: ['mall_logo', 'shop_logo', 'store_logo', 'merchant_logo', 'avatar_url', 'logo_url', 'logo', 'mallLogo', 'shopLogo', 'avatarUrl', 'logoUrl'],
  mallId: ['mall_id', 'shop_id', 'store_id', 'merchant_id', 'mallId', 'shopId', 'storeId', 'merchantId']
};

function firstField(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function findMerchantProfileInPayloads(payloads) {
  let best = { profile: normalizeMerchantProfile(), score: 0 };
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const candidate = normalizeMerchantProfile({
      displayName: firstField(value, PROFILE_KEYS.displayName),
      avatarUrl: firstField(value, PROFILE_KEYS.avatarUrl),
      mallId: firstField(value, PROFILE_KEYS.mallId)
    });
    const score = (candidate.displayName ? 3 : 0) + (candidate.avatarUrl ? 3 : 0) + (candidate.mallId ? 2 : 0);
    if (score > best.score && (candidate.displayName || candidate.avatarUrl || candidate.mallId)) best = { profile: candidate, score };
    for (const child of Object.values(value)) visit(child);
  };
  for (const payload of Array.isArray(payloads) ? payloads : []) visit(payload);
  return best.profile;
}

module.exports = { normalizeMerchantProfile, findMerchantProfileInPayloads };
