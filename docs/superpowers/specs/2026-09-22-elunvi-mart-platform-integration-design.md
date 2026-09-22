# Elunvi Mart Platform Integration Design

日期：2026-09-22
状态：已获用户确认的设计方向，待规格审阅

## 1. 目标与边界

Elunvi Mart 当前是一个独立的 Electron 拼多多商家监控客户端，账号、登录状态和提醒设置主要保存在本地 SQLite。此次改造将它接入 ElunviPlatform，使平台统一负责用户身份、会话、钱包点数和充值支付；拼多多商家账号仍由 Elunvi Mart 独立管理，不能与平台用户凭据混用。

本轮交付目标：

1. 在 ElunviPlatform 注册独立产品 `elunvi-mart`。
2. 为桌面客户端配置独立 client，建议命名为 `elunvi-mart-desktop`，具体值以后台分配结果为准。
3. 支持平台邮箱/微信设备登录、会话刷新、退出登录和当前用户资料展示。
4. 展示平台钱包余额和充值入口；充值通过平台 checkout 和微信/支付宝支付尝试完成。
5. 在平台后台为 Elunvi Mart 配置与已有产品相同职责的支持团队，支持账号、用户、订单和点数流水查询。
6. 保留当前拼多多商家账号、商品同步、提醒渠道和本地监控设置，不把这些业务迁移到平台。

不在本轮范围内：

- 自动填写或保存拼多多账号密码；
- 在客户端实现支持团队成员管理、转让或删除；
- 客户端直接修改平台余额、订单状态或账本；
- 自建支付通道、保存支付密钥或绕过平台支付状态；
- 将后台管理员凭据、API token、refresh token 或支付信息写入仓库。

## 2. 平台配置与支持团队

平台后台先创建一条公开启用的产品记录：

```text
product_code = elunvi-mart
app_type = desktop
display_name = Elunvi Mart
```

随后为 Windows 和 macOS 桌面端登记 client。客户端只使用后台分配的 `client_id`、API base URL、产品 audience 和 scopes；这些属于公开客户端配置，不包含服务端 secret。建议首批 scopes 为：

```text
profile:read
wallet:read
payments:read
payments:write
```

后台应为 `elunvi-mart` 创建一个独立的支持团队，团队名称使用明确的产品前缀，例如 `Elunvi Mart Support`。团队 owner/member 的实际用户由运营方在后台选择和邀请；代码中不写死任何个人账号、邮箱或密码。支持团队只用于运营查看和团队钱包/账单上下文，客户端第一版不提供团队成员管理界面。

产品注册和支持团队创建属于后台运营配置，不由客户端启动时自动创建。接入配置成功后，应在后台确认产品用户、订单与支付、点数流水和团队权限页面均能按 `elunvi-mart` 过滤。

## 3. 客户端架构

当前项目使用 CommonJS Electron 主进程和受限 preload API。平台接入遵循现有边界：

```text
renderer/app.js
  -> preload.js 受限 API
  -> main.js IPC 编排
  -> platform-client.js 平台会话/用户/钱包/支付
  -> ElunviPlatform HTTPS API
```

新增 `src/main/platform-client.js`，只负责平台 HTTP、设备登录状态、用户/钱包/支付响应校验和错误映射；它不读写拼多多 Store、不操作 DOM、不创建 BrowserWindow。`main.js` 负责把平台 client 接入 Electron 生命周期和 IPC；`preload.js` 只暴露最小化的 `platform` API；`app.js` 负责登录、账户状态、余额、充值和退出登录的页面状态。

平台 client 优先复用 ElunviPlatform SDK 的公开合同。如果当前项目的 CommonJS/Electron 构建无法直接消费 SDK 的 ESM 包，则在当前仓库使用与 SDK 合同一致的薄 REST 适配层，并把路径、请求头、scope、响应校验和错误码集中在一个模块，不复制业务规则到多个页面。

## 4. 登录与会话

登录使用平台的设备登录流程，不与拼多多商家登录窗口共享会话：

1. 客户端创建平台登录事务，生成并保存一次性 PKCE verifier 和设备状态。
2. 使用系统浏览器打开平台授权页面，支持平台已配置的邮箱或微信登录方式。
3. 客户端轮询设备会话，成功后交换 access token 和 refresh token。
4. 通过 `/v1/me/profile` 和 `/v1/me/wallet` 加载当前用户与余额。
5. access token 只在主进程内存中使用；refresh token 通过 Electron `safeStorage` 加密后落盘。
6. 退出登录时调用平台 logout，清除本地安全存储和内存会话。

