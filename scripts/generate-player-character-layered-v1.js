/* Ghost Game P0-10 Player Character seven-slot 2.5D art pack. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock, acquireArtRegistryLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/player-character/layered-v1');
const AI_MASTER = path.join(FAMILY_ROOT, 'source/ai/player-character-six-pose-master-v1.png');
const SOURCE_LAYERS = path.join(FAMILY_ROOT, 'source/layers');
const SOURCE_POSES = path.join(FAMILY_ROOT, 'source/poses');
const SOURCE_COMPOSITES = path.join(FAMILY_ROOT, 'source/composites');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/player-character/layered-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const LOCK_PATH = path.join(ROOT, '.tmp', 'art-generator-locks', 'player-character-layered-v1.lock');

const SIZE = 512;
const RUNTIME_SIZES = Object.freeze([128, 256]);
const FLAG = 'mg_art_player_character_layered_v1';
const LAYER_ORDER = Object.freeze(['body','bottom','footwear','top','face','hair','accessory']);
const SLOT_CATALOG = Object.freeze({
  body: Object.freeze(['body-paper-01','body-dusk-01','body-moon-01','body-mist-01']),
  face: Object.freeze(['face-dot-01','face-bright-01','face-focus-01','face-joy-01','face-curious-01','face-calm-01']),
  hair: Object.freeze(['hair-none','hair-short-ink-01','hair-curl-ink-01','hair-bob-ink-01','hair-cloud-cream-01','hair-comet-teal-01','hair-sweep-violet-01','hair-tuft-coral-01']),
  top: Object.freeze(['top-hoodie-01','top-crew-ink-01','top-varsity-teal-01','top-sailor-blue-01','top-patch-coral-01','top-knit-gold-01','top-jacket-violet-01','top-tunic-mint-01','top-apron-cream-01','top-cosmic-dark-01']),
  bottom: Object.freeze(['bottom-shorts-01','bottom-trousers-01','bottom-skirt-01','bottom-joggers-01','bottom-cargo-01','bottom-overalls-01']),
  footwear: Object.freeze(['footwear-sneakers-01','footwear-boots-01','footwear-slipons-01','footwear-hightop-01','footwear-moon-01','footwear-teal-01']),
  accessory: Object.freeze(['accessory-none','accessory-round-glasses-01','accessory-square-glasses-01','accessory-scarf-teal-01','accessory-scarf-coral-01','accessory-headset-01','accessory-cap-01','accessory-star-pin-01','accessory-moon-pin-01','accessory-satchel-01','accessory-paper-halo-01','accessory-ghost-puff-01']),
});
const DEFAULTS = Object.freeze({
  body:'body-paper-01', face:'face-dot-01', hair:'hair-short-ink-01', top:'top-hoodie-01',
  bottom:'bottom-shorts-01', footwear:'footwear-sneakers-01', accessory:'accessory-none',
});
const POSES = Object.freeze(['idle-front','walk-contact-a','walk-passing-b','focus-tabletop','friendly-wave','victory-compact']);
const ACTIONS = Object.freeze({ idle:['idle-front'], walk:['walk-contact-a','walk-passing-b'], celebrate:['friendly-wave','victory-compact'] });
const C = Object.freeze({
  ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', creamShade:'#D9C7A6', black:'#332C2B',
  teal:'#42B8B2', tealDark:'#237C7A', blue:'#4C89E8', gold:'#E6B43D', coral:'#E75A4D',
  violet:'#8E6AD8', mint:'#73C68B', skinPaper:'#F4C99D', skinDusk:'#A96948', skinMoon:'#D9B38C', skinMist:'#F0D7C0',
});

function ensure(...dirs){ dirs.forEach(dir => fs.mkdirSync(dir, { recursive:true })); }
function rel(file){ return path.relative(ROOT, file).replace(/\\/g, '/'); }
function digest(file){ const data=fs.readFileSync(file); return { sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(), bytes:data.length }; }
function write(file, value){ ensure(path.dirname(file)); fs.writeFileSync(file, value); }
function writeJson(file, value){ write(file, JSON.stringify(value, null, 2) + '\n'); }
function esc(value){ return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char])); }
function svg(content){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><g stroke="${C.ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
}
function fillShape(tag, attrs, fill, extra=''){ return `<${tag} ${attrs} fill="${fill}" ${extra}/>`; }

function bodyContent(id){
  const skin = ({'body-dusk-01':C.skinDusk,'body-moon-01':C.skinMoon,'body-mist-01':C.skinMist})[id] || C.skinPaper;
  const shade = ({'body-dusk-01':'#7C4934','body-moon-01':'#B98966','body-mist-01':'#D7B69E'})[id] || '#D99E72';
  return [
    `<ellipse cx="256" cy="445" rx="112" ry="18" fill="${C.ink}" opacity=".16" stroke="none"/>`,
    fillShape('rect','x="203" y="343" width="43" height="94" rx="21"',skin),
    fillShape('rect','x="266" y="343" width="43" height="94" rx="21"',skin),
    fillShape('ellipse','cx="190" cy="279" rx="27" ry="34"',skin),
    fillShape('ellipse','cx="322" cy="279" rx="27" ry="34"',skin),
    fillShape('ellipse','cx="181" cy="167" rx="22" ry="31"',skin),
    fillShape('ellipse','cx="331" cy="167" rx="22" ry="31"',skin),
    fillShape('rect','x="238" y="216" width="36" height="48" rx="16"',shade),
    fillShape('ellipse','cx="256" cy="161" rx="78" ry="82"',skin),
    `<path d="M200 182c22 34 92 44 120 0-10 39-32 62-64 62s-55-23-56-62z" fill="${shade}" opacity=".22" stroke="none"/>`,
    `<path d="M217 111c21-17 60-24 92-3" fill="none" opacity=".28"/>`,
  ].join('');
}

function faceContent(id){
  const eye = (x, extra='') => `<ellipse cx="${x}" cy="165" rx="10" ry="15" fill="${C.ink}" stroke="none" ${extra}/>`;
  if(id==='face-bright-01') return `${eye(226)}${eye(286)}<circle cx="230" cy="160" r="3" fill="${C.paper}" stroke="none"/><circle cx="290" cy="160" r="3" fill="${C.paper}" stroke="none"/><path d="M239 195q17 18 34 0" fill="none"/>`;
  if(id==='face-focus-01') return `<path d="M212 145l24 7M300 145l-24 7" fill="none"/>${eye(226)}${eye(286)}<path d="M244 198h24" fill="none"/>`;
  if(id==='face-joy-01') return `<path d="M214 165q12-15 24 0M274 165q12-15 24 0" fill="none"/><path d="M235 190q21 27 42 0" fill="${C.coral}"/><circle cx="211" cy="184" r="8" fill="${C.coral}" opacity=".26" stroke="none"/><circle cx="301" cy="184" r="8" fill="${C.coral}" opacity=".26" stroke="none"/>`;
  if(id==='face-curious-01') return `<path d="M212 147q12-8 24 0M276 150q12-4 23 4" fill="none"/>${eye(226)}<ellipse cx="286" cy="168" rx="9" ry="13" fill="${C.ink}" stroke="none"/><circle cx="256" cy="194" r="7" fill="none"/>`;
  if(id==='face-calm-01') return `<path d="M213 166q12 9 24 0M275 166q12 9 24 0" fill="none"/><path d="M244 193q12 8 24 0" fill="none"/>`;
  return `${eye(226)}${eye(286)}<path d="M244 194q12 9 24 0" fill="none"/>`;
}

function hairContent(id){
  if(id==='hair-none') return '';
  const fill = id.includes('cream') ? C.cream : id.includes('teal') ? C.tealDark : id.includes('violet') ? C.violet : id.includes('coral') ? C.coral : C.black;
  const fringe = id.includes('curl')
    ? 'M185 146q9-68 70-69 66 0 74 70l-20-19-17 24-20-31-22 31-21-30-24 25-20-10z'
    : id.includes('bob')
    ? 'M183 151q5-75 72-77 71 2 75 78l-12 63-24-19-7-72-30 37-25-37-10 72-27 18z'
    : id.includes('sweep')
    ? 'M183 149q7-73 71-76 69 1 76 72-39-32-91-19-45 27l-8 52-18-27z'
    : id.includes('tuft')
    ? 'M185 151q7-68 67-73l8-25 15 25q49 9 57 69l-25-18-15 24-24-31-26 31-21-29-22 26z'
    : 'M183 151q6-72 70-76 70 1 78 71l-25-18-14 25-23-31-27 31-19-29-25 28z';
  const accent = id.includes('comet') ? `<path d="M285 91q28 2 45 21" fill="none" stroke="${C.paper}" opacity=".6"/>` : '';
  return `<path d="${fringe}" fill="${fill}"/>${accent}<path d="M201 110q24-22 56-21" fill="none" stroke="${C.paper}" opacity=".25"/>`;
}

function topContent(id){
  const palette = {
    'top-hoodie-01':[C.paper,C.gold], 'top-crew-ink-01':[C.black,C.cream], 'top-varsity-teal-01':[C.teal,C.paper],
    'top-sailor-blue-01':[C.blue,C.paper], 'top-patch-coral-01':[C.paper,C.coral], 'top-knit-gold-01':[C.gold,C.paper],
    'top-jacket-violet-01':[C.violet,C.paper], 'top-tunic-mint-01':[C.mint,C.paper], 'top-apron-cream-01':[C.cream,C.teal],
    'top-cosmic-dark-01':[C.ink,C.violet],
  };
  const [base, accent] = palette[id] || palette['top-hoodie-01'];
  const hood = id==='top-hoodie-01'
    ? `<path d="M176 185Q178 86 256 78Q334 86 336 185L307 217Q301 155 256 134Q211 155 205 217Z" fill="none" stroke="${base}" stroke-width="18"/>`
    : '';
  const torso = `<path d="M204 241q52-23 104 0l27 91-32 13-8-24v53h-78v-53l-8 24-32-13z" fill="${base}"/>`;
  const shade = `<path d="M217 352h78v22h-78z" fill="${C.ink}" opacity=".14" stroke="none"/>`;
  if(id==='top-crew-ink-01') return `${torso}${shade}<path d="M230 238q26 20 52 0" fill="none" stroke="${accent}"/>`;
  if(id==='top-varsity-teal-01') return `${torso}${shade}<path d="M256 237v133M216 258l-24 77M296 258l24 77" fill="none" stroke="${C.paper}"/><circle cx="276" cy="281" r="12" fill="${C.gold}"/>`;
  if(id==='top-sailor-blue-01') return `${torso}${shade}<path d="M215 245l41 42 41-42" fill="${C.paper}"/><path d="M256 286v54" fill="none" stroke="${C.coral}"/>`;
  if(id==='top-knit-gold-01') return `${torso}${shade}<path d="M226 263l60 70M286 263l-60 70" fill="none" stroke="${C.paper}" opacity=".6"/>`;
  if(id==='top-jacket-violet-01') return `${torso}${shade}<path d="M256 242v130M230 248l26 37 26-37" fill="none" stroke="${C.paper}"/><circle cx="256" cy="313" r="5" fill="${C.gold}" stroke="none"/>`;
  if(id==='top-tunic-mint-01') return `${torso}${shade}<path d="M215 327q41 23 82 0" fill="none" stroke="${C.paper}"/><path d="M228 246h56" stroke="${C.tealDark}"/>`;
  if(id==='top-apron-cream-01') return `${torso}${shade}<path d="M226 250h60l10 114h-80z" fill="${accent}"/><path d="M236 326h40" fill="none"/>`;
  if(id==='top-cosmic-dark-01') return `${torso}${shade}<circle cx="236" cy="286" r="5" fill="${C.gold}" stroke="none"/><circle cx="274" cy="318" r="4" fill="${C.teal}" stroke="none"/><path d="M286 270l8 15-16-3z" fill="${accent}"/>`;
  const patch = id==='top-patch-coral-01' ? C.coral : accent;
  return `${hood}${torso}${shade}<path d="M258 286l42-17v73l-42 12z" fill="${patch}"/><path d="M258 288l40-16" fill="none"/><path d="M264 283l8 9m7-14 8 9m7-13 8 9" fill="none"/>`;
}

function bottomContent(id){
  const base = id==='bottom-trousers-01' ? C.ink : id==='bottom-skirt-01' ? C.violet : id==='bottom-joggers-01' ? C.tealDark : id==='bottom-cargo-01' ? '#5C554E' : id==='bottom-overalls-01' ? C.blue : C.black;
  if(id==='bottom-trousers-01'||id==='bottom-joggers-01') return `<path d="M204 359h104l-8 72h-42l-2-42-2 42h-42z" fill="${base}"/><path d="M256 362v68" fill="none" opacity=".55"/>`;
  if(id==='bottom-skirt-01') return `<path d="M211 356h90l19 65H192z" fill="${base}"/><path d="M205 395h102" fill="none" stroke="${C.paper}" opacity=".5"/>`;
  if(id==='bottom-cargo-01') return `<path d="M202 357h108l-9 60h-41l-4-35-4 35h-41z" fill="${base}"/><rect x="207" y="374" width="30" height="24" rx="5" fill="${C.cream}" opacity=".34"/><rect x="275" y="374" width="30" height="24" rx="5" fill="${C.cream}" opacity=".34"/>`;
  if(id==='bottom-overalls-01') return `<path d="M207 353h98l-5 66h-39l-5-35-5 35h-39z" fill="${base}"/><path d="M221 356v-53h70v53" fill="none" stroke="${base}" stroke-width="17"/><circle cx="228" cy="322" r="5" fill="${C.gold}" stroke="none"/><circle cx="284" cy="322" r="5" fill="${C.gold}" stroke="none"/>`;
  return `<path d="M202 357h108l-10 58h-39l-5-32-5 32h-39z" fill="${base}"/><path d="M256 360v23" fill="none" opacity=".55"/><path d="M211 397h37M264 397h37" stroke="${C.cream}" opacity=".32"/>`;
}

function footwearContent(id){
  const base = id==='footwear-boots-01' ? '#5C493E' : id==='footwear-slipons-01' ? C.coral : id==='footwear-hightop-01' ? C.violet : id==='footwear-moon-01' ? C.blue : id==='footwear-teal-01' ? C.tealDark : C.black;
  const high = id==='footwear-boots-01'||id==='footwear-hightop-01';
  const top = high ? 399 : 415;
  return `<path d="M188 ${top}h58v37q-37 12-68-2 1-17 10-23z" fill="${base}"/><path d="M266 ${top}h58l10 12q8 10 1 23-32 11-69-3z" fill="${base}"/><path d="M180 452q32 9 68-2M264 450q37 11 73 1" fill="none" stroke="${C.paper}"/><path d="M203 430h26M283 430h26" fill="none" stroke="${C.paper}" opacity=".8"/>`;
}

function accessoryContent(id){
  if(id==='accessory-none') return '';
  if(id==='accessory-round-glasses-01') return `<circle cx="226" cy="166" r="23" fill="none"/><circle cx="286" cy="166" r="23" fill="none"/><path d="M249 166h14" fill="none"/>`;
  if(id==='accessory-square-glasses-01') return `<rect x="201" y="145" width="49" height="40" rx="12" fill="none"/><rect x="262" y="145" width="49" height="40" rx="12" fill="none"/><path d="M250 163h12" fill="none"/>`;
  if(id==='accessory-scarf-teal-01'||id==='accessory-scarf-coral-01'){const f=id.includes('teal')?C.teal:C.coral;return `<path d="M216 235q40 25 80 0l-7 38q-33 18-66 0z" fill="${f}"/><path d="M277 260l18 65 23-9-25-68z" fill="${f}"/>`;}
  if(id==='accessory-headset-01') return `<path d="M191 170q2-86 65-88 66 2 67 88" fill="none" stroke="${C.tealDark}" stroke-width="14"/><rect x="178" y="157" width="27" height="53" rx="12" fill="${C.teal}"/><rect x="307" y="157" width="27" height="53" rx="12" fill="${C.teal}"/><path d="M320 204q0 31-36 30" fill="none" stroke="${C.tealDark}"/>`;
  if(id==='accessory-cap-01') return `<path d="M187 131q15-66 71-66 55 0 72 66-65-25-143 0z" fill="${C.blue}"/><path d="M254 129q45-10 88 8-43 22-85 7z" fill="${C.blue}"/>`;
  if(id==='accessory-star-pin-01') return `<path d="M303 278l7 13 15 2-11 11 3 15-14-7-14 7 3-15-11-11 15-2z" fill="${C.gold}"/>`;
  if(id==='accessory-moon-pin-01') return `<path d="M318 279q-22 10-9 34-25-8-20-29 5-22 29-5z" fill="${C.violet}"/>`;
  if(id==='accessory-satchel-01') return `<path d="M202 246l102 118" fill="none" stroke="${C.coral}" stroke-width="13"/><rect x="286" y="328" width="58" height="50" rx="12" fill="${C.coral}"/>`;
  if(id==='accessory-paper-halo-01') return `<ellipse cx="256" cy="62" rx="67" ry="20" fill="none" stroke="${C.gold}" stroke-width="12"/>`;
  return `<path d="M331 246q21-28 43 0 25 4 15 30-9 22-37 9-27 14-38-9-10-22 17-30z" fill="${C.paper}"/><circle cx="343" cy="261" r="4" fill="${C.ink}" stroke="none"/><circle cx="361" cy="261" r="4" fill="${C.ink}" stroke="none"/>`;
}

function layerContent(slot,id){
  if(slot==='body') return bodyContent(id);
  if(slot==='face') return faceContent(id);
  if(slot==='hair') return hairContent(id);
  if(slot==='top') return topContent(id);
  if(slot==='bottom') return bottomContent(id);
  if(slot==='footwear') return footwearContent(id);
  if(slot==='accessory') return accessoryContent(id);
  return '';
}

async function imageRecord(file, extra={}){
  const meta = await sharp(file).metadata(), hash=digest(file);
  return { path:rel(file), sha256:hash.sha256, bytes:hash.bytes, width:meta.width, height:meta.height, format:meta.format, alpha:!!meta.hasAlpha, ...extra };
}

async function svgComposite(selection){
  const inputs=[];
  for(const slot of LAYER_ORDER){ inputs.push({ input:Buffer.from(svg(layerContent(slot,selection[slot]))) }); }
  return sharp({ create:{ width:SIZE,height:SIZE,channels:4,background:{r:0,g:0,b:0,alpha:0} } }).composite(inputs).png({compressionLevel:9,effort:10}).toBuffer();
}

async function mattePoseCell(buffer){
  const image=sharp(buffer).ensureAlpha();
  const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],min=Math.min(r,g,b),max=Math.max(r,g,b),spread=max-min;
    if(min>=235&&spread<=10)data[i+3]=0;
    else if(min>=226&&spread<=13)data[i+3]=Math.max(0,Math.min(255,Math.round((235-min)/9*255)));
    else data[i+3]=255;
  }
  const cleaned=await sharp(data,{raw:info}).png().toBuffer();
  const trimmed=await sharp(cleaned).trim({background:{r:0,g:0,b:0,alpha:0},threshold:4}).png().toBuffer();
  const fitted=await sharp(trimmed).resize(470,470,{fit:'inside',withoutEnlargement:false}).png().toBuffer();
  const meta=await sharp(fitted).metadata();
  return sharp({create:{width:SIZE,height:SIZE,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:fitted,left:Math.round((SIZE-meta.width)/2),top:Math.round((SIZE-meta.height)/2)}])
    .png({compressionLevel:9,effort:10}).toBuffer();
}

async function poseCells(){
  const meta=await sharp(AI_MASTER).metadata();
  if(meta.width!==1536||meta.height!==1024) throw new Error('Unexpected P0-10 imagegen master identity');
  const result=[];
  for(let index=0;index<POSES.length;index++){
    const col=index%3,row=Math.floor(index/3),left=col*512,top=row*512;
    const cell=await sharp(AI_MASTER).extract({left,top,width:512,height:512}).png().toBuffer();
    const matte=await mattePoseCell(cell);
    // The generated board occasionally lets a neighboring row's contact
    // shadow bleed across the crop boundary. A small top-edge guard on the
    // lower row preserves the six pose silhouettes without carrying that
    // neighboring shadow into runtime.
    if(row===1){
      const {data,info}=await sharp(matte).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      for(let y=0;y<60;y++) for(let x=0;x<info.width;x++) data[(y*info.width+x)*4+3]=0;
      result.push(await sharp(data,{raw:info}).png().toBuffer());
    } else result.push(matte);
  }
  return result;
}

async function reviewBoard(buffers, columns, tile, output, background=C.paper){
  const rows=Math.ceil(buffers.length/columns),parts=[];
  for(let i=0;i<buffers.length;i++){
    const thumb=await sharp(buffers[i]).resize(tile-24,tile-24,{fit:'contain'}).png().toBuffer();
    parts.push({input:thumb,left:(i%columns)*tile+12,top:Math.floor(i/columns)*tile+12});
  }
  await sharp({create:{width:columns*tile,height:rows*tile,channels:4,background}}).composite(parts).png({compressionLevel:9,effort:10}).toFile(output);
}

async function generatePlayerCharacterLayered(){
  if(!fs.existsSync(AI_MASTER)) throw new Error('Missing P0-10 imagegen visual anchor');
  ensure(SOURCE_LAYERS,SOURCE_POSES,SOURCE_COMPOSITES,REVIEW_ROOT,RUNTIME_ROOT);
  const sourceLayers=[],runtimeVariants=[],variants={},variantIntegrity={},variantBytes={};
  const previewBuffers=[];

  for(const slot of Object.keys(SLOT_CATALOG)){
    ensure(path.join(SOURCE_LAYERS,slot),path.join(RUNTIME_ROOT,'layers',slot));
    for(const id of SLOT_CATALOG[slot]){
      const sourceFile=path.join(SOURCE_LAYERS,slot,`${id}-v1.svg`),source=svg(layerContent(slot,id));
      write(sourceFile,source+'\n');
      const hash=digest(sourceFile);
      sourceLayers.push({slot,id,path:rel(sourceFile),sha256:hash.sha256,bytes:hash.bytes,width:SIZE,height:SIZE,format:'svg',alpha:true,bakedText:false});
      const selection={...DEFAULTS,[slot]:id};
      previewBuffers.push(await svgComposite(selection));
      for(const size of RUNTIME_SIZES){
        const runtimeFile=path.join(RUNTIME_ROOT,'layers',slot,`${id}-${size}-v1.webp`),key=`layer-${slot}-${id}-${size}`;
        await sharp(Buffer.from(source)).resize(size,size).webp({quality:91,alphaQuality:100,effort:6}).toFile(runtimeFile);
        const record=await imageRecord(runtimeFile,{role:'slot-layer',slot,id,size,bakedText:false});
        runtimeVariants.push(record);variants[key]=record.path;variantIntegrity[key]=`sha256:${record.sha256.toLowerCase()}`;variantBytes[key]=record.bytes;
      }
    }
  }

  const defaultBuffer=await svgComposite(DEFAULTS),defaultSource=path.join(SOURCE_COMPOSITES,'player-character-default-neutral-v1.png');
  write(defaultSource,defaultBuffer);
  const defaultRecord=await imageRecord(defaultSource,{role:'default-composite',selection:DEFAULTS,bakedText:false});
  for(const size of RUNTIME_SIZES){
    const file=path.join(RUNTIME_ROOT,'composites',`default-neutral-${size}-v1.webp`),key=`composite-default-${size}`;ensure(path.dirname(file));
    await sharp(defaultBuffer).resize(size,size).webp({quality:92,alphaQuality:100,effort:6}).toFile(file);
    const record=await imageRecord(file,{role:'default-composite',id:'default-neutral',size,bakedText:false});runtimeVariants.push(record);variants[key]=record.path;variantIntegrity[key]=`sha256:${record.sha256.toLowerCase()}`;variantBytes[key]=record.bytes;
  }

  const poseBuffers=await poseCells(),sourcePoses=[];
  for(let index=0;index<POSES.length;index++){
    const id=POSES[index],sourceFile=path.join(SOURCE_POSES,`${id}-v1.png`);write(sourceFile,poseBuffers[index]);
    const sourceRecord=await imageRecord(sourceFile,{role:'pose-master',id,method:'deterministic task-scoped crop and checkerboard matte from project-generated imagegen master',bakedText:false});sourcePoses.push(sourceRecord);
    for(const size of RUNTIME_SIZES){
      const file=path.join(RUNTIME_ROOT,'poses',`${id}-${size}-v1.webp`),key=`pose-${id}-${size}`;ensure(path.dirname(file));
      await sharp(sourceFile).resize(size,size).webp({quality:92,alphaQuality:100,effort:6}).toFile(file);
      const record=await imageRecord(file,{role:'pose',id,size,bakedText:false});runtimeVariants.push(record);variants[key]=record.path;variantIntegrity[key]=`sha256:${record.sha256.toLowerCase()}`;variantBytes[key]=record.bytes;
    }
  }

  const slotBoard=path.join(REVIEW_ROOT,'player-character-slots-contact-sheet-v1.png');await reviewBoard(previewBuffers,8,190,slotBoard);
  const poseBoard=path.join(REVIEW_ROOT,'player-character-poses-contact-sheet-v1.png');await reviewBoard(poseBuffers,3,360,poseBoard);
  const reviewBoards=[await imageRecord(slotBoard,{role:'slot-family-contact-sheet'}),await imageRecord(poseBoard,{role:'pose-contact-sheet'})];
  const aiMasterRecord=await imageRecord(AI_MASTER,{role:'imagegen-six-pose-visual-anchor',taskId:'exec-11ea459c-d1aa-4a6a-b5d6-91ff4062146b',requestedAlpha:true,actualAlpha:false});
  const runtimeBytes=runtimeVariants.reduce((sum,item)=>sum+item.bytes,0);
  const slotCount=Object.values(SLOT_CATALOG).reduce((sum,ids)=>sum+ids.length,0);
  const family={
    schemaVersion:1,productionUnitId:'P0-10',familyId:'P-PLAYER-CHARACTER-LAYERED-V1',sourceAssetId:'ART-PLAYER-CHARACTER-LAYERED-V1',artworkVersion:1,
    status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-ai-generated-and-deterministic-vector',presentationStrategy:'seven-slot transparent 2.5D layers plus six compact pose masters for DOM/CSS/Canvas/GSAP; no GLB, bones or Three dependency',
    generation:{provider:'OpenAI Codex built-in imagegen',model:'built-in model not exposed by tool',taskId:'exec-11ea459c-d1aa-4a6a-b5d6-91ff4062146b',mode:'project-owned character identity and six-pose reference board',aiMaster:aiMasterRecord,alphaRepair:'source master returned opaque checkerboard; only pose cells use deterministic neutral-checker matte; runtime slot layers are clean project-owned vectors'},
    externalReferenceContext:{status:'FULL_INVENTORY_CONTEXT_KNOWN_NO_EXTERNAL_PIXEL_TRANSMISSION',register:'asset-library/external-source-register-20260813.json',aggregateSha256:'a7151ed3c6b32fd1306962accd42f8f838a8e5b8d1ea54f4fc4a56397842298f',files:836,bytes:18567721249,semanticUse:'action coverage and layered-slot inventory context only',transmissionScope:'No blocked-license file, preview, pixel, layer, archive member or vector object was transmitted to imagegen. Prompt inputs were three project-owned images.'},
    characters:['character-base-01'],slotOrder:LAYER_ORDER,slotCatalog:SLOT_CATALOG,defaultSelection:DEFAULTS,poses:POSES,actions:ACTIONS,runtimeSizes:RUNTIME_SIZES,
    sourceLayers,sourcePoses,sourceComposites:[defaultRecord],runtimeVariants,reviewBoards,
    featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},
    metrics:{slotCount,sourceLayerCount:sourceLayers.length,sourcePoseCount:sourcePoses.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:reviewBoards.length,runtimeBytes,runtimeByteBudget:4*1024*1024,withinBudget:runtimeBytes<=4*1024*1024},
    fallback:{chain:'P0-10 seven-slot layers -> same-family generic default composite (not slot-exact) -> existing deterministic Monopoly/player token -> Avatar/initial'},
    motionBoundary:'Static layers and pose atoms only. Existing presentation semantics own transforms and finite motion; reduced-motion keeps the idle static composite.',
    a11y:'Player Character art is decorative inside an already named identity/token. Names, slot state and actions remain HTML/i18n or authoritative state.',
    authorityBoundary:'Presentation only. No rule, position, movement legality, economy, owned/equipped transaction, reward, replay, protocol, AI or persistence authority changes.',
  };
  writeJson(path.join(FAMILY_ROOT,'asset-family-manifest-v1.json'),family);

  const releaseRegistryLock=acquireArtRegistryLock(ROOT,{generatorId:'generate-player-character-layered-v1:registry'});
  try {
    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
    manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==family.familyId);
    manifest.assets.push({
      asset_id:family.familyId,runtime_id:'player-character',artwork_version:1,runtime_path:variants['composite-default-256'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:family.sourceAssetId,
      slot_catalog:SLOT_CATALOG,slot_order:LAYER_ORDER,default_selection:DEFAULTS,poses:POSES,actions:ACTIONS,runtime_sizes:RUNTIME_SIZES,
      feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'player-character-code-fallback',fallback:family.fallback.chain,
      load:'lazy visible Profile/Monopoly identity; decode all selected layers before fallback retirement',a11y:family.a11y,license:family.license,source:rel(SOURCE_LAYERS),clearance_record:rel(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),
      variant_integrity:variantIntegrity,variant_bytes:variantBytes,actual_bytes:runtimeBytes,byte_budget:4*1024*1024,
    });
    writeJson(MANIFEST_PATH,manifest);

    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));
    const productionIndex=Array.isArray(catalog.indexes)?catalog.indexes.find(item=>item&&item.id==='production-asset-manifest'):null;
    if(!productionIndex) throw new Error('Missing production-asset-manifest catalog index');
    productionIndex.sha256=digest(MANIFEST_PATH).sha256.toLowerCase();
    catalog.assets=catalog.assets.filter(item=>item&&item.id!==family.familyId);
    catalog.assets.push({
      id:family.familyId,category:'platform/player-character',assetType:'seven-slot-layered-player-character-owner-cleared',sourceType:'project-owned',sourcePath:aiMasterRecord.path,sourceSha256:aiMasterRecord.sha256.toLowerCase(),license:family.license,
      author:'OpenAI Codex for Ghost Game',status:'integrated-local-only',dimensions:{width:aiMasterRecord.width,height:aiMasterRecord.height},previewPath:reviewBoards[0].path,previewSha256:reviewBoards[0].sha256.toLowerCase(),runtimePaths:runtimeVariants.map(item=>item.path),
      promptPath:rel(path.join(FAMILY_ROOT,'PROMPT_AND_PROVENANCE.md')),model:'OpenAI Codex built-in imagegen + deterministic SVG/Sharp derivatives',remoteObjectKey:null,
    });
    writeJson(CATALOG_PATH,catalog);
  } finally { releaseRegistryLock(); }
  console.log('P0-10 player character generated',{slotCount,sourcePoses:sourcePoses.length,runtimeVariants:runtimeVariants.length,runtimeBytes,withinBudget:family.metrics.withinBudget});
}

async function main(){
  const releaseLock=acquireArtGeneratorLock(LOCK_PATH,{generatorId:'generate-player-character-layered-v1'});
  try { await generatePlayerCharacterLayered(); }
  finally { releaseLock(); }
}
main().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
