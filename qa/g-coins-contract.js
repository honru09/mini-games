'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failed = false;
function check(ok, message){
  console.log((ok ? 'PASS  ' : 'FAIL  ') + message);
  if (!ok) failed = true;
}

const assetSource = 'art-source/brand/ghost-game/currency/gcoins-p0-20260810/gcoins-source-chroma-v1.png';
const provenance = 'art-source/brand/ghost-game/currency/gcoins-p0-20260810/PROMPT_AND_PROVENANCE.md';
const p1Root = 'art-source/brand/ghost-game/currency/gcoins-p1-20260814';
const p1Prompt = `${p1Root}/PROMPT_AND_PROVENANCE.md`;
const p1Review = `${p1Root}/TECHNICAL_REVIEW_Reviewer_A.md`;
const p1Source = `${p1Root}/source/gcoins-p1-candidate-b-chroma.png`;
const p1Alpha = `${p1Root}/alpha/gcoins-p1-candidate-b-alpha.png`;
const p1CatalogId = 'ART-026-GCOINS-P1-CANDIDATE-B';
const ownerClearance = 'OWNER_AUTHORIZED_ART_CLEARANCE';
const optionalAdvisory = 'OPTIONAL_ADVISORY_EVIDENCE';
const p1Expected = {
  source: '6a99bea413410f62520a2abe16ce3ab341c9e0337bd21a383350fc9f578dd04a',
  alpha: 'd62909d4827d427d5e499299fb2a7e839866a3ddc9e7b701d53c3e1cc542854c',
  192: 'aac1ddc47eb931a612e1ef9acf97d1215ebbdb591e818ca0cfdc33b15d40f421',
  96: '5f40724c81fef77ea067f48cdab5650231f701fc63f23c31e76d41ed7538fc25',
  64: '02af42f61f99e626747e35cda5198aabe0a4714cb6da42f84fc2c11da98fb648',
  44: 'a4c2be71b239faeb90a298811942c72f68a8ab58de8d4ace8a6cfecbb8a9309e'
};
const sourceBytes = fs.readFileSync(path.join(root, assetSource));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const catalog = JSON.parse(read('asset-library/catalog.json'));
const routing = JSON.parse(read('requirements/MAINLINE_CONTROL_ROUTING.json'));
const externalSources = JSON.parse(read('asset-library/external-source-register-20260813.json'));
const gatePolicy = read('requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md');
const core = read('public/src/core/06-assets.js');
const roster = read('public/src/ui/07-roster.js');
const shop = read('public/src/shop/06-shop.js');
const appShell = read('public/src/core/02-app-shell.js');
const social = read('public/src/core/04-social.js');
const profile = read('public/src/shop/05-profile.js');
const online = read('public/src/online/03-websocket.js');
const server = read('server/index.js');
const rewardEngine = read('server/reward-engine.js');
const locales = ['zh-CN','en-US','uk-UA'].map(lang => JSON.parse(read(`public/locales/${lang}.json`)));

function sha256(relative){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
}

function paeth(a,b,c){
  const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

function readRgbaPng(relative){
  const bytes=fs.readFileSync(path.join(root,relative));
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  if(!bytes.subarray(0,8).equals(signature)) throw new Error('not PNG');
  let offset=8,header=null;
  const idat=[];
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
    const start=offset+8,end=start+length,data=bytes.subarray(start,end);
    if(type==='IHDR') header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),bitDepth:data[8],colorType:data[9],compression:data[10],filter:data[11],interlace:data[12]};
    else if(type==='IDAT') idat.push(data);
    else if(type==='IEND') break;
    offset=end+4;
  }
  if(!header||header.bitDepth!==8||header.colorType!==6||header.compression!==0||header.filter!==0||header.interlace!==0) throw new Error('expected non-interlaced RGBA8');
  const rowBytes=header.width*4,input=zlib.inflateSync(Buffer.concat(idat)),rgba=Buffer.alloc(rowBytes*header.height);
  let inputOffset=0;
  for(let y=0;y<header.height;y++){
    const filter=input[inputOffset++],row=y*rowBytes;
    for(let x=0;x<rowBytes;x++){
      const value=input[inputOffset++],left=x>=4?rgba[row+x-4]:0,above=y?rgba[row-rowBytes+x]:0,upperLeft=y&&x>=4?rgba[row-rowBytes+x-4]:0;
      if(filter===0) rgba[row+x]=value;
      else if(filter===1) rgba[row+x]=(value+left)&255;
      else if(filter===2) rgba[row+x]=(value+above)&255;
      else if(filter===3) rgba[row+x]=(value+Math.floor((left+above)/2))&255;
      else if(filter===4) rgba[row+x]=(value+paeth(left,above,upperLeft))&255;
      else throw new Error('unsupported PNG filter');
    }
  }
  return {...header,rgba};
}

