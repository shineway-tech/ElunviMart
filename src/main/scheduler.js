function randomDelayMs(minMinutes, maxMinutes, random = Math.random) {
  const min = Math.max(1, Number(minMinutes) || 1);
  const max = Math.max(min, Number(maxMinutes) || min);
  return Math.round((min + random() * (max - min)) * 60_000);
}

class MonitorScheduler {
  constructor(run, listAccounts = () => [], { remainingMs = () => 0 } = {}) {
    this.run = run;
    this.remainingMs = remainingMs;
    this.running = new Set();
    this.enabled = false;
    this.listAccounts = listAccounts;
    this.timers = new Map();
    this.settings = null;
  }

  configure(settings) {
    this.settings = settings;
    this.stop();
    this.enabled = true;
    this.refreshAccounts();
  }

  refreshAccounts() {
    if (!this.settings || !this.enabled) return;
    const monitorableAccountIds = new Set(this.listAccounts()
      .filter((account) => account.status === 'active' || account.status === 'needs_login')
      .map((account) => String(account.id)));
    for (const [accountId, timer] of this.timers) {
      if (!monitorableAccountIds.has(accountId)) {
        clearTimeout(timer);
        this.timers.delete(accountId);
      }
    }
    for (const accountId of monitorableAccountIds) this.scheduleAccount(accountId);
  }

  scheduleAccount(accountId) {
    if (!this.enabled || !this.settings || this.timers.has(accountId) || this.running.has(accountId)) return;
    const delay = Math.max(this.remainingMs(accountId), randomDelayMs(this.settings.intervalMinMinutes, this.settings.intervalMaxMinutes));
    const timer = setTimeout(async () => {
      this.timers.delete(accountId);
      this.running.add(accountId);
      try { await this.run(accountId); } finally { this.running.delete(accountId); this.refreshAccounts(); }
    }, delay);
    this.timers.set(accountId, timer);
  }

  stop() {
    this.enabled = false;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

module.exports = { MonitorScheduler, randomDelayMs };
