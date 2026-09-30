// 同步诊断日志：内存里保留最近若干条，供设置页一键复制（排障用，不落盘）
const MAX_ENTRIES = 400;

let entries = [];
let sequence = 0;

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function clockText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function append(scope, message, detail = '') {
  const entry = {
    id: (sequence += 1),
    at: new Date(),
    scope: String(scope || 'app'),
    message: String(message || ''),
    detail: detail == null ? '' : String(detail),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  return entry;
}

function snapshot() {
  return entries.map((entry) => ({ ...entry, at: new Date(entry.at) }));
}

function clear() {
  entries = [];
}

function formatLine(entry) {
  const detail = entry.detail ? ` | ${entry.detail}` : '';
  return `${clockText(entry.at)} [${entry.scope}] ${entry.message}${detail}`;
}

// header 里放版本/系统/账号等上下文，粘出来一眼能看出是谁的机器
function format(header = {}) {
  const meta = Object.entries(header)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const lines = snapshot().map(formatLine);
  return [
    '=== Elunvi Mart 同步诊断日志 ===',
    meta,
    `导出时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `---- 最近 ${lines.length} 条 ----`,
    ...lines,
    '=== 日志结束 ===',
  ].join('\n');
}

module.exports = { MAX_ENTRIES, append, clear, format, snapshot };
