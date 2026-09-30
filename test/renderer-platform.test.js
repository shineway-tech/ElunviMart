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
  // 提示统一走中间浮层：不再有顶部内联 notice，错误用红色 toast
  assert.doesNotMatch(html, /id="notice"/);
  assert.match(styles, /\.toast\.is-error\{/);
  assert.match(renderer, /function showError\(error, fallback = ''\)/);
  assert.match(renderer, /已开启「\$\{name\}」的提醒/);
  // 菜单叫“设置”
  assert.match(html, /<i data-lucide="settings"><\/i><span>设置<\/span>/);
  assert.match(renderer, /elements\.title\.textContent = '设置';/);
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
  assert.match(html, /id="payment-hero"/);
  assert.match(html, /id="payment-status-chip"/);
  assert.match(html, /id="payment-purchase-bar"/);
  assert.match(html, /id="payment-info-actions"/);
  assert.match(html, /id="payment-sheet"/);
  assert.match(html, /id="payment-countdown"/);
  assert.match(html, /id="payment-qr-card"/);
  assert.match(html, /id="payment-qr-code"/);
  assert.doesNotMatch(html, /id="payment-qr-browser"/);
  assert.doesNotMatch(html, /id="payment-channels"/);
  assert.match(html, /vendor\/qrcode-generator\.js/);
  assert.doesNotMatch(html, /payment-status-card/);
  assert.match(html, /id="team-code-field"[\s\S]*id="team-action-code"/);

  assert.match(preload, /invoke\('mart:inviteMember'/);
  assert.match(preload, /invoke\('mart:acceptInvitation'/);
  assert.match(preload, /invoke\('mart:membershipQuote'/);
  assert.match(preload, /invoke\('mart:rechargeOrder'/);
  assert.match(preload, /invoke\('mart:simulatePayment'/);
  assert.match(preload, /invoke\('mart:orderContext'/);
  assert.match(preload, /invoke\('app:info'/);
  assert.match(preload, /invoke\('app:updateInstall'/);
  assert.match(preload, /invoke\('app:updateCheck'/);
  assert.match(preload, /onForceUpdate/);
  assert.match(preload, /invoke\('app:updateOpenDownload'/);
  assert.match(preload, /onUpdateReady/);
  assert.match(html, /id="update-banner"/);
  assert.match(html, /id="update-banner-action"/);
  assert.match(renderer, /window\.pddMonitor\.app\.onUpdateReady\(/);
  assert.ok(renderer.includes('function showUpdateBanner('), '缺少更新提示条渲染函数');
  assert.match(html, /id="sidebar-version"/);
  assert.match(html, /id="sidebar-version-action"/);
  assert.match(html, /id="force-update-modal"/);
  assert.match(html, /id="force-update-submit"/);
  for (const helper of ['renderSidebarVersion', 'runUpdateCheck', 'showForceUpdate', 'runForceUpdateAction']) {
    assert.ok(renderer.includes(`function ${helper}(`), `缺少更新辅助函数 ${helper}`);
  }
  assert.match(renderer, /window\.pddMonitor\.app\.onForceUpdate\(/);
  assert.doesNotMatch(preload, /platform:createCheckout|platform:teamMembers|platform:billingContexts/);

  assert.match(renderer, /window\.pddMonitor\.mart\.membershipQuote/);
  assert.match(renderer, /window\.pddMonitor\.mart\.acceptInvitation/);
  assert.match(renderer, /window\.pddMonitor\.mart\.walletTransactions/);
  // 二维码模式拿到的码串本地渲染，别再退回独立窗口
  assert.match(renderer, /qr\.createSvgTag\(/);
  assert.match(renderer, /payment_params\?\.qr_code/);
  // 二维码会过期：进支付页必须重新拉码，不能复用上一次的（历史上这么干过）
  assert.match(renderer, /刷新二维码/);
  assert.doesNotMatch(renderer, /latest_attempt/);
  // 渲染用的辅助函数必须存在，别再被重构顺手删掉
  for (const helper of ['planLabel', 'tableEmptyRow', 'renderPager', 'renderOrderTable', 'setTabCount', 'applyWalletRole', 'resolveCurrentTeam', 'canAddAccount', 'applyAccountQuota', 'renderAccountFooter', 'confirmAction', 'closeConfirmModal', 'renderPaymentOrder', 'renderPaymentPurchaseBar', 'renderPaymentQrCard', 'startOrderExpireCountdown', 'startPaymentForOrder', 'isOrderExpired', 'isLocalBackend']) {
    assert.ok(renderer.includes(`function ${helper}(`), `缺少辅助函数 ${helper}`);
  }
  // 侧边栏账号块下面独立的团队/积分块
  assert.match(html, /id="platform-account-summary"[\s\S]*id="platform-account-team-name"[\s\S]*id="platform-account-points"/);
  assert.match(renderer, /function renderSidebarAccount\(\)/);
  assert.match(renderer, /function loadSidebarAccount\(\)/);
  // 侧边栏的切换团队按钮与菜单
  assert.match(html, /id="platform-account-switch"[\s\S]*id="team-switch-menu"/);
  assert.match(html, /class="summary-icon"/);
  assert.match(renderer, /function toggleTeamSwitchMenu\(\)/);
  assert.match(renderer, /function closeTeamSwitchMenu\(\)/);
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
  // 「继续支付」只出现在还没超时的待支付订单上（超时/关单后列表里就没有入口）
  assert.match(renderer, /if \(order\.status === 1 && !expired\) \{[\s\S]{0,200}继续支付/);
  // 报价陈旧时服务端会拒绝发起支付并关单，界面要回读订单状态
  const beginPaymentSource = renderer.slice(
    renderer.indexOf('async function beginPayment'),
    renderer.indexOf('function startOrderPolling')
  );
  assert.match(beginPaymentSource, /catch \(error\) \{[\s\S]*await refreshPaymentOrder\(false\);/);
  // 商家账号页：额度脚注 + 未开通会员时禁止添加
  assert.match(html, /id="accounts-footer"/);
  assert.doesNotMatch(html, /<h2>账号列表<\/h2>/);
  assert.match(renderer, /elements\.addAccount\.disabled = !allowed/);
  assert.match(renderer, /elements\.accountsFooter\.hidden/);
  assert.doesNotMatch(renderer, /window\.pddMonitor\.platform\.(team|wallet|createCheckout|packages)/);
});

test('merchant rows open the shop backend in that account merchant window', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/renderer/preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  assert.match(renderer, /data-account-action="shop"/);
  assert.match(renderer, /accounts\.openShopHome\(account\.id\)/);
  assert.match(preload, /openShopHome: \(accountId\) => ipcRenderer\.invoke\('accounts:openShopHome', accountId\)/);
  // 商家后台只能开在 app 内的商家窗口：openShopHome 不允许走系统浏览器/外部链接入口
  assert.doesNotMatch(preload, /openShopHome: \(accountId\) => ipcRenderer\.invoke\('app:openExternal'/);
  // 复用该账号的商家窗口（partition 里有登录态），不往系统浏览器丢
  const handler = main.slice(
    main.indexOf("ipcMain.handle('accounts:openShopHome'"),
    main.indexOf("ipcMain.handle('accounts:remove'")
  );
  assert.match(handler, /createLoginWindow\(accountId, \{ deferNavigation: true \}\)/);
  assert.match(handler, /window\.loadURL\(MERCHANT_HOME_URL\)/);
  assert.doesNotMatch(handler, /shell\.openExternal/);
  // 需要登录时商品/后台入口点不进去，行里只留登录和移除
  assert.match(renderer, /const online = account\.status === 'active'/);
  assert.match(renderer, /const browseActions = online[\s\S]{0,420}data-account-action="view"[\s\S]{0,420}data-account-action="shop"[\s\S]{0,240}: ''/);
  assert.match(renderer, /if \(online\) \{[\s\S]{0,220}data-account-action="view"[\s\S]{0,220}data-account-action="shop"/);
});

test('sync failures from an expired login are actionable and the back button sits on the right', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  // 报错给出可照做的提示，而不是 Electron 的原始 IPC 报文
  assert.match(renderer, /尚未捕获拼多多后台请求签名[\s\S]{0,120}重新登录/);
  assert.match(renderer, /Error invoking remote method '\[\^'\]\+': \(\?:\[A-Za-z_\$\]\[\\w\$\]\*\):/);
  // 返回按钮和顶部操作区在同一组里，落在界面右侧
  assert.match(html, /topbar-actions[\s\S]{0,400}id="page-back"/);
});

test('product rows can open the merchant bid detail sheet', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/renderer/preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
  // 报名详情是页内视图（不是弹窗），返回按钮回到商品列表
  assert.match(html, /class="view detail-view" id="product-detail-view"/);
  assert.doesNotMatch(html, /product-detail-modal/);
  assert.match(html, /id="product-detail-rows"/);
  assert.match(renderer, /state\.subView = 'product-detail'/);
  assert.match(renderer, /function backFromProductDetail\(\)/);
  assert.match(renderer, /if \(state\.subView === 'product-detail'\)/);
  // 列与商家后台「查看报名详情」保持一致
  assert.match(html, /<th>参考商品规格<\/th><th>竞价商品规格<\/th><th>线上库存<\/th><th>拼单价\(元\)<\/th><th>参考价\(元\)<\/th><th>报名商品报名价\(元\)<\/th><th>中标状态<\/th>/);
  assert.match(renderer, /data-product-action="detail"/);
  assert.match(renderer, /products\.detail\(accountId, product\.id\)/);
  assert.match(renderer, /BID_WIN_STATUS_CLASSES/);
  // 弹窗只列规格表格，不再带活动/ID 之类的附加信息
  assert.doesNotMatch(html, /product-detail-meta|product-detail-note|product-detail-refresh/);
  assert.match(preload, /detail: \(accountId, productId\) => ipcRenderer\.invoke\('products:detail', \{ accountId, productId \}\)/);
  assert.match(main, /ipcMain\.handle\('products:detail'/);
  // 详情走"静默开页面抓取"：按"店铺+商品"缓存，2 分钟内直接读 SQLite，没有请求次数限制
  assert.match(main, /const DETAIL_CACHE_TTL_MS = 2 \* 60_000/);
  assert.doesNotMatch(main, /DETAIL_REQUEST_LIMIT|DETAIL_REQUEST_WINDOW_MS|detailRequestAtByAccount/);
  assert.match(main, /store\.getProductDetail\(accountId, productId\)/);
  assert.match(main, /store\.setProductDetail\(accountId, product\.id, \{ rows, fetchedAt: changedAt \}\)/);
  assert.match(main, /store\.addProductDetailChanges\(accountId, product\.id, changes\)/);
  // 自动巡检：同步成功后按策略补抓详情，跳过全中标商品，间隔按轮次时长平摊
  // 详情巡检只跟自动检测走，手动同步只同步列表
  assert.match(main, /if \(source === 'scheduled'\) void runDetailSweep\(accountId\);/);
  assert.match(main, /selectDetailCandidates\(\{ products, detailByProductId, intervalMs, batchSize \}\)/);
  assert.match(main, /sweepStepMs\(\{ batchSize: batch\.length, cycleMinutes \}\)/);
  // 每轮变化报告：生成 HTML → 上传后端 → 提醒里带链接
  assert.match(main, /buildDetailReportHtml\(account, changes, roundAt\)/);
  // 通知只摘要前 2 条，其余靠报告链接
  assert.match(main, /const lines = changes\.slice\(0, 2\)\.map/);
  // 上传解包在 report-upload 里做：少解一层 data 会让提醒缺链接
  assert.match(main, /link = await uploadReport\(martClientInstance, \{ title, html \}\)/);
  assert.match(main, /const \{ uploadReport \} = require\('\.\/report-upload'\)/);
  // 详情页掉登录也要标记掉线（列表同步之外的第二条路径）
  assert.match(main, /function merchantLoginExpiredError\(\)/);
  assert.match(main, /error\.accountOffline = true/);
  assert.match(main, /throw merchantLoginExpiredError\(\)/);
  assert.match(main, /await markAccountOffline\(account, error, 'detail'\)/);
  assert.match(main, /detail sweep stopped at \$\{product\.id\}: 账号需要重新登录/);
  assert.match(main, /if \(error\?\.accountOffline === true\) return true/);
  assert.match(main, /offline alert failed/, '掉线提醒发失败要留痕');
  // 规格表列多：grid 子项必须允许收缩，否则宽表格会撑破容器把「比价」列挤到窗口外
  assert.match(styles, /\.detail-view:not\(\[hidden\]\)>\*\{min-width:0\}/);
  assert.match(styles, /#product-detail-table th:last-child,#product-detail-table td:last-child\{position:sticky;right:0/);
  assert.match(styles, /#product-detail-table th,#product-detail-table td\{padding-left:8px;padding-right:8px\}/);
  assert.match(renderer, /拼多多商家后台登录已失效，请在店铺列表点「重新登录」后恢复监控/);

  // 弹窗里的“最近变化” + IPC
  assert.match(html, /id="product-detail-changes"/);
  assert.match(renderer, /loadProductDetailChanges\(accountId, product\.id\)/);
  assert.match(preload, /detailChanges: \(accountId, productId, limit = 10\) => ipcRenderer\.invoke\('products:detailChanges'/);
  assert.match(main, /ipcMain\.handle\('products:detailChanges'/);
  // 每个店铺可单独关通知：所有按店铺的提醒都过 sendAccountNotifications
  assert.match(main, /async function sendAccountNotifications\(account, message\)/);
  assert.match(main, /if \(account && account\.notificationsEnabled === false\) return \[\];/);
  assert.equal((main.match(/sendAccountNotifications\(account,/g) || []).length >= 4, true, '汇总/变化报告/掉线/催登录都走开关');
  assert.match(main, /ipcMain\.handle\('accounts:setNotify'/);
  assert.match(preload, /setNotify: \(accountId, enabled\) => ipcRenderer\.invoke\('accounts:setNotify'/);
  // 开关就在店铺列表行上（不在设置页）
  assert.match(html, /<th>提醒<\/th>/);
  assert.match(renderer, /data-account-notify/);
  assert.match(renderer, /accounts\.setNotify\(account\.id, notifyInput\.checked\)/);
  assert.doesNotMatch(html, /id="account-notify-list"/);
  // 规格列带缩略图
  assert.match(renderer, /detail-thumb/);
  assert.match(renderer, /row\.referenceImage/);
  assert.match(renderer, /row\.bidImage/);
  // 检测间隔按 30 分钟一档
  assert.match(html, /id="interval-min"><option value="30">30 分钟<\/option><option value="60">60 分钟<\/option>/);
  assert.doesNotMatch(html, /id="interval-min"><option value="5">/);
  assert.match(main, /检测间隔需要是 30 分钟的整数倍/);
  assert.match(renderer, /function snapIntervalOption\(select, value\)/);
  // 手动同步冷却 2 分钟，主进程与渲染层保持一致
  assert.match(main, /const MANUAL_SYNC_COOLDOWN_MS = 120_000/);
  assert.match(renderer, /function startSyncCooldown\(accountId, durationMs = 120_000\)/);
  // 同一账号同时只读一个详情（换成抓页面后不再需要时间间隔冷却）
  assert.match(main, /const detailFetchingByAccount = new Set\(\)/);
  assert.match(main, /detailFetchingByAccount.add\(accountId\)/);
  assert.doesNotMatch(main, /DETAIL_MIN_INTERVAL_MS|detailLastFetchAtByAccount/);
  assert.match(main, /const \{ buildDetailUrl, fetchDetailPage, isLoginPage, parseDetailTable \} = require\('\.\/pdd-detail-page'\)/);
  assert.match(main, /fetchDetailPage\(\{/);
  assert.match(main, /parseDetailTable\(table\)/);
  assert.doesNotMatch(main, /readDetailBlock|writeDetailBlock/);
});

test('sku rows expose jd/taobao price search with points confirmation', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/renderer/preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '../src/main/mart-service.js'), 'utf8');

  // 规格表多一列比价入口，两个渠道各一个按钮
  assert.match(html, /<th class="detail-action-head">比价<\/th>/);
  assert.match(renderer, /const PRICE_CHANNELS = \[\['jd', '京东'\], \['taobao', '淘宝'\]\]/);
  assert.match(renderer, /button\.dataset\.priceChannel = channel/);
  assert.match(renderer, /async function querySkuPrice\(channel, row\)/);
  // 每次点击都要确认，并写清消耗多少积分
  assert.match(renderer, /本次查询消耗 \$\{cost\} 积分（从团队积分扣除，当前余额 \$\{formatPoints\(balance\)\} 积分）/);
  assert.match(renderer, /const confirmed = await confirmAction\(\{/);
  // 关键词 = 干净的商品名 + 规格关键词，去掉后台标签
  assert.match(renderer, /function priceKeywordFor\(product, spec\)/);
  assert.match(renderer, /选报规格\|必报规格\|终止竞标\|已有其余商品提报/);
  // 价格上限：优先拼单价（当前售价），其次报名价、参考价；同款判定用活动商品名
  assert.match(renderer, /function rowPriceCap\(row\)/);
  assert.match(renderer, /\['groupPrice', 'bidPrice', 'referencePrice'\]/);
  assert.match(renderer, /function priceProductName\(product\)/);
  assert.match(renderer, /只保留低于当前售价 ¥\$\{cap\.toFixed\(2\)\} 的同款/);
  assert.match(renderer, /productName, maxPrice, accountId, productId/);
  assert.match(renderer, /function priceFilterNote\(result\)/);
  assert.match(renderer, /已过滤 \$\{skipped\} 条配件\/不同型号/);
  assert.match(renderer, /没有找到符合条件的同款，下面是按价格筛出的结果/);
  assert.match(service, /product_name: productName/);
  assert.match(service, /max_price: Number\(maxPrice\) > 0 \? Number\(maxPrice\) : 0/);
  // 结果弹窗：价格升序、条数来源提示、消耗与余额、重新查询
  assert.match(html, /id="price-modal"/);
  assert.match(html, /data-close-price-modal/);
  assert.match(html, /id="price-modal-requery"/);
  assert.match(renderer, /function renderPriceResults\(result\)/);
  assert.match(renderer, /结果来自 5 分钟内的缓存（本次仍按一次查询计费）/);
  assert.match(renderer, /本次消耗 \$\{formatPoints\(cost\)\} 积分 · 余额 \$\{formatPoints\(balance\)\} 积分/);
  assert.match(renderer, /elements\.priceModalRequery\.addEventListener\('click'/);
  assert.match(styles, /\.price-item\{[^}]*grid-template-columns:22px 40px minmax\(0,1fr\) auto/);
  assert.match(styles, /\.detail-action-cell\{/);
  // 查询后立刻更新侧边栏积分
  assert.match(renderer, /function applyWalletBalance\(teamId, balancePoints\)/);
  assert.match(renderer, /applyWalletBalance\(teamId, result\?\.balance_points\)/);
  // 单价由后端策略下发，取不到按 10
  assert.match(renderer, /state\.priceSearch\.costPoints/);
  assert.match(main, /priceSearchCostPoints/);
  // 扣分与缓存都在后端：渲染层不缓存、不算账
  assert.doesNotMatch(renderer, /priceSearchCache|price_cache/);
  assert.match(service, /async priceSearch\(\{/);
  assert.match(service, /'\/v1\/app\/price-search'/);
  assert.match(preload, /priceSearch: \(input\) => ipcRenderer\.invoke\('mart:priceSearch', input\)/);
  assert.match(main, /ipcMain\.handle\('mart:priceSearch'/);
  // 商品链接只放行京东/淘宝/天猫
  assert.match(main, /const PRICE_LINK_HOSTS = \['jd\.com', 'taobao\.com', 'tmall\.com'\]/);
  assert.match(main, /ipcMain\.handle\('app:openExternal'/);
  // 白名单校验：非京东/淘宝/天猫的 https 地址一律拒绝
  assert.match(main, /PRICE_LINK_HOSTS\.some\(\(suffix\) => host === suffix \|\| host\.endsWith\(`\.\$\{suffix\}`\)\)/);
  assert.match(preload, /openExternal: \(url\) => ipcRenderer\.invoke\('app:openExternal', url\)/);
  // force-update 弹窗先前重复了一份，已删掉重复节点
  assert.equal((html.match(/id="force-update-modal"/g) || []).length, 1);
});
