// Runs inside the merchant page. Only invoke existing, read-only UI controls.
function clickBidPageControl(page) {
  if (location.origin !== 'https://mms.pinduoduo.com' || location.pathname !== '/act-bidding/market-sign-list') {
    throw new Error('营销竞价页面地址已变化，请重新登录或检查页面');
  }
  const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const enabled = element => !element.closest('[disabled], [aria-disabled="true"], [class*="disabled"]');
  const text = element => (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim();
  const unique = elements => [...new Set(elements)].filter(visible).filter(element =>
    !elements.some(other => other !== element && element.contains(other) && visible(other)));
  const paginations = [...document.querySelectorAll('[class*="pagination" i], [aria-label="分页"]')].filter(visible);
  const controls = [...new Set(paginations.flatMap(root => [...root.querySelectorAll('button, [role="button"], li[title], a')]))].filter(visible);
  const active = paginations.flatMap(root => [...root.querySelectorAll('[aria-current="page"], [class*="item-active"]')]).find(visible);
  let matches;
  if (page === 1) {
    // When on a later page, navigating back produces a fresh first-page request.
    matches = active && Number(active.textContent.trim()) > 1
      ? controls.filter(element => /^(1|第\s*1\s*页|page\s*1)$/i.test(text(element)))
      : [...document.querySelectorAll('button, [role="button"]')].filter(element => /^(查\s*询|搜\s*索)$/.test(text(element)));
  } else {
    if (active && Number(active.textContent.trim()) !== page - 1) return { clicked: false };
    matches = controls.filter(element => /^(下一页|下页|next|next page)$/i.test(text(element)));
  }
  // Match labels before collapsing nested nodes: pagination titles may live on a parent li.
  matches = unique(matches);
  if (!matches.length) return { clicked: false };
  if (matches.length !== 1) throw new Error('营销页面查询或分页控件不唯一，已停止同步');
  const descendants = [...matches[0].querySelectorAll('button, [role="button"], a')].filter(visible);
  if (descendants.length > 1) throw new Error('营销分页控件包含多个操作，已停止同步');
  const target = descendants[0] || matches[0];
  if (!enabled(target)) return { clicked: false };
  target.click();
  return { clicked: true };
}
module.exports = { clickBidPageControl };
