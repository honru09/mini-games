# P2-11 Machine Technical Review

- 1/1 PNG 母版：1536×1024、RGB、无 Alpha、无烘焙价格/倒计时/库存/品牌文字。
- 3/3 WebP：1200×800、720×720、600×400，确定性路径、Manifest SHA/bytes 锁定，合计低于 512 KiB 预算。
- 小尺寸：四季岛屿与中心幽灵/手柄轮廓在 180 CSS px 仍可辨识，卡片文字由真实 DOM 承担。
- Fallback：decode 失败保留季节色块；flag/Manifest/模块失败回到既有商城。季节卡点击只调用
  现有单品预览/购买路径，不创建套装 mutation。
- Accessibility：卡片为 44px 以上真实 button，键盘/焦点/三语可用；图像 `alt=""`，不重复朗读。
- Motion：不跟随鼠标、不做视差；只复用商城有限 surface motion，reduced-motion 合同不变。
- Similarity：只使用外部结构语义，拒绝外部像素、图层、轮廓、色板和商业文字。
- 未执行：第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能和发布。
