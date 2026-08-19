#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const REPORT_DIR = path.join(ROOT, '简易报告');
const MINIMUM_SNAPSHOT_DATE = '2026-08-12';
const EXPECTED_CATEGORIES = {
  art: 'ART',
  ui: 'UI',
  game: 'GAME',
  social: 'SOC',
  economy: 'ECO',
  tech: 'TECH'
};
const EXPECTED_REQUIREMENT_COUNT = 242;
const EXPECTED_SOURCE_CATALOG_COUNT = 79;
const EXPECTED_DEPENDENCY_NODE_COUNT = 129;
const EXPECTED_DEPENDENCY_EDGE_COUNT = 267;
const EXPECTED_REQUEST_COVERAGE_GROUP_COUNT = 48;
const EXPECTED_CATEGORY_COUNTS = { art: 36, ui: 38, game: 52, social: 33, economy: 29, tech: 54 };
const VALID_STATUSES = new Set(['verified', 'implemented', 'partial', 'planned', 'not_executed', 'blocked']);
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_SOURCE_KINDS = new Set(['evidence', 'status', 'specification', 'origin']);
const HONRU_PIXEL_PACK_ROOT = 'art-source/platform/avatars/v3-honru-pixel-p0-20260811';
const HONRU_PIXEL_RUNTIME_MARKERS = [
  HONRU_PIXEL_PACK_ROOT,
  'v3-honru-pixel',
  'honru-pixel-avatar',
  'honru-pixel',
  'honru-stargazer',
  'honru-night-cadet',
  'honru-explorer',
  'honru-arcade-builder'
].map(value => value.toLowerCase());
const CURRENT_BUILD_SHA = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, 'public', 'index.html')))
  .digest('hex')
  .toUpperCase();

function occurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

function containsHonruPixelRuntimeMarker(value) {
  const normalized = String(value || '').replace(/\\/g, '/').toLowerCase();
  return HONRU_PIXEL_RUNTIME_MARKERS.some(marker => normalized.includes(marker));
}

function listFilesRecursive(rootPath) {
  if (!fs.existsSync(rootPath)) return [];
  const files = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else files.push(target);
    }
  };
  visit(rootPath);
  return files;
}

const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const TOTAL_REPORT = path.join(REPORT_DIR, `项目总需求进度报告-${ledger.snapshotDate.replace(/-/g, '')}.md`);
assert.strictEqual(ledger.schemaVersion, 2, 'ledger schemaVersion must be 2');
assert(/^\d{4}-\d{2}-\d{2}$/.test(ledger.snapshotDate), 'ledger snapshot date must use YYYY-MM-DD');
assert(ledger.snapshotDate >= MINIMUM_SNAPSHOT_DATE, 'ledger snapshot date cannot precede the command-plane baseline');
assert.deepStrictEqual(ledger.statusVocabulary, [...VALID_STATUSES], 'status vocabulary/order drift');
assert.strictEqual(ledger.deploymentPolicy.mode, 'explicit-user-command-only', 'deployment policy must require an explicit user command');
assert.strictEqual(ledger.deploymentPolicy.defaultTaskEnd, 'LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND', 'local task end state drift');
assert.strictEqual(ledger.imageGenerationPolicy.default, 'highest-quality-model-and-settings', 'image quality policy drift');
assert.deepStrictEqual(Object.keys(ledger.acceptanceProfiles), [...VALID_STATUSES], 'acceptance profile coverage/order drift');
assert.deepStrictEqual(
  Object.fromEntries(Object.entries(ledger.categories).map(([key, value]) => [key, value.prefix])),
  EXPECTED_CATEGORIES,
  'category set/prefix drift'
);
assert.strictEqual(ledger.requirements.length, EXPECTED_REQUIREMENT_COUNT, `snapshot must contain ${EXPECTED_REQUIREMENT_COUNT} unique requirements`);
assert.strictEqual(Object.keys(ledger.sourceCatalog).length, EXPECTED_SOURCE_CATALOG_COUNT, 'source catalog count drift');

