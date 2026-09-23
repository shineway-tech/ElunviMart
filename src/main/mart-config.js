// Mart 后端地址：本地开发默认指向本机服务；打包版本用 ELUNVI_MART_API_BASE_URL 覆盖
const MART_API_BASE_URL = process.env.ELUNVI_MART_API_BASE_URL || 'http://127.0.0.1:4300';

function martConfigFor() {
  return Object.freeze({
    apiBaseUrl: MART_API_BASE_URL
  });
}

module.exports = { martConfigFor };
