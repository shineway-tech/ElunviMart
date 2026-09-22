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
  platform: {
    status: () => ipcRenderer.invoke('platform:status'),
    loginWithPassword: (email, password) => ipcRenderer.invoke('platform:login:password', { email, password }),
    startWechatLogin: () => ipcRenderer.invoke('platform:login:startWechat'),
    completeWechatLogin: () => ipcRenderer.invoke('platform:login:completeWechat'),
    refresh: () => ipcRenderer.invoke('platform:refresh'),
    logout: () => ipcRenderer.invoke('platform:logout'),
    packages: () => ipcRenderer.invoke('platform:packages'),
    createCheckout: (packageCode, idempotencyKey) => ipcRenderer.invoke('platform:checkout', { packageCode, idempotencyKey }),
    createPaymentAttempt: (checkoutId, channel) => ipcRenderer.invoke('platform:payment', { checkoutId, channel }),
    getCheckout: (checkoutId) => ipcRenderer.invoke('platform:getCheckout', checkoutId),
    closeCheckout: (checkoutId) => ipcRenderer.invoke('platform:checkout:close', checkoutId)
  },
  onAccountsChanged: (callback) => ipcRenderer.on('accounts:changed', callback)
});