const ids = new Set();
for (const item of ledger.requirements) {
  assert(item && typeof item === 'object', 'each requirement must be an object');
  assert(/^(ART|UI|GAME|SOC|ECO|TECH)-\d{3}$/.test(item.id), `invalid id: ${item.id}`);
  assert(!ids.has(item.id), `duplicate id: ${item.id}`);
  ids.add(item.id);
  assert(EXPECTED_CATEGORIES[item.category], `invalid category: ${item.id}`);
  assert(item.id.startsWith(`${EXPECTED_CATEGORIES[item.category]}-`), `category prefix mismatch: ${item.id}`);
  assert(typeof item.title === 'string' && item.title.trim(), `missing title: ${item.id}`);
  assert(VALID_STATUSES.has(item.status), `invalid status: ${item.id}`);
  assert(VALID_PRIORITIES.has(item.priority), `invalid priority: ${item.id}`);
  assert(typeof item.phase === 'string' && item.phase.trim(), `missing phase: ${item.id}`);
  assert(Array.isArray(item.source) && item.source.length > 0 && item.source.every(Boolean), `missing source: ${item.id}`);
  for (const source of item.source) assert(ledger.sourceCatalog[source], `unknown source token: ${item.id} -> ${source}`);
  if (item.status === 'verified') {
    assert(item.source.some((source) => ['evidence', 'status'].includes(ledger.sourceCatalog[source].kind)), `verified item lacks current evidence/status source: ${item.id}`);
  }
  assert(typeof item.next === 'string' && item.next.trim(), `missing next step: ${item.id}`);
  assert(item.related === undefined || (Array.isArray(item.related) && new Set(item.related).size === item.related.length), `invalid related list: ${item.id}`);
}

const requirementById = new Map(ledger.requirements.map((item) => [item.id, item]));
const art019 = requirementById.get('ART-019');
assert(art019.source.includes('honru-pixel-avatar-source-p0'), 'ART-019 must retain Honru Pixel source evidence');
assert(art019.next.includes('OWNER_AUTHORIZED_ART_CLEARANCE'), 'ART-019 must route runtime admission through owner-authorized art clearance');
assert(/(?:可选咨询|OPTIONAL_ADVISORY_EVIDENCE)/i.test(art019.next), 'ART-019 must keep human/IP/Golden Set review advisory rather than blocking');
assert(!/(?:until human gates close|人工清稿[^。；]*通过后才|Reviewer B[^。；]*通过后才|IP[^。；]*通过后才|Golden Set[^。；]*通过后才)/i.test(art019.next), 'ART-019 must not restore a mandatory human/IP admission gate');

const assetManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json'), 'utf8'));
const artApprovalMatrix = fs.readFileSync(path.join(ROOT, 'requirements', 'ART_APPROVAL_MATRIX.md'), 'utf8');
const pixelMatrixRow = (artApprovalMatrix.match(/^\| Honru Pixel Avatar v3[^\n]*$/m) || [''])[0];
const manifestHasPixelRuntime = (assetManifest.assets || []).some(asset => containsHonruPixelRuntimeMarker(JSON.stringify(asset)));
const publicHasPixelRuntime = listFilesRecursive(path.join(ROOT, 'public', 'assets'))
  .some(filePath => containsHonruPixelRuntimeMarker(path.relative(ROOT, filePath)));
const canonicalConsumerHasPixelRuntime = [
  ...listFilesRecursive(path.join(ROOT, 'public', 'src')),
  path.join(ROOT, 'public', 'index-template.html')
].filter(filePath => fs.existsSync(filePath) && /\.(?:js|json|html)$/i.test(filePath))
  .some(filePath => containsHonruPixelRuntimeMarker(fs.readFileSync(filePath, 'utf8')));
const pixelRuntimeMode = manifestHasPixelRuntime || publicHasPixelRuntime || canonicalConsumerHasPixelRuntime ||
  pixelMatrixRow.includes('OWNER_AUTHORIZED_ART_CLEARANCE');
