'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris.js'), 'utf8');
const PRESENTER = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris-ghost3d-presenter.js'), 'utf8');
const SOCKET = fs.readFileSync(path.join(ROOT, 'public', 'src', 'online', '03-websocket.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
}

const slotCss = /\.tetris-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:3[^}]*visibility:hidden[^}]*pointer-events:none/.test(TEMPLATE);
const readyCss = /\.tetris-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*visibility:visible[^}]*pointer-events:none/.test(TEMPLATE);
const canvasCss = /\.tetris-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*border-radius:inherit[^}]*pointer-events:none/.test(TEMPLATE);

check('Tetris optional overlay is hidden until a first semantic render and never owns input',
  slotCss && readyCss && !/\.tetris-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*pointer-events:auto/.test(TEMPLATE));
check('canvas covers only the retained main-well cell paint, stays above late-added active DOM cells, and remains below the KO layer',
  canvasCss && /\.tetris-wave-b-main-well\{[^}]*position:relative[^}]*isolation:isolate/.test(TEMPLATE) &&
  /\.tetris-wave-b-main-well\[data-ghost3d-ready="true"\] \.tetris-cell\{opacity:0\}/.test(TEMPLATE) &&
  /\.tetris-cell\.is-active\{[^}]*z-index:2/.test(TEMPLATE) &&
  /view\.ko\.style\.cssText=/.test(SOURCE) && /z-index:8/.test(SOURCE) &&
  /slot\.style\.cssText = 'position:absolute;inset:0;z-index:3;/.test(PRESENTER));
