# syntax=docker/dockerfile:1

# ---------- 构建阶段：编译 engine / web / server ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# 国内 npm 源，加速依赖安装（服务器直连 npmjs 也可用，这里只是更快）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_fund=false \
    npm_config_audit=false

# 先只拷 workspace 的清单，利用层缓存
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .

# 根 build = engine + web；server 需单独编译（tsc）
RUN npm run build \
 && npm run build -w @yige/server

# ---------- 运行阶段：只带产物 + 依赖 ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    PORT=27015 \
    DATA_DIR=/app/data \
    DB_PATH=/app/data/yige.sqlite

# node:sqlite 在部分 22.x 小版本仍需显式开启；已默认可用的版本会忽略该开关
ENV NODE_OPTIONS=--experimental-sqlite

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

# 服务端用 process.cwd() 推导 webDist（../web/dist），cwd 必须是 apps/server
WORKDIR /app/apps/server
RUN mkdir -p /app/data

EXPOSE 27015

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:27015/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
