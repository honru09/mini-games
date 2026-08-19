#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const template=read('public/index-template.html'),shell=read('public/src/core/02-app-shell.js'),roster=read('public/src/ui/07-roster.js'),motion=read('public/src/core/12-game-stage-motion.js'),adapter=read('public/game-stage-motion-entry.js');
let failures=0;const check=(name,value,detail='')=>{const ok=!!value;console.log(`${ok?'PASS':'FAIL'}  ${name}${ok||!detail?'':' :: '+detail}`);if(!ok)failures++;};
check('共享 State Strip 具有模式、连接、观众三个独立语义槽',/id="game-stage-state-strip"/.test(template)&&/id="game-stage-state-mode"/.test(template)&&/id="game-stage-state-connection"/.test(template)&&/id="game-stage-state-spectators"/.test(template));
check('状态栏具备可访问 live region 与语义状态属性',/id="status-bar"[^>]*role="status"[^>]*aria-live="polite"[^>]*data-stage-status-kind="neutral"/.test(template));
check('共享渲染根据本地/人机/联机/观战及连接状态更新 State Strip',/function updateGameStageStateStrip\(\)[\s\S]*stage_state_spectating[\s\S]*stage_state_connected[\s\S]*stage_state_offline/.test(shell)&&/updateGameStageStateStrip\(\)/.test(shell));
check('setStatus 只在表现层触发状态反馈并写入 kind',/function setStatus\(text, win(?:, semanticKind)?\)[\s\S]*gameStageStatusKind[\s\S]*data-stage-status-kind[\s\S]*GhostGameStageMotion\.pulse/.test(roster));
check('setStatus 支持稳定 semanticKind 且保留旧调用回退',/function setStatus\(text, win, semanticKind\)/.test(roster)&&/normalizeGameStageStatusKind\(semanticKind\)/.test(roster)&&/function normalizeGameStageStatusKind\(value\)/.test(shell));
check('在线连接状态通过 status/open/close/error 路径刷新 State Strip',/connectionState:'idle'/.test(read('public/src/online/03-websocket.js'))&&/connectionState\s*=\s*'connecting'/.test(read('public/src/online/03-websocket.js'))&&/connectionState\s*=\s*canReconnect \? 'reconnecting'/.test(read('public/src/online/03-websocket.js'))&&/updateGameStageStateStrip\(\)/.test(read('public/src/online/03-websocket.js')));
check('Game Stage 动效桥使用懒加载 GSAP 且具备 reduced-motion/隐藏/销毁清理',/import\(ENTRY_URL\)/.test(motion)&&/prefers-reduced-motion/.test(motion)&&/document\.hidden/.test(motion)&&/dispose\(/.test(motion));
check('Game Stage motion adapter 通过官方 DOM 入口注册 CSSPlugin，避免 transform/autoAlpha 控制台警告',/import \{ gsap, CSSPlugin \} from '\.\/vendor\/gsap\/3\.15\.0\/esm\/index\.js';/.test(adapter)&&/GAME_STAGE_MOTION_CSS_PLUGIN_UNAVAILABLE/.test(adapter));
check('Game Stage motion adapter 仅动画 transform/opacity 并提供 timeline kill',/gsap\.timeline/.test(adapter)&&/y: 4/.test(adapter)&&/autoAlpha/.test(adapter)&&/timeline\.kill/.test(adapter)&&!/width:|height:|top:|left:/.test(adapter));
check('三语言新增 State Strip key 且键集合一致',(()=>{const a=JSON.parse(read('public/locales/zh-CN.json')),b=JSON.parse(read('public/locales/en-US.json')),c=JSON.parse(read('public/locales/uk-UA.json'));return ['stage_state_local','stage_state_ai','stage_state_online','stage_state_spectating','stage_state_connected','stage_state_offline','stage_state_local_ready','stage_state_spectators'].every(k=>a[k]&&b[k]&&c[k]);})());
if(failures){console.error(`GAME_STAGE_HUD_DENSITY_FAILED=${failures}`);process.exit(1);}console.log('GAME_STAGE_HUD_DENSITY_ALL_PASS');
