# P2-03 Prompt 与 Provenance

本批为确定性派生，不调用图像生成 API，不引入外部参考。

视觉编排约束：

- 16 格 4×4 贴纸册网格，使用 P0-08 Context WebP 的透明角色与装饰。
- 保持 Honru 三段火焰头型、D-pad 左眼、四圆键右眼、Q 版幽灵手和双脚。
- 只允许本地化 HTML 标签，贴纸图片本身无烘焙文字、Logo 或水印。
- 接触表由 `scripts/generate-sticker-book-v1.js` 用 Sharp 确定性生成。

来源：`P-HONRU-CONTEXT-REACTIONS-V1`；源 Manifest 与 SHA 继续由 P0-08 管理。本族只登记复用关系，不把派生图伪装为新源母板。
