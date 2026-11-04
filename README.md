# 弈阁 · 在线对弈

一个自托管的在线棋类对战平台：五子棋、围棋、中国象棋。支持人机对战与多人在线对战，账号、积分、房间、观战、聊天、回放一应俱全。

## 功能

- **三款棋类游戏**：五子棋（15 路）、围棋（9/13/19 路，中国规则）、中国象棋
- **人机对战**：AI 全部在浏览器本地计算（WebAssembly / Web Worker），不占用服务器资源
- **多人在线**：房间、准备/开始、观战（与对战玩家分区展示）、聊天（含 emoji、限流、敏感词过滤）、棋谱回放
- **自有账号体系**：用户名/密码注册登录（bcrypt 哈希、HttpOnly 会话）、游客试玩、RBAC（用户/管理员）
- **积分**：初始 1000，胜 +10、负 -5、平 0；SQLite 单文件持久化

## 项目结构

```
apps/
  server/          后端服务（Express + 内置 SQLite + WebSocket）
  web/             前端（Vue 3 + Vite + Tailwind）
packages/
  engine/          房间/玩家/消息引擎（@yige/engine，可独立构建）
```

## 快速开始

```bash
npm install

# 开发模式（同时启动后端 27015 与前端 5173）
npm run dev
```

前端开发服务器：`http://127.0.0.1:5173`，后端 API：`http://127.0.0.1:27015`。

首次启动会自动在 `apps/server/data/` 下创建 SQLite 数据库。

## 环境变量（后端）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `PORT` | 服务端口 | `27015` |
| `DATA_DIR` | 数据目录 | `apps/server/data` |
| `SESSION_SECRET` | 会话签名密钥（生产必须修改） | 开发占位值 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始管理员账号 | 空（不创建） |
| `POINTS_INITIAL` / `POINTS_WIN` / `POINTS_LOSS` | 积分规则 | `100` / `10` / `-5` |

```bash
# 示例：创建管理员并启动
ADMIN_USERNAME=admin ADMIN_PASSWORD=change-me SESSION_SECRET=xxx npm run dev:server
```

## 构建与部署

```bash
npm run build     # 构建引擎 + 前端到 apps/web/dist
npm run start     # 生产模式启动后端（自动托管前端静态文件）
```

## 开源许可

第三方引擎（Rapfi 五子棋、Pikafish 象棋）以 WebAssembly 形式分发，各自遵循 GPL-3.0。详细许可与源码指向见应用内「开源许可」页面或 `apps/web/public/*/NOTICE.md`。
