# P2-01 Prompt 与 Provenance

## 目标

生成四个可复用的 Ghost-native 四季世界：春季信号花园、夏季云海游戏码头、秋季收藏灯廊、冬季星雪信号观测台。全部为无文字背景，保留左侧 42% 和上中部 UI 安全区，并能裁切为 desktop 16:9、mobile 3:4、poster/mini 16:9。

## 共同五槽 Prompt 合同

- Scene：浮空云海中的四季纸质桌游岛，远景/中景/前景三层 2.5D 深度。
- Subject：粗轮廓的玩具化桌游物件、幽灵信号灯、手柄形拱门；不使用人物或已知商业角色。
- Important Details：Cream 纸面、近黑粗墨边、软接触阴影、涂装木材/毛毡/磨砂玻璃；每季使用独立受控色盘。
- Use Case：Profile/Shop 可裁切背景，所有身份、价格、状态与操作继续由 HTML/i18n 表达。
- Constraints：无文字、数字、Logo、水印、UI 面板、品牌角色、奖励数值、Battle Pass、货币图案、节庆促销或高密度粒子。

## 四季差异

- Spring：发芽骰子、石径、花叶、青绿与珊瑚信号带。
- Summer：纸木码头、帆布遮阳棚、航标、云海水面与蓝绿信号灯。
- Autumn：收藏抽屉、空白徽章、纸叶路径、暖铜灯与莓红/苔绿轨道。
- Winter：观测镜、雪帽石台、晶体信标、深靛夜空与稀疏纸星。

## 生成与派生

- 生成器：OpenAI Codex built-in ImageGen，4 次独立调用。
- 输入：仅 `PROJECT_REFERENCE_TRANSMISSION.json` 中两张项目自有 North Star。
- 生成输出 SHA-256：
  - spring `21CE377ABB0E5C59D7DE5B519EE054434A50885D84FCBE367C3A7926A6A9316D`
  - summer `8882B89DC842D4F21CE631B7E31BE29D671B6FC1D9E3F5C978B25CD85ECB6AFE`
  - autumn `30E5F0EFA64D05F8AC90C36294DA0E7926BF4218D46F5DDD811718DE60D88B8F`
  - winter `72FA872545893C70400E3B234CB32768AA645AEC5B849536D4EAA5BBECEC9B67`
- 确定性派生：`scripts/build-seasonal-backgrounds-v1.py`。
- Runtime：每季 desktop/mobile/poster/mini/animated 共 5 个文件；animated 只做 1.6% 内的缓慢视差巡航，无闪烁、无硬切。
- Review board：`review/seasonal-backgrounds-contact-sheet-v1.png`，SHA-256 `ED8E14EECF606A2E50708BBCADA6348F69429D1AFD0A100B90177C395616F810`。

## 许可

项目自有 AI 生成资产，`project-owned-ai-generated`。外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 输入与传输为 0；没有复制、描摹、裁切、换色或编辑外部素材。

Prompt 结构受 `image` Skill 指导；Attribution: Serge Shima / smixs visual-skills, CC BY 4.0。

