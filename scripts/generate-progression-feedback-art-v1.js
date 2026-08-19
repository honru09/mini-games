/* Ghost Game P0-09 progression feedback art derivatives. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/platform/progression/feedback-v1');
const AI_MASTER = path.join(FAMILY_ROOT, 'source/ai/progression-feedback-atlas-master-v1.png');
const GCOINS_MASTER = path.join(ROOT, 'public/assets/ui/currency/gcoins-v1/gcoins-icon-192-v1.png');
const SOURCE_ATOMS = path.join(FAMILY_ROOT, 'derived/atoms');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/ui/progression/feedback-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');

const GENERATED_IDS = Object.freeze(['xp','level-up','task','achievement','win-streak','collection','unlock','reward']);
const IDS = Object.freeze(['reward','gcoins','xp','level-up','task','achievement','win-streak','collection','unlock']);
const SIZES = Object.freeze([96,160,256]);
const FLAG = 'mg_art_progression_feedback_v1';
const COLORS = Object.freeze({ paper:'#FFF9F2', cream:'#F3E5C4', ink:'#211923' });

function ensure(...dirs){ dirs.forEach(dir => fs.mkdirSync(dir, { recursive:true })); }
function rel(file){ return path.relative(ROOT, file).replace(/\\/g, '/'); }
function digest(file){ const data=fs.readFileSync(file); return { sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(), bytes:data.length }; }
function writeJson(file,value){ ensure(path.dirname(file)); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n'); }

async function record(file,extra={}){
  const meta=await sharp(file).metadata(),hash=digest(file);
  return { path:rel(file),sha256:hash.sha256,bytes:hash.bytes,width:meta.width,height:meta.height,format:meta.format,alpha:!!meta.hasAlpha,...extra };
}

async function centerTransparent(input,size,contentSize){
  const trimmed=await sharp(input).trim({ background:{ r:0,g:0,b:0,alpha:0 },threshold:2 }).png().toBuffer();
  const fitted=await sharp(trimmed).resize(contentSize,contentSize,{ fit:'inside',withoutEnlargement:false }).png().toBuffer();
  const meta=await sharp(fitted).metadata();
  return sharp({ create:{ width:size,height:size,channels:4,background:{ r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input:fitted,left:Math.round((size-meta.width)/2),top:Math.round((size-meta.height)/2) }])
    .png({ compressionLevel:9,effort:10 }).toBuffer();
}

async function generatedAtomBuffer(id,index,masterMeta){
  const column=index%4,row=Math.floor(index/4);
  const left=Math.round(column*masterMeta.width/4),right=Math.round((column+1)*masterMeta.width/4);
  const top=Math.round(row*masterMeta.height/2),bottom=Math.round((row+1)*masterMeta.height/2);
  const cell=await sharp(AI_MASTER).extract({ left,top,width:right-left,height:bottom-top }).png().toBuffer();
  return centerTransparent(cell,512,438);
}

async function gcoinsAtomBuffer(){
  const icon=await sharp(GCOINS_MASTER).resize(318,318,{ fit:'contain' }).png().toBuffer();
  const shadow=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><ellipse cx="256" cy="414" rx="126" ry="27" fill="${COLORS.ink}" opacity=".16"/></svg>`);
  return sharp({ create:{ width:512,height:512,channels:4,background:{ r:0,g:0,b:0,alpha:0 } } })
    .composite([{ input:shadow,left:0,top:0 },{ input:icon,left:97,top:74 }])
    .png({ compressionLevel:9,effort:10 }).toBuffer();
}

async function makeReviewBoard(atomFiles,output){
  const tile=360,parts=[];
  for(let index=0;index<atomFiles.length;index++){
    const image=await sharp(atomFiles[index]).resize(286,286,{ fit:'contain' }).png().toBuffer();
    parts.push({ input:image,left:(index%3)*tile+37,top:Math.floor(index/3)*tile+37 });
  }
  await sharp({ create:{ width:1080,height:1080,channels:4,background:COLORS.paper } })
    .composite(parts).png({ compressionLevel:9,effort:10 }).toFile(output);
}

async function main(){
  if(!fs.existsSync(AI_MASTER)||!fs.existsSync(GCOINS_MASTER))throw new Error('Missing progression AI master or approved G Coins source');
  ensure(SOURCE_ATOMS,REVIEW_ROOT,RUNTIME_ROOT);
  const masterMeta=await sharp(AI_MASTER).metadata();
  if(masterMeta.width!==1672||masterMeta.height!==941||!masterMeta.hasAlpha)throw new Error('Unexpected progression AI master identity');

  const sourceRecords=[],sourceFiles=new Map();
  for(let index=0;index<GENERATED_IDS.length;index++){
    const id=GENERATED_IDS[index],file=path.join(SOURCE_ATOMS,`progression-${id}-atom-v1.png`);
    fs.writeFileSync(file,await generatedAtomBuffer(id,index,masterMeta));
    sourceFiles.set(id,file);
    sourceRecords.push(await record(file,{ id,method:'deterministic crop/trim/center from project-generated AI atlas',bakedText:false }));
  }
  const gcoinsFile=path.join(SOURCE_ATOMS,'progression-gcoins-atom-v1.png');
  fs.writeFileSync(gcoinsFile,await gcoinsAtomBuffer());
  sourceFiles.set('gcoins',gcoinsFile);
  sourceRecords.push(await record(gcoinsFile,{ id:'gcoins',method:'deterministic composition from approved P-GCOINS-ICON-V1; identity pixels preserved',bakedText:false }));

  const runtimeRecords=[],variants={},variantIntegrity={},variantBytes={};
  for(const id of IDS){
    const input=sourceFiles.get(id);
    for(const size of SIZES){
      const file=path.join(RUNTIME_ROOT,`${id}-${size}-v1.webp`),key=`${id}-${size}`;
      await sharp(input).resize(size,size,{ fit:'contain' }).webp({ quality:91,alphaQuality:100,effort:6 }).toFile(file);
      const item=await record(file,{ id,size,bakedText:false });runtimeRecords.push(item);
      variants[key]=item.path;variantIntegrity[key]=`sha256:${item.sha256.toLowerCase()}`;variantBytes[key]=item.bytes;
    }
  }

  const review=path.join(REVIEW_ROOT,'progression-feedback-contact-sheet-v1.png');
  await makeReviewBoard(IDS.map(id=>sourceFiles.get(id)),review);
  const reviewRecord=await record(review,{ role:'family-contact-sheet' });
  const aiMasterRecord=await record(AI_MASTER,{ role:'imagegen-source-atlas',taskId:'exec-d58f44a9-b320-4f24-bf04-c312f8c0d285' });
  const gcoinsRecord=await record(GCOINS_MASTER,{ role:'approved-gcoins-identity-source' });
  const runtimeBytes=runtimeRecords.reduce((sum,item)=>sum+item.bytes,0);
  const family={
    schemaVersion:1,productionUnitId:'P0-09',familyId:'P-PROGRESSION-FEEDBACK-ART-V1',sourceAssetId:'ART-PROGRESSION-FEEDBACK-ART-V1',artworkVersion:1,
    status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-ai-generated-and-deterministically-derived',
    presentationStrategy:'2.5D-first transparent foreground atoms for DOM/CSS/Canvas/GSAP; no GLB or Three dependency',
    generation:{ provider:'OpenAI Codex built-in imagegen',model:'built-in model not exposed by tool',taskId:'exec-d58f44a9-b320-4f24-bf04-c312f8c0d285',mode:'stylized-concept transparent atom atlas',aiMaster:aiMasterRecord,gcoinsSource:gcoinsRecord },
    externalReferencePolicy:'No EXTERNAL_REFERENCE_ONLY / blocked-license file, preview, pixel or layer was used or transmitted. Inputs were project-owned North Star boards and the owner-cleared G Coins icon only.',
    semanticIds:IDS,sizes:SIZES,sourceAtoms:sourceRecords,runtimeVariants:runtimeRecords,reviewBoards:[reviewRecord],
    featureFlags:{ operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG] },
    metrics:{ sourceMasterCount:2,sourceAtomCount:sourceRecords.length,runtimeVariantCount:runtimeRecords.length,reviewBoardCount:1,runtimeBytes,runtimeByteBudget:2*1024*1024,withinBudget:runtimeBytes<=2*1024*1024 },
    fallback:{ chain:'P0-09 atom -> P-MODAL-ILLUSTRATION-V1 / P-GCOINS-ICON-V1 -> CSS shape / localized text / Unicode' },
    motionBoundary:'Assets are static atoms. Existing finite GhostSurfaceMotion/GSAP adapters own transform/autoAlpha timelines and cleanup; reduced motion keeps the same static semantic image.',
    a11y:'All images are decorative and contain no baked text. Reward values, task progress, achievement state, collection state and localized labels remain HTML text.',
    authorityBoundary:'Presentation only. No Reward Resolver, economy, XP, level, achievement, task, collection, protocol, replay, persistence or analytics facts are created or changed.',
  };
  writeJson(path.join(FAMILY_ROOT,'asset-family-manifest-v1.json'),family);

  const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
  manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==family.familyId);
  manifest.assets.push({
    asset_id:family.familyId,runtime_id:'platform',artwork_version:1,runtime_path:variants['reward-160'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:family.sourceAssetId,
    feature_flags:{ operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG] },fallback_asset_id:'P-MODAL-ILLUSTRATION-V1',fallback:family.fallback.chain,
    load:'lazy by visible reward/progression surface; decode before activation',a11y:family.a11y,license:family.license,source:rel(SOURCE_ATOMS),clearance_record:rel(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),
    variant_integrity:variantIntegrity,variant_bytes:variantBytes,actual_bytes:runtimeBytes,byte_budget:2*1024*1024,
  });
  writeJson(MANIFEST_PATH,manifest);

  const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));
  catalog.assets=catalog.assets.filter(item=>item&&item.id!==family.familyId);
  catalog.assets.push({
    id:family.familyId,category:'platform/progression-feedback',assetType:'reward-progression-runtime-owner-cleared',sourceType:'project-owned',sourcePath:aiMasterRecord.path,sourceSha256:aiMasterRecord.sha256.toLowerCase(),license:family.license,
    author:'OpenAI Codex for Ghost Game',status:'integrated-local-only',dimensions:{ width:masterMeta.width,height:masterMeta.height },previewPath:reviewRecord.path,previewSha256:reviewRecord.sha256.toLowerCase(),runtimePaths:runtimeRecords.map(item=>item.path),
    promptPath:rel(path.join(FAMILY_ROOT,'PROMPT_AND_PROVENANCE.md')),model:'OpenAI Codex built-in imagegen + deterministic Sharp derivatives',remoteObjectKey:null,
  });
  writeJson(CATALOG_PATH,catalog);
  console.log('P0-09 progression feedback generated',{ sourceAtoms:sourceRecords.length,runtimeVariants:runtimeRecords.length,runtimeBytes,withinBudget:runtimeBytes<=2*1024*1024 });
}

main().catch(error=>{ console.error(error&&error.stack||error);process.exit(1); });
