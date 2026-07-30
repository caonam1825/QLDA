# ---- Stage 1: build frontend ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build   # outputs to ../server/public (see client/vite.config.js)

# ---- Stage 2: server + built frontend ----
FROM node:20-alpine
WORKDIR /app/server

# better-sqlite3 needs build tools to compile its native binding
RUN apk add --no-cache python3 make g++

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY --from=client-build /app/server/public ./public

ENV PORT=4000
EXPOSE 4000

VOLUME ["/app/server/data"]

CMD ["node", "src/index.js"]
