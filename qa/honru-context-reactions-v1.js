'use strict';

// P0-08: Honru 16 context states + 16 quick visual variants, runtime, fallback and authority isolation.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const bytes = rel => fs.readFileSync(path.join(ROOT, rel));
const json = rel => JSON.parse(read(rel));
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const sha = rel => crypto.createHash('sha256').update(bytes(rel)).digest('hex').toUpperCase();
const failures = [];
const check = (name, condition, detail) => {
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
};

const EXPECTED_CONTEXTS = ['ready','your-turn','thinking','throw','hit','capture','score','combo','warning','reconnect','spectator','win','lose','draw','rematch','celebration'];
const EXPECTED_GROUPS = {
  quick_hello:['quick_hello_a','quick_hello_b','quick_hello_c'],
  quick_good_luck:['quick_good_luck_a','quick_good_luck_b','quick_good_luck_c'],
  quick_nice:['quick_nice_a','quick_nice_b','quick_nice_c'],
  quick_wow:['quick_wow_a','quick_wow_b'],
  quick_thanks:['quick_thanks_a','quick_thanks_b'],
  quick_again:['quick_again_a','quick_again_b','quick_again_c'],
};
const EXPECTED_CELLS = Object.values(EXPECTED_GROUPS).flat();
const FAMILY_PATH = 'art-source/brand/ghost-game/honru/context-reactions-v1/asset-family-manifest-v1.json';
const FAMILY = json(FAMILY_PATH);
const PUBLIC_MANIFEST = json('public/assets/manifests/asset_manifest.json');
const PUBLIC_ENTRY = PUBLIC_MANIFEST.assets.find(item => item && item.asset_id === 'P-HONRU-CONTEXT-REACTIONS-V1');
const CATALOG = json('asset-library/catalog.json');
const CATALOG_ENTRY = CATALOG.assets.find(item => item && item.id === 'P-HONRU-CONTEXT-REACTIONS-V1');
const ASSETS = read('public/src/core/06-assets.js');
const SHELL = read('public/src/core/02-app-shell.js');
const TEMPLATE = read('public/index-template.html');
const UTILS = read('public/src/core/01-utils.js');
const SERVER = read('server/index.js');
const PROTOCOL = read('server/gameplay/protocol.js');

function pngSize(rel) {
  const data = bytes(rel);
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (data.length < 33 || !data.subarray(0, 8).equals(signature) || data.toString('ascii', 12, 16) !== 'IHDR') throw new Error('invalid PNG');
  return { width:data.readUInt32BE(16), height:data.readUInt32BE(20), bitDepth:data[24], colorType:data[25], bytes:data.length };
}

function webpSize(rel) {
  const data = bytes(rel);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw new Error('invalid WebP');
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = data.toString('ascii', offset, offset + 4), length = data.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > data.length) throw new Error('truncated WebP');
    if (type === 'VP8X') return { width:1 + data[start+4] + (data[start+5]<<8) + (data[start+6]<<16), height:1 + data[start+7] + (data[start+8]<<8) + (data[start+9]<<16), bytes:data.length };
    if (type === 'VP8 ' && data[start+3] === 0x9d && data[start+4] === 0x01 && data[start+5] === 0x2a) return { width:data.readUInt16LE(start+6)&0x3fff, height:data.readUInt16LE(start+8)&0x3fff, bytes:data.length };
    if (type === 'VP8L' && data[start] === 0x2f) { const bits=data.readUInt32LE(start+1); return { width:1+(bits&0x3fff), height:1+((bits>>>14)&0x3fff), bytes:data.length }; }
    offset = start + length + (length & 1);
  }
  throw new Error('missing dimensions');
}

function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

check('family manifest is owner-cleared P0-08 with the frozen identity anchor',
  FAMILY.productionUnitId === 'P0-08' && FAMILY.familyId === 'P-HONRU-CONTEXT-REACTIONS-V1' &&
  FAMILY.status === 'OWNER_AUTHORIZED_ART_CLEARANCE' && FAMILY.sourceAssetId === 'ART-HONRU-CONTEXT-REACTIONS-V1' &&
  FAMILY.sourceMother.sha256 === sha(FAMILY.sourceMother.path) &&
  FAMILY.identityLock.hands.includes('no fingers'));
