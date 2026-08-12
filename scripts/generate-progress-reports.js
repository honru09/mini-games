#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const ROUTING_PATH = path.join(ROOT, 'requirements', 'MAINLINE_CONTROL_ROUTING.json');
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
  DEFERRED_MAINLINE: '主线后置',
  FUTURE_EXPANSION: '未来扩展'
};

function readLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function readRouting() {
  return JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf8'));
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
    implemented: '已有实现或资产，但仍缺验证、审批或生产闭环',
    partial: '只覆盖需求的一部分，仍需继续施工',
    planned: '需求已冻结，尚未开始产品实现',
    not_executed: '具备执行条件但尚未执行',
    blocked: '依赖凭证、自然人审批、真机或其他外部条件'
  }[status];
}

function makeAcceptance(item, ledger) {
  const profile = ledger.acceptanceProfiles[item.status];
  const stateLead = {
    verified: `“${item.title}”已在当前声明边界内完成并具备证据；`,
    implemented: `“${item.title}”已有实现或资产，但验收闭环尚未完成；`,
    partial: `“${item.title}”只完成了已明确记录的子范围；`,
    planned: `“${item.title}”需求已登记，产品实现尚未开始；`,
    not_executed: `“${item.title}”尚未执行指定的真实环境或人工验收；`,
    blocked: `“${item.title}”仍受外部条件阻塞；`
  }[item.status];
  return stateLead + profile;
}

