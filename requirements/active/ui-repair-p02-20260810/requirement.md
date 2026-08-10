# UI Repair P0.2 — 房间启动台、房间浏览、赛事入口与品牌文案

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

## Goal

修复 P0.1 浏览器实测暴露的全局弹层层级问题，并把“创建、私密码加入、浏览房间”整理成可理解、可键盘操作、三语响应式的 Room Launchpad；普通用户默认看不到 Tournament 创建、打开或自动弹窗；Ghost Game 的主品牌副标题不再只是“六款精选游戏 · 联机对战”。

对应台账：`UI-019 / UI-020 / UI-027 / UI-028 / UI-034 / UI-036`。

## IN

- 建立 Header / Modal / Mobile Nav / Toast 的稳定层级；Modal 必须盖住导航，Toast 必须在 Modal 上可见。
- 通用建房必须先选游戏；游戏卡进入可预选；容量严格使用 `GAMES[id].min/max`，提交前再次 clamp。
- 保持现有 `online.pendingGame → create → room_update → select_game` 流程，不向 `create` payload 增加协议字段。
- 公开/私密、允许观战、容量、游戏、创建、私密码加入与浏览入口组成清晰启动台。
- 弹层单例、滚动锁、命名 dialog、初始焦点、Tab、Esc、背景关闭和触发点焦点恢复。
- Lobby 卡只信任服务端 `canJoin/canSpectate` 决定动作；显示等待/进行中、真人/AI、观战状态；房主资料入口键盘可达。
- Tournament 创建、打开与 `tournament_state` 自动弹窗仅对服务端 `hello_ack.admin` 映射的 `online.isAdmin` 开放；前端隐藏不冒充服务端权限撤销。
- 重写 `app_title / brand_tag / home_hero_desc / auth_brand_intro` 三语和模板 fallback；保留准确六款事实文案。

## OUT

- 不修改服务端赛事权限、WebSocket 消息结构、游戏规则、奖励、经济、Replay、AI、Supabase 或美术资产。
- 不实现自由文字房聊、Honru Emoji、Tabletop M1、Tank 控制或新游戏。
- 不 commit、push 或部署。

## Non-negotiable

- 用户名、房间名和服务端原文只能经 `textContent/elRaw`，禁止 `innerHTML`。
- 私密房、Block、Presence、可加入/可观战继续由服务端裁决，前端不可本地推断越权。
- `public/index.html` 只能由 `node scripts/build.js` 生成。
- 新 UI 文案同步三语；所有触控目标至少 44px；手机、平板、桌面不产生横向溢出。

