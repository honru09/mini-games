#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const ROUTING_PATH = path.join(ROOT, 'requirements', 'MAINLINE_CONTROL_ROUTING.json');
const STATUS_PATH = path.join(ROOT, 'PROJECT_STATUS.json');
const CURRENT_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'latest-browser-visible-matrix-prove-p4-20260815', 'evidence', 'current-local-browser-matrix-20260817.json');
const CURRENT_P5_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'latest-browser-visible-matrix-prove-p4-20260815', 'evidence', 'current-build-single-browser-verification-202608171945.json');
const CURRENT_T3_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'latest-browser-visible-matrix-prove-p4-20260815', 'evidence', 'current-build-single-browser-verification-t3-202608161627.json');
const HISTORICAL_T2_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'latest-browser-visible-matrix-prove-p4-20260815', 'evidence', 'current-build-single-browser-verification-t2-202608161530.json');
const HISTORICAL_P4_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'latest-browser-visible-matrix-prove-p4-20260815', 'evidence', 'current-build-single-browser-verification-202608160305.json');
const CURRENT_GCOINS_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'gcoins-presentation-unification-p1-20260815', 'evidence', 'current-build-single-browser-gcoins-202608151907.json');
const CURRENT_HONRU_BROWSER_EVIDENCE_PATH = path.join(ROOT, 'requirements', 'active', 'honru-emoji-runtime-p0-20260811', 'current-build-single-browser-honru-art-202608162216.json');
const REPORT_DIR = path.join(ROOT, '简易报告');
const STATUS_ORDER = ['verified', 'implemented', 'partial', 'planned', 'not_executed', 'blocked'];
const STATUS_LABELS = {
  verified: '已验证',
  implemented: '已实现待闭环',
  partial: '部分完成',
  planned: '已规划未实现',
  not_executed: '未执行',
  blocked: '受阻'
};
const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'];
const ROUTING_LABELS = {
  NOW_CLOSURE: '当前收口',
  EXTERNAL_GATE: '外部门禁',
  NON_BLOCKING_FOR_DEVELOPMENT: '开发开放、发布证据待决',
  DEFERRED_MAINLINE: '主线后置',
  FUTURE_EXPANSION: '未来扩展'
};

function readLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function readRouting() {
  return JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf8'));
}

function readStatus() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function currentBrowserEvidenceSummary() {
  const buildPath = path.join(ROOT, 'public', 'index.html');
  if (!fs.existsSync(buildPath)) {
    return '当前构建尚无可验证的单浏览器证据；历史矩阵不能替代当前构建。';
  }
  const build = fs.readFileSync(buildPath);
  const sha = crypto.createHash('sha256').update(build).digest('hex').toUpperCase();
  const drift = readStatus().parallelBuildDrift20260819;
  if (drift && drift.status === 'active' && drift.artifact && drift.expectedFromSources && drift.artifact.sha256 === sha) {
    return `并行前端/3D 窗口仍在写入：现有构建产物 SHA-256 ${sha} 落后于当前源码期望 ${drift.expectedFromSources.sha256}，两者均不能冒充稳定当前构建或当前浏览器证据。`;
  }
  if (fs.existsSync(CURRENT_P5_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_P5_BROWSER_EVIDENCE_PATH, 'utf8'));
    const isCurrent = evidence.build && evidence.build.sha256 === sha && evidence.build.bytes === build.length;
    if (isCurrent && evidence.currency === 'current' && evidence.claim === 'current_build_single_browser_visible_matrix_p4' && evidence.fullRouteMatrixCurrentBuild === true) {
      return `单一 Codex in-app Chromium 已对当前 SHA-256 ${sha} 完成五档视口 × Home/Games/Playline/Profile 20/20、Shop/DM/成就/房间大厅、六款 Game Stage、三语言、双主题、visible reduced-motion、forced-colors、深滚动回顶、零横溢出、零裸 key 与 console 0 的当前可见矩阵；第二浏览器、真机和真实网络仍是发布证据待决。`;
    }
  }
  if (fs.existsSync(CURRENT_HONRU_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_HONRU_BROWSER_EVIDENCE_PATH, 'utf8'));
    const isCurrent = evidence.build && evidence.build.sha256 === sha && evidence.build.bytes === build.length;
    if (isCurrent && evidence.currency === 'current' && evidence.claim === 'current_build_single_browser_honru_art_runtime_partial') {
      return `单一 Codex in-app Chromium 已对当前 SHA-256 ${sha} 完成 Honru/Emoji 窄范围可见复核：idle/check-in、十枚 Emoji 选择器、头像气泡、目标席位投掷、reduced-motion、390×844、三语言、双主题与该场景 console 0；两个 hostname 会话只用于存储隔离，不是第二浏览器，也不宣称当前五档四区/六款 Game Stage 完整矩阵。`;
    }
  }
  if (fs.existsSync(CURRENT_T3_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_T3_BROWSER_EVIDENCE_PATH, 'utf8'));
    const isCurrent = evidence.build && evidence.build.sha256 === sha && evidence.build.bytes === build.length;
    if (isCurrent && evidence.currency === 'current' && evidence.claim === 'current_build_single_browser_narrow_t3') {
      return `单一 Codex in-app Chromium 已对当前 SHA-256 ${sha} 完成 T3 窄范围复核：568×726 四区、Tetris/Tank 默认关闭回归、零横溢出/裸 key 与最终清理；未采集 console，且不宣称当前五档完整矩阵、第二浏览器、真机或真实网络 Gate。`;
    }
  }
  if (fs.existsSync(CURRENT_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_BROWSER_EVIDENCE_PATH, 'utf8'));
    const isCurrent = evidence.build && evidence.build.sha256 === sha && evidence.build.bytes === build.length;
    if (isCurrent && evidence.coverage && evidence.coverage.fullRouteMatrixCurrentBuild === true) {
      return `单一 Codex in-app Chromium 已完成与当前 SHA-256 ${sha} 匹配的五档四区、共享弹层、六款 Game Stage、三语言、双主题、reduced-motion 与 forced-colors 可见矩阵。`;
    }
  }

  if (fs.existsSync(CURRENT_GCOINS_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_GCOINS_BROWSER_EVIDENCE_PATH, 'utf8'));
    const isCurrent = evidence.build && evidence.build.sha256 === sha && evidence.build.bytes === build.length;
    if (isCurrent && evidence.claim === 'current_build_single_browser_gcoins_presentation_partial') {
      return `旧五档四区完整矩阵只保留为 historical as-of；单一 Codex in-app Chromium 已对当前 SHA-256 ${sha} 完成 Profile、Shop、排行榜、玩家列表、三语言、双主题与 390×844 的 G Coins 窄范围可见复核，不能冒充当前完整矩阵。`;
    }
  }

  return `现有单浏览器证据与当前构建哈希不一致，只能作为历史 as-of 证据；当前 SHA-256 为 ${sha}。`;
}

