const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initUpdater, createUpdateController, isPortableBuild, updatesSupported,
} = require('../src/main/updater');

function fakeAutoUpdater() {
  const listeners = new Map();
  return {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checks: 0,
    installed: 0,
    on(event, handler) { listeners.set(event, handler); },
    emit(event, payload) { listeners.get(event)?.(payload); },
    async checkForUpdates() { this.checks += 1; },
    quitAndInstall() { this.installed += 1; }
  };
}

test('updater stays off unless the app is packaged', () => {
  assert.equal(updatesSupported({ isPackaged: false }), false);
  assert.equal(updatesSupported({ isPackaged: true }), true);
  const updater = initUpdater({ isPackaged: false, sendToRenderer: () => { throw new Error('不该通知渲染层'); } });
  assert.equal(updater.enabled, false, '开发环境不检查更新');
});

test('portable builds are detected from the electron-builder env', () => {
  assert.equal(isPortableBuild({}), false);
  assert.equal(isPortableBuild({ PORTABLE_EXECUTABLE_DIR: '/tmp/elunvi-mart' }), true);
});

test('a downloaded update notifies the renderer and can be installed', async () => {
  const autoUpdater = fakeAutoUpdater();
  const events = [];
  const updater = createUpdateController({
    autoUpdater,
    sendToRenderer: (channel, payload) => events.push({ channel, payload }),
    checkIntervalMs: 60_000
  });
  try {
    assert.equal(autoUpdater.checks, 1, '初始化时先查一次');
    assert.equal(autoUpdater.autoDownload, true);
    assert.deepEqual(updater.install(), { ok: false, reason: 'not-ready' }, '还没下载完不能装');

    autoUpdater.emit('update-downloaded', { version: '1.2.3' });
    assert.deepEqual(events, [{ channel: 'app:update-ready', payload: { version: '1.2.3', portable: false } }]);
    assert.deepEqual(updater.install(), { ok: true, version: '1.2.3' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(autoUpdater.installed, 1, '重启安装');
  } finally {
    updater.stop();
  }
});

test('portable builds never auto-install, they only announce', async () => {
  const autoUpdater = fakeAutoUpdater();
  const events = [];
  const updater = createUpdateController({
    autoUpdater,
    portable: true,
    sendToRenderer: (channel, payload) => events.push({ channel, payload }),
    checkIntervalMs: 60_000
  });
  try {
    autoUpdater.emit('update-downloaded', { version: '1.2.3' });
    assert.deepEqual(events[0].payload, { version: '1.2.3', portable: true });
    assert.equal(autoUpdater.autoInstallOnAppQuit, false, '免安装版退出时也不该尝试安装');
    assert.deepEqual(updater.install(), { ok: false, reason: 'portable' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(autoUpdater.installed, 0);
  } finally {
    updater.stop();
  }
});
