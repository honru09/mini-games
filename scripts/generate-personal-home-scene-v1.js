'use strict';

// P2-04: deterministic Ghost-native personal Home desk-island scene.
// The source is code-native SVG geometry; no external or blocked-license pixels
// are read, copied, traced, recolored, or sent to a provider.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const FAMILY = 'P-PERSONAL-HOME-SCENE-V1';
const FLAG = 'mg_art_personal_home_scene_v1';
const SOURCE_ID = 'ART-PERSONAL-HOME-SCENE-V1';
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/personal-home-scene-v1');
const SOURCE_LAYERS = path.join(SOURCE_ROOT, 'source-layers');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/personal-home-scene-v1');
const REVIEW_ROOT = path.join(SOURCE_ROOT, 'review');
const MANIFEST = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const LIBRARY = path.join(ROOT, 'asset-library/catalog.json');
const LEDGER = path.join(ROOT, 'art-source/production/ghost-game-art-program-v1/production-ledger-v1.json');
const THEMES = ['light', 'dark'];
const VIEWPORTS = { desktop: [1600, 700], mobile: [900, 900] };
const COLORS = { ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', teal:'#39B9B2', blue:'#508BF0', purple:'#8656CF', pink:'#E45CA4', coral:'#EF665F', gold:'#F1B640', green:'#4BCB83', night:'#080B16', night2:'#161D38' };
const rel = file => path.relative(ROOT, file).replace(/\\/g, '/');
const ensure = (...dirs) => dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
const write = (file, data) => { ensure(path.dirname(file)); fs.writeFileSync(file, data); };
const digest = file => { const b = fs.readFileSync(file); return { sha256: crypto.createHash('sha256').update(b).digest('hex').toUpperCase(), bytes: b.length }; };
const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;
const stroke = (color = COLORS.ink, width = 8) => `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
const circle = (x, y, r, fill, opacity = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;

function palette(theme){ return theme === 'dark' ? { bg: COLORS.night, panel: COLORS.night2, line:'#32365D', ink:COLORS.paper, accent:COLORS.teal } : { bg:'#EAF4F6', panel:COLORS.cream, line:'#A8D5D3', ink:COLORS.ink, accent:COLORS.teal }; }
function far(theme, viewport){
  const [w, h] = VIEWPORTS[viewport], p = palette(theme), mobile = viewport === 'mobile';
  let body = '';
  const stars = [[.08,.18,4,COLORS.paper],[.22,.29,3,COLORS.teal],[.42,.12,4,COLORS.gold],[.68,.2,3,COLORS.blue],[.88,.12,4,COLORS.pink],[.75,.42,3,COLORS.purple]];
  if(theme === 'dark') body += stars.map(([x,y,r,c]) => circle(Math.round(w*x), Math.round(h*y), r, c, .82)).join('');
  else body += `<path d="M0 ${h*.38}C${w*.18} ${h*.14} ${w*.32} ${h*.55} ${w*.52} ${h*.3}S${w*.85} ${h*.2} ${w} ${h*.4}V0H0Z" fill="#D5EEF0" opacity=".85"/>`;
  body += `<path d="M0 ${h*.68}C${w*.2} ${h*.56} ${w*.36} ${h*.76} ${w*.58} ${h*.64}S${w*.86} ${h*.57} ${w} ${h*.68}V${h}H0Z" fill="${p.panel}" ${theme === 'dark' ? stroke(p.line, 8) : ''}/>`;
  body += `<path d="M0 ${h*.75}C${w*.22} ${h*.62} ${w*.38} ${h*.82} ${w*.6} ${h*.72}S${w*.84} ${h*.68} ${w} ${h*.76}" fill="none" ${stroke(p.accent, mobile ? 8 : 12)} opacity=".26"/>`;
  return svg(w, h, body, p.bg);
}
function desk(x, y, w, h, p){
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(h*.18)}" fill="${p.panel}" ${stroke(p.line, 9)}/><path d="M${x+w*.08} ${y+h}v${h*.52}M${x+w*.92} ${y+h}v${h*.52}" ${stroke(p.line, 10)}/><path d="M${x+w*.05} ${y+h*.28}h${w*.9}" ${stroke(p.accent, 7)} opacity=".4"/></g>`;
}
function monitor(x, y, w, h, p){
  const sx = x + w*.12, sy = y + h*.13, sw = w*.76, sh = h*.57;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h*.78}" rx="${Math.round(w*.08)}" fill="${p.ink}" ${stroke(COLORS.ink, 9)}/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${Math.round(w*.045)}" fill="${p.bg}"/><path d="M${x+w*.5} ${y+h*.78}v${h*.2}M${x+w*.31} ${y+h*.98}h${w*.38}" ${stroke(p.line, 10)}/><path d="M${sx+sw*.12} ${sy+sh*.68}c${sw*.18}-${sh*.4} ${sw*.25} ${sh*.35} ${sw*.42} 0s${sw*.27}-${sh*.34} ${sw*.44-.1}-.02" fill="none" ${stroke(p.accent, 9)}/>${circle(sx+sw*.16, sy+sh*.22, 10, COLORS.gold)}${circle(sx+sw*.28, sy+sh*.22, 10, COLORS.pink)}</g>`;
}
function token(x, y, s, color, kind){
  const body = kind === 'plane' ? `<path d="M-34 12 27-25c9-5 16 3 11 12L4 45c-4 8-14 7-17 0l-7-24-16-7c-8-4-7-11 1-16Z" fill="${color}" ${stroke(COLORS.ink, 7)}/>` : kind === 'blocks' ? `<rect x="-34" y="-34" width="30" height="30" rx="7" fill="${color}" ${stroke(COLORS.ink, 6)}/><rect x="2" y="-34" width="30" height="30" rx="7" fill="${color}" ${stroke(COLORS.ink, 6)}/><rect x="2" y="2" width="30" height="30" rx="7" fill="${color}" ${stroke(COLORS.ink, 6)}/>` : `<path d="M0-38 34-21v25c0 23-14 36-34 47-20-11-34-24-34-47v-25Z" fill="${color}" ${stroke(COLORS.ink, 7)}/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
}
function mid(theme, viewport){
  const [w, h] = VIEWPORTS[viewport], p = palette(theme), mobile = viewport === 'mobile';
  const dw = mobile ? w*.78 : w*.58, dx = (w-dw)/2, dy = h*(mobile?.48:.47), dh = h*.22;
  let body = desk(dx, dy, dw, dh, p) + monitor(dx + dw*.23, dy - h*(mobile?.28:.32), dw*.54, h*(mobile?.34:.37), p);
  body += token(w*(mobile?.18:.19), h*(mobile?.52:.49), mobile?.55:.78, COLORS.teal, 'shield');
  body += token(w*(mobile?.82:.78), h*(mobile?.58:.48), mobile?.48:.66, COLORS.pink, 'plane');
  body += token(w*(mobile?.27:.35), h*(mobile?.3:.32), mobile?.4:.52, COLORS.gold, 'blocks');
  body += `<path d="M${w*.1} ${h*.7}C${w*.27} ${h*.61} ${w*.34} ${h*.78} ${w*.5} ${h*.7}S${w*.75} ${h*.64} ${w*.9} ${h*.72}" fill="none" ${stroke(p.accent, mobile?10:13)} opacity=".36" stroke-dasharray="18 20"/>`;
  return svg(w, h, body);
}
function foreground(theme, viewport){
  const [w, h] = VIEWPORTS[viewport], p = palette(theme), mobile = viewport === 'mobile', base = h*(mobile?.78:.78);
  const ghostX = w*(mobile?.52:.14), ghostY = base - h*(mobile?.2:.2), s = mobile?.86:.92;
  const ghost = `<g transform="translate(${ghostX} ${ghostY}) scale(${s})"><path d="M0 82c0-54 34-88 82-88s82 34 82 88v54c-16-15-31-15-47 0-15-15-30-15-45 0-15-15-30-15-45 0-12-14-25-16-37-6Z" fill="${p.ink}" ${stroke(COLORS.ink, 8)}/><circle cx="58" cy="77" r="9" fill="${COLORS.ink}"/><circle cx="107" cy="77" r="9" fill="${COLORS.ink}"/><path d="M68 108c10 12 20 12 30 0" fill="none" ${stroke(COLORS.ink, 6)}/><circle cx="35" cy="22" r="8" fill="${COLORS.gold}"/><circle cx="130" cy="26" r="7" fill="${COLORS.teal}"/></g>`;
  const plant = `<g transform="translate(${w*(mobile?.1:.85)} ${base})"><path d="M-45 0h90l-9 30h-72Z" fill="${p.panel}" ${stroke(p.line, 7)}/><path d="M0 0c-8-50-28-66-45-74M5 0c6-58 27-78 46-88M0 0c0-52 0-82 5-105" fill="none" ${stroke(COLORS.green, 9)}/><circle cx="-45" cy="-74" r="15" fill="${COLORS.green}"/><circle cx="46" cy="-88" r="16" fill="${COLORS.teal}"/><circle cx="5" cy="-105" r="15" fill="${COLORS.gold}"/></g>`;
  return svg(w, h, `<path d="M0 ${base+42}c${w*.2}-80 ${w*.42} 62 ${w*.66}-4S${w*.9} ${base-16} ${w} ${base+20}V${h}H0Z" fill="${p.panel}" opacity=".94"/>${ghost}${plant}`);
}
async function render(source, out, width, height){ await sharp(Buffer.from(source)).resize(width, height, { fit:'fill' }).webp({ quality:89, alphaQuality:96, effort:6 }).toFile(out); }
async function composite(files, out, width, height){ const inputs=[]; for(const file of files){ inputs.push(await sharp(file).resize(width,height,{fit:'fill'}).png().toBuffer()); } await sharp(inputs[0]).composite(inputs.slice(1).map(input=>({input}))).webp({quality:89,effort:6}).toFile(out); }
async function record(file, key, role, width, height){ const info=await sharp(file).metadata(), d=digest(file); return { id:key, path:rel(file), sha256:d.sha256, bytes:d.bytes, format:'webp', width, height, alpha:!!info.hasAlpha, role }; }
async function main(){
  ensure(SOURCE_LAYERS, RUNTIME_ROOT, REVIEW_ROOT);
  const sourceMasters=[], runtimeVariants=[];
  for(const theme of THEMES){ for(const viewport of Object.keys(VIEWPORTS)){
    const [w,h]=VIEWPORTS[viewport], key=`personal-home-${theme}-${viewport}`, sourceDir=path.join(SOURCE_LAYERS,theme,viewport), runtimeDir=path.join(RUNTIME_ROOT,theme,viewport); ensure(sourceDir); ensure(runtimeDir);
    const layers={background:far(theme,viewport),midground:mid(theme,viewport),foreground:foreground(theme,viewport)}, sourceFiles=[];
    for(const [role,source] of Object.entries(layers)){ const sourceFile=path.join(sourceDir,`${key}-${role}-v1.svg`), runtimeFile=path.join(runtimeDir,`${key}-${role}-v1.webp`); write(sourceFile,source+'\n'); await render(source,runtimeFile,w,h); const sd=digest(sourceFile); sourceMasters.push({id:`${key}-${role}`,path:rel(sourceFile),sha256:sd.sha256,bytes:sd.bytes,format:'svg',width:w,height:h,role}); runtimeVariants.push(await record(runtimeFile,`${key}-${role}`,role,w,h)); sourceFiles.push(runtimeFile); }
    const staticFile=path.join(runtimeDir,`${key}-static-v1.webp`); await composite(sourceFiles,staticFile,w,h); runtimeVariants.push(await record(staticFile,`${key}-static`,'static',w,h));
    if(viewport==='desktop'){
      const previewDir=path.join(RUNTIME_ROOT,theme,'preview'); ensure(previewDir); const poster=path.join(previewDir,`personal-home-${theme}-poster-v1.webp`),mini=path.join(previewDir,`personal-home-${theme}-mini-v1.webp`);
      await sharp(staticFile).resize(640,360,{fit:'cover'}).webp({quality:84,effort:6}).toFile(poster); await sharp(staticFile).resize(320,180,{fit:'cover'}).webp({quality:76,effort:6}).toFile(mini);
      runtimeVariants.push(await record(poster,`personal-home-${theme}-poster`,'poster',640,360)); runtimeVariants.push(await record(mini,`personal-home-${theme}-mini`,'mini',320,180));
    }
  }}
  const contact=path.join(REVIEW_ROOT,'personal-home-scene-contact-sheet-v1.png'); const cards=[]; for(const theme of THEMES){ for(const viewport of Object.keys(VIEWPORTS)){ const file=path.join(RUNTIME_ROOT,theme,viewport,`personal-home-${theme}-${viewport}-static-v1.webp`); cards.push(await sharp(file).resize(560,315,{fit:'cover'}).png().toBuffer()); }} await sharp({create:{width:1120,height:630,channels:4,background:{r:255,g:249,b:242,alpha:1}}}).composite(cards.map((input,i)=>({input,left:(i%2)*560,top:Math.floor(i/2)*315}))).png({compressionLevel:9,effort:10}).toFile(contact);
  const family={schemaVersion:1,productionUnitId:'P2-04',familyId:FAMILY,sourceAssetId:SOURCE_ID,artworkVersion:1,status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-vector',externalReferencePolicy:'EXTERNAL_REFERENCE_ONLY / blocked-license inputs were not read, copied, traced, recolored, or transmitted.',themes:THEMES,viewports:Object.fromEntries(Object.entries(VIEWPORTS).map(([id,[width,height]])=>[id,{width,height}])),layers:['background','midground','foreground'],featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},fallback:{chain:'layered scene → static composite → existing Home ambient CSS → no decorative scene'},sourceMasters,runtimeVariants,reviewBoards:[{path:rel(contact),sha256:digest(contact).sha256,bytes:fs.statSync(contact).size}],metrics:{sourceMasterCount:sourceMasters.length,runtimeVariantCount:runtimeVariants.length,runtimeBytes:runtimeVariants.reduce((sum,row)=>sum+row.bytes,0),runtimeByteBudget:2*1024*1024,withinBudget:runtimeVariants.reduce((sum,row)=>sum+row.bytes,0)<=2*1024*1024},authority:'presentation-only Home decoration; no account, owned, purchase, reward, protocol, realtime 3D, chat, replay, AI, analytics or Supabase capability'};
  write(path.join(SOURCE_ROOT,'asset-family-manifest-v1.json'),JSON.stringify(family,null,2)+'\n');
  const manifest=JSON.parse(fs.readFileSync(MANIFEST,'utf8')); const variants=Object.fromEntries(runtimeVariants.map(row=>[row.id,row.path])); const runtime=runtimeVariants.find(row=>row.id==='personal-home-light-desktop-background'); const item={asset_id:FAMILY,runtime_id:'platform',artwork_version:1,runtime_path:runtime.path,variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,clearance_record:'art-source/platform/personal-home-scene-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',license:'project-owned-deterministic-vector',fallback_asset_id:'P-PLATFORM-SCENES-V1',fallback:'static composite → existing Home ambient CSS',feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},actual_bytes:family.metrics.runtimeBytes,byte_budget:family.metrics.runtimeByteBudget,integrity:'sha256:'+runtime.sha256.toLowerCase(),provenance:{source_asset_id:SOURCE_ID,source_manifest:'art-source/platform/personal-home-scene-v1/asset-family-manifest-v1.json',prompt:'art-source/platform/personal-home-scene-v1/PROMPT_AND_PROVENANCE.md'}}; const index=manifest.assets.findIndex(row=>row&&row.asset_id===FAMILY); if(index>=0)manifest.assets[index]=item;else manifest.assets.push(item); write(path.join(ROOT,'public/assets/manifests/asset_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const library=JSON.parse(fs.readFileSync(LIBRARY,'utf8')); const cat={id:FAMILY,category:'platform/personal-home-scene',assetType:'home-personal-layered-scene',sourceType:'project-owned',sourcePath:family.sourceMasters[0].path,sourceSha256:family.sourceMasters[0].sha256.toLowerCase(),license:'project-owned',author:'Ghost Game project-native SVG',status:'integrated-local-only',dimensions:{width:1600,height:700},previewPath:rel(contact),previewSha256:digest(contact).sha256.toLowerCase(),runtimePaths:runtimeVariants.map(row=>row.path),promptPath:'art-source/platform/personal-home-scene-v1/PROMPT_AND_PROVENANCE.md',model:null,remoteObjectKey:null}; const ci=library.assets.findIndex(row=>row&&row.id===FAMILY);if(ci>=0)library.assets[ci]=cat;else library.assets.push(cat);const li=library.indexes.findIndex(row=>row&&row.id==='production-asset-manifest');if(li>=0)library.indexes[li].sha256=digest(MANIFEST).sha256.toLowerCase();library.updatedAt='2026-08-22T00:00:00+09:00';write(LIBRARY,JSON.stringify(library,null,2)+'\n');
  const ledger=JSON.parse(fs.readFileSync(LEDGER,'utf8'));const unit={order:25,id:'P2-04',familyId:FAMILY,name:'个人 Home 小场景或桌面岛',status:'implemented_owner_cleared_release_evidence_pending',completion:{sourceAndRuntimePercent:100,localImplementationPercent:100,machineEvidencePercent:100,localVisibleEvidencePercent:0,realEnvironmentPercent:0,releasePercent:0},deliverables:{runtimeAssetIds:1,runtimeVariants:runtimeVariants.length,sourceMasters:sourceMasters.length,reviewBoards:1,runtimeBytes:family.metrics.runtimeBytes},scope:['personal background/midground/foreground scene layers','light/dark desktop/mobile variants','static and reduced-motion-safe fallback','Home presentation-only decoration; no real-time 3D requirement'],outOfScope:['account or owned personalization','purchase/reward/task/ranking','date/liveops/remote config','Direct Chat/Match Chat/Rule/Authority/Reward/Replay/AI/Analytics/Supabase'],budget:{runtimeBytes:family.metrics.runtimeBytes,runtimeByteBudget:family.metrics.runtimeByteBudget},evidence:['art-source/platform/personal-home-scene-v1/CONTRACT.md','art-source/platform/personal-home-scene-v1/SKILL_ROUTING.md','art-source/platform/personal-home-scene-v1/PROMPT_AND_PROVENANCE.md','art-source/platform/personal-home-scene-v1/asset-family-manifest-v1.json','art-source/platform/personal-home-scene-v1/PROJECT_REFERENCE_TRANSMISSION.json','art-source/platform/personal-home-scene-v1/EXTERNAL_REFERENCE_TRANSMISSION.json','art-source/platform/personal-home-scene-v1/review/personal-home-scene-contact-sheet-v1.png','art-source/platform/personal-home-scene-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md','art-source/platform/personal-home-scene-v1/TECHNICAL_REVIEW_Reviewer_A.md','art-source/platform/personal-home-scene-v1/MACHINE_VISUAL_REVIEW.md','art-source/platform/personal-home-scene-v1/SIMILARITY_AND_IP_REVIEW.md','art-source/production/ghost-game-art-program-v1/P2-04_LOCAL_ACCEPTANCE.md','scripts/generate-personal-home-scene-v1.js','public/src/core/06-assets.js','public/src/core/02-app-shell.js','public/index-template.html','qa/personal-home-scene-v1.js'],requirements:['UI-011','ART-021']};ledger.units=Array.isArray(ledger.units)?ledger.units.filter(row=>row.id!=='P2-04'):ledger.units;ledger.units.push(unit);write(LEDGER,JSON.stringify(ledger,null,2)+'\n'); console.log(`PERSONAL_HOME_SCENE_GENERATED variants=${runtimeVariants.length} bytes=${family.metrics.runtimeBytes}`);
}
main().catch(error=>{ console.error(error); process.exit(1); });
