# P2-10 Prompt and Provenance

## 视觉说明

在 Ghost Game 的 Ink / Cream / Signal Cyan / Tournament Gold 语言内，设计一块像赛事转播
记分条但不暗示视频直播的代码原生 Overlay：顶部为短状态台标，中部突出赛事名与轮次，
随后是当前领跑者，底部容纳最多三桌赛况。保留手柄眼睛式幽灵 signal，不使用商业游戏、
赛事电视包装或外部素材作为风格捷径。

## 确定性派生

- Runtime：`public/src/core/32-tournament-broadcast-overlay.js` + `public/index-template.html`。
- Motion：本地固定版本 GSAP Core/Timeline；只动 transform/autoAlpha，短时完成并清理。
- Review：workspace 内 HTML/CSS 虚构赛况页，经 Codex Browser 对本地文件选择器截图。
- 字体与图形：系统字体与 CSS 几何；无外部字体、图片、模型或 API 请求。

没有图像生成 provider、model 或远端 taskId。外部素材、玩家数据、凭证和生产数据均未进入输入。
