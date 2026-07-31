# Cấu hình Litestream — sao lưu liên tục file SQLite lên Cloudflare R2 (miễn
# phí, không giới hạn thời gian). Xem hướng dẫn lấy các giá trị bên dưới ở
# README mục 13. Litestream tự thay các biến ${...} bằng biến môi trường
# tương ứng đã cấu hình trên Render (hoặc file .env khi chạy local).

dbs:
  - path: ${DB_PATH}
    replicas:
      - type: s3
        endpoint: ${LITESTREAM_ENDPOINT}
        bucket: ${LITESTREAM_BUCKET}
        path: db
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
        region: auto
