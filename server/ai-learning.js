'use strict';

const crypto = require('crypto');

const VALID_GAMES = Object.freeze(['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi']);
const MODEL_VERSION = 'personal-linear-v2';
const SKILL_VERSION = 'game-skill-v1';
const MAX_FEATURES = 24;
const MAX_DECISIONS_PER_MATCH = 300;
const MAX_EXPERIENCES = 20000;
const MAX_APPLIED_RESULTS = 50000;

function clamp(value, min, max){
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function safeString(value, maxLength){
  return String(value === undefined || value === null ? '' : value).slice(0, maxLength);
}

function normalizeFeatureVector(value){
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, MAX_FEATURES)){
    const key = safeString(rawKey, 32);
    const number = Number(rawValue);
    if (!/^[a-z][a-z0-9_]{0,31}$/i.test(key) || !Number.isFinite(number)) continue;
    output[key] = clamp(number, -1, 1);
  }
  return output;
}

function normalizeWeightVector(value){
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, MAX_FEATURES)){
    const key = safeString(rawKey, 32);
    const number = Number(rawValue);
    if (!/^[a-z][a-z0-9_]{0,31}$/i.test(key) || !Number.isFinite(number)) continue;
    output[key] = clamp(number, -2, 2);
  }
  return output;
}

function normalizeCandidateFeatures(options, candidates){
  const allowed = new Set((Array.isArray(options) ? options : []).map(String));
  const byChoice = new Map();
  for (const item of (Array.isArray(candidates) ? candidates : []).slice(0, 200)){
    const choice = safeString(item && item.choice, 240);
    if (!allowed.has(choice) || byChoice.has(choice)) continue;
    byChoice.set(choice, normalizeFeatureVector(item && item.features));
  }
  return [...allowed].map(choice => ({ choice, features: byChoice.get(choice) || {} }));
}

function stateHash(state){
  const text = typeof state === 'string' ? state : JSON.stringify(state || null);
  return crypto.createHash('sha256').update(text.slice(0, 20000)).digest('hex').slice(0, 32);
}

function modelKey(uid, game){
  return safeString(uid, 80) + '|' + safeString(game, 24);
}

function defaultStats(){
  return { matches: 0, trainingMatches: 0, aiWins: 0, draws: 0, aiLosses: 0,
    decisions: 0, trainingDecisions: 0, updates: 0, lastResultAt: null };
}

function normalizeModel(value, uid, game){
  const source = value && typeof value === 'object' ? value : {};
  const weights = normalizeWeightVector(source.weights);
  const sourceStats = source.stats && typeof source.stats === 'object' ? source.stats : {};
  const stats = defaultStats();
  for (const key of ['matches', 'trainingMatches', 'aiWins', 'draws', 'aiLosses', 'decisions', 'trainingDecisions', 'updates']){
    stats[key] = Math.max(0, Math.floor(Number(sourceStats[key]) || 0));
  }
  stats.lastResultAt = sourceStats.lastResultAt ? safeString(sourceStats.lastResultAt, 40) : null;
  const mistakes = (Array.isArray(source.mistakes) ? source.mistakes : []).slice(-80).map(item => ({
    stateHash: safeString(item && item.stateHash, 32),
    choice: safeString(item && item.choice, 240),
    betterChoice: safeString(item && item.betterChoice, 240),
    at: safeString(item && item.at, 40),
  })).filter(item => /^[a-f0-9]{32}$/.test(item.stateHash) && item.choice);
  return {
    uid: safeString(uid || source.uid, 80),
    game: VALID_GAMES.includes(String(game || source.game)) ? String(game || source.game) : '',
    modelVersion: MODEL_VERSION,
    skillVersion: SKILL_VERSION,
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    trust: clamp(source.trust === undefined ? 0.28 : source.trust, 0.05, 0.65),
    learningRate: clamp(source.learningRate === undefined ? 0.08 : source.learningRate, 0.01, 0.15),
    weights,
    mistakes,
    stats,
    updatedAt: source.updatedAt ? safeString(source.updatedAt, 40) : new Date(0).toISOString(),
  };
}

function normalizeStore(value){
  const source = value && typeof value === 'object' ? value : {};
  const store = { models: {}, experiences: [], appliedResults: [] };
  for (const [key, model] of Object.entries(source.models || {})){
    const normalized = normalizeModel(model);
    if (normalized.uid && normalized.game && key === modelKey(normalized.uid, normalized.game)) store.models[key] = normalized;
  }
  store.experiences = (Array.isArray(source.experiences) ? source.experiences : []).slice(-MAX_EXPERIENCES)
    .filter(item => item && item.uid && VALID_GAMES.includes(String(item.game)) && item.resultId);
  store.appliedResults = [...new Set((Array.isArray(source.appliedResults) ? source.appliedResults : [])
    .map(value => safeString(value, 180)).filter(Boolean))].slice(-MAX_APPLIED_RESULTS);
  return store;
}

