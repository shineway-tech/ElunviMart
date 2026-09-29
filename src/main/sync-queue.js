class SyncQueue {
  constructor({ now = Date.now, loadState, saveState, maxConcurrent = Infinity } = {}) {
    this.now = now;
    this.states = new Map();
    this.running = new Map();
    const parsedMaxConcurrent = Number(maxConcurrent);
    this.maxConcurrent = Number.isFinite(parsedMaxConcurrent) ? Math.max(1, Math.floor(parsedMaxConcurrent)) : Infinity;
    this.active = new Set();
    this.loadState = loadState || (id => this.states.get(id));
    this.saveState = saveState || ((id, state) => this.states.set(id, state));
  }

  isRunning(id) { return this.running.has(id); }
  remainingMs(id) { return Math.max(0, (this.loadState(id)?.nextAllowedAt || 0) - this.now()); }

  async run(id, task, { source = 'manual' } = {}) {
    const busy = this.isRunning(id);
    const remaining = this.remainingMs(id);
    const globalBusy = !busy && this.active.size >= this.maxConcurrent;
    if (busy || remaining || globalBusy) {
      if (source === 'scheduled') return { skipped: true };
      const message = busy
        ? '该账号同步进行中'
        : remaining
          ? `同步已暂停，请在 ${Math.ceil(remaining / 60_000)} 分钟后再试`
          : '客户端正在同步其他账号，请稍后再试';
      throw Object.assign(new Error(message), {
        code: busy || globalBusy ? 'SYNC_BUSY' : 'SYNC_BACKOFF'
      });
    }
    const controller = new AbortController();
    this.running.set(id, controller);
    this.active.add(id);
    try {
      const result = await task(controller.signal);
      controller.signal.throwIfAborted();
      this.saveState(id, { failures: 0, nextAllowedAt: 0 });
      return result;
    } catch (error) {
      if (!controller.signal.aborted) {
        const previous = this.loadState(id) || {};
        const failures = Math.min(10, (previous.failures || 0) + 1);
        const base = error.apiCode === 54001 || Number(error.status) === 429 ? 30 * 60_000 : 5 * 60_000;
        const nextAllowedAt = this.now() + Math.min(4 * 60 * 60_000, base * 2 ** (failures - 1));
        this.saveState(id, { failures, nextAllowedAt });
      }
      throw error;
    } finally {
      this.active.delete(id);
      if (this.running.get(id) === controller) this.running.delete(id);
    }
  }

  cancel(id) { this.running.get(id)?.abort(new Error('账号同步已取消')); }
  cancelAll() { for (const id of this.running.keys()) this.cancel(id); }
}
module.exports = { SyncQueue };