function makeEvidenceRefs(item, ledger) {
  const refs = [...new Set(item.source.flatMap((source) => ledger.sourceCatalog[source].refs))];
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
    `- 下一阶段 / 动作：${item.next}`,
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
    '- `implemented` 不等于已验证或生产就绪，`blocked` 不得用自动化结果冒充外部验收。每项均显式列出前置依赖、追溯入口与验收口径。',
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
    return `| ${category.name} | ${items.length} | ${counts.verified || 0} | ${counts.implemented || 0} | ${counts.partial || 0} | ${counts.planned || 0} | ${counts.not_executed || 0} | ${counts.blocked || 0} | ${openLoop} | [${category.report}](./${encodeURI(category.report)}) |`;
  });
  return [
    '| 分类 | 总数 | 已验证 | 已实现待闭环 | 部分完成 | 已规划 | 未执行 | 受阻 | 未达 verified | 分报告 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
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

function makeMainlineRoutingTable(ledger, routingIndex) {
  const counts = Object.fromEntries(Object.keys(ROUTING_LABELS).map((disposition) => [disposition, 0]));
  for (const item of ledger.requirements) counts[routingIndex.get(item.id).disposition] += 1;
  return [
    '| 主线路由 | 数量 | 当前含义 |',
    '| --- | ---: | --- |',
    `| 当前收口（\`NOW_CLOSURE\`） | ${counts.NOW_CLOSURE} | 当前可施工或作为回归基线；不自动扩为新功能。 |`,
    `| 外部门禁（\`EXTERNAL_GATE\`） | ${counts.EXTERNAL_GATE} | 真实设备、真实数据或人工决议前保持阻塞。 |`,
    `| 主线后置（\`DEFERRED_MAINLINE\`） | ${counts.DEFERRED_MAINLINE} | 保留在产品范围内，按阶段顺序再冻结。 |`,
    `| 未来扩展（\`FUTURE_EXPANSION\`） | ${counts.FUTURE_EXPANSION} | 不进入当前产品收口。 |`
  ].join('\n');
}

function makeSharedGateTable(routing) {
  return [
    '| 共享 Gate | 状态 | 阶段 | 当前解除条件 |',
    '| --- | --- | --- | --- |',
    ...Object.entries(routing.sharedGates).map(([id, gate]) => `| \`${id}\` | ${gate.status} | ${gate.stage} | ${escapeCell(gate.requiredEvidence.join('；'))} |`)
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
  const categorySections = Object.entries(ledger.categories).flatMap(([key, category], index) => [
    `### ${index + 1}. ${category.name}`,
    '',
    makeFocusList(ledger, key),
    ''
  ]);

  return [
    `# Ghost Game 项目总需求进度报告（${reportDate(ledger)}）`,
    '',
    `> 快照时间：${reportDate(ledger)}（Asia/Tokyo）。机器事实源：\`requirements/PRODUCT_REQUIREMENTS_LEDGER.json\`。`,
    '',
    '## 结论与当前节点',
    '',
    `当前共收录 **${items.length} 项唯一原子需求**，分为六条互不混改的工作流。已验证关闭 **${counts.verified || 0}** 项；已有实现但仍待验证/审批 **${counts.implemented || 0}** 项；功能性未完成、未执行或受阻 **${functionalUnfinished}** 项；合计 **${openLoop}** 项尚未达到 \`verified\`。`,
    '',
    '当前产品节点分为两层：**线上仍是 `da3d05c` 的已发布基线；本地层包含尚未发布的 Playline、全局私信、Game Stage Wave B/Wave C、Gomoku Ghost3D 与 UI Motion Closure P1。** 六款 Wave C 过程表现和四区路由 Motion 都保持表现层、非权威状态，Rule/Authority/Protocol/Reward/Replay 不变。当前浏览器内核对最新本地构建立即返回 `Transport closed`，因此任何最新可见能力均保持 implemented/partial，不能冒充 visual verified。未审批 M0/P1/P2、Honru、Emoji、G Coins、Avatar 与游戏候选继续 source-only/reference-only/default-off。',
    '',
    '本轮先完成 CONTROL：每一个原子需求都有且只有一个主线路由。`NOW_CLOSURE` 中的已验证项只作回归基线，`EXTERNAL_GATE` 汇聚为三条共享 Gate，`DEFERRED_MAINLINE` 和 `FUTURE_EXPANSION` 不再与当前 Close 批次混合。只记录已落盘的本地实现/自动化事实，不冒充浏览器、真机、人工审批或线上发布。',
    '',
    '上述发布批次已在 `da3d05c` 完成线上验收；自该节点之后的后续本地改动继续使用 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND` 发布冻结标记：未收到新的明确发布指令前，未提交、未推送、未触发 GitHub Pages 或 Render。',
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
    '- `verified` 才是当前闭环；`implemented` 仍可能缺浏览器、真机、人工审批或生产证据。',
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
    '1. **CONTROL（当前）**：维护台账、路由、三个共享 Gate、状态语义和发布冻结；Defect/Acceptance Gap/Shared Repair 归回原 ID。',
    '2. **CLOSE / UI 与 Ghost3D 纵切**：Foundation、五子棋 Renderer 和四区 Route Motion 已建立窄 Interface；继续按现有 UI/Game Stage/资产原 ID 逐批收口，永久保留 fallback 与同步输入/路由语义。',
    '3. **PROVE**：第二浏览器、Android、iPhone、Tablet、横竖屏、三语言、双主题、reduced-motion 与真实网络。',
    '4. **DATA**：真实 Supabase、迁移、RLS、并发、加密备份、隔离恢复、非破坏回滚和多实例。',
    '5. **ART → PARITY → LOOP → COMMUNITY → PLATFORM**：依次推进人工 Golden Set 后的运行时美术、六款统一体验、快速开局/教学/经济闭环、受治理社区，最后才是原生/商店、新游戏和未来 Renderer。',
    '',
    '每批只服务单一主线目标。先建立独立 active task，冻结 IN/OUT、文件所有权、协议、回滚点和验收证据，再施工；外部门禁未解除时只准备下一阶段，不越过 Gate。',
    '',
    '## 明确尚未执行或受阻',
    '',
    '- Game Shell P0、Social Match P0、Player Character P0 与 UI-037/GAME-045 代码原生 fallback 已完成本地实现与验收；完整角色美术、UI 状态矩阵、真实设备和生产门禁仍须逐批验收。',
    '- 未执行真实 Supabase 数据库迁移、浏览器角色 RLS、并发、加密备份、隔离恢复与非破坏回滚。',
    '- 未执行 Android、iPhone、Tablet、第二桌面浏览器和真实网络整形。',
    '- 未完成 Honru/Sticker 人工清稿、独立 Reviewer B、IP Review 和用户 Golden Set 签字。',
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
