'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const FAMILY='P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const SOURCE='ART-042-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const FLAG='mg_art_community_replay_tournament_cards_v1';
const SOURCE_ROOT=path.join(ROOT,'art-source/platform/community-replay-tournament-cards-v1');
const SOURCE_DIR=path.join(SOURCE_ROOT,'runtime-source');
const RUNTIME_ROOT=path.join(ROOT,'public/assets/platform/community-replay-tournament-cards-v1');
const MANIFEST=path.join(ROOT,'public/assets/manifests/asset_manifest.json');
const CATALOG=path.join(ROOT,'asset-library/catalog.json');
function digest(p){const b=fs.readFileSync(p);return {sha256:crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),bytes:b.length};}
function pass(s){console.log('PASS '+s);}
const clearance=fs.readFileSync(path.join(SOURCE_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md'),'utf8');
assert(clearance.includes(FAMILY)&&clearance.includes('CLEARED_FOR_PRODUCTION')); pass('family identity and owner clearance');
const routing=fs.readFileSync(path.join(SOURCE_ROOT,'SKILL_ROUTING.md'),'utf8');
for(const name of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image'])assert(routing.includes('`'+name+'`'),'missing skill route '+name);
pass('nine installed skill routes are explicit');
const ext=JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT,'EXTERNAL_REFERENCE_TRANSMISSION.json'),'utf8')); assert.strictEqual(ext.policy.zeroExternalThirdPartyArt,true); assert.deepStrictEqual(ext.externalReferences,[]); pass('external reference lane is empty and source-only');
const family=JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT,'asset-family-manifest-v1.json'),'utf8')); assert.strictEqual(family.familyId,FAMILY);assert.strictEqual(family.sourceId,SOURCE);assert.strictEqual(family.sourceMastersCount,12);assert.strictEqual(family.runtimeVariantsCount,24);assert(family.totalRuntimeBytes<2*1024*1024); pass('source/runtime counts and budget');
const sourceFiles=fs.readdirSync(SOURCE_DIR).filter(f=>f.endsWith('.svg'));assert.strictEqual(sourceFiles.length,12);for(const f of sourceFiles){const text=fs.readFileSync(path.join(SOURCE_DIR,f),'utf8');assert(text.includes('<svg'));assert(!text.includes('<script'));const row=family.sourceMasters.find(x=>x.path.endsWith(f));assert(row);assert.strictEqual(row.sha256,digest(path.join(SOURCE_DIR,f)).sha256);} pass('12 SVG masters SHA and SVG safety');
const runtimeFiles=fs.readdirSync(RUNTIME_ROOT).filter(f=>f.endsWith('.webp'));assert.strictEqual(runtimeFiles.length,24);for(const f of runtimeFiles){const row=family.runtimeVariants.find(x=>x.path.endsWith(f));assert(row);assert.strictEqual(row.sha256,digest(path.join(RUNTIME_ROOT,f)).sha256);}pass('24 WebP normal/static variants SHA');
const manifest=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));const item=manifest.assets.find(x=>x.asset_id===FAMILY);assert(item);assert.strictEqual(item.source_asset_id,SOURCE);assert.strictEqual(item.runtime_id,'platform');assert.strictEqual(item.artwork_version,1);assert.strictEqual(item.status,'ready');assert.strictEqual(item.clearance,'OWNER_AUTHORIZED_ART_CLEARANCE');assert.strictEqual(item.feature_flags.ids[0],FLAG);assert.strictEqual(item.feature_flags.default_enabled,true);for(const role of ['card-playline','card-replay','card-tournament','card-result','card-record','frame-og','mark-playline','mark-replay','mark-tournament','mark-share','camera-desktop','camera-mobile']){for(const suffix of ['', '-static']){const key=role+suffix;assert(item.variants[key]);assert(item.variants[key].endsWith('/'+role+suffix+'.webp'));}}pass('global Manifest identity, flag and allowlist');
const catalog=JSON.parse(fs.readFileSync(CATALOG,'utf8'));const cat=catalog.assets.find(x=>x.id===FAMILY);assert(cat);assert.strictEqual(cat.remoteObjectKey,null);assert.strictEqual(cat.status,'integrated-local-only');pass('catalog is project-owned local-only');
const assets=fs.readFileSync(path.join(ROOT,'public/src/core/06-assets.js'),'utf8');assert(assets.includes('COMMUNITY_REPLAY_TOURNAMENT_CARDS_FLAG'));assert(assets.includes('resolveCommunityReplayTournamentCardUrl'));assert(assets.includes('communityReplayTournamentCardRoleForKind'));pass('resolver is strict and fail-closed');
const playline=fs.readFileSync(path.join(ROOT,'public/src/core/07-playline.js'),'utf8');assert(playline.includes('hydrateCommunityCardArt'));assert(playline.includes('communityReplayTournamentCardRoleForKind'));const ws=fs.readFileSync(path.join(ROOT,'public/src/online/03-websocket.js'),'utf8');assert(ws.includes("communityCardArtNode('card-replay'"));assert(ws.includes("communityCardArtNode('card-tournament'"));pass('Playline, Replay and Tournament consume art presentation-only');
assert(fs.existsSync(path.join(SOURCE_ROOT,'review/community-replay-tournament-cards-contact-sheet-v1.png')));assert(fs.existsSync(path.join(SOURCE_ROOT,'review/og-card-template.html')));pass('contact sheet and local OG HTML fallback exist');
console.log('COMMUNITY_REPLAY_TOURNAMENT_CARDS_V1_ALL_PASS');
