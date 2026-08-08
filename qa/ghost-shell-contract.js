'use strict';
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');const template=fs.readFileSync(path.join(root,'public','index-template.html'),'utf8'),utils=fs.readFileSync(path.join(root,'public','src','core','01-utils.js'),'utf8'),shell=fs.readFileSync(path.join(root,'public','src','core','02-app-shell.js'),'utf8'),roster=fs.readFileSync(path.join(root,'public','src','ui','07-roster.js'),'utf8');let fails=0;function check(name,value){console.log((value?'PASS':'FAIL')+'  '+name);if(!value)fails++;}
const routes=[...template.matchAll(/<section[^>]*data-app-route="(home|games|chat|profile)"/g)].map(match=>match[1]);
check('四区路由各有唯一页面',routes.sort().join(',')==='chat,games,home,profile');
check('手机导航完整映射四区',['home','games','chat','profile'].every(route=>new RegExp('mobile-app-nav[\\s\\S]*data-app-route-target="'+route+'"').test(template)));
check('桌面主导航与手机共用 route target',/desktop-app-nav/.test(template)&&/setAppRoute\(node\.getAttribute\('data-app-route-target'\)\)/.test(shell));
check('运行时主题仅 light/dark',/const THEME_LIST = \[\s*\{ id: 'light'[^]*\{ id: 'dark'[^]*\];/.test(utils)&&!/\{ id: '(?:midnight|ocean|forest|cyber|sakura)'/.test(utils));
check('旧主题读取映射为双主题',/ocean.*forest.*sakura[^]*return 'light'/.test(utils)&&/return 'dark'/.test(utils));
check('游戏中暂停品牌外壳高密度动效',/body\.game-active \.ambient-scene/.test(template)&&/body\.game-active \.app-header/.test(template));
check('reduced-motion 停止场景和 Honru 动画',/@media\(prefers-reduced-motion:reduce\)[^]*ambient-stars[^]*animation:none/.test(template));
check('个人背景由固定昼夜覆盖保持商品外观',/个人购买背景不再随平台昼夜主题/.test(template)&&/html\[data-theme="dark"\] \.profile-hero\.bg-6/.test(template));
check('Ghost Game 标志与 Honru 运行时资产存在',fs.existsSync(path.join(root,'public','assets','brand','ghost-game-mark.svg'))&&fs.existsSync(path.join(root,'public','assets','brand','honru-mascot-v1.svg')));
check('登录前独立 Page 使 App inert',/modal-backdrop auth-backdrop ghost-auth-page/.test(fs.readFileSync(path.join(root,'public','src','shop','04-auth.js'),'utf8'))&&/app\.inert=true/.test(shell));
check('显式退出重新进入独立认证 Page 且不泄漏旧 App',/function completeLocalLogout[\s\S]*typeof requireGhostAuth === 'function'[\s\S]*requireGhostAuth\('login'\)/.test(roster));
check('聊天文本使用 elRaw 而非 innerHTML',/elRaw\('div','companion-message/.test(shell));
check('手机以 Chat 底栏替代 Honru 浮层并避免遮挡内容',/\.home-welcome\{grid-column:auto\}/.test(template)&&/\.honru-dock\{display:none\}/.test(template)&&/mobile-app-nav[\s\S]*data-app-route-target="chat"/.test(template));
if(fails){console.log('GHOST_SHELL_CONTRACT_FAILURES='+fails);process.exit(1);}console.log('GHOST_SHELL_CONTRACT_ALL_PASS');
