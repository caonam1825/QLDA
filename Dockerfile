PORT=4000
JWT_SECRET=doi-chuoi-bi-mat-nay-truoc-khi-chay-that
DB_PATH=./data/app.db

# --- Sao lưu bền vững cho gói Render miễn phí (không bắt buộc khi chạy local
# hoặc khi dùng VPS/Docker có ổ đĩa thật) — xem README mục 13 ---
# LITESTREAM_ENDPOINT, LITESTREAM_BUCKET, LITESTREAM_ACCESS_KEY_ID,
# LITESTREAM_SECRET_ACCESS_KEY lấy từ Cloudflare R2 (miễn phí, không giới hạn
# thời gian). Bỏ trống 4 dòng này = chạy bình thường, KHÔNG sao lưu tự động.
LITESTREAM_ENDPOINT=
LITESTREAM_BUCKET=
LITESTREAM_ACCESS_KEY_ID=
LITESTREAM_SECRET_ACCESS_KEY=

# --- Tích hợp Zalo OA để nhắc việc (không bắt buộc — bỏ trống nếu chưa dùng) ---
# Lấy tại https://developers.zalo.me sau khi đã có Zalo Official Account.
# Access token của Zalo hết hạn định kỳ, cần cập nhật lại thủ công.
ZALO_OA_ACCESS_TOKEN=
ZALO_OA_APP_SECRET=
