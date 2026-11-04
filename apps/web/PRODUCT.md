# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

中文棋类爱好者（休闲玩家），在浏览器中快速开始一局五子棋/围棋/中国象棋：either 人机对战（游客即可）或联网对战（房间制，需登录落座，游客可观战）。本次重构的直接需求方是站长本人（项目所有者），要求 UI 达到正规对战平台的设计规范。
[以下事实全部由需求单与仓库代码推断，未经逐条访谈确认]

## Product Purpose

「弈阁」是一个开源棋类对战平台（monorepo：apps/web Vue3+Vite+daisyUI、apps/server Express+ws+sqlite、packages/engine 房间/事件引擎）。核心体验：3 个游戏入口、房间大厅（在线房间/在线玩家侧栏）、房间对局（含观战、积分、聊天）、本地 WASM AI 人机对战（Pikafish/Rapfi/MCTS）。成功 = 玩家能在 10 秒内找到"玩一局"的入口，房间加入/观战/建房流程无死路。

## Positioning

AI 全部在浏览器本地运行（WASM），游客零门槛人机；联网侧提供房间制积分对战与观战，同一站点覆盖单机与社交两种玩法。

## Operating Context

桌面浏览器为主（1280–1920 宽），需兼容手机竖屏（390 宽）；开发时 localhost:5173 + 后端 3000 端口；hash 路由（createWebHashHistory），锚点链接会触发路由跳转（曾因此产生 /create-room 空白页）。

## Capabilities and Constraints

- 路由：/（大厅）、/ai/:game（人机）、/r/:id（房间）、/u/:username（用户主页）、/leaderboard、/admin、/p/:id（复盘）、/login、/lite（小窗）。
- 房间引擎：joinRoom 自动分配角色（满员/游戏中→watcher）；游客只能观战与玩人机；密码房间的密码以 md5 存于 attrs.passwd，目前仅前端校验；leaveSeat 可使玩家转为观众。
- 登录：session cookie；游客会话由服务端生成 `游客NNNN` 昵称与 `guest_uuid` 唯一 ID。
- 棋盘组件：五子/围棋为 ResizeObserver 自适应 canvas（可流体缩放）；象棋棋盘为 360×405 固定像素布局（需流体化改造）。
- 约束：保持 daisyUI+Tailwind 现有组件体系与全部既有对局行为，不引入重型依赖；快速简洁优先，避免复杂实现。
- 未决：是否更换整体视觉世界——用户要求"全面重构UI"但同时列出的是流程/布局/引导类明确修复，本次按 Operate 模式在既有设计系统内做最大化打磨，不重做品牌。

## Brand Commitments

名称「弈阁」，副标题"五子棋 · 围棋 · 中国象棋"，现有 logo.svg；中文界面文案。

## Evidence on Hand

- 可运行工程：apps/web（Vite dev 5173）、apps/server（sqlite 数据在 apps/server/data）。
- 真实引擎资产：public/pikafish、public/rapfi WASM。
- 无真实用户数据/评价可供引用，不得虚构运营数据、在线人数等商业声明。

## Product Principles

1. 每个流程都有明确的、可发现的入口与出口（返回、退出、加入、观战、建房）。
2. 对战区是主角：棋盘在可用空间内尽量大且居中，界面退后。
3. 身份状态一眼可辨：游客/登录、房间状态（等待/游戏中/满员/加密）都用稳定的视觉语言标注。
4. 响应式不是缩放：大小屏各自编排布局，而非同一布局挤压。
5. 复用既有设计系统（panel/hairline/field token），用一致性而非新花样体现设计规范。

## Accessibility & Inclusion

触控目标 ≥40px，表单字段带标签与错误提示，键盘可完成登录/建房/加入房间流程；尊重 prefers-reduced-motion。
