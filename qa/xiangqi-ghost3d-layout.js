'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'xiangqi.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
}

const slotCss = /\.xiangqi-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:2[^}]*visibility:hidden[^}]*pointer-events:none/.test(TEMPLATE);
const readyCss = /\.xiangqi-ghost3d-slot\[data-ghost3d-ready="true"\]\[data-dom-cue-active="false"\]\{[^}]*visibility:visible[^}]*pointer-events:none/.test(TEMPLATE);
const canvasCss = /\.xiangqi-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*border-radius:inherit[^}]*pointer-events:none/.test(TEMPLATE);

check('Xiangqi overlay is hidden until first successful semantic render and never owns input',
  slotCss && readyCss && !/\.xiangqi-ghost3d-slot\[data-ghost3d-ready="true"\][^{]*\{[^}]*pointer-events:auto/.test(TEMPLATE));
check('renderer canvas fills the retained 9x10 DOM board without changing its dimensions',
  canvasCss && /const boardHeight = S \* ROWS \/ COLS/.test(SOURCE) &&
  /boardEl\.style\.width\s*=\s*S \+ 'px'; boardEl\.style\.height\s*=\s*boardHeight \+ 'px'/.test(SOURCE) &&
  /cv\.style\.width\s*=\s*S \+ 'px'; cv\.style\.height\s*=\s*boardHeight \+ 'px'/.test(SOURCE));
check('DOM board remains the sole click, touch-click, and keyboard gameplay input owner above an inert renderer contract',
  /boardEl\.addEventListener\('click'/.test(SOURCE) && /boardEl\.addEventListener\('keydown'/.test(SOURCE) &&
  /boardEl\.setAttribute\('role','grid'\); boardEl\.setAttribute\('tabindex','0'\)/.test(SOURCE) &&
  /interactWithXiangqiCell\(xiangqiKeyboardCell\[0\], xiangqiKeyboardCell\[1\]\)/.test(SOURCE) &&
  /slot\.setAttribute\('aria-hidden','true'\)/.test(SOURCE) && /slot\.setAttribute\('tabindex','-1'\)/.test(SOURCE) &&
  /slot\.style\.cssText\s*=\s*'[^']*pointer-events:none/.test(SOURCE));
check('selected and keyboard DOM cues temporarily reveal the permanent board instead of entering Renderer state',
  /function syncXiangqiGhost3DDomCue\(\)/.test(SOURCE) && /slot\.dataset\.domCueActive = selected \|\| xiangqiKeyboardMode \? 'true' : 'false'/.test(SOURCE) &&
  /xiangqiGhost3DSlot\.dataset\.domCueActive = active \? 'true' : 'false'/.test(SOURCE) && readyCss);
check('board rebuild detaches, retains, and reparents one current slot before bridge sync',
  /const retainedXiangqiGhost3DSlot = xiangqiGhost3DPrepareBoardRebuild\(\)/.test(SOURCE) &&
  /boardEl\.appendChild\(cv\);\s*xiangqiGhost3DAdoptBoardSlot\(boardEl, retainedXiangqiGhost3DSlot\)/.test(SOURCE) &&
  /area\.appendChild\(wrap\);[\s\S]{0,300}syncXiangqiGhost3DBridge\(\)/.test(SOURCE));
check('desktop/tablet and narrow/compact-landscape geometry keeps the full board and process rail inside the Arena',
  /const compactLandscape = availableWidth >= 480 && availableHeight > 0 && availableHeight < 450/.test(SOURCE) &&
  /const useSideProcessRail = \(availableWidth >= 700 && availableHeight >= 450\) \|\| compactLandscape/.test(SOURCE) &&
  /grid-template-areas:' \+ \(useSideProcessRail \? '"board process"' : '"board" "process"'\)/.test(SOURCE) &&
  /const stackedReserve = availableWidth < 480 \? 88 : 108/.test(SOURCE) &&
  /const heightReserve = compactLandscape \? 24 : \(useSideProcessRail \? 56 : stackedReserve\)/.test(SOURCE) &&
  /const heightBudget = availableHeight > 0 \? Math\.max\(132, \(availableHeight - heightReserve\) \* COLS \/ ROWS\) : widthBudget/.test(SOURCE));
check('resize and orientation changes coalesce one geometry rebuild and release listeners on destroy',
  /function scheduleXiangqiPresentationResize\(\)[\s\S]{0,700}requestAnimationFrame\(run\)/.test(SOURCE) &&
  /new ResizeObserver\(scheduleXiangqiPresentationResize\)/.test(SOURCE) && /xiangqiPresentationResizeObserver\.observe\(area\)/.test(SOURCE) &&
  /addEventListener\('resize',scheduleXiangqiPresentationResize\)/.test(SOURCE) && /addEventListener\('orientationchange',scheduleXiangqiPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('resize',scheduleXiangqiPresentationResize\)/.test(SOURCE) && /removeEventListener\('orientationchange',scheduleXiangqiPresentationResize\)/.test(SOURCE) &&
  /xiangqiPresentationResizeObserver\.disconnect\(\)/.test(SOURCE) &&
  /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,500}releaseXiangqiPresentationResize\(\)/.test(SOURCE));
check('narrow, compact landscape, and reduced-motion CSS keep the optional layer clipped and static',
  /@media\(max-width:720px\)\{[\s\S]{0,240}\.xiangqi-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,240}\.xiangqi-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,420}\.xiangqi-ghost3d-slot,[^}]*\.xiangqi-ghost3d-slot canvas\{animation:none!important;transition:none!important/.test(TEMPLATE));
check('feature-off, failure, reset, and destroy retain the permanent DOM fallback',
  /storage\.getItem\(XIANGQI_GHOST3D_STORAGE_KEY\) === '1'/.test(SOURCE) &&
  /xiangqiGhost3DSetReady\(false/.test(SOURCE) && /disposeXiangqiGhost3DBridge\(\)/.test(SOURCE) &&
  /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,500}disposeXiangqiGhost3DBridge\(\)/.test(SOURCE));

if (failures) {
  console.error('XIANGQI_GHOST3D_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('XIANGQI_GHOST3D_LAYOUT_ALL_PASS');
}