renderer 不接触 refresh token、设备 secret、PKCE verifier 或完整 `ipcRenderer`。登录失败、过期、取消、网络错误和平台稳定错误码必须转换为中文可理解提示，并保留 request ID 供支持团队排查。

## 5. 用户资料、钱包与支付

平台身份区显示当前用户的展示名、头像、平台用户 ID 的掩码形式和登录状态。商家账号列表仍显示拼多多店铺身份，页面明确区分“平台用户”和“拼多多商家账号”。

钱包区读取平台余额，不在本地缓存可变余额作为事实来源。充值流程为：

1. 获取平台公开点数套餐。
2. 创建 checkout，使用随机幂等键，显示金额、点数和过期时间。
3. 选择微信或支付宝并创建 payment attempt。
4. 在客户端显示平台返回的二维码 payload 或支付提示。
5. 轮询 checkout 状态，只有平台返回 `paid` 后刷新钱包；`manual_review`、超时和不确定状态必须显示为待处理，不得重复创建订单或自行加点。
6. 用户取消时关闭未支付 checkout。

支付 API 请求必须带 client ID、scope 和幂等键；客户端不得保存支付密钥、外部支付凭据或伪造成功状态。

## 6. IPC 合同

新增 IPC 通道使用 `platform:动作` 命名，并只传递可结构化克隆的普通数据：

```text
platform:status       -> { authenticated, profile, wallet, lastError }
platform:login:start  -> { authorizationUrl, expiresAt, pollIntervalSeconds }
platform:login:poll   -> { state, profile?, wallet?, error? }
platform:logout       -> void
platform:packages     -> PointPackage[]
platform:checkout     -> PaymentCheckout
platform:payment      -> PaymentAttempt
platform:checkout:get  -> PaymentCheckout
platform:checkout:close -> PaymentCheckout
```

其中设备登录的内部 secret 和 token 不通过 IPC 返回。新增通道必须同步更新 `preload.js`、`app.js` 和测试；主进程错误统一使用用户可理解的中文消息和稳定 code。

## 7. 本地数据与迁移

现有 SQLite Store 继续保存拼多多商家账号、商品快照、监控设置和通知配置。可以新增一个最小的平台会话元数据记录，只保存加密 refresh token、平台用户 ID、最后同步时间和上次错误摘要；不保存 access token、密码、验证码、设备 secret 或支付信息。

如果当前 Store 的迁移机制适合承载平台会话，则加入版本化 SQLite migration；否则新增独立的 Electron `safeStorage` 文件，并通过原子写入保证损坏时可以清除并重新登录。设计与实现必须选择一种方式，不能同时维护两套平台会话事实。

## 8. 错误与安全

- API 只允许 HTTPS 的 `https://elunvi-api.honeykid.cn`，开发环境只允许 loopback HTTP。
- 所有平台请求设置超时，非 2xx 响应解析稳定错误 code、message、retryable 和 request ID。
- 401/过期响应只触发一次 refresh；刷新失败则清除本地会话并要求重新登录。
- 平台用户和拼多多商家账号使用不同的标识和存储路径，不能用店铺 ID 代替平台 user ID。
- 不提交后台登录密码、refresh token、Webhook、支付密钥、设备会话或用户数据。
- Content Security Policy 保持禁止渲染层直连外部网络；所有网络请求走主进程。

## 9. 测试与验收

当前项目至少新增以下测试：

1. 平台配置校验拒绝错误 product code、client ID、scope 和非 HTTPS API 地址。
2. 登录轮询覆盖 pending、signed in、expired、取消和 API 错误。
3. token store 使用 safeStorage 读写，无法解密时会清除并要求重新登录。
4. profile/wallet 响应必须匹配产品和 client attribution，错误结构不会污染本地状态。
5. checkout 创建使用幂等键；支付状态只在 `paid` 后刷新余额；manual review 不重复下单。
6. preload 只暴露规定的 platform 方法，renderer 不可访问 token 或任意 IPC。
7. 现有拼多多同步、SQLite、通知和调度测试继续通过。

验收顺序：

1. 后台产品、client 和支持团队配置完成；
2. 本地客户端可通过系统浏览器完成平台登录并显示用户资料；
3. 钱包余额与后台一致；
4. 测试套餐 checkout 可创建，支付状态处理符合平台返回；
5. 支持账号能在后台查看 Elunvi Mart 用户、订单和点数流水；
6. 运行 `npm test`、两个 `node --check` 检查，并确认仓库没有敏感文件。

## 10. 后续兼容

平台 API 合同、client ID 和 scopes 由 ElunviPlatform 管理。若平台 SDK 版本升级，先更新平台合同与适配层测试，再更新客户端；不要在 UI 中散落 API 路径或自行推断平台响应字段。
