# Gomoku Ghost3D Vertical Slice P0 Contract

## Module seam

Ghost3D Foundation 的外部 Interface 保持 `create / QUALITY`，实例保持 `apply / snapshot / dispose`。游戏 bridge 只向 Foundation 发送纯数据消息；Three/GSAP/WebGL/DOM 类型仅存在于 `public/three/gomoku-entry.js` 的 Adapter implementation。

Adapter Interface 由 Foundation 消费：

```text
mount, render, motion, setQuality, environment,
suspend, resume, contextLost, dispose
```

## Ready and pointer invariant

- `mount()` 只创建资源，不能宣告视觉 ready。
- 只有第一帧真正成功 `renderer.render(scene, camera)` 后，才允许一次性调用 `onReady()` 并开启 3D pointer。
- mount/config/render 失败、context loss、suspend 或 dispose 时，3D pointer 必须关闭；Wave B pointer/键盘/触控不能被遮挡。
- context loss 后旧 Adapter 永久不可复活；Foundation 只能用 fresh Adapter 显式 recover，并在其新首帧成功后重新 ready。

## Motion contract

- `camera_entrance` 和 `piece_placed` 都来自语义状态/事件，不进入规则层。
- HIGH、非 reduced-motion 才运行首镜头 labeled timeline；BALANCED 可缩短/简化；LOW 或 reduced-motion 直接 settle。
- Timeline 只修改 Renderer 私有对象的 transform-like 数值，不动画 DOM 布局，不用 CSSPlugin、ScrollTrigger、CustomEase、repeat、yoyo 或常驻 ambient loop。
- suspend、context loss、reset、terminal generation、dispose 都必须 kill/revert 本实例 GSAP 工作并停止 render loop。

## Quality and fallback

质量只接受 `HIGH / BALANCED / LOW`；Foundation 的 `FALLBACK` 由程序化/Wave B 路径承担。任何异常都 fail closed 到可游玩的 Canvas/DOM，不产生第二套规则或输入事实。

## Evidence boundary

静态/VM/DOM 自动化只证明合同与清理；真实浏览器、第二浏览器、Android/iPhone/Tablet、网络整形、真实帧耗/显存和 Golden Set 必须分别记录，未执行时保持 `NOT_EXECUTED`。

