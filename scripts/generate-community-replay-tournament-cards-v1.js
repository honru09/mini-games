'use strict';

// Deterministic Ghost-native share-card art.  The cards are art-only surfaces:
// localized copy, player names, scores and replay facts stay live DOM data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/community-replay-tournament-cards-v1');
const SOURCE_DIR = path.join(SOURCE_ROOT, 'runtime-source');
const REVIEW_DIR = path.join(SOURCE_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/community-replay-tournament-cards-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const FAMILY_MANIFEST = path.join(SOURCE_ROOT, 'asset-family-manifest-v1.json');

const FAMILY_ID = 'P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const SOURCE_ID = 'ART-042-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const FLAG = 'mg_art_community_replay_tournament_cards_v1';

const CARD_ROLES = ['card-playline','card-replay','card-tournament','card-result','card-record','frame-og'];
const MARK_ROLES = ['mark-playline','mark-replay','mark-tournament','mark-share'];
const CAMERA_ROLES = ['camera-desktop','camera-mobile'];
const ALL_ROLES = [...CARD_ROLES, ...MARK_ROLES, ...CAMERA_ROLES];

const C = Object.freeze({
  ink:'#0a1020', night:'#111d3b', navy:'#182c55', cream:'#f5f1e8', cyan:'#5ce1e6',
  teal:'#18a6a8', violet:'#9b7bff', purple:'#5b4cce', coral:'#ff7a77', gold:'#f7c969',
  mint:'#a6f3d3', white:'#ffffff', line:'rgba(245,241,232,.42)'
});

function ensure(dir){ fs.mkdirSync(dir,{recursive:true}); }
function write(file,data){ ensure(path.dirname(file)); fs.writeFileSync(file,data); }
function rel(file){ return path.relative(ROOT,file).split(path.sep).join('/'); }
function digest(file){ const b=fs.readFileSync(file); return {sha256:crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),bytes:b.length}; }
function svg(width,height,body){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`;
}
function defs(){
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.ink}"/><stop offset=".52" stop-color="${C.navy}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.teal}"/></linearGradient>
    <linearGradient id="violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.violet}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.coral}"/><stop offset="1" stop-color="${C.gold}"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" stroke="${C.white}" stroke-opacity=".07"/></pattern>
  </defs>`;
}
function cardBase(kind, accent, extra=''){
  return `${defs()}<rect width="1200" height="630" rx="40" fill="url(#bg)"/><rect width="1200" height="630" rx="40" fill="url(#grid)"/>
    <circle cx="1000" cy="70" r="220" fill="${accent}" fill-opacity=".2" filter="url(#soft)"/>
    <circle cx="170" cy="585" r="190" fill="${C.cyan}" fill-opacity=".11" filter="url(#soft)"/>
    <path d="M0 500 C250 390 390 610 640 490 S1010 350 1200 440" stroke="${accent}" stroke-opacity=".28" stroke-width="3"/>
    <rect x="36" y="36" width="1128" height="558" rx="30" stroke="${C.cream}" stroke-opacity=".24" stroke-width="2"/>
    <g opacity=".8">${extra}</g>`;
}
function buildSvg(role){
  if (role === 'card-playline') return svg(1200,630,cardBase('playline',C.cyan,`
    <path d="M700 118h330v78H700z" fill="${C.cyan}" fill-opacity=".12" stroke="${C.cyan}" stroke-opacity=".58"/>
    <path d="M760 240h270v58H760z" fill="${C.violet}" fill-opacity=".14" stroke="${C.violet}" stroke-opacity=".6"/>
    <path d="M720 340h310v72H720z" fill="${C.coral}" fill-opacity=".12" stroke="${C.coral}" stroke-opacity=".55"/>
    <circle cx="108" cy="116" r="42" fill="${C.cyan}" fill-opacity=".18" stroke="${C.cyan}" stroke-width="3"/>
    <path d="M84 116h48M108 92v48" stroke="${C.cream}" stroke-width="7" stroke-linecap="round"/>
    <path d="M70 470 C250 420 350 468 502 402" stroke="${C.cream}" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>
    <circle cx="250" cy="432" r="11" fill="${C.gold}"/><circle cx="360" cy="447" r="11" fill="${C.coral}"/><circle cx="470" cy="414" r="11" fill="${C.cyan}"/>`));
  if (role === 'card-replay') return svg(1200,630,cardBase('replay',C.violet,`
    <rect x="92" y="118" width="500" height="326" rx="28" fill="${C.ink}" fill-opacity=".45" stroke="${C.violet}" stroke-opacity=".78" stroke-width="3"/>
    <path d="M144 366 C222 290 260 404 338 320 S468 280 542 210" stroke="${C.cyan}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <circle cx="144" cy="366" r="13" fill="${C.cyan}"/><circle cx="338" cy="320" r="13" fill="${C.gold}"/><circle cx="542" cy="210" r="13" fill="${C.coral}"/>
    <circle cx="340" cy="280" r="68" fill="${C.violet}" fill-opacity=".3" stroke="${C.cream}" stroke-opacity=".8" stroke-width="3"/>
    <path d="M322 244l56 36-56 36z" fill="${C.cream}"/>
    <path d="M710 172h330M710 220h240M710 268h290" stroke="${C.cream}" stroke-opacity=".38" stroke-width="12" stroke-linecap="round"/>
    <path d="M710 390h360" stroke="${C.violet}" stroke-width="8" stroke-linecap="round"/>`));
  if (role === 'card-tournament') return svg(1200,630,cardBase('tournament',C.coral,`
    <path d="M168 160h270M303 160v70M303 230H188M303 230h115M188 230v82M418 230v82" stroke="${C.gold}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="168" cy="160" r="24" fill="${C.cyan}"/><circle cx="438" cy="160" r="24" fill="${C.violet}"/>
    <circle cx="188" cy="326" r="24" fill="${C.coral}"/><circle cx="418" cy="326" r="24" fill="${C.mint}"/>
    <path d="M303 230v138" stroke="${C.cream}" stroke-opacity=".62" stroke-width="10"/><circle cx="303" cy="394" r="30" fill="${C.gold}" stroke="${C.cream}" stroke-width="5"/>
    <path d="M730 142l45 86h-90zM860 142l45 86h-90zM990 142l45 86h-90z" fill="${C.coral}" fill-opacity=".22" stroke="${C.coral}" stroke-width="3"/>
    <path d="M710 352h340M710 410h260" stroke="${C.cream}" stroke-opacity=".38" stroke-width="13" stroke-linecap="round"/>`));
  if (role === 'card-result') return svg(1200,630,cardBase('result',C.mint,`
    <rect x="92" y="124" width="1000" height="320" rx="28" fill="${C.ink}" fill-opacity=".42" stroke="${C.mint}" stroke-opacity=".62" stroke-width="3"/>
    <path d="M160 198h330M160 260h260M160 322h300" stroke="${C.cream}" stroke-opacity=".38" stroke-width="14" stroke-linecap="round"/>
    <path d="M650 176h352M650 244h280M650 312h320" stroke="${C.mint}" stroke-opacity=".56" stroke-width="15" stroke-linecap="round"/>
    <circle cx="1000" cy="398" r="42" fill="${C.gold}" fill-opacity=".9"/><path d="M980 398l16 16 28-34" stroke="${C.ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`));
  if (role === 'card-record') return svg(1200,630,cardBase('record',C.violet,`
    <circle cx="270" cy="290" r="142" fill="${C.violet}" fill-opacity=".16" stroke="${C.violet}" stroke-width="4"/>
    <circle cx="270" cy="290" r="94" fill="${C.cyan}" fill-opacity=".16" stroke="${C.cyan}" stroke-width="4"/>
    <circle cx="270" cy="290" r="46" fill="${C.coral}" fill-opacity=".52" stroke="${C.cream}" stroke-width="4"/>
    <path d="M530 184h520M530 252h430M530 320h480M530 388h350" stroke="${C.cream}" stroke-opacity=".42" stroke-width="13" stroke-linecap="round"/>
    <path d="M900 470h180" stroke="${C.gold}" stroke-width="12" stroke-linecap="round"/>`));
  if (role === 'frame-og') return svg(1200,630,`${defs()}<rect x="12" y="12" width="1176" height="606" rx="48" stroke="${C.cream}" stroke-opacity=".72" stroke-width="10"/><rect x="30" y="30" width="1140" height="570" rx="38" stroke="${C.cyan}" stroke-opacity=".38" stroke-width="2" stroke-dasharray="14 18"/><path d="M68 120h160M972 510h160" stroke="${C.coral}" stroke-width="8" stroke-linecap="round"/>`);
  if (role === 'mark-playline') return svg(256,256,`${defs()}<circle cx="128" cy="128" r="92" fill="url(#cyan)" fill-opacity=".2" stroke="${C.cyan}" stroke-width="7"/><path d="M72 128h112M128 72v112" stroke="${C.cream}" stroke-width="16" stroke-linecap="round"/><circle cx="82" cy="82" r="10" fill="${C.gold}"/><circle cx="174" cy="174" r="10" fill="${C.coral}"/>`);
  if (role === 'mark-replay') return svg(256,256,`${defs()}<circle cx="128" cy="128" r="92" fill="url(#violet)" fill-opacity=".25" stroke="${C.violet}" stroke-width="7"/><path d="M112 82l72 46-72 46z" fill="${C.cream}"/><path d="M74 76a78 78 0 1 0 0 104" fill="none" stroke="${C.cyan}" stroke-width="10" stroke-linecap="round"/>`);
  if (role === 'mark-tournament') return svg(256,256,`${defs()}<path d="M56 76h144M128 76v56M128 132H76M128 132h52M76 132v48M180 132v48" stroke="${C.gold}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="56" cy="76" r="18" fill="${C.cyan}"/><circle cx="200" cy="76" r="18" fill="${C.violet}"/><circle cx="76" cy="192" r="18" fill="${C.coral}"/><circle cx="180" cy="192" r="18" fill="${C.mint}"/><circle cx="128" cy="132" r="18" fill="${C.cream}"/>`);
  if (role === 'mark-share') return svg(256,256,`${defs()}<circle cx="128" cy="128" r="92" fill="url(#warm)" fill-opacity=".24" stroke="${C.gold}" stroke-width="7"/><circle cx="82" cy="128" r="24" fill="${C.cyan}"/><circle cx="174" cy="82" r="24" fill="${C.violet}"/><circle cx="174" cy="174" r="24" fill="${C.coral}"/><path d="M102 116l52-26M102 140l52 26" stroke="${C.cream}" stroke-width="10" stroke-linecap="round"/>`);
  return svg(1,1,'<rect width="1" height="1" fill="none"/>');
}

