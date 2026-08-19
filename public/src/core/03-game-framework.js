/* ================= 游戏插件化框架 ================= */
// 统一 Game 生命周期：
//   init() / render() / move(payload) / serialize() / deserialize(state)
//   restart() / destroy()
// 大厅只认 Game Instance；游戏只需实现标准接口即可被平台使用。
// 兼容旧接口：raw 返回 { reset, resetLocal, onMove, onRestart, snapshot }。

const GAME_REGISTRY = {}; // id -> factory

function registerGame(id, factory) {
  GAME_REGISTRY[id] = factory;
}

// 所有游戏实例都通过同一入口取得难度，避免某个游戏遗漏默认值或把旧人格直接当强度。
function normalizeGameAIDifficulty(opts){
  opts = opts || {};
  const hasExplicitDifficulty = !!(opts.aiDifficulty || (opts.aiPersona && opts.aiPersona.difficulty));
  if (typeof aiDifficultyById === 'function') {
    opts.aiDifficulty = hasExplicitDifficulty && typeof aiDifficultyFromOptions === 'function'
      ? aiDifficultyFromOptions(opts)
      : aiDifficultyById('normal');
    if (typeof aiDifficultyCompatibilityProfile === 'function') {
      opts.aiPersona = aiDifficultyCompatibilityProfile(opts.aiDifficulty);
    }
  } else {
    // 独立旧模块/测试尚未加载难度目录时，仍保证每局有可读的普通默认值。
    opts.aiDifficulty = { id:'normal' };
  }
  return opts;
}

function createGameInstance(id, area, extra, playerCount, opts) {
  const factory = GAME_REGISTRY[id] || (typeof games !== 'undefined' && games[id]);
  if (!factory) throw new Error('game not found: ' + id);
  opts = normalizeGameAIDifficulty(opts);
  opts.destroyed = false;
  const raw = factory(area, extra, playerCount, opts);
  const clearPresentation = () => {
    try { if (typeof clearHonruGameReaction === 'function') clearHonruGameReaction(); } catch {}
  };
  const callWithPresentationReset = fn => (...args) => {
    clearPresentation();
    return fn.apply(raw, args);
  };

  const instance = {
    id: id,
    _raw: raw,

    // ---- 统一生命周期 ----
    init() {
      if (raw.init) raw.init();
      else if (raw.resetLocal) raw.resetLocal();
      else if (raw.reset) raw.reset();
    },
    render() {
      if (raw.render) raw.render();
    },
    move(payload, player) {
      if (raw.move) return raw.move(payload, player);
      if (raw.onMove) return raw.onMove(payload, player);
    },
    serialize() {
      // serialize() 可包含表现层、统计等扩展数据；snapshot() 仅是旧协议回退。
      if (raw.serialize) return raw.serialize();
      if (raw.snapshot) return raw.snapshot();
      return null;
    },
    deserialize(state) {
      if (raw.deserialize) return raw.deserialize(state);
      if (raw.onRestore) return raw.onRestore(state);
      return false;
    },
    restart() {
      clearPresentation();
      if (raw.reset) raw.reset();
      else if (raw.resetLocal) raw.resetLocal();
      else if (raw.restart) raw.restart();
    },
    destroy() {
      opts.destroyed = true;
      clearPresentation();
      if (raw.destroy) raw.destroy();
      // 清理 DOM（可选，由调用方决定是否清空 area/extra）
    },

    // ---- 兼容别名（旧代码仍可用） ----
    reset: callWithPresentationReset(raw.reset || raw.resetLocal || (() => {})),
    onMove: raw.onMove || (() => {}),
    onRestart: callWithPresentationReset(raw.onRestart || raw.resetLocal || raw.reset || (() => {})),
    snapshot: raw.snapshot || raw.serialize || (() => null),
  };

  // 游戏可按需声明观战、皮肤、棋钟、统计、实时帧等能力。框架不解释这些
  // 接口，只保持 this 指向原始游戏对象并向平台透传，避免每新增能力都改框架。
  Object.keys(raw).forEach(key => {
    if (typeof raw[key] !== 'function' || key in instance) return;
    instance[key] = (...args) => raw[key].apply(raw, args);
  });
  return instance;
}

// 从旧 games 注册表自动注册（在 games 定义后调用）
function autoRegisterGames() {
  if (typeof games === 'undefined') return;
  for (const id in games) {
    if (!GAME_REGISTRY[id]) registerGame(id, games[id]);
  }
}

// 获取已注册游戏列表（保持顺序稳定）
function listRegisteredGames() {
  return Object.keys(GAME_REGISTRY);
}
