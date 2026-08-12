#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const REPORT_DIR = path.join(ROOT, '简易报告');
const EXPECTED_SNAPSHOT_DATE = '2026-08-12';
const EXPECTED_CATEGORIES = {
  art: 'ART',
  ui: 'UI',
  game: 'GAME',
  social: 'SOC',
  economy: 'ECO',
  tech: 'TECH'
};
const EXPECTED_REQUIREMENT_COUNT = 242;
const EXPECTED_SOURCE_CATALOG_COUNT = 72;
const EXPECTED_DEPENDENCY_NODE_COUNT = 129;
const EXPECTED_DEPENDENCY_EDGE_COUNT = 267;
const EXPECTED_REQUEST_COVERAGE_GROUP_COUNT = 47;
const EXPECTED_CATEGORY_COUNTS = { art: 36, ui: 38, game: 52, social: 33, economy: 29, tech: 54 };
const VALID_STATUSES = new Set(['verified', 'implemented', 'partial', 'planned', 'not_executed', 'blocked']);
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_SOURCE_KINDS = new Set(['evidence', 'status', 'specification', 'origin']);

function occurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const TOTAL_REPORT = path.join(REPORT_DIR, `项目总需求进度报告-${ledger.snapshotDate.replace(/-/g, '')}.md`);
assert.strictEqual(ledger.schemaVersion, 2, 'ledger schemaVersion must be 2');
assert.strictEqual(ledger.snapshotDate, EXPECTED_SNAPSHOT_DATE, 'ledger snapshot date drift');
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
assert.strictEqual(requirementById.get('ART-019').status, 'partial', 'ART-019 must remain source-only partial until human gates close');
assert(requirementById.get('ART-019').source.includes('honru-pixel-avatar-source-p0'), 'ART-019 must retain Honru Pixel source evidence');
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
