#!/usr/bin/env bash
# 把 GitHub Release 的产物镜像到 OSS（发布桶 honeykid / public/elunvi_mart）。
#
# 为什么要这一步：GitHub runner 到阿里云 OSS 的国际链路长期不可用（实测 ~50KB/s 甚至挂死），
# 所以 CI 只负责构建 + 签名公证 + 发 GitHub Release，OSS 镜像由国内侧执行这个脚本。
#
# 用法（需要仓库里的 scripts/upload-release-assets.js，凭证通过环境变量给，不要写进仓库）：
#   export ALIYUN_OSS_ACCESS_KEY_ID=...    ALIYUN_OSS_ACCESS_KEY_SECRET=...
#   bash scripts/mirror-release-to-oss.sh v1.0.1
set -euo pipefail

TAG="${1:-}"
REPO="${REPO:-shineway-tech/ElunviMart}"
if [[ -z "$TAG" ]]; then
  echo "用法: bash scripts/mirror-release-to-oss.sh vX.Y.Z" >&2
  exit 1
fi
VERSION="${TAG#v}"

for name in ALIYUN_OSS_ACCESS_KEY_ID ALIYUN_OSS_ACCESS_KEY_SECRET; do
  [[ -n "${!name:-}" ]] || { echo "缺少环境变量 $name" >&2; exit 1; }
done

# 发布桶（static.honeykid.cn 背后那个桶，在上海；报告桶 elunvi-mart 在杭州，别搞混）
export ALIYUN_OSS_REGION="${ALIYUN_OSS_REGION:-oss-cn-shanghai}"
export ALIYUN_OSS_ENDPOINT="${ALIYUN_OSS_ENDPOINT:-oss-cn-shanghai.aliyuncs.com}"
export ALIYUN_OSS_BUCKET="${ALIYUN_OSS_BUCKET:-honeykid}"
export ALIYUN_OSS_PUBLIC_BASE_URL="${ALIYUN_OSS_PUBLIC_BASE_URL:-https://static.honeykid.cn}"
export ALIYUN_OSS_PREFIX="${ALIYUN_OSS_PREFIX:-public/elunvi_mart}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-/tmp/elunvi-release-$TAG}"
BASE="https://github.com/$REPO/releases/download/$TAG"
FILES=(
  Elunvi-Mart-macos-universal.zip
  Elunvi-Mart-macos-universal.zip.blockmap
  Elunvi-Mart-macos-universal.dmg
  Elunvi-Mart-windows-x64-setup.exe
  Elunvi-Mart-windows-x64-setup.exe.blockmap
  Elunvi-Mart-windows-x64-portable.exe
  latest-mac.yml
  latest.yml
)

echo "== 下载 $TAG 产物 → $OUT"
mkdir -p "$OUT"
for f in "${FILES[@]}"; do
  if [[ -s "$OUT/$f" ]]; then echo "已存在 $f"; continue; fi
  # 国际链路对 HTTP/2 不友好，强制 1.1 + 重试 + 断点续传
  curl -sSL --http1.1 --retry 10 --retry-all-errors --retry-delay 3 --max-time 3600 -C - -o "$OUT/$f" "$BASE/$f"
  echo "下载 $f → $(wc -c < "$OUT/$f") bytes"
done

echo "== 校验 sha512（对照 latest*.yml，不一致就中止）"
node - "$OUT" "$VERSION" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const [out, version] = process.argv.slice(2);
const sha512 = (file) => crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
let bad = 0;
for (const manifest of ['latest-mac.yml', 'latest.yml']) {
  const text = fs.readFileSync(path.join(out, manifest), 'utf8');
  const entries = [...text.matchAll(/- url: (\S+)\s+sha512: (\S+)\s+size: (\d+)/g)];
  for (const [, name, want, size] of entries) {
    const file = path.join(out, name);
    const ok = fs.existsSync(file) && sha512(file) === want && fs.statSync(file).size === Number(size);
    if (!ok) bad += 1;
    console.log(ok ? 'OK  ' : 'FAIL', name, size);
  }
}
if (bad) { console.error(`校验失败 ${bad} 个文件`); process.exit(1); }
console.log(`校验通过（${version}）`);
NODE

echo "== 上传 OSS"
cd "$ROOT_DIR"
for f in "${FILES[@]}"; do
  node scripts/upload-release-assets.js --file "$OUT/$f" --version "$VERSION"
done

echo "== 核验公开地址"
curl -s --max-time 15 "$ALIYUN_OSS_PUBLIC_BASE_URL/$ALIYUN_OSS_PREFIX/latest-mac.yml?cb=$(date +%s)" | grep -E "^version|releaseDate"
for f in Elunvi-Mart-macos-universal.dmg Elunvi-Mart-windows-x64-setup.exe; do
  printf '%-42s ' "$f"
  curl -sI --max-time 15 "$ALIYUN_OSS_PUBLIC_BASE_URL/$ALIYUN_OSS_PREFIX/$f?cb=$(date +%s)" | grep -iE "^(HTTP|content-length|last-modified)" | tr -d '\r' | tr '\n' ' '
  echo
done
echo "镜像完成：$TAG"