if (pixelRuntimeMode) {
  assert(['partial', 'implemented', 'verified'].includes(art019.status), 'ART-019 runtime mode must describe actual implementation/evidence, not a human-gate block');
  assert(/(?:runtime|OWNER_AUTHORIZED_ART_CLEARANCE)/i.test(`${art019.phase} ${art019.next}`), 'ART-019 runtime mode must retain its owner-clearance boundary');
} else {
  assert.strictEqual(art019.status, 'partial', 'ART-019 source-only mode must remain partial until an atomic owner-cleared runtime exists');
  assert(/source-only/i.test(art019.phase), 'ART-019 source-only mode must be explicit in the ledger phase');
  assert(pixelMatrixRow.includes('SOURCE_ONLY_CANDIDATE') && !pixelMatrixRow.includes('OWNER_AUTHORIZED_ART_CLEARANCE'), 'ART-019 source-only mode must have no owner-cleared runtime signal in the approval matrix');
}
assert.strictEqual(requirementById.get('ART-021').status, 'partial', 'ART-021 must retain its external visual/art open loop');
assert(requirementById.get('ART-021').source.includes('premium-background-runtime-p0'), 'ART-021 must retain runtime lifecycle evidence');
for (const id of ['GAME-048', 'GAME-049', 'GAME-050', 'GAME-051', 'GAME-052']) {
  assert.strictEqual(requirementById.get(id).status, 'implemented', `${id} must remain local implemented, not browser-verified`);
}
assert(requirementById.get('GAME-049').source.includes('game-stage-wave-c-density'), 'GAME-049 must retain Ludo Wave C evidence');
assert(requirementById.get('GAME-050').source.includes('game-stage-wave-c-density'), 'GAME-050 must retain Monopoly Wave C evidence');
assert(requirementById.get('GAME-048').source.includes('game-stage-wave-c-density'), 'GAME-048 must retain Gomoku/Tetris Wave C evidence without creating new requirement IDs');
assert.strictEqual(requirementById.get('TECH-052').status, 'implemented', 'TECH-052 command plane must remain implemented');
assert(requirementById.get('TECH-049').source.includes('mainline-command-20260812'), 'TECH-049 must retain the renderer-independent 3D command source');

for (const [source, entry] of Object.entries(ledger.sourceCatalog)) {
  assert(VALID_SOURCE_KINDS.has(entry.kind), `invalid source kind: ${source}`);
  assert(Array.isArray(entry.refs) && entry.refs.length > 0, `source refs missing: ${source}`);
  assert.strictEqual(new Set(entry.refs).size, entry.refs.length, `duplicate source refs: ${source}`);
  for (const ref of entry.refs) {
    assert(typeof ref === 'string' && ref.trim(), `empty source ref: ${source}`);
    assert(fs.existsSync(path.resolve(ROOT, ref)), `source ref does not exist: ${source} -> ${ref}`);
  }
}

for (const item of ledger.requirements) {
  for (const target of item.related || []) {
    assert(ids.has(target), `missing related target: ${item.id} -> ${target}`);
    assert.notStrictEqual(target, item.id, `self related target: ${item.id}`);
  }
}

for (const [id, dependencies] of Object.entries(ledger.dependencyGraph)) {
  assert(ids.has(id), `unknown dependency graph node: ${id}`);
  assert(Array.isArray(dependencies) && dependencies.length > 0, `dependency graph entry must be non-empty: ${id}`);
  assert.strictEqual(new Set(dependencies).size, dependencies.length, `duplicate dependency: ${id}`);
  for (const dependency of dependencies) {
    assert(ids.has(dependency), `missing dependency target: ${id} -> ${dependency}`);
    assert.notStrictEqual(dependency, id, `self dependency: ${id}`);
  }
}
assert.strictEqual(Object.keys(ledger.dependencyGraph).length, EXPECTED_DEPENDENCY_NODE_COUNT, 'dependency node count drift');

const requestCoverageIds = new Set();
for (const [key, group] of Object.entries(ledger.requestCoverage)) {
  assert(/^[a-z0-9-]+$/.test(key), `invalid request coverage key: ${key}`);
  assert(typeof group.label === 'string' && group.label.trim(), `missing request coverage label: ${key}`);
  assert(Array.isArray(group.ids) && group.ids.length > 0, `empty request coverage group: ${key}`);
  assert.strictEqual(new Set(group.ids).size, group.ids.length, `duplicate id inside request coverage group: ${key}`);
  for (const id of group.ids) {
    assert(ids.has(id), `unknown request coverage id: ${key} -> ${id}`);
    requestCoverageIds.add(id);
  }
}
assert.strictEqual(Object.keys(ledger.requestCoverage).length, EXPECTED_REQUEST_COVERAGE_GROUP_COUNT, 'request coverage group count drift');
assert.deepStrictEqual([...requestCoverageIds].sort(), [...ids].sort(), 'request coverage must include every atomic requirement');
assert.deepStrictEqual(ledger.requestCoverage['game-stage-wave-c-tank-xiangqi'].ids, ['GAME-051', 'GAME-052'], 'Tank/Xiangqi Wave C request coverage drift');

