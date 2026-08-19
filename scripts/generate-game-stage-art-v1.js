/*
 * Ghost Game P0-03 deterministic shared Game Stage art derivation.
 * Project-owned SVG geometry only; external Q/PSD/AI/RPG files are never read.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source', 'platform', 'game-stage', 'shared-v1');
const RUNTIME_ROOT = path.join(ROOT, 'public', 'assets', 'ui', 'game-stage', 'shared-v1');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const EVENTS = ['stage_enter','ready','turn_start','accepted_move','capture','warning','reconnect','terminal','reward'];
const C = Object.freeze({ ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', teal:'#39B9B2', blue:'#508BF0', purple:'#8656CF', green:'#4BCB83', gold:'#F1B640', coral:'#EF665F' });
function ensure(...dirs){ dirs.forEach(dir => fs.mkdirSync(dir,{recursive:true})); }
function rel(file){ return path.relative(ROOT,file).replace(/\\/g,'/'); }
function write(file,data){ ensure(path.dirname(file)); fs.writeFileSync(file,data); }
function digest(file){ const data=fs.readFileSync(file);return {sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length}; }
function stroke(color=C.ink,width=8){ return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`; }
function svg(width,height,body,background='none'){ return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background==='none'?'':`<rect width="${width}" height="${height}" fill="${background}"/>`}${body}</svg>`; }
function surface(){
  let body=`<path d="M0 122C220 82 360 152 560 110S942 72 1280 128V720H0Z" fill="#F2D9A8" opacity=".72"/><path d="M0 192C260 134 470 220 690 174S1018 126 1280 184" fill="none" ${stroke('#D6A66D',14)} opacity=".35"/>`;
  for(let i=0;i<12;i++)body+=`<path d="M${i*112-70} 680c90-34 146-24 230 0" fill="none" ${stroke(i%2?C.cream:C.gold,5)} opacity=".16"/>`;
  body+=`<circle cx="1080" cy="128" r="86" fill="${C.paper}" opacity=".38"/><circle cx="1080" cy="128" r="54" fill="none" ${stroke(C.teal,8)} opacity=".34"/>`;
  return svg(1280,720,body,C.cream);
}
function frame(){
  const body=`<rect x="16" y="16" width="1248" height="688" rx="38" fill="none" ${stroke(C.ink,14)} opacity=".76"/><path d="M52 132V52h80M1148 52h80v80M52 588v80h80M1148 668h80v-80" fill="none" ${stroke(C.gold,16)} opacity=".76"/><circle cx="68" cy="68" r="12" fill="${C.teal}" ${stroke(C.ink,5)}/><circle cx="1212" cy="68" r="12" fill="${C.purple}" ${stroke(C.ink,5)}/><circle cx="68" cy="652" r="12" fill="${C.coral}" ${stroke(C.ink,5)}/><circle cx="1212" cy="652" r="12" fill="${C.green}" ${stroke(C.ink,5)}/>`;
  return svg(1280,720,body);
}
function eventIcon(kind){
  const palette={stage_enter:C.teal,ready:C.green,turn_start:C.blue,accepted_move:C.gold,capture:C.coral,warning:C.gold,reconnect:C.purple,terminal:C.green,reward:C.gold};
  const color=palette[kind]||C.teal;
  let body=`<circle cx="128" cy="128" r="92" fill="${C.paper}" opacity=".96" ${stroke(C.ink,8)}/><circle cx="128" cy="128" r="74" fill="${color}" opacity=".88"/>`;
  if(kind==='stage_enter')body+=`<path d="M80 160V96h96v64M64 160h128" fill="none" ${stroke(C.ink,11)}/><path d="m128 56 0 38m0 48v22" fill="none" ${stroke(C.paper,9)}/>`;
  else if(kind==='ready')body+=`<circle cx="128" cy="128" r="40" fill="none" ${stroke(C.paper,10)}/><path d="m100 130 20 20 40-48" fill="none" ${stroke(C.ink,12)}/>`;
  else if(kind==='turn_start')body+=`<path d="M72 128a56 56 0 1 0 112 0" fill="none" ${stroke(C.paper,12)}/><path d="m128 62 28 28-28 28" fill="none" ${stroke(C.ink,12)}/><circle cx="128" cy="128" r="12" fill="${C.ink}"/>`;
  else if(kind==='accepted_move')body+=`<circle cx="128" cy="128" r="42" fill="${C.paper}" ${stroke(C.ink,8)}/><path d="M128 54v32m0 84v32M54 128h32m84 0h32" fill="none" ${stroke(C.ink,8)}/>`;
  else if(kind==='capture')body+=`<path d="m74 74 108 108m0-108L74 182" fill="none" ${stroke(C.paper,14)}/><circle cx="128" cy="128" r="26" fill="none" ${stroke(C.ink,8)}/>`;
  else if(kind==='warning')body+=`<path d="m128 62 64 116H64Z" fill="${C.paper}" ${stroke(C.ink,8)}/><path d="M128 100v36m0 20v2" fill="none" ${stroke(C.ink,12)}/>`;
  else if(kind==='reconnect')body+=`<path d="M72 120a58 58 0 0 1 102-28l-24 6m8 30a58 58 0 0 1-102 28l24-6" fill="none" ${stroke(C.paper,11)}/><circle cx="84" cy="128" r="11" fill="${C.ink}"/><circle cx="172" cy="128" r="11" fill="${C.ink}"/>`;
  else if(kind==='terminal')body+=`<path d="M82 132c16 42 76 42 92 0" fill="none" ${stroke(C.paper,12)}/><circle cx="96" cy="108" r="9" fill="${C.ink}"/><circle cx="160" cy="108" r="9" fill="${C.ink}"/><path d="M65 72 82 52m133 20-17-20" fill="none" ${stroke(C.ink,8)}/>`;
  else body+=`<circle cx="128" cy="128" r="43" fill="${C.paper}" ${stroke(C.ink,8)}/><path d="M128 96v64m-32-32h64" fill="none" ${stroke(C.ink,10)}/><path d="M128 54v20m0 108v20" fill="none" ${stroke(C.ink,8)}/>`;
  return svg(256,256,body);
}
function webp(source,file,width,height,alpha=true){ return sharp(Buffer.from(source)).resize(width,height,{fit:'fill'}).webp({quality:90,alphaQuality:100,effort:6}).toFile(file); }
async function writeRuntimeManifest(runtimeVariants,sourceHash,review){
  const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
  manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!=='P-GAME-STAGE-SHARED-ART-V1');
  const variants=Object.fromEntries(runtimeVariants.map(item=>[item.key,item.path]));
  const hashes=Object.fromEntries(runtimeVariants.map(item=>[item.key,'sha256:'+item.sha256.toLowerCase()]));
  const bytes=Object.fromEntries(runtimeVariants.map(item=>[item.key,item.bytes]));
  manifest.assets.push({asset_id:'P-GAME-STAGE-SHARED-ART-V1',runtime_id:'platform',artwork_version:1,runtime_path:variants.surface,variants,logical_size:'shared Game Stage surface/frame/event VFX',pixel_size:'1280x720 surface/frame; 256x256 event VFX',status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:'ART-GAME-STAGE-SHARED-ART-V1',feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:['mg_art_game_stage_shared_v1']},fallback_asset_id:'P-001-GHOST-MARK',fallback:'existing CSS Game Stage shell and semantic status fallback',load:'lazy on Game Stage; event VFX decode before activation; dispose clears overlay',a11y:'decorative stage surface and semantic event VFX; all state remains readable HTML',license:'project-owned-deterministic-vector',source:'art-source/platform/game-stage/shared-v1/source',clearance_record:'art-source/platform/game-stage/shared-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',integrity:hashes.surface,variant_integrity:hashes,variant_bytes:bytes,actual_bytes:runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),byte_budget:2*1024*1024,review_board:review.path,source_sha256:sourceHash});
  fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n');
}
async function main(){
  const sourceDir=path.join(SOURCE_ROOT,'source'),reviewDir=path.join(SOURCE_ROOT,'review');ensure(sourceDir,reviewDir,RUNTIME_ROOT);
  const sourceRecords=[],runtimeVariants=[];
  const surfaceSource=surface(),frameSource=frame();
  const atoms=[['surface',surfaceSource,1280,720],['frame',frameSource,1280,720],...EVENTS.map(kind=>[kind,eventIcon(kind),256,256])];
  for(const [key,source,width,height] of atoms){
    const sourceFile=path.join(sourceDir,`${key}-v1.svg`),runtimeFile=path.join(RUNTIME_ROOT,`${key}-v1.webp`),staticFile=path.join(RUNTIME_ROOT,`${key}-static-v1.webp`);
    write(sourceFile,source+'\n');await webp(source,runtimeFile,width,height,key==='surface');await webp(source,staticFile,width,height,key==='surface');
    const sourceHash=digest(sourceFile),runtimeHash=digest(runtimeFile),staticHash=digest(staticFile);
    sourceRecords.push({key,path:rel(sourceFile),sha256:sourceHash.sha256,bytes:sourceHash.bytes,width,height,format:'svg',alpha:key!=='surface'});
    runtimeVariants.push({key,path:rel(runtimeFile),sha256:runtimeHash.sha256,bytes:runtimeHash.bytes,width,height,format:'webp',alpha:key!=='surface'});
    runtimeVariants.push({key:key+'-static',path:rel(staticFile),sha256:staticHash.sha256,bytes:staticHash.bytes,width,height,format:'webp',alpha:key!=='surface'});
  }
  const boardFile=path.join(reviewDir,'game-stage-shared-contact-sheet-v1.png');
  const board=sharp({create:{width:960,height:720,channels:4,background:C.paper}});const thumbs=[];
  for(let i=0;i<atoms.length;i++){const [key,source]=atoms[i],thumb=await sharp(Buffer.from(source)).resize(250,250,{fit:'contain',background:C.paper}).png().toBuffer();thumbs.push({input:thumb,left:(i%4)*240+115,top:Math.floor(i/4)*240+4});}
  await board.composite(thumbs).png({compressionLevel:9,effort:10}).toFile(boardFile);
  const boardHash=digest(boardFile),runtimeBytes=runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),sourceHash=sourceRecords[0].sha256;
  const family={schemaVersion:1,productionUnitId:'P0-03',familyId:'P-GAME-STAGE-SHARED-ART-V1',sourceAssetId:'ART-GAME-STAGE-SHARED-ART-V1',artworkVersion:1,status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-vector',externalReferencePolicy:'EXTERNAL_REFERENCE_ONLY / blocked-license files were not read, copied, traced, recolored, used as generation inputs, or connected to runtime.',featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:['mg_art_game_stage_shared_v1']},events:EVENTS,sourceMasters:sourceRecords,runtimeVariants,reviewBoards:[{path:rel(boardFile),sha256:boardHash.sha256,bytes:boardHash.bytes,width:960,height:720}],metrics:{sourceMasterCount:sourceRecords.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:1,runtimeVariantBytes:runtimeBytes,runtimeByteBudget:2*1024*1024,withinBudget:runtimeBytes<=2*1024*1024},fallback:{chain:'shared stage art -> static same-family art -> existing CSS/DOM stage -> P-001 Ghost Mark'},a11y:'Decorative texture and event VFX are aria-hidden; state, scores, players and controls stay in HTML.'};
  write(path.join(SOURCE_ROOT,'asset-family-manifest-v1.json'),JSON.stringify(family,null,2)+'\n');
  await writeRuntimeManifest(runtimeVariants,sourceHash,{path:rel(boardFile)});
  console.log('P0-03 shared Game Stage art generated',{sourceMasters:sourceRecords.length,runtimeVariants:runtimeVariants.length,runtimeBytes,reviewBoards:1});
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
