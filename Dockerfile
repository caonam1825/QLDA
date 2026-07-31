FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build   # outputs to ../server/public (see client/vite.config.js)

# ---- Stage 2: server + built frontend ----
FROM node:20-alpine
WORKDIR /app/server

# better-sqlite3 needs build tools to compile its native binding;
# curl + tar dùng để tải Litestream (sao lưu SQLite lên Cloudflare
# R2/Backblaze B2 — xem README mục 13) trong lúc build image.
RUN apk add --no-cache python3 make g++ curl tar

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY --from=client-build /app/server/public ./public

# Tải sẵn Litestream vào image (nếu tải được — không chặn build nếu lỗi mạng).
RUN sh scripts/download-litestream.sh || true

ENV PORT=4000
EXPOSE 4000

VOLUME ["/app/server/data"]

# start-with-litestream.sh tự nhận biết: nếu đã cấu hình đủ biến môi trường
# LITESTREAM_* thì chạy kèm sao lưu liên tục; nếu chưa cấu hình thì chạy
# server bình thường như trước (không lỗi, không chặn khởi động).
CMD ["sh", "scripts/start-with-litestream.sh"]
