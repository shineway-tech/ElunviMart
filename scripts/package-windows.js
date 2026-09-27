const { spawnSync } = require('node:child_process');

// Windows 打包：NSIS 安装版（可自动更新）+ 免安装 portable
const builder = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const result = spawnSync(builder, [
  '--win',
  'nsis',
  'portable',
  '--x64'
], { stdio: 'inherit', shell: process.platform === 'win32' });

// Windows exposes the npm binary as a .cmd shim, which must be started through a shell.
// Keep the shell enabled only on Windows; macOS/Linux can execute the binary directly.

if (result.error) throw result.error;
process.exit(result.status ?? 1);
