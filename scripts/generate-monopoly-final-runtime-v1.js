/* Ghost Game P1-01 deterministic Monopoly 2.5D runtime art. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/games/monopoly/final-art-v1');
const SOURCE_ROOT = path.join(FAMILY_ROOT, 'runtime-source');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review/runtime');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/games/monopoly/final-art-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const FAMILY_MANIFEST = path.join(FAMILY_ROOT, 'asset-family-manifest-v1.json');
const LOCK_PATH = path.join(ROOT, '.tmp/art-generator-locks/monopoly-final-runtime-v1.lock');

const C = Object.freeze({ ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', shade:'#D6C19A', amber:'#E8B654', teal:'#5EAAA2', coral:'#D96B59', blue:'#7596B2', darkBlue:'#344858', green:'#6D9676' });
const BOARD_SIZE = 1056;
const VFX_SIZE = 512;
const FLAG = 'mg_art_monopoly_final_v1';
const FAMILY_ID = 'G-15-MONOPOLY-FINAL-ART-V1';
const SOURCE_ID = 'ART-036-MONOPOLY-FINAL-ART-V1';
const BOARD_ROLES = ['board-background','board-midground','board-foreground'];
const OBJECT_ROLES = ['object-townhouse','object-hall','object-market','object-tower','object-gate','object-chance-card','object-key-token','object-coin','object-bell'];
const VFX_ROLES = ['vfx-landing','vfx-opportunity','vfx-auction','vfx-purchase','vfx-payment','vfx-tax','vfx-bankruptcy','vfx-turn-result','vfx-final-result'];
const CAMERA_ROLES = ['camera-desktop','camera-mobile'];

function ensure(dir){fs.mkdirSync(dir,{recursive:true});}
function rel(file){return path.relative(ROOT,file).replace(/\\/g,'/');}
function write(file,data){ensure(path.dirname(file));fs.writeFileSync(file,data);}
function digest(file){const data=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length};}
function stroke(color=C.ink,width=10){return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`}
function svg(width,height,body,bg=''){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bg?`<rect width="${width}" height="${height}" fill="${bg}"/>`:''}${body}</svg>`;}
function shadow(x,y,w,h,opacity=.2){return `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${C.ink}" opacity="${opacity}"/>`;}
function roundedTile(x,y,w,h,fill=C.paper,sw=9){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${fill}" ${stroke(C.ink,sw)}/>`;}
function building(x,y,s,roof=C.teal,body=C.cream,kind='house'){
  const h=kind==='tower'?250:190, width=kind==='tower'?178:224;
  let b=shadow(x+width/2,y+h+18,width*.54,22,.2);
  b+=`<path d="M${x} ${y+h}V${y+58}L${x+width/2} ${y}l${width/2} 58v${h-58}Z" fill="${body}" ${stroke(C.ink,11)}/>`;
  b+=`<path d="M${x-12} ${y+62}  ${x+width/2} ${y-9} ${x+width+12} ${y+62}Z" fill="${roof}" ${stroke(C.ink,11)}/>`;
  b+=`<path d="M${x+width*.19} ${y+94}h28v38h-28zm${width*.4} 0h28v38h-28z" fill="${C.paper}" ${stroke(C.ink,6)}/>`;
  b+=`<path d="M${x+width*.42} ${y+h}v-52q0-30 ${width*.08}0t${width*.08}30v52" fill="${C.darkBlue}" ${stroke(C.ink,7)}/>`;
  b+=`<path d="M${x+10} ${y+h+2}h${width-20}" fill="none" ${stroke(C.shade,8)}/>`;
  if(kind==='tower') b+=`<circle cx="${x+width/2}" cy="${y+75}" r="20" fill="${C.paper}" ${stroke(C.ink,5)}/><path d="M${x+width/2-12} ${y+75}h24m-12-12v24" fill="none" ${stroke(C.ink,4)}/>`;
  return b;
}
function ghostMark(x,y,color=C.paper,scale=1){return `<path d="M${x} ${y+34*scale}q0-34 ${34*scale}0t${34*scale}34v${34*scale}l-${17*scale} -${12*scale} -${17*scale} ${12*scale} -${17*scale} -${12*scale} -${17*scale} ${12*scale} -${17*scale} -${12*scale}Z" fill="${color}" ${stroke(C.ink,6*scale)}/><circle cx="${x+24*scale}" cy="${y+30*scale}" r="4.5" fill="${C.ink}"/><circle cx="${x+45*scale}" cy="${y+30*scale}" r="4.5" fill="${C.ink}"/>`;}
function coin(cx,cy,r=48){return `${shadow(cx,cy+r+13,r*.88,10,.18)}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.amber}" ${stroke(C.ink,8)}/><circle cx="${cx}" cy="${cy}" r="${r*.72}" fill="${C.cream}" opacity=".92" ${stroke(C.ink,4)}/>${ghostMark(cx-r*.45,cy-r*.36,C.ink,r/52)}`;}
function boardBackground(){
  let b=`<rect x="34" y="34" width="988" height="988" rx="58" fill="${C.cream}" ${stroke(C.ink,16)}/><rect x="58" y="58" width="940" height="940" rx="44" fill="${C.paper}" ${stroke(C.shade,6)}/>`;
  const cells=[]; const cellW=122, cellH=122, x0=130, y0=130;
  for(let i=0;i<6;i++)cells.push([x0+i*cellW,y0]);
  for(let i=0;i<6;i++)cells.push([x0+5*cellW,y0+(i+1)*cellH]);
  for(let i=0;i<6;i++)cells.push([x0+(5-i)*cellW,y0+7*cellH]);
  for(let i=0;i<6;i++)cells.push([x0,y0+(6-i)*cellH]);
  cells.forEach(([x,y],i)=>{const stripe=[C.teal,C.paper,C.blue,C.paper,C.coral,C.paper][i%6];b+=`<rect x="${x}" y="${y}" width="${cellW-8}" height="${cellH-8}" rx="16" fill="${C.paper}" ${stroke(C.ink,6)}/><rect x="${x+8}" y="${y+8}" width="${cellW-24}" height="20" rx="8" fill="${stripe}"/>`;});
  b+=`<path d="M226 226h604v604H226Z" fill="${C.paper}" ${stroke(C.ink,8)}/><path d="M268 290c128-62 260-62 388 0s184 66 222 0" fill="none" ${stroke(C.teal,7)} opacity=".26"/><path d="M260 736c130-58 262-58 396 0s190 68 234 0" fill="none" ${stroke(C.coral,7)} opacity=".22"/>`;
  return svg(BOARD_SIZE,BOARD_SIZE,b);
}
function boardMidground(){
  let b=shadow(540,760,280,38,.14);b+=building(320,350,1,C.teal,C.cream,'house');b+=building(610,370,1,C.blue,C.paper,'house');b+=building(458,560,1,C.coral,C.cream,'house');b+=building(710,590,1,C.darkBlue,C.paper,'tower');
  b+=`<path d="M316 742q228-94 460 0" fill="none" ${stroke(C.shade,10)} opacity=".56"/>`;
  return svg(BOARD_SIZE,BOARD_SIZE,b);
}
function boardForeground(){
  let b='';b+=shadow(505,650,180,24,.22);b+=`<g transform="rotate(-7 505 595)"><rect x="382" y="512" width="246" height="148" rx="20" fill="${C.cream}" ${stroke(C.ink,11)}/><rect x="400" y="530" width="210" height="110" rx="14" fill="${C.darkBlue}" ${stroke(C.ink,6)}/>${ghostMark(465,555,C.paper,1.2)}</g>`;b+=coin(720,690,44);b+=`<path d="M250 840c180-24 364-24 548 0" fill="none" ${stroke(C.teal,7)} opacity=".3"/>`;return svg(BOARD_SIZE,BOARD_SIZE,b);
}
function objectSvg(role){
  if(role==='object-townhouse')return svg(512,512,building(138,92,1,C.teal,C.cream,'house'));
  if(role==='object-hall')return svg(512,512,building(128,72,1,C.darkBlue,C.paper,'tower'));
  if(role==='object-market')return svg(512,512,building(128,94,1,C.coral,C.cream,'house')+`<path d="M120 258h272" ${stroke(C.amber,12)}/>`);
  if(role==='object-tower')return svg(512,512,building(150,70,1,C.darkBlue,C.cream,'tower'));
  if(role==='object-gate')return svg(512,512,shadow(256,408,156,18,.18)+`<path d="M126 376V204q0-28 28-28t28 28v172m176 0V204q0-28 28-28t28 28v172M126 252h284M150 336h236" fill="none" ${stroke(C.darkBlue,22)}/><path d="M170 246 256 330l86-84" fill="none" ${stroke(C.coral,10)}/>`);
  if(role==='object-chance-card')return svg(512,512,shadow(258,406,146,18,.16)+`<g transform="rotate(-8 256 250)"><rect x="128" y="100" width="256" height="300" rx="24" fill="${C.paper}" ${stroke(C.ink,11)}/><rect x="148" y="120" width="216" height="260" rx="16" fill="${C.teal}" opacity=".26" ${stroke(C.teal,5)}/>${ghostMark(196,195,C.ink,1.65)}</g>`);
  if(role==='object-key-token')return svg(512,512,shadow(270,390,122,18,.18)+`<path d="M180 212a72 72 0 1 1 56 70l-68 68h-40v-42h42l26-26-18-18 30-30 18 18 28-28" fill="${C.amber}" ${stroke(C.ink,11)}/><circle cx="180" cy="212" r="30" fill="${C.cream}" ${stroke(C.ink,7)}/>`);
  if(role==='object-coin')return svg(512,512,coin(256,250,100));
  if(role==='object-bell')return svg(512,512,shadow(256,390,110,18,.18)+`<path d="M168 332h176q-14-26-14-88 0-92-74-92t-74 92q0 62-14 88Z" fill="${C.amber}" ${stroke(C.ink,11)}/><path d="M148 332h216M232 356h48" fill="none" ${stroke(C.ink,12)}/><path d="M134 196q-34 36-26 78m270-78q34 36 26 78" fill="none" ${stroke(C.coral,10)}/>`);
  return svg(512,512,'');
}
function vfxSvg(role){
  const c=C;
  if(role==='vfx-landing')return svg(VFX_SIZE,VFX_SIZE,`<ellipse cx="256" cy="310" rx="128" ry="58" fill="none" ${stroke(c.shade,16)}/>${[0,1,2,3].map(i=>`<path d="M${144+i*72} ${236-(i%2)*12}l${i%2?18:-18} -${54+i*8}" fill="none" ${stroke(i%2?c.amber:c.coral,10)}/>`).join('')}`);
  if(role==='vfx-opportunity')return svg(VFX_SIZE,VFX_SIZE,`<path d="M172 350q-14-56 30-98l104-78q38-28 70 8t-10 70l-106 72q-38 28-34 74Z" fill="${c.teal}" opacity=".82" ${stroke(c.ink,10)}/>${ghostMark(218,130,c.paper,1.5)}<path d="M352 170q48 18 48 66" fill="none" ${stroke(c.amber,10)}/>`);
  if(role==='vfx-auction')return svg(VFX_SIZE,VFX_SIZE,`<path d="M160 300q-76-58 0-116m192 116q76-58 0-116" fill="none" ${stroke(c.teal,12)}/><path d="M190 264q-48-42 0-84m132 84q48-42 0-84" fill="none" ${stroke(c.coral,10)}/>${objectSvg('object-bell').replace('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">','').replace('</svg>','')}`);
  if(role==='vfx-purchase')return svg(VFX_SIZE,VFX_SIZE,objectSvg('object-key-token').replace('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">','').replace('</svg>','')+`<circle cx="256" cy="250" r="144" fill="none" ${stroke(c.teal,12)} opacity=".62"/><path d="M126 180l-28-28m312 28 28-28m-28 168 28 28m-312-28-28 28" ${stroke(c.amber,9)}/>`);
  if(role==='vfx-payment')return svg(VFX_SIZE,VFX_SIZE,coin(130,256,54)+coin(382,256,54)+`<path d="M195 224h122m-122 64h122" fill="none" ${stroke(c.teal,10)}/><path d="m282 202 35 22-35 22m-52 20-35-22 35-22" fill="none" ${stroke(c.teal,10)}/>`);
  if(role==='vfx-tax')return svg(VFX_SIZE,VFX_SIZE,coin(176,256,58)+`<path d="M252 256h84" ${stroke(c.coral,12)}/><path d="M334 204v104" ${stroke(c.coral,20)}/><path d="M358 204v104" ${stroke(c.coral,8)}/>`);
  if(role==='vfx-bankruptcy')return svg(VFX_SIZE,VFX_SIZE,`<path d="M134 326V208q0-30 34-30h112q36 0 36 30v118Z" fill="${c.blue}" ${stroke(c.ink,11)}/><path d="M136 208h180l-38-42H174Z" fill="${c.darkBlue}" ${stroke(c.ink,9)}/><path d="M168 300h66" ${stroke(c.coral,10)}/>${coin(360,332,46)}<path d="M354 190q-54 18-62 70" fill="none" ${stroke(c.blue,16)}/>`);
  if(role==='vfx-turn-result')return svg(VFX_SIZE,VFX_SIZE,`<ellipse cx="256" cy="316" rx="130" ry="50" fill="none" ${stroke(c.teal,12)}/><path d="M166 250l-40-78m124 58V130m124 120 40-78" fill="none" ${stroke(c.amber,12)}/>${ghostMark(222,220,c.paper,1.1)}`);
  if(role==='vfx-final-result')return svg(VFX_SIZE,VFX_SIZE,`<path d="M256 96c26 74 90 82 142 56-17 64 18 114 78 124-58 32-66 92-42 140-70-20-128 4-178 54-50-50-108-74-178-54 24-48 16-108-42-140 60-10 95-60 78-124 52 26 116 18 142-56Z" fill="none" ${stroke(c.teal,14)}/>${ghostMark(222,218,c.paper,1.05)}${[0,1,2,3,4,5].map(i=>`<circle cx="${108+i*60}" cy="${132+(i%3)*54}" r="${6+i%3*2}" fill="${[c.amber,c.coral,c.teal][i%3]}"/>`).join('')}`);
  return svg(VFX_SIZE,VFX_SIZE,'');
}
function cameraSvg(role){const mobile=role==='camera-mobile',w=mobile?720:1280,h=mobile?960:720;return svg(w,h,`<rect x="${mobile?48:64}" y="${mobile?48:58}" width="${mobile?624:1152}" height="${mobile?864:604}" rx="${mobile?36:44}" fill="${C.cream}" ${stroke(C.ink,12)}/><rect x="${mobile?104:176}" y="${mobile?190:146}" width="${mobile?512:928}" height="${mobile?580:420}" rx="28" fill="${C.paper}" ${stroke(C.teal,8)}/>`);}
function spec(role){if(role==='board-background')return[boardBackground(),BOARD_SIZE,BOARD_SIZE,false];if(role==='board-midground')return[boardMidground(),BOARD_SIZE,BOARD_SIZE,true];if(role==='board-foreground')return[boardForeground(),BOARD_SIZE,BOARD_SIZE,true];if(OBJECT_ROLES.includes(role))return[objectSvg(role),512,512,true];if(VFX_ROLES.includes(role))return[vfxSvg(role),VFX_SIZE,VFX_SIZE,true];return[cameraSvg(role),role==='camera-mobile'?720:1280,role==='camera-mobile'?960:720,false];}
async function main(){
  const release=acquireArtGeneratorLock(LOCK_PATH,{generatorId:'monopoly-final-runtime-v1',waitMs:120000});
  try{
    ensure(SOURCE_ROOT);
    ensure(REVIEW_ROOT);
    ensure(RUNTIME_ROOT);
    const sources=[],variants=[];
    for(const role of [...BOARD_ROLES,...OBJECT_ROLES,...VFX_ROLES,...CAMERA_ROLES]){
      const [content,width,height,alpha]=spec(role);const sourceFile=path.join(SOURCE_ROOT,role+'-v1.svg');write(sourceFile,content+'\n');const sourceHash=digest(sourceFile);sources.push({role,path:rel(sourceFile),...sourceHash,width,height,alpha,kind:role.startsWith('board-')?'layer':role.startsWith('object-')?'object':role.startsWith('vfx-')?'semantic-vfx':'camera'});
      for(const mode of ['','-static']){const key=role+mode;const runtimeFile=path.join(RUNTIME_ROOT,key+'-v1.webp');await sharp(Buffer.from(content)).webp({quality:92,alphaQuality:100,effort:6}).toFile(runtimeFile);const runtimeHash=digest(runtimeFile);variants.push({role:key,path:rel(runtimeFile),...runtimeHash,width,height,alpha});}
    }
    const boardW=960,boardH=640;const composites=[];const allRoles=[...BOARD_ROLES,...OBJECT_ROLES,...VFX_ROLES];
    for(let i=0;i<allRoles.length;i++){const [content]=spec(allRoles[i]);const img=await sharp(Buffer.from(content)).resize(140,140,{fit:'contain',background:C.paper}).png().toBuffer();composites.push({input:img,left:(i%6)*160+10,top:Math.floor(i/6)*155+10});}
    const reviewFile=path.join(REVIEW_ROOT,'monopoly-final-runtime-contact-sheet-v1.png');await sharp({create:{width:boardW,height:boardH,channels:4,background:C.paper}}).composite(composites).png({compressionLevel:9,effort:10}).toFile(reviewFile);const reviewHash=digest(reviewFile);
    const total=variants.reduce((sum,item)=>sum+item.bytes,0);const family={schemaVersion:1,productionUnitId:'P1-01',familyId:FAMILY_ID,sourceAssetId:SOURCE_ID,sourceExtractionManifest:'art-source/games/monopoly/final-art-v1/source-extraction-manifest-v1.json',artworkVersion:1,status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-svg-sharp',runtimeStrategy:'Vanilla DOM + CSS + Canvas + GSAP 2.5D; no GLB/Three dependency',externalReferenceContext:{status:'SOURCE_ONLY_EXTERNAL_INFLUENCED_CONCEPTS_ONLY',license:'EXTERNAL_REFERENCE_ONLY / blocked-license',register:'asset-library/external-source-register-20260813.json',transmissionRecord:'art-source/games/monopoly/final-art-v1/EXTERNAL_REFERENCE_TRANSMISSION.json',runtimeBoundary:'No blocked-license pixel, layer, preview or generated concept is present in runtime variants.'},sources,variants,reviewBoards:[{path:rel(reviewFile),...reviewHash,width:boardW,height:boardH}],characterStrategy:{sourceOnlyConcept:'art-source/games/monopoly/final-art-v1/monopoly-player-character-action-sheet-source-v1.png',runtime:'reuse P0-10 player-character-v1 manifest-backed layers; no new model pixels in runtime'},featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},metrics:{sourceMasterCount:sources.length,runtimeVariantCount:variants.length,runtimeBytes:total,runtimeByteBudget:6*1024*1024,withinBudget:total<=6*1024*1024,boardLayerCount:3,objectAtomCount:OBJECT_ROLES.length,semanticVfxCount:VFX_ROLES.length},authorityBoundary:'presentation-only; 24-cell layout, labels, prices, ownership, money, phase, auction, replay, reward and rule state remain DOM/Rule Authority/Protocol',fallback:{chain:'Monopoly final art -> existing CSS/DOM/Canvas board + P0-10 character layers -> neutral token/marker'},release:'LOCAL_ONLY_NOT_RELEASED'};
    write(FAMILY_MANIFEST,JSON.stringify(family,null,2)+'\n');
    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==FAMILY_ID);const paths=Object.fromEntries(variants.map(item=>[item.role,item.path]));const hashes=Object.fromEntries(variants.map(item=>[item.role,'sha256:'+item.sha256.toLowerCase()]));const bytes=Object.fromEntries(variants.map(item=>[item.role,item.bytes]));manifest.assets.push({asset_id:FAMILY_ID,runtime_id:'monopoly',artwork_version:1,runtime_path:paths['board-background'],variants:paths,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'G-15-MONOPOLY-CSS-CANVAS-FALLBACK',fallback:'existing Monopoly DOM/CSS/Canvas board and P0-10 character layers',load:'lazy layered board; decode each layer before activation; remove nodes on game destroy; reduced-motion selects -static variants',a11y:'decorative board layers, objects and VFX aria-hidden; live labels, values, ownership and controls remain DOM/i18n',license:'project-owned-deterministic-svg-sharp',source:'art-source/games/monopoly/final-art-v1/runtime-source',clearance_record:'art-source/games/monopoly/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',variant_integrity:hashes,variant_bytes:bytes,actual_bytes:total,byte_budget:6*1024*1024,review_boards:[rel(reviewFile)]});fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n');console.log(`MONOPOLY_FINAL_RUNTIME_OK sourceMasters=${sources.length} runtimeVariants=${variants.length} runtimeBytes=${total}`);
  }finally{release();}
}
main().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
