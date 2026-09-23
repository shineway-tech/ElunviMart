const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('renderer exposes a clear signed-out entry and signed-in finance surfaces', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
  assert.match(html, /id="platform-login-modal"/);
  assert.match(html, /id="platform-account"/);
  assert.doesNotMatch(html, /id="account-limit"/);
  assert.doesNotMatch(renderer, /accountLimit/);
  assert.match(html, /class="sidebar-footer"[\s\S]*id="platform-account"/);
  assert.match(html, /id="platform-account-menu"/);
  assert.match(html, /id="platform-account-menu-profile"/);
  assert.match(html, /id="platform-account-menu-avatar"/);
  assert.match(html, /id="platform-account-menu-name"/);
  assert.match(html, /id="platform-account-team"[^>]*data-view="team"/);
  assert.match(html, /id="platform-account-wallet"[^>]*data-view="wallet"/);
  assert.match(html, /id="platform-account-wallet"[\s\S]*?<span>钱包<\/span>/);
  assert.doesNotMatch(html, /功能入口|账号设置/);
  assert.doesNotMatch(html, /platform-account-menu-heading/);
  assert.doesNotMatch(html, /class="nav-button platform-nav"/);
  assert.match(html, /id="platform-account-change-password"/);
  assert.match(html, /id="platform-account-logout"/);
  assert.match(html, /id="toast"[^>]*role="status"/);
  assert.match(styles, /\.platform-account-menu\{[^}]*right:auto;left:12px/);
  assert.match(styles, /\.platform-account-menu:after\{[^}]*right:auto;left:calc\(50% - 6px\)/);
  assert.match(styles, /\.app-shell\{[^}]*overflow:visible/);
  assert.match(styles, /\.sidebar\{[^}]*position:relative;z-index:2;[^}]*overflow:visible/);
  assert.match(styles, /\.toast\{[^}]*position:fixed/);
  assert.match(styles, /\.toast\{[^}]*left:50%;[^}]*top:50%/);
  assert.match(styles, /\.toast\{[^}]*z-index:100/);
  assert.match(renderer, /toastTimer/);
  assert.match(renderer, /setTimeout\(\(\) => \{ elements\.toast\.hidden = true;/);
  assert.match(renderer, /document\.querySelectorAll\('\[data-view\]'\)/);
  assert.match(renderer, /team\.role === MEMBER_ROLE_OWNER/);
  assert.match(renderer, /团队信息暂时无法加载/);
  assert.doesNotMatch(renderer, /renderTeam\(null\)/);
  assert.match(html, /id="wallet-view"/);
  assert.match(html, /id="team-view"/);
  assert.match(html, /id="payment-view"/);
  assert.match(html, /data-platform-auth-mode="register"/);
  assert.match(html, /id="platform-login-form"/);
  assert.match(html, /id="platform-register-form"/);
  assert.match(html, /id="platform-reset-form"/);
  assert.match(html, /id="platform-register-request-code"/);
  assert.match(html, /id="platform-reset-request-code"/);
  assert.match(html, /id="platform-wechat-start"/);
  assert.match(html, /id="platform-wechat-frame"/);
  assert.match(html, /id="platform-wechat-refresh"/);
  assert.match(html, /id="platform-wechat-countdown"/);
  assert.match(html, /class="platform-auth-brand"/);
  assert.match(html, /id="platform-reset-email"[^>]*readonly/);
  assert.match(renderer, /classList\.toggle\('is-password-change'/);
  assert.match(renderer, /state\.platformAuthMode === 'password-change' \? 'password-change'/);
  assert.match(renderer, /mode === 'password-change' \? ''/);
  assert.match(html, /id="platform-login-server-error"/);
  assert.match(html, /id="platform-register-server-error"/);
  assert.match(html, /id="platform-reset-server-error"/);
  assert.match(html, /id="platform-register-form"[\s\S]*?<span>注册<\/span>/);
  assert.match(html, /id="platform-reset-form"[\s\S]*?<span>提交<\/span>/);
  assert.match(html, /platform-field-error/);
  assert.match(html, /class="platform-auth-feedback"/);
  assert.match(html, /platform-auth-illustration\.png/);
  assert.match(html, /本地商家的店铺监控助手/);
  assert.match(html, /更专注，更高效/);
  assert.match(html, /让生意看得更清楚/);
  assert.match(html, /data-password-toggle="platform-login-password"/);
  assert.match(html, /data-password-toggle="platform-register-password"/);
  assert.match(html, /data-password-toggle="platform-reset-password"/);
  assert.match(html, /id="platform-register-password"[^>]*maxlength="20"/);
  assert.match(html, /id="platform-reset-password"[^>]*maxlength="20"/);
  assert.match(html, /assets\/wechat-mark\.svg/);
  assert.match(html, /data-lucide="external-link"/);
  assert.match(html, /data-lucide="log-in"/);
  assert.match(html, /data-lucide="send"/);
  assert.match(html, /data-lucide="message-circle-more"/);
  assert.match(html, /<script src="vendor\/lucide\.js"><\/script>/);
  assert.doesNotMatch(html, /\.\.\/\.\.\/node_modules\/lucide/);
  assert.doesNotMatch(html, /id="platform-login-close"/);
  assert.doesNotMatch(html, /id="platform-auth-tabs"/);
});

test('teams, wallet and payment surfaces are driven by the mart client', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/renderer/preload.js'), 'utf8');

  assert.match(html, /id="team-plan-list"/);
  assert.match(html, /id="wallet-package-list"/);
  assert.match(html, /id="wallet-summary-card"/);
  assert.match(html, /id="payment-simulate"/);
  assert.match(html, /id="team-code-field"[\s\S]*id="team-action-code"/);

  assert.match(preload, /invoke\('mart:inviteMember'/);
  assert.match(preload, /invoke\('mart:acceptInvitation'/);
  assert.match(preload, /invoke\('mart:membershipQuote'/);
  assert.match(preload, /invoke\('mart:rechargeOrder'/);
  assert.match(preload, /invoke\('mart:simulatePayment'/);
  assert.doesNotMatch(preload, /platform:createCheckout|platform:teamMembers|platform:billingContexts/);

  assert.match(renderer, /window\.pddMonitor\.mart\.membershipQuote/);
  assert.match(renderer, /window\.pddMonitor\.mart\.acceptInvitation/);
  assert.match(renderer, /window\.pddMonitor\.mart\.walletTransactions/);
  // 渲染用的辅助函数必须存在，别再被重构顺手删掉
  for (const helper of ['planLabel', 'tableEmptyRow', 'renderPager', 'renderOrderTable', 'setTabCount', 'applyWalletRole', 'resolveCurrentTeam', 'canAddAccount', 'applyAccountQuota', 'renderAccountFooter', 'confirmAction', 'closeConfirmModal']) {
    assert.ok(renderer.includes(`function ${helper}(`), `缺少辅助函数 ${helper}`);
  }
  // 切团队要同时同步 teamId 和当前团队对象，否则并行加载会读到上一个团队
  assert.match(renderer, /state\.mart\.team = next \|\| null;/);
  // Mart 会话接上时，正开着的团队/钱包页要自己重载
  assert.match(renderer, /function handleMartChanged\(payload\)/);
  assert.match(renderer, /if \(isViewVisible\('wallet'\)\) void loadWalletData\(\)/);
  // 邮箱注册用户没有昵称：不显示平台占位昵称，用邮箱 @ 前那截，头像退回首字
  assert.match(renderer, /PLACEHOLDER_DISPLAY_NAMES/);
  assert.match(renderer, /platformDisplayName\(profile, accountEmail\)/);
  assert.match(renderer, /platform-avatar-initial/);
  // 破坏性操作走主题内的确认弹窗，不用系统原生 confirm
  assert.match(html, /id="confirm-modal"/);
  assert.match(html, /id="confirm-modal-submit"/);
  assert.doesNotMatch(renderer, /window\.confirm\(/);
  assert.doesNotMatch(html, /id="remove-account-modal"/);
  // 成员席位满了（含未开通会员）就不给邀请入口
  assert.match(renderer, /const memberFull = usedMembers >= maxMembers/);
  assert.match(renderer, /invite\.disabled = true/);
  // 商家账号页：额度脚注 + 未开通会员时禁止添加
  assert.match(html, /id="accounts-footer"/);
  assert.doesNotMatch(html, /<h2>账号列表<\/h2>/);
  assert.match(renderer, /elements\.addAccount\.disabled = !allowed/);
  assert.match(renderer, /elements\.accountsFooter\.hidden/);
  assert.doesNotMatch(renderer, /window\.pddMonitor\.platform\.(team|wallet|createCheckout|packages)/);
});