check('owner-approved chroma mother is pinned to the final user-selected Q-hand image',
  sha('art-source/brand/ghost-game/honru/context-reactions-v1/source/honru-hand-corrected-master-v1.png') ===
  '6E670901E2B34A06CC8A0C30FD376E8CD385E8B3E1E550B40E0A175506135144');
check('exactly 16 ordered context IDs are frozen', equal(FAMILY.contextIds, EXPECTED_CONTEXTS) && new Set(FAMILY.contextIds).size === 16);
check('exactly six stable quick protocol IDs map to 16 distinct visuals',
  equal(FAMILY.quickGroups, EXPECTED_GROUPS) && equal(FAMILY.quickProtocolIds, Object.keys(EXPECTED_GROUPS)) &&
  EXPECTED_CELLS.length === 16 && new Set(EXPECTED_CELLS).size === 16);

let contextSourcesOk = FAMILY.contextSources.length === 16;
for (const row of FAMILY.contextSources) {
  try { const image=pngSize(row.path); contextSourcesOk = contextSourcesOk && EXPECTED_CONTEXTS.includes(row.id) && image.width === 512 && image.height === 512 && image.bitDepth === 8 && [3,6].includes(image.colorType) && row.alpha === true && row.bakedText === false && row.sha256 === sha(row.path) && row.bytes === image.bytes; }
  catch { contextSourcesOk = false; }
}
check('all 16 context source PNGs are hash-pinned 512×512 RGBA without baked text', contextSourcesOk);

let quickSourcesOk = FAMILY.quickSources.length === 16;
for (const row of FAMILY.quickSources) {
  try { const image=pngSize(row.path); quickSourcesOk = quickSourcesOk && EXPECTED_CELLS.includes(row.id) && EXPECTED_GROUPS[row.protocolId].includes(row.id) && /^[A-C]$/.test(row.variant) && image.width === 256 && image.height === 256 && [3,6].includes(image.colorType) && row.alpha === true && row.bakedText === false && row.sha256 === sha(row.path); }
  catch { quickSourcesOk = false; }
}
check('all 16 quick source PNGs are hash-pinned 256×256 RGBA and retain protocol mapping', quickSourcesOk);

let runtimeOk = FAMILY.runtimeContexts.length === 16;
for (const row of FAMILY.runtimeContexts) {
  try { const image=webpSize(row.path); runtimeOk = runtimeOk && image.width === 320 && image.height === 320 && row.sha256 === sha(row.path) && row.bytes === image.bytes && PUBLIC_ENTRY.variants[row.id] === row.path && PUBLIC_ENTRY.variant_integrity[row.id] === 'sha256:' + row.sha256.toLowerCase(); }
  catch { runtimeOk = false; }
}
check('all 16 runtime contexts are 320×320 WebP with Manifest path/SHA/bytes parity', runtimeOk);

const atlas = webpSize(FAMILY.quickAtlas.path);
const expectedGeometry = { width:1024, height:1024, columns:4, rows:4, cell:256 };
check('quick atlas is a 1024×1024 WebP with exact 4×4/256 geometry and pinned hash',
  atlas.width === 1024 && atlas.height === 1024 && FAMILY.quickAtlas.sha256 === sha(FAMILY.quickAtlas.path) &&
  equal({ width:FAMILY.quickAtlas.width,height:FAMILY.quickAtlas.height,columns:FAMILY.quickAtlas.columns,rows:FAMILY.quickAtlas.rows,cell:FAMILY.quickAtlas.cell }, expectedGeometry) &&
  equal(PUBLIC_ENTRY.atlas, expectedGeometry));
const cells = FAMILY.quickAtlas.cells;
check('all 16 atlas cells are unique, bounded, row-major, and protocol-isomorphic', EXPECTED_CELLS.every((id, index) => {
  const cell=cells[id], protocol=Object.keys(EXPECTED_GROUPS).find(key => EXPECTED_GROUPS[key].includes(id));
  return cell && cell.x === (index%4)*256 && cell.y === Math.floor(index/4)*256 && cell.w === 256 && cell.h === 256 && cell.protocol_id === protocol && /^[A-C]$/.test(cell.variant);
}) && equal(PUBLIC_ENTRY.cells, cells));

