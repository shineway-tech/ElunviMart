# 发布与打包

客户端（Electron）通过 electron-builder 打包，正式发布由 GitHub Actions 在标签触发：
macOS 出**通用包**（一个 DMG 同时支持 Intel 与 Apple Silicon，签名 + 公证），
Windows 出 **NSIS 安装包**（可应用内自动更新）和 **免安装 portable**。

## 版本与标签

版本以 `package.json` 的 `version` 为准。发版前把版本号改好并提交，然后打标签：

```bash
# 例如 1.0.1
git tag v1.0.1 && git push origin v1.0.1
```

`release-desktop.yml` 会先校验标签（去掉 `v`）与 `package.json` 版本完全一致，不一致直接失败。
手动触发（workflow_dispatch）只构建、不发 Release，可用于验证流水线。

## 产物

| 平台 | 文件 |
| --- | --- |
| macOS 通用 | `Elunvi-Mart-<version>-macos-universal.dmg`（分发用）、`Elunvi-Mart-<version>-macos-universal.zip`（自动更新用） |
| Windows x64 | `Elunvi-Mart-<version>-windows-x64-setup.exe`（安装版，支持应用内更新）、`Elunvi-Mart-<version>-windows-x64-portable.exe`（免安装） |
| 更新清单 | `latest-mac.yml` / `latest.yml`（electron-builder 生成，供 electron-updater 读取） |

产物同时上传到 GitHub Release 和 OSS（`https://static.honeykid.cn`）：

```text
public/elunvi_mart/<version>/<file>    版本路径，长期保留
public/elunvi_mart/<file>              稳定路径，应用内更新读这里
```

## 本地打包（无签名，仅冒烟）

```bash
pnpm install
pnpm run package:mac     # release/ 下出未签名 DMG（无证书时不会公证）
pnpm run package:win     # 需要 Windows 或 wine
```

本地未签名包只用于验证界面与启动，不能对外分发：macOS 上会提示"未验证的开发者"。

## 签名与公证

CI 用 GitHub Secrets（与 ArtForgeStudio 同账号，可直接复用）：

- `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `KEYCHAIN_PASSWORD`：Developer ID Application 证书（p12 的 base64 与密码）
- `APPLE_API_ISSUER` / `APPLE_API_KEY`（Key ID）/ `APPLE_API_KEY_BASE64`（.p8 内容）：App Store Connect API key，用于 notarytool 公证
- `ALIYUN_OSS_REGION` / `ALIYUN_OSS_BUCKET` / `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET`（可选 `ALIYUN_OSS_ENDPOINT`）：OSS 上传

`package:mac` 在 `ELUNVI_MAC_NOTARIZE=1` 时让 electron-builder 走公证，之后工作流再对 DMG 做 `stapler staple`。
日志里出现 `notarization` 相关失败时，用 `xcrun notarytool log <submission-id>` 看原因。

## 版本号、手动检查与强制更新

- **侧边栏底部**显示 `Elunvi Mart v<版本>`，右侧小图标是更新入口：默认「检查更新」（点击立即查一次）、有新版本时变成红色的下载/重启图标（点击执行更新动作）。
- **手动检查**结果会用轻提示反馈：已是最新版 / 发现新版本正在下载 / 下载完成弹右下角提示条；源码运行会提示"当前是开发版"。
- **强制更新**由后端下发：`GET /v1/app/policy` 返回 `min_client_version`，低于它的客户端会弹**不可关闭**的「需要更新后才能继续使用」弹窗（按钮：立即更新 → 下载完变「重启更新」，免安装版为「去下载」）。配置在 `backend/configs/<env>.yaml` 的 `app` 段，留空即不强制；改完重启 API 生效，不需要发客户端。
- 拿不到策略（断网/后端没升级）时按"不强制"处理，不能把用户挡在门外。

## 应用内自动更新

- 打包版启动时检查 `https://static.honeykid.cn/public/elunvi_mart/latest-<platform>.yml`，后台下载完成后在窗口右下角提示"新版本已下载，重启即可更新"。
- **安装版**（macOS DMG 安装、Windows setup.exe）点「重启更新」即可完成；**免安装 portable** 装不了更新，提示里给的是「去下载」。
- 源码运行（未打包）不会检查更新，避免开发时报错。
- 发布顺序：先让 CI 把产物与 `latest*.yml` 都传上 OSS，用户端在下一次启动或 6 小时内就会看到提示。