function rgbaAt(image,x,y){ return image.rgba.subarray((y*image.width+x)*4,(y*image.width+x)*4+4); }

function filesUnder(relative){
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute)) return [];
  const found=[];
  const visit=(current,prefix) => {
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const nextPrefix=prefix?`${prefix}/${entry.name}`:entry.name;
      const next=path.join(current,entry.name);
      if(entry.isDirectory()) visit(next,nextPrefix);
      else if(entry.isFile()) found.push(`${relative}/${nextPrefix}`.replace(/\\/g,'/'));
    }
  };
  visit(absolute,'');
  return found.sort();
}

function manifestRuntimePaths(asset){
  if(!asset||typeof asset!=='object') return [];
  const values=[asset.runtime_path,asset.poster];
  if(asset.variants&&typeof asset.variants==='object') values.push(...Object.values(asset.variants));
  return [...new Set(values.filter(value => typeof value==='string'&&value))];
}

function manifestRuntimeFiles(asset){
  if(!asset||typeof asset!=='object') return [];
  const files=[];
  if(typeof asset.runtime_path==='string'&&asset.runtime_path) files.push({path:asset.runtime_path,integrity:asset.integrity});
  if(typeof asset.poster==='string'&&asset.poster) files.push({path:asset.poster,integrity:asset.poster_integrity});
  if(asset.variants&&typeof asset.variants==='object'){
    for(const [id,relative] of Object.entries(asset.variants)) files.push({path:relative,integrity:asset.variant_integrity&&asset.variant_integrity[id]});
  }
  return files.filter((file,index,list) => list.findIndex(other => other.path===file.path)===index);
}

function hasFabricatedHumanPass(text){
  return /(?:Reviewer\s*B|IP(?:\s*Similarity)?(?:\s*Review)?|LEGAL|Golden\s*Set)[^\n]{0,48}\bPASS\b/i.test(String(text||''));
}

