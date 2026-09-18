const { spawnSync } = require('node:child_process');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, [
  '--yes',
  'electron-builder@26.0.12',
  '--win',
  'portable',
  '--x64'
], { stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
