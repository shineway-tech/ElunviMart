const { spawnSync } = require('node:child_process');

const builder = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const result = spawnSync(builder, [
  '--win',
  'portable',
  '--x64'
], { stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
