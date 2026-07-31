#!/bin/sh
# Tải sẵn binary Litestream (công cụ sao lưu SQLite liên tục lên Cloudflare
# R2/Backblaze B2) vào server/bin/litestream trong lúc BUILD. An toàn để
# chạy nhiều lần (bỏ qua nếu đã có). Không làm hỏng build nếu tải lỗi —
# server vẫn chạy bình thường, chỉ là không có sao lưu tự động.
cd "$(dirname "$0")/.." || exit 0   # về thư mục server/

if [ -f bin/litestream ]; then
  echo "[litestream] Đã có sẵn bin/litestream — bỏ qua tải lại."
  exit 0
fi

mkdir -p bin

# Phiên bản dự phòng — dùng khi không tra cứu được bản mới nhất qua GitHub
# API (VD bị giới hạn số lượt truy vấn trên IP dùng chung của dịch vụ build).
FALLBACK_VERSION="v0.3.13"

VERSION=$(curl -fsSL --max-time 10 https://api.github.com/repos/benbjohnson/litestream/releases/latest 2>/dev/null \
  | grep -o '"tag_name": *"[^"]*"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')

if [ -z "$VERSION" ]; then
  echo "[litestream] Không tra cứu được phiên bản mới nhất (có thể do giới hạn API) — dùng bản dự phòng ${FALLBACK_VERSION}."
  VERSION="$FALLBACK_VERSION"
fi

try_download() {
  ver="$1"
  url="https://github.com/benbjohnson/litestream/releases/download/${ver}/litestream-${ver}-linux-amd64.tar.gz"
  echo "[litestream] Đang tải Litestream ${ver} từ ${url} ..."
  curl -fsSL --max-time 60 "$url" -o /tmp/litestream.tar.gz
}

if try_download "$VERSION" || { [ "$VERSION" != "$FALLBACK_VERSION" ] && try_download "$FALLBACK_VERSION"; }; then
  if tar -xzf /tmp/litestream.tar.gz -C bin litestream 2>/dev/null; then
    chmod +x bin/litestream
    rm -f /tmp/litestream.tar.gz
    echo "[litestream] Cài xong tại bin/litestream ($(bin/litestream version 2>/dev/null || echo 'không đọc được version'))."
  else
    echo "[litestream] Tải được file nhưng giải nén lỗi — bỏ qua (server vẫn chạy bình thường, chỉ là không sao lưu tự động)."
  fi
else
  echo "[litestream] Tải thất bại (cả bản mới nhất lẫn bản dự phòng) — bỏ qua. Kiểm tra mạng lúc build hoặc tự tải thủ công."
fi

exit 0
