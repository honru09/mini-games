'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const shell=read('public/src/core/02-app-shell.js'),template=read('public/index-template.html'),online=read('public/src/online/03-websocket.js');
let fail=0;function check(name,ok){console.log((ok?'PASS  ':'FAIL  ')+name);if(!ok)fail++;}
check('Profile 使用装备背景并复用高级背景生命周期',/profile-route-hero profile-hero bg-/.test(shell)&&/applyPremiumBackground\(hero,account\.background\|\|0,'profile'\)/.test(shell)&&/releasePremiumBackground\(ghostProfileBackgroundNode\)/.test(shell));
check('Profile 展示服务端 xpProgress 语义进度条',/account\.xpProgress/.test(shell)&&/role','progressbar'/.test(shell)&&/aria-valuenow/.test(shell));
check('Profile 展示总局数、胜场、胜率和连胜',/profile_stat_games/.test(shell)&&/profile_stat_wins/.test(shell)&&/profile_stat_win_rate/.test(shell)&&/profile_stat_best_streak/.test(shell));
check('六款游戏固定显示局数、胜场与派生胜率',/profile-game-grid/.test(template)&&/profile_game_record/.test(shell)&&/games\.forEach/.test(shell));
check('成就、任务、社交、收藏和本人回放都有独立分区',/profile_achievements_title/.test(shell)&&/daily_tasks_title/.test(shell)&&/profile_social_title/.test(shell)&&/profile_collection_title/.test(shell)&&/profile_replays_title/.test(shell));
check('回放只使用 canShare=true 的本人参与项',/filter\(item=>item&&item\.canShare===true\)/.test(shell));
check('胜率零分母显示破折号且不伪造负场/平局',/winRate=total\?/.test(shell)&&/winRate===null\?'—'/.test(shell)&&!/profile_stat_(loss|draw)/.test(shell));
check('Profile 账号切换前清空社交、任务、回放与聊天缓存',/resetAccountCaches/.test(online)&&/this\.socialState=/.test(online)&&/this\.dailyTasks=null;this\.replays=\[\]/.test(online));
check('桌面/平板/手机均有明确 Profile 响应式布局',/profile-route-content\{display:grid;grid-template-columns/.test(template)&&/@media\(max-width:900px\)[\s\S]*profile-route-content\{grid-template-columns:1fr\}/.test(template)&&/@media\(max-width:640px\)[\s\S]*profile-game-grid\{grid-template-columns:repeat\(2,1fr\)/.test(template));
check('Profile 不渲染 token、密码或 PIN',!/renderGhostProfile[\s\S]*?(authToken|password|pin_hash)/.test(shell.slice(shell.indexOf('function renderGhostProfile'),shell.indexOf('function setGhostHero'))));
console.log(fail?'PROFILE_ROUTE_CONTRACT_HAS_FAILURES':'PROFILE_ROUTE_CONTRACT_ALL_PASS');process.exitCode=fail?1:0;