check('runtime budget remains below 2 MiB and counts are complete',
  FAMILY.metrics.contextSourceCount === 16 && FAMILY.metrics.runtimeContextCount === 16 && FAMILY.metrics.quickSourceCount === 16 &&
  FAMILY.metrics.quickAtlasCellCount === 16 && FAMILY.metrics.withinBudget === true && FAMILY.metrics.runtimeBytes === PUBLIC_ENTRY.actual_bytes && PUBLIC_ENTRY.actual_bytes <= PUBLIC_ENTRY.byte_budget);
check('review packet contains two contact sheets plus one family poster',
  FAMILY.reviewBoards.length === 3 && FAMILY.reviewBoards.every(row => exists(row.path) && sha(row.path) === row.sha256));
check('generator and family records forbid baked text and external restricted pixels',
  !/<text\b/i.test(read('scripts/generate-honru-context-reactions-v1.js')) && FAMILY.a11y.includes('no baked text') &&
  FAMILY.externalReferencePolicy.includes('No EXTERNAL_REFERENCE_ONLY / blocked-license pixels'));

check('public Manifest uses reversible default-on flags and an explicit legacy fallback chain',
  PUBLIC_ENTRY && PUBLIC_ENTRY.runtime_id === 'honru' && PUBLIC_ENTRY.status === 'ready' && PUBLIC_ENTRY.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' &&
  equal(PUBLIC_ENTRY.feature_flags, { operator:'all', enabled_value:'1', default_enabled:true, ids:['mg_art_honru_context_reactions_v1','mg_art_honru_quick_stickers_v1'] }) &&
  PUBLIC_ENTRY.fallback_asset_id === 'P-HONRU-STATES-V1' && /localized quick text/.test(PUBLIC_ENTRY.fallback));
check('asset catalog separates the approved source mother from local runtime derivatives',
  CATALOG_ENTRY && CATALOG_ENTRY.status === 'integrated-local-only' && CATALOG_ENTRY.sourcePath === FAMILY.sourceMother.path &&
  CATALOG_ENTRY.sourceSha256 === FAMILY.sourceMother.sha256.toLowerCase() && CATALOG_ENTRY.runtimePaths.length === 17 &&
  CATALOG_ENTRY.runtimePaths.every(rel => rel.startsWith('public/assets/brand/honru/context-reactions-v1/')));

const resolverStart = ASSETS.indexOf('function honruQuickVariantHash');
const resolverEnd = ASSETS.indexOf('async function resolveHonruEmojiCell', resolverStart);
const resolverSource = ASSETS.slice(resolverStart, resolverEnd);
const resolverManifest = { assets:[PUBLIC_ENTRY] };
const resolverContext = vm.createContext({ Object,Array,Number,String,Math,Map,Set,JSON,Promise,
  HONRU_QUICK_ID_SET:new Set(Object.keys(EXPECTED_GROUPS)), HONRU_QUICK_GROUPS:EXPECTED_GROUPS,
  HONRU_CONTEXT_REACTIONS_ASSET_ID:'P-HONRU-CONTEXT-REACTIONS-V1', HONRU_CONTEXT_REACTIONS_FLAG:'mg_art_honru_context_reactions_v1', HONRU_QUICK_STICKERS_FLAG:'mg_art_honru_quick_stickers_v1',
  honruQuickStickersEnabled:()=>true, loadRuntimeAssetManifest:async()=>resolverManifest, assetUrl:value=>'assets/'+value,
  runtimeAssetManifestPromise:null,
});
vm.runInContext(resolverSource, resolverContext, { filename:'honru-quick-resolver.js' });
resolverContext.__resolve = (id, eventId) => vm.runInContext(`resolveHonruQuickCell(${JSON.stringify(id)},${JSON.stringify(eventId)})`, resolverContext);

