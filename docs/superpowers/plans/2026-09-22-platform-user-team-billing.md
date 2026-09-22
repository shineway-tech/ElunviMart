# Mart Platform 用户、团队与支付接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ElunviMart 的 Electron 客户端中接入 Platform 用户、团队钱包、充值支付、订单和流水，并保持现有商家监控界面的简洁风格。

**Architecture:** Electron 主进程直连 Platform API，使用系统安全存储保存会话；renderer 通过受限 preload IPC 获取账号、团队、钱包和支付状态。Platform 是用户、团队、钱包、支付和流水的唯一权威，本地 SQLite 只保存按用户隔离的店铺与监控数据。

**Tech Stack:** Electron CommonJS、Node 24 内置 fetch/node:sqlite、HTML/CSS/vanilla JS、Node test runner。

**Spec:** `docs/elunvi-integration/2026-09-22-user-and-team-overview.md` 与 Motion `origin/main` 团队/钱包客户端契约。

## Global Constraints

- 不修改 ElunviMotion 或 ElunviPlatform。
- 不在 renderer 或 localStorage 保存 Platform refresh token。
- 未登录、会话失效或首次改密未完成时不得使用商家、商品和监控功能。
- 个人/团队付款身份由 Platform 返回的 billing context 决定，不能本地伪造。
- 支付成功只以 Platform checkout 的 `paid` 状态为准。
- 团队钱包失效时不自动回退个人钱包。
- 个人、团队钱包、订单和流水只做短期展示缓存，不作为权威数据。
- 现有本地店铺、商品和拼多多登录态仍保存在当前电脑。
- 运行时配置通过 `ELUNVI_PLATFORM_API_BASE_URL`、`ELUNVI_PLATFORM_CLIENT_ID` 等非敏感配置读取，不能写入服务端密钥。

## Review Focus

- access token 过期刷新期间并发请求必须只执行一次 refresh，失败后统一返回登录状态。
- 切换用户后旧请求结果不能写入新用户的账号、钱包或订单状态。
- 团队钱包权限不足时不应静默使用个人钱包。
- 支付订单身份必须与创建时的 billing context 一致，状态未知时只能恢复原订单。
- 未登录时既不能通过按钮也不能通过 IPC 直接读取店铺、商品和通知配置。

### Task 1: Platform 会话与请求客户端

**Files:**
- Create: `src/main/platform-client.js`
- Create: `src/main/platform-session.js`
- Create: `test/platform-client.test.js`
- Create: `test/platform-session.test.js`

**Produces:**
- `PlatformClient`：统一 HTTP、超时、错误码、Bearer token 和 refresh。
- `PlatformSession`：登录/刷新/退出/当前状态，使用注入的 token store。

- [ ] 写请求错误、401 refresh、超时和 token store 的失败测试。
- [ ] 运行测试确认 RED。
- [ ] 实现最小客户端和会话状态机。
- [ ] 运行测试确认 GREEN。

### Task 2: 用户、团队、钱包和支付主进程服务

**Files:**
- Create: `src/main/platform-service.js`
- Modify: `src/main/main.js`
- Modify: `src/main/store.js`
- Create: `test/platform-service.test.js`
- Create: `test/platform-store.test.js`

**Produces:**
- 用户资料、安全状态、团队快照、billing contexts、钱包、订单、流水查询。
- 个人/团队 checkout、支付 attempt、订单恢复。
- 按 Platform user ID 隔离本地数据库目录。
- 所有受保护 IPC 在主进程校验登录状态。

- [ ] 写服务调用和登录门禁测试。
- [ ] 运行 RED。
- [ ] 接入主进程服务、safeStorage token store、IPC。
- [ ] 运行 GREEN。

### Task 3: 认证、团队和钱包界面

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.js`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/preload.js`
- Create: `test/renderer-auth.test.js`

**Produces:**
- 登录/注册/找回密码入口。
- 顶部账号状态、团队入口、钱包入口。
- 团队成员、个人/团队钱包和余额展示。
- 未登录锁定业务界面，沿用当前深色侧栏、白色内容卡片和红色主按钮风格。

- [ ] 写渲染状态门禁和数据安全测试。
- [ ] 运行 RED。
- [ ] 实现界面和 IPC 调用。
- [ ] 运行 GREEN。

### Task 4: 充值、订单和流水界面

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.js`
- Modify: `src/renderer/styles.css`
- Modify: `src/main/main.js`
- Create: `test/platform-payment.test.js`

**Produces:**
- 个人/团队支付身份选择。
- 套餐、微信/支付宝支付入口。
- checkout 状态轮询、恢复和关闭。
- 个人钱包流水、团队消费和团队充值流水。
- loading、empty、error、permission denied 和未知支付状态。

- [ ] 写 checkout 身份冻结、paid 确认和分页流水测试。
- [ ] 运行 RED。
- [ ] 实现支付和流水 UI。
- [ ] 运行 GREEN。

### Task 5: 监控任务登录门禁与验证

**Files:**
- Modify: `src/main/main.js`
- Modify: `src/renderer/app.js`
- Modify: `src/renderer/preload.js`
- Modify: `src/main/scheduler.js`
- Modify: `test/main-sync.test.js`
- Modify: `test/scheduler.test.js`

- [ ] 写未登录无法读取/同步、退出停止调度的测试。
- [ ] 运行 RED。
- [ ] 添加门禁、退出清理和按用户隔离。
- [ ] 运行完整测试、语法检查和 UI 静态检查。

