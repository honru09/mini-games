'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'ludo.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

const slotCss = /\.ludo-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:1[^}]*pointer-events:none/.test(TEMPLATE);
const readyCss = /\.ludo-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*pointer-events:auto/.test(TEMPLATE);
const canvasCss = /\.ludo-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*border-radius:inherit/.test(TEMPLATE);
const fallbackCss = /\.ludo-wave-b-board-frame\[data-ghost3d-ready="true"\] \.ludo-wave-b-board\{[^}]*opacity:0[^}]*pointer-events:none/.test(TEMPLATE);

check('Ludo overlay atomically replaces DOM paint after readiness with strict pointer fallback', slotCss && readyCss && fallbackCss);
check('overlay canvas fills the inherited rounded clipping frame without changing DOM board sizing',
  canvasCss && /\.ludo-wave-b-board-frame\{position:relative;overflow:hidden\}/.test(TEMPLATE) &&
  /\.ludo-wave-b-board\{[^}]*width:var\(--ludo-wave-c-board-size\)!important[^}]*height:var\(--ludo-wave-c-board-size\)!important/.test(TEMPLATE));
check('narrow, compact-landscape, and reduced-motion CSS keep the optional overlay clipped and inert',
  /@media\(max-width:720px\)\{[\s\S]{0,1200}\.ludo-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,1100}\.ludo-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,1000}\.ludo-ghost3d-slot,[^}]*\.ludo-ghost3d-slot canvas\{animation:none!important;transition:none!important\}/.test(TEMPLATE));
const smallScreenRule = '@media(max-width:420px){';
const portraitRule = '@media(max-width:720px) and (orientation:portrait){';
const smallScreenIndex = TEMPLATE.indexOf(smallScreenRule);
const portraitIndex = TEMPLATE.indexOf(portraitRule);
const portraitBlock = portraitIndex >= 0 ? TEMPLATE.slice(portraitIndex, TEMPLATE.indexOf('@media(max-height:600px) and (orientation:landscape){', portraitIndex)) : '';
const portraitArenaCss = /\.ludo-wave-b-arena\{grid-template-columns:minmax\(0,1fr\);justify-content:stretch\}/.test(portraitBlock);
const portraitFrameCss = /\.ludo-wave-b-board-frame\{width:100%;height:auto;min-height:0;aspect-ratio:1\}/.test(portraitBlock);
const portraitBoardCss = /\.ludo-wave-b-board\{width:100%!important;height:100%!important;max-width:100%;max-height:100%;box-sizing:border-box\}/.test(portraitBlock);
check('390px portrait Ludo arena has a full-width explicit single grid track before stage, frame, and board sizing',
  portraitArenaCss && /\.ludo-wave-b-stage[^}]*width:100%/.test(TEMPLATE));
check('390px portrait Ludo frame is constrained by its one-column track instead of viewport min-height',
  smallScreenIndex >= 0 && portraitIndex > smallScreenIndex &&
  portraitArenaCss && portraitFrameCss);
check('390px portrait Ludo CSS guarantees frame.scrollWidth <= frame.clientWidth for the DOM fallback board',
  portraitArenaCss && portraitFrameCss && portraitBoardCss);
check('Wave B fallback geometry uses the frame content width at every viewport, including 390px portrait',
  portraitBoardCss && /function ludoWaveBBoardContentWidth\(\)\{[\s\S]{0,900}frameClientWidth[\s\S]{0,900}paddingLeft[\s\S]{0,900}return Math\.max\(0, frameClientWidth - horizontalPadding\)/.test(SOURCE) &&
  /const w = ludoWaveBBoardContentWidth\(\) \|\| area\.clientWidth \|\| 520;/.test(SOURCE) &&
  !/function ludoWaveBBoardContentWidth\(\)\{[\s\S]{0,240}matchMedia/.test(SOURCE));
check('portrait-to-landscape or desktop resize recomputes presentation geometry once per frame and cleans up on destroy',
  /function scheduleLudoPresentationResize\(\)\{[\s\S]{0,1200}renderBoard\(\)[\s\S]{0,1200}requestAnimationFrame\(run\)/.test(SOURCE) &&
  /addEventListener\('resize', scheduleLudoPresentationResize\)/.test(SOURCE) &&
  /addEventListener\('orientationchange', scheduleLudoPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('resize', scheduleLudoPresentationResize\)/.test(SOURCE) &&
  /removeEventListener\('orientationchange', scheduleLudoPresentationResize\)/.test(SOURCE) &&
  /destroy: \(\) => \{[^\n]*releaseLudoPresentationResize\(\)/.test(SOURCE));
check('slot is appended after the retained board, while the Wave B metadata remains a later stage sibling',
  /ludoWaveBBoardFrame\.appendChild\(board\);\s*mountLudoGhost3DSlot\(\);\s*ludoWaveBStage\.appendChild\(ludoWaveBBoardFrame\);\s*ludoWaveBStage\.appendChild\(ludoWaveBMeta\);/.test(SOURCE));
check('DOM dice action remains mounted outside the renderer slot and retains its existing click path',
  /diceBtn\.addEventListener\('click', roll\)/.test(SOURCE) && /ludoWaveBCommand\.appendChild\(diceBtn\)/.test(SOURCE) &&
  !/ludo-ghost3d-slot[^\n]*dice-btn/.test(TEMPLATE));
check('disabled, unsupported, and failed overlay states restore the regular Wave B board surface',
  /slot\.dataset\.ghost3dReady = 'false'/.test(SOURCE) && /ludoGhost3DSetReady\(false/.test(SOURCE) &&
  /if \(!ludoWaveBActive\) return false;/.test(SOURCE) && /disposeLudoGhost3DBridge\(\);/.test(SOURCE));

if (failures) {
  console.error('LUDO_GHOST3D_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('LUDO_GHOST3D_LAYOUT_ALL_PASS');
}
