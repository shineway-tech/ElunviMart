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
    wechatCancel: () => ipcRenderer.invoke('platform:wechatCancel'),
    logout: () => ipcRenderer.invoke('platform:logout'),
    profile: () => ipcRenderer.invoke('platform:profile'),
    security: () => ipcRenderer.invoke('platform:security'),
    team: () => ipcRenderer.invoke('platform:team'),
    teamMembers: (teamId) => ipcRenderer.invoke('platform:teamMembers', teamId),
    createTeam: (name) => ipcRenderer.invoke('platform:createTeam', name),
    addTeamMember: (input) => ipcRenderer.invoke('platform:addTeamMember', input),
    respondTeamRequest: (input) => ipcRenderer.invoke('platform:respondTeamRequest', input),
    billingContexts: () => ipcRenderer.invoke('platform:billingContexts'),
    wallet: (walletOwnerId) => ipcRenderer.invoke('platform:wallet', walletOwnerId),
    walletTransactions: (cursor) => ipcRenderer.invoke('platform:walletTransactions', cursor),
    teamHistory: (input) => ipcRenderer.invoke('platform:teamHistory', input),
    packages: (amountFen) => ipcRenderer.invoke('platform:packages', amountFen),
    createCheckout: (input) => ipcRenderer.invoke('platform:createCheckout', input),
    createPaymentAttempt: (input) => ipcRenderer.invoke('platform:createPaymentAttempt', input),
    getCheckout: (input) => ipcRenderer.invoke('platform:getCheckout', input),
    closeCheckout: (checkoutId) => ipcRenderer.invoke('platform:closeCheckout', checkoutId),
    openPayment: (paymentUrl) => ipcRenderer.invoke('platform:openPayment', paymentUrl)
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
  onAccountsChanged: (callback) => ipcRenderer.on('accounts:changed', callback),
  onPlatformChanged: (callback) => ipcRenderer.on('platform:changed', (_event, payload) => callback(payload))
});
