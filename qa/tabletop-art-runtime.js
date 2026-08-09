#!/usr/bin/env node
'use strict';

/* Standalone contract test: no browser, build output or game server required. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'public', 'src', 'games', '00-tabletop-art-runtime.js');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function makeClassList(){
  const values = new Set();
  return {
    add(...items){ items.forEach(item => values.add(item)); },
    remove(...items){ items.forEach(item => values.delete(item)); },
    contains(item){ return values.has(item); },
  };
}

function makeDocument(){
  const styles = [];
  const head = { appendChild(node){ styles.push(node); return node; } };
  return {
    head,
    createElement(){ return { id:'', textContent:'', dataset:{} }; },
    getElementById(id){ return styles.find(node => node.id === id) || null; },
    styles,
  };
}

function loadRuntime(storage){
  const document = makeDocument();
  const sandbox = { document, localStorage:storage, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename:runtimePath });
  return { sandbox, document };
}

function makeSurface(){ return { classList:makeClassList(), dataset:{} }; }

function expect(condition, message){ assert.ok(condition, message); }

function testDefaultEnableAndStrictRollback(){
  let value = null;
  const storage = { getItem(){ return value; } };
  const { sandbox, document } = loadRuntime(storage);
  expect(sandbox.tabletopArtEnabled() === true, 'missing key must default Wave A on');
  const surface = makeSurface();
  sandbox.markTabletopSurface(surface, 'ludo-board', { variant:'classic' });
  expect(surface.classList.contains('tabletop-art-surface'), 'surface class should be attached by default');
  expect(surface.classList.contains('tabletop-art-wave-a'), 'Wave A class should be attached by default');
  expect(surface.dataset.tabletopKind === 'ludo-board', 'surface kind must be presentation metadata only');
  expect(surface.dataset.tabletopVariant === 'classic', 'surface variant must be presentation metadata only');
  expect(document.styles.length === 1, 'style injection must be idempotent');
  sandbox.markTabletopSurface(surface, 'ludo-board', { variant:'classic' });
  expect(document.styles.length === 1, 'repeated marks must not inject duplicate styles');

  value = '0';
  expect(sandbox.tabletopArtEnabled() === false, 'only exact string 0 may disable Wave A');
  sandbox.markTabletopSurface(surface, 'ludo-board');
  expect(!surface.classList.contains('tabletop-art-surface'), 'strict 0 must remove visual classes');
  expect(!Object.prototype.hasOwnProperty.call(surface.dataset, 'tabletopKind'), 'strict 0 must remove visual metadata');

  value = 'false';
  expect(sandbox.tabletopArtEnabled() === true, 'non-zero values must remain enabled');
  sandbox.markTabletopSurface(surface, 'ludo-board', { variant:'classic' });
  expect(surface.classList.contains('tabletop-art-wave-a'), 'non-zero rollback value must re-enable Wave A');
  expect(document.styles.length === 1, 're-enabling must reuse the original stylesheet');
}

function testStorageFailureDefaultsOn(){
  const { sandbox } = loadRuntime({ getItem(){ throw new Error('storage unavailable'); } });
  expect(sandbox.tabletopArtEnabled() === true, 'storage read failure must preserve default-on behavior');
}

function testPresentationOnlyFailureMode(){
  const document = makeDocument();
  const sandbox = { localStorage:{ getItem(){ return null; } }, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename:runtimePath });
  const surface = makeSurface();
  sandbox.markTabletopSurface(surface, 'tank-arena', { variant:'winter' });
  expect(surface.dataset.tabletopKind === 'tank-arena', 'runtime must still mark a surface when no document exists');
  expect(surface.dataset.tabletopVariant === 'winter', 'runtime must retain only visual variant metadata');
  expect(document.styles.length === 0, 'missing document must not fabricate a stylesheet or block rendering');
  sandbox.removeTabletopSurface(surface);
  expect(!surface.classList.contains('tabletop-art-wave-a'), 'explicit removal must leave a usable legacy surface');
}

function testStyleInjectionWithoutLookupApi(){
  const document = makeDocument();
  delete document.getElementById;
  const sandbox = { document, localStorage:{ getItem(){ return null; } }, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename:runtimePath });
  sandbox.markTabletopSurface(makeSurface(), 'tetris-well', { variant:'main' });
  sandbox.markTabletopSurface(makeSurface(), 'tetris-well', { variant:'mini' });
  expect(document.styles.length === 1, 'style injection must stay idempotent even in a limited WebView document shim');
}

function testStyleInjectionFailureDoesNotBlockRendering(){
  const document = makeDocument();
  document.head.appendChild = () => { throw new Error('style blocked'); };
  const sandbox = { document, localStorage:{ getItem(){ return null; } }, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename:runtimePath });
  const surface = makeSurface();
  assert.doesNotThrow(() => sandbox.markTabletopSurface(surface, 'gomoku-board'), 'a blocked style injection must not abort game rendering');
  expect(surface.classList.contains('tabletop-art-wave-a'), 'a blocked stylesheet keeps only harmless presentation metadata on the existing surface');
}

function testRuntimeSafetyAndCoverage(){
  const lowered = runtimeSource.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
  ['setinterval(', 'settimeout(', 'requestanimationframe(', 'fetch(', 'sendmove', 'snapshot', 'matchid', 'reward', 'aichoose', 'sticker', 'honru', 'mg_art_sticker', 'mg_persona', 'url('].forEach(token => {
    expect(!lowered.includes(token), 'runtime must not contain state/protocol/frozen-art token: ' + token);
  });
  expect(runtimeSource.includes('@media (prefers-reduced-motion:reduce)'), 'runtime must honor reduced motion');
  expect(runtimeSource.includes('rgba(33,25,35,.22)'), 'runtime must use the approved contact-shadow token');
  expect(runtimeSource.includes('data-tabletop-variant="grass"'), 'Wave A must preserve the existing grass board-theme distinction inside the shared paper style');
  expect(runtimeSource.includes('data-tabletop-variant$="-grid"') && runtimeSource.includes('--tt-tetris-cosmetic-shadow'), 'Wave A must retain Tetris Grid and Neon cosmetic distinction');
  [
    '[data-tabletop-kind="gomoku-board"]',
    '[data-tabletop-kind="ludo-board"] .tcell',
    '[data-tabletop-kind="ludo-board"] .tok',
    '[data-tabletop-kind="monopoly-board"] .m-cell',
    '[data-tabletop-kind="monopoly-board"] .m-marker',
    '[data-tabletop-kind="tank-arena"] .tank-cell.brick',
    '[data-tabletop-kind="tank-arena"] .arena-tank',
    '[data-tabletop-kind="tetris-well"] .tetris-cell',
    '[data-tabletop-kind="xiangqi-board"] .xiangqi-motion-piece',
  ].forEach(selector => expect(runtimeSource.includes(selector), 'Wave A must visibly cover core entity selector: ' + selector));
  const games = {
    gomoku:'gomoku-board',
    ludo:'ludo-board',
    monopoly:'monopoly-board',
    tank:'tank-arena',
    tetris:'tetris-well',
    xiangqi:'xiangqi-board',
  };
  Object.entries(games).forEach(([game, kind]) => {
    const source = fs.readFileSync(path.join(root, 'public', 'src', 'games', game + '.js'), 'utf8');
    new Function(source); // Syntax contract without invoking game code.
    expect(source.includes("markTabletopSurface") && source.includes("'" + kind + "'"), game + ' must mark its Wave A surface');
    expect(source.includes('tabletopArtEnabled'), game + ' must read only the shared Wave A opt-out helper');
    expect(!source.includes('mg_art_tabletop_wave_a'), game + ' must not independently persist or reinterpret the Wave A flag');
    expect(!/markTabletopSurface\([^\n]*(?:snapshot|matchId|reward|sendMove)/.test(source), game + ' marker call must not carry rule/protocol fields');
  });
  const gomoku = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
  const xiangqi = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'xiangqi.js'), 'utf8');
  expect(gomoku.includes('drawStickerStone') && gomoku.includes('const tabletop = tabletopMode()'), 'gomoku must render Wave A stones inside its existing canvas only');
  expect(xiangqi.includes('if (tabletop){') && xiangqi.includes("grassPaper ? '#3A5E3B' : '#443443'"), 'xiangqi must render Wave A board and pieces inside its existing canvas only');
  expect(xiangqi.includes("const jade = skin === 'jade'"), 'xiangqi must preserve Jade piece differentiation within Wave A');
}

testDefaultEnableAndStrictRollback();
testStorageFailureDefaultsOn();
testPresentationOnlyFailureMode();
testStyleInjectionWithoutLookupApi();
testStyleInjectionFailureDoesNotBlockRendering();
testRuntimeSafetyAndCoverage();
console.log('TABLETOP_ART_RUNTIME_PASS');