function getModel(store, uid, game){
  if (!store || !store.models || !uid || !VALID_GAMES.includes(String(game))) return null;
  const key = modelKey(uid, game);
  store.models[key] = normalizeModel(store.models[key], uid, game);
  return store.models[key];
}

function dot(weights, features){
  let total = 0;
  for (const [key, value] of Object.entries(features || {})) total += (Number(weights[key]) || 0) * (Number(value) || 0);
  return total;
}

function chooseLearnedCandidate(store, uid, game, state, options, candidates, upstreamChoice){
  const legal = (Array.isArray(options) ? options : []).map(value => safeString(value, 240)).filter(Boolean);
  if (!legal.length) return { choice: null, source: 'none', stateHash: stateHash(state), candidates: [] };
  const model = getModel(store, uid, game);
  const normalized = normalizeCandidateFeatures(legal, candidates);
  const hash = stateHash(state);
  const upstream = legal.includes(upstreamChoice) ? upstreamChoice : null;
  const candidateLimit = Math.min(5, legal.length);
  let best = null;
  for (let index = 0; index < candidateLimit; index++){
    const candidate = normalized[index];
    const knownMistake = model.mistakes.some(item => item.stateHash === hash && item.choice === candidate.choice);
    const base = 1 - index * 0.12;
    const learned = clamp(dot(model.weights, candidate.features), -2, 2) * 0.2;
    const upstreamBonus = candidate.choice === upstream ? model.trust * 0.22 : 0;
    const score = base + learned + upstreamBonus - (knownMistake ? 1.25 : 0);
    if (!best || score > best.score) best = { ...candidate, index, score, knownMistake };
  }
  if (!best) best = { ...normalized[0], index: 0, score: 1, knownMistake: false };
  return {
    choice: best.choice,
    source: best.choice === upstream ? 'deepseek+learned' : (best.index === 0 ? 'local+learned' : 'learned'),
    stateHash: hash,
    localBest: legal[0],
    upstreamChoice: upstream,
    optionRank: best.index,
    candidates: normalized.slice(0, candidateLimit),
  };
}

function recordDecision(match, decision){
  if (!match || match.completed || !decision || !decision.choice) return null;
  if (!Array.isArray(match.aiDecisions)) match.aiDecisions = [];
  if (match.aiDecisions.length >= MAX_DECISIONS_PER_MATCH) return null;
  // 新协议要求每个建议都先取得服务端 decisionId，再由客户端确认实际执行。
  // 保留旧单元/旧客户端的兼容路径：缺失 ID 时生成仅用于本地回归的确定性 legacy ID；
  // 服务端正式 API 不会调用这个分支。
  if (!(match.confirmedAIDecisionIds instanceof Set)) match.confirmedAIDecisionIds = new Set();
  const requestedDecisionId = safeString(decision.decisionId, 180);
  const decisionId = requestedDecisionId || ('legacy_' + stateHash({
    stateHash: decision.stateHash, choice: decision.choice, index: match.aiDecisions.length,
  }));
  if (match.confirmedAIDecisionIds.has(decisionId)){
    return match.aiDecisions.find(item => item && item.decisionId === decisionId) || null;
  }
  const candidates = normalizeCandidateFeatures(
    (decision.candidates || []).map(item => item.choice), decision.candidates);
  const chosen = candidates.find(item => item.choice === decision.choice) || { choice: safeString(decision.choice, 240), features: {} };
  const local = candidates.find(item => item.choice === decision.localBest) || { choice: safeString(decision.localBest, 240), features: {} };
  const row = {
    decisionId,
    decisionIndex: match.aiDecisions.length,
    stateHash: safeString(decision.stateHash, 32),
    choice: chosen.choice,
    localBest: local.choice,
    upstreamChoice: safeString(decision.upstreamChoice, 240) || null,
    optionRank: Math.max(0, Math.floor(Number(decision.optionRank) || 0)),
    candidateCount: Math.max(1, Math.floor(Number(decision.candidateCount) || candidates.length || 1)),
    chosenFeatures: chosen.features,
    localFeatures: local.features,
    // 候选仅驻留在当前服务进程，赛果产生后用于低学习率反事实更新；数据库仍只保存最终选择特征。
    candidateFeatures: candidates.slice(0, 5).map(item => ({ choice: item.choice, features: item.features })),
    source: safeString(decision.source, 40),
    at: Date.now(),
  };
  if (!/^[a-f0-9]{32}$/.test(row.stateHash)) return null;
  match.aiDecisions.push(row);
  match.confirmedAIDecisionIds.add(decisionId);
  return row;
}

