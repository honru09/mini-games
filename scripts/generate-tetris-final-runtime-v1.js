/* Ghost Game P1-03 deterministic Tetris 2.5D runtime art. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/games/tetris/final-art-v1');
const SOURCE_ROOT = path.join(FAMILY_ROOT, 'runtime-source');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/games/tetris/final-art-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const FAMILY_MANIFEST = path.join(FAMILY_ROOT, 'asset-family-manifest-v1.json');
const C = Object.freeze({
  ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', shade:'#D6C19A',
  amber:'#E8B654', teal:'#5EAAA2', coral:'#D96B59', blue:'#7596B2',
  purple:'#9A7BB5', mint:'#72C4A2', orange:'#E6864C', steel:'#34363B'
});
const FLAG = 'mg_art_tetris_final_v1';
const FAMILY_ID = 'G-11-TETRIS-FINAL-ART-V1';
const SOURCE_ID = 'ART-037-TETRIS-FINAL-ART-V1';
const BOARD_ROLES = ['board-background','board-midground','board-foreground'];
const OBJECT_ROLES = [
  'object-block-i','object-block-o','object-block-t','object-block-s','object-block-z',
  'object-block-j','object-block-l','object-block-ghost','object-block-garbage',
  'object-well-frame','object-next-frame','object-hold-frame'
];
const VFX_ROLES = [
  'vfx-line-clear','vfx-hard-drop','vfx-t-spin','vfx-b2b',
  'vfx-combo','vfx-perfect-clear','vfx-incoming-garbage','vfx-ko'
];
const CAMERA_ROLES = ['camera-desktop','camera-mobile'];

function ensure(dir){fs.mkdirSync(dir,{recursive:true});}
function rel(file){return path.relative(ROOT,file).replace(/\\/g,'/');}
function write(file,data){ensure(path.dirname(file));fs.writeFileSync(file,data);}
function digest(file){const data=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length};}
function stroke(color=C.ink,width=10){return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`}
function svg(width,height,body,bg=''){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bg?`<rect width="${width}" height="${height}" fill="${bg}"/>`:''}${body}</svg>`;}
function shadow(cx,cy,rx,ry,opacity=.22){return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.ink}" opacity="${opacity}"/>`;}

function block(accent=C.teal, bevel=C.paper, dark=C.ink){
  return `<rect x="56" y="56" width="400" height="400" rx="36" fill="${accent}" ${stroke(C.ink,16)}/>`+
    `<rect x="88" y="88" width="336" height="336" rx="24" fill="none" stroke="${bevel}" stroke-width="12" opacity=".8"/>`+
    `<path d="M88 424 424 88" fill="none" stroke="${C.ink}" stroke-width="8" opacity=".18"/>`+
    `<circle cx="140" cy="140" r="28" fill="${bevel}" opacity=".9"/>`+
    `<rect x="236" y="236" width="156" height="156" rx="16" fill="${dark}" opacity=".16"/>`;
}

function arenaBackground(){
  let b=`<rect x="38" y="38" width="980" height="644" rx="46" fill="${C.cream}" ${stroke(C.ink,16)}/>`+
    `<rect x="58" y="58" width="940" height="604" rx="34" fill="${C.paper}" ${stroke(C.shade,6)}/>`+
    `<path d="M90 140h876M90 580h876" fill="none" ${stroke(C.shade,4)} opacity=".45"/>`;
  for(let i=0;i<6;i++)for(let j=0;j<3;j++)b+=`<circle cx="${150+i*150}" cy="${180+j*180}" r="4" fill="${C.shade}" opacity=".5"/>`;
  return svg(1056,720,b);
}

function arenaMidground(){
  // Main well frame area (approx 340x600 in center) and side slots
  let b=`<rect x="358" y="70" width="340" height="580" rx="20" fill="${C.paper}" ${stroke(C.ink,10)}/>`;
  // Internal 10x18 subtle grid
  for(let col=1;col<10;col++) b+=`<line x1="${358+col*34}" y1="70" x2="${358+col*34}" y2="650" stroke="${C.shade}" stroke-width="2" opacity=".35"/>`;
  for(let row=1;row<18;row++) b+=`<line x1="358" y1="${70+row*(580/18)}" x2="698" y2="${70+row*(580/18)}" stroke="${C.shade}" stroke-width="2" opacity=".35"/>`;
  // Hold slot (left)
  b+=`<rect x="140" y="110" width="160" height="160" rx="18" fill="${C.cream}" ${stroke(C.ink,8)}/>`+
     `<text x="220" y="96" text-anchor="middle" fill="${C.ink}" font-size="20" font-family="sans-serif" font-weight="bold">HOLD</text>`;
  // Next queue slot (right)
  b+=`<rect x="756" y="110" width="160" height="360" rx="18" fill="${C.cream}" ${stroke(C.ink,8)}/>`+
     `<text x="836" y="96" text-anchor="middle" fill="${C.ink}" font-size="20" font-family="sans-serif" font-weight="bold">NEXT</text>`;
  return svg(1056,720,b);
}

function arenaForeground(){
  let b=shadow(528,680,480,24,.25);
  b+=`<path d="M358 70h340v12H358z" fill="${C.amber}" ${stroke(C.ink,6)}/>`+
     `<path d="M358 638h340v12H358z" fill="${C.steel}" ${stroke(C.ink,6)}/>`;
  return svg(1056,720,b);
}

function objectSvg(role){
  if(role==='object-block-i') return svg(512,512,block(C.teal,C.paper,C.ink));
  if(role==='object-block-o') return svg(512,512,block(C.amber,C.paper,C.ink));
  if(role==='object-block-t') return svg(512,512,block(C.purple,C.paper,C.ink));
  if(role==='object-block-s') return svg(512,512,block(C.mint,C.paper,C.ink));
  if(role==='object-block-z') return svg(512,512,block(C.coral,C.paper,C.ink));
  if(role==='object-block-j') return svg(512,512,block(C.blue,C.paper,C.ink));
  if(role==='object-block-l') return svg(512,512,block(C.orange,C.paper,C.ink));
  if(role==='object-block-ghost') return svg(512,512,
    `<rect x="56" y="56" width="400" height="400" rx="36" fill="${C.cream}" fill-opacity=".3" stroke="${C.ink}" stroke-width="12" stroke-dasharray="24 16"/>`+
    `<rect x="110" y="110" width="292" height="292" rx="20" fill="none" stroke="${C.shade}" stroke-width="8" stroke-dasharray="16 12" opacity=".6"/>`
  );
  if(role==='object-block-garbage') return svg(512,512,
    `<rect x="56" y="56" width="400" height="400" rx="36" fill="${C.steel}" ${stroke(C.ink,16)}/>`+
    `<path d="M80 180l252-100m-212 252l252-100m-212 252l252-100" fill="none" ${stroke(C.shade,10)}/>`+
    `<circle cx="120" cy="120" r="16" fill="${C.coral}" ${stroke(C.ink,6)}/>`+
    `<circle cx="392" cy="392" r="16" fill="${C.coral}" ${stroke(C.ink,6)}/>`
  );
  if(role==='object-well-frame') return svg(512,512,
    `<rect x="46" y="36" width="420" height="440" rx="24" fill="none" ${stroke(C.ink,18)}/>`+
    `<rect x="66" y="56" width="380" height="400" rx="16" fill="none" stroke="${C.cream}" stroke-width="10"/>`
  );
  if(role==='object-next-frame') return svg(512,512,
    `<rect x="56" y="56" width="400" height="400" rx="32" fill="${C.cream}" ${stroke(C.ink,14)}/>`+
    `<path d="M120 70h272" stroke="${C.amber}" stroke-width="12" stroke-linecap="round"/>`
  );
  if(role==='object-hold-frame') return svg(512,512,
    `<rect x="56" y="56" width="400" height="400" rx="32" fill="${C.cream}" ${stroke(C.ink,14)}/>`+
    `<path d="M120 70h272" stroke="${C.teal}" stroke-width="12" stroke-linecap="round"/>`
  );
  return svg(512,512,'');
}

function vfxSvg(role){
  if(role==='vfx-line-clear') return svg(512,512,
    `<rect x="36" y="216" width="440" height="80" rx="20" fill="${C.amber}" ${stroke(C.ink,12)}/>`+
    `<path d="M16 256h480" stroke="${C.paper}" stroke-width="18" stroke-linecap="round"/>`+
    `<circle cx="256" cy="256" r="48" fill="${C.coral}" ${stroke(C.ink,8)}/>`+
    `<path d="M80 180 120 220M432 180 392 220M80 332 120 292M432 332 392 292" ${stroke(C.amber,12)}/>`
  );
  if(role==='vfx-hard-drop') return svg(512,512,
    `<ellipse cx="256" cy="380" rx="190" ry="70" fill="none" ${stroke(C.ink,14)}/>`+
    `<ellipse cx="256" cy="380" rx="130" ry="46" fill="none" stroke="${C.teal}" stroke-width="10"/>`+
    `<path d="M160 80v240M256 40v300M352 80v240" fill="none" ${stroke(C.paper,16)}/>`+
    `<path d="M160 80v240M256 40v300M352 80v240" fill="none" stroke="${C.ink}" stroke-width="8" stroke-dasharray="24 16"/>`
  );
  if(role==='vfx-t-spin') return svg(512,512,
    `<circle cx="256" cy="256" r="160" fill="none" ${stroke(C.purple,24)}/>`+
    `<path d="M256 70 310 190 440 210 340 300 370 430 256 360 142 430 172 300 72 210 202 190Z" fill="${C.amber}" ${stroke(C.ink,12)}/>`+
    `<circle cx="256" cy="256" r="44" fill="${C.paper}" ${stroke(C.ink,8)}/>`
  );
  if(role==='vfx-b2b') return svg(512,512,
    `<polygon points="256,40 460,256 256,472 52,256" fill="${C.amber}" ${stroke(C.ink,14)}/>`+
    `<polygon points="256,80 420,256 256,432 92,256" fill="${C.coral}" ${stroke(C.paper,8)}/>`+
    `<path d="M220 160h72l-40 80h50l-80 120 20-80h-42z" fill="${C.paper}" ${stroke(C.ink,10)}/>`
  );
  if(role==='vfx-combo') return svg(512,512,
    `<circle cx="256" cy="256" r="160" fill="${C.cream}" ${stroke(C.ink,14)}/>`+
    `<path d="M256 60 286 186 416 156 320 246 416 336 286 326 256 452 226 326 96 336 192 246 96 156 226 186Z" fill="${C.coral}" ${stroke(C.ink,10)}/>`+
    `<circle cx="256" cy="256" r="54" fill="${C.amber}" ${stroke(C.ink,8)}/>`
  );
  if(role==='vfx-perfect-clear') return svg(512,512,
    `<circle cx="256" cy="256" r="180" fill="none" ${stroke(C.amber,28)}/>`+
    `<polygon points="256,40 316,160 450,170 350,260 380,390 256,330 132,390 162,260 62,170 196,160" fill="${C.paper}" ${stroke(C.ink,12)}/>`+
    `<circle cx="256" cy="256" r="60" fill="${C.teal}" ${stroke(C.ink,8)}/>`
  );
  if(role==='vfx-incoming-garbage') return svg(512,512,
    `<polygon points="256,50 470,430 42,430" fill="${C.coral}" ${stroke(C.ink,16)}/>`+
    `<polygon points="256,120 420,400 92,400" fill="${C.amber}" ${stroke(C.paper,8)}/>`+
    `<rect x="236" y="200" width="40" height="110" rx="16" fill="${C.ink}"/>`+
    `<circle cx="256" cy="350" r="20" fill="${C.ink}"/>`
  );
  if(role==='vfx-ko') return svg(512,512,
    `<path d="M256 50 300 160 416 120 360 230 470 270 360 310 416 420 300 380 256 490 212 380 96 420 152 310 42 270 152 230 96 120 212 160Z" fill="${C.coral}" ${stroke(C.ink,14)}/>`+
    `<circle cx="256" cy="270" r="100" fill="${C.paper}" ${stroke(C.ink,10)}/>`+
    `<text x="256" y="295" text-anchor="middle" fill="${C.ink}" font-size="72" font-family="sans-serif" font-weight="900">KO</text>`
  );
  return svg(512,512,'');
}

function boardSvg(role){
  if(role==='board-background') return arenaBackground();
  if(role==='board-midground') return arenaMidground();
  if(role==='board-foreground') return arenaForeground();
  return svg(1056,720,'');
}

function cameraSvg(role){
  const mobile=role==='camera-mobile',w=mobile?720:960,h=mobile?960:720;
  return svg(w,h,
    `<rect x="${mobile?42:56}" y="${mobile?42:54}" width="${mobile?636:848}" height="${mobile?876:612}" rx="38" fill="${C.cream}" ${stroke(C.ink,12)}/>`+
    `<rect x="${mobile?90:138}" y="${mobile?170:112}" width="${mobile?540:684}" height="${mobile?620:490}" rx="28" fill="${C.paper}" ${stroke(C.teal,8)}/>`
  );
}

function spec(role){
  if(BOARD_ROLES.includes(role)) return [boardSvg(role),1056,720,false];
  if(OBJECT_ROLES.includes(role)||VFX_ROLES.includes(role)) return [OBJECT_ROLES.includes(role)?objectSvg(role):vfxSvg(role),512,512,true];
  return [cameraSvg(role),role==='camera-mobile'?720:960,role==='camera-mobile'?960:720,false];
}

async function main(){
  const lock = acquireArtGeneratorLock(path.join(ROOT,'.tmp/art-generator-locks/tetris-final-runtime-v1.lock'),{generatorId:'tetris-final-runtime-v1',waitMs:120000});
  try {
    ensure(SOURCE_ROOT);
    ensure(REVIEW_ROOT);
    ensure(RUNTIME_ROOT);
    const sources=[],variants=[];
    const allRoles=[...BOARD_ROLES,...OBJECT_ROLES,...VFX_ROLES,...CAMERA_ROLES];
    for(const role of allRoles){
      const [content,width,height,alpha]=spec(role);
      const sourceFile=path.join(SOURCE_ROOT,role+'-v1.svg');
      write(sourceFile,content+'\n');
      const sourceHash=digest(sourceFile);
      sources.push({
        role,
        path:rel(sourceFile),
        ...sourceHash,
        width,
        height,
        alpha,
        kind:role.startsWith('board-')?'layer':role.startsWith('object-')?'object':role.startsWith('vfx-')?'semantic-vfx':'camera'
      });
      for(const mode of ['','-static']){
        const key=role+mode;
        const runtimeFile=path.join(RUNTIME_ROOT,key+'-v1.webp');
        await sharp(Buffer.from(content)).webp({quality:92,alphaQuality:100,effort:3}).toFile(runtimeFile);
        const runtimeHash=digest(runtimeFile);
        variants.push({role:key,path:rel(runtimeFile),...runtimeHash,width,height,alpha});
      }
    }

    const reviewRoles=[...BOARD_ROLES,...OBJECT_ROLES,...VFX_ROLES];
    const comps=[];
    for(let i=0;i<reviewRoles.length;i++){
      const [content]=spec(reviewRoles[i]);
      const img=await sharp(Buffer.from(content)).resize(140,140,{fit:'contain',background:C.paper}).png().toBuffer();
      comps.push({input:img,left:(i%8)*130+6,top:Math.floor(i/8)*150+6});
    }
    const reviewFile=path.join(REVIEW_ROOT,'tetris-final-runtime-contact-sheet-v1.png');
    await sharp({create:{width:1060,height:Math.ceil(reviewRoles.length/8)*150+12,channels:4,background:C.paper}})
      .composite(comps)
      .png({compressionLevel:6})
      .toFile(reviewFile);
    const reviewHash=digest(reviewFile);
    const total=variants.reduce((sum,item)=>sum+item.bytes,0);

    const family={
      schemaVersion:1,
      productionUnitId:'P1-03',
      familyId:FAMILY_ID,
      sourceAssetId:SOURCE_ID,
      artworkVersion:1,
      status:'OWNER_AUTHORIZED_ART_CLEARANCE',
      license:'project-owned-deterministic-svg-sharp',
      runtimeStrategy:'Vanilla DOM + CSS + Canvas + GSAP 2.5D; no GLB/Three dependency',
      sourceOnlyInputs:{
        cover:'art-source/games/tetris/mg_tetris_cover_source_v02.png',
        wellSurface:'art-source/games/tetris/well_surface_master.png',
        externalInfluence:'task-scoped semantic-only reference lane; no external pixels in runtime'
      },
      sources,
      variants,
      reviewBoards:[{path:rel(reviewFile),...reviewHash,width:1060,height:Math.ceil(reviewRoles.length/8)*150+12}],
      featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},
      metrics:{
        sourceMasterCount:sources.length,
        runtimeVariantCount:variants.length,
        runtimeBytes:total,
        runtimeByteBudget:6*1024*1024,
        withinBudget:total<=6*1024*1024,
        boardLayerCount:3,
        objectAtomCount:OBJECT_ROLES.length,
        semanticVfxCount:VFX_ROLES.length,
        cameraPresetCount:CAMERA_ROLES.length
      },
      authorityBoundary:'presentation-only; TetrisRules v3, Protocol, Snapshot, KO, score, 7-Bag, Hold, Next and controls remain authoritative live DOM/Rules',
      fallback:{chain:'Tetris final art -> Tabletop Wave A paper well and CSS fallback'},
      release:'LOCAL_ONLY_NOT_RELEASED',
      externalReferenceContext:{
        status:'SOURCE_ONLY_EXTERNAL_INFLUENCED',
        license:'EXTERNAL_REFERENCE_ONLY / blocked-license',
        transmissionRecord:'art-source/games/tetris/final-art-v1/EXTERNAL_REFERENCE_TRANSMISSION.json',
        runtimeBoundary:'No blocked-license pixel, layer, silhouette, palette, text or icon enters runtime.'
      }
    };
    write(FAMILY_MANIFEST,JSON.stringify(family,null,2)+'\n');

    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
    manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==FAMILY_ID);
    const paths=Object.fromEntries(variants.map(item=>[item.role,item.path]));
    const hashes=Object.fromEntries(variants.map(item=>[item.role,'sha256:'+item.sha256.toLowerCase()]));
    const bytes=Object.fromEntries(variants.map(item=>[item.role,item.bytes]));
    manifest.assets.push({
      asset_id:FAMILY_ID,
      runtime_id:'tetris',
      artwork_version:1,
      runtime_path:paths['board-background'],
      variants:paths,
      status:'ready',
      clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',
      source_asset_id:SOURCE_ID,
      feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},
      fallback_asset_id:'G-11-TETRIS-CSS-FALLBACK',
      fallback:'existing Tetris DOM/CSS/Tabletop arena and Emoji fallback',
      load:'lazy layered board; decode each layer before activation; remove nodes on game destroy; reduced-motion selects -static variants',
      a11y:'decorative well layers, block textures and VFX aria-hidden; live score, KO, rank, controls and player names remain DOM/i18n',
      license:'project-owned-deterministic-svg-sharp',
      source:'art-source/games/tetris/final-art-v1/runtime-source',
      clearance_record:'art-source/games/tetris/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',
      variant_integrity:hashes,
      variant_bytes:bytes,
      actual_bytes:total,
      byte_budget:6*1024*1024,
      review_boards:[rel(reviewFile)]
    });
    fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n');

    // Also update asset-library/catalog.json
    const catalogPath = path.join(ROOT, 'asset-library/catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      catalog.assets = catalog.assets.filter(a => a && a.id !== FAMILY_ID);
      catalog.assets.push({
        id: FAMILY_ID,
        category: 'game/tetris/final-art',
        assetType: 'tetris-final-board-object-vfx-runtime-owner-cleared',
        sourceType: 'project-owned',
        sourcePath: 'art-source/games/tetris/final-art-v1/runtime-source/board-background-v1.svg',
        sourceSha256: sources[0].sha256.toLowerCase(),
        license: 'project-owned-deterministic-svg-sharp',
        author: 'OpenAI Codex for Ghost Game',
        status: 'integrated-local-only',
        dimensions: { width: 1056, height: 720 },
        previewPath: 'art-source/games/tetris/final-art-v1/review/tetris-final-runtime-contact-sheet-v1.png',
        previewSha256: reviewHash.sha256.toLowerCase(),
        runtimePaths: variants.map(v => v.path),
        promptPath: 'art-source/games/tetris/final-art-v1/PROMPT_AND_PROVENANCE.md',
        model: 'deterministic-local-svg-sharp',
        remoteObjectKey: null
      });
      const manifestIndex = catalog.indexes && catalog.indexes.find(idx => idx && idx.id === 'production-asset-manifest');
      if (manifestIndex) {
        manifestIndex.sha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex').toLowerCase();
      }
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
    }

    console.log(`TETRIS_FINAL_RUNTIME_OK sourceMasters=${sources.length} runtimeVariants=${variants.length} runtimeBytes=${total}`);
  } finally {
    lock();
  }
}

main().catch(error=>{
  console.error(error&&error.stack||error);
  process.exitCode=1;
});