function readHistoricalBrowserBuildIdentity(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`missing TECH-027 historical evidence: ${path.relative(ROOT, filePath)}`);
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const build = evidence && evidence.build;
  if (evidence.currency !== 'historical_as_of' || !build || !/^[A-F0-9]{64}$/i.test(String(build.sha256 || '')) ||
      !Number.isSafeInteger(build.characters) || build.characters < 1 || !Number.isSafeInteger(build.bytes) || build.bytes < 1) {
    throw new Error(`invalid TECH-027 historical build identity: ${label}`);
  }
  return {
    label,
    sha256:String(build.sha256).toUpperCase(),
    characters:build.characters,
    bytes:build.bytes,
  };
}

function tech027BuildIdentitySummary() {
  const buildPath = path.join(ROOT, 'public', 'index.html');
  if (!fs.existsSync(buildPath)) throw new Error('missing current public/index.html for TECH-027 build identity');
  const current = fs.readFileSync(buildPath);
  const currentSha = crypto.createHash('sha256').update(current).digest('hex').toUpperCase();
  const drift = readStatus().parallelBuildDrift20260819;
  let currentVisible = '尚无与其匹配的浏览器可见证据';
  if (fs.existsSync(CURRENT_P5_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_P5_BROWSER_EVIDENCE_PATH, 'utf8'));
    if (evidence.currency === 'current' && evidence.claim === 'current_build_single_browser_visible_matrix_p4' && evidence.fullRouteMatrixCurrentBuild === true &&
        evidence.build && evidence.build.sha256 === currentSha && evidence.build.bytes === current.length) {
      currentVisible = '已有与其匹配的当前五档四区/六款 Game Stage 完整单 Chromium 矩阵';
    }
  }
  if (currentVisible === '尚无与其匹配的浏览器可见证据' && fs.existsSync(CURRENT_HONRU_BROWSER_EVIDENCE_PATH)) {
    const evidence = JSON.parse(fs.readFileSync(CURRENT_HONRU_BROWSER_EVIDENCE_PATH, 'utf8'));
    if (evidence.currency === 'current' && evidence.claim === 'current_build_single_browser_honru_art_runtime_partial' &&
        evidence.build && evidence.build.sha256 === currentSha && evidence.build.bytes === current.length) {
      currentVisible = '已有与其匹配的 Honru/Emoji 单 Chromium 窄证据，但尚无当前五档四区/六款 Game Stage 完整矩阵';
    }
  }
  const t3 = readHistoricalBrowserBuildIdentity(CURRENT_T3_BROWSER_EVIDENCE_PATH, 'T3 narrow');
  const t2 = readHistoricalBrowserBuildIdentity(HISTORICAL_T2_BROWSER_EVIDENCE_PATH, 'T2 full matrix');
  const p4 = readHistoricalBrowserBuildIdentity(HISTORICAL_P4_BROWSER_EVIDENCE_PATH, 'P4 full matrix');
  const p5 = readHistoricalBrowserBuildIdentity(CURRENT_P5_BROWSER_EVIDENCE_PATH, 'latest historical full matrix');
  const honru = readHistoricalBrowserBuildIdentity(CURRENT_HONRU_BROWSER_EVIDENCE_PATH, 'Honru directed-throw narrow');
  const currentIdentity = drift && drift.status === 'active' && drift.artifact && drift.expectedFromSources && drift.artifact.sha256 === currentSha
    ? `构建身份边界：并行写入尚未冻结，现有产物 SHA-256 \`${currentSha}\` / ${current.length.toLocaleString('en-US')} bytes，源码期望 \`${drift.expectedFromSources.sha256}\` / ${Number(drift.expectedFromSources.bytes).toLocaleString('en-US')} bytes；两者尚未闭环且不得冒充当前稳定构建或浏览器证据；`
    : `构建身份边界：当前本地构建为 SHA-256 \`${currentSha}\` / ${current.length.toLocaleString('en-US')} bytes，${currentVisible}；`;
  return currentIdentity +
    `最近完整单浏览器矩阵 \`${p5.sha256}\`、Honru 定向投掷窄证据 \`${honru.sha256}\`、T3 窄证据 \`${t3.sha256}\`、历史 T2 五档矩阵 \`${t2.sha256}\` 与历史 P4 五档矩阵 \`${p4.sha256}\` 均仅为 historical-as-of，绝不冒充当前。`;
}

