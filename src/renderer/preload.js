const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pddMonitor', {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    startLogin: (accountId) => ipcRenderer.invoke('accounts:startLogin', accountId),
    completeLogin: (accountId) => ipcRenderer.invoke('accounts:completeLogin', { accountId }),
    remove: (accountId) => ipcRenderer.invoke('accounts:remove', accountId)
  },
  products: {
    list: (accountId) => ipcRenderer.invoke('products:list', accountId),
    sync: (accountId) => ipcRenderer.invoke('products:sync', accountId)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings)
  },
  notifications: {
    test: (kind, config) => ipcRenderer.invoke('notifications:test', { kind, config })
  },
  onAccountsChanged: (callback) => ipcRenderer.on('accounts:changed', callback)
});
