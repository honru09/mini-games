'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const shop = read('public/src/shop/06-shop.js');
const template = read('public/index-template.html');
const surface = read('public/src/core/11-surface-motion.js');
const pkg = JSON.parse(read('package.json'));

let failures = 0;
function check(name, condition) {
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures += 1;
}

check('Shop reuses the shared finite Surface Motion seam without importing GSAP locally',
  /function runShopSurfaceMotion\(/.test(shop) &&
  /surface\s*:\s*['"]shop-dialog['"]/.test(shop) &&
  /runShopSurfaceMotion\(['"]open['"]/.test(shop) &&
  /settleShopSurfaceMotion\(/.test(shop) &&
  !/surface-motion-entry|createSurfaceMotionAdapter|\bgsap\.|ScrollTrigger/.test(shop));

check('Shop owns one accessible dialog close lifecycle with focus restoration',
  /setupAccessibleOverlayDialog\(bd\s*,\s*card\s*,\s*closeTop\s*,\s*t\(['"]shop_title['"]/.test(shop) &&
  /let dialogClose\s*=\s*null/.test(shop) &&
  /function releaseShopResources\(/.test(shop) &&
  /if\s*\(closed\)\s*return false/.test(shop) &&
  /return dialogClose\s*\?\s*dialogClose\(\)/.test(shop));

check('Nested collection preview owns the same accessible and scroll-lock lifecycle',
  /activeCollectionPreviewClose/.test(shop) &&
  /acquireModalScrollLock\(pbd\)/.test(shop) &&
  /setupAccessibleOverlayDialog\(pbd\s*,\s*pc/.test(shop) &&
  /releaseModalScrollLock\(pbd\)/.test(shop));

check('Premium preview subscriptions and reduced-motion collection assets have explicit owners',
  /let previewPlaybackCleanup\s*=\s*null/.test(shop) &&
  /if\s*\(previewPlaybackCleanup\)\s*previewPlaybackCleanup\(\)/.test(shop) &&
  /cleanup\s*:\s*typeof playbackCleanup/.test(shop) &&
  /applyPremiumBackground\(hero,item\.id,['"]shop-preview['"],\{autoplay:!prefersReducedMotion\(\)\}\)/.test(shop) &&
  /avatarCanvas\(parts\.avatarId,96,\{animate:!prefersReducedMotion\(\)\}\)/.test(shop));

check('Shop category navigation exposes tablist, roving tabs and a labelled tabpanel',
  /setAttribute\(['"]role['"]\s*,\s*['"]tablist['"]\)/.test(shop) &&
  /setAttribute\(['"]role['"]\s*,\s*['"]tab['"]\)/.test(shop) &&
  /aria-selected/.test(shop) && /aria-controls/.test(shop) && /tabIndex/.test(shop) &&
  /ArrowLeft/.test(shop) && /ArrowRight/.test(shop) && /Home/.test(shop) && /End/.test(shop) &&
  /setAttribute\(['"]role['"]\s*,\s*['"]tabpanel['"]\)/.test(shop) && /aria-labelledby/.test(shop));

check('Shop product controls, tabs and close action use the 44px interaction contract',
  /\.shop-item button\{[^}]*min-height:44px/.test(template) &&
  /\.shop-tab\{[^}]*min-height:44px/.test(template) &&
  /\.shop-close\{[^}]*min-width:44px[^}]*min-height:44px/.test(template));

check('Shop modal contains viewport scrolling and mobile safe areas without layout animation',
  /\.shop-modal-card\{[^}]*overscroll-behavior:contain/.test(template) &&
  /@media \(max-width: 480px\)[\s\S]*\.shop-modal-card\{[^}]*safe-area-inset-bottom/.test(template) &&
  !/\.shop-(?:modal-card|layout|preview-panel|item)[^{]*\{[^}]*(?:transition|animation)\s*:[^}]*(?:width|height|top|left|margin|padding)/.test(template));

check('Shared motion blocks Shop animation for reduced motion, hidden documents and Game Shell',
  /reducedMotion\(\)/.test(surface) && /documentRef\.hidden/.test(surface) && /shellActive/.test(surface));

check('Shop closure contract is registered in fast and full local gates',
  String(pkg.scripts['test:shop-contract'] || '').includes('qa/shop-design-system-closure.js') &&
  String(pkg.scripts.test || '').includes('qa/shop-design-system-closure.js') &&
  /shop-design-system-closure/.test(read('scripts/quality-gates.js')));

if (failures) {
  console.error('SHOP_DESIGN_SYSTEM_CLOSURE_FAILURES=' + failures);
  process.exit(1);
}
console.log('SHOP_DESIGN_SYSTEM_CLOSURE_ALL_PASS');