check(core.includes("const CURRENCY_NAME = 'G Coins';"), '品牌名与旧 fallback 在资产层分离冻结');
check(core.includes('function currencyName()') && core.includes('function currencyAmountText(') && core.includes('function currencyAmountNode('), '统一货币文本与复合金额 seam 存在');
const p003 = manifest.assets.find(item => item.asset_id === 'P-003');
check(core.includes("const CURRENCY_ASSET_ID = 'P-003';") && core.includes("currencyCash: 'ui/currency_cash.svg'"), '现有生产资产 ID P-003 与客户端 fallback key 保持稳定');
check(!!p003 && p003.runtime_path === 'public/assets/ui/currency_cash.svg' && p003.fallback === '💵' && p003.license === 'project-owned' && fs.existsSync(path.join(root,p003.runtime_path)), 'P-003 SVG 与历史 💵 fallback 永久保留');
check(roster.includes('currencyName') && shop.includes('currencyAmountText') && appShell.includes('currencyAmountText'), '奖励、商城与 Profile 余额消费统一文本 seam');
check(social.includes("icon === '__currency__'") && social.includes('currencyAmountNode'), '玩家档案货币统计消费统一金额 seam');
const iconConsumers = [roster,shop,profile,online,social];
check(iconConsumers.every(source => !source.includes('currencyIcon(')), '用户可见消费者不再手拼 currencyIcon 与数值');
check(iconConsumers.every(source => source.includes('currencyAmountNode')), 'Home、Profile、Shop、排行榜与玩家列表消费统一复合金额 seam');
check(server.includes('G Coins 余额不足，请完成有效对局获取 G Coins'), '服务端余额错误使用新品牌名并保留 reason');
check(locales.every(locale => locale.currency_name === 'G Coins' && typeof locale.currency_aria === 'string' && typeof locale.currency_legal === 'string'), '三语言包含同构品牌、ARIA 与法律说明');
check(locales.every(locale => typeof locale.shop_available_label === 'string' && typeof locale.profile_balance_label === 'string' && typeof locale.profile_summary_meta === 'string'), '三语言包含统一余额与档案外围标签');
check(locales.every(locale => typeof locale.reward_reason_tournament_mode === 'string' && !locale.reward_reason_tournament_mode.includes('💵')), '三语言赛事阻断原因不再显示旧货币符号');
check(!/String\(account\.coins\|\|0\)\s*\+\s*['"]💵['"]/.test(appShell), 'Profile 极端 fallback 不再拼接旧货币符号');
check(core.includes('`coins`/`currency` remain the protocol and persistence field names') && !/\b(?:gCoins|g_coins)\b/.test(core + roster + shop + appShell + social + server + rewardEngine), 'G Coins 仅为表现层命名，不新增经济或持久字段');
check(!server.includes(p1CatalogId) && !rewardEngine.includes(p1CatalogId) && /\bcoins\b/.test(rewardEngine), 'P1 美术候选不进入服务端 Reward/Economy authority');
const catalogAsset = catalog.assets.find(item => item.id === 'ART-026-GCOINS-SOURCE-CHROMA-V1');
check(!!catalogAsset && catalogAsset.status === 'reference-only' && catalogAsset.sourcePath === assetSource, '素材库登记 source-only/reference-only G Coins 源稿');
check(!!catalogAsset && String(catalogAsset.sourceSha256 || '').toLowerCase() === crypto.createHash('sha256').update(sourceBytes).digest('hex'), 'G Coins 源稿 SHA-256 与素材库一致');
check(fs.existsSync(path.join(root, provenance)) && read(provenance).includes('9D6D8870329B04B5A136F66449498656B7601BEE15AFBDABC2A73EAA030919AD'), 'G Coins Prompt/provenance 含稳定源哈希');
const p1Catalog = catalog.assets.find(item => item.id === p1CatalogId);
const p1AlphaImage = readRgbaPng(p1Alpha);
const p1Corners = [[0,0],[p1AlphaImage.width-1,0],[0,p1AlphaImage.height-1],[p1AlphaImage.width-1,p1AlphaImage.height-1]];
let p1GreenFringe = 0;
for(let i=0;i<p1AlphaImage.rgba.length;i+=4){
  const r=p1AlphaImage.rgba[i],g=p1AlphaImage.rgba[i+1],b=p1AlphaImage.rgba[i+2],a=p1AlphaImage.rgba[i+3];
  if(a>8&&g>r+40&&g>b+40) p1GreenFringe++;
}
check(!!p1Catalog && p1Catalog.status === 'reference-only' && p1Catalog.sourcePath === p1Source && p1Catalog.previewPath === p1Alpha, 'P1 Candidate B 仅登记为 reference-only 技术首选');
check(sha256(p1Source) === p1Expected.source && sha256(p1Alpha) === p1Expected.alpha, 'P1 Candidate B 色键源与 Alpha 哈希固定');
check([192,96,64,44].every(size => sha256(`${p1Root}/derived/gcoins-p1-candidate-b-${size}px.png`) === p1Expected[size]), 'P1 Candidate B 四档派生哈希固定');
check(p1AlphaImage.width === 1254 && p1AlphaImage.height === 1254 && p1Corners.every(([x,y]) => rgbaAt(p1AlphaImage,x,y)[3] === 0), 'P1 Alpha 为 1254² RGBA 且四角透明');
check(p1GreenFringe === 0, 'P1 Alpha 可见前景无绿色主导污染像素');
check([192,96,64,44].every(size => { const png=readRgbaPng(`${p1Root}/derived/gcoins-p1-candidate-b-${size}px.png`); return png.width===size&&png.height===size; }), 'P1 四档派生尺寸与 RGBA 格式正确');
const p1ReviewText = fs.existsSync(path.join(root,p1Review)) ? read(p1Review) : '';
check(fs.existsSync(path.join(root,p1Prompt)) && p1ReviewText && read(p1Prompt).includes('exec-4d03c60c-2b63-4b88-8633-32ce09c83465') && p1ReviewText.includes('TECHNICAL_CANDIDATE') && p1ReviewText.includes('SOURCE_ONLY'), 'P1 Prompt、任务标识、选稿与 Reviewer A 技术边界可追溯');
check(!hasFabricatedHumanPass(p1ReviewText) && ['Reviewer B','IP Similarity Review','用户 Golden Set','NOT_EXECUTED'].every(token => p1ReviewText.includes(token)), 'Reviewer A 不冒充自然人、IP/法律或 Golden Set PASS');

const artGate = routing.sharedGates && routing.sharedGates['GATE-ART-GOLDEN-SET'];
check(artGate && artGate.status === 'OPEN_BY_OWNER_AUTHORIZATION' && artGate.developmentStatus === 'OPEN' && artGate.releaseStatus === 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED', '原创美术 Gate 使用所有者清除且发布授权保持独立');
check(gatePolicy.includes(ownerClearance) && gatePolicy.includes(optionalAdvisory) && gatePolicy.includes('不作为原创资产的开发、runtime 或发布先决条件'), '人工清稿、Reviewer B、IP/法律与逐资产 Golden Set 仅为可选风险咨询');
check(externalSources.status === 'reference-only' && externalSources.storage && externalSources.storage.copiedIntoRepository === false && externalSources.storage.decompressedIntoRepository === false && /不得直接复制到 public\/assets/.test(externalSources.runtimePolicy || ''), '外部 blocked-license/reference-only 素材保持严格隔离');
check(!JSON.stringify(manifest).includes('BaiduNetdiskDownload') && gatePolicy.includes('blocked-license'), '生产 Manifest 与所有者清除轨道不给外部受限素材例外');

const p1RuntimeEntries = manifest.assets.filter(item => {
  if(!item || item.asset_id === 'P-003') return false;
  const serialized=JSON.stringify(item).toLowerCase();
  return item.source_asset_id === p1CatalogId || item.catalog_key === p1CatalogId || item.candidate_id === p1CatalogId ||
    serialized.includes(p1CatalogId.toLowerCase()) || serialized.includes('gcoins-p1') ||
    (item.fallback_asset_id === 'P-003' && /g[-_ ]?coins/.test(serialized));
});
const p1ClearanceFiles = filesUnder('requirements/active/gcoins-source-redesign-p1-20260814')
  .filter(relative => /OWNER_AUTHORIZED_ART_CLEARANCE/i.test(path.basename(relative)));
const publicGCoinsFiles = filesUnder('public/assets').filter(relative => /g[-_]?coins/i.test(relative));
const runtimeSignals = p1RuntimeEntries.length + p1ClearanceFiles.length + publicGCoinsFiles.length;

if(runtimeSignals === 0){
  check(true, 'P1 当前严格保持 source-only：无 clearance、Manifest 或 public runtime 混入');
}else{
  check(p1RuntimeEntries.length === 1 && p1ClearanceFiles.length === 1, 'P1 runtime 升级必须原子具备唯一 Manifest 与逐族 clearance 记录');
  const runtimeEntry=p1RuntimeEntries[0]||null;
  const clearancePath=p1ClearanceFiles[0]||'';
  const clearanceText=clearancePath?read(clearancePath):'';
  const flags=runtimeEntry&&runtimeEntry.feature_flags;
  const flagIds=flags&&Array.isArray(flags.ids)?flags.ids:[];
  const runtimePaths=manifestRuntimePaths(runtimeEntry);
  const runtimeFiles=manifestRuntimeFiles(runtimeEntry);
  const runtimePath=runtimeEntry&&runtimeEntry.runtime_path;
  const integrity=String(runtimeEntry&&runtimeEntry.integrity||'').replace(/^sha256:/,'').toLowerCase();
  const runtimeProvenance=runtimeEntry&&runtimeEntry.provenance;
  check(runtimeEntry && runtimeEntry.asset_id !== 'P-003' && runtimeEntry.source_asset_id === p1CatalogId && runtimeEntry.clearance === ownerClearance && runtimeEntry.status === 'ready' && Number.isInteger(runtimeEntry.artwork_version) && runtimeEntry.artwork_version > 0, 'P1 runtime 使用独立稳定 ID、正整数版本并显式绑定 Candidate B 所有者清除');
  check(runtimeEntry && /^project-owned(?:-ai-generated)?$/.test(String(runtimeEntry.license||'')) && runtimeProvenance && runtimeProvenance.source_asset_id === p1CatalogId && String(runtimeProvenance.source_sha256||'').toLowerCase() === p1Expected.source && String(runtimeProvenance.alpha_sha256||'').toLowerCase() === p1Expected.alpha, 'P1 runtime license/provenance 只绑定 project-owned Candidate B 源与 Alpha');
  check(runtimeEntry && runtimeEntry.fallback_asset_id === 'P-003' && /(?:currency_cash\.svg|💵|P-003)/.test(String(runtimeEntry.fallback||'')), 'P1 runtime 加载失败完整回退 P-003 SVG/💵');
  check(flags && flags.operator === 'all' && flags.enabled_value === '1' && flags.default_enabled === true && flagIds.length > 0 && flagIds.every(id => /^mg_art_gcoins/.test(id)), '所有者清除后只允许可逆 default-on G Coins feature flags');
  check(runtimeFiles.length > 0 && runtimePaths.length === runtimeFiles.length && runtimeFiles.every(file => {
    const fileIntegrity=String(file.integrity||'').replace(/^sha256:/,'').toLowerCase();
    return file.path.startsWith('public/assets/') && !file.path.includes('art-source/') && fs.existsSync(path.join(root,file.path)) && /^[a-f0-9]{64}$/.test(fileIntegrity) && sha256(file.path) === fileIntegrity;
  }), 'P1 runtime 主文件、poster 与 variants 全部固定 public 路径和逐文件 integrity');
  check(runtimePath && fs.existsSync(path.join(root,runtimePath)) && /^[a-f0-9]{64}$/.test(integrity) && sha256(runtimePath) === integrity && Number.isInteger(runtimeEntry.actual_bytes) && Number.isInteger(runtimeEntry.byte_budget) && runtimeEntry.actual_bytes === fs.statSync(path.join(root,runtimePath)).size && runtimeEntry.actual_bytes > 0 && runtimeEntry.actual_bytes <= runtimeEntry.byte_budget, 'P1 runtime actual_bytes 等于主文件真实字节且不超过预算');
  check(clearanceText && [ownerClearance,p1CatalogId,p1Expected.source,p1Expected.alpha,'M0 North Star',optionalAdvisory,'NOT_EXECUTED','P-003','fallback','blocked-license','EXTERNAL_REFERENCE_ONLY',...flagIds].every(token => clearanceText.includes(token)) && [/(?:machine|机器)/i,/(?:technical|技术)/i,/(?:visual|视觉)/i,/(?:similarity|相似)/i,/(?:risk|风险)/i].every(pattern => pattern.test(clearanceText)) && runtimeFiles.every(file => clearanceText.toLowerCase().includes(String(file.integrity||'').replace(/^sha256:/,'').toLowerCase())) && !hasFabricatedHumanPass(clearanceText), '逐族 clearance 固定机器技术/视觉/相似风险、来源、逐文件哈希、回滚与未执行咨询且不伪造人工/IP PASS');
  check(runtimeEntry && core.includes(runtimeEntry.asset_id) && flagIds.length > 0 && flagIds.every(id => core.includes(id)) && core.includes('ownerClearedDefaultOnFlagEnabled') && core.includes("currencyCash: 'ui/currency_cash.svg'"), '客户端只通过 owner-cleared default-on seam 接入并保留 P-003 一键回滚');
  check(publicGCoinsFiles.every(relative => runtimePaths.includes(relative)), 'public G Coins 派生全部由 Runtime Manifest 声明，无孤儿文件');
}

if (failed) process.exitCode = 1;
else console.log('G_COINS_CONTRACT_ALL_PASS');
