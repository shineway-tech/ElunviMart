const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pddMonitor', {
  platform: {
    state: () => ipcRenderer.invoke('platform:state'),
    login: (credentials) => ipcRenderer.invoke('platform:login', credentials),
    requestRegistrationCode: (email) => ipcRenderer.invoke('platform:requestRegistrationCode', email),
    completeRegistration: (input) => ipcRenderer.invoke('platform:completeRegistration', input),
    requestPasswordResetCode: (email) => ipcRenderer.invoke('platform:requestPasswordResetCode', email),
    resetPassword: (input) => ipcRenderer.invoke('platform:resetPassword', input),
    wechatStart: () => ipcRenderer.invoke('platform:wechatStart'),
    wechatPoll: () => ipcRenderer.invoke('platform:wechatPoll'),
    emailBindingCode: (email) => ipcRenderer.invoke('platform:emailBindingCode', email),
    emailBindingComplete: (input) => ipcRenderer.invoke('platform:emailBindingComplete', input),
    accountEmailBindingCode: (email) => ipcRenderer.invoke('platform:accountEmailBindingCode', email),
    accountEmailBindingComplete: (input) => ipcRenderer.invoke('platform:accountEmailBindingComplete', input),
    accountPasswordCode: (email) => ipcRenderer.invoke('platform:accountPasswordCode', email),
    accountPasswordComplete: (input) => ipcRenderer.invoke('platform:accountPasswordComplete', input),
    wechatCancel: () => ipcRenderer.invoke('platform:wechatCancel'),
    logout: () => ipcRenderer.invoke('platform:logout'),
    profile: () => ipcRenderer.invoke('platform:profile'),
    security: () => ipcRenderer.invoke('platform:security')
  },
  mart: {
    state: () => ipcRenderer.invoke('mart:state'),
    link: () => ipcRenderer.invoke('mart:link'),
    teams: () => ipcRenderer.invoke('mart:teams'),
    teamMembers: (teamId) => ipcRenderer.invoke('mart:teamMembers', teamId),
    inviteMember: (input) => ipcRenderer.invoke('mart:inviteMember', input),
    removeMember: (input) => ipcRenderer.invoke('mart:removeMember', input),
    leaveTeam: (teamId) => ipcRenderer.invoke('mart:leaveTeam', teamId),
    acceptInvitation: (code) => ipcRenderer.invoke('mart:acceptInvitation', code),
    membership: (teamId) => ipcRenderer.invoke('mart:membership', teamId),
    membershipQuote: (input) => ipcRenderer.invoke('mart:membershipQuote', input),
    membershipOrder: (input) => ipcRenderer.invoke('mart:membershipOrder', input),
    wallet: (teamId) => ipcRenderer.invoke('mart:wallet', teamId),
    walletPackages: () => ipcRenderer.invoke('mart:walletPackages'),
    walletTransactions: (input) => ipcRenderer.invoke('mart:walletTransactions', input),
    rechargeOrder: (input) => ipcRenderer.invoke('mart:rechargeOrder', input),
    order: (orderId) => ipcRenderer.invoke('mart:order', orderId),
    orders: (input) => ipcRenderer.invoke('mart:orders', input),
    paymentAttempt: (input) => ipcRenderer.invoke('mart:paymentAttempt', input),
    closeOrder: (orderId) => ipcRenderer.invoke('mart:closeOrder', orderId),
    syncOrder: (orderId) => ipcRenderer.invoke('mart:syncOrder', orderId),
    openPayWindow: (payUrl) => ipcRenderer.invoke('mart:openPayWindow', payUrl),
    openPayUrl: (payUrl) => ipcRenderer.invoke('mart:openPayUrl', payUrl),
    simulatePayment: (orderId) => ipcRenderer.invoke('mart:simulatePayment', orderId)
  },
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
  preferences: {
    get: (key) => ipcRenderer.invoke('preferences:get', key),
    set: (key, value) => ipcRenderer.invoke('preferences:set', { key, value })
  },
  onAccountsChanged: (callback) => ipcRenderer.on('accounts:changed', callback),
  onPlatformChanged: (callback) => ipcRenderer.on('platform:changed', (_event, payload) => callback(payload)),
  onMartChanged: (callback) => ipcRenderer.on('mart:changed', (_event, payload) => callback(payload)),
  onPayWindowClosed: (callback) => ipcRenderer.on('mart:payWindowClosed', () => callback())
});
