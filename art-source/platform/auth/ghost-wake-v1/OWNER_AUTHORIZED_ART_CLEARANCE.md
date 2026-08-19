# OWNER_AUTHORIZED_ART_CLEARANCE — P0-01 Auth / Launch Art v1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_ADMISSION / LOCAL_ONLY / NOT_RELEASED`  
资产族：`P-AUTH-LAUNCH-ART-V1`  
生产单元：`P0-01`  
美术版本：`1`  
决议日期：2026-08-17（Asia/Tokyo）

## 决议

依据项目所有者已经生效的原创 Ghost-native 美术授权轨道，本记录对下列 5 个项目自有 Asset ID 授予窄范围 `OWNER_AUTHORIZED_ART_CLEARANCE`：

1. `P-AUTH-GHOST-WAKE-BACKDROP-V1`
2. `P-AUTH-HONRU-SCENES-V1`
3. `P-BOOT-HONRU-CONTROLLER-V1`
4. `P-AUTH-STATUS-ICONS-V1`
5. `P-PWA-GHOST-WAKE-V1`

清除范围是 48 个在 `asset-family-manifest-v1.json` 中以稳定路径、尺寸、字节与 SHA-256 冻结的 runtime variants。它们可以保留当前可逆的本地 default-on runtime 准入，并作为未来发布候选；本决议本身不把 P0-01 生产台账标记为完成，也不触发任何发布动作。

## 清除依据

- 用户已确认的两张 M0 North Star 继续是唯一视觉方向，精确 SHA 已冻结。
- 生成器 `scripts/generate-auth-art-v1.js` 具有稳定 SHA；最终链路是项目自有确定性 SVG 与已清除 Honru 母图派生。
- built-in ImageGen 的失败调用返回 HTTP 401 `authentication token invalidated`；没有输出进入本资产族，也没有切换 API Key CLI 或第三方模型。
- 23 个源母文件、6 个中间证据、3 张审查板、48 个 runtime variants 和 3 份 fallback 拷贝均有本地可复核身份。
- 机器 Reviewer A 已完成格式、尺寸、Alpha、SVG 安全、预算、视觉与相似风险审查，并如实记录 PWA 外缘部分 Alpha 和真实设备裁切未执行。
- 四个浏览器内 Auth/Boot Asset ID 均有 family 总闸、子闸、Manifest 解析边界、可读 HTML/a11y 信息和不依赖新素材的 fallback。PWA Maskable/Splash 受静态 Web App Manifest 与 Service Worker 清单控制；localStorage flag 不会改变已安装的系统图标。
- 关闭 Auth/Boot 相应 flag 可回到旧 Honru/品牌/CSS/HTML/SVG 资产；PWA 通过版本化 Manifest 路径回退到既有 any-purpose icon 与 HTML/CSS 启动壳。两条回滚都不改变产品权威数据或协议。

## 外部素材裁决

所有外部 Q 版 UI/PSD/AI/RPG 素材继续永久保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`。它们只参与组件、状态、动作和布局的语义覆盖清单，没有作为图像输入、脚本输入、像素来源、图层来源、runtime 文件或发布文件。

本清除不授予任何第三方素材许可，也不允许复制、描摹、裁切、换色、拼接、作为生成参考图或接入 runtime。任何外部受限素材都不因本记录获得例外。

## 允许范围

- Auth/Boot 浏览器内资产可在本地当前构建中通过 Runtime Manifest 和双层 feature flag 可逆启用；PWA 资产通过静态 Web App Manifest 的版本化路径可逆启用。
- 作为 Auth、First Start、Boot、状态图标、PWA Maskable/Splash 的项目自有候选继续做专项 QA 和真实环境证据采集。
- 对具体风险、可读性或跨平台裁切问题按同一 Asset ID/version 返工并重新冻结 SHA。

## 回滚链

```text
P0-01 v1 runtime variant
  -> 已清除的既有 Honru / Ghost Game brand asset
  -> DOM / CSS / SVG / Unicode / HTML readable fallback
```

- 总闸：`mg_art_p0_01_v1`。
- 子闸：`mg_art_auth_ghost_wake_v1`、`mg_art_auth_honru_scenes_v1`、`mg_art_boot_honru_v1`、`mg_art_auth_status_icons_v1`。
- Auth/Boot 的 flag 关闭或非法、Runtime Manifest 不可用、路径拒绝、加载/解码失败时必须 fail closed 到对应 fallback，不留空白，不阻塞认证输入。PWA 的回滚由 Web App Manifest 恢复既有 icon 路径并继续使用 HTML/CSS 启动壳；不宣称 JS flag 能改写系统安装面。

## 不宣称

本记录不宣称以下事项已经完成：

- 独立自然人 Reviewer B、人工清稿、IP/法律意见或额外逐资产 Golden Set；它们是 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能或跨平台 PWA 启动裁切；它们是 `RELEASE_EVIDENCE_PENDING / NOT_EXECUTED`。
- 完整 P0-01 台账核销、线上已应用、Pages/Render 部署、生产数据写入或正式发布。

任何 commit、push、部署或发布仍只接受当前用户的明确命令。
