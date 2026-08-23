'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/platform/profile-adaptive-hero-v1');
const SOURCE_PATH = path.join(FAMILY_ROOT, 'source/profile-adaptive-hero-master-v1.png');
const REVIEW_PATH = path.join(FAMILY_ROOT, 'review/profile-adaptive-hero-contact-sheet-v1.png');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/profile-adaptive-hero-v1');
const FAMILY_MANIFEST_PATH = path.join(FAMILY_ROOT, 'asset-family-manifest-v1.json');
const GLOBAL_MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const FAMILY_ID = 'P-PROFILE-ADAPTIVE-HERO-V1';
const SOURCE_ID = 'ART-PROFILE-ADAPTIVE-HERO-V1';
const FLAG = 'mg_art_profile_adaptive_hero_v1';
const CLEARANCE_RECORD = 'art-source/platform/profile-adaptive-hero-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const VARIANTS = Object.freeze([
  { role:'desktop', file:'profile-adaptive-hero-desktop-v1.webp', width:1200, height:800, quality:88 },
  { role:'mobile', file:'profile-adaptive-hero-mobile-v1.webp', width:720, height:720, quality:88 },
  { role:'poster', file:'profile-adaptive-hero-poster-v1.webp', width:600, height:400, quality:86 },
  { role:'static', file:'profile-adaptive-hero-static-v1.webp', width:1200, height:800, quality:84 },
]);
function ensure(dir){ fs.mkdirSync(dir,{recursive:true}); }
function write(file,body){ ensure(path.dirname(file)); fs.writeFileSync(file,body); }
function rel(file){ return path.relative(ROOT,file).replace(/\\/g,'/'); }
function digest(file){ const body=fs.readFileSync(file); return {bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex').toUpperCase()}; }

async function generate(){
  const releaseLock=acquireArtGeneratorLock(FAMILY_ID);
  try{
    if(!fs.existsSync(SOURCE_PATH))throw new Error(`Missing source master: ${SOURCE_PATH}`);
    ensure(RUNTIME_ROOT);ensure(path.dirname(REVIEW_PATH));
    const sourceMeta=await sharp(SOURCE_PATH).metadata();
    if(sourceMeta.width!==1536||sourceMeta.height!==1024)throw new Error('Source master must remain 1536x1024');
    for(const variant of VARIANTS){
      await sharp(SOURCE_PATH).resize(variant.width,variant.height,{fit:'cover',position:'centre'}).webp({quality:variant.quality,effort:6}).toFile(path.join(RUNTIME_ROOT,variant.file));
    }
    const desktop=await sharp(path.join(RUNTIME_ROOT,VARIANTS[0].file)).resize(900,600).toBuffer();
    const poster=await sharp(path.join(RUNTIME_ROOT,VARIANTS[2].file)).resize(450,300).toBuffer();
    const mobile=await sharp(path.join(RUNTIME_ROOT,VARIANTS[1].file)).resize(360,360).toBuffer();
    await sharp({create:{width:1200,height:980,channels:4,background:'#11182F'}}).composite([
      {input:desktop,left:20,top:20},{input:poster,left:20,top:650},{input:mobile,left:820,top:620},
    ]).png().toFile(REVIEW_PATH);
    const sourceDigest=digest(SOURCE_PATH);
    const runtimeFiles=VARIANTS.map(variant=>{const file=path.join(RUNTIME_ROOT,variant.file);return {path:rel(file),...digest(file),width:variant.width,height:variant.height,alpha:false};});
    const reviewDigest=digest(REVIEW_PATH),runtimeBytes=runtimeFiles.reduce((sum,item)=>sum+item.bytes,0);
    const family={schemaVersion:1,productionUnitId:'P2-12',familyId:FAMILY_ID,sourceAssetId:SOURCE_ID,artworkVersion:1,status:'implemented_local_release_evidence_pending',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',sourceLicense:'PROJECT_OWNED_AI_GENERATED',featureFlag:{id:FLAG,enabledValue:'1',defaultEnabled:true,rollback:'0'},source:{path:rel(SOURCE_PATH),...sourceDigest,width:1536,height:1024,alpha:false},runtimeFiles,reviewFiles:[{path:rel(REVIEW_PATH),...reviewDigest,width:1200,height:980}],runtimeBytes,runtimeByteBudget:1048576,externalReferenceInputs:0,thirdPartyTransmissions:0,authorityBoundary:'presentation-only profile hero backdrop that reacts to local service-authoritative play history; no profile mutation, entitlement, reward, ranking, protocol, realtime, analytics or Supabase write',fallback:'existing profile CSS gradient, profile identity HTML and game icon fallback',releaseState:'LOCAL_ONLY_NOT_RELEASED'};
    write(FAMILY_MANIFEST_PATH,JSON.stringify(family,null,2)+'\n');
    const globalManifest=JSON.parse(fs.readFileSync(GLOBAL_MANIFEST_PATH,'utf8'));
    globalManifest.assets=(globalManifest.assets||[]).filter(item=>item.asset_id!==FAMILY_ID);
    globalManifest.assets.push({asset_id:FAMILY_ID,runtime_id:'platform',artwork_version:1,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,clearance_record:CLEARANCE_RECORD,feature_flags:{operator:'all',ids:[FLAG],enabled_value:'1',default_enabled:true},variants:Object.fromEntries(VARIANTS.map((variant,index)=>[variant.role,runtimeFiles[index].path])),hashes:Object.fromEntries(VARIANTS.map((variant,index)=>[variant.role,`sha256:${runtimeFiles[index].sha256.toLowerCase()}`])),total_bytes:runtimeBytes});
    write(GLOBAL_MANIFEST_PATH,JSON.stringify(globalManifest,null,2)+'\n');
    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));
    catalog.assets=(catalog.assets||[]).filter(item=>item.id!==FAMILY_ID&&item.familyId!==FAMILY_ID);
    catalog.assets.push({id:FAMILY_ID,category:'platform/profile',assetType:'profile-adaptive-hero-art-owner-cleared',sourceType:'project-owned',sourcePath:rel(SOURCE_PATH),sourceSha256:sourceDigest.sha256.toLowerCase(),license:'project-owned-ai-generated',author:'OpenAI Codex for Ghost Game',status:'integrated-local-only',dimensions:{width:1536,height:1024},previewPath:rel(REVIEW_PATH),previewSha256:reviewDigest.sha256.toLowerCase(),runtimePaths:runtimeFiles.map(item=>item.path),promptPath:'art-source/platform/profile-adaptive-hero-v1/PROMPT_AND_PROVENANCE.md',model:'host-managed-imagegen-gpt-image-2',remoteObjectKey:null});
    const productionIndex=(catalog.indexes||[]).find(item=>item.id==='production-asset-manifest');if(productionIndex)productionIndex.sha256=digest(GLOBAL_MANIFEST_PATH).sha256.toLowerCase();
    write(CATALOG_PATH,JSON.stringify(catalog,null,2)+'\n');
    console.log(`${FAMILY_ID}_GENERATED runtime=${runtimeFiles.length} bytes=${runtimeBytes}`);
  }finally{releaseLock();}
}
if(require.main===module)generate().catch(error=>{console.error(error);process.exit(1);});
module.exports={generate,FAMILY_ID,SOURCE_ID,FLAG,VARIANTS};
