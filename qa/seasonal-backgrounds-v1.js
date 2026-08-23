const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const FAMILY='P-SEASONAL-BACKGROUNDS-V1',FLAG='mg_art_seasonal_backgrounds_v1';
const SOURCE=path.join(ROOT,'art-source/platform/backgrounds/seasonal-v1');
const RUNTIME=path.join(ROOT,'public/assets/backgrounds/seasonal-v1');
let failures=0,checks=0;
function check(ok,label){checks++;if(ok)console.log('PASS  '+label);else{failures++;console.error('FAIL  '+label);}}
function read(relative){return fs.readFileSync(path.join(ROOT,relative),'utf8');}
function json(relative){return JSON.parse(read(relative));}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function pngInfo(file){const b=fs.readFileSync(file);return b.length>=24&&b.toString('ascii',1,4)==='PNG'?{width:b.readUInt32BE(16),height:b.readUInt32BE(20)}:null;}
function webpInfo(file){
  const b=fs.readFileSync(file);if(b.length<16||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')return null;
  let o=12,width=0,height=0,animated=false;
  while(o+8<=b.length){const type=b.toString('ascii',o,o+4),size=b.readUInt32LE(o+4),d=o+8;if(d+size>b.length)break;
    if(type==='VP8X'&&size>=10){animated=!!(b[d]&2);width=1+b[d+4]+(b[d+5]<<8)+(b[d+6]<<16);height=1+b[d+7]+(b[d+8]<<8)+(b[d+9]<<16);}
    if(type==='VP8 '&&size>=10&&b[d+3]===0x9d&&b[d+4]===0x01&&b[d+5]===0x2a){width=b.readUInt16LE(d+6)&0x3fff;height=b.readUInt16LE(d+8)&0x3fff;}
    if(type==='VP8L'&&size>=5&&b[d]===0x2f){const bits=b.readUInt32LE(d+1);width=(bits&0x3fff)+1;height=((bits>>14)&0x3fff)+1;}
    if(type==='ANIM')animated=true;o=d+size+(size%2);
  }return{width,height,animated,bytes:b.length};
}

const family=json('art-source/platform/backgrounds/seasonal-v1/asset-family-manifest-v1.json');
const catalog=json('public/assets/backgrounds/seasonal-v1/background_catalog_v1.json');
const manifest=json('public/assets/manifests/asset_manifest.json');
const routing=read('art-source/platform/backgrounds/seasonal-v1/SKILL_ROUTING.md');
const external=json('art-source/platform/backgrounds/seasonal-v1/EXTERNAL_REFERENCE_TRANSMISSION.json');
const projectRefs=json('art-source/platform/backgrounds/seasonal-v1/PROJECT_REFERENCE_TRANSMISSION.json');
const assetsSource=read('public/src/core/06-assets.js'),shopSource=read('public/src/shop/06-shop.js'),serverSource=read('server/index.js');

check(family.familyId===FAMILY&&family.productionUnitId==='P2-01'&&family.status==='OWNER_AUTHORIZED_ART_CLEARANCE','Family 冻结 P2-01、稳定 ID 与所有者清除状态');
check(family.authority.includes('no Battle Pass')&&family.authority.includes('Remote Config')&&family.authority.includes('social ranking'),'Family 明确只做表现层，不冒充赛季能力');
check(family.featureFlags&&family.featureFlags.defaultEnabled===true&&JSON.stringify(family.featureFlags.ids)===JSON.stringify([FLAG]),'Family 使用单一可逆 default-on flag');
check(family.metrics.sourceMasterCount===4&&family.metrics.runtimeVariantCount===20&&family.metrics.runtimeBytes===2022638&&family.metrics.withinBudget===true,'Family 数量与 10 MiB 预算冻结');

const seasons=['spring','summer','autumn','winter'];
check(family.sourceMasters.length===4&&new Set(family.sourceMasters.map(item=>item.season)).size===4,'四季各有唯一源母板');
for(const source of family.sourceMasters){
  const file=path.join(ROOT,source.path),info=pngInfo(file);
  check(fs.existsSync(file)&&hash(file)===source.sha256&&info&&info.width===source.width&&info.height===source.height,source.season+' 源 PNG 路径、SHA 与尺寸一致');
}
check(catalog.pack==='seasonal-background-pack-v1'&&catalog.featureFlag===FLAG&&catalog.items.length===8,'Runtime Catalog 含 8 个四季静态/动态条目');
check(JSON.stringify(catalog.items.map(item=>item.id))===JSON.stringify([32,33,34,35,36,37,38,39]),'季节背景使用连续稳定 ID 32–39');
for(const season of seasons){
  const items=catalog.items.filter(item=>item.season===season),staticItem=items.find(item=>!item.animated),animatedItem=items.find(item=>item.animated);
  check(items.length===2&&staticItem.price===24&&animatedItem.price===32&&staticItem.seasonalPresentationOnly===true&&animatedItem.seasonalPresentationOnly===true,season+' 静态/动态价格与 presentation-only 标记一致');
  for(const item of items){
    check(['poster','asset','desktop','mobileCrop','miniCrop','staticFallback'].every(key=>fs.existsSync(path.join(ROOT,'public/assets',item[key])))&&item.featureFlag===FLAG,season+' '+item.id+' 路径与 flag 完整');
  }
}

const expectedSizes={desktop:[1920,1080,false],mobile:[900,1200,false],poster:[640,360,false],mini:[640,360,false],animated:[720,405,true]};
for(const [key,relative] of Object.entries(family.runtimeVariants)){
  const file=path.join(ROOT,relative),info=webpInfo(file),kind=key.split('-').pop(),expected=expectedSizes[kind];
  check(fs.existsSync(file)&&info&&info.width===expected[0]&&info.height===expected[1]&&info.animated===expected[2]&&hash(file)===family.variantIntegrity[key]&&info.bytes===family.variantBytes[key],key+' WebP 尺寸/动画/SHA/字节一致');
}

const production=manifest.assets.find(item=>item.asset_id===FAMILY);
check(production&&production.status==='ready'&&production.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE'&&production.source_asset_id==='ART-SEASONAL-BACKGROUNDS-V1','生产 Manifest 只接入所有者已清除家族');
check(production&&production.feature_flags.default_enabled===true&&JSON.stringify(production.feature_flags.ids)===JSON.stringify([FLAG])&&Object.keys(production.variants).length===20,'生产 Manifest flag 与 20 个变体同构');
check(production&&production.actual_bytes===family.metrics.runtimeBytes&&production.byte_budget===10*1024*1024,'生产 Manifest 字节与预算一致');

for(let id=32;id<=39;id++)check(new RegExp('id:'+id+',name:').test(assetsSource)&&new RegExp('(?:^|[,\\s])'+id+':'+(id%2?32:24)+'(?:[,\\s}])').test(serverSource),'背景 '+id+' 同时存在前端目录和服务端权威价格');
check(assetsSource.includes("const SEASONAL_BACKGROUNDS_FLAG = '"+FLAG+"'")&&/item&&item\.seasonal&&!seasonalBackgroundsEnabled\(\)\?null:item/.test(assetsSource),'flag 关闭时 seasonal resolver fail-closed');
check(shopSource.includes('!item.seasonal || seasonalBackgroundsEnabled()'),'商城目录随同一 flag 可逆回滚');

const locales=['zh-CN','en-US','uk-UA'].map(code=>json('public/locales/'+code+'.json'));
for(let id=32;id<=39;id++)check(locales.every(locale=>typeof locale['shop_item_backgrounds_'+id]==='string'&&locale['shop_item_backgrounds_'+id].trim()),'背景 '+id+' 三语言名称完整');
const rarity=require(path.join(ROOT,'shared/progression/collection-rarity-catalog.js'));
for(let id=32;id<=39;id++)check(rarity.entryFor('backgrounds',id)?.tier===(id%2?'epic':'rare'),'背景 '+id+' 稀有度由显式目录决定');

const library=json('asset-library/catalog.json');
check(library.collections.some(item=>item.id==='seasonal-backgrounds-v1'&&item.catalogSha256===hash(path.join(RUNTIME,'background_catalog_v1.json'))),'Asset Library 集合路径与 Catalog SHA 一致');
const seasonalSourceMasters=library.assets.filter(item=>/^ART-SEASONAL-BACKGROUND-(?:SPRING|SUMMER|AUTUMN|WINTER)-V1$/.test(item.id));
check(seasonalSourceMasters.length===4,'Asset Library 登记四个源母板');
const seasonalRuntimeFamily=library.assets.find(item=>item.id===FAMILY);
check(seasonalSourceMasters.every(item=>item.status==='reference-only'&&Array.isArray(item.runtimePaths)&&item.runtimePaths.length===1&&item.runtimePaths[0]===item.sourcePath)&&seasonalRuntimeFamily&&seasonalRuntimeFamily.status==='integrated-local-only'&&Array.isArray(seasonalRuntimeFamily.runtimePaths)&&seasonalRuntimeFamily.runtimePaths.length===20,'四个源母板不直接进入 Manifest，运行时家族只消费 20 个批准派生');

for(const skill of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image'])check(new RegExp('`'+skill.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'`[\\s\\S]{0,80}`(?:APPLIED|NOT_APPLICABLE|UNAVAILABLE_EXTERNAL_CREDENTIAL)').test(routing),skill+' 有真实路由状态');
check(external.externalRestrictedInputCount===0&&external.transmissions.length===0&&external.runtimeExternalAssetCount===0,'外部 blocked-license 输入、传输与 Runtime 均为 0');
check(projectRefs.inputs.length===2&&projectRefs.tasks.length===4&&projectRefs.inputs.every(item=>fs.existsSync(path.join(ROOT,item.sourcePath))&&hash(path.join(ROOT,item.sourcePath)).toUpperCase()===item.sourceSha256),'项目自有 North Star 输入与四个 ImageGen task 可复核');

const ledger=json('requirements/PRODUCT_REQUIREMENTS_LEDGER.json').requirements;
check(['ECO-021','ECO-022','SOC-024'].every(id=>ledger.find(item=>item.id===id)?.status==='planned'),'Battle Pass、Remote Config 与赛季社交仍保持 planned');
for(const doc of ['PROMPT_AND_PROVENANCE.md','TECHNICAL_REVIEW_Reviewer_A.md','MACHINE_VISUAL_REVIEW.md','SIMILARITY_AND_IP_REVIEW.md','OWNER_AUTHORIZED_ART_CLEARANCE.md'])check(fs.existsSync(path.join(SOURCE,doc)),doc+' 已登记');

if(failures){console.error('SEASONAL_BACKGROUNDS_V1_FAILED checks='+checks+' failures='+failures);process.exit(1);}
console.log('SEASONAL_BACKGROUNDS_V1_ALL_PASS '+JSON.stringify({checks,sourceMasters:4,runtimeVariants:20,catalogItems:8,runtimeBytes:family.metrics.runtimeBytes}));
