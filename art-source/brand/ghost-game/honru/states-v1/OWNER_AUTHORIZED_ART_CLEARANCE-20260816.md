# Honru 九状态所有者美术清除记录

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`  
资产组：`P-HONRU-STATES-V1`  
美术版本：`1`  
清除日期：2026-08-16（Asia/Tokyo）

## 授权与范围

项目所有者已明确授权解除原创 Ghost-native 美术的人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 内部门禁。本记录只清除 Honru 九状态原创资产组进入可逆默认开启 runtime 的内部准入，不是人工签字、法律意见、IP PASS 或线上发布授权。

唯一视觉方向为已确认的 M0 North Star 与 Ghost Game 自有 Honru 身份：幽灵/手柄同体、左十字眼、右四圆眼、Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4`、粗圆轮廓、两级平涂。生成输入只包含项目自有 Honru 参考；未使用第三方截图、角色、商业游戏素材或艺术家名字。

## 稳定文件身份

| 状态 ID | flat PNG SHA-256 | runtime WebP SHA-256 | 字节 |
| --- | --- | --- | ---: |
| `idle` | `9FD41DCE51A01CA079FD93726C95D71315C2636C7FE072913DCCCF3BBF9ABE27` | `4848AD3F295CF0732A1C47268E1B077BF6B085861E76BDC024C1306383BBDB01` | 40,424 |
| `thinking` | `D28B589E13E01539696161AF1CE75478D6B8E111F30182FFC23B15396256E81E` | `DDBB994ABA43E5F65CB06B7683D7B93CF6256E6317781026FBE89B00BBFBD005` | 39,372 |
| `surprised` | `87D9CF0C8232049108CA6CF1BE1E70C08906BBCBAD7E88CAF09C8F2295EAB432` | `F37E800D9DC71940954F2B1E1A02CD362E1AD4AF21BA424F0A866BAC02AAA744` | 40,204 |
| `win` | `55449A877843DA04C1386302D965E45B3CED6CAE55A8A37AC33F160DA895C4AC` | `B89EBC0FF072AC8E0CF5E689BB52F0700CF1A4965EA7F47592543F4B455761BC` | 46,688 |
| `lose` | `295C43D9FB9F8D73EB2BD028D9B335D7C900AE56B11B51BE15D981633F94B223` | `0B70201847E34A6A1BFE85B851EC62DC60B9FF49503C047B20CAFD2349467945` | 37,930 |
| `recover` | `68F4E7CF54C27D5B2FAA140A35D0226F0C52255318EB315D32F0EBE80F985F96` | `81C19AFD5FFF044BDB898064365B6B6382F2D0922BD59302EA26D36D11FCCB0B` | 40,002 |
| `waiting-invite` | `577A91BA467FF11E6C56AE19D827C070C5D7756856DD5ABD446A877651F23D5D` | `2D37A33808256E21E26F94B261475163857B0F10C341DD26B28F950FCE2845CC` | 44,554 |
| `check-in` | `B4BEBE1C18837211B932CBDBFEB4A98724A8A8C32A4BF1450ED5E1EA61FA357C` | `5A6AA7A3F2006B4090AB1DE3CE58854AEC13AE0075015E939EE346C3F48E562B` | 42,506 |
| `playful` | `95B1F423EE77F39755374B93ABE22FEACED6D6E2B3F171C225D7074A8F2EA1C6` | `475C777830DB09A5E22AB380EE7D62C60295F858DF37B18E740D6EBBCC54F8B1` | 41,116 |

九份 runtime WebP 总计 372,796 bytes；Manifest 预算 524,288 bytes。来源、Prompt、任务 ID、Alpha/三色处理与审计证据见 `PROMPT_AND_PROVENANCE_v1.md`、`TECHNICAL_REVIEW_draft-v1.md` 与 `requirements/active/honru-expression-kit-v1-20260809/evidence/source-alpha-audit-202608090320.json`。

## 机器视觉、技术与相似风险审查

- 9/9 状态保留 Honru 的三项强身份锚点；轮廓、主体比例、三段火苗与双色明暗同构。
- Alpha 四角、绿色污染、三色平涂、1254×1254 静态 WebP、逐文件 SHA、字节预算与 44/64/96/192px 派生均可复核。
- `thinking` 与 `lose` 在 44px 的口型差异较弱，运行时不得仅靠图像传达复杂语义；现有可读状态文字与 fallback 保留。
- `win` 的近身星形、`recover` 的拇指与 `waiting-invite` 的挥手均为通用情绪姿态，不进入规则、奖励或协议。Prompt 与输入不含第三方表达性素材；机器相似风险评为低到中等，可在可选专业咨询提出具体风险时返工。
- 上述结论不是法律意见，也不声称 Reviewer B、人工清稿或 Golden Set 已通过。

## Runtime、fallback 与回滚

- `public/assets/manifests/asset_manifest.json` 记录稳定 ID、版本、逐状态路径/SHA/字节、`OWNER_AUTHORIZED_ART_CLEARANCE` 与默认开启语义。
- `mg_art_honru_states_v1`：缺失或精确字符串 `1` 为开启；任何其他值关闭全部九状态并回到 `P-002-HONRU-MASCOT-V1`。
- `mg_art_honru_game_reactions_v1`：缺失或精确字符串 `1` 为开启；任何其他值只关闭局内反应，不影响首页/签到/邀请等平台 Honru 状态。
- localStorage 读取异常时 fail-closed；Manifest、路径或 WebP decode 失败时回到冻结 Honru v1 SVG，不留空白、不阻塞输入。
- 重开、离场、销毁、Replay、页面隐藏与 reduced-motion 的既有清理/静态降级合同保持不变。

## 仍未执行但不阻塞开发

人工笔触清稿、独立自然人 Reviewer B、IP/法律意见和额外逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，当前未执行且不得伪造成 PASS。第二浏览器、物理 Android/iPhone/Tablet、真实网络与低端性能属于 `RELEASE_EVIDENCE_PENDING`。任何 commit、push、Pages、Render 或生产数据操作仍需用户当前明确命令。