function makeRoutingIndex(ledger, routing) {
  const byRequirement = new Map();
  for (const group of routing.routingGroups || []) {
    for (const id of group.ids || []) {
      if (byRequirement.has(id)) throw new Error(`duplicate routing assignment: ${id}`);
      byRequirement.set(id, group);
    }
  }
  for (const item of ledger.requirements) {
    if (!byRequirement.has(item.id)) throw new Error(`missing routing assignment: ${item.id}`);
  }
  return byRequirement;
}

function reportDate(ledger) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.snapshotDate || '')) {
    throw new Error('ledger snapshotDate must use YYYY-MM-DD');
  }
  return ledger.snapshotDate;
}

function compactReportDate(ledger) {
  return reportDate(ledger).replace(/-/g, '');
}

function countBy(items, field, order = []) {
  const counts = new Map();
  for (const item of items) counts.set(item[field], (counts.get(item[field]) || 0) + 1);
  const keys = [...new Set([...order, ...counts.keys()])].filter((key) => counts.has(key));
  return keys.map((key) => [key, counts.get(key)]);
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function makeStatsTable(items) {
  const counts = Object.fromEntries(countBy(items, 'status', STATUS_ORDER));
  return [
    '| 状态 | 数量 | 含义 |',
    '| --- | ---: | --- |',
    ...STATUS_ORDER.map((status) => `| ${STATUS_LABELS[status]}（\`${status}\`） | ${counts[status] || 0} | ${statusMeaning(status)} |`)
  ].join('\n');
}

function statusMeaning(status) {
  return {
    verified: '实现和当前证据均通过，可作为现状基线',
    implemented: '已有实现或资产，但仍缺当前验证或最终闭环证据',
    partial: '只覆盖需求的一部分，仍需继续施工',
    planned: '需求已冻结，尚未开始产品实现',
    not_executed: '具备执行条件但尚未执行',
    blocked: '仍有台账记录的未满足条件；共享 Gate 的开发与发布效应以权威路由为准'
  }[status];
}

function makeAcceptance(item, ledger) {
  const profile = ledger.acceptanceProfiles[item.status];
  const stateLead = {
    verified: `“${item.title}”已在当前声明边界内完成并具备证据；`,
    implemented: `“${item.title}”已有实现或资产，但验收闭环尚未完成；`,
    partial: `“${item.title}”只完成了已明确记录的子范围；`,
    planned: `“${item.title}”需求已登记，产品实现尚未开始；`,
    not_executed: `“${item.title}”尚未执行台账指定的验收；共享 Gate 的开发与发布效应以主线路由为准；`,
    blocked: `“${item.title}”仍有台账记录的未满足条件；共享 Gate 是否限制开发或发布以主线路由为准；`
  }[item.status];
  return stateLead + profile;
}

function makeEvidenceRefs(item, ledger) {
  const directEvidence = Array.isArray(item.evidence) ? item.evidence.filter(Boolean) : [];
  const refs = [...new Set(directEvidence.length
    ? directEvidence
    : item.source.flatMap((source) => ledger.sourceCatalog[source].refs))];
  return refs.map((ref) => `\`${ref}\``).join('、');
}

function routeText(route) {
  const gate = route.gate ? `；共享 Gate：\`${route.gate}\`` : '';
  return `${ROUTING_LABELS[route.disposition]}（\`${route.disposition}\`）/ ${route.stage}${gate}`;
}

function makeRoutingStatsTable(items, routingIndex) {
  const counts = Object.fromEntries(Object.keys(ROUTING_LABELS).map((disposition) => [disposition, 0]));
  for (const item of items) counts[routingIndex.get(item.id).disposition] += 1;
  return [
    '| 主线路由 | 数量 |',
    '| --- | ---: |',
    ...Object.entries(ROUTING_LABELS).map(([disposition, label]) => `| ${label}（\`${disposition}\`） | ${counts[disposition]} |`)
  ].join('\n');
}

function makeRequirement(item, ledger, routingIndex) {
  const related = item.related && item.related.length ? item.related.join('、') : '无';
  const dependencies = ledger.dependencyGraph[item.id] || [];
  const route = routingIndex.get(item.id);
  const dependencyText = dependencies.length
    ? dependencies.map((id) => {
      const dependency = ledger.requirements.find((candidate) => candidate.id === id);
      return `${id}（${STATUS_LABELS[dependency.status]}）`;
    }).join('、')
    : '无明确前置依赖';
  const nextText = item.id === 'TECH-027'
    ? `${currentBrowserEvidenceSummary()} ${tech027BuildIdentitySummary()} 当前构建哈希与证据匹配情况由本报告“当前节点”动态计算；第二浏览器、物理设备、真实网络与生产证据仍未执行。`
    : item.next;
  return [
    `### ${item.id}｜${item.title}`,
    '',
    `- 状态：${STATUS_LABELS[item.status]}（\`${item.status}\`）`,
    `- 优先级 / 当前阶段：${item.priority} / ${item.phase}`,
    `- 主线路由：${routeText(route)}`,
    `- 前置依赖：${dependencyText}`,
    `- 来源：${item.source.join('、')}`,
    `- 当前证据入口：${makeEvidenceRefs(item, ledger)}`,
    `- 验收口径：${makeAcceptance(item, ledger)}`,
    `- 下一阶段 / 动作：${nextText}`,
    `- 关联需求：${related}`,
    ''
  ].join('\n');
}

function makeCategoryReport(ledger, categoryKey, routingIndex) {
  const category = ledger.categories[categoryKey];
  const items = ledger.requirements.filter((item) => item.category === categoryKey);
  const verified = items.filter((item) => item.status === 'verified').length;
  const implemented = items.filter((item) => item.status === 'implemented').length;
  const unfinished = items.filter((item) => ['partial', 'planned', 'not_executed', 'blocked'].includes(item.status)).length;
  const openLoop = items.length - verified;
  const priorityRows = countBy(items, 'priority', PRIORITY_ORDER)
    .map(([priority, count]) => `| ${priority} | ${count} |`)
    .join('\n');
  const phaseRows = countBy(items, 'phase')
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    .map(([phase, count]) => `| ${escapeCell(phase)} | ${count} |`)
    .join('\n');

  return [
    `# ${category.name}进度报告（${reportDate(ledger)}）`,
    '',
    '> 本报告由 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 自动生成。它是该领域唯一计数视图；跨领域关系只通过“关联需求”引用，不重复计数。',
    '',
    '## 当前节点',
    '',
    `该领域共有 **${items.length}** 项唯一需求：已验证 ${verified} 项，已实现待闭环 ${implemented} 项，功能性未完成/未执行/受阻 ${unfinished} 项；尚未达到 \`verified\` 的开放闭环共 ${openLoop} 项。`,
    `距离最终目标：本地实现进度 **${averageProgress(items, LOCAL_PROGRESS_POINTS).toFixed(1)}%**；最终闭环进度 **${averageProgress(items, FINAL_PROGRESS_POINTS).toFixed(1)}%**。百分比使用总报告中的固定状态权重，不能替代真实浏览器、真机或生产发布证据；可选人工/IP 咨询未执行时不得伪造为 PASS，但不因此阻断开发。`,
    '',
    makeStatsTable(items),
    '',
    '## 主线路由',
    '',
    makeRoutingStatsTable(items, routingIndex),
    '',
    '## 优先级与阶段',
    '',
    '| 优先级 | 数量 |',
    '| --- | ---: |',
    priorityRows,
    '',
    '| 阶段 | 数量 |',
    '| --- | ---: |',
    phaseRows,
    '',
    '## 执行纪律',
    '',
    '- 本领域与其他领域分轨施工；一次 active task 只冻结一组明确所有权文件和验收证据。',
    '- `implemented` 不等于已验证或生产就绪，自动化结果不得冒充真实设备、生产环境或未执行的人工/IP PASS；共享 Gate 的开发与发布效应严格按权威路由解释。每项均显式列出前置依赖、追溯入口与验收口径。',
    '- 分类报告只记录事实状态；每个 active task 仍须独立冻结、实现和验收。未经用户当前任务明确指令，不提交、不推送、不部署。',
    '',
    '## 原子需求明细',
    '',
    ...items.map((item) => makeRequirement(item, ledger, routingIndex))
  ].join('\n').trimEnd() + '\n';
}

function makeCategorySummary(ledger) {
  const rows = Object.entries(ledger.categories).map(([key, category]) => {
    const items = ledger.requirements.filter((item) => item.category === key);
    const counts = Object.fromEntries(countBy(items, 'status', STATUS_ORDER));
    const openLoop = items.length - (counts.verified || 0);
    return `| ${category.name} | ${items.length} | ${counts.verified || 0} | ${counts.implemented || 0} | ${counts.partial || 0} | ${counts.planned || 0} | ${counts.not_executed || 0} | ${counts.blocked || 0} | ${openLoop} | ${averageProgress(items, LOCAL_PROGRESS_POINTS).toFixed(1)}% | ${averageProgress(items, FINAL_PROGRESS_POINTS).toFixed(1)}% | [${category.report}](./${encodeURI(category.report)}) |`;
  });
  return [
    '| 分类 | 总数 | 已验证 | 已实现待闭环 | 部分完成 | 已规划 | 未执行 | 受阻 | 未达 verified | 本地实现进度 | 最终闭环进度 | 分报告 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows
  ].join('\n');
}

function makeRequestCoverageTable(ledger) {
  return [
    '| 覆盖组 | 历史/当前需求主题 | 对应原子需求 |',
    '| --- | --- | --- |',
    ...Object.entries(ledger.requestCoverage).map(([key, group]) => `| \`${key}\` | ${escapeCell(group.label)} | ${group.ids.join('、')} |`)
  ].join('\n');
}

function makeFocusList(ledger, categoryKey, limit = 8) {
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const statusRank = { partial: 0, implemented: 1, planned: 2, not_executed: 3, blocked: 4, verified: 5 };
  return ledger.requirements
    .filter((item) => item.category === categoryKey && item.status !== 'verified')
    .sort((a, b) => rank[a.priority] - rank[b.priority] || statusRank[a.status] - statusRank[b.status] || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((item) => `- ${item.id} ${item.title}｜${STATUS_LABELS[item.status]}｜下一步：${item.next}`)
    .join('\n') || '- 当前无开放需求。';
}

const LOCAL_PROGRESS_POINTS = {
  verified: 100,
  implemented: 100,
  partial: 50,
  planned: 0,
  not_executed: 0,
  blocked: 0
};

const FINAL_PROGRESS_POINTS = {
  verified: 100,
  implemented: 75,
  partial: 40,
  planned: 10,
  not_executed: 0,
  blocked: 0
};

function averageProgress(items, points) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + points[item.status], 0) / items.length;
}

