(function installGameModuleLoader(root, factory) {
  'use strict';

  var result = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = result;
  } else if (root) {
    // The production surface is deliberately tiny.  The manifest and the
    // constructor stay private so callers cannot provide arbitrary URLs.
    root.GameModuleLoader = result.create();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createModule() {
  'use strict';

  var RESOURCE = 'renderer';
  var PRIMARY = 'primary';
  var RETRY = 'retry1';
  var DESCRIPTOR_CHECK_TYPE = 'GAME_MODULE_DESCRIPTOR_CHECK_V1';
  var DESCRIPTOR_RESULT_TYPE = 'GAME_MODULE_DESCRIPTOR_RESULT_V1';
  var EXPECTED_RENDERER_CACHE_VERSION = 'ghost-game-renderer-v17-20260819';
  var DESCRIPTOR_CHECK_TIMEOUT_MS = 300;
  var GAME_IDS = Object.freeze(['gomoku', 'ludo', 'monopoly', 'xiangqi', 'tetris', 'tank']);
  var GAME_SET = new Set(GAME_IDS);

  // The digest is for the bytes of the renderer entry itself.  The query
  // prefix gives the browser/SW an immutable identity while the full digest
  // remains available to deterministic tests and provenance checks.
  var MANIFEST = Object.freeze({
    gomoku: Object.freeze({
      gameId: 'gomoku', resource: RESOURCE, sha256: 'adf60207928f61eefc4d1725f9587f3d1827c131ece70a700136da17a6dfc6e9',
      exports: Object.freeze(['isGomoku3DSupported', 'createGomoku3DAdapter']),
      variants: Object.freeze({ primary: './three/gomoku-entry.js?v=sha256-adf60207928f61ee' })
    }),
    ludo: Object.freeze({
      gameId: 'ludo', resource: RESOURCE, sha256: '9b3e5829abf61c790421da598b845895a9bd07dff924b7c7a60c2379c149c365',
      exports: Object.freeze(['isLudo3DSupported', 'createLudo3DAdapter']),
      variants: Object.freeze({ primary: './three/ludo-entry.js?v=sha256-9b3e5829abf61c79' })
    }),
    monopoly: Object.freeze({
      gameId: 'monopoly', resource: RESOURCE, sha256: '27a68efbf31c9aff52ed994daa1d49578a148f4541228f0c6ecd56edb0da5b70',
      exports: Object.freeze(['isMonopoly3DSupported', 'createMonopoly3DAdapter']),
      variants: Object.freeze({ primary: './three/monopoly-entry.js?v=sha256-27a68efbf31c9aff' })
    }),
    xiangqi: Object.freeze({
      gameId: 'xiangqi', resource: RESOURCE, sha256: 'f12d77cdd9896a2ba3db1ad9c5eef0bcb9ba728b504ad28b73c9c13cb82e0995',
      exports: Object.freeze(['isXiangqi3DSupported', 'createXiangqi3DAdapter']),
      variants: Object.freeze({ primary: './three/xiangqi-entry.js?v=sha256-f12d77cdd9896a2b' })
    }),
    tetris: Object.freeze({
      gameId: 'tetris', resource: RESOURCE, sha256: 'ce7c38dec42b212fca6dbcfefe0b3ce073165f85a2d0c6a78cc625b87d044ddd',
      exports: Object.freeze(['isTetris3DSupported', 'createTetris3DAdapter']),
      variants: Object.freeze({ primary: './three/tetris-entry.js?v=sha256-ce7c38dec42b212f' })
    }),
    tank: Object.freeze({
      gameId: 'tank', resource: RESOURCE, sha256: '5858d98dd19650f78b272e9d703977b10233839d842f686192f60e3e8d33a733',
      exports: Object.freeze(['isTank3DSupported', 'createTank3DAdapter']),
      variants: Object.freeze({
        primary: './three/tank-entry.js?v=sha256-5858d98dd19650f7',
        retry1: './three/tank-entry.js?v=sha256-5858d98dd19650f7-retry1'
      })
    })
  });

  function freeze(value) {
    if (Array.isArray(value)) return Object.freeze(value.map(freeze));
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.keys(value).forEach(function freezeChild(key) { freeze(value[key]); });
      try { Object.freeze(value); } catch (_error) {}
    }
    return value;
  }

  function validGameId(value) {
    return typeof value === 'string' && GAME_SET.has(value);
  }

  function safeVariant(value) {
    return value === RETRY ? RETRY : PRIMARY;
  }

  function safeOptions(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function safeResult(value) {
    return freeze(value);
  }

  function invalidResult(gameId, reason, variant) {
    var result = { ok: false, status: 'fallback', gameId: validGameId(gameId) ? gameId : null,
      resource: RESOURCE, variant: variant || PRIMARY, fallback: 'inline', reason: reason };
    return safeResult(result);
  }

  function validManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') return false;
    var manifestKeys;
    try { manifestKeys = Object.keys(manifest); } catch (_error) { return false; }
    if (manifestKeys.length !== GAME_IDS.length || manifestKeys.some(function unknownManifestKey(key) { return !GAME_SET.has(key); })) return false;
    for (var index = 0; index < GAME_IDS.length; index += 1) {
      var id = GAME_IDS[index];
      var entry = manifest[id];
      if (!entry || entry.gameId !== id || entry.resource !== RESOURCE ||
          typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
          !Array.isArray(entry.exports) || entry.exports.length < 2 ||
          !entry.variants || typeof entry.variants.primary !== 'string') return false;
      if (id === 'tank' && typeof entry.variants.retry1 !== 'string') return false;
      if (id !== 'tank' && entry.variants.retry1 !== undefined) return false;
      var prefix = entry.sha256.slice(0, 16);
      var primaryUrl = './three/' + id + '-entry.js?v=sha256-' + prefix;
      if (entry.variants.primary !== primaryUrl) return false;
      if (id === 'tank' && entry.variants.retry1 !== primaryUrl + '-retry1') return false;
      for (var exportIndex = 0; exportIndex < entry.exports.length; exportIndex += 1) {
        if (typeof entry.exports[exportIndex] !== 'string' || !entry.exports[exportIndex]) return false;
      }
    }
    return true;
  }

  function defaultImport(url) {
    // Keeping the expression here (rather than in a game caller) is the
    // Loader's only optional-runtime dependency.  It is never evaluated by
    // prefetch(), and the browser's ESM cache provides module identity.
    return import(url);
  }

  function moduleExportsValid(moduleValue, entry) {
    if (!moduleValue || (typeof moduleValue !== 'object' && typeof moduleValue !== 'function')) return false;
    for (var index = 0; index < entry.exports.length; index += 1) {
      var name = entry.exports[index];
      try {
        if (typeof moduleValue[name] !== 'function') return false;
      } catch (_error) {
        return false;
      }
    }
    return true;
  }

  function resolveServiceWorker(options) {
    if (options && options.serviceWorker) return options.serviceWorker;
    try {
      return typeof navigator !== 'undefined' && navigator && navigator.serviceWorker ? navigator.serviceWorker : null;
    } catch (_error) {
      return null;
    }
  }

  function create(options) {
    var opts = safeOptions(options);
    var manifest = opts.manifest && validManifest(opts.manifest) ? opts.manifest : MANIFEST;
    var importModule = typeof opts.importModule === 'function' ? opts.importModule : defaultImport;
    var pending = new Map();
    var loaded = new Map();
    var warmupSent = new Set();
    var scheduleTimeout = typeof opts.setTimeout === 'function' ? opts.setTimeout :
      (typeof setTimeout === 'function' ? setTimeout : null);
    var cancelTimeout = typeof opts.clearTimeout === 'function' ? opts.clearTimeout :
      (typeof clearTimeout === 'function' ? clearTimeout : null);
    var messageChannelFactory = typeof opts.messageChannelFactory === 'function' ? opts.messageChannelFactory : function defaultMessageChannel() {
      try { return typeof MessageChannel === 'function' ? new MessageChannel() : null; } catch (_error) { return null; }
    };

    function descriptor(gameId, variant) {
      if (!validGameId(gameId)) return null;
      var entry = manifest[gameId];
      if (!entry || entry.resource !== RESOURCE) return null;
      if (variant === RETRY && gameId !== 'tank') return null;
      var url = entry.variants[variant];
      var expected = './three/' + gameId + '-entry.js?v=sha256-' + entry.sha256.slice(0, 16) + (variant === RETRY ? '-retry1' : '');
      return typeof url === 'string' && url === expected ? { entry: entry, url: url, variant: variant } : null;
    }

    function prefetch(gameId) {
      if (!validGameId(gameId)) return safeResult({ accepted: false, reason: 'invalid_game' });
      var serviceWorker = resolveServiceWorker(opts);
      var controller = null;
      try { controller = serviceWorker && serviceWorker.controller; } catch (_error) { controller = null; }
      if (!controller || typeof controller.postMessage !== 'function') {
        return safeResult({ accepted: false, gameId: gameId, resource: RESOURCE, variant: PRIMARY, reason: 'no_service_worker' });
      }
      if (warmupSent.has(gameId)) {
        return safeResult({ accepted: true, gameId: gameId, resource: RESOURCE, variant: PRIMARY, reason: 'already_queued' });
      }
      try {
        controller.postMessage({ type: 'GAME_MODULE_WARMUP_V1', gameId: gameId, resource: RESOURCE, variant: PRIMARY });
        warmupSent.add(gameId);
        return safeResult({ accepted: true, gameId: gameId, resource: RESOURCE, variant: PRIMARY, reason: 'queued' });
      } catch (_error) {
        return safeResult({ accepted: false, gameId: gameId, resource: RESOURCE, variant: PRIMARY, reason: 'post_message_failed' });
      }
    }

    function controllerDescriptorCheck(gameId, item) {
      var serviceWorker = resolveServiceWorker(opts);
      var controller = null;
      try { controller = serviceWorker && serviceWorker.controller; } catch (_error) { controller = null; }
      // First-load/local development without a controlling SW retains the
      // existing direct same-origin import path. A present controller must
      // prove that it knows this exact descriptor before it may intercept it.
      if (!controller) return Promise.resolve({ ok: true, controller: null });
      if (typeof controller.postMessage !== 'function' || !scheduleTimeout) {
        return Promise.resolve({ ok: false, reason: 'service_worker_descriptor_unavailable' });
      }
      var channel = null;
      try { channel = messageChannelFactory(); } catch (_error) { channel = null; }
      if (!channel || !channel.port1 || !channel.port2 || typeof channel.port1.close !== 'function') {
        return Promise.resolve({ ok: false, reason: 'service_worker_descriptor_unavailable' });
      }
      return new Promise(function descriptorPromise(resolve) {
        var settled = false;
        var timeoutHandle = null;
        function closePorts() {
          try { channel.port1.close(); } catch (_error) {}
          try { if (typeof channel.port2.close === 'function') channel.port2.close(); } catch (_error) {}
        }
        function settle(value) {
          if (settled) return;
          settled = true;
          if (timeoutHandle !== null && cancelTimeout) {
            try { cancelTimeout(timeoutHandle); } catch (_error) {}
          }
          closePorts();
          resolve(value);
        }
        channel.port1.onmessage = function descriptorMessage(event) {
          var data = event && event.data;
          var keys = [];
          try { keys = data && typeof data === 'object' ? Object.keys(data).sort() : []; } catch (_error) { keys = []; }
          var expectedKeys = ['cacheVersion','gameId','ok','resource','sha256','type','url','variant'];
          if (keys.length !== expectedKeys.length || keys.some(function keyMismatch(key, index) { return key !== expectedKeys[index]; })) {
            settle({ ok: false, reason: 'service_worker_descriptor_mismatch' });
            return;
          }
          var current = null;
          try { current = serviceWorker.controller; } catch (_error) { current = null; }
          var matches = current === controller && data.type === DESCRIPTOR_RESULT_TYPE && data.ok === true &&
            data.cacheVersion === EXPECTED_RENDERER_CACHE_VERSION && data.gameId === gameId &&
            data.resource === RESOURCE && data.variant === item.variant && data.url === item.url &&
            data.sha256 === item.entry.sha256;
          settle(matches ? { ok: true, controller: controller } :
            { ok: false, reason: current === controller ? 'service_worker_descriptor_mismatch' : 'service_worker_changed' });
        };
        try { if (typeof channel.port1.start === 'function') channel.port1.start(); } catch (_error) {}
        try {
          timeoutHandle = scheduleTimeout(function descriptorTimeout() {
            settle({ ok: false, reason: 'service_worker_descriptor_unavailable' });
          }, DESCRIPTOR_CHECK_TIMEOUT_MS);
          controller.postMessage({
            type: DESCRIPTOR_CHECK_TYPE,
            gameId: gameId,
            resource: RESOURCE,
            variant: item.variant,
            sha256: item.entry.sha256
          }, [channel.port2]);
        } catch (_error) {
          settle({ ok: false, reason: 'service_worker_descriptor_unavailable' });
        }
      });
    }

    function load(gameId, loadOptions) {
      var request = safeOptions(loadOptions);
      var requestedVariant = request.variant === undefined ? PRIMARY : request.variant;
      var variant = requestedVariant === RETRY ? RETRY : PRIMARY;
      if (!validGameId(gameId)) return Promise.resolve(invalidResult(gameId, 'invalid_game', variant));
      if (request.resource !== undefined && request.resource !== RESOURCE) {
        return Promise.resolve(invalidResult(gameId, 'invalid_resource', variant));
      }
      if (requestedVariant !== PRIMARY && requestedVariant !== RETRY) {
        return Promise.resolve(invalidResult(gameId, 'invalid_variant', variant));
      }
      var item = descriptor(gameId, variant);
      if (!item) return Promise.resolve(invalidResult(gameId, 'invalid_variant', variant));
      var key = gameId + ':' + RESOURCE + ':' + variant;
      if (loaded.has(key)) return Promise.resolve(loaded.get(key));
      if (pending.has(key)) return pending.get(key);

      var promise = controllerDescriptorCheck(gameId, item).then(function descriptorChecked(check) {
        if (!check || check.ok !== true) return invalidResult(gameId,
          check && check.reason || 'service_worker_descriptor_unavailable', variant);
        var imported;
        try { imported = importModule(item.url); } catch (_error) {
          return invalidResult(gameId, 'import_failed', variant);
        }
        return Promise.resolve(imported).then(function moduleLoaded(moduleValue) {
          if (!moduleExportsValid(moduleValue, item.entry)) {
            return invalidResult(gameId, 'module_invalid', variant);
          }
          var success = safeResult({ ok: true, status: 'ready', gameId: gameId, resource: RESOURCE,
            variant: variant, module: moduleValue });
          loaded.set(key, success);
          return success;
        }, function importFailed() {
          return invalidResult(gameId, 'import_failed', variant);
        });
      }, function descriptorCheckFailed() {
        return invalidResult(gameId, 'service_worker_descriptor_unavailable', variant);
      });
      // The finally-like cleanup is deliberately attached without adding a
      // timer or a rejection path. Failed promises are never cached.
      pending.set(key, promise);
      promise.then(function clearPending() {
        if (pending.get(key) === promise) pending.delete(key);
      }, function clearRejectedPending() {
        if (pending.get(key) === promise) pending.delete(key);
      });
      return promise;
    }

    return Object.freeze({ prefetch: prefetch, load: load });
  }

  freeze(MANIFEST);
  return Object.freeze({ create: create, manifest: MANIFEST });
}));
