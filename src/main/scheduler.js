function randomDelayMs(minMinutes, maxMinutes, random = Math.random) {
  const min = Math.max(1, Number(minMinutes) || 1);
  const max = Math.max(min, Number(maxMinutes) || min);
  return Math.round((min + random() * (max - min)) * 60_000);
}

class MonitorScheduler {
  constructor(run) {
    this.run = run;
    this.timer = null;
    this.settings = null;
  }

  configure(settings) {
    this.settings = settings;
    this.stop();
    this.scheduleNext();
  }

  scheduleNext() {
    if (!this.settings) return;
    const delay = randomDelayMs(this.settings.intervalMinMinutes, this.settings.intervalMaxMinutes);
    this.timer = setTimeout(async () => {
      try { await this.run(); } finally { this.scheduleNext(); }
    }, delay);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = { MonitorScheduler, randomDelayMs };
