/* ================= Pocket Tabletop Wave A (presentation-only) ================= */
/*
 * This module intentionally owns no game state.  It only adds a reversible class
 * and data attributes to the existing DOM surfaces so the rule, snapshot, AI and
 * network layers remain byte-for-byte unaware of the visual treatment.
 */
(function tabletopArtRuntime(global){
  'use strict';

  const STORAGE_KEY = 'mg_art_tabletop_wave_a';
  const STYLE_ID = 'tabletop-art-runtime-wave-a';
  const SURFACE_CLASS = 'tabletop-art-surface';
  const WAVE_CLASS = 'tabletop-art-wave-a';
  let stylesAttached = false;
  const STYLE_TEXT = `
    /* Original Pocket Tabletop palette: Ink / Paper / Cream. */
    .${SURFACE_CLASS}.${WAVE_CLASS}{
      --tt-ink:#211923;
      --tt-ink-soft:#443443;
      --tt-paper:#FFF9F2;
      --tt-cream:#F3E5C4;
      --tt-shadow:rgba(33,25,35,.22);
      --tt-highlight:rgba(255,255,255,.62);
      isolation:isolate;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="gomoku-board"],
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"],
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"],
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"],
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"],
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="xiangqi-board"]{
      outline:clamp(3px,.55vw,7px) solid var(--tt-ink);
      outline-offset:0;
      border-radius:clamp(12px,2.8vw,24px);
      box-shadow:0 4px 0 var(--tt-ink), 10px 15px 0 var(--tt-shadow);
      background-color:var(--tt-cream) !important;
      background-image:linear-gradient(135deg,rgba(255,249,242,.92),rgba(243,229,196,.94)) !important;
      background-origin:border-box;
      background-clip:padding-box;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="gomoku-board"]{
      background-image:linear-gradient(135deg,rgba(255,249,242,.86),rgba(243,229,196,.93)),linear-gradient(90deg,rgba(130,81,63,.07) 1px,transparent 1px) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="gomoku-board"][data-tabletop-variant="grass"]{
      background-color:#C9DCAD !important;
      background-image:linear-gradient(135deg,rgba(250,252,232,.92),rgba(183,211,137,.94)),linear-gradient(90deg,rgba(54,86,52,.07) 1px,transparent 1px) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"]{
      background-image:radial-gradient(circle at 28% 20%,rgba(255,255,255,.72),transparent 24%),linear-gradient(135deg,#FFF9F2,#F3E5C4) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"][data-tabletop-variant="grass"]{
      background-color:#C9DCAD !important;
      background-image:radial-gradient(circle at 28% 20%,rgba(255,255,255,.72),transparent 24%),linear-gradient(135deg,#F7F9E7,#B7D389) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"][data-ludo-final-art="active"]{
      background-color:#F3E5C4 !important;
      background-image:linear-gradient(rgba(255,249,242,.05),rgba(33,25,35,.08)),var(--ludo-final-board-art) !important;
      background-size:cover !important;
      background-position:center !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"]{
      background-image:radial-gradient(circle at 35% 26%,rgba(255,255,255,.76),transparent 26%),linear-gradient(135deg,#FFF9F2,#F3E5C4) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"][data-tabletop-variant="grass"]{
      background-color:#C9DCAD !important;
      background-image:radial-gradient(circle at 35% 26%,rgba(255,255,255,.76),transparent 26%),linear-gradient(135deg,#F7F9E7,#B7D389) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"]{
      background-image:radial-gradient(circle at 22% 16%,rgba(255,255,255,.35),transparent 22%),linear-gradient(135deg,#74b985,#3b7b62) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"][data-tabletop-variant="autumn"]{background-image:radial-gradient(circle at 22% 16%,rgba(255,249,242,.5),transparent 22%),linear-gradient(135deg,#e5b56a,#9b643f) !important;}
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"][data-tabletop-variant="winter"]{background-image:radial-gradient(circle at 22% 16%,rgba(255,255,255,.72),transparent 24%),linear-gradient(135deg,#d9edf3,#82a8b5) !important;}
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"][data-tabletop-variant="summer"]{background-image:radial-gradient(circle at 22% 16%,rgba(255,244,163,.52),transparent 23%),linear-gradient(135deg,#79b86c,#3e7e50) !important;}
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"]{
      background-image:linear-gradient(rgba(33,25,35,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(33,25,35,.11) 1px,transparent 1px),linear-gradient(135deg,#FFF9F2,#E7D3A7) !important;
      background-size:var(--tetris-cell-size,24px) var(--tetris-cell-size,24px),var(--tetris-cell-size,24px) var(--tetris-cell-size,24px),auto !important;
      overflow:hidden;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"][data-tabletop-variant$="-grid"]{
      background-color:#DCECF2 !important;
      background-image:linear-gradient(rgba(39,105,128,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(39,105,128,.16) 1px,transparent 1px),linear-gradient(135deg,#F2FBFC,#B8D8E3) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="xiangqi-board"]{background-image:linear-gradient(135deg,#FFF9F2,#E8C989) !important;}
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="xiangqi-board"][data-tabletop-variant="grass"]{background-color:#C9DCAD !important;background-image:linear-gradient(135deg,#F7F9E7,#B7D389) !important;}

    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .tcell,
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .hcell{
      outline:2px solid var(--tt-ink);
      border-radius:34%;
      box-shadow:2px 3px 0 rgba(33,25,35,.16),inset 2px 2px 0 rgba(255,255,255,.58);
      background:rgba(255,249,242,.84);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .ludo-base{
      outline:3px solid var(--tt-ink);
      border-radius:24% !important;
      background:linear-gradient(145deg,rgba(255,255,255,.54),var(--ludo-player-soft,#F3E5C4)) !important;
      box-shadow:3px 5px 0 var(--tt-shadow),inset 3px 3px 0 rgba(255,255,255,.5);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .slot{
      outline:2px solid var(--tt-ink);
      background:rgba(255,249,242,.72);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .tok{
      outline:2px solid var(--tt-ink);
      border-radius:42% 42% 48% 48% !important;
      box-shadow:2px 3px 0 var(--tt-shadow),inset 2px 2px 0 rgba(255,255,255,.56);
      filter:saturate(.92);
      overflow:visible;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .tok::before{
      content:'';
      position:absolute;
      width:30%;height:30%;left:17%;top:13%;
      border-radius:50%;background:var(--tt-highlight);
      pointer-events:none;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .tok:not([data-piece-skin="jet"])::after{
      content:'✦';
      position:absolute;inset:50% auto auto 50%;
      transform:translate(-50%,-52%);
      color:var(--tt-paper);font-size:.62em;line-height:1;
      text-shadow:0 1px 0 var(--tt-ink-soft);
      pointer-events:none;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="ludo-board"] .ludo-center{
      outline:3px solid var(--tt-ink);
      border-radius:42% !important;
      background:linear-gradient(145deg,#FFF9F2,#F1B640) !important;
      box-shadow:3px 5px 0 var(--tt-shadow);
    }

    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"] .m-cell{
      outline:2px solid var(--tt-ink);
      border-radius:13px !important;
      background:linear-gradient(145deg,#FFF9F2,#F3E5C4) !important;
      box-shadow:2px 3px 0 var(--tt-shadow),inset 2px 2px 0 rgba(255,255,255,.62);
      color:var(--tt-ink) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"] .m-cell .stripe{
      outline:2px solid var(--tt-ink);
      border-radius:8px 8px 0 0;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"] .m-marker{
      outline:2px solid var(--tt-ink);
      border-radius:42% !important;
      box-shadow:2px 3px 0 var(--tt-shadow),inset 2px 2px 0 rgba(255,255,255,.58);
      color:var(--tt-ink) !important;
      display:grid;
      place-items:center;
      font-size:clamp(13px,2.2vw,20px);
      text-shadow:0 1px 0 var(--tt-highlight);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="monopoly-board"] .m-center{
      outline:3px solid var(--tt-ink);
      border-radius:22px !important;
      background:linear-gradient(145deg,rgba(255,249,242,.98),rgba(241,182,64,.78)) !important;
      box-shadow:4px 6px 0 var(--tt-shadow),inset 3px 3px 0 rgba(255,255,255,.58);
    }

    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .tank-cell{
      outline:1px solid var(--tt-ink);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .tank-cell.brick{
      background:linear-gradient(145deg,#d99064,#9c4e42) !important;
      border-radius:16%;
      box-shadow:inset 2px 2px 0 rgba(255,249,242,.4),1px 2px 0 rgba(33,25,35,.26);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .tank-cell.steel{
      background:linear-gradient(145deg,#d6e2e3,#78969c) !important;
      border-radius:16%;
      box-shadow:inset 2px 2px 0 rgba(255,255,255,.68),1px 2px 0 rgba(33,25,35,.26);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .arena-tank{
      outline:2px solid var(--tt-ink);
      border-radius:34% 34% 40% 40%;
      background:linear-gradient(145deg,#FFF9F2,#F1B640) !important;
      box-shadow:2px 3px 0 var(--tt-shadow),inset 2px 2px 0 rgba(255,255,255,.62);
      color:var(--tt-ink) !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .arena-tank .tank-icon{
      filter:none;
      display:grid;place-items:center;
      width:72%;height:72%;border-radius:45%;
      background:linear-gradient(145deg,var(--tt-paper),rgba(241,182,64,.62));
      box-shadow:inset 1px 1px 0 var(--tt-highlight);
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tank-arena"] .tank-projectile{
      border-radius:50%;
      filter:drop-shadow(1px 2px 0 rgba(33,25,35,.36));
      text-shadow:none;
    }

    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"] .tetris-cell{
      outline:2px solid var(--tt-ink);
      border-radius:22%;
      box-shadow:inset 2px 2px 0 rgba(255,255,255,.52),2px 3px 0 rgba(33,25,35,.24),var(--tt-tetris-cosmetic-shadow,0 0 transparent) !important;
      background-clip:padding-box;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"] .tetris-cell.ghost{
      background:rgba(255,249,242,.35) !important;
      box-shadow:none !important;
      border-style:dashed !important;
    }
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="tetris-well"] .tetris-ko{background:rgba(33,25,35,.78) !important;}
    .${SURFACE_CLASS}.${WAVE_CLASS}[data-tabletop-kind="xiangqi-board"] .xiangqi-motion-piece{
      outline:2px solid var(--tt-ink);
      background:linear-gradient(145deg,#FFF9F2,#F3E5C4) !important;
      box-shadow:2px 3px 0 var(--tt-shadow),inset 2px 2px 0 rgba(255,255,255,.62) !important;
      color:var(--tt-ink) !important;
    }

    @media (prefers-reduced-motion:reduce){
      .${SURFACE_CLASS}.${WAVE_CLASS},
      .${SURFACE_CLASS}.${WAVE_CLASS} *{animation:none !important;transition:none !important;scroll-behavior:auto !important;}
    }
  `;

  function tabletopArtEnabled(){
    try {
      const storage = global && global.localStorage;
      return !storage || storage.getItem(STORAGE_KEY) !== '0';
    } catch (error) {
      // Storage may be unavailable in private/sandboxed contexts. Wave A is opt-out,
      // so an unreadable value deliberately remains enabled.
      return true;
    }
  }

  function ensureTabletopArtStyles(){
    const documentRef = global && global.document;
    if (!documentRef || typeof documentRef.createElement !== 'function') return false;
    if (typeof documentRef.getElementById === 'function' && documentRef.getElementById(STYLE_ID)) return true;
    if (stylesAttached) return true;
    const target = documentRef.head || documentRef.documentElement || documentRef.body;
    if (!target || typeof target.appendChild !== 'function') return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    if (style.dataset) style.dataset.tabletopArtRuntime = 'wave-a';
    try {
      target.appendChild(style);
    } catch (error) {
      // A restrictive embedded WebView/CSP must never make game setup fail.
      // The caller can still render its existing CSS/Canvas fallback surface.
      return false;
    }
    stylesAttached = true;
    return true;
  }

  function removeTabletopSurface(node){
    if (!node) return node;
    if (node.classList && typeof node.classList.remove === 'function'){
      node.classList.remove(SURFACE_CLASS, WAVE_CLASS);
    }
    if (node.dataset){
      delete node.dataset.tabletopSurface;
      delete node.dataset.tabletopKind;
      delete node.dataset.tabletopVariant;
    }
    return node;
  }

  function markTabletopSurface(node, kind, options){
    if (!node) return node;
    if (!tabletopArtEnabled()) return removeTabletopSurface(node);
    ensureTabletopArtStyles();
    if (node.classList && typeof node.classList.add === 'function'){
      node.classList.add(SURFACE_CLASS, WAVE_CLASS);
    }
    if (node.dataset){
      node.dataset.tabletopSurface = 'wave-a';
      node.dataset.tabletopKind = String(kind || 'surface');
      if (options && options.variant !== undefined && options.variant !== null) node.dataset.tabletopVariant = String(options.variant);
      else delete node.dataset.tabletopVariant;
    }
    return node;
  }

  global.tabletopArtEnabled = tabletopArtEnabled;
  global.ensureTabletopArtStyles = ensureTabletopArtStyles;
  global.markTabletopSurface = markTabletopSurface;
  global.removeTabletopSurface = removeTabletopSurface;
})(typeof globalThis !== 'undefined' ? globalThis : this);
