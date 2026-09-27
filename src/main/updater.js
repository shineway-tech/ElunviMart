// 自动更新：只对打包版生效（源码运行 / 未打包时静默跳过，避免开发环境报错）。
// 更新源见 package.json 的 publish 配置（OSS 上的 latest-mac.yml / latest.yml）。
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function updatesSupported({ isPackaged }) {
  return Boolean(isPackaged);
}

// electron-builder 的免安装（portable）包会设这个变量：没有可覆盖的安装目录，装不了更新
function isPortableBuild(env = process.env) {
  return Boolean(env.PORTABLE_EXECUTABLE_DIR);
}

// 与 electron-updater 解耦的控制器，便于单测：只依赖传入的 autoUpdater 接口
function createUpdateController({ autoUpdater, portable = false, sendToRenderer = () => {}, checkIntervalMs = CHECK_INTERVAL_MS }) {
  const state = { readyVersion: '' };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = !portable;
  autoUpdater.on('update-downloaded', (info) => {
    state.readyVersion = String(info?.version || '');
    console.error(`[updater] update downloaded: ${state.readyVersion}${portable ? ' (portable)' : ''}`);
    sendToRenderer('app:update-ready', { version: state.readyVersion, portable });
  });
  autoUpdater.on('error', (error) => {
    console.error(`[updater] check failed: ${error?.message || error}`);
  });

  const check = () => { void autoUpdater.checkForUpdates().catch(() => {}); };
  // 手动检查：把 electron-updater 的结果整理成渲染层能直接用的状态
  const checkNow = async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (state.readyVersion) return { status: 'ready', version: state.readyVersion };
      if (result?.isUpdateAvailable) return { status: 'downloading', version: String(result?.updateInfo?.version || '') };
      return { status: 'latest', version: '' };
    } catch (error) {
      console.error(`[updater] check failed: ${error?.message || error}`);
      return { status: 'error', version: '' };
    }
  };
  check();
  const timer = setInterval(check, checkIntervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    enabled: true,
    portable,
    readyVersion: () => state.readyVersion,
    check,
    checkNow,
    install: () => {
      if (portable) return { ok: false, reason: 'portable' };
      if (!state.readyVersion) return { ok: false, reason: 'not-ready' };
      setImmediate(() => autoUpdater.quitAndInstall());
      return { ok: true, version: state.readyVersion };
    },
    stop: () => clearInterval(timer),
  };
}

function initUpdater({ isPackaged, sendToRenderer }) {
  if (!updatesSupported({ isPackaged })) return { enabled: false };
  const { autoUpdater } = require('electron-updater');
  return createUpdateController({ autoUpdater, portable: isPortableBuild(), sendToRenderer });
}

module.exports = {
  initUpdater, createUpdateController, isPortableBuild, updatesSupported, CHECK_INTERVAL_MS,
};
