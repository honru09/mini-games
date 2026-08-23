'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/identity/badge-system-v1');
const SOURCE_DIR = path.join(SOURCE_ROOT, 'runtime-source');
const REVIEW_DIR = path.join(SOURCE_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/identity/badge-system-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const FAMILY = 'P-IDENTITY-BADGE-SYSTEM-V1';
const SOURCE = 'ART-IDENTITY-BADGE-SYSTEM-V1';
const FLAG = 'mg_art_identity_badge_system_v1';
const SIZES = Object.freeze([32, 48, 64]);
const GROUPS = Object.freeze({
  rank:Object.freeze(['1','2','3','standard']),
  achievement:Object.freeze(['first-win','win-10','win-50','streak-3','streak-5','level-5','all-games','social']),
  mastery:Object.freeze(['1','10','50','100','1000']),
  rarity:Object.freeze(['starter','uncommon','rare','epic']),
  title:Object.freeze(['1','2','3','4','5']),
  tournament:Object.freeze(['participant','contender','finalist','champion']),
  task:Object.freeze(['play-1','play-3','win-1','streak-2']),
});
const ROLES = Object.freeze(Object.entries(GROUPS).flatMap(([group, ids]) => ids.map(id => group + '-' + id)));
const C = Object.freeze({ ink:'#0A1020', navy:'#172746', cream:'#FFF4D8', paper:'#FFFDF8', cyan:'#5CE1E6', teal:'#18A6A8', violet:'#9B7BFF', purple:'#5B4CCE', coral:'#FF7A77', gold:'#F7C969', bronze:'#D88A4D', silver:'#C8D0DD', mint:'#A6F3D3', white:'#FFFFFF' });

function ensure(dir){ fs.mkdirSync(dir,{recursive:true}); }
function write(file,value){ ensure(path.dirname(file)); fs.writeFileSync(file,value); }
function rel(file){ return path.relative(ROOT,file).split(path.sep).join('/'); }
function digest(file){ const data=fs.readFileSync(file); return {sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length}; }
function svg(body){ return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">${body}</svg>`; }
function defs(a,b){ return `<defs><linearGradient id="fill" x1="40" y1="24" x2="218" y2="232" gradientUnits="userSpaceOnUse"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="7"/></filter></defs>`; }
function palette(group,id){
  if(group==='rank') return id==='1'?[C.gold,C.coral]:id==='2'?[C.silver,C.cyan]:id==='3'?[C.bronze,C.coral]:[C.cyan,C.violet];
  if(group==='mastery') return ({'1':[C.mint,C.teal],'10':[C.cyan,C.teal],'50':[C.violet,C.purple],'100':[C.gold,C.coral],'1000':[C.coral,C.purple]})[id];
  if(group==='rarity') return ({starter:[C.silver,C.navy],uncommon:[C.mint,C.teal],rare:[C.cyan,C.purple],epic:[C.violet,C.coral]})[id];
  if(group==='title') return ({'1':[C.mint,C.teal],'2':[C.cyan,C.navy],'3':[C.gold,C.coral],'4':[C.violet,C.purple],'5':[C.gold,C.purple]})[id];
  if(group==='tournament') return ({participant:[C.cyan,C.teal],contender:[C.violet,C.purple],finalist:[C.coral,C.gold],champion:[C.gold,C.coral]})[id];
  if(group==='task') return id.startsWith('play')?[C.cyan,C.teal]:id.startsWith('win')?[C.gold,C.coral]:[C.coral,C.purple];
  return id.includes('streak')?[C.coral,C.gold]:id==='social'?[C.mint,C.cyan]:id==='all-games'?[C.violet,C.cyan]:[C.gold,C.violet];
}
function frame(group){
  if(group==='rank') return `<ellipse cx="128" cy="218" rx="70" ry="13" fill="${C.ink}" fill-opacity=".16" filter="url(#shadow)"/><circle cx="128" cy="120" r="91" fill="url(#fill)" stroke="${C.ink}" stroke-width="12"/><circle cx="128" cy="120" r="72" fill="${C.cream}" fill-opacity=".9" stroke="${C.white}" stroke-width="5"/>`;
  if(group==='achievement') return `<ellipse cx="128" cy="222" rx="66" ry="12" fill="${C.ink}" fill-opacity=".15" filter="url(#shadow)"/><path d="M128 22 215 62v72c0 55-37 87-87 106-50-19-87-51-87-106V62l87-40Z" fill="url(#fill)" stroke="${C.ink}" stroke-width="12" stroke-linejoin="round"/><path d="M128 44 194 74v58c0 39-24 65-66 83-42-18-66-44-66-83V74l66-30Z" fill="${C.cream}" fill-opacity=".92" stroke="${C.white}" stroke-width="5"/>`;
  if(group==='mastery') return `<ellipse cx="128" cy="222" rx="70" ry="12" fill="${C.ink}" fill-opacity=".15" filter="url(#shadow)"/><path d="m128 18 82 47v94l-82 47-82-47V65l82-47Z" fill="url(#fill)" stroke="${C.ink}" stroke-width="12" stroke-linejoin="round"/><path d="m128 43 60 34v70l-60 35-60-35V77l60-34Z" fill="${C.cream}" fill-opacity=".92" stroke="${C.white}" stroke-width="5"/>`;
  if(group==='rarity') return `<ellipse cx="128" cy="219" rx="63" ry="11" fill="${C.ink}" fill-opacity=".14" filter="url(#shadow)"/><path d="M128 20 158 45l39-3 8 38 29 26-22 32 3 40-37 13-20 34-30-25-30 25-20-34-37-13 3-40-22-32 29-26 8-38 39 3 30-25Z" fill="url(#fill)" stroke="${C.ink}" stroke-width="10" stroke-linejoin="round"/><circle cx="128" cy="121" r="66" fill="${C.cream}" fill-opacity=".93" stroke="${C.white}" stroke-width="5"/>`;
  if(group==='title') return `<ellipse cx="128" cy="222" rx="67" ry="11" fill="${C.ink}" fill-opacity=".14" filter="url(#shadow)"/><path d="M39 77h178l-21 45 21 45h-55l-34 54-34-54H39l21-45-21-45Z" fill="url(#fill)" stroke="${C.ink}" stroke-width="11" stroke-linejoin="round"/><circle cx="128" cy="111" r="69" fill="${C.cream}" fill-opacity=".94" stroke="${C.white}" stroke-width="5"/>`;
  if(group==='tournament') return `<ellipse cx="128" cy="222" rx="68" ry="12" fill="${C.ink}" fill-opacity=".14" filter="url(#shadow)"/><path d="M53 38h150v67c0 57-26 96-75 126-49-30-75-69-75-126V38Z" fill="url(#fill)" stroke="${C.ink}" stroke-width="12" stroke-linejoin="round"/><path d="M76 61h104v44c0 41-17 70-52 94-35-24-52-53-52-94V61Z" fill="${C.cream}" fill-opacity=".93" stroke="${C.white}" stroke-width="5"/>`;
  return `<ellipse cx="128" cy="218" rx="64" ry="11" fill="${C.ink}" fill-opacity=".14" filter="url(#shadow)"/><rect x="34" y="40" width="188" height="166" rx="52" fill="url(#fill)" stroke="${C.ink}" stroke-width="12"/><rect x="57" y="63" width="142" height="120" rx="39" fill="${C.cream}" fill-opacity=".93" stroke="${C.white}" stroke-width="5"/>`;
}
function star(cx=128,cy=120,r=50){ const pts=[]; for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.43;pts.push(`${cx+Math.cos(a)*rr},${cy+Math.sin(a)*rr}`);} return `<polygon points="${pts.join(' ')}" fill="${C.ink}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>`; }
function controller(extra=''){ return `<path d="M77 107c-18 5-31 24-32 48-1 27 12 40 31 26l26-20h52l26 20c19 14 32 1 31-26-1-24-14-43-32-48H77Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/><path d="M74 138h28M88 124v28" stroke="${C.cream}" stroke-width="9" stroke-linecap="round"/><circle cx="164" cy="134" r="7" fill="${C.cream}"/><circle cx="181" cy="151" r="7" fill="${C.cream}"/>${extra}`; }
function flame(double=false){ return `<path d="M128 58c33 30 47 57 37 91-9 31-52 47-79 21-25-24-11-59 14-77-2 25 16 29 26 13 12-20 4-34 2-48Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/><path d="M127 116c15 14 19 26 14 39-5 13-25 17-35 5-9-12-2-27 9-35-1 11 8 13 12 6 4-7 1-12 0-15Z" fill="${double?C.coral:C.cream}"/>${double?'<path d="M156 77c15 13 21 27 16 42-4 13-18 21-31 16 10-12 13-24 11-36-1-8 1-15 4-22Z" fill="'+C.ink+'"/>':''}`; }
function trophy(){ return `<path d="M91 70h74v43c0 25-14 42-37 42s-37-17-37-42V70Z" fill="${C.ink}"/><path d="M91 82H66v19c0 23 14 36 36 36M165 82h25v19c0 23-14 36-36 36" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/><path d="M128 151v27M99 184h58" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/><path d="m128 87 8 16 18 3-13 13 3 18-16-8-16 8 3-18-13-13 18-3 8-16Z" fill="${C.cream}"/>`; }
function crown(){ return `<path d="m73 99 25 19 30-47 30 47 25-19-10 71H83L73 99Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/><path d="M91 151h74" stroke="${C.cream}" stroke-width="9" stroke-linecap="round"/><circle cx="98" cy="132" r="6" fill="${C.cream}"/><circle cx="128" cy="124" r="7" fill="${C.cream}"/><circle cx="158" cy="132" r="6" fill="${C.cream}"/>`; }
function glyph(group,id){
  if(group==='rank') return id==='1'?crown():id==='2'?`<path d="m128 61 55 59-55 59-55-59 55-59Z" fill="${C.ink}"/>${star(128,120,25).replace(`fill="${C.ink}"`,`fill="${C.cream}"`)}`:id==='3'?`<path d="m128 62 52 30v60l-52 30-52-30V92l52-30Z" fill="${C.ink}"/>${star(128,120,24).replace(`fill="${C.ink}"`,`fill="${C.cream}"`)}`:`<circle cx="128" cy="120" r="42" fill="${C.ink}"/><circle cx="128" cy="120" r="18" fill="${C.cream}"/>`;
  if(group==='achievement'){
    if(id==='first-win') return `<path d="M85 157c-22-22-30-48-22-73M171 157c22-22 30-48 22-73" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/><path d="m128 72 14 28 31 5-23 22 6 31-28-15-28 15 6-31-23-22 31-5 14-28Z" fill="${C.ink}"/>`;
    if(id==='win-10') return `<path d="m128 62 46 45-46 45-46-45 46-45Z" fill="${C.ink}"/><path d="m128 112 31 30-31 31-31-31 31-30Z" fill="${C.violet}" stroke="${C.cream}" stroke-width="5"/>`;
    if(id==='win-50') return trophy();
    if(id==='streak-3') return flame(false);
    if(id==='streak-5') return flame(true);
    if(id==='level-5') return `<path d="m128 60 57 58-57 58-57-58 57-58Z" fill="${C.ink}"/><path d="m98 124 30-32 30 32M98 151l30-32 30 32" stroke="${C.cream}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(id==='all-games') return `<circle cx="128" cy="120" r="28" fill="${C.ink}"/>${[0,60,120,180,240,300].map(a=>{const x=128+Math.cos(a*Math.PI/180)*62,y=120+Math.sin(a*Math.PI/180)*62;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="${C.ink}"/>`;}).join('')}<circle cx="128" cy="120" r="10" fill="${C.cream}"/>`;
    return `<path d="M75 151c6-24 22-36 43-36s37 12 43 36" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><circle cx="101" cy="91" r="24" fill="${C.ink}"/><circle cx="155" cy="91" r="24" fill="${C.ink}"/><path d="m128 139-15-13c-20-18 8-35 15-17 7-18 35-1 15 17l-15 13Z" fill="${C.coral}" stroke="${C.ink}" stroke-width="5"/>`;
  }
  if(group==='mastery') return id==='1'?`<path d="M128 168V93" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><path d="M128 112c-42 0-54-28-51-52 36 0 54 18 51 52ZM128 128c42 0 54-28 51-52-36 0-54 18-51 52Z" fill="${C.ink}"/>`:id==='10'?`<path d="M128 55 181 80v44c0 34-20 55-53 70-33-15-53-36-53-70V80l53-25Z" fill="${C.ink}"/><path d="m128 85 11 22 25 4-18 18 4 25-22-12-22 12 4-25-18-18 25-4 11-22Z" fill="${C.cream}"/>`:id==='50'?star(128,120,59):id==='100'?`<circle cx="128" cy="120" r="43" fill="${C.ink}"/>${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x1=128+Math.cos(a)*56,y1=120+Math.sin(a)*56,x2=128+Math.cos(a)*74,y2=120+Math.sin(a)*74;return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/>`;}).join('')}<circle cx="128" cy="120" r="19" fill="${C.cream}"/>`:`<path d="M128 62c-38 0-55 29-52 66v47l22-14 20 14 20-14 20 14 22-14v-33c3-37-14-66-52-66Z" fill="${C.ink}"/><ellipse cx="108" cy="116" rx="10" ry="14" fill="${C.cream}"/><ellipse cx="148" cy="116" rx="10" ry="14" fill="${C.cream}"/>${crown().replace(/<path d="m73 99[\s\S]*/,`<path d="m97 76 12 9 19-29 19 29 12-9-5 39h-52l-5-39Z" fill="${C.gold}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>`)}`;
  if(group==='rarity') return id==='starter'?`<circle cx="128" cy="121" r="43" fill="${C.ink}"/><circle cx="128" cy="121" r="16" fill="${C.cream}"/>`:id==='uncommon'?`<path d="m128 65 51 56-51 56-51-56 51-56Z" fill="${C.ink}"/><path d="m128 92 27 29-27 30-27-30 27-29Z" fill="${C.cream}"/>`:id==='rare'?star(128,121,58):crown();
  if(group==='title') return id==='1'?`<path d="M128 165V98" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><path d="M128 116c-38-1-51-26-48-48 33-1 50 16 48 48ZM128 130c38-1 51-26 48-48-33-1-50 16-48 48Z" fill="${C.ink}"/>`:id==='2'?`<path d="m87 73 82 96M169 73l-82 96" stroke="${C.ink}" stroke-width="15" stroke-linecap="round"/><path d="m76 62 24 9-15 18-9-27Zm104 0-24 9 15 18 9-27Z" fill="${C.ink}"/>`:id==='3'?`<path d="M84 83h88l14 76-58 30-58-30 14-76Z" fill="${C.ink}"/><circle cx="108" cy="116" r="9" fill="${C.cream}"/><circle cx="148" cy="116" r="9" fill="${C.cream}"/><circle cx="128" cy="151" r="9" fill="${C.cream}"/>`:id==='4'?`<path d="M88 68h80v111H88z" fill="${C.ink}"/><circle cx="128" cy="122" r="29" fill="${C.cream}"/><path d="M103 98h50M103 146h50" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>`:crown();
  if(group==='tournament') return id==='champion'?trophy():id==='finalist'?`<path d="M80 77h96v51c0 30-20 50-48 50s-48-20-48-50V77Z" fill="${C.ink}"/><path d="m128 93 10 20 22 3-16 16 4 22-20-10-20 10 4-22-16-16 22-3 10-20Z" fill="${C.cream}"/>`:id==='contender'?`<path d="M80 165 176 75M80 75l96 90" stroke="${C.ink}" stroke-width="15" stroke-linecap="round"/><path d="M74 62h39L93 86 74 62Zm108 0h-39l20 24 19-24Z" fill="${C.ink}"/>`:`<path d="M78 70v102M178 70v102" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><path d="M84 76h73l-19 25 19 25H84V76Z" fill="${C.ink}"/><circle cx="128" cy="101" r="10" fill="${C.cream}"/>`;
  if(group==='task') return id==='play-1'?controller():id==='play-3'?controller(`<circle cx="105" cy="90" r="8" fill="${C.ink}"/><circle cx="128" cy="82" r="8" fill="${C.ink}"/><circle cx="151" cy="90" r="8" fill="${C.ink}"/>`):id==='win-1'?`<path d="M86 68v108" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><path d="M93 75h79l-20 29 20 29H93V75Z" fill="${C.ink}"/>${star(128,104,20).replace(`fill="${C.ink}"`,`fill="${C.cream}"`)}`:flame(true);
  return star();
}
function build(role){ const split=role.indexOf('-'),group=role.slice(0,split),id=role.slice(split+1),[a,b]=palette(group,id); return svg(`${defs(a,b)}${frame(group)}${glyph(group,id)}`); }

async function generateAll(){
  const release=acquireArtGeneratorLock(FAMILY);
  try{
    ensure(SOURCE_DIR);ensure(REVIEW_DIR);ensure(RUNTIME_ROOT);
    for(const role of ROLES)write(path.join(SOURCE_DIR,role+'.svg'),build(role));
    const sourceMasters=[];for(const role of ROLES){const file=path.join(SOURCE_DIR,role+'.svg'),h=digest(file);sourceMasters.push({role,path:rel(file),sha256:h.sha256,bytes:h.bytes,width:256,height:256,alpha:true,bakedText:false});}
    const runtimeVariants=[],variants={},variantBytes={};
    for(const role of ROLES)for(const size of SIZES){const source=fs.readFileSync(path.join(SOURCE_DIR,role+'.svg')),file=path.join(RUNTIME_ROOT,`${role}-${size}.webp`);await sharp(source).resize(size,size,{fit:'contain'}).webp({quality:92,alphaQuality:100,effort:6}).toFile(file);const h=digest(file),key=`${role}-${size}`;variants[key]=rel(file);variantBytes[key]=h.bytes;runtimeVariants.push({role,size,path:rel(file),sha256:h.sha256,bytes:h.bytes,width:size,height:size,alpha:true,bakedText:false});}
    const tile=116,gap=12,cols=8,rows=Math.ceil(ROLES.length/cols),parts=[];
    for(let i=0;i<ROLES.length;i++){const image=await sharp(path.join(RUNTIME_ROOT,`${ROLES[i]}-64.webp`)).resize(82,82,{fit:'contain'}).png().toBuffer();parts.push({input:image,left:(i%cols)*(tile+gap)+17,top:Math.floor(i/cols)*(tile+gap)+17});}
    const review=path.join(REVIEW_DIR,'identity-badge-system-contact-sheet-v1.png');await sharp({create:{width:cols*(tile+gap),height:rows*(tile+gap),channels:4,background:{r:242,g:239,b:231,alpha:1}}}).composite(parts).png().toFile(review);
    const total=runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),reviewHash=digest(review);
    const family={schemaVersion:1,productionUnitId:'P1-09',familyId:FAMILY,sourceAssetId:SOURCE,artworkVersion:1,status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-svg-sharp',flag:FLAG,generatedAt:new Date().toISOString(),presentationStrategy:'static Ghost-native enamel badges for DOM identity surfaces; no GLB, Three, baked copy, reward value or protocol fact',groups:GROUPS,sizes:SIZES,sourceMasters,runtimeVariants,reviewBoards:[{path:rel(review),sha256:reviewHash.sha256,bytes:reviewHash.bytes,width:cols*(tile+gap),height:rows*(tile+gap)}],featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},metrics:{semanticBadgeCount:ROLES.length,sourceMasterCount:sourceMasters.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:1,runtimeBytes:total,runtimeByteBudget:2*1024*1024,withinBudget:total<=2*1024*1024},fallback:{chain:'identity badge -> existing Emoji/Unicode/game marker/localized text'},motionBoundary:'All assets are static. Existing finite surface motion may move the containing card only; no badge animation, pointer tracking or permanent will-change.',a11y:'Badges are decorative and aria-hidden. Rank, title, achievement, mastery, rarity, task and tournament state remain localized live DOM text.',authorityBoundary:'Presentation only. Existing server-authoritative wins, rewards, achievements, tasks, rankings, tournament state, collection ownership, prices, persistence and protocols are unchanged.',externalReferencePolicy:'No EXTERNAL_REFERENCE_ONLY / blocked-license file, preview, pixel or layer was used or transmitted.'};
    write(path.join(SOURCE_ROOT,'asset-family-manifest-v1.json'),JSON.stringify(family,null,2)+'\n');
    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));manifest.assets=(manifest.assets||[]).filter(item=>item&&item.asset_id!==FAMILY);manifest.assets.push({asset_id:FAMILY,runtime_id:'platform',artwork_version:1,runtime_path:variants['achievement-first-win-48'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE,feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'identity-badge-emoji-text-fallback',fallback:'existing Emoji/Unicode/game marker and localized text',load:'lazy per visible identity surface; all variants are static',a11y:family.a11y,license:'project-owned-deterministic-svg-sharp',source:rel(SOURCE_DIR),clearance_record:rel(path.join(SOURCE_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),variant_integrity:Object.fromEntries(Object.entries(variants).map(([key,value])=>[key,'sha256:'+digest(path.join(ROOT,value)).sha256.toLowerCase()])),variant_bytes:variantBytes,actual_bytes:total,byte_budget:2*1024*1024,review_boards:[rel(review)],groups:GROUPS,sizes:SIZES});write(MANIFEST_PATH,JSON.stringify(manifest,null,2));
    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));catalog.assets=(catalog.assets||[]).filter(item=>item&&item.id!==FAMILY&&item.familyId!==FAMILY);catalog.assets.push({id:FAMILY,category:'platform/identity/badges',assetType:'cross-surface-identity-badge-system',sourceType:'project-owned',sourcePath:sourceMasters[0].path,sourceSha256:sourceMasters[0].sha256.toLowerCase(),license:'project-owned-deterministic-vector',author:'OpenAI Codex for Ghost Game',status:'integrated-local-only',dimensions:{width:256,height:256},previewPath:rel(review),previewSha256:reviewHash.sha256.toLowerCase(),runtimePaths:runtimeVariants.map(item=>item.path),promptPath:'art-source/platform/identity/badge-system-v1/PROMPT_AND_PROVENANCE.md',model:null,remoteObjectKey:null});const index=(catalog.indexes||[]).find(item=>item.id==='production-asset-manifest');if(index)index.sha256=digest(MANIFEST_PATH).sha256.toLowerCase();write(CATALOG_PATH,JSON.stringify(catalog,null,2));
    console.log(`[${FAMILY}] generated ${sourceMasters.length} SVG masters, ${runtimeVariants.length} WebP variants, ${total} bytes`);
  }finally{release();}
}

if(require.main===module)generateAll().catch(error=>{console.error(error);process.exit(1);});
module.exports={generateAll,FAMILY,SOURCE,FLAG,GROUPS,ROLES,SIZES};
