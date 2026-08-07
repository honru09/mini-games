'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ICON_ROOT = path.join(ROOT, 'public', 'assets', 'icons', 'ui');
const source = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json'), 'utf8'));

let failures = 0;
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures++;
}

const setMatch = /const UI_ICON_NAMES = new Set\(\[([\s\S]*?)\]\);/.exec(source);
const names = setMatch ? [...setMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
const svgFiles = fs.readdirSync(ICON_ROOT).filter(file => file.endsWith('.svg'));
check('统一 icon(name, size, label?) 组件存在', /function icon\(name, size, label\)/.test(source));
check('图标白名单非空且无路径穿越名称', names.length >= 20 && names.every(name => /^[a-z0-9-]+$/.test(name)));
check('白名单 SVG 全部已 Vendor', names.every(name => fs.existsSync(path.join(ICON_ROOT, name + '.svg'))));
check('Vendor SVG 不含白名单外散落文件', svgFiles.every(file => names.includes(file.slice(0,-4))));
check('SVG 固定 24x24 viewBox 且无脚本/事件处理器', svgFiles.every(file => {
  const svg = fs.readFileSync(path.join(ICON_ROOT,file),'utf8');
  return /viewBox="0 0 24 24"/.test(svg) && !/<script|<foreignObject|\son[a-z]+=/i.test(svg);
}));
check('Lucide 版本、来源与完整许可证已保留', /lucide-static@1\.27\.0/.test(fs.readFileSync(path.join(ICON_ROOT,'SOURCE.md'),'utf8')) && fs.statSync(path.join(ICON_ROOT,'LICENSE')).size > 1000);
check('Icon-only Button 组件支持 aria-label', /opts\.ariaLabel/.test(source) && /setAttribute\('aria-label'/.test(source));
check('核心平台操作不再内嵌设置/快速开局/房间控制 Emoji', !/id="btn-settings-page"[^>]*>[^<]*⚙|id="btn-hero-quick"[^>]*>[^<]*⚡|id="btn-rules"[^>]*>[^<]*📖|id="btn-restart"[^>]*>[^<]*🔄/.test(template));
check('Asset Manifest 登记 Lucide 子集且无 npm 运行依赖', manifest.icons && manifest.icons.source === 'lucide-static@1.27.0' && manifest.icons.runtimeDependency === false && manifest.assets.some(asset => asset.asset_id === 'P-ICON-UI-V1'));

if (failures){ console.error('ICON_SYSTEM_FAILED: ' + failures); process.exit(1); }
console.log('ICON_SYSTEM_ALL_PASS');