const visiting = new Set();
const visited = new Set();
function visitDependency(id, trail = []) {
  if (visiting.has(id)) throw new Error(`dependency cycle: ${[...trail, id].join(' -> ')}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of ledger.dependencyGraph[id] || []) visitDependency(dependency, [...trail, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const id of ids) visitDependency(id);

for (const [category, count] of Object.entries(EXPECTED_CATEGORY_COUNTS)) {
  assert.strictEqual(ledger.requirements.filter((item) => item.category === category).length, count, `category count drift: ${category}`);
}

assert(fs.existsSync(TOTAL_REPORT), 'missing total progress report');
const totalText = fs.readFileSync(TOTAL_REPORT, 'utf8');
assert(totalText.includes(`${EXPECTED_REQUIREMENT_COUNT} 项唯一原子需求`), 'total report is missing unique count');
assert(totalText.includes('LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND'), 'total report is missing local-only release state');
assert(totalText.includes('未提交、未推送、未触发 GitHub Pages 或 Render'), 'total report is missing no-release boundary');
assert(totalText.includes('旧白皮书的 11 款、三模式范围已被后续决策替代'), 'total report is missing old-scope ruling');
assert(totalText.includes('前置依赖图：'), 'total report is missing dependency graph coverage');
assert(totalText.includes(`来源词典 ${EXPECTED_SOURCE_CATALOG_COUNT} 项`), 'total report is missing source traceability coverage');
assert(totalText.includes(`前置依赖图：${EXPECTED_DEPENDENCY_NODE_COUNT} 个有显式前置条件的需求、${EXPECTED_DEPENDENCY_EDGE_COUNT} 条有向依赖`), 'total report is missing dependency graph count');
assert(totalText.includes(`历史/当前请求覆盖索引：${EXPECTED_REQUEST_COVERAGE_GROUP_COUNT} 个主题组`), 'total report is missing historical/current request coverage');

const agentsText = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
const whitepaperText = fs.readFileSync(path.join(ROOT, 'WHITEPAPER.md'), 'utf8');
for (const [name, text] of [['AGENTS.md', agentsText], ['WHITEPAPER.md', whitepaperText]]) {
  assert(text.includes('PRODUCT_REQUIREMENTS_LEDGER.json'), `${name} is missing ledger authority`);
  assert(text.includes('未经用户') || text.includes('用户未在当前任务明确要求'), `${name} is missing explicit no-release policy`);
}

for (const [category, meta] of Object.entries(ledger.categories)) {
  assert(meta.report.endsWith(`-${ledger.snapshotDate.replace(/-/g, '')}.md`), `category report date drift: ${category}`);
  const reportPath = path.join(REPORT_DIR, meta.report);
  assert(fs.existsSync(reportPath), `missing category report: ${meta.report}`);
  const report = fs.readFileSync(reportPath, 'utf8');
  const items = ledger.requirements.filter((item) => item.category === category);
  const headings = [...report.matchAll(/^### ((?:ART|UI|GAME|SOC|ECO|TECH)-\d{3})｜/gm)].map((match) => match[1]);
  assert.strictEqual(headings.length, items.length, `requirement heading count drift: ${category}`);
  assert.deepStrictEqual(headings, items.map((item) => item.id), `requirement order/content drift: ${category}`);
  assert.strictEqual(new Set(headings).size, headings.length, `duplicate requirement heading: ${category}`);
  assert.strictEqual(occurrences(report, /^# /gm), 1, `report must contain one H1: ${category}`);
  assert.strictEqual(occurrences(report, /^- 前置依赖：/gm), items.length, `dependency field coverage drift: ${category}`);
  assert.strictEqual(occurrences(report, /^- 当前证据入口：/gm), items.length, `evidence field coverage drift: ${category}`);
  assert.strictEqual(occurrences(report, /^- 验收口径：/gm), items.length, `acceptance field coverage drift: ${category}`);
  assert.strictEqual(occurrences(report, /^- 下一阶段 \/ 动作：/gm), items.length, `next-stage field coverage drift: ${category}`);
  if (category === 'tech') {
    const tech027 = report.match(/^### TECH-027｜[\s\S]*?(?=^### TECH-|(?![\s\S]))/m);
    assert(tech027, 'TECH-027 generated report section is missing');
    assert(tech027[0].includes('requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-local-browser-matrix-20260817.json'), 'TECH-027 generated report is missing current-build matrix metadata');
    assert(tech027[0].includes(CURRENT_BUILD_SHA), 'TECH-027 generated report is missing the current build identity');
    assert(tech027[0].includes('915A97F3') && tech027[0].includes('historical-as-of'),
      'TECH-027 generated report is missing the historical full-matrix build identity');
    assert(tech027[0].includes('requirements/active/honru-emoji-runtime-p0-20260811/current-build-single-browser-honru-art-202608162216.json'), 'TECH-027 generated report is missing historical Honru art narrow evidence');
    assert(tech027[0].includes('324922B8'), 'TECH-027 generated report is missing the historical Honru-art build identity');
    assert(tech027[0].includes('requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-t3-202608161627.json'), 'TECH-027 generated report is missing historical T3 narrow evidence');
    assert(tech027[0].includes('014E2886'), 'TECH-027 generated report is missing the historical T3 build identity');
    assert(tech027[0].includes('requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-202608160305.json'), 'TECH-027 generated report is missing P4 historical evidence');
    assert(tech027[0].includes('963F835'), 'TECH-027 generated report is missing the historical P4 build identity');
    assert(tech027[0].includes('1B26D7D5'), 'TECH-027 generated report is missing the historical T2 build identity');
    const hasCurrentFullMatrix = tech027[0].includes('已有与其匹配的当前五档四区/六款 Game Stage 完整单 Chromium 矩阵') ||
      tech027[0].includes('当前可见矩阵');
    assert(hasCurrentFullMatrix || tech027[0].includes('完整五档矩阵仍未执行') ||
      tech027[0].includes('尚无与其匹配的浏览器可见证据') ||
      (tech027[0].includes('并行写入尚未冻结') && tech027[0].includes('不得冒充当前稳定构建或浏览器证据')),
      'TECH-027 generated report must preserve either the current full-matrix evidence or the missing current full-matrix boundary');
    assert(!tech027[0].includes('当前证据以 T2'), 'TECH-027 generated report must not present historical T2 evidence as current');
    assert(!tech027[0].includes('当前 3D053273'), 'TECH-027 generated report must not present historical G Coins evidence as current');
  }
}

const archiveRoot = path.join(REPORT_DIR, '历史归档');
for (const filePath of fs.readdirSync(archiveRoot, { recursive:true })
  .filter(name => name.endsWith('.md'))
  .map(name => path.join(archiveRoot, name))) {
  const markdown = fs.readFileSync(filePath, 'utf8');
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (!rawTarget || /^(?:https?:|#|\/D:|[A-Za-z]:\\)/i.test(rawTarget)) continue;
    const targetWithoutAnchor = rawTarget.split('#')[0];
    const resolved = path.resolve(path.dirname(filePath), decodeURI(targetWithoutAnchor));
    assert(fs.existsSync(resolved), `archived report link does not exist: ${path.relative(ROOT, filePath)} -> ${rawTarget}`);
  }
}

const dependencyEdges = Object.values(ledger.dependencyGraph).reduce((sum, dependencies) => sum + dependencies.length, 0);
assert.strictEqual(dependencyEdges, EXPECTED_DEPENDENCY_EDGE_COUNT, 'dependency edge count drift');
console.log(`PROGRESS_LEDGER_ALL_PASS requirements=${ledger.requirements.length} reports=7 sources=${Object.keys(ledger.sourceCatalog).length} dependencyEdges=${dependencyEdges}`);