function featureDifference(a, b){
  const out = {};
  for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])){
    out[key] = clamp((Number(a && a[key]) || 0) - (Number(b && b[key]) || 0), -1, 1);
  }
  return out;
}

function averageFeatures(candidates, excludedChoice){
  const rows = (Array.isArray(candidates) ? candidates : []).filter(item => item && item.choice !== excludedChoice);
  if (!rows.length) return {};
  const output = {};
  for (const row of rows){
    for (const [key, value] of Object.entries(normalizeFeatureVector(row.features))){
      output[key] = (Number(output[key]) || 0) + value / rows.length;
    }
  }
  return output;
}

function applyMatchLearning(store, input){
  const uid = safeString(input && input.uid, 80);
  const game = safeString(input && input.game, 24);
  const resultId = safeString(input && input.resultId, 160);
  const matchId = safeString(input && input.matchId, 160);
  const humanResult = safeString(input && input.humanResult, 12);
  if (!uid || !VALID_GAMES.includes(game) || !resultId || !['win', 'draw', 'loss'].includes(humanResult)) return null;
  const dedupeKey = uid + '|' + resultId;
  if (store.appliedResults.includes(dedupeKey)) return { duplicate: true, model: getModel(store, uid, game), experiences: [] };
  const now = new Date().toISOString();
  const eligible = input.eligible === true;
  const aiOutcome = humanResult === 'loss' ? 1 : humanResult === 'win' ? -1 : 0;
  const decisions = (Array.isArray(input.decisions) ? input.decisions : []).slice(0, MAX_DECISIONS_PER_MATCH);
  const model = getModel(store, uid, game);
  const baseRevision = model.revision;
  model.stats.matches++;
  model.stats.decisions += decisions.length;
  model.stats.lastResultAt = now;
  if (aiOutcome > 0) model.stats.aiWins++;
  else if (aiOutcome < 0) model.stats.aiLosses++;
  else model.stats.draws++;
  if (eligible) model.stats.trainingMatches++;
  if (eligible) model.stats.trainingDecisions += decisions.length;

  const experiences = decisions.map((decision, index) => ({
    uid, game, resultId, matchId,
    decisionIndex: Number.isInteger(decision.decisionIndex) ? decision.decisionIndex : index,
    stateHash: safeString(decision.stateHash, 32),
    choice: safeString(decision.choice, 240),
    localBest: safeString(decision.localBest, 240),
    optionRank: Math.max(0, Math.floor(Number(decision.optionRank) || 0)),
    candidateCount: Math.max(1, Math.floor(Number(decision.candidateCount) || 1)),
    features: normalizeFeatureVector(decision.chosenFeatures),
    aiOutcome,
    humanResult,
    usedForTraining: eligible,
    modelVersion: MODEL_VERSION,
    skillVersion: SKILL_VERSION,
    createdAt: now,
  })).filter(item => /^[a-f0-9]{32}$/.test(item.stateHash) && item.choice);

  if (eligible){
    // 保留一个很小的长期学习下限，避免模型在大量对局后完全冻结；按本局决策数归一化，防止长局一次写满权重。
    const lr = Math.max(0.012, model.learningRate / Math.sqrt(1 + model.stats.trainingMatches * 0.12));
    const perDecision = lr / Math.max(1, Math.sqrt(Math.min(64, decisions.length)));
    for (const decision of decisions){
      const chosen = normalizeFeatureVector(decision.chosenFeatures);
      const local = normalizeFeatureVector(decision.localFeatures);
      const candidates = (Array.isArray(decision.candidateFeatures) ? decision.candidateFeatures : [])
        .slice(0, 5).map(item => ({ choice: safeString(item && item.choice, 240), features: normalizeFeatureVector(item && item.features) }))
        .filter(item => item.choice);
      let referenceChoice = safeString(decision.localBest, 240);
      let reference = local;
      let direction = {};
      let strength = 0;
      if (aiOutcome > 0){
        // 胜局强化实际选择相对其它近优候选的区分特征，即使它恰好也是本地第一候选。
        reference = averageFeatures(candidates, decision.choice);
        direction = featureDifference(chosen, reference);
        strength = 0.35;
      } else if (aiOutcome < 0){
        // 败局优先回归本地强基线；若败着本身就是基线，则在同一近优带内尝试第二候选。
        if (decision.choice === decision.localBest){
          const alternative = candidates.find(item => item.choice !== decision.choice);
          if (alternative){ referenceChoice = alternative.choice; reference = alternative.features; }
        }
        if (referenceChoice && referenceChoice !== decision.choice){
          direction = featureDifference(reference, chosen);
          strength = 0.72;
        }
      } else if (decision.choice !== decision.localBest){
        direction = featureDifference(local, chosen);
        strength = 0.08;
      }
      let changed = false;
      for (const [key, delta] of Object.entries(direction)){
        if (!delta) continue;
        model.weights[key] = clamp((Number(model.weights[key]) || 0) + perDecision * strength * delta, -2, 2);
        changed = true;
      }
      if (changed) model.stats.updates++;
      if (decision.upstreamChoice && decision.choice === decision.upstreamChoice){
        const target = aiOutcome > 0 ? 0.65 : aiOutcome < 0 ? 0.05 : 0.3;
        model.trust = clamp(model.trust + perDecision * (target - model.trust), 0.05, 0.65);
      }
      if (aiOutcome < 0 && referenceChoice && referenceChoice !== decision.choice){
        model.mistakes.push({ stateHash: decision.stateHash, choice: decision.choice,
          betterChoice: referenceChoice, at: now });
      } else if (aiOutcome > 0){
        model.mistakes = model.mistakes.filter(item =>
          !(item.stateHash === decision.stateHash && item.choice === decision.choice));
      }
    }
    model.mistakes = model.mistakes.slice(-80);
  }
  model.revision++;
  model.updatedAt = now;
  store.models[modelKey(uid, game)] = model;
  store.experiences.push(...experiences);
  store.experiences = store.experiences.slice(-MAX_EXPERIENCES);
  store.appliedResults.push(dedupeKey);
  store.appliedResults = store.appliedResults.slice(-MAX_APPLIED_RESULTS);
  // replay 只供本地 outbox 在 Supabase revision 冲突时重放；不进入数据库，且不携带原始局面。
  // 保留候选特征而非完整 state，避免 outbox/重试路径重新引入隐私或大 payload。
  const replay = {
    uid, game, resultId, matchId, humanResult, eligible,
    decisions: decisions.map(decision => ({
      decisionId: safeString(decision.decisionId, 180),
      decisionIndex: Number.isInteger(decision.decisionIndex) ? decision.decisionIndex : 0,
      stateHash: safeString(decision.stateHash, 32),
      choice: safeString(decision.choice, 240),
      localBest: safeString(decision.localBest, 240),
      upstreamChoice: safeString(decision.upstreamChoice, 240),
      optionRank: Math.max(0, Math.floor(Number(decision.optionRank) || 0)),
      candidateCount: Math.max(1, Math.floor(Number(decision.candidateCount) || 1)),
      chosenFeatures: normalizeFeatureVector(decision.chosenFeatures),
      localFeatures: normalizeFeatureVector(decision.localFeatures),
      candidateFeatures: (Array.isArray(decision.candidateFeatures) ? decision.candidateFeatures : [])
        .slice(0, 5).map(item => ({ choice: safeString(item && item.choice, 240), features: normalizeFeatureVector(item && item.features) }))
        .filter(item => item.choice),
      source: safeString(decision.source, 40),
    })),
  };
  return { duplicate: false, model, experiences, baseRevision, replay };
}

