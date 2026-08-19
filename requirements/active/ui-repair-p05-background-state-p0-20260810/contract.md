# UI Repair P0.5 冻结合同

1. Animated 资源加载失败必须清除“已就绪”状态并显示 poster/static fallback。
2. 所有自动状态变化都必须经过同一个 playback-state seam，Shop 按钮不能显示与真实动画相反的 Play/Pause。
3. reduced-motion、页面隐藏、离屏和显式暂停继续禁止动画并保留可读 poster。
4. 释放背景时必须移除 observer、visibility listener、订阅和播放句柄，重复释放幂等。
5. 不改变商品权威价格、拥有状态、购买请求或任何服务器协议。