function makeMainlineProgressSummary(ledger, routing) {
  const rows = Object.entries(ledger.categories).map(([key, category]) => {
    const items = ledger.requirements.filter((item) => item.category === key);
    return `| ${category.name} | ${items.length} | ${averageProgress(items, LOCAL_PROGRESS_POINTS).toFixed(1)}% | ${averageProgress(items, FINAL_PROGRESS_POINTS).toFixed(1)}% |`;
  });
  const totalLocal = averageProgress(ledger.requirements, LOCAL_PROGRESS_POINTS).toFixed(1);
  const totalFinal = averageProgress(ledger.requirements, FINAL_PROGRESS_POINTS).toFixed(1);
  return [
    `当前主线切换：${routing.authority.currentStage} → ${routing.authority.nextStage}。以下百分比由 242 项唯一需求自动计算，作为“距离最终目标”的治理快照，不是视觉验收或发布授权。`,
    '',
    '| 方向 | 需求数 | 本地实现进度 | 最终闭环进度 |',
    '| --- | ---: | ---: | ---: |',
    ...rows,
    `| **整体** | **${ledger.requirements.length}** | **${totalLocal}%** | **${totalFinal}%** |`,
    '',
    '- 本地实现进度：`verified`/`implemented` 计 100，`partial` 计 50，其余计 0。',
    '- 最终闭环进度：`verified` 计 100，`implemented` 计 75，`partial` 计 40，`planned` 计 10，`not_executed`/`blocked` 计 0；它会保留浏览器、真机、Supabase、逐资产所有者美术清除和发布证据的真实缺口。',
    '- 以后每次主线从一个阶段切换到下一个阶段，生成器都会在这里留下同样格式的切换快照。'
  ].join('\n');
}

