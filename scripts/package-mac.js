const { spawnSync } = require('node:child_process');

// macOS 打包：universal（同时支持 Intel 与 Apple Silicon）的 DMG + zip（zip 供自动更新使用）
// 正式包的签名与公证在 CI 上做（证书 + App Store Connect API key），本地没有证书时产出未签名包
const builder = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const args = ['--mac', 'dmg', 'zip', '--universal'];
if (process.env.ELUNVI_MAC_NOTARIZE === '1') args.push('-c.mac.notarize=true');

const result = spawnSync(builder, args, { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
