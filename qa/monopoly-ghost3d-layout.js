'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
}

const slotCss = /\.monopoly-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:1[^}]*pointer-events:none/.test(TEMPLATE);
const canvasCss = /\.monopoly-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*border-radius:inherit/.test(TEMPLATE);
const fallbackCss = /\.monopoly-wave-b-board-frame\{position:relative;align-self:center;justify-self:center;width:min\(100%,calc\(100dvh - 280px\)\);height:auto;aspect-ratio:1;overflow:hidden\}/.test(TEMPLATE);

check('Monopoly overlay is an absolute z1 board-frame layer that never takes game input',
  slotCss && !/\.monopoly-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*pointer-events:auto/.test(TEMPLATE));
check('overlay canvas fills its rounded clipping frame without changing the permanent DOM board sizing',
  canvasCss && fallbackCss && /\.monopoly-wave-b-board\{[^}]*width:var\(--monopoly-wave-c-board-size\)!important[^}]*height:var\(--monopoly-wave-c-board-size\)!important/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board-frame\[data-ghost3d-ready="true"\] \.monopoly-wave-b-board\{[^}]*opacity:0[^}]*pointer-events:none/.test(TEMPLATE));
check('the real Monopoly Arena owns an explicit full-width track so live viewport changes cannot shrink-wrap the Stage',
  /\.game-stage-arena\.monopoly-wave-b-arena\{grid-template-columns:minmax\(0,1fr\);justify-content:stretch\}/.test(TEMPLATE));
check('narrow, compact-landscape, and reduced-motion CSS keep the optional overlay clipped and inert',
  /@media\(max-width:720px\)\{[\s\S]{0,1400}\.monopoly-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,1300}\.monopoly-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,1200}\.monopoly-ghost3d-slot,[^}]*\.monopoly-ghost3d-slot canvas\{animation:none!important;transition:none!important/.test(TEMPLATE));
