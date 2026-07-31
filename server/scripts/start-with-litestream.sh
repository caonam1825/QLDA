#!/bin/sh
# Khởi động server, có kèm sao lưu SQLite liên tục lên Cloudflare R2 (nếu đã
# cấu hình đủ biến môi trường LITESTREAM_*). Nếu chưa cấu hình, tự động chạy
# server bình thường như cũ (không chặn, không lỗi) — an toàn cho môi trường
# phát triển/local không cần sao lưu.
set -e
cd "$(dirname "$0")/.."   # về thư mục server/

DB_PATH="${DB_PATH:-./data/app.db}"
mkdir -p "$(dirname "$DB_PATH")"

if [ -n "$LITESTREAM_BUCKET" ] && [ -f bin/litestream ]; then
  echo "[litestream] Đang khôi phục dữ liệu mới nhất từ Cloudflare R2 (nếu có)…"
  ./bin/litestream restore -if-replica-exists -config litestream.yml "$DB_PATH" || \
    echo "[litestream] Không có bản sao lưu nào trước đó — bắt đầu với cơ sở dữ liệu mới."

  echo "[litestream] Khởi động server, đồng thời tự động sao lưu liên tục lên R2…"
  exec ./bin/litestream replicate -config litestream.yml -exec "node src/index.js"
else
  echo "[CẢNH BÁO] Chưa cấu hình LITESTREAM_BUCKET (hoặc chưa có bin/litestream) —"
  echo "server chạy KHÔNG có sao lưu bền vững. Dữ liệu sẽ mất khi deploy lại trên"
  echo "gói Render miễn phí. Xem README mục 13 để cấu hình Cloudflare R2."
  exec node src/index.js
fi