(async () => {
  const sameA=await resolverContext.__resolve('quick_hello','event-123'), sameB=await resolverContext.__resolve('quick_hello','event-123');
  const samples=await Promise.all(Array.from({length:40},(_,i)=>resolverContext.__resolve('quick_hello','event-'+i)));
  check('quick variant selection is deterministic and returns only allowlisted cells',
    sameA && sameB && sameA.cellId === sameB.cellId && sameA.variant === sameB.variant && samples.every(cell => cell && EXPECTED_GROUPS.quick_hello.includes(cell.cellId)));
  check('unknown quick IDs and path traversal are fail-closed',
    await resolverContext.__resolve('../quick_hello','event') === null && await resolverContext.__resolve('quick_victory','event') === null);
  const damaged = JSON.parse(JSON.stringify(PUBLIC_ENTRY)); damaged.quick_atlas = 'public/assets/brand/honru/context-reactions-v1/../../secret.webp';
  resolverManifest.assets=[damaged];
  check('tampered atlas paths and bad Manifest content are rejected', await resolverContext.__resolve('quick_hello','event') === null);
  resolverManifest.assets=[PUBLIC_ENTRY];

  check('runtime resolver validates exact 16 contexts, exact local paths, and decode-before-activation',
    ASSETS.includes("const HONRU_CONTEXT_IDS = Object.freeze(['ready','your-turn','thinking','throw','hit','capture','score','combo','warning','reconnect','spectator','win','lose','draw','rematch','celebration'])") &&
    /function resolveHonruContextUrl\s*\(/.test(ASSETS) && /expectedPath = 'public\/assets\/brand\/honru\/context-reactions-v1\/contexts\/honru-context-'/.test(ASSETS) &&
    /applyHonruContextImage[\s\S]*?probe\.decode\(\)[\s\S]*?useLegacy/.test(SHELL));
  check('context fallback is new context → old nine-state Honru → mascot SVG',
    /applyHonruContextImage\(img,state,fallbackState/.test(SHELL) && /applyHonruStateImage\(img,fallbackState\|\|'idle'/.test(SHELL) &&
    /brand\/honru-mascot-v1\.svg/.test(SHELL));
  check('quick picker, bubbles and targeted flight render stickers while labels remain localized HTML',
    /function matchExpressionQuickNode\s*\(/.test(SHELL) && /match-expression-quick-label/.test(SHELL) &&
    /item\.kind==='quick'.*honruQuickStickersEnabled/.test(SHELL) && /matchExpressionLabel\(item\.expressionId\)/.test(SHELL) &&
    TEMPLATE.includes('.honru-quick-sprite') && TEMPLATE.includes('.match-expression-quick-label'));
  check('mute, reduced motion, new-match/leave cleanup and finite flight removal remain explicit',
    /if\(matchExpressionUi\.muted\)clearMatchExpressionPresentation\(\)/.test(SHELL) && /prefersReducedMotion\(\)/.test(SHELL) &&
    /function clearMatchExpressionFlights\(\)[\s\S]*?flightTimers[\s\S]*?\.remove\(\)/.test(SHELL) &&
    /setTimeout\(\(\)=>\{flight\.remove\(\)/.test(SHELL) && /function clearMatchExpressions\(\)/.test(SHELL));
  check('spectator, celebration and rematch have real presentation entry points',
    /const spectator=!!\(context&&context\.spectator\),kind=spectator\?'spectator':outcome==='win'\?'celebration'/.test(SHELL) &&
    /triggerHonruGameReaction\('rematch', \{ source:'outcome-restart' \}\)/.test(UTILS));

  const serverQuick = (SERVER.match(/const MATCH_EXPRESSION_QUICK_IDS\s*=\s*new Set\(\[([^\]]+)\]/) || [])[1] || '';
  check('six stable wire quick IDs remain unchanged; 16 visual cell IDs never enter the server protocol',
    Object.keys(EXPECTED_GROUPS).every(id => serverQuick.includes(`'${id}'`)) && EXPECTED_CELLS.every(id => !SERVER.includes(`'${id}'`)) &&
    !PROTOCOL.includes('quickVariant') && !PROTOCOL.includes('atlasCell'));
  const boundarySource = [SERVER,PROTOCOL].join('\n');
  check('P0-08 stays out of rules, rewards, replay, chat and persistence authority',
    !boundarySource.includes('P-HONRU-CONTEXT-REACTIONS-V1') && !boundarySource.includes('mg_art_honru_context_reactions_v1') &&
    !read('server/reward-engine.js').includes('honru-context-reactions') && !read('shared/rules/tetris.js').includes('honru-context-reactions') &&
    FAMILY.authorityBoundary.includes('Direct Chat') && FAMILY.authorityBoundary.includes('Match Chat'));

  if (failures.length) {
    console.error('HONRU_CONTEXT_REACTIONS_V1_FAILURES=' + failures.join(','));
    process.exitCode = 1;
  } else console.log('HONRU_CONTEXT_REACTIONS_V1_ALL_PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
