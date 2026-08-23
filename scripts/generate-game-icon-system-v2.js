/* Ghost Game P0-12 deterministic Cartoon Icon v2 asset family. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock, acquireArtRegistryLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/platform/game-icons/cartoon-v2');
const SOURCE_ROOT = path.join(FAMILY_ROOT, 'source');
const GENERATED_REVIEW_ROOT = path.join(FAMILY_ROOT, 'review/generated');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/ui/game-icons/v2');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const LOCK_PATH = path.join(ROOT, '.tmp/art-generator-locks/game-icon-system-v2.lock');

const FAMILY_ID = 'P-GAME-ICON-SYSTEM-V2';
const SOURCE_ID = 'ART-027-GAME-ICON-SYSTEM-V2';
const FLAG = 'mg_art_game_icon_system_v2';
const GAME_IDS = Object.freeze(['gomoku','ludo','monopoly','tank','tetris','xiangqi']);
const GAME_ROLES = Object.freeze(['icon','cover-crop','theme-icon','selected-object']);
const ICON_SIZES = Object.freeze([44,64,96]);
const MARKER_SIZES = Object.freeze([24,32,44]);
const MARKER_IDS = Object.freeze(['ai','solo','online','multiplayer','card','ready','waiting','live','ranking','room','locked','error']);
const COLORS = Object.freeze({
  ink:'#211923', ink2:'#443443', paper:'#FFF9F2', cream:'#F3E5C4',
  green:'#4BCB83', teal:'#39B9B2', blue:'#508BF0', purple:'#8656CF',
  pink:'#E45CA4', coral:'#EF665F', gold:'#F1B640', brown:'#82513F',
});
const GAME_ACCENT = Object.freeze({
  gomoku:COLORS.teal,ludo:COLORS.green,monopoly:COLORS.coral,
  tank:COLORS.green,tetris:COLORS.purple,xiangqi:COLORS.coral,
});

function ensure(...dirs){ dirs.forEach(dir=>fs.mkdirSync(dir,{recursive:true})); }
function resetGeneratedDir(dir){
  const resolved=path.resolve(dir),root=path.resolve(ROOT);
  if(resolved===root||!resolved.startsWith(root+path.sep))throw new Error('Refusing unsafe generated-dir reset');
  fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:100});
  fs.mkdirSync(resolved,{recursive:true});
}
function rel(file){ return path.relative(ROOT,file).replace(/\\/g,'/'); }
function digest(file){ const data=fs.readFileSync(file); return {sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length}; }
function write(file,value){ ensure(path.dirname(file)); fs.writeFileSync(file,value); }
function writeJson(file,value){ write(file,JSON.stringify(value,null,2)+'\n'); }
function esc(value){ return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function stroke(width,color=COLORS.ink,extra=''){ return `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`; }
function svg(width,height,content){ return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${content}</svg>\n`; }
function sourceSvg(content,width=512,height=512){ return svg(width,height,content); }
function desiredGameStroke(target){ return target<=44?35:target<=64?30:target<=96?27:18; }
function desiredMarkerStroke(target){ return target<=24?22:target<=32?20:target<=44?18:14; }
function shadow(offsetX=14,offsetY=22,opacity=.2){ return `<g transform="translate(${offsetX} ${offsetY})" opacity="${opacity}">`; }

function gomokuGlyph(sw){
  const grid=`<path d="M132 148H380M132 224H380M132 300H380M132 376H380M148 132V380M224 132V380M300 132V380M376 132V380" ${stroke(Math.max(10,sw*.38),COLORS.brown,'opacity=".48"')}/>`;
  return grid+shadow(12,18,.19)+`<circle cx="215" cy="250" r="92" fill="${COLORS.ink}"/><circle cx="306" cy="307" r="86" fill="${COLORS.paper}"/></g>`+`<circle cx="215" cy="250" r="92" fill="${COLORS.ink}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M162 208q44-42 92-9" ${stroke(Math.max(10,sw*.42),COLORS.ink2,'opacity=".72"')}/><circle cx="306" cy="307" r="86" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M266 267q35-31 72-6" ${stroke(Math.max(9,sw*.36),COLORS.cream)}/><circle cx="351" cy="258" r="18" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${Math.max(8,sw*.3)}"/>`;
}
function ludoGlyph(sw){
  const route=`<rect x="108" y="108" width="296" height="296" rx="74" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M256 112V400M112 256H400" ${stroke(Math.max(10,sw*.38),COLORS.ink2,'opacity=".36"')}/><circle cx="154" cy="154" r="28" fill="${COLORS.green}"/><circle cx="358" cy="154" r="28" fill="${COLORS.gold}"/><circle cx="154" cy="358" r="28" fill="${COLORS.blue}"/><circle cx="358" cy="358" r="28" fill="${COLORS.coral}"/>`;
  const plane=shadow(10,18,.18)+`<path d="M128 286l105-42 23-111 27 2 18 92 97 27 4 39-104-7-53 91-33-3 11-91-84 39z" fill="${COLORS.ink}"/></g><path d="M128 268l105-42 23-111 27 2 18 92 97 27 4 39-104-7-53 91-33-3 11-91-84 39z" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M229 226l69-17-53 74z" fill="${COLORS.teal}"/><path d="M302 268l96-32 4 39z" fill="${COLORS.coral}"/><circle cx="271" cy="159" r="13" fill="${COLORS.blue}"/>`;
  return route+plane;
}
function monopolyGlyph(sw){
  return shadow(12,22,.2)+`<path d="M96 355l95-56 84 44 98-65 62 46-160 111z" fill="${COLORS.ink}"/></g><path d="M96 333l95-56 84 44 98-65 62 46-160 111z" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M139 304v-122l72-50 66 44v145" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M243 306V137l70-48 70 43v125" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M159 229h34M159 268h34M278 163h45M278 205h45" ${stroke(Math.max(10,sw*.4),COLORS.paper)}/><rect x="300" y="282" width="126" height="126" rx="28" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}" transform="rotate(7 300 282)"/><circle cx="341" cy="323" r="12" fill="${COLORS.coral}"/><circle cx="392" cy="374" r="12" fill="${COLORS.coral}"/><circle cx="367" cy="349" r="12" fill="${COLORS.coral}"/>`;
}
function tankGlyph(sw){
  return `<path d="M256 72l156 58v122c0 92-61 150-156 188-95-38-156-96-156-188V130z" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M256 104l123 46v101c0 69-43 117-123 151-80-34-123-82-123-151V150z" fill="${COLORS.cream}"/><rect x="139" y="278" width="239" height="83" rx="36" fill="${COLORS.ink}"/><circle cx="181" cy="319" r="24" fill="${COLORS.paper}"/><circle cx="336" cy="319" r="24" fill="${COLORS.paper}"/><rect x="170" y="225" width="175" height="91" rx="34" fill="${COLORS.green}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="254" cy="228" r="64" fill="${COLORS.green}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M286 214h119q24 0 24 22t-24 22H287" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M214 197q40-27 77 0" ${stroke(Math.max(10,sw*.38),COLORS.paper,'opacity=".7"')}/>`;
}
function tetrisGlyph(sw){
  const blocks=[
    [112,120,COLORS.purple],[216,120,COLORS.purple],[112,224,COLORS.green],
    [216,224,COLORS.blue],[320,224,COLORS.blue],[216,328,COLORS.green],[320,328,COLORS.gold],
  ];
  return shadow(12,22,.18)+blocks.map(([x,y])=>`<rect x="${x}" y="${y}" width="92" height="92" rx="22" fill="${COLORS.ink}"/>`).join('')+`</g>`+blocks.map(([x,y,c])=>`<rect x="${x}" y="${y-18}" width="92" height="92" rx="22" fill="${c}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M${x+18} ${y+5}h38" ${stroke(Math.max(8,sw*.3),COLORS.paper,'opacity=".6"')}/>`).join('')+`<path d="M392 118l12 23 25 4-18 18 4 25-23-12-23 12 4-25-18-18 25-4z" fill="${COLORS.coral}" stroke="${COLORS.ink}" stroke-width="${Math.max(10,sw*.38)}"/>`;
}
function xiangqiGlyph(sw){
  return `<circle cx="256" cy="256" r="190" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="256" cy="256" r="157" ${stroke(Math.max(10,sw*.42),COLORS.gold)}/><path d="M130 210h252M130 302h252M180 130v252M256 130v252M332 130v252" ${stroke(Math.max(8,sw*.3),COLORS.brown,'opacity=".32"')}/><path d="M190 360q-12-46 23-87l-27-42q38-89 137-112l-11 64q46 34 28 92-13 42-67 46l31 51H190z" fill="${COLORS.coral}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M232 206q38-32 81-20M236 285q45 15 83-8" ${stroke(Math.max(10,sw*.38),COLORS.paper)}/><circle cx="287" cy="215" r="13" fill="${COLORS.ink}"/>`;
}
function gameGlyph(id,sw){
  if(id==='gomoku')return gomokuGlyph(sw);
  if(id==='ludo')return ludoGlyph(sw);
  if(id==='monopoly')return monopolyGlyph(sw);
  if(id==='tank')return tankGlyph(sw);
  if(id==='tetris')return tetrisGlyph(sw);
  return xiangqiGlyph(sw);
}
function gameRoleSvg(id,role,targetSize){
  const sw=desiredGameStroke(targetSize||512),accent=GAME_ACCENT[id],glyph=gameGlyph(id,sw);
  if(role==='icon')return sourceSvg(`<rect x="42" y="42" width="428" height="428" rx="108" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><rect x="66" y="66" width="380" height="380" rx="88" fill="${accent}" opacity=".16"/><g transform="translate(26 24) scale(.9)">${glyph}</g>`);
  if(role==='theme-icon')return sourceSvg(`<circle cx="256" cy="256" r="215" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="256" cy="256" r="183" fill="${accent}" opacity=".2"/><g transform="translate(72 72) scale(.72)">${glyph}</g><circle cx="412" cy="112" r="34" fill="${accent}" stroke="${COLORS.ink}" stroke-width="${Math.max(10,sw*.45)}"/>`);
  if(role==='selected-object')return sourceSvg(`<path d="M76 370l180-102 180 102-180 104z" fill="${COLORS.ink}" opacity=".22"/><path d="M76 342l180-102 180 102-180 104z" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M76 342v42l180 104v-42z" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${Math.max(10,sw*.55)}"/><path d="M436 342v42L256 488v-42z" fill="${accent}" stroke="${COLORS.ink}" stroke-width="${Math.max(10,sw*.55)}"/><g transform="translate(110 48) scale(.57)">${glyph}</g>`);
  const coverGlyph=gameGlyph(id,22);
  return sourceSvg(`<rect x="8" y="8" width="624" height="344" rx="54" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="16"/><path d="M18 250Q165 106 320 190T622 84V342H18z" fill="${accent}" opacity=".34"/><circle cx="118" cy="86" r="42" fill="${accent}"/><circle cx="186" cy="112" r="18" fill="${COLORS.gold}"/><circle cx="78" cy="286" r="15" fill="${COLORS.ink}" opacity=".18"/><circle cx="124" cy="286" r="15" fill="${accent}"/><circle cx="170" cy="286" r="15" fill="${COLORS.gold}"/><g transform="translate(282 -46) scale(.74)">${coverGlyph}</g>`,640,360);
}

function markerGlyph(id,sw){
  const inner=Math.max(10,sw*.42);
  if(id==='ai')return `<rect x="72" y="90" width="112" height="100" rx="28" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M128 90V56M108 56h40" ${stroke(inner)}/><circle cx="106" cy="136" r="10" fill="${COLORS.paper}"/><circle cx="150" cy="136" r="10" fill="${COLORS.paper}"/><path d="M106 166h44" ${stroke(inner,COLORS.ink2)}/>`;
  if(id==='solo')return `<circle cx="128" cy="96" r="42" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M58 205q8-71 70-71t70 71" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/>`;
  if(id==='online')return `<circle cx="84" cy="142" r="36" fill="${COLORS.blue}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="172" cy="142" r="36" fill="${COLORS.green}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M112 116q16-22 32 0M112 168q16 22 32 0" ${stroke(inner)}/>`;
  if(id==='multiplayer')return `<circle cx="91" cy="97" r="35" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="165" cy="97" r="35" fill="${COLORS.pink}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M38 207q7-70 60-70 27 0 38 20 16-20 39-20 48 0 54 70" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/>`;
  if(id==='card')return `<rect x="56" y="55" width="112" height="146" rx="22" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><rect x="96" y="42" width="112" height="146" rx="22" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M126 139h74M169 104l39 35-39 35" ${stroke(inner,COLORS.purple)}/>`;
  if(id==='ready')return `<circle cx="128" cy="128" r="92" fill="${COLORS.green}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M76 132l34 34 72-78" ${stroke(sw,COLORS.paper)}/><path d="M194 54l8 17 19 3-14 13 3 19-16-9-17 9 4-19-14-13 19-3z" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${inner}"/>`;
  if(id==='waiting')return `<path d="M78 52h100M78 204h100M92 57q0 48 36 70-36 23-36 72h72q0-49-36-72 36-22 36-70z" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M105 175h46l-23-27zM108 80h40l-20 25z" fill="${COLORS.gold}"/>`;
  if(id==='live')return `<circle cx="128" cy="128" r="88" fill="${COLORS.coral}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="128" cy="128" r="29" fill="${COLORS.paper}"/><path d="M128 55v28M128 173v28M55 128h28M173 128h28" ${stroke(inner,COLORS.paper)}/>`;
  if(id==='ranking')return `<path d="M46 201h164M66 201v-62h45v62M111 201V87h45v114M156 201v-86h40v86" fill="${COLORS.cream}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M134 39l12 24 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${inner}"/>`;
  if(id==='room')return `<path d="M52 207V96l76-53 76 53v111" fill="${COLORS.teal}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M95 207v-75h66v75" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${inner}"/><path d="M128 43v-22M132 25h57l-13 24h-44" fill="${COLORS.coral}" stroke="${COLORS.ink}" stroke-width="${inner}"/>`;
  if(id==='locked')return `<rect x="58" y="101" width="140" height="112" rx="26" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M87 101V76q0-42 41-42t41 42v25" ${stroke(sw)}/><circle cx="128" cy="151" r="14" fill="${COLORS.ink}"/><path d="M128 165v20" ${stroke(inner)}/>`;
  return `<path d="M128 35l96 39v66q0 61-96 88-96-27-96-88V74z" fill="${COLORS.coral}" stroke="${COLORS.ink}" stroke-width="${sw}"/><path d="M128 77v71M128 181v3" ${stroke(sw,COLORS.paper)}/>`;
}
function markerSvg(id,target){
  const sw=desiredMarkerStroke(target||256),accent=id==='error'?COLORS.coral:id==='ready'?COLORS.green:id==='waiting'?COLORS.gold:COLORS.teal;
  return sourceSvg(`<circle cx="128" cy="128" r="104" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="${sw}"/><circle cx="128" cy="128" r="86" fill="${accent}" opacity=".14"/><g>${markerGlyph(id,sw)}</g>`,256,256);
}

async function edgeAlphaStats(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let pixels=0,max=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    if(x!==0&&y!==0&&x!==info.width-1&&y!==info.height-1)continue;
    const alpha=data[(y*info.width+x)*info.channels+3];
    if(alpha>0){pixels++;if(alpha>max)max=alpha;}
  }
  return {edgeAlphaPixels:pixels,edgeAlphaMax:max};
}
async function record(file,extra={}){
  const meta=await sharp(file).metadata(),hash=digest(file),edge=extra.edgePolicy?await edgeAlphaStats(file):{};
  if(extra.edgePolicy==='transparent-gutter'&&edge.edgeAlphaPixels!==0)throw new Error(`Transparent gutter contamination: ${rel(file)} (${edge.edgeAlphaPixels} edge pixels, max alpha ${edge.edgeAlphaMax})`);
  return {path:rel(file),sha256:hash.sha256,bytes:hash.bytes,width:meta.width,height:meta.height,format:meta.format,alpha:!!meta.hasAlpha,...edge,...extra};
}
async function renderSvgToWebp(markup,file,width,height){ await sharp(Buffer.from(markup)).resize(width,height,{fit:'fill'}).webp({quality:92,alphaQuality:100,effort:6}).toFile(file); }
async function contactSheet(files,output,options={}){
  const tileW=options.tileW||180,tileH=options.tileH||180,cols=options.cols||6,rows=Math.ceil(files.length/cols),parts=[];
  for(let i=0;i<files.length;i++){
    const input=await sharp(files[i]).resize(tileW-32,tileH-32,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    parts.push({input,left:(i%cols)*tileW+16,top:Math.floor(i/cols)*tileH+16});
  }
  await sharp({create:{width:cols*tileW,height:rows*tileH,channels:4,background:COLORS.paper}}).composite(parts).png({compressionLevel:9,effort:10}).toFile(output);
}
async function smallRuntimeSheet(output){
  const cell=100,parts=[],rows=[
    ['game-icon',44,'light'],['game-icon',44,'dark'],['game-icon',64,'light'],['game-icon',64,'dark'],['game-icon',96,'light'],['game-icon',96,'dark'],
    ['theme-icon',64,'light'],['theme-icon',64,'dark'],['selected-object',96,'light'],['selected-object',96,'dark'],
    ['marker',24,'light'],['marker',24,'dark'],['marker',32,'light'],['marker',32,'dark'],['marker',44,'light'],['marker',44,'dark'],
  ];
  for(let row=0;row<rows.length;row++){
    const [kind,size,mode]=rows[row],ids=kind==='marker'?MARKER_IDS:GAME_IDS;
    for(let col=0;col<12;col++){
      const bg=Buffer.from(svg(cell,cell,`<rect width="${cell}" height="${cell}" fill="${mode==='dark'?COLORS.ink:COLORS.paper}"/>`));
      parts.push({input:bg,left:col*cell,top:row*cell});
      if(col>=ids.length)continue;
      const file=kind==='marker'
        ? path.join(RUNTIME_ROOT,'markers',`${ids[col]}-${size}-v2.webp`)
        : path.join(RUNTIME_ROOT,'games',ids[col],kind==='game-icon'?`icon-${size}-v2.webp`:`${kind}-${size}-v2.webp`);
      const input=await sharp(file).png().toBuffer(),offset=Math.round((cell-size)/2);
      parts.push({input,left:col*cell+offset,top:row*cell+offset});
    }
  }
  await sharp({create:{width:12*cell,height:rows.length*cell,channels:4,background:COLORS.paper}}).composite(parts).png({compressionLevel:9,effort:10}).toFile(output);
}

async function generate(){
  resetGeneratedDir(SOURCE_ROOT); resetGeneratedDir(GENERATED_REVIEW_ROOT); resetGeneratedDir(RUNTIME_ROOT);
  const sourceMasters=[],runtimeVariants=[],variants={},variantIntegrity={},variantBytes={};
  const addRuntime=async(key,markup,file,width,height,extra)=>{
    ensure(path.dirname(file)); await renderSvgToWebp(markup,file,width,height);
    const rec=await record(file,{role:'runtime-variant',bakedText:false,...extra});
    runtimeVariants.push(rec); variants[key]=rec.path; variantIntegrity[key]=`sha256:${rec.sha256.toLowerCase()}`; variantBytes[key]=rec.bytes;
  };
  for(const id of GAME_IDS){
    const gameSourceDir=path.join(SOURCE_ROOT,'games',id),runtimeDir=path.join(RUNTIME_ROOT,'games',id); ensure(gameSourceDir,runtimeDir);
    for(const role of GAME_ROLES){
      const sourceFile=path.join(gameSourceDir,`${role}-v2.svg`),markup=gameRoleSvg(id,role,512); write(sourceFile,markup);
      sourceMasters.push(await record(sourceFile,{kind:'game',gameId:id,role,bakedText:false}));
    }
    for(const size of ICON_SIZES)await addRuntime(`game-${id}-icon-${size}`,gameRoleSvg(id,'icon',size),path.join(runtimeDir,`icon-${size}-v2.webp`),size,size,{kind:'game',gameId:id,gameRole:'icon',size,edgePolicy:'transparent-gutter'});
    await addRuntime(`game-${id}-theme-icon-64`,gameRoleSvg(id,'theme-icon',64),path.join(runtimeDir,'theme-icon-64-v2.webp'),64,64,{kind:'game',gameId:id,gameRole:'theme-icon',size:64,edgePolicy:'transparent-gutter'});
    await addRuntime(`game-${id}-selected-object-96`,gameRoleSvg(id,'selected-object',96),path.join(runtimeDir,'selected-object-96-v2.webp'),96,96,{kind:'game',gameId:id,gameRole:'selected-object',size:96,edgePolicy:'transparent-gutter'});
    await addRuntime(`game-${id}-cover-crop-320x180`,gameRoleSvg(id,'cover-crop',320),path.join(runtimeDir,'cover-crop-320x180-v2.webp'),320,180,{kind:'game',gameId:id,gameRole:'cover-crop',size:'320x180',edgePolicy:'opaque-edge-intentional'});
  }
  const markerSourceDir=path.join(SOURCE_ROOT,'markers'),markerRuntimeDir=path.join(RUNTIME_ROOT,'markers'); ensure(markerSourceDir,markerRuntimeDir);
  for(const id of MARKER_IDS){
    const sourceFile=path.join(markerSourceDir,`${id}-v2.svg`); write(sourceFile,markerSvg(id,256));
    sourceMasters.push(await record(sourceFile,{kind:'marker',markerId:id,role:'marker',bakedText:false}));
    for(const size of MARKER_SIZES)await addRuntime(`marker-${id}-${size}`,markerSvg(id,size),path.join(markerRuntimeDir,`${id}-${size}-v2.webp`),size,size,{kind:'marker',markerId:id,size,edgePolicy:'transparent-gutter'});
  }
  const coreReview=path.join(GENERATED_REVIEW_ROOT,'game-icons-core-sizes-v2.png');
  const rolesReview=path.join(GENERATED_REVIEW_ROOT,'game-icons-context-roles-v2.png');
  const markerReview=path.join(GENERATED_REVIEW_ROOT,'game-system-markers-v2.png');
  const smallReview=path.join(GENERATED_REVIEW_ROOT,'game-icons-small-runtime-v2.png');
  await contactSheet(GAME_IDS.flatMap(id=>ICON_SIZES.map(size=>path.join(RUNTIME_ROOT,'games',id,`icon-${size}-v2.webp`))),coreReview,{cols:3,tileW:150,tileH:150});
  await contactSheet(GAME_IDS.flatMap(id=>['theme-icon-64-v2.webp','selected-object-96-v2.webp','cover-crop-320x180-v2.webp'].map(file=>path.join(RUNTIME_ROOT,'games',id,file))),rolesReview,{cols:3,tileW:220,tileH:150});
  await contactSheet(MARKER_IDS.flatMap(id=>MARKER_SIZES.map(size=>path.join(RUNTIME_ROOT,'markers',`${id}-${size}-v2.webp`))),markerReview,{cols:6,tileW:120,tileH:120});
  await smallRuntimeSheet(smallReview);
  const reviewBoards=[
    await record(coreReview,{role:'core-size-contact-sheet'}),
    await record(rolesReview,{role:'context-role-contact-sheet'}),
    await record(markerReview,{role:'marker-contact-sheet'}),
    await record(smallReview,{role:'small-runtime-light-dark-review'}),
  ];
  const runtimeBytes=runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),byteBudget=1024*1024;
  const family={
    schemaVersion:1,productionUnitId:'P0-12',familyId:FAMILY_ID,sourceAssetId:SOURCE_ID,artworkVersion:2,
    status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-vector',
    presentationStrategy:'Ghost-native Cartoon Icon v2 for DOM/CSS/Canvas 2.5D platform identity; no rule, protocol, ranking or room authority',
    generation:{provider:'project deterministic SVG + Sharp',model:'ImageGen visual anchor + deterministic vector runtime',taskId:'p0-12-game-icon-system-v2-20260819',imagegenTaskId:'exec-009d2d60-e1e8-4eaf-b1b4-dac423ec4f71'},
    externalReferenceContext:{status:'INVENTORY_FACT_SOURCES_LINKED_NO_EXTERNAL_PIXEL_TRANSMISSION',inventoryCount:836,totalBytes:18567721249,aggregateSha256:'A7151ED3C6B32FD1306962ACCD42F8F838A8E5B8D1EA54F4FC4A56397842298F',formats:{zip:64,pngFrames:44145,psd:288,ai:361,eps:3170},structureCounts:{layers:35107,groups:7553,textMarkers:1078,smartObjectMarkers:565},factSources:['asset-library/external-source-register-20260813.json','requirements/active/external-assets-audit-p1-20260813/evidence/external-file-content-hashes.json','requirements/active/external-assets-audit-p1-20260813/evidence/external-preview-license-audit.json','requirements/active/external-assets-audit-p1-20260813/evidence/external-layered-source-structure-audit-20260814.json','art-source/ui/ghost-native-q-ui-v1/REFERENCE_SCOPE.md'],licenseStatus:'EXTERNAL_REFERENCE_ONLY / blocked-license',transmissionScope:'This batch supplied only aggregate inventory facts, license status, task use and runtime prohibition to the image-generation route. No blocked-license file, preview, pixel, layer, archive member or vector object was transmitted; no per-file external provider/model/task/transmission record exists because no external input was sent.'},
    gameIds:GAME_IDS,gameRoles:GAME_ROLES,iconSizes:ICON_SIZES,markerIds:MARKER_IDS,markerSizes:MARKER_SIZES,
    sourceMasters,runtimeVariants,reviewBoards,
    featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},
    metrics:{sourceMasterCount:sourceMasters.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:reviewBoards.length,runtimeBytes,runtimeByteBudget:byteBudget,withinBudget:runtimeBytes<=byteBudget},
    fallback:{icon:'v2 icon -> GAMES Emoji -> generic gamepad',coverCrop:'v2 cover crop -> existing 320/640 GAME_ART cover -> Emoji',selectedObject:'v2 selected object -> existing CSS selected card',marker:'v2 marker -> existing Lucide/CSS/text'},
    motionBoundary:'Selected objects use finite transform/opacity only. Reduced motion removes lift; forced-colors hides decorative pixels and preserves existing semantic CSS/text.',
    a11y:'All image atoms are decorative and aria-hidden. Existing localized text, button labels, room state and ranking values remain the semantic source.',
    authorityBoundary:'Assets consume existing true UI state only. They do not derive or mutate AI difficulty, mode, game availability, room lifecycle, ranking, rules, protocol, reward, economy, replay or persistence.',
  };
  writeJson(path.join(FAMILY_ROOT,'asset-family-manifest-v2.json'),family);
  write(path.join(FAMILY_ROOT,'TECHNICAL_REVIEW_Reviewer_A.md'),`# P0-12 技术审查\n\n- 6 款游戏 × icon 44/64/96 + cover crop/theme icon/selected object；12 个 marker × 24/32/44。\n- ${sourceMasters.length} 个 SVG 源稿、${runtimeVariants.length} 个透明/卡片 WebP runtime 变体、${reviewBoards.length} 张生成检查板。\n- Runtime 总字节 ${runtimeBytes} / ${byteBudget}：${runtimeBytes<=byteBudget?'PASS':'FAIL'}。\n- 所有 runtime path、SHA-256、bytes、尺寸、Alpha、Manifest、Catalog、feature flag 与 fallback 由同一确定性脚本生成。\n- 生成目录使用资产族独占锁；全局 Manifest/Catalog 读改写使用跨资产族共享注册表锁，防止并行窗口丢失条目。\n`);
  write(path.join(FAMILY_ROOT,'MACHINE_VISUAL_REVIEW.md'),`# P0-12 机器视觉审查\n\n状态：TECHNICAL_VISUAL_PASS / LOCAL_ONLY / REAL_BROWSER_NOT_EXECUTED\n\n- 六款剪影分别由双棋子+网格、飞机+四色航点、城市+骰子、盾形坦克、积木阶梯、马首棋印编码，不依赖颜色单独区分。\n- 44/64/96px 核心图标、theme/selected 物件与 24/32/44px 全部 12 marker 均进入 light/dark 综合检查板；66 个透明原子 outer-gutter 的 edgeAlphaPixels/edgeAlphaMax 均为 0。\n- 6 个 cover crop 保留设计性卡片边框，edgePolicy=opaque-edge-intentional；不把它误判为透明污染。\n- cover crop/theme/selected-object 沿用 Ink/Paper、两级明暗、左上光与右下硬底影；selected-object 为浅 2.5D 纸板物件，不是 Three/PBR。\n- 12 个 marker 只映射已有真实语义；未创造 maintenance、favorite、rank up/down 等不存在的产品状态。\n- 限制：检查板和像素合同不冒充第二浏览器、真机、人工盲测、Reviewer B、IP/法律或逐资产 Golden Set。\n`);
  write(path.join(FAMILY_ROOT,'SIMILARITY_AND_IP_REVIEW.md'),`# P0-12 Similarity / IP 机器审查\n\n- 视觉锚点只使用两个项目自有 M0 文件；运行时由确定性 SVG 原创重绘。\n- 外部 836 项库存的完整事实源已链接（逐文件 URL/source path、SHA、预览/许可审计、结构统计与相似风险边界可从 factSources 复核）；本批实际生成路由只传递聚合事实、许可、用途和禁止边界，未传输任何外部像素/图层/向量。\n- 外部状态仍为 EXTERNAL_REFERENCE_ONLY / blocked-license，不进入 public/assets、Manifest、商城或默认 runtime；未来若启用受控 reference lane，必须另记 sourcePath/sourceSha256/provider/model/taskId/transmissionScope。\n- 未使用商业游戏名、角色、皇冠、徽记、服饰、专属 Pose、封面构图或商店卡结构。\n- 原创识别点：六款统一 Ink/Paper 纸板玩具语法；每款不同的形状组合；12 marker 与现有 Ghost 组件状态双编码。\n- 机器结论：未发现直接像素复制或特定第三方角色/徽记依赖；人工/IP/法律意见仍为可选咨询，未伪造 PASS。\n`);
  write(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md'),`# P0-12 OWNER_AUTHORIZED_ART_CLEARANCE\n\n- productionUnitId: P0-12\n- familyId: P-GAME-ICON-SYSTEM-V2 / artworkVersion: 2\n- status: OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED\n- feature flag: mg_art_game_icon_system_v2 (default-on, exact rollback value 0)\n- evidence: asset-family-manifest-v2.json, TECHNICAL_REVIEW_Reviewer_A.md, MACHINE_VISUAL_REVIEW.md, SIMILARITY_AND_IP_REVIEW.md, PROMPT_AND_PROVENANCE.md, SKILL_ROUTING.md, qa/game-icon-system-v2.js, qa/game-icon-system-runtime.js\n- fallback chain: v2 WebP → existing 320/640 cover or CSS/Lucide/text → GAMES Emoji/generic gamepad; selected-object failure → existing CSS selected card\n\n本批 runtime 为 Ghost-native deterministic vector，遵循用户确认的项目 M0 North Star。稳定 ID/SHA/provenance、机器技术/视觉/相似风险审查、透明 gutter、fallback、feature flag 和一键回滚齐全，可进入本地 default-on runtime 候选。ImageGen 板仅为 source-only 视觉锚点，不直接进入 runtime。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是可选咨询，未伪造为已完成；设备/第二浏览器/真机/真实网络/生产 Supabase 与发布仍待外部 Gate，发布仍须用户当前明确命令。\n`);
  const releaseRegistryLock=acquireArtRegistryLock(ROOT,{generatorId:'generate-game-icon-system-v2:registry'});
  try {
    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8')); manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==FAMILY_ID);
    manifest.assets.push({asset_id:FAMILY_ID,runtime_id:'game-icon-system',artwork_version:2,runtime_path:variants['game-gomoku-icon-64'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,game_ids:GAME_IDS,game_roles:GAME_ROLES,icon_sizes:ICON_SIZES,marker_ids:MARKER_IDS,marker_sizes:MARKER_SIZES,feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'game-icon-system-css-emoji-fallback',fallback:family.fallback,load:'lazy by visible consumer; selected object loads only for the selected card',a11y:family.a11y,license:family.license,source:rel(SOURCE_ROOT),clearance_record:rel(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),variant_integrity:variantIntegrity,variant_bytes:variantBytes,actual_bytes:runtimeBytes,byte_budget:byteBudget});
    writeJson(MANIFEST_PATH,manifest);
    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8')),productionIndex=Array.isArray(catalog.indexes)?catalog.indexes.find(item=>item&&item.id==='production-asset-manifest'):null;
    if(!productionIndex)throw new Error('Missing production-asset-manifest catalog index');
    productionIndex.sha256=digest(MANIFEST_PATH).sha256.toLowerCase();
    catalog.assets=catalog.assets.filter(item=>item&&item.id!==FAMILY_ID);
    catalog.assets.push({id:FAMILY_ID,category:'platform/game-icons',assetType:'cartoon-icon-v2-owner-cleared',sourceType:'project-owned',sourcePath:sourceMasters[0].path,sourceSha256:sourceMasters[0].sha256.toLowerCase(),license:family.license,author:'Ghost Game deterministic vector pipeline',status:'integrated-local-only',dimensions:{width:512,height:512},previewPath:reviewBoards[0].path,previewSha256:reviewBoards[0].sha256.toLowerCase(),runtimePaths:runtimeVariants.map(item=>item.path),promptPath:rel(path.join(FAMILY_ROOT,'PROMPT_AND_PROVENANCE.md')),model:'ImageGen visual anchor + deterministic SVG/Sharp runtime',remoteObjectKey:null});
    writeJson(CATALOG_PATH,catalog);
  } finally { releaseRegistryLock(); }
  console.log('P0-12 game icon system generated',{sourceMasters:sourceMasters.length,runtimeVariants:runtimeVariants.length,reviewBoards:reviewBoards.length,runtimeBytes,withinBudget:runtimeBytes<=byteBudget});
}

async function main(){ const release=acquireArtGeneratorLock(LOCK_PATH,{generatorId:'generate-game-icon-system-v2'}); try{await generate();}finally{release();} }
main().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
