#!/bin/sh
# Tải sẵn binary Litestream (công cụ sao lưu SQLite liên tục lên Cloudflare
# R2) vào server/bin/litestream trong lúc BUILD, để lúc chạy server không
# cần quyền cài đặt gì thêm. An toàn để chạy nhiều lần (bỏ qua nếu đã có).
set -e
cd "$(dirname "$0")/.."   # về thư mục server/

if [ -f bin/litestream ]; then
  echo "[litestream] Đã có sẵn bin/litestream — bỏ qua tải lại."
  exit 0
fi

mkdir -p bin

VERSION=$(curl -fsSL https://api.github.com/repos/benbjohnson/litestream/releases/latest \
  | grep -o '"tag_name": *"[^"]*"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')

if [ -z "$VERSION" ]; then
  echo "[litestream] Không lấy được phiên bản mới nhất — bỏ qua (server vẫn chạy bình thường, chỉ là không sao lưu tự động)."
  exit 0
fi

echo "[litestream] Đang tải Litestream ${VERSION} cho Linux amd64…"
URL="https://github.com/benbjohnson/litestream/releases/download/${VERSION}/litestream-${VERSION}-linux-amd64.tar.gz"

if curl -fsSL "$URL" -o /tmp/litestream.tar.gz; then
  tar -xzf /tmp/litestream.tar.gz -C bin litestream
  chmod +x bin/litestream
  rm -f /tmp/litestream.tar.gz
  echo "[litestream] Cài xong tại bin/litestream"
else
  echo "[litestream] Tải thất bại — bỏ qua (server vẫn chạy bình thường, chỉ là không sao lưu tự động)."
fi
