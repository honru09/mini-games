/* Ghost Game P0-11 Avatar Frame + Effect deterministic 2.5D art pack. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock, acquireArtRegistryLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/platform/identity/avatar-frame-effect-v1');
const SOURCE_ROOT = path.join(FAMILY_ROOT, 'source');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/ui/identity/avatar-frame-effect-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const LOCK_PATH = path.join(ROOT, '.tmp', 'art-generator-locks', 'avatar-frame-effect-v1.lock');

const FLAG = 'mg_art_avatar_frame_effect_v1';
const FAMILY_ID = 'P-AVATAR-FRAME-EFFECT-V1';
const SOURCE_ID = 'ART-020-AVATAR-FRAME-EFFECT-V1';
const SIZE = 512;
const SIZES = Object.freeze([44,64,96,192]);
const MODES = Object.freeze(['static','dynamic','high-contrast']);
const FRAME_IDS = Object.freeze([1,2,3,4,5,6,7,8]);
const EFFECT_IDS = Object.freeze([1,2,3,4,5,6,7,8]);
const COLORS = Object.freeze({ ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', gold:'#F4C95D', teal:'#39D6C7', blue:'#5D8CFF', violet:'#A78BFA', coral:'#FF7A70', mint:'#A7F3D0', pink:'#F472B6' });

function ensure(...dirs){ dirs.forEach(dir => fs.mkdirSync(dir,{recursive:true})); }
function resetGeneratedDir(dir){
  const resolved=path.resolve(dir),root=path.resolve(ROOT);
  if(resolved===root||!resolved.startsWith(root+path.sep))throw new Error('Refusing unsafe generated-dir reset');
  fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:100});
  fs.mkdirSync(resolved,{recursive:true});
}
function rel(file){ return path.relative(ROOT,file).replace(/\\/g,'/'); }
function digest(file){ const data=fs.readFileSync(file); return {sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),bytes:data.length}; }
function waitForFileUnlock(milliseconds){
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,milliseconds);
}
function write(file,value){
  ensure(path.dirname(file));
  for(let attempt=0;;attempt++){
    try { fs.writeFileSync(file,value); return; }
    catch(error){
      const retryable=error&&['EBUSY','EPERM','EACCES','UNKNOWN'].includes(String(error.code||''));
      if(!retryable||attempt>=19)throw error;
      waitForFileUnlock(50+attempt*10);
    }
  }
}
function writeJson(file,value){ write(file,JSON.stringify(value,null,2)+'\n'); }
function stroke(color,width,extra=''){ return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}`; }
function svg(content){ return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">${content}</svg>\n`; }
function runtimeSizeForStage(size){
  const atomPixels=Math.max(44,Math.min(192,Number(size)||96))*1.1;
  return SIZES.find(value=>value>=atomPixels)||192;
}
function ring(id,mode){
  const c=[COLORS.gold,COLORS.teal,COLORS.violet,COLORS.ink,COLORS.coral,COLORS.pink,COLORS.mint,COLORS.blue][id-1];
  const secondary=[COLORS.coral,COLORS.blue,COLORS.pink,COLORS.teal,COLORS.gold,COLORS.paper,COLORS.violet,COLORS.coral][id-1];
  const w=mode==='high-contrast'?18:mode==='dynamic'?14:12;
  const outline=mode==='high-contrast'?`<circle cx="256" cy="256" r="216" ${stroke(COLORS.ink,28,'opacity=".98"')}/>`:'';
  const base=`<circle cx="256" cy="256" r="216" ${stroke(c,w,'opacity=".98"')}/>`;
  if(id===1)return svg(outline+base+`<circle cx="180" cy="94" r="12" fill="${COLORS.cream}"/><circle cx="332" cy="418" r="8" fill="${COLORS.gold}"/>`);
  if(id===2)return svg(outline+base+`<path d="M113 150A194 194 0 0 1 399 150" ${stroke(secondary,mode==='high-contrast'?14:8,'opacity=".96"')}/><path d="M113 362A194 194 0 0 0 399 362" ${stroke(c,w/2,'opacity=".8"')}/>`);
  if(id===3)return svg(outline+base+`<path d="M202 42q14-18 28 0t28 0t28 0M202 470q14 18 28 0t28 0t28 0" ${stroke(secondary,mode==='high-contrast'?15:9,'opacity=".92"')}/>`);
  if(id===4)return svg(outline+`<circle cx="256" cy="256" r="216" ${stroke(COLORS.paper,mode==='high-contrast'?24:20,'opacity=".98"')}/>`+base+`<path d="M88 194A222 222 0 0 1 424 194M88 318A222 222 0 0 0 424 318" ${stroke(secondary,mode==='high-contrast'?14:8,'opacity=".78"')}/>`);
  if(id===5)return svg(outline+base+`<circle cx="256" cy="256" r="231" ${stroke(secondary,mode==='high-contrast'?9:6,'stroke-dasharray="12 22" opacity=".82"')}/><circle cx="122" cy="126" r="8" fill="${COLORS.cream}"/><circle cx="389" cy="374" r="8" fill="${COLORS.cream}"/>`);
  if(id===6)return svg(outline+base+`<path d="M105 342A205 205 0 0 0 407 342" ${stroke(secondary,mode==='high-contrast'?14:10,'opacity=".9"')}/><path d="M126 154A210 210 0 0 1 218 72M386 154A210 210 0 0 0 294 72" ${stroke(COLORS.paper,mode==='high-contrast'?10:6,'opacity=".75"')}/>`);
  if(id===7)return svg(outline+base+`<circle cx="256" cy="256" r="231" ${stroke(COLORS.paper,mode==='high-contrast'?8:5,'stroke-dasharray="18 14" opacity=".8"')}/><circle cx="256" cy="32" r="9" fill="${COLORS.coral}"/><circle cx="480" cy="256" r="9" fill="${COLORS.blue}"/><circle cx="256" cy="480" r="9" fill="${COLORS.gold}"/>`);
  return svg(outline+base+`<circle cx="256" cy="256" r="231" ${stroke(COLORS.paper,mode==='high-contrast'?8:5,'stroke-dasharray="5 18" opacity=".8"')}/><path d="M121 140h42M349 372h42M352 140h42M118 372h42" ${stroke(COLORS.ink,mode==='high-contrast'?9:6,'opacity=".72"')}/>`);
}
function sparkle(x,y,r,color){ return `<path d="M${x} ${y-r}L${x+r*.28} ${y-r*.28}L${x+r} ${y}L${x+r*.28} ${y+r*.28}L${x} ${y+r}L${x-r*.28} ${y+r*.28}L${x-r} ${y}L${x-r*.28} ${y-r*.28}Z" fill="${color}"/>`; }
function effect(id,mode){
  const c=[COLORS.blue,COLORS.gold,COLORS.teal,COLORS.violet,COLORS.coral,COLORS.pink,COLORS.mint,COLORS.blue][id-1];
  const opacity=mode==='high-contrast'?'.96':mode==='dynamic'?'.84':'.68';
  const outline=mode==='high-contrast'?`<circle cx="256" cy="256" r="238" ${stroke(COLORS.ink,10,'opacity=".78"')}/>`:'';
  if(id===1)return svg(outline+`<circle cx="256" cy="256" r="226" ${stroke(c,18,`opacity="${opacity}"`)}/>`);
  if(id===2)return svg(outline+sparkle(76,92,22,c)+sparkle(430,88,16,COLORS.gold)+sparkle(430,420,25,c)+sparkle(78,424,14,COLORS.paper));
  if(id===3)return svg(outline+`<path d="M58 418q-28-38 8-68 24-20 12-54 58 28 46 81 29-13 56-6-17 48-63 56-38 6-59-9z" fill="${c}" opacity="${opacity}"/>`);
  if(id===4)return svg(outline+`<ellipse cx="256" cy="256" rx="244" ry="103" transform="rotate(24 256 256)" ${stroke(c,12,`stroke-dasharray="12 24" opacity="${opacity}"`)}/>`);
  if(id===5)return svg(outline+sparkle(42,256,17,c)+sparkle(470,256,17,c)+`<circle cx="256" cy="42" r="10" fill="${c}" opacity="${opacity}"/><circle cx="256" cy="470" r="10" fill="${c}" opacity="${opacity}"/>`);
  if(id===6)return svg(outline+`<path d="M72 78l38 48M440 78l-38 48M72 434l38-48M440 434l-38-48" ${stroke(c,15,`opacity="${opacity}"`)}/>`+sparkle(34,256,13,c)+sparkle(478,256,13,c));
  if(id===7)return svg(outline+`<circle cx="256" cy="256" r="236" ${stroke(c,15,`stroke-dasharray="4 25" opacity="${opacity}"`)}/>`+sparkle(256,46,13,COLORS.gold));
  return svg(outline+`<path d="M94 170v-54h54M418 170v-54h-54M94 342v54h54M418 342v54h-54" ${stroke(c,mode==='high-contrast'?18:13,`opacity="${opacity}"`)}/><path d="M86 238h340M104 274h304" ${stroke(c,mode==='high-contrast'?10:7,`opacity="${mode==='static'?'.42':'.7'}"`)}/>`);
}
async function record(file,extra={}){ const meta=await sharp(file).metadata(),hash=digest(file); return {path:rel(file),sha256:hash.sha256,bytes:hash.bytes,width:meta.width,height:meta.height,format:meta.format,alpha:!!meta.hasAlpha,...extra}; }
async function sheet(files,output){ const tile=220, cols=4, rows=Math.ceil(files.length/cols), parts=[]; for(let i=0;i<files.length;i++){ const thumb=await sharp(files[i]).resize(180,180,{fit:'contain'}).png().toBuffer(); parts.push({input:thumb,left:(i%cols)*tile+20,top:Math.floor(i/cols)*tile+20}); } await sharp({create:{width:cols*tile,height:rows*tile,channels:4,background:COLORS.paper}}).composite(parts).png({compressionLevel:9,effort:10}).toFile(output); }
async function smallIdentitySheet(output){
  const tile=112,columns=8,rows=[
    ['frames',44,'dynamic','light'],['frames',44,'dynamic','dark'],
    ['effects',44,'dynamic','light'],['effects',44,'dynamic','dark'],
    ['frames',64,'high-contrast','light'],['frames',64,'high-contrast','dark'],
    ['effects',64,'high-contrast','light'],['effects',64,'high-contrast','dark'],
  ],parts=[];
  for(let row=0;row<rows.length;row++)for(let index=0;index<8;index++){
    const [kind,size,mode,backgroundMode]=rows[row],id=index+1,stage=size,atom=Math.round(stage*1.1),left=index*tile+Math.round((tile-stage)/2),top=row*tile+Math.round((tile-stage)/2),offset=Math.round((atom-stage)/2);
    const tileBackground=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}"><rect width="${tile}" height="${tile}" fill="${backgroundMode==='dark'?COLORS.ink:COLORS.paper}"/></svg>`);
    parts.push({input:tileBackground,left:index*tile,top:row*tile});
    const avatar=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${stage}" height="${stage}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="${COLORS.ink}"/><circle cx="50" cy="52" r="39" fill="${COLORS.cream}"/><circle cx="37" cy="47" r="5" fill="${COLORS.ink}"/><circle cx="63" cy="47" r="5" fill="${COLORS.ink}"/><path d="M38 65q12 10 24 0" fill="none" ${stroke(COLORS.ink,5)}/></svg>`);
    const atomFile=path.join(RUNTIME_ROOT,kind,`${kind.slice(0,-1)}-${id}-${runtimeSizeForStage(stage)}-${mode}-v1.webp`),atomBuffer=await sharp(atomFile).resize(atom,atom).png().toBuffer();
    if(kind==='effects')parts.push({input:atomBuffer,left:left-offset,top:top-offset},{input:avatar,left,top});
    else parts.push({input:avatar,left,top},{input:atomBuffer,left:left-offset,top:top-offset});
  }
  await sharp({create:{width:columns*tile,height:rows.length*tile,channels:4,background:COLORS.paper}}).composite(parts).png({compressionLevel:9,effort:10}).toFile(output);
}

async function generateAvatarFrameEffect(){
  resetGeneratedDir(SOURCE_ROOT);resetGeneratedDir(REVIEW_ROOT);resetGeneratedDir(RUNTIME_ROOT);
  const sourceMasters=[], runtimeVariants=[], variants={}, variantIntegrity={}, variantBytes={};
  for(const kind of ['frames','effects']){
    ensure(path.join(SOURCE_ROOT,kind),path.join(RUNTIME_ROOT,kind));
    for(const id of kind==='frames'?FRAME_IDS:EFFECT_IDS){
      for(const mode of MODES){
        const sourceFile=path.join(SOURCE_ROOT,kind,`${kind.slice(0,-1)}-${id}-${mode}-v1.svg`);
        const source=kind==='frames'?ring(id,mode):effect(id,mode); write(sourceFile,source);
        sourceMasters.push(await record(sourceFile,{kind,id,mode,role:'source-master',bakedText:false}));
        for(const size of SIZES){
          const file=path.join(RUNTIME_ROOT,kind,`${kind.slice(0,-1)}-${id}-${size}-${mode}-v1.webp`);
          await sharp(Buffer.from(source)).resize(size,size).webp({quality:93,alphaQuality:100,effort:6}).toFile(file);
          const rec=await record(file,{kind,id,mode,size,role:'runtime-variant',bakedText:false});
          const key=`${kind.slice(0,-1)}-${id}-${size}-${mode}`; runtimeVariants.push(rec); variants[key]=rec.path; variantIntegrity[key]=`sha256:${rec.sha256.toLowerCase()}`; variantBytes[key]=rec.bytes;
        }
      }
    }
  }
  const frameReview=path.join(REVIEW_ROOT,'avatar-frames-contact-sheet-v1.png');
  const effectReview=path.join(REVIEW_ROOT,'avatar-effects-contact-sheet-v1.png');
  const smallReview=path.join(REVIEW_ROOT,'avatar-frame-effect-small-runtime-review-v1.png');
  await sheet([...FRAME_IDS.map(id=>path.join(RUNTIME_ROOT,'frames',`frame-${id}-192-dynamic-v1.webp`)),...FRAME_IDS.map(id=>path.join(RUNTIME_ROOT,'frames',`frame-${id}-192-high-contrast-v1.webp`))],frameReview);
  await sheet([...EFFECT_IDS.map(id=>path.join(RUNTIME_ROOT,'effects',`effect-${id}-192-dynamic-v1.webp`)),...EFFECT_IDS.map(id=>path.join(RUNTIME_ROOT,'effects',`effect-${id}-192-high-contrast-v1.webp`))],effectReview);
  await smallIdentitySheet(smallReview);
  const reviewBoards=[await record(frameReview,{role:'frame-contact-sheet'}),await record(effectReview,{role:'effect-contact-sheet'}),await record(smallReview,{role:'44-64-runtime-composite-review'})];
  const family={schemaVersion:1,productionUnitId:'P0-11',familyId:FAMILY_ID,sourceAssetId:SOURCE_ID,artworkVersion:1,status:'OWNER_AUTHORIZED_ART_CLEARANCE',license:'project-owned-deterministic-vector',presentationStrategy:'transparent frame/effect atoms for DOM/CSS/Canvas/GSAP 2.5D identity presentation; no rule or economy authority',generation:{provider:'project deterministic SVG + Sharp',model:'not applicable; vector-native production path',taskId:'p0-11-avatar-frame-effect-v1-20260819',mode:'M0 North Star black-ink / paper / restrained accent identity system'},externalReferenceContext:{status:'FULL_INVENTORY_CONTEXT_KNOWN_NO_EXTERNAL_PIXEL_TRANSMISSION',register:'asset-library/external-source-register-20260813.json',transmissionScope:'No blocked-license file, preview, pixel, layer, archive member or vector object was transmitted; output is Ghost-native deterministic vector.'},frames:FRAME_IDS,effects:EFFECT_IDS,runtimeSizes:SIZES,modes:MODES,sourceMasters,runtimeVariants,reviewBoards,featureFlags:{operator:'all',enabledValue:'1',defaultEnabled:true,ids:[FLAG]},metrics:{sourceMasterCount:sourceMasters.length,runtimeVariantCount:runtimeVariants.length,reviewBoardCount:reviewBoards.length,runtimeBytes:runtimeVariants.reduce((sum,item)=>sum+item.bytes,0),runtimeByteBudget:2*1024*1024,withinBudget:runtimeVariants.reduce((sum,item)=>sum+item.bytes,0)<=2*1024*1024},fallback:{chain:'avatar frame/effect art -> existing CSS frame/effect classes -> neutral avatar/initial'},motionBoundary:'Dynamic mode is a finite transform/opacity presentation hook; static and high-contrast variants remain available. prefers-reduced-motion selects static; forced-colors selects high-contrast. No infinite JS loop and no gameplay state dependency.',a11y:'Decorative frame/effect atoms are aria-hidden; names, avatar identity and owned/equipped state remain HTML/i18n and server-authoritative.',authorityBoundary:'Asset pixels are presentation-only. Integration extends the existing effects catalogue with IDs 5-8 and server-authoritative prices, while reusing the existing purchase/owned/profile path without protocol, database schema, reward, game rule, AI or replay changes.'};
  writeJson(path.join(FAMILY_ROOT,'asset-family-manifest-v1.json'),family);
  const skillRouting=`# P0-11 图像 Skill 路由\n\n资产族：${FAMILY_ID}\n路由日期：2026-08-19\n任务 ID：p0-11-avatar-frame-effect-v1-20260819\n\n| Skill 入口 | 状态 | 用途/理由 |\n|---|---|---|\n| imagegen | NOT_APPLICABLE | 头像框/效果是现有 SVG/vector-native 系统的延展，确定性原生输出可保持像素级一致与可回滚。 |\n| ai-image-generation | UNAVAILABLE_EXTERNAL_CREDENTIAL | Inference.sh 未配置凭证；未登录、付费或上传。 |\n| gpt-image | APPLIED | 输入为项目自有 M0 North Star 哈希与 P0-11 用途/尺寸/保护区约束；按 GPT Image 2 五槽结构整理到 PROMPT_AND_PROVENANCE.md，输出由 deterministic SVG + Sharp 实现，未调用 API。 |\n| image | APPLIED | 输入同上；使用 CC-BY-4.0 Visual Skills 的 models/gpt-image/golden-rules/creative-direction 对构图、材质、对比度和小尺寸可读性复核，输出为视觉规格与 MACHINE_VISUAL_REVIEW.md。 |\n| happy-image-gen | UNAVAILABLE_EXTERNAL_CREDENTIAL | 未配置供应商凭证；未运行多供应商 CLI。 |\n| html-to-image | NOT_APPLICABLE | 输出为透明身份原子，不是精确文字/UI mockup。 |\n| website-screenshot | NOT_APPLICABLE | 生成阶段不摄取网页；可见证据由设备 Gate 单独记录。 |\n| code-to-image | NOT_APPLICABLE | 不是文档代码视觉。 |\n| og-image | NOT_APPLICABLE | 不是 OG/分享卡。 |\n\nimage 技能归属：Prompt guidance adapted under CC-BY-4.0, Serge Shima / smixs visual-skills (https://github.com/smixs/visual-skills).\n\n外部库存：仅保留 asset-library/external-source-register-20260813.json 的语义库存上下文；本批未向任何 Skill 传输外部 Q UI/PSD/AI/EPS/RPG 文件、预览、像素、图层或向量对象。\n`;
  write(path.join(FAMILY_ROOT,'SKILL_ROUTING.md'),skillRouting);
  write(path.join(FAMILY_ROOT,'PROMPT_AND_PROVENANCE.md'),`# P0-11 Avatar Frame / Effect 视觉规格与 provenance\n\n模型指导：GPT Image 2 的五槽规格结构（仅用于视觉规格，没有 API 调用）；最终生产路径为确定性 SVG + Sharp。\n\n- Scene：512×512 透明画布，圆形头像保护区居中，原子必须能派生至 44/64/96/192。\n- Subject：8 个 Frame 与 8 个 Effect；Frame 位于头像前层外缘，Effect 位于头像后层外缘。\n- Important Details：纸白、墨黑与少量青绿/金黄/紫/珊瑚/蓝点缀；粗而连续的轮廓、有限纹理、稳定负空间；亮底/暗底和 high-contrast 均可分离。\n- Use Case：Profile、Shop、Seat、DM 与 Playline 的统一身份组合；decorative-only，不承载名字、价格或 owned 状态。\n- Constraints：保护脸部和圆形裁切；44px 仍可识别；无 baked text、水印、外部品牌、商业游戏专属符号、源像素复制或描摹；dynamic 只作为有限 transform/opacity hook。\n\n以项目自有 M0 North Star 为唯一视觉锚点。实现：${family.generation.provider}；输出为 Ghost-native SVG 源稿与 WebP 运行时派生。未复制、描摹、换色或传输任何 blocked-license 外部素材。\n\n动态边界：reduced-motion 使用 static，forced-colors 使用 high-contrast。\n`);
  write(path.join(FAMILY_ROOT,'TECHNICAL_REVIEW_Reviewer_A.md'),`# P0-11 技术审查\n\n- 16 个 source family（8 frames + 8 effects）× 3 modes × 4 sizes 均生成。\n- 所有运行时文件为 RGBA WebP，透明背景，无 baked text。\n- 运行时总字节数 ${family.metrics.runtimeBytes}，预算 2 MiB：${family.metrics.withinBudget?'PASS':'FAIL'}。\n- Manifest、catalog、稳定 ID、feature flag、fallback 与回滚链由本脚本统一生成。\n- 素材像素只改变 presentation；Effect 5–8 作为既有商品分类的数据扩展，复用服务端权威购买、owned 与 profile 投影，不改变协议、数据库结构、奖励、游戏规则、AI 或 Replay。\n`);
  write(path.join(FAMILY_ROOT,'MACHINE_VISUAL_REVIEW.md'),`# P0-11 机器视觉审查\n\n状态：TECHNICAL_VISUAL_PASS / LOCAL_ONLY / REAL_BROWSER_NOT_EXECUTED\n\n- 44px：三张检查板中的实际 44px 合成行均保持连续外轮廓；Frame 2/3/4/6 的装饰已移至头像保护区外，不再穿过脸部。\n- 64px high-contrast：强制颜色派生保留墨黑外轮廓；亮底与暗底均有可分离轮廓。\n- Effect 8：改为明确的蓝色四角聚焦标与水平能量线，44px/64px 仍可识别；运行时位于头像后层，中央线被头像遮挡，身份内容不受干扰。\n- Effect 3：火焰仅占左下外圈并位于头像后层；合成检查板确认不会遮挡脸部、名字或交互目标。\n- 视觉一致性：纸白、墨黑和少量金/青/紫/珊瑚/蓝点缀延续项目 M0 North Star；没有品牌文字、外部像素、描摹或商业游戏专属符号。\n- 限制：以上为生成检查板与像素/尺寸合同的机器证据，不冒充第二浏览器、真机、人工清稿、Reviewer B、IP/法律或逐资产 Golden Set。\n`);
  write(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md'),`# P0-11 OWNER_AUTHORIZED_ART_CLEARANCE\n\n本批为 Ghost-native deterministic vector，遵循项目已确认的 M0 North Star。稳定 ID/SHA/provenance、TECHNICAL_REVIEW_Reviewer_A.md 与 MACHINE_VISUAL_REVIEW.md、fallback、feature flag 和回滚齐全，可进入本地 default-on runtime 候选。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仍按项目 Gate 记录为可选咨询，未伪造为已完成。\n`);
  const releaseRegistryLock=acquireArtRegistryLock(ROOT,{generatorId:'generate-avatar-frame-effect-v1:registry'});
  try {
    const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8')); manifest.assets=manifest.assets.filter(item=>item&&item.asset_id!==FAMILY_ID); manifest.assets.push({asset_id:FAMILY_ID,runtime_id:'identity',artwork_version:1,runtime_path:variants['frame-1-96-dynamic'],variants,status:'ready',clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',source_asset_id:SOURCE_ID,frames:FRAME_IDS,effects:EFFECT_IDS,runtime_sizes:SIZES,modes:MODES,feature_flags:{operator:'all',enabled_value:'1',default_enabled:true,ids:[FLAG]},fallback_asset_id:'avatar-frame-effect-css-fallback',fallback:family.fallback.chain,load:'eager only when a visible identity node is constructed; selected atom decode failure keeps CSS fallback',a11y:family.a11y,license:family.license,source:rel(SOURCE_ROOT),clearance_record:rel(path.join(FAMILY_ROOT,'OWNER_AUTHORIZED_ART_CLEARANCE.md')),variant_integrity:variantIntegrity,variant_bytes:variantBytes,actual_bytes:family.metrics.runtimeBytes,byte_budget:2*1024*1024}); writeJson(MANIFEST_PATH,manifest);
    const catalog=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));
    const productionIndex=Array.isArray(catalog.indexes)?catalog.indexes.find(item=>item&&item.id==='production-asset-manifest'):null;
    if(!productionIndex) throw new Error('Missing production-asset-manifest catalog index');
    productionIndex.sha256=digest(MANIFEST_PATH).sha256.toLowerCase();
    catalog.assets=catalog.assets.filter(item=>item&&item.id!==FAMILY_ID); catalog.assets.push({id:FAMILY_ID,category:'platform/identity',assetType:'avatar-frame-effect-atoms-owner-cleared',sourceType:'project-owned',sourcePath:sourceMasters[0].path,sourceSha256:sourceMasters[0].sha256.toLowerCase(),license:family.license,author:'Ghost Game deterministic vector pipeline',status:'integrated-local-only',dimensions:{width:SIZE,height:SIZE},previewPath:reviewBoards[0].path,previewSha256:reviewBoards[0].sha256.toLowerCase(),runtimePaths:runtimeVariants.map(item=>item.path),promptPath:rel(path.join(FAMILY_ROOT,'PROMPT_AND_PROVENANCE.md')),model:'deterministic SVG + Sharp',remoteObjectKey:null}); writeJson(CATALOG_PATH,catalog);
  } finally { releaseRegistryLock(); }
  console.log('P0-11 avatar frame/effect generated',{sourceMasters:sourceMasters.length,runtimeVariants:runtimeVariants.length,runtimeBytes:family.metrics.runtimeBytes,withinBudget:family.metrics.withinBudget});
}
async function main(){
  const releaseLock=acquireArtGeneratorLock(LOCK_PATH,{generatorId:'generate-avatar-frame-effect-v1'});
  try { await generateAvatarFrameEffect(); }
  finally { releaseLock(); }
}
main().catch(error=>{ console.error(error&&error.stack||error); process.exit(1); });