function makeAllCategoryDetails(ledger, routingIndex) {
  return Object.entries(ledger.categories).flatMap(([key, category], index) => {
    const items = ledger.requirements.filter((item) => item.category === key);
    return [
      `### ${index + 1}. ${category.name}`,
      '',
      `该分类完整收录 ${items.length} 项原子需求；以下按台账顺序展示，便于从状态、依赖、证据和下一步一路阅读。`,
      '',
      makeStatsTable(items),
      '',
      ...items.map((item) => makeRequirement(item, ledger, routingIndex)),
      ''
    ];
  });
}

function makeMainlineRoutingTable(ledger, routingIndex) {
  const counts = Object.fromEntries(Object.keys(ROUTING_LABELS).map((disposition) => [disposition, 0]));
  for (const item of ledger.requirements) counts[routingIndex.get(item.id).disposition] += 1;
  return [
    '| 主线路由 | 数量 | 当前含义 |',
    '| --- | ---: | --- |',
    `| 当前收口（\`NOW_CLOSURE\`） | ${counts.NOW_CLOSURE} | 当前可施工或作为回归基线；不自动扩为新功能。 |`,
    `| 开发开放、发布证据待决（\`NON_BLOCKING_FOR_DEVELOPMENT\`） | ${counts.NON_BLOCKING_FOR_DEVELOPMENT} | 开发、内部预览、机器回归与可逆原创候选接入继续；设备和 Supabase 仍为 \`RELEASE_EVIDENCE_PENDING\`，原创美术按 \`OWNER_AUTHORIZED_ART_CLEARANCE\` 推进且不得伪造人工/IP PASS。 |`,
    `| 外部门禁（\`EXTERNAL_GATE\`） | ${counts.EXTERNAL_GATE} | 当前无需求停在纯开发阻塞路由；该词仅保留为发布证据/兼容语义，不把真实设备、生产环境或可选人工/IP 咨询解释为开发阻塞。 |`,
    `| 主线后置（\`DEFERRED_MAINLINE\`） | ${counts.DEFERRED_MAINLINE} | 保留在产品范围内，按阶段顺序再冻结。 |`,
    `| 未来扩展（\`FUTURE_EXPANSION\`） | ${counts.FUTURE_EXPANSION} | 不进入当前产品收口。 |`
  ].join('\n');
}