check('compact landscape budgets the square Monopoly board from the available viewport height',
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,900}\.monopoly-wave-b-stage\{grid-template-columns:minmax\(0,clamp\(132px,calc\(100dvh - 220px\),380px\)\) minmax\(148px,1fr\);justify-content:center\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,1400}\.monopoly-wave-b-board-frame\{width:100%\}/.test(TEMPLATE));
check('the retained Monopoly dice owns its 44px-plus touch target outside the Command-only selector',
  /\[data-shell-game="monopoly"\] \.monopoly-wave-b-dice\{min-width:64px;min-height:64px/.test(TEMPLATE) &&
  !/\[data-shell-game="monopoly"\] \.game-stage-command \.monopoly-wave-b-dice\{min-width:64px;min-height:64px/.test(TEMPLATE));
const smallScreenIndex = TEMPLATE.indexOf('@media(max-width:420px){');
const portraitIndex = TEMPLATE.indexOf('@media(max-width:720px) and (orientation:portrait){');
const portraitBlock = portraitIndex >= 0 ? TEMPLATE.slice(portraitIndex, TEMPLATE.indexOf('@media(max-height:600px) and (orientation:landscape){', portraitIndex)) : '';
const portraitArenaCss = /\.monopoly-wave-b-arena\{grid-template-columns:minmax\(0,1fr\);justify-content:stretch\}/.test(portraitBlock);
const portraitFrameCss = /\.monopoly-wave-b-board-frame\{justify-self:center;width:min\(100%,clamp\(248px,76vw,340px\)\);height:auto;max-width:100%;min-height:0;aspect-ratio:1\}/.test(portraitBlock);
const portraitBoardCss = /\.monopoly-wave-b-board\{width:100%!important;height:100%!important;max-width:100%;max-height:100%;box-sizing:border-box\}/.test(portraitBlock);
check('390px portrait Monopoly arena has a full-width explicit single grid track before board sizing',
  portraitArenaCss && /\.monopoly-wave-b-stage[^}]*width:100%/.test(TEMPLATE));
check('390px portrait Monopoly removes duplicated Arena metadata and fits the square frame to Arena height',
  smallScreenIndex >= 0 && portraitIndex > smallScreenIndex && portraitArenaCss && portraitFrameCss && portraitBoardCss &&
  /\.monopoly-wave-b-stage\{height:100%;min-height:0\}/.test(portraitBlock) && /\.monopoly-wave-b-meta\{display:none\}/.test(portraitBlock));
check('the permanent DOM fallback derives a bounded full/compact/micro density from its real board size',
  /function monopolyWaveBLayoutDensity\(size\)\{[\s\S]{0,260}value<236[\s\S]{0,120}value<432/.test(SOURCE) &&
  /const density=applyMonopolyWaveBLayoutDensity\(S\);/.test(SOURCE) &&
  /const cellScale=density==='full'\?\.103:\(density==='compact'\?\.092:\.086\);/.test(SOURCE));
check('compact DOM tiles preserve full accessible labels and current-space state while visual labels yield to colour and ownership cues',
  /d\.setAttribute\('role','img'\);[\s\S]{0,180}d\.setAttribute\('aria-label',accessibleLabel\);[\s\S]{0,220}d\.title=accessibleLabel/.test(SOURCE) &&
  /monopolyWaveBData\(d,'monopoly-cell-current',current\?'true':null\)/.test(SOURCE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="compact"\] \.monopoly-cell-label,[^\n]+\.monopoly-cell-value,[^\n]+\.property-owner-avatar\{display:none\}/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="compact"\] \.monopoly-cell-glyph\{display:grid/.test(TEMPLATE) &&
  /\.m-cell\.is-current-cell\{z-index:2;outline:2px solid var\(--accent\)/.test(TEMPLATE));
check('micro DOM tiles inherit the same semantic-only label policy and suppress centre HUD crowding',
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.m-cell\{[^}]*gap:0[^}]*font-size:0/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.monopoly-cell-label,[^\n]+\.monopoly-cell-value,[^\n]+\.property-owner-avatar\{display:none\}/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.monopoly-cell-glyph\{display:grid/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.monopoly-turn-hud,[^\n]+\.monopoly-leader-hud\{display:none\}/.test(TEMPLATE));
check('compact and micro boards preserve the visible DOM dice but relocate its one existing roll button into the Command tray',
  /const commandControl=!!monopolyWaveBCommand&&\(ready===true\|\|monopolyWaveBBoardDensity!=='full'\);/.test(SOURCE) &&
  /monopolyWaveBData\(rollBtn,'monopoly-compact-control',ready===true\?null:'command'\);/.test(SOURCE) &&
  /\.monopoly-wave-b-command>\.monopoly-wave-b-dice\[data-monopoly-compact-control="command"\]\{order:-3;width:100%;min-height:68px/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.m-center \.dice-row\{gap:2px\}/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.m-center \.dice3d-wrap\{width:22px!important;height:22px!important/.test(TEMPLATE) &&
  /\.monopoly-wave-b-board\[data-monopoly-density="micro"\] \.m-marker\.monopoly-character-token\{transform:translate\(-50%,-50%\) scale\(\.5\)/.test(TEMPLATE));
check('Wave B fallback geometry uses board-frame content width at every viewport',
  /function monopolyWaveBBoardContentWidth\(\)\{[\s\S]*?frameClientWidth[\s\S]*?paddingLeft[\s\S]*?return Math\.max\(0,\s*frameClientWidth\s*-\s*horizontalPadding\)/.test(SOURCE) &&
  /const w = monopolyWaveBBoardContentWidth\(\) \|\| area\.clientWidth \|\| 520;/.test(SOURCE) &&
  !/function monopolyWaveBBoardContentWidth\(\)\{[\s\S]{0,240}matchMedia/.test(SOURCE));
check('viewport and container resize changes coalesce geometry work to one frame and clean up on destroy',
  /function scheduleMonopolyPresentationResize\(\)\{[\s\S]{0,1200}renderBoard\(\)[\s\S]{0,1200}requestAnimationFrame\(run\)/.test(SOURCE) &&
  /addEventListener\('resize',\s*scheduleMonopolyPresentationResize\)/.test(SOURCE) &&
  /addEventListener\('orientationchange',\s*scheduleMonopolyPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('resize',\s*scheduleMonopolyPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('orientationchange',\s*scheduleMonopolyPresentationResize\)/.test(SOURCE) &&
  /new ResizeObserver\(scheduleMonopolyPresentationResize\)/.test(SOURCE) &&
  /monopolyPresentationResizeObserver\.observe\(area\)/.test(SOURCE) &&
  /monopolyPresentationResizeObserver\.observe\(monopolyWaveBBoardFrame\)/.test(SOURCE) &&
  /monopolyPresentationResizeObserver\.disconnect\(\)/.test(SOURCE) &&
  /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,500}releaseMonopolyPresentationResize\(\)/.test(SOURCE));
check('slot is appended after the retained board and remains below later metadata',
  /monopolyWaveBBoardFrame\.appendChild\(board\);\s*mountMonopolyGhost3DSlot\(\);[\s\S]{0,600}monopolyWaveBStage\.appendChild\(monopolyWaveBBoardFrame\);\s*monopolyWaveBStage\.appendChild\(monopolyWaveBMeta\);/.test(SOURCE));
check('DOM dice, Buy/Pass, and Bid controls remain outside the renderer slot and use their existing handlers',
  /rollBtn\.addEventListener\('click', roll\)/.test(SOURCE) && /monopolyWaveBCommand\.appendChild\(node\)|\[moneyRow,actionRow,settleBtn,stageState\]/.test(SOURCE) &&
  /syncMonopolyGhost3DRollControl\(ready===true\)/.test(SOURCE) && /data-monopoly-ghost3d-control="dom-command"/.test(TEMPLATE) &&
  /renderRuleActions\(\)/.test(SOURCE) && !/monopoly-ghost3d-slot[^\n]*monopoly-wave-b-dice/.test(TEMPLATE));
check('renderer center is a non-die process marker and cannot impersonate the DOM roll control',
  !/const markGeometry\s*=/.test(fs.readFileSync(path.join(ROOT, 'public', 'three', 'monopoly-entry.js'), 'utf8')) &&
  !/\[\[-0\.28, 0\.28\].*\[0\.28, -0\.28\]\]/.test(fs.readFileSync(path.join(ROOT, 'public', 'three', 'monopoly-entry.js'), 'utf8')));
check('disabled, unsupported, and failed overlay states restore the regular Wave B board surface',
  /slot\.dataset\.ghost3dReady\s*=\s*'false'/.test(SOURCE) && /monopolyGhost3DSetReady\(false/.test(SOURCE) &&
  /if\(!monopolyWaveBActive\)return false;|if \(!monopolyWaveBActive\) return false;/.test(SOURCE) && /disposeMonopolyGhost3DBridge\(\);/.test(SOURCE));

if (failures) {
  console.error('MONOPOLY_GHOST3D_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('MONOPOLY_GHOST3D_LAYOUT_ALL_PASS');
}