function dimensions(role){
  if (role.startsWith('card-') || role === 'frame-og') return {width:1200,height:630};
  if (role.startsWith('mark-')) return {width:256,height:256};
  return {width:1,height:1};
}

async function generateAll(){
  const lock = acquireArtGeneratorLock('P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1');
  try {
    ensure(SOURCE_DIR); ensure(REVIEW_DIR); ensure(RUNTIME_ROOT);
    for (const role of ALL_ROLES) write(path.join(SOURCE_DIR, role+'.svg'), buildSvg(role));
    for (const role of ALL_ROLES){
      const d=dimensions(role), src=fs.readFileSync(path.join(SOURCE_DIR,role+'.svg'));
      await sharp(src).resize(d.width,d.height,{fit:'contain'}).webp({quality:90}).toFile(path.join(RUNTIME_ROOT,role+'.webp'));
      await sharp(src).resize(d.width,d.height,{fit:'contain'}).webp({quality:84}).toFile(path.join(RUNTIME_ROOT,role+'-static.webp'));
    }
    const samples=ALL_ROLES.map(role=>path.join(RUNTIME_ROOT,role+'.webp'));
    const comps=[]; for(let i=0;i<samples.length;i++){const b=await sharp(samples[i]).resize(280,150,{fit:'contain',background:{r:10,g:16,b:32,alpha:1}}).png().toBuffer();comps.push({input:b,left:(i%4)*300+10,top:Math.floor(i/4)*175+12});}
    await sharp({create:{width:1220,height:700,channels:4,background:{r:10,g:16,b:32,alpha:1}}}).composite(comps).png().toFile(path.join(REVIEW_DIR,'community-replay-tournament-cards-contact-sheet-v1.png'));
    write(path.join(REVIEW_DIR,'og-card-template.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;width:1200px;height:630px;background:#0a1020;color:#f5f1e8;font:800 54px system-ui;display:grid;place-items:center}.card{width:1128px;height:558px;border:2px solid rgba(245,241,232,.24);border-radius:30px;padding:36px;box-sizing:border-box;background:linear-gradient(135deg,#0a1020,#182c55 52%,#5b4cce);position:relative;overflow:hidden}.kicker{font-size:20px;letter-spacing:.18em;color:#5ce1e6}.headline{margin-top:42px;max-width:780px}.sub{margin-top:24px;font-size:24px;color:#a6f3d3}.mark{position:absolute;right:62px;bottom:48px;width:170px;height:170px;border:3px solid rgba(245,241,232,.4);border-radius:50%;display:grid;place-items:center;color:#f7c969}</style><main class="card"><div class="kicker">GHOST GAME · SHARE CARD</div><div class="headline">{{localized headline}}</div><div class="sub">{{live replay / tournament / result facts}}</div><div class="mark">PLAY</div></main>`);

    const sourceMasters=ALL_ROLES.map(role=>{const p=path.join(SOURCE_DIR,role+'.svg'),d=digest(p),m=dimensions(role);return {role,path:rel(p),sha256:d.sha256,bytes:d.bytes,width:m.width,height:m.height,alpha:true};});
    const runtimeVariants=[]; const variants={}; const variantBytes={};
    for(const role of ALL_ROLES){for(const variant of ['normal','static']){const suffix=variant==='static'?'-static':'';const p=path.join(RUNTIME_ROOT,role+suffix+'.webp'),d=digest(p),m=dimensions(role),key=role+(variant==='static'?'-static':'');const rp=rel(p);runtimeVariants.push({role,variant,path:rp,sha256:d.sha256,bytes:d.bytes,width:m.width,height:m.height,alpha:true});variants[key]=rp;variantBytes[key]=d.bytes;}}
    const totalRuntimeBytes=runtimeVariants.reduce((sum,v)=>sum+v.bytes,0);
    write(FAMILY_MANIFEST,JSON.stringify({familyId:FAMILY_ID,sourceId:SOURCE_ID,flag:FLAG,generatedAt:new Date().toISOString(),sourceMastersCount:sourceMasters.length,runtimeVariantsCount:runtimeVariants.length,totalRuntimeBytes,byteBudget:2*1024*1024,sourceMasters,runtimeVariants,reviewBoards:[rel(path.join(REVIEW_DIR,'community-replay-tournament-cards-contact-sheet-v1.png'))],htmlCssFallback:rel(path.join(REVIEW_DIR,'og-card-template.html'))},null,2));

    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8')); manifest.assets=(manifest.assets||[]).filter(a=>a.asset_id!==FAMILY_ID); manifest.assets.push({asset_id:FAMILY_ID,runtime_id:'platform',artwork_version:1,runtime_path:variants['card-playline'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'community-replay-tournament-cards-css-fallback',fallback:'existing Playline/Replay/Tournament DOM cards and localized text',load:'lazy decorative card art; reduced-motion selects -static variants; no rule data baked into pixels',a11y:'decorative art is aria-hidden; localized titles, names, results and controls remain live DOM',license:'project-owned-deterministic-svg-sharp',source:rel(SOURCE_DIR),clearance_record:rel(path.join(SOURCE_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),variant_integrity:Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,'sha256:'+digest(path.join(ROOT,v)).sha256.toLowerCase()])),variant_bytes:variantBytes,actual_bytes:totalRuntimeBytes,byte_budget:2*1024*1024,review_boards:[rel(path.join(REVIEW_DIR,'community-replay-tournament-cards-contact-sheet-v1.png'))]});
    write(MANIFEST_PATH,JSON.stringify(manifest,null,2));
    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8')); catalog.assets=(catalog.assets||[]).filter(a=>a.id!==FAMILY_ID&&a.familyId!==FAMILY_ID); const preview=path.join(REVIEW_DIR,'community-replay-tournament-cards-contact-sheet-v1.png'),first=sourceMasters[0]; catalog.assets.push({id:FAMILY_ID,category:'platform/community/replay-tournament-cards',assetType:'community-replay-tournament-og-card-runtime-owner-cleared',sourceType:'project-owned',sourcePath:first.path,sourceSha256:first.sha256.toLowerCase(),license:'project-owned-deterministic-vector',author:'OpenAI Codex for Ghost Game',status:'integrated-local-only',dimensions:{width:1200,height:630},previewPath:rel(preview),previewSha256:digest(preview).sha256.toLowerCase(),runtimePaths:runtimeVariants.map(v=>v.path),promptPath:'art-source/platform/community-replay-tournament-cards-v1/PROMPT_AND_PROVENANCE.md',model:null,remoteObjectKey:null}); const idx=(catalog.indexes||[]).find(i=>i.id==='production-asset-manifest'); if(idx)idx.sha256=digest(MANIFEST_PATH).sha256.toLowerCase(); write(CATALOG_PATH,JSON.stringify(catalog,null,2));
    console.log(`[${FAMILY_ID}] generated ${sourceMasters.length} SVG masters, ${runtimeVariants.length} WebP variants, ${totalRuntimeBytes} bytes`);
  } finally { lock(); }
}
if(require.main===module)generateAll().catch(error=>{console.error(error);process.exit(1);});
module.exports={generateAll,FAMILY_ID,SOURCE_ID,FLAG,ALL_ROLES};
