/* ================= 美术资源运行时（P0） ================= */
const ASSET_ROOT = 'assets/';
const CURRENCY = '💵';
const ASSET_CATALOG = Object.freeze({
  brandMark: 'brand/logo_mark.svg',
  brandWordmark: 'brand/logo_wordmark.svg',
  currencyCash: 'ui/currency_cash.svg',
  manifest: 'manifests/asset_manifest.json',
});
const GAME_ART = Object.freeze({
  gomoku: Object.freeze({
    flag: 'mg_art_gomoku_v1',
    cover: 'ui/game_covers/game_gomoku.webp',
    coverSmall: 'ui/game_covers/game_gomoku_320.webp',
    board: 'board/gomoku/mg_board_gomoku_surface_v01.webp',
  }),
  tetris: Object.freeze({
    flag: 'mg_art_tetris_v1',
    cover: 'ui/game_covers/game_tetris.webp',
    coverSmall: 'ui/game_covers/game_tetris_320.webp',
    board: 'board/tetris/mg_board_tetris_well_v01.webp',
  }),
});

function assetUrl(key){
  const path = ASSET_CATALOG[key] || key || '';
  return ASSET_ROOT + String(path).replace(/^\/+/, '');
}

function gameArtEnabled(id){
  const art = GAME_ART[id];
  if (!art) return false;
  try { return localStorage.getItem(art.flag) !== '0'; }
  catch (error) { return true; }
}

function gameArtUrl(id, role){
  const art = GAME_ART[id];
  return art && art[role] ? assetUrl(art[role]) : '';
}

function setAssetCssUrl(element, property, url){
  const value = 'url("' + url + '")';
  if (element.style && typeof element.style.setProperty === 'function') element.style.setProperty(property, value);
  else if (element.style) element.style[property] = value;
}

function gameCoverNode(id, game){
  const art = GAME_ART[id];
  if (!art || !gameArtEnabled(id)) return null;
  const cover = el('div', 'game-cover');
  cover.setAttribute('aria-hidden', 'true');
  const fallback = el('span', 'game-cover-fallback', game.icon);
  const img = document.createElement('img');
  img.src = assetUrl(art.cover);
  img.srcset = assetUrl(art.coverSmall) + ' 320w, ' + assetUrl(art.cover) + ' 640w';
  img.sizes = '(max-width: 480px) 45vw, 220px';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = '';
  img.addEventListener('load', () => cover.classList.add('asset-ready'));
  img.addEventListener('error', () => {
    img.style.display = 'none';
    cover.classList.add('asset-failed');
  });
  cover.appendChild(fallback);
  cover.appendChild(img);
  return cover;
}

function currencyIcon(sizeClass){
  const wrap = el('span', 'coin' + (sizeClass ? ' ' + sizeClass : ''));
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', t('currency_aria'));
  const img = el('img', 'coin-asset');
  img.src = assetUrl('currencyCash');
  img.alt = '';
  const fallback = el('span', 'coin-fallback', CURRENCY);
  img.addEventListener('error', () => {
    img.style.display = 'none';
    wrap.classList.add('asset-failed');
  });
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  return wrap;
}

function initAssetFallbacks(){
  if (!document || !document.querySelectorAll) return;
  document.querySelectorAll('[data-asset-fallback]').forEach(holder => {
    const img = holder.querySelector('img');
    if (!img) return;
    img.addEventListener('error', () => {
      img.style.display = 'none';
      holder.classList.add('asset-failed');
    });
  });
}
