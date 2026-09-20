const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function loadWindowFactory() {
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.urls = [];
      this.webContents = { setWindowOpenHandler() {} };
    }
    loadURL(url) { this.urls.push(url); return Promise.resolve(); }
  }
  const electron = {
    app: { setName() {}, on() {}, whenReady: () => ({ then() {} }) },
    BrowserWindow,
    session: { fromPartition: () => ({
      setPermissionRequestHandler() {},
      webRequest: { onBeforeSendHeaders() {} }
    }) }
  };
  const context = vm.createContext({
    require: (name) => name === 'electron' ? electron : name.startsWith('.') ? {} : require(name),
    __dirname: path.join(__dirname, '../src/main'),
    process, console
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8'), context);
  return vm.runInContext('createLoginWindow', context);
}

test('normal login still opens the merchant homepage', () => {
  const createWindow = loadWindowFactory();
  const window = createWindow('shop-1');
  assert.deepEqual(window.urls, ['https://mms.pinduoduo.com/']);
});
