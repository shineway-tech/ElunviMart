// Mart 后端地址：开发默认连本机，打包版本连生产；ELUNVI_MART_API_BASE_URL 始终可覆盖
const { app } = require('electron');
const DEFAULT_BASE_URL = app?.isPackaged
  ? 'https://elunvi-mart-api.honeykid.cn'
  : 'http://127.0.0.1:4300';
const MART_API_BASE_URL = process.env.ELUNVI_MART_API_BASE_URL || DEFAULT_BASE_URL;

function martConfigFor() {
  return Object.freeze({
    apiBaseUrl: MART_API_BASE_URL
  });
}

module.exports = { martConfigFor };