check('opponent rail hides the focused well instead of forcing a duplicate fourth card',
  /view\.card\.style\.display=visible\.has\(state\.id\)\?'grid':'none'/.test(SOURCE) &&
  /\.tetris-wave-b-opponent-card\{display:grid;/.test(TEMPLATE) &&
  !/\.tetris-wave-b-opponent-card\{display:grid!important;/.test(TEMPLATE));
check('seven existing DOM touch controls and the document keyboard route remain outside the renderer seam',
  /addControl\('⬅'/.test(SOURCE) && /addControl\('➡'/.test(SOURCE) && /addControl\('↺'/.test(SOURCE) &&
  /addControl\('↻'/.test(SOURCE) && /addControl\('⬇'/.test(SOURCE) && /addControl\(t\('tetris_hold'\)/.test(SOURCE) &&
  /addControl\('⤓'/.test(SOURCE) && /document\.addEventListener\('keydown',handleKey\)/.test(SOURCE) &&
  !/tetris-ghost3d-slot[^\n]*addEventListener/.test(SOURCE));
check('main well sizing budgets retained score, previews, process rail, and controls at desktop, tablet, portrait, and compact landscape sizes',
  /function tetrisMainWellWidth\(availableWidth,availableHeight\)/.test(SOURCE) &&
  /viewportLandscape=typeof window!=='undefined'&&Number\(window\.innerWidth\)>Number\(window\.innerHeight\)/.test(SOURCE) &&
  /const compactLandscape=viewportLandscape&&width>=480&&height>0&&height<450/.test(SOURCE) &&
  /const reserve=compactLandscape\?66:\(width<480\?170:\(width<720\?148:118\)\)/.test(SOURCE) &&
  /const portraitScrollable=width<720&&!compactLandscape/.test(SOURCE) &&
  /const heightBudget=portraitScrollable\?\(height>0\?Math\.max\(112,\(height-20\)\*COLS\/ROWS\):360\):\(height>0\?Math\.max\(72,\(height-reserve\)\*COLS\/ROWS\):360\)/.test(SOURCE) &&
  /mainWidth=tetrisMainWellWidth\(width,availableHeight\)/.test(SOURCE));
check('main/opponent layout has explicit narrow and compact-landscape branches without expanding the 3D slot beyond the well',
  /\.tetris-wave-b\{display:grid;grid-template-columns:minmax\(0,1fr\)/.test(TEMPLATE) &&
  /@media\(max-width:720px\)\{[\s\S]{0,2500}\.tetris-wave-b-layout\{grid-template-columns:minmax\(0,1fr\)!important/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,2500}\.tetris-wave-b-layout\{grid-template-columns:minmax\(0,1fr\) minmax\(150px,\.42fr\)!important/.test(TEMPLATE) &&
  /@media\(min-width:521px\) and \(max-width:720px\) and \(orientation:portrait\)\{[\s\S]{0,700}\.game-stage-main\{grid-template-columns:minmax\(0,1fr\) minmax\(250px,280px\);grid-template-rows:minmax\(0,1fr\)/.test(TEMPLATE) &&
  /@media\(max-width:720px\)\{[\s\S]{0,1800}\.tetris-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,2200}\.tetris-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE));
check('resize and orientation changes coalesce one render, observe the Arena, and release every listener on destroy',
  /function scheduleTetrisPresentationResize\(\)\{[\s\S]{0,500}requestAnimationFrame\(run\)/.test(SOURCE) &&
  /new ResizeObserver\(scheduleTetrisPresentationResize\)/.test(SOURCE) && /tetrisPresentationResizeObserver\.observe\(area\)/.test(SOURCE) &&
  /addEventListener\('resize',scheduleTetrisPresentationResize\)/.test(SOURCE) && /addEventListener\('orientationchange',scheduleTetrisPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('resize',scheduleTetrisPresentationResize\)/.test(SOURCE) && /removeEventListener\('orientationchange',scheduleTetrisPresentationResize\)/.test(SOURCE) &&
  /releaseTetrisPresentationResize\(\);disposeTetrisGhost3DPresenter\(\)/.test(SOURCE));
check('retained online games derive renderer activity from the live Game Shell instead of a timer-owned true flag',
  /function tetrisGhost3DShellActive\(\)\{[\s\S]{0,900}getElementById\('screen-game'\)[\s\S]{0,900}shellActive!=='true'[\s\S]{0,900}shellGame!=='tetris'/.test(SOURCE) &&
  /shellActive:tetrisGhost3DShellActive\(\)/.test(SOURCE) && !/shellActive:true/.test(SOURCE));
check('observed-well switch runs through the static reconciliation seam before rendering the new main root',
  /card\.addEventListener\('click',\(\)=>\{setObservedPlayer\(state\.id\);\}\)/.test(SOURCE) &&
  /function setObservedPlayer\(pi\)\{[\s\S]{0,220}tetrisGhost3DStaticGeneration\('reconcile',false\)/.test(SOURCE));
check('all accepted WebSocket source tags are local-only arguments with no protocol expansion',
  /onTetrisRuleState\(p\.tetrisRuleSnapshot,'spectator-bootstrap'\)/.test(SOCKET) &&
  /onTetrisRuleState\(p\.tetrisRuleSnapshot,'reconnect'\)/.test(SOCKET) &&
  /onTetrisRuleState\(msg\.payload\|\|msg,'live'\)/.test(SOCKET) &&
  /onRestore\(msg\.payload\.snapshot,'room-restored'\)/.test(SOCKET));
check('unknown caller source tags fail closed instead of being relabelled as a reconciliation frame',
  /function tetrisGhost3DSourceName\(value\)\{return TETRIS_GHOST3D_SOURCES\.has\(value\)\?value:null;\}/.test(SOURCE) &&
  /source:tetrisGhost3DSourceName\(tetrisGhost3DSource\)/.test(SOURCE));
check('reduced motion keeps the optional layer visually static and fallback retains permanent DOM controls',
  /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,1300}\.tetris-ghost3d-slot,[^}]*\.tetris-ghost3d-slot canvas\{animation:none!important;transition:none!important/.test(TEMPLATE) &&
  /function tetrisGhost3DEnabled\(\)/.test(SOURCE) && /disposeTetrisGhost3DPresenter\(\)/.test(SOURCE) &&
  /commitTetrisGhost3DPresenter\(\);/.test(SOURCE));

if (failures) {
  console.error('TETRIS_GHOST3D_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('TETRIS_GHOST3D_LAYOUT_ALL_PASS');
}
