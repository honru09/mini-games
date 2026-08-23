# P2-12 Prompt and Provenance

Model: `gpt-image-2` prompt grammar, executed by host-managed `imagegen`  
Quality: `high`  
Size / Ratio: `1536×1024 / 3:2`

Prompt:

> Create an original landscape 3:2 game-platform profile hero illustration for Ghost Game. Scene: a calm midnight-to-dawn game observatory floating above a soft cloud sea, with a luminous circular constellation hub at the right third and six distinct abstract game signals orbiting it as small geometric motifs (five black-and-white stones, four colorful travel tokens, a tiny golden property tile, a teal tank silhouette, stacked amber/cyan blocks, and a red-black chess grid). Subject: a friendly translucent white ghost mascot with tiny Q-version ghost hands resting on a simple game controller, placed small in the lower-right foreground, clearly original and not a human. Important details: preserve a generous quiet negative-space zone on the left half for profile name and statistics, layered 2.5D depth with background stars, midground translucent panels, and foreground soft glass rings; cohesive Ghost Game visual language, crisp silhouettes, subtle paper grain, controlled glow, readable at 320px wide. Use case: shipped web profile hero background, decorative image behind HTML UI. Palette: deep night #11182F, ink #202B4A, cloud cream #F7F1E6, signal cyan #6FD7D1, warm amber #F5B75B, accent coral #E87968. Lighting: soft rim light around the ghost and constellation, restrained contrast, no harsh bloom. Constraints: original Ghost Game-native design, no logos, no readable text, no watermark, no fake UI text, no franchise or existing game imitation, keep the left half uncluttered, keep the ghost and controller silhouette clean and small, desktop landscape composition suitable for responsive cropping.

派生由 `scripts/generate-profile-adaptive-hero-v1.js` 使用 Sharp 确定性生成 desktop、mobile、poster 与 reduced-motion static WebP，以及 review contact sheet。运行时所有事实仍由 HTML/locale 输出；图片不烘焙用户名、胜场、价格或游戏状态。

外部影响只吸收“Profile Hero 需要留出内容安全区、游戏状态可形成视觉焦点”的通用信息；拒绝任何外部像素、图层几何、角色、按钮、文字、商标和商业游戏构图。
