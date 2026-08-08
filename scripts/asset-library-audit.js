'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const catalogPath = path.join(ROOT, 'asset-library', 'catalog.json');
const schemaPath = path.join(ROOT, 'asset-library', 'schema.json');
const manifestPath = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let failures = 0;
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures++;
}
function safePath(value){
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('..')) return null;
  const resolved = path.resolve(ROOT, ...value.split('/'));
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep) ? resolved : null;
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function sameJson(left,right){
  return JSON.stringify(left) === JSON.stringify(right);
}
function matchesType(value,type){
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}
function validateSchema(value,rule,pointer,errors){
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    errors.push(pointer + ': schema rule must be an object');
    return;
  }
  if (Object.prototype.hasOwnProperty.call(rule,'const') && !sameJson(value,rule.const)) {
    errors.push(pointer + ': expected const ' + JSON.stringify(rule.const));
  }
  if (Array.isArray(rule.enum) && !rule.enum.some(option => sameJson(value,option))) {
    errors.push(pointer + ': value is outside enum');
  }
  if (rule.type) {
    const types=Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!types.some(type => matchesType(value,type))) {
      errors.push(pointer + ': expected type ' + types.join('|'));
      return;
    }
  }
  if (typeof value === 'string') {
    if (Number.isInteger(rule.minLength) && value.length < rule.minLength) errors.push(pointer + ': string is too short');
    if (typeof rule.pattern === 'string' && !(new RegExp(rule.pattern)).test(value)) errors.push(pointer + ': string does not match pattern');
  }
  if (typeof value === 'number' && Number.isFinite(rule.minimum) && value < rule.minimum) {
    errors.push(pointer + ': number is below minimum');
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(rule.minItems) && value.length < rule.minItems) errors.push(pointer + ': array has too few items');
    if (rule.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(pointer + ': array items are not unique');
    if (rule.items) value.forEach((item,index) => validateSchema(item,rule.items,pointer + '/' + index,errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties=rule.properties || {};
    const required=Array.isArray(rule.required) ? rule.required : [];
    required.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(value,key)) errors.push(pointer + ': missing required property ' + key);
    });
    Object.keys(value).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(properties,key)) {
        validateSchema(value[key],properties[key],pointer + '/' + key,errors);
      } else if (rule.additionalProperties === false) {
        errors.push(pointer + ': additional property ' + key + ' is not allowed');
      } else if (rule.additionalProperties && typeof rule.additionalProperties === 'object') {
        validateSchema(value[key],rule.additionalProperties,pointer + '/' + key,errors);
      }
    });
  }
}
const SUPPORTED_SCHEMA_KEYS=new Set([
  '$schema','$id','title','type','required','properties','additionalProperties','items',
  'const','enum','pattern','minLength','minimum','minItems','uniqueItems'
]);
function findUnsupportedSchemaKeywords(rule,pointer,errors){
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return;
  Object.keys(rule).forEach(key => {
    if (!SUPPORTED_SCHEMA_KEYS.has(key)) errors.push(pointer + ': unsupported schema keyword ' + key);
  });
  if (rule.properties && typeof rule.properties === 'object') {
    Object.entries(rule.properties).forEach(([key,child]) => findUnsupportedSchemaKeywords(child,pointer + '/properties/' + key,errors));
  }
  if (rule.items) findUnsupportedSchemaKeywords(rule.items,pointer + '/items',errors);
  if (rule.additionalProperties && typeof rule.additionalProperties === 'object') {
    findUnsupportedSchemaKeywords(rule.additionalProperties,pointer + '/additionalProperties',errors);
  }
}
function imageSize(file){
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii',1,4) === 'PNG') return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
  if (buffer.toString('ascii',0,4) !== 'RIFF' || buffer.toString('ascii',8,12) !== 'WEBP') return null;
  let offset=12;
  while (offset+8<=buffer.length){
    const type=buffer.toString('ascii',offset,offset+4),length=buffer.readUInt32LE(offset+4),data=offset+8;
    if (type==='VP8X'&&length>=10) return { width:buffer[data+4]+(buffer[data+5]<<8)+(buffer[data+6]<<16)+1, height:buffer[data+7]+(buffer[data+8]<<8)+(buffer[data+9]<<16)+1 };
    if (type==='VP8 '&&length>=10) return { width:buffer.readUInt16LE(data+6)&0x3fff, height:buffer.readUInt16LE(data+8)&0x3fff };
    if (type==='VP8L'&&length>=5){ const bits=buffer.readUInt32LE(data+1); return { width:(bits&0x3fff)+1, height:((bits>>14)&0x3fff)+1 }; }
    offset=data+length+(length%2);
  }
  return null;
}

