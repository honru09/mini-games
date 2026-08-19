'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const family=JSON.parse(fs.readFileSync(path.join(ROOT,'art-source/platform/game-stage/shared-v1/asset-family-manifest-v1.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'public/assets/manifests/asset_manifest.json'),'utf8'));
const source=fs.readFileSync(path.join(ROOT,'public/src/core/06-assets.js'),'utf8');
const shell=fs.readFileSync(path.join(ROOT,'public/src/core/02-app-shell.js'),'utf8');
const roster=fs.readFileSync(path.join(ROOT,'public/src/ui/07-roster.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'public/index-template.html'),'utf8');
let failures=0;function check(label,ok,detail=''){if(ok)console.log('PASS',label,detail);else{failures++;console.error('FAIL',label,detail);}}
function fileFor(p){return path.join(ROOT,...String(p).replace(/\\/g,'/').split('/'));}
function digest(file){const b=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),bytes:b.length};}
function webp(file){try{const b=fs.readFileSync(file);if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')throw Error('header');const end=8+b.readUInt32LE(4);let at=12,canvas=null,frame=null,alpha=false;while(at+8<=end){const k=b.toString('ascii',at,at+4),n=b.readUInt32LE(at+4),d=at+8;if(d+n>end)throw Error('truncated');if(k==='VP8X'){canvas={w:b[d+4]|b[d+5]<<8|b[d+6]<<16,h:b[d+7]|b[d+8]<<8|b[d+9]<<16,alpha:!!(b[d]&16)};}if(k==='VP8 '&&n>=10){if(b[d+3]!==0x9d||b[d+4]!==1||b[d+5]!==0x2a)throw Error('frame');frame={w:b.readUInt16LE(d+6)&0x3fff,h:b.readUInt16LE(d+8)&0x3fff};}if(k==='ALPH')alpha=true;if(k==='VP8L'&&n>=5){const bits=b.readUInt32LE(d+1);frame={w:(bits&0x3fff)+1,h:((bits>>>14)&0x3fff)+1};alpha=alpha||!!(bits&0x10000000);}at=d+n+(n&1);}return{width:canvas?canvas.w+1:frame?frame.w:0,height:canvas?canvas.h+1:frame?frame.h:0,alpha:!!(alpha||(canvas&&canvas.alpha))};}catch(e){return{error:e.message};}}
check('P0-03 family and counts',family.productionUnitId==='P0-03'&&family.familyId==='P-GAME-STAGE-SHARED-ART-V1'&&family.sourceMasters.length===11&&family.runtimeVariants.length===22&&family.reviewBoards.length===1);
check('external reference isolation',/EXTERNAL_REFERENCE_ONLY/.test(family.externalReferencePolicy)&&! /\.psd|\.ai|\.rpg/i.test(JSON.stringify(family)));
check('runtime budget',family.metrics.runtimeVariantBytes===165048&&family.metrics.withinBudget===true);
const production=manifest.assets.find(item=>item&&item.asset_id==='P-GAME-STAGE-SHARED-ART-V1');
check('Manifest owner clearance',!!production&&production.status==='ready'&&production.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE'&&production.source_asset_id==='ART-GAME-STAGE-SHARED-ART-V1'&&production.feature_flags&&production.feature_flags.ids[0]==='mg_art_game_stage_shared_v1');
const roles=new Map(family.runtimeVariants.map(item=>[item.key,item]));
for(const item of family.runtimeVariants){const file=fileFor(item.path);check(item.key+' exists',fs.existsSync(file)&&item.path.startsWith('public/assets/ui/game-stage/shared-v1/'));if(!fs.existsSync(file))continue;const d=digest(file),info=webp(file);check(item.key+' SHA/bytes',d.sha256===item.sha256&&d.bytes===item.bytes);const expectedAlpha=!item.key.startsWith('surface');check(item.key+' WebP/alpha',!info.error&&info.width===item.width&&info.height===item.height&&info.alpha===expectedAlpha,info.error||`${info.width}x${info.height} alpha=${info.alpha}`);}
check('all event atom and static variants present',family.events.every(event=>roles.has(event)&&roles.has(event+'-static'))&&roles.has('surface')&&roles.has('surface-static')&&roles.has('frame')&&roles.has('frame-static'));
check('Manifest variants mirror family keys',production&&JSON.stringify(Object.keys(production.variants).sort())===JSON.stringify([...roles.keys()].sort()));
check('resolver is allowlist/flag/clearance gated',source.includes('GAME_STAGE_ART_ROLE_SET')&&source.includes('GAME_STAGE_ART_CLEARANCE_RECORD')&&source.includes('resolveGameStageArtUrl')&&source.includes('GAME_STAGE_ART_FLAG'));
check('surface/frame decode-before-activate and late result isolation',shell.includes('refreshGameStageArt')&&shell.includes('gameStageArtRenderSeq')&&shell.includes('stageArtCssUrl')&&shell.includes('isConnected'));
check('nine semantic events reach a disposable overlay',shell.includes('emitGameStageVisualEvent')&&shell.includes('game-stage-vfx')&&shell.includes('clearGameStageVisuals')&&shell.includes("'stage_enter'"));
check('status mapping remains presentation-only',roster.includes("kind==='terminal'?'terminal'")&&roster.includes("kind==='connection'?'reconnect'")&&roster.includes('emitGameStageVisualEvent'));
check('stage CSS keeps art fallback and reduced motion',html.includes('--stage-surface-art:none')&&html.includes('--stage-frame-art:none')&&html.includes('.game-stage-vfx')&&html.includes('.game-stage-vfx{animation:none!important'));
if(failures){console.error('GAME_STAGE_ART_CONTRACT_FAILURES='+failures);process.exitCode=1;}else console.log('GAME_STAGE_ART_CONTRACT_ALL_PASS');
