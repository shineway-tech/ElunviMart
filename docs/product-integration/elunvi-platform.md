# Elunvi Mart 接入 ElunviPlatform

## 已登记的公开配置

- API：`https://elunvi-api.honeykid.cn`
- product code：`elunvi-mart`
- 产品：Elunvi Mart
- macOS client ID：`elunvi-mart-macos`
- Windows client ID：`elunvi-mart-windows`
- 回调协议：`elunvi-mart://auth/callback`
- scopes：`profile:read wallet:read payments:read payments:write`
- 产品状态：已启用
- 客户端状态：macOS、Windows 均已启用

Client ID、audience 和 scopes 是平台登记的公开身份配置，不是密钥。客户端不得自行改写这些值，也不得把后台管理员凭据、用户密码、refresh token、支付凭据或 Webhook 写入仓库。

## 后台核验

1. 打开 [ElunviPlatform 管理后台](https://elunvi-admin.honeykid.cn/)，进入 Elunvi Mart 控制台。
2. 在“接入配置”确认两个桌面端均为已启用，平台分别为 macOS 和 Windows，回调协议为 `elunvi-mart://auth/callback`。
3. 在“产品用户”确认登录后的用户归属为 `elunvi-mart`。
4. 在“订单与支付”确认 checkout、支付尝试和最终状态来自平台事实。
5. 在“点数流水”确认充值或消费流水按产品和 client ID 归属。

## 支持团队

客户端保留平台的团队账号边界：团队成员、owner 转移、邀请和团队钱包由 ElunviPlatform 账号流程及运营后台负责，Elunvi Mart 不在本地保存团队成员或支付凭据，也不提供成员管理入口。

`Elunvi Mart Support` 团队需要由运营方使用已批准的平台注册用户作为 owner，再邀请支持成员。当前产品接入已完成且客户端已按产品/client 归属接入；创建团队时不要使用商家账号 ID 代替平台 user ID，也不要在代码中写入个人邮箱或密码。创建后应使用该团队账号核验 Elunvi Mart 用户、订单和点数流水的只读范围。

## 故障排查

- 登录或刷新失败：记录界面展示的 request ID，确认对应 client ID 和平台产品状态。
- 余额不一致：以后台钱包和点数流水为准，客户端只重新读取 `/v1/me/wallet`，不在本地加减余额。
- `manual_review`、过期或未知支付状态：保留 checkout 号和 request ID，等待平台最终状态，不重复创建订单。
- 修改产品代码、client ID、audience、回调或 scopes 前，先同步更新 ElunviPlatform 登记和客户端配置测试。