const unsupportedSchemaKeywords=[];
findUnsupportedSchemaKeywords(schema,'#',unsupportedSchemaKeywords);
check('Schema 仅使用审计器支持的显式关键字', unsupportedSchemaKeywords.length === 0);
const schemaErrors=[];
validateSchema(catalog,schema,'$',schemaErrors);
check('Catalog 通过字段、类型、必填、枚举与附加字段 Schema 契约', schemaErrors.length === 0);
check('素材库 Schema 与 Catalog 版本为 v1', schema.properties && schema.properties.schemaVersion && schema.properties.schemaVersion.const === 1 && catalog.schemaVersion === 1);
check('未选择远端提供商时保持 local-only', catalog.storage && catalog.storage.mode === 'local-only' && catalog.storage.remoteProvider === null && catalog.storage.remoteBucket === null);

const allIds = [...catalog.indexes, ...catalog.collections, ...catalog.assets].map(item => item.id);
check('索引、集合和素材 ID 全部唯一', new Set(allIds).size === allIds.length);

check('所有上游索引存在且哈希一致', catalog.indexes.every(item => {
  const file=safePath(item.path);
  return file && fs.existsSync(file) && /^[a-f0-9]{64}$/.test(item.sha256) && sha256(file)===item.sha256;
}));

check('素材集合具备来源、许可、状态与本地根目录', catalog.collections.every(item => {
  const index=safePath(item.catalogPath),root=safePath(item.masterRoot),preview=safePath(item.previewPath);
  const localStatus=item.status==='integrated-local-only'||item.status==='reference-only';
  return index&&root&&preview&&fs.existsSync(index)&&fs.existsSync(root)&&fs.existsSync(preview)&&item.license&&item.sourceType&&localStatus&&item.remoteObjectKey===null&&sha256(index)===item.catalogSha256;
}));
check('集合目录哈希只校验 catalogPath，不允许 hashPath 替代', catalog.collections.every(item => !Object.prototype.hasOwnProperty.call(item,'hashPath')));
check('集合许可证路径与哈希成对且独立校验', catalog.collections.every(item => {
  if (item.licensePath === null || item.licenseSha256 === null) return item.licensePath === null && item.licenseSha256 === null;
  const licenseFile=safePath(item.licensePath);
  return licenseFile&&fs.existsSync(licenseFile)&&/^[a-f0-9]{64}$/.test(item.licenseSha256)&&sha256(licenseFile)===item.licenseSha256;
}));
check('外部集合必须登记来源 URL 和可核验许可证文件', catalog.collections.filter(item => item.sourceType==='external-licensed').every(item => {
  return /^https:\/\//.test(item.sourceUrl || '')&&typeof item.licensePath==='string'&&typeof item.licenseSha256==='string';
}));

const required=['id','category','assetType','sourceType','sourcePath','sourceSha256','license','author','status','dimensions','previewPath','previewSha256','runtimePaths','promptPath','model','remoteObjectKey'];
check('每项素材包含完整审计字段', catalog.assets.every(item => required.every(key => Object.prototype.hasOwnProperty.call(item,key))));
check('素材路径均留在仓库且文件存在', catalog.assets.every(item => {
  const rawPaths=[item.sourcePath,item.previewPath,...item.runtimePaths];
  if (item.promptPath !== null) rawPaths.push(item.promptPath);
  const paths=rawPaths.map(safePath);
  return paths.every(file => file && fs.existsSync(file));
}));
check('素材源文件与低清预览 SHA-256 一致', catalog.assets.every(item => {
  const source=safePath(item.sourcePath),preview=safePath(item.previewPath);
  return /^[a-f0-9]{64}$/.test(item.sourceSha256)&&/^[a-f0-9]{64}$/.test(item.previewSha256)&&sha256(source)===item.sourceSha256&&sha256(preview)===item.previewSha256;
}));
check('素材源文件尺寸与目录声明一致', catalog.assets.every(item => {
  const size=imageSize(safePath(item.sourcePath));
  return size&&size.width===item.dimensions.width&&size.height===item.dimensions.height;
}));
check('生成素材登记 Prompt、模型、作者与生成许可', catalog.assets.filter(item => item.sourceType==='generated').every(item => item.promptPath&&item.model&&item.author&&item.license==='project-owned-ai-generated'));
check('local-only 状态禁止预填远端对象键', catalog.assets.every(item => item.status==='integrated-local-only'&&item.remoteObjectKey===null));

const coverMap=new Map(manifest.assets.filter(item => /-COVER$/.test(item.asset_id || '')).map(item => [item.asset_id,item]));
check('六款封面目录与生产 Manifest 路径一致', catalog.assets.every(item => {
  const production=coverMap.get(item.id);
  return production&&item.runtimePaths.includes(production.runtime_path)&&item.runtimePaths.includes(production.variants&&production.variants['320w']);
}));

if (failures){
  [...unsupportedSchemaKeywords,...schemaErrors].slice(0,20).forEach(error => console.error('  ' + error));
  console.error('ASSET_LIBRARY_AUDIT_FAILED: ' + failures);
  process.exit(1);
}
console.log('ASSET_LIBRARY_AUDIT_ALL_PASS');