function makeSharedGateTable(routing) {
  return [
    '| 共享 Gate | 状态 | 开发状态 | 发布状态 | 阶段 | 当前证据要求 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...Object.entries(routing.sharedGates).map(([id, gate]) => `| \`${id}\` | ${gate.status} | ${gate.developmentStatus || '按状态解释'} | ${gate.releaseStatus || '按状态解释'} | ${gate.stage} | ${escapeCell(gate.requiredEvidence.join('；'))} |`)
  ].join('\n');
}

function makeTotalReport(ledger, routing, routingIndex) {
  const items = ledger.requirements;
  const counts = Object.fromEntries(countBy(items, 'status', STATUS_ORDER));
  const functionalUnfinished = ['partial', 'planned', 'not_executed', 'blocked']
    .reduce((sum, status) => sum + (counts[status] || 0), 0);
  const openLoop = items.length - (counts.verified || 0);
  const dependencyNodes = Object.keys(ledger.dependencyGraph).length;
  const dependencyEdges = Object.values(ledger.dependencyGraph).reduce((sum, dependencies) => sum + dependencies.length, 0);
  const categorySections = makeAllCategoryDetails(ledger, routingIndex);
  const onlineBaseline = String(readStatus().lastReleasedCommit || '').slice(0, 7) || 'unknown';
  const browserEvidenceSummary = currentBrowserEvidenceSummary();

  return [
    `# Ghost Game 项目总需求进度报告（${reportDate(ledger)}）`,
    '',
    `> 快照时间：${reportDate(ledger)}（Asia/Tokyo）。机器事实源：\`requirements/PRODUCT_REQUIREMENTS_LEDGER.json\`。`,
    '',
    '## 结论与当前节点',
    '',
    `当前共收录 **${items.length} 项唯一原子需求**，分为六条互不混改的工作流。已验证关闭 **${counts.verified || 0}** 项；已有实现但仍待当前验证或最终闭环证据 **${counts.implemented || 0}** 项；功能性未完成、未执行或受阻 **${functionalUnfinished}** 项；合计 **${openLoop}** 项尚未达到 \`verified\`。`,
    '',
    `当前产品节点分为两层：**线上是 \`${onlineBaseline}\` 的已发布基线；本地层包含尚未发布的 Playline、全局私信、Game Stage Wave B/Wave C、六款 default-on 且可 exact-zero 回滚的 Ghost3D、UI Motion Closure P1、PWA Offline i18n v13 修复、G Coins 表现统一、T5 传输修复、T6 shadow，以及 T7 六类 Server Boundary、Node fresh-child、Reward/Economy outbox、Reward/Progression Projection 与 P8–P12 Clock/Timer owner 纵切。** 本地预检覆盖 Tetris 乱序/重复、Tank frame/tick 高水位、codec 健康协商、旧 WebSocket callback 与 DM 数值序去重；它不是实际网络整形。T7 继续保持 partial；P12 已迁移 heartbeat owner、单次时间采样和分域异常隔离，剩余正式 token TTL、其他 lifecycle、outbox/gameplay/transport timer 与 Metrics generatedAt 尚未迁移。${browserEvidenceSummary} Service Worker v13 的安全更新链与三语词典回退证据继续单独成立。第二浏览器、物理真机/触控、真实网络、线上最新构建、真实 Supabase 与真实性能仍未执行；设备与 Supabase Gate 是 NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING。原创美术 Gate 已 OPEN_BY_OWNER_AUTHORIZATION；现有候选在逐族取得 OWNER_AUTHORIZED_ART_CLEARANCE 前仍保持原状态，但人工/Reviewer B/IP/Golden Set 咨询不再阻塞开发、runtime 或未来发布候选，且未执行时不得冒充 PASS。`,
    '',
    `CONTROL 已完成；权威路由当前仍为 \`${routing.authority.currentStage}\`，本地收口证据已准备好，下一授权阶段为 \`${routing.authority.nextStage}\` 取证：每一个原子需求都有且只有一个主线路由。\`NOW_CLOSURE\` 中的已验证项只作回归基线，\`NON_BLOCKING_FOR_DEVELOPMENT\` 收录开发可继续但发布证据仍待补齐的需求；三条共享 Gate 分别记录设备/网络、Supabase 生产证据与原创美术所有者清除，\`DEFERRED_MAINLINE\` 和 \`FUTURE_EXPANSION\` 不与当前取证批次混合。可确定性验证项默认由机器继续；设备与 Supabase 缺口只限制相应发布证据。原创 Ghost-native 美术使用 OWNER_AUTHORIZED_ART_CLEARANCE，人工清稿、独立 Reviewer B、IP/法律意见与逐资产 Golden Set 是 OPTIONAL_ADVISORY_EVIDENCE，不得伪造成 PASS，也不得继续作为施工或未来发布候选阻塞。任何线上发布仍只接受用户当前明确命令。`,
    '',
    `上述线上基线 \`${onlineBaseline}\` 已完成首页字节核对；自该节点之后的后续本地改动继续使用 \`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND\` 发布冻结标记：未收到新的明确发布指令前，未提交、未推送、未触发 GitHub Pages 或 Render。`,
    '',
    '## 主线切换总结与各方向百分比',
    '',
    makeMainlineProgressSummary(ledger, routing),
    '',
    '## 总体状态统计',
    '',
    makeStatsTable(items),
    '',
    '## 总指挥路由与共享 Gate',
    '',
    makeMainlineRoutingTable(ledger, routingIndex),
    '',
    makeSharedGateTable(routing),
    '',
    makeCategorySummary(ledger),
    '',
    '## 可维护性与追溯完整度',
    '',
    `- 台账 Schema：v${ledger.schemaVersion}；来源词典 ${Object.keys(ledger.sourceCatalog).length} 项，全部需求来源均可解析到仓库内追溯入口。`,
    `- 前置依赖图：${dependencyNodes} 个有显式前置条件的需求、${dependencyEdges} 条有向依赖；其余需求明确显示“无明确前置依赖”。`,
    `- 历史/当前请求覆盖索引：${Object.keys(ledger.requestCoverage).length} 个主题组，联合覆盖全部 ${items.length} 个原子需求；QA 会拒绝未知 ID 或未被任何主题组覆盖的需求。`,
    '- 六种状态各有固定验收口径；每个分类报告逐项展示当前状态、当前阶段、前置依赖、来源、证据入口、验收口径、下一阶段/动作和关联需求。',
    '- `verified` 必须至少包含一个当前实现、测试、状态或发布证据入口；只有用户需求原文而没有证据时不得标记为已验证。',
    '',
    '## 需求口径与冲突裁决',
    '',
    '- 当前唯一游戏范围是五子棋、飞行棋、迷你大富翁、坦克大战、俄罗斯方块、象棋六款；玩法为人机和联机。',
    '- 旧白皮书的 11 款、三模式范围已被后续决策替代；井字棋、弹珠跳棋、斗兽棋、国际跳棋、贪吃蛇等不得恢复。',
    '- 当前源码、测试和最新证据优先于历史报告；历史报告优先于外部旧白皮书和旧清单。',
    '- 同一需求只在一个分类计数，跨领域只用 `related` 关联，避免总数膨胀。',
    '- `verified` 才是当前闭环；`implemented` 仍可能缺浏览器、真机或生产发布证据，也可能尚未记录可选人工/IP 风险咨询；后者不阻断开发且不得伪造成 PASS。',
    '- Honru 手柄形 Logo 固定为品牌标识，正式角色是独立角色资产；二者不得互相覆盖。',
    '- 图片生成必须使用最高质量图像模型和设置；只有冻结合同下达到实质等价并经人工可见对比，才可下放给 `gpt-5.6-terra max`。',
    '',
    '## 历史与当前请求覆盖索引',
    '',
    '该索引用来防止跨窗口需求再次“消失”。一个原子需求可以服务多个主题，但仍只在自己的分类中计数一次。',
    '',
    makeRequestCoverageTable(ledger),
    '',
    '## 当前最重要的开放需求',
    '',
    ...categorySections,
    '## 单主线执行顺序',
    '',
    '1. **CONTROL（已完成，持续守护）**：维护台账、路由、三个共享 Gate、状态语义和发布冻结；Defect/Acceptance Gap/Shared Repair 归回原 ID。',
    '2. **CLOSE / UI、Ghost3D、PWA 与 G Coins 收口（持续推进）**：Foundation、六款 Renderer、四区 Route Motion、PWA Offline i18n v13 与 G Coins 复合金额均已建立窄边界并保留 fallback；继续完成 CLOSE 中尚未收口的本地批次，同时准备 PROVE 的发布证据。',
    '3. **PROVE**：补齐第二浏览器、Android、iPhone、Tablet、横竖屏、三语言、双主题、reduced-motion 与真实网络发布证据；缺少这些环境不阻断继续开发。',
    '4. **DATA**：准备并在授权环境中验证真实 Supabase、迁移、RLS、并发、加密备份、隔离恢复、非破坏回滚和多实例；缺生产凭证时继续合同、fake adapter 与可逆修正，不冒充生产事实。',
    '5. **ART → PARITY → LOOP → COMMUNITY → PLATFORM**：原创 Ghost-native 美术按 OWNER_AUTHORIZED_ART_CLEARANCE 进入可逆 runtime 候选，人工清稿/Reviewer B/IP/Golden Set 仅作可选风险咨询；随后推进六款统一体验、快速开局/教学/经济闭环、受治理社区，最后才是原生/商店、新游戏和未来 Renderer。',
    '',
    '每批只服务单一主线目标。先建立独立 active task，冻结 IN/OUT、文件所有权、协议、回滚点和验收证据，再施工；共享 Gate 缺口不阻断开发，但不得越级声称跨设备、生产数据、人工/IP PASS 或已获发布授权。',
    '',
    '## 明确尚未执行或受阻',
    '',
    '- Game Shell P0、Social Match P0、Player Character P0 与 UI-037/GAME-045 代码原生 fallback 已完成本地实现与验收；完整角色美术、UI 状态矩阵、真实设备和生产门禁仍须逐批验收。',
    '- 未执行真实 Supabase 数据库迁移、浏览器角色 RLS、并发、加密备份、隔离恢复与非破坏回滚。',
    '- 未执行 Android、iPhone、Tablet、第二桌面浏览器和真实网络整形。',
    '- Honru/Sticker 的人工清稿、独立 Reviewer B、IP Review 和额外 Golden Set 咨询尚未执行；它们是可选风险证据，不阻断开发，也不得伪造成 PASS。',
    '- 未执行多实例生产扩容、真实外部遥测接收端、微信小程序、原生 App 或商店发行。',
    '- 未提交、未推送、未触发 GitHub Pages 或 Render；等待用户明确说“输出线上 / 推送 / 部署”。',
    '',
    '## 报告索引',
    '',
    ...Object.values(ledger.categories).map((category) => `- [${category.report}](./${encodeURI(category.report)})`),
    '',
    '## 下次更新规则',
    '',
    '- 每项产品改动结束后先更新 ledger 的状态、下一步和证据，再重新生成七份报告。',
    '- 一个 ID 只允许存在一次；新增需求必须分配唯一前缀 ID，删除需求要保留裁决记录而不是静默消失。',
    '- 报告由生成器覆盖，禁止直接手改生成报告；修改事实应编辑 ledger。',
    '- 未收到用户明确发布命令前，任务结尾必须停在本地验收状态。',
    ''
  ].join('\n');
}

function writeIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (previous === content) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function main() {
  const ledger = readLedger();
  const routing = readRouting();
  const routingIndex = makeRoutingIndex(ledger, routing);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const writes = [];
  writes.push([`项目总需求进度报告-${compactReportDate(ledger)}.md`, makeTotalReport(ledger, routing, routingIndex)]);
  for (const key of Object.keys(ledger.categories)) {
    writes.push([ledger.categories[key].report, makeCategoryReport(ledger, key, routingIndex)]);
  }
  let changed = 0;
  for (const [filename, content] of writes) {
    if (writeIfChanged(path.join(REPORT_DIR, filename), content)) changed += 1;
  }
  console.log(`PROGRESS_REPORTS_OK files=${writes.length} changed=${changed} requirements=${ledger.requirements.length}`);
}

main();
