'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const sharp=require('sharp');
const ROOT=path.resolve(__dirname,'..');
const FAMILY='P-IDENTITY-BADGE-SYSTEM-V1';
const SOURCE='ART-IDENTITY-BADGE-SYSTEM-V1';
const FLAG='mg_art_identity_badge_system_v1';
const FAMILY_ROOT=path.join(ROOT,'art-source/platform/identity/badge-system-v1');
const manifest=JSON.parse(fs.readFileSync(path.join(FAMILY_ROOT,'asset-family-manifest-v1.json'),'utf8'));
const runtimeManifest=JSON.parse(fs.readFileSync(path.join(ROOT,'public/assets/manifests/asset_manifest.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'asset-library/catalog.json'),'utf8'));
const assets=fs.readFileSync(path.join(ROOT,'public/src/core/06-assets.js'),'utf8');
const social=fs.readFileSync(path.join(ROOT,'public/src/core/04-social.js'),'utf8');
const shell=fs.readFileSync(path.join(ROOT,'public/src/core/02-app-shell.js'),'utf8');
const profile=fs.readFileSync(path.join(ROOT,'public/src/shop/05-profile.js'),'utf8');
const shop=fs.readFileSync(path.join(ROOT,'public/src/shop/06-shop.js'),'utf8');
const roster=fs.readFileSync(path.join(ROOT,'public/src/ui/07-roster.js'),'utf8');
const online=fs.readFileSync(path.join(ROOT,'public/src/online/03-websocket.js'),'utf8');
const { readPresentationSource } = require('./presentation-source');
const template=readPresentationSource();
const expectedGroups={rank:['1','2','3','standard'],achievement:['first-win','win-10','win-50','streak-3','streak-5','level-5','all-games','social'],mastery:['1','10','50','100','1000'],rarity:['starter','uncommon','rare','epic'],title:['1','2','3','4','5'],tournament:['participant','contender','finalist','champion'],task:['play-1','play-3','win-1','streak-2']};
const roles=Object.entries(expectedGroups).flatMap(([group,ids])=>ids.map(id=>group+'-'+id));
let failures=0;
async function check(name,fn){try{await fn();console.log('PASS',name);}catch(error){failures++;console.error('FAIL',name,'\n ',error.message);}}
(async()=>{
await check('family manifest freezes all 34 semantic badges and 102 runtime variants',async()=>{assert.strictEqual(manifest.familyId,FAMILY);assert.strictEqual(manifest.sourceAssetId,SOURCE);assert.strictEqual(manifest.status,'OWNER_AUTHORIZED_ART_CLEARANCE');assert.deepStrictEqual(manifest.groups,expectedGroups);assert.strictEqual(manifest.metrics.semanticBadgeCount,34);assert.strictEqual(manifest.sourceMasters.length,34);assert.strictEqual(manifest.runtimeVariants.length,102);assert(manifest.metrics.runtimeBytes<=manifest.metrics.runtimeByteBudget);assert.strictEqual(manifest.externalReferencePolicy,'No EXTERNAL_REFERENCE_ONLY / blocked-license file, preview, pixel or layer was used or transmitted.');});
await check('all source masters are local text-free deterministic SVG',async()=>{for(const role of roles){const item=manifest.sourceMasters.find(entry=>entry.role===role);assert(item,'missing source '+role);const file=path.join(ROOT,item.path),svg=fs.readFileSync(file,'utf8');assert(!/<text\b|<image\b|(?:href|src)=["']https?:\/\/|data:image/i.test(svg),'external/text contamination '+role);assert(/^<svg/.test(svg));assert.strictEqual(item.width,256);assert.strictEqual(item.height,256);}});
await check('all 32 48 64 runtime variants decode with alpha',async()=>{for(const role of roles)for(const size of [32,48,64]){const item=manifest.runtimeVariants.find(entry=>entry.role===role&&entry.size===size);assert(item,'missing '+role+' '+size);const meta=await sharp(path.join(ROOT,item.path)).metadata();assert.strictEqual(meta.format,'webp');assert.strictEqual(meta.width,size);assert.strictEqual(meta.height,size);assert.strictEqual(meta.hasAlpha,true);}});
await check('owner-cleared runtime manifest is exact default-on and reversible',async()=>{const item=runtimeManifest.assets.find(entry=>entry.asset_id===FAMILY);assert(item);assert.strictEqual(item.source_asset_id,SOURCE);assert.strictEqual(item.clearance,'OWNER_AUTHORIZED_ART_CLEARANCE');assert.strictEqual(item.artwork_version,1);assert.strictEqual(item.feature_flags.default_enabled,true);assert.deepStrictEqual(item.feature_flags.ids,[FLAG]);assert(/Emoji\/Unicode/.test(item.fallback));assert.strictEqual(Object.keys(item.variants).length,102);assert(item.clearance_record.endsWith('OWNER_AUTHORIZED_ART_CLEARANCE.md'));});
await check('asset catalog records project-owned local-only provenance',async()=>{const item=catalog.assets.find(entry=>entry.id===FAMILY);assert(item);assert.strictEqual(item.sourceType,'project-owned');assert.strictEqual(item.status,'integrated-local-only');assert.strictEqual(item.model,null);assert(item.previewPath.endsWith('identity-badge-system-contact-sheet-v1.png'));});
await check('runtime resolver fail-closes and keeps decorative fallback',async()=>{for(const token of ['IDENTITY_BADGE_SYSTEM_FLAG','IDENTITY_BADGE_GROUPS','resolveIdentityBadgeUrl','identityBadgeNode','OWNER_AUTHORIZED_ART_CLEARANCE','aria-hidden','identity-badge-fallback'])assert(assets.includes(token),token);assert(assets.includes("pathValue!==expected"));assert(assets.includes("runtimeAssetManifestPromise=null;return ''"));assert(!/identity-badge-asset[^\n]+loading=settings\.loading==='eager'\?'eager':'lazy'/.test(assets),'display:none badge must not self-block behind native lazy loading');});
await check('all seven identity consumers use the shared badge node',async()=>{assert(roster.includes("identityBadgeNode('rank'"));assert(social.includes("identityBadgeNode('achievement'"));assert(social.includes("identityBadgeNode('task'"));assert(shell.includes("identityBadgeNode('mastery'"));assert(shell.includes("identityBadgeNode('rarity'"));assert(shell.includes("identityBadgeNode('title'"));assert(profile.includes("identityBadgeNode('mastery'"));assert(shop.includes("identityBadgeNode('rarity'"));assert(online.includes("identityBadgeNode('tournament'"));});
await check('CSS is static, responsive and forced-colors safe',async()=>{assert(template.includes('.identity-badge{'));assert(template.includes('@media(forced-colors:active)'));assert(!/\.identity-badge[^}]*animation:/s.test(template));assert(!/\.identity-badge[^}]*will-change:/s.test(template));assert(template.includes('.collection-rarity-chip{display:grid'));assert(/@media\(max-width:640px\)[^}]*[\s\S]*?\.profile-route-character-art\{position:absolute/.test(template),'mobile identity copy must not be crushed by the character art');});
await check('skill and external transmission records are complete',async()=>{const routing=fs.readFileSync(path.join(FAMILY_ROOT,'SKILL_ROUTING.md'),'utf8'),transmission=JSON.parse(fs.readFileSync(path.join(FAMILY_ROOT,'EXTERNAL_REFERENCE_TRANSMISSION.json'),'utf8'));for(const skill of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image'])assert(routing.includes('`'+skill+'`'),skill);assert.strictEqual(transmission.inputs.length,0);assert.strictEqual(transmission.blockedLicensePixelsTransmitted,false);assert.strictEqual(transmission.thirdPartyProviderCalls,0);});
if(failures){console.error(`\n${failures} identity badge checks failed`);process.exit(1);}console.log('\nIdentity badge system checks passed');
})().catch(error=>{console.error(error);process.exit(1);});