function modelDbRow(model){
  return {
    uid: model.uid,
    game: model.game,
    model_version: model.modelVersion,
    skill_version: model.skillVersion,
    revision: model.revision,
    weights: model.weights,
    trust: model.trust,
    learning_rate: model.learningRate,
    mistakes: model.mistakes,
    stats: model.stats,
    updated_at: model.updatedAt,
  };
}

function experienceDbRow(row){
  return {
    uid: row.uid, game: row.game, result_id: row.resultId, match_id: row.matchId || null,
    decision_index: row.decisionIndex, state_hash: row.stateHash, choice: row.choice,
    local_best: row.localBest || null, option_rank: row.optionRank, candidate_count: row.candidateCount,
    features: row.features || {}, ai_outcome: row.aiOutcome, human_result: row.humanResult,
    used_for_training: row.usedForTraining, model_version: row.modelVersion,
    skill_version: row.skillVersion, created_at: row.createdAt,
  };
}

function loadModelRows(store, rows){
  for (const row of (Array.isArray(rows) ? rows : [])){
    if (!row || !row.uid || !VALID_GAMES.includes(String(row.game))) continue;
    const candidate = normalizeModel({
      uid: row.uid, game: row.game, revision: row.revision, weights: row.weights,
      trust: row.trust, learningRate: row.learning_rate, mistakes: row.mistakes,
      stats: row.stats, updatedAt: row.updated_at,
    }, row.uid, row.game);
    const key = modelKey(candidate.uid, candidate.game);
    const current = store.models[key];
    if (!current || candidate.revision > current.revision) store.models[key] = candidate;
  }
  return store;
}

module.exports = {
  VALID_GAMES, MODEL_VERSION, SKILL_VERSION,
  normalizeFeatureVector, normalizeWeightVector, normalizeCandidateFeatures, normalizeStore, getModel,
  stateHash, chooseLearnedCandidate, recordDecision, applyMatchLearning,
  modelDbRow, experienceDbRow, loadModelRows,
};
