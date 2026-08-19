/*
 * Ghost Game P0-02 deterministic platform scene derivation.
 *
 * Inputs are project-owned code-native SVG geometry only. External
 * EXTERNAL_REFERENCE_ONLY / blocked-license art is never read by this script.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source', 'platform', 'scenes', 'signal-worlds-v1');
const RUNTIME_ROOT = path.join(ROOT, 'public', 'assets', 'backgrounds', 'platform-scenes-v1');
const ROUTES = ['home', 'games', 'room', 'playline'];
const THEMES = ['light', 'dark'];
const VIEWPORTS = Object.freeze({ desktop:[1920,1080], mobile:[900,1200] });

const C = Object.freeze({
  ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', teal:'#39B9B2', green:'#4BCB83',
  blue:'#508BF0', purple:'#8656CF', pink:'#E45CA4', coral:'#EF665F', gold:'#F1B640',
  sky:'#EAF4F6', sky2:'#DCEAF4', night:'#05070B', night2:'#11152A', line:'#282033'
});

function ensure(...dirs){ dirs.forEach(dir => fs.mkdirSync(dir,{recursive:true})); }
function write(file,data){ ensure(path.dirname(file)); fs.writeFileSync(file,data); }
function relative(file){ return path.relative(ROOT,file).replace(/\\/g,'/'); }
function digest(file){ const bytes=fs.readFileSync(file);return {sha256:crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(),bytes:bytes.length}; }
function esc(value){ return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function stroke(color=C.ink,width=8){ return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`; }
function svg(width,height,body,background='none'){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`+
    (background==='none'?'':`<rect width="${width}" height="${height}" fill="${background}"/>`)+body+'</svg>';
}
function arc(cx,cy,r,color,width=9,opacity=.55){ return `<path d="M${cx-r} ${cy}a${r} ${r} 0 0 1 ${r*2} 0" fill="none" ${stroke(color,width)} opacity="${opacity}"/>`; }
function dot(x,y,r,color,opacity=.85){ return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}"/>`; }
function cloud(x,y,s,fill,line){
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 70c0-34 27-60 61-60 22 0 41 10 52 26 10-7 22-11 35-11 31 0 56 23 59 53 31 0 55 22 55 51 0 29-25 52-56 52H58c-34 0-58-24-58-55 0-24 14-44 35-54A59 59 0 0 1 0 70Z" fill="${fill}" ${stroke(line||C.paper,7)}/></g>`;
}
function ghostSprout(x,y,s,color){
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 50c0-31 25-55 56-55s56 24 56 55v43c-11-10-21-10-32 0-10-10-20-10-30 0-10-10-20-10-30 0-7-8-14-10-20-6Z" fill="${color}" ${stroke(C.ink,7)}/><circle cx="39" cy="45" r="6" fill="${C.ink}"/><circle cx="72" cy="45" r="6" fill="${C.ink}"/><path d="M47 65c6 7 12 7 18 0" fill="none" ${stroke(C.ink,4)}/></g>`;
}
function card(x,y,w,h,color,rotation=0){
  return `<g transform="translate(${x} ${y}) rotate(${rotation})"><rect width="${w}" height="${h}" rx="${Math.round(w*.09)}" fill="${C.paper}" ${stroke(C.ink,7)}/><rect x="${Math.round(w*.1)}" y="${Math.round(h*.1)}" width="${Math.round(w*.8)}" height="${Math.round(h*.5)}" rx="${Math.round(w*.06)}" fill="${color}"/><path d="M${Math.round(w*.12)} ${Math.round(h*.76)}h${Math.round(w*.52)}" ${stroke(C.ink,7)}/><path d="M${Math.round(w*.12)} ${Math.round(h*.88)}h${Math.round(w*.34)}" ${stroke(C.ink,5)} opacity=".55"/></g>`;
}
function token(x,y,s,color,kind){
  let body='';
  if(kind==='plane') body=`<path d="M-42 12 31-32c9-5 17 4 12 13L3 54c-4 8-15 8-18 0l-8-28-18-8c-9-4-8-14-1-18Z" fill="${color}" ${stroke(C.ink,7)}/>`;
  else if(kind==='blocks') body=`<rect x="-42" y="-42" width="38" height="38" rx="8" fill="${color}" ${stroke(C.ink,6)}/><rect x="2" y="-42" width="38" height="38" rx="8" fill="${color}" ${stroke(C.ink,6)}/><rect x="2" y="2" width="38" height="38" rx="8" fill="${color}" ${stroke(C.ink,6)}/>`;
  else if(kind==='shield') body=`<path d="M0-46 42-26v30c0 27-17 43-42 56-25-13-42-29-42-56v-30Z" fill="${color}" ${stroke(C.ink,7)}/>`;
  else if(kind==='city') body=`<path d="M-46 42V-12h28v54M-10 42v-72h36v72m8 0V-2h22v44Z" fill="${color}" ${stroke(C.ink,7)}/>`;
  else if(kind==='horse') body=`<path d="M-34 38c7-24 13-42 29-61l-8-19c31 7 51 25 56 49L24 19l20 19Z" fill="${color}" ${stroke(C.ink,7)}/>`;
  else body=`<circle r="42" fill="${color}" ${stroke(C.ink,7)}/><circle cx="-13" cy="-13" r="9" fill="${C.paper}" opacity=".8"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
}
function themeColors(theme){
  return theme==='dark'
    ? {bg:C.night,ground:C.night2,line:'#2B2742',soft:'#17243A',star:C.paper,glass:'#182037'}
    : {bg:C.sky,ground:C.cream,line:'#B9DDD9',soft:'#D7EEF0',star:C.gold,glass:C.paper};
}
function farLayer(route,theme,viewport){
  const [w,h]=VIEWPORTS[viewport],t=themeColors(theme),mobile=viewport==='mobile';
  let body='';
  if(theme==='dark'){
    const seeds=[[.08,.11,4,C.paper],[.22,.24,3,C.teal],[.43,.12,4,C.gold],[.66,.2,3,C.blue],[.82,.1,4,C.pink],[.93,.34,3,C.purple],[.15,.55,3,C.blue],[.72,.54,4,C.teal]];
    body+=seeds.map(([x,y,r,c])=>dot(Math.round(w*x),Math.round(h*y),r,c,.78)).join('');
  }else{
    body+=cloud(Math.round(w*.03),Math.round(h*.07),mobile?.72:1.1,C.paper)+cloud(Math.round(w*.69),Math.round(h*.1),mobile?.58:.86,t.soft);
  }
  body+=`<path d="M0 ${Math.round(h*.77)}C${Math.round(w*.24)} ${Math.round(h*.68)} ${Math.round(w*.35)} ${Math.round(h*.84)} ${Math.round(w*.56)} ${Math.round(h*.76)}S${Math.round(w*.82)} ${Math.round(h*.68)} ${w} ${Math.round(h*.76)}V${h}H0Z" fill="${t.ground}" ${theme==='dark'?stroke(t.line,7):''}/>`;
  body+=`<path d="M0 ${Math.round(h*.83)}C${Math.round(w*.27)} ${Math.round(h*.74)} ${Math.round(w*.39)} ${Math.round(h*.9)} ${Math.round(w*.62)} ${Math.round(h*.8)}S${Math.round(w*.84)} ${Math.round(h*.76)} ${w} ${Math.round(h*.82)}" fill="none" ${stroke(route==='playline'?C.purple:C.teal,mobile?8:11)} opacity=".28"/>`;
  return svg(w,h,body,t.bg);
}
function homeMid(theme,viewport){
  const [w,h]=VIEWPORTS[viewport],m=viewport==='mobile',cy=Math.round(h*(m?.56:.58)),cx=Math.round(w*(m?.5:.64));
  const positions=m
    ? [[.2,.42,.62,C.teal,'circle'],[.78,.4,.57,C.pink,'plane'],[.2,.67,.54,C.gold,'blocks'],[.79,.66,.54,C.blue,'shield'],[.36,.28,.48,C.green,'city'],[.65,.27,.48,C.purple,'horse']]
    : [[.43,.46,.72,C.teal,'circle'],[.56,.39,.63,C.pink,'plane'],[.7,.49,.58,C.gold,'blocks'],[.78,.36,.56,C.blue,'shield'],[.52,.6,.55,C.green,'city'],[.68,.64,.52,C.purple,'horse']];
  let body=arc(cx,cy,m?210:270,C.teal,m?9:12,.5)+arc(cx,cy,m?145:190,C.blue,m?7:9,.36);
  body+=positions.map(([x,y,s,c,k])=>token(Math.round(w*x),Math.round(h*y),s,c,k)).join('');
  return svg(w,h,body);
}
function gamesMid(theme,viewport){
  const [w,h]=VIEWPORTS[viewport],m=viewport==='mobile';
  let body='';
  const colors=[C.teal,C.blue,C.gold,C.pink,C.green,C.purple];
  for(let i=0;i<6;i++){
    const col=m?i%2:i%3,row=m?Math.floor(i/2):Math.floor(i/3),cw=m?270:250,ch=m?230:205;
    const x=Math.round((m?100:620)+col*(m?430:300)),y=Math.round((m?300:300)+row*(m?270:260));
    body+=card(x,y,cw,ch,colors[i],i%2?2:-2);
    body+=token(x+Math.round(cw*.5),y+Math.round(ch*.35),m?.42:.38,colors[(i+2)%colors.length],['circle','plane','city','shield','blocks','horse'][i]);
  }
  return svg(w,h,body);
}
function roomMid(theme,viewport){
  const [w,h]=VIEWPORTS[viewport],m=viewport==='mobile',cx=Math.round(w/2),cy=Math.round(h*(m?.55:.54));
  let body=`<path d="M${cx-Math.round(w*(m?.31:.18))} ${cy+Math.round(h*.15)}V${cy-Math.round(h*.14)}c0-${Math.round(h*.12)} ${Math.round(w*.08)}-${Math.round(h*.2)} ${Math.round(w*(m?.31:.18))}-${Math.round(h*.2)}s${Math.round(w*(m?.31:.18))} ${Math.round(h*.08)} ${Math.round(w*(m?.31:.18))} ${Math.round(h*.2)}v${Math.round(h*.29)}" fill="${theme==='dark'?'#17243A':C.paper}" ${stroke(C.ink,m?8:10)}/>`;
  body+=`<rect x="${cx-Math.round(w*(m?.22:.13))}" y="${cy-Math.round(h*.05)}" width="${Math.round(w*(m?.44:.26))}" height="${Math.round(h*.18)}" rx="${m?48:64}" fill="${theme==='dark'?'#202A43':C.cream}" ${stroke(C.ink,m?8:10)}/>`;
  const seats=m?[[-.3,-.12],[.3,-.12],[-.34,.14],[.34,.14],[0,.25]]:[[-.23,-.13],[.23,-.13],[-.29,.11],[.29,.11],[0,.25]];
  seats.forEach(([dx,dy],i)=>{const x=cx+Math.round(w*dx),y=cy+Math.round(h*dy);body+=`<g transform="translate(${x} ${y})"><rect x="-55" y="-43" width="110" height="86" rx="24" fill="${C.paper}" ${stroke(C.ink,7)}/><circle r="19" fill="${[C.teal,C.blue,C.gold,C.pink,C.green][i]}" ${stroke(C.ink,5)}/>${dot(40,-32,10,i===0?C.green:C.blue,1)}</g>`;});
  body+=arc(cx,cy-Math.round(h*.16),m?190:260,C.teal,m?8:11,.48)+arc(cx,cy-Math.round(h*.16),m?130:185,C.purple,m?7:9,.32);
  return svg(w,h,body);
}
function playlineMid(theme,viewport){
  const [w,h]=VIEWPORTS[viewport],m=viewport==='mobile';
  let body='';
  const tracks=m?[
    `M-40 ${Math.round(h*.35)}C${Math.round(w*.25)} ${Math.round(h*.2)} ${Math.round(w*.48)} ${Math.round(h*.5)} ${Math.round(w+40)} ${Math.round(h*.34)}`,
    `M-40 ${Math.round(h*.62)}C${Math.round(w*.25)} ${Math.round(h*.78)} ${Math.round(w*.58)} ${Math.round(h*.4)} ${Math.round(w+40)} ${Math.round(h*.63)}`
  ]:[
    `M-60 ${Math.round(h*.38)}C${Math.round(w*.25)} ${Math.round(h*.18)} ${Math.round(w*.55)} ${Math.round(h*.58)} ${Math.round(w+60)} ${Math.round(h*.3)}`,
    `M-60 ${Math.round(h*.66)}C${Math.round(w*.26)} ${Math.round(h*.82)} ${Math.round(w*.6)} ${Math.round(h*.4)} ${Math.round(w+60)} ${Math.round(h*.68)}`
  ];
  body+=`<path d="${tracks[0]}" fill="none" ${stroke(C.teal,m?10:14)} opacity=".48"/><path d="${tracks[1]}" fill="none" ${stroke(C.purple,m?9:12)} opacity=".42" stroke-dasharray="22 20"/>`;
  const nodes=m?[[.16,.32,C.teal],[.68,.38,C.blue],[.31,.62,C.pink],[.78,.68,C.gold]]:[[.18,.31,C.teal],[.43,.45,C.blue],[.69,.31,C.pink],[.83,.59,C.gold],[.31,.68,C.green]];
  nodes.forEach(([x,y,c],i)=>{const px=Math.round(w*x),py=Math.round(h*y);body+=`<circle cx="${px}" cy="${py}" r="${m?38:44}" fill="${C.paper}" ${stroke(C.ink,7)}/><circle cx="${px}" cy="${py}" r="${m?20:24}" fill="${c}"/>`;if(i%2===0)body+=card(px+(m?45:58),py-(m?78:94),m?150:190,m?115:140,c,i?3:-3);});
  return svg(w,h,body);
}
function midLayer(route,theme,viewport){
  if(route==='games')return gamesMid(theme,viewport);
  if(route==='room')return roomMid(theme,viewport);
  if(route==='playline')return playlineMid(theme,viewport);
  return homeMid(theme,viewport);
}
function foregroundLayer(route,theme,viewport){
  const [w,h]=VIEWPORTS[viewport],m=viewport==='mobile',base=Math.round(h*(m?.82:.8));
  let body='';
  if(route==='home'){
    body+=ghostSprout(Math.round(w*.08),base,m?.72:.9,C.paper)+ghostSprout(Math.round(w*(m?.74:.86)),base+Math.round(h*.02),m?.62:.82,C.cream);
    body+=dot(Math.round(w*.24),base+30,m?9:12,C.green)+dot(Math.round(w*.71),base-10,m?8:11,C.pink);
  }else if(route==='games'){
    body+=`<path d="M0 ${base+40}c${Math.round(w*.25)}-70 ${Math.round(w*.45)} 65 ${Math.round(w*.68)}-5S${Math.round(w*.9)} ${base-10} ${w} ${base+20}v${h-base}H0Z" fill="${theme==='dark'?'#151A30':'#F5E8C8'}" opacity=".92"/>`;
    body+=token(Math.round(w*.12),base+20,m?.45:.58,C.gold,'blocks')+token(Math.round(w*.86),base,m?.42:.55,C.teal,'circle');
  }else if(route==='room'){
    body+=`<path d="M0 ${base}h${w}v${h-base}H0Z" fill="${theme==='dark'?'#151A30':'#E9D9B4'}"/><path d="M0 ${base}h${w}" ${stroke(C.gold,m?8:11)} opacity=".55"/>`;
    body+=`<circle cx="${Math.round(w*.11)}" cy="${base+55}" r="${m?18:24}" fill="${C.green}" ${stroke(C.ink,6)}/><circle cx="${Math.round(w*.89)}" cy="${base+55}" r="${m?18:24}" fill="${C.blue}" ${stroke(C.ink,6)}/>`;
  }else{
    body+=`<path d="M0 ${base+20}c${Math.round(w*.22)}-90 ${Math.round(w*.47)} 80 ${Math.round(w*.7)}-12S${Math.round(w*.9)} ${base-25} ${w} ${base+15}v${h-base}H0Z" fill="${theme==='dark'?'#16172D':'#F3E5C4'}" opacity=".9"/>`;
    body+=card(Math.round(w*.06),base-35,m?145:200,m?105:145,C.purple,-4)+card(Math.round(w*(m?.7:.79)),base-60,m?155:210,m?112:150,C.teal,4);
  }
  return svg(w,h,body);
}

async function renderSvg(source,out,width,height,format='webp'){
  let pipeline=sharp(Buffer.from(source)).resize(width,height,{fit:'fill'});
  if(format==='png')pipeline=pipeline.png({compressionLevel:9,effort:10});
  else pipeline=pipeline.webp({quality:88,alphaQuality:95,effort:6});
  await pipeline.toFile(out);
}
async function compositeLayers(files,out,width,height){
  const far=await sharp(files.far).resize(width,height,{fit:'fill'}).png().toBuffer();
  const mid=await sharp(files.mid).resize(width,height,{fit:'fill'}).png().toBuffer();
  const fore=await sharp(files.foreground).resize(width,height,{fit:'fill'}).png().toBuffer();
  await sharp(far).composite([{input:mid},{input:fore}]).webp({quality:88,effort:6}).toFile(out);
}
async function contactSheet(items,out){
  const cellW=480,cellH=310,canvas=sharp({create:{width:cellW*2,height:cellH*2,channels:4,background:C.paper}}),parts=[];
  for(let i=0;i<items.length;i++){
    const x=(i%2)*cellW,y=Math.floor(i/2)*cellH;
    const thumb=await sharp(items[i].file).resize(cellW-24,cellH-54,{fit:'cover'}).png().toBuffer();
    parts.push({input:thumb,left:x+12,top:y+10});
    const label=svg(cellW,38,`<rect width="${cellW}" height="38" rx="12" fill="${C.cream}"/><text x="${cellW/2}" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="${C.ink}">${esc(items[i].label)}</text>`);
    parts.push({input:Buffer.from(label),left:x,top:y+cellH-40});
  }
  await canvas.composite(parts).png({compressionLevel:9,effort:10}).toFile(out);
}

async function runtimeRecord(key,file,width,height,kind){
  const metadata=await sharp(file).metadata(),stats=await sharp(file).stats(),hash=digest(file);
  return {key,path:relative(file),sha256:hash.sha256,bytes:hash.bytes,format:'webp',width,height,alpha:!!metadata.hasAlpha&&!stats.isOpaque,role:kind};
}

async function writeFamilyManifest(reviewRoot){
  const sources=[],runtimeVariants=[],reviewBoards=[];
  for(const route of ROUTES){
    for(const theme of THEMES){
      for(const [viewport,[width,height]] of Object.entries(VIEWPORTS)){
        const key=`${route}-${theme}-${viewport}`,sourceDir=path.join(SOURCE_ROOT,'source-layers',route,theme,viewport),runtimeDir=path.join(RUNTIME_ROOT,route,theme,viewport);
        for(const layer of ['far','mid','foreground']){
          const file=path.join(sourceDir,`${key}-${layer}-v1.svg`),hash=digest(file);
          sources.push({key:`${key}-${layer}`,path:relative(file),sha256:hash.sha256,bytes:hash.bytes,format:'svg',width,height,alpha:layer!=='far',role:layer});
          runtimeVariants.push(await runtimeRecord(`${key}-${layer}`,path.join(runtimeDir,`${key}-${layer}-v1.webp`),width,height,layer));
        }
        runtimeVariants.push(await runtimeRecord(`${key}-static`,path.join(runtimeDir,`${key}-static-v1.webp`),width,height,'static'));
      }
      const previewDir=path.join(RUNTIME_ROOT,route,theme,'preview');
      runtimeVariants.push(await runtimeRecord(`${route}-${theme}-poster`,path.join(previewDir,`${route}-${theme}-poster-v1.webp`),640,360,'poster'));
      runtimeVariants.push(await runtimeRecord(`${route}-${theme}-mini`,path.join(previewDir,`${route}-${theme}-mini-v1.webp`),640,360,'mini'));
    }
  }
  for(const theme of THEMES){
    for(const viewport of Object.keys(VIEWPORTS)){
      const file=path.join(reviewRoot,`platform-scenes-${theme}-${viewport}-contact-sheet-v1.png`),hash=digest(file),metadata=await sharp(file).metadata();
      reviewBoards.push({key:`${theme}-${viewport}`,path:relative(file),sha256:hash.sha256,bytes:hash.bytes,format:'png',width:metadata.width,height:metadata.height,runtime:false});
    }
  }
  const generator=digest(__filename);
  const northStarFiles=[
    path.join(ROOT,'art-source','ui','sticker-v1','component-demo.png'),
    path.join(ROOT,'art-source','ui','sticker-v1','generated','core-ui-style-board-draft-v1.png'),
  ];
  const manifest={
    schemaVersion:1,productionUnitId:'P0-02',familyId:'P-PLATFORM-SCENES-V1',sourceAssetId:'ART-PLATFORM-SCENES-V1',artworkVersion:1,
    title:'Ghost Signal Worlds — Home / Games / Room / Playline',status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-vector',
    externalReferencePolicy:'EXTERNAL_REFERENCE_ONLY / blocked-license files were not read, copied, traced, recolored, used as generation inputs, or connected to runtime.',
    generation:{mode:'deterministic project-native SVG to WebP derivation',generator:relative(__filename),generatorSha256:generator.sha256,command:'node scripts/generate-platform-scenes-v1.js'},
    northStar:northStarFiles.map(file=>({path:relative(file),sha256:digest(file).sha256})),
    routes:ROUTES,themes:THEMES,viewports:Object.fromEntries(Object.entries(VIEWPORTS).map(([id,[width,height]])=>[id,{width,height}])),layers:['far','mid','foreground'],
    featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:['mg_art_platform_scenes_v1','mg_art_platform_scene_home_v1','mg_art_platform_scene_games_v1','mg_art_platform_scene_room_v1','mg_art_platform_scene_playline_v1']},
    fallback:{chain:'P-PLATFORM-SCENES-V1 layered runtime -> same-family static/poster -> existing CSS cloud/star environment -> P-001 Ghost Mark',failureModes:['flag disabled','Manifest missing or invalid','path outside exact allowlist','load/decode failure','late async result','forced-colors','save-data','prefers-reduced-motion']},
    a11y:'All scenes are decorative aria-hidden layers. Route, room, game, social and player facts remain readable HTML; no text is baked into runtime art.',
    sourceMasters:sources,runtimeVariants,reviewBoards,
    metrics:{sourceMasterCount:sources.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:reviewBoards.length,runtimeVariantBytes:runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),runtimeByteBudget:4*1024*1024,withinBudget:runtimeVariants.reduce((sum,item)=>sum+item.bytes,0)<=4*1024*1024},
  };
  write(path.join(SOURCE_ROOT,'asset-family-manifest-v1.json'),JSON.stringify(manifest,null,2)+'\n');
}

async function main(){
  const sourceLayers=path.join(SOURCE_ROOT,'source-layers'),reviewRoot=path.join(SOURCE_ROOT,'review');
  ensure(sourceLayers,reviewRoot,RUNTIME_ROOT);
  const review={};
  for(const route of ROUTES){
    for(const theme of THEMES){
      for(const [viewport,[width,height]] of Object.entries(VIEWPORTS)){
        const key=`${route}-${theme}-${viewport}`,dir=path.join(sourceLayers,route,theme,viewport),runtimeDir=path.join(RUNTIME_ROOT,route,theme,viewport);
        ensure(dir,runtimeDir);
        const layers={far:farLayer(route,theme,viewport),mid:midLayer(route,theme,viewport),foreground:foregroundLayer(route,theme,viewport)};
        const sourceFiles={};
        for(const [layer,source] of Object.entries(layers)){
          const sourceFile=path.join(dir,`${key}-${layer}-v1.svg`),runtimeFile=path.join(runtimeDir,`${key}-${layer}-v1.webp`);
          write(sourceFile,source+'\n');sourceFiles[layer]=sourceFile;await renderSvg(source,runtimeFile,width,height);
        }
        const staticFile=path.join(runtimeDir,`${key}-static-v1.webp`);
        await compositeLayers(sourceFiles,staticFile,width,height);
        review[`${theme}-${viewport}`] ||= [];
        review[`${theme}-${viewport}`].push({label:route,file:staticFile});
        if(viewport==='desktop'){
          const previewDir=path.join(RUNTIME_ROOT,route,theme,'preview');ensure(previewDir);
          await sharp(staticFile).resize(640,360,{fit:'cover'}).webp({quality:82,effort:6}).toFile(path.join(previewDir,`${route}-${theme}-poster-v1.webp`));
          await sharp(staticFile).resize(640,360,{fit:'cover'}).webp({quality:72,effort:6}).toFile(path.join(previewDir,`${route}-${theme}-mini-v1.webp`));
        }
      }
    }
  }
  for(const [key,items] of Object.entries(review))await contactSheet(items,path.join(reviewRoot,`platform-scenes-${key}-contact-sheet-v1.png`));
  await writeFamilyManifest(reviewRoot);
  console.log('P0-02 deterministic platform scenes generated',{routes:ROUTES.length,themes:THEMES.length,viewports:Object.keys(VIEWPORTS).length,runtimeVariants:80,reviewBoards:Object.keys(review).length});
}

main().catch(error=>{console.error(error);process.exitCode=1;});
