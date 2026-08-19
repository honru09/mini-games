/*
 * BoardAIWorkerBroker
 *
 * A deliberately small, default-off seam for turn-based board-search work.
 * The broker owns request identity, one-ticket lifecycle, worker failure
 * containment and the single synchronous fallback.  Search implementations,
 * rules, caches and opening data stay behind injected adapters.
 *
 * This module is memory-only and has no platform, transport or persistence
 * dependency.  It returns outcomes instead of rejecting promises so a caller
 * can always take its existing legal synchronous path.
 */
(function installBoardAIWorkerBroker(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else if (root) {
    root.BoardAIWorkerBroker = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createBoardAIWorkerBrokerModule(root) {
  'use strict';

  var PROTOCOL = 'board-ai-worker-v1';
  var REQUEST_TYPE = 'BOARD_AI_SEARCH_V1';
  var CANCEL_TYPE = 'BOARD_AI_CANCEL_V1';
  var RESULT_TYPE = 'BOARD_AI_RESULT_V1';
  var GAME_IDS = Object.freeze(['xiangqi', 'gomoku']);
  var REQUEST_FIELDS = Object.freeze([
    'requestId', 'gameId', 'rulesVersion', 'solverVersion', 'identity',
    'matchGeneration', 'turn', 'positionHash', 'legalCandidates',
    'difficulty', 'budgetMs', 'position'
  ]);
  var RESULT_FIELDS = Object.freeze([
    'type', 'ok', 'reason', 'requestId', 'gameId', 'rulesVersion',
    'solverVersion', 'matchGeneration', 'turn', 'positionHash',
    'choiceId', 'ranked'
  ]);
  var RANKED_FIELDS = Object.freeze(['id', 'score']);
  var SYNC_RESULT_FIELDS = Object.freeze(['choiceId', 'ranked']);
  var MAX_ID_LENGTH = 128;
  var MAX_VERSION_LENGTH = 96;
  var MAX_CANDIDATES = 200;
  var MAX_CANDIDATE_ID_LENGTH = 128;
  var MAX_POSITION_DEPTH = 12;
  var MAX_POSITION_ENTRIES = 4096;
  var MAX_POSITION_BYTES = 65536;
  var MIN_BUDGET_MS = 1;
  var MAX_BUDGET_MS = 500;
  var DEFAULT_TIMEOUT_GRACE_MS = 50;
  var MAX_TIMEOUT_GRACE_MS = 500;
  var MAX_SEEN_REQUESTS = 64;
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:>,-]{0,127}$/;
  var VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
  var HASH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var SENSITIVE_KEY_PATTERN = /(?:^|[_-])(?:token|secret|password|passcode|pin|authorization|cookie|credential|session|email|mail|phone|address|message|stack|body|text|content|chat|payload|trace|prompt|url|uri|username|user|reward|coin|xp|replay|social|raw[_-]?input|pointer|touch|keyboard|keystroke)(?:$|[_-])/i;

  function contains(values, value) {
    return values.indexOf(value) !== -1;
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (_error) {
      return false;
    }
  }

  function ownData(value, key) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return { present: false, ok: true, value: undefined };
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { present: true, ok: false, value: undefined };
      return { present: true, ok: true, value: descriptor.value };
    } catch (_error) {
      return { present: false, ok: false, value: undefined };
    }
  }

  function safeNames(value) {
    try {
      return {
        names: Object.getOwnPropertyNames(value),
        symbols: typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(value) : []
      };
    } catch (_error) {
      return null;
    }
  }

  function normalizedKey(value) {
    return String(value).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  function sensitiveKey(value) {
    return SENSITIVE_KEY_PATTERN.test(normalizedKey(value));
  }

  function finiteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function safeInteger(value, maximum) {
    return finiteNumber(value) && Math.floor(value) === value && value >= 0 && value <= maximum;
  }

  function freeze(value) {
    return Object.freeze(value);
  }

  function frozenCopy(value) {
    if (Array.isArray(value)) {
      return freeze(value.map(frozenCopy));
    }
    if (isPlainRecord(value)) {
      var result = {};
      var names = safeNames(value);
      if (!names || names.symbols.length) return null;
      for (var index = 0; index < names.names.length; index += 1) {
        var key = names.names[index];
        var field = ownData(value, key);
        if (!field.ok) return null;
        var child = frozenCopy(field.value);
        if (field.value !== null && typeof field.value === 'object' && child === null) return null;
        result[key] = child;
      }
      return freeze(result);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (finiteNumber(value)) return value;
    return null;
  }

  function inspectData(value, depth, state) {
    if (depth > MAX_POSITION_DEPTH) return { ok: false, reason: 'position_too_deep' };
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return { ok: true };
    if (finiteNumber(value)) return { ok: true };
    if (typeof value !== 'object') return { ok: false, reason: 'invalid_position' };
    if (state.seen.indexOf(value) !== -1) return { ok: false, reason: 'position_cycle' };
    state.seen.push(value);
    var names = safeNames(value);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_position' };
    if (Array.isArray(value)) {
      if (names.names.length > MAX_POSITION_ENTRIES) return { ok: false, reason: 'position_too_large' };
      for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex += 1) {
        var arrayResult = inspectData(value[arrayIndex], depth + 1, state);
        if (!arrayResult.ok) return arrayResult;
      }
      return { ok: true };
    }
    if (!isPlainRecord(value)) return { ok: false, reason: 'invalid_position' };
    if (names.names.length > MAX_POSITION_ENTRIES) return { ok: false, reason: 'position_too_large' };
    for (var index = 0; index < names.names.length; index += 1) {
      var key = names.names[index];
      if (sensitiveKey(key)) return { ok: false, reason: 'privacy_rejected' };
      var field = ownData(value, key);
      if (!field.ok) return { ok: false, reason: 'invalid_position' };
      var childResult = inspectData(field.value, depth + 1, state);
      if (!childResult.ok) return childResult;
    }
    return { ok: true };
  }

  function serializedSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch (_error) {
      return Infinity;
    }
  }

  function validateFieldNames(input, allowed) {
    var names = safeNames(input);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_record' };
    for (var index = 0; index < names.names.length; index += 1) {
      var key = names.names[index];
      if (!contains(allowed, key)) return { ok: false, reason: sensitiveKey(key) ? 'privacy_rejected' : 'unsupported_field' };
    }
    return { ok: true };
  }

  function validId(value, pattern, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum && pattern.test(value);
  }

  function requestIdForFailure(input) {
    if (!isPlainRecord(input)) return null;
    var field = ownData(input, 'requestId');
    return field.ok && field.present && validId(field.value, ID_PATTERN, MAX_ID_LENGTH) ? field.value : null;
  }

  function parseRequest(input) {
    if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_record' };
    var fields = validateFieldNames(input, REQUEST_FIELDS);
    if (!fields.ok) return fields;
    var required = ['requestId', 'gameId', 'rulesVersion', 'solverVersion', 'identity', 'matchGeneration', 'turn', 'positionHash', 'legalCandidates', 'difficulty', 'budgetMs', 'position'];
    for (var requiredIndex = 0; requiredIndex < required.length; requiredIndex += 1) {
      var requiredField = ownData(input, required[requiredIndex]);
      if (!requiredField.ok || !requiredField.present) return { ok: false, reason: 'missing_field' };
    }

    var requestId = ownData(input, 'requestId').value;
    var gameId = ownData(input, 'gameId').value;
    var rulesVersion = ownData(input, 'rulesVersion').value;
    var solverVersion = ownData(input, 'solverVersion').value;
    var identity = ownData(input, 'identity').value;
    var matchGeneration = ownData(input, 'matchGeneration').value;
    var turn = ownData(input, 'turn').value;
    var positionHash = ownData(input, 'positionHash').value;
    var candidates = ownData(input, 'legalCandidates').value;
    var difficulty = ownData(input, 'difficulty').value;
    var budgetMs = ownData(input, 'budgetMs').value;
    var position = ownData(input, 'position').value;

    if (!validId(requestId, ID_PATTERN, MAX_ID_LENGTH)) return { ok: false, reason: 'invalid_request_id' };
    if (!contains(GAME_IDS, gameId)) return { ok: false, reason: 'unsupported_game' };
    if (!validId(rulesVersion, VERSION_PATTERN, MAX_VERSION_LENGTH) || !validId(solverVersion, VERSION_PATTERN, MAX_VERSION_LENGTH)) return { ok: false, reason: 'invalid_version' };
    if (!validId(identity, ID_PATTERN, MAX_ID_LENGTH)) return { ok: false, reason: 'invalid_identity' };
    if (!safeInteger(matchGeneration, 9007199254740991)) return { ok: false, reason: 'invalid_generation' };
    if (!safeInteger(turn, 255)) return { ok: false, reason: 'invalid_turn' };
    if (!validId(positionHash, HASH_PATTERN, MAX_ID_LENGTH)) return { ok: false, reason: 'invalid_position_hash' };
    if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > MAX_CANDIDATES) return { ok: false, reason: 'invalid_candidates' };
    var seenCandidates = [];
    for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      var candidate = candidates[candidateIndex];
      if (!validId(candidate, ID_PATTERN, MAX_CANDIDATE_ID_LENGTH)) return { ok: false, reason: 'invalid_candidate' };
      if (seenCandidates.indexOf(candidate) !== -1) return { ok: false, reason: 'duplicate_candidate' };
      seenCandidates.push(candidate);
    }
    if (!contains(['easy', 'normal', 'hard'], difficulty)) return { ok: false, reason: 'invalid_difficulty' };
    if (!finiteNumber(budgetMs) || budgetMs < MIN_BUDGET_MS || budgetMs > MAX_BUDGET_MS) return { ok: false, reason: 'invalid_budget' };
    if (!isPlainRecord(position)) return { ok: false, reason: 'invalid_position' };
    var dataResult = inspectData(position, 0, { seen: [] });
    if (!dataResult.ok) return dataResult;
    if (serializedSize(position) > MAX_POSITION_BYTES) return { ok: false, reason: 'position_too_large' };
    var copiedPosition = frozenCopy(position);
    if (copiedPosition === null) return { ok: false, reason: 'invalid_position' };
    return {
      ok: true,
      value: freeze({
        requestId: requestId,
        gameId: gameId,
        rulesVersion: rulesVersion,
        solverVersion: solverVersion,
        identity: identity,
        matchGeneration: matchGeneration,
        turn: turn,
        positionHash: positionHash,
        legalCandidates: freeze(seenCandidates.slice()),
        difficulty: difficulty,
        budgetMs: Math.floor(budgetMs),
        position: copiedPosition
      })
    };
  }

  function resultBase(request, ok, reason, source) {
    var output = {
      ok: ok === true,
      reason: reason || null,
      requestId: request && request.requestId || null,
      gameId: request && request.gameId || null,
      rulesVersion: request && request.rulesVersion || null,
      solverVersion: request && request.solverVersion || null,
      matchGeneration: request && request.matchGeneration !== undefined ? request.matchGeneration : null,
      turn: request && request.turn !== undefined ? request.turn : null,
      positionHash: request && request.positionHash || null
    };
    if (source) output.source = source;
    return output;
  }

  function fallbackOutcome(request, reason, source) {
    return freeze(resultBase(request, false, reason, source || 'sync'));
  }

  function normalizeRanked(value, request) {
    if (!Array.isArray(value) || value.length < 1 || value.length > request.legalCandidates.length) return { ok: false, reason: 'invalid_result' };
    var ranked = [];
    var seen = [];
    for (var index = 0; index < value.length; index += 1) {
      var item = value[index];
      var id;
      var score;
      if (isPlainRecord(item)) {
        var itemFields = validateFieldNames(item, RANKED_FIELDS);
        if (!itemFields.ok) return { ok: false, reason: 'invalid_result' };
        var idField = ownData(item, 'id');
        var scoreField = ownData(item, 'score');
        if (!idField.ok || !scoreField.ok || !idField.present || !scoreField.present) return { ok: false, reason: 'invalid_result' };
        id = idField.value;
        score = scoreField.value;
      } else {
        return { ok: false, reason: 'invalid_result' };
      }
      if (!validId(id, ID_PATTERN, MAX_CANDIDATE_ID_LENGTH) || request.legalCandidates.indexOf(id) === -1) return { ok: false, reason: 'result_candidate_not_legal' };
      if (!finiteNumber(score) || Math.abs(score) > 1e12) return { ok: false, reason: 'invalid_score' };
      if (seen.indexOf(id) !== -1) return { ok: false, reason: 'duplicate_result_candidate' };
      if (ranked.length) {
        var previous = ranked[ranked.length - 1];
        if (previous.score < score || (previous.score === score && previous.id.localeCompare(id) > 0)) return { ok: false, reason: 'invalid_result_order' };
      }
      seen.push(id);
      ranked.push(freeze({ id: id, score: score }));
    }
    return { ok: true, ranked: freeze(ranked) };
  }

  function parseWorkerResult(message, request) {
    if (!isPlainRecord(message)) return { ok: false, reason: 'worker_protocol' };
    var fields = validateFieldNames(message, RESULT_FIELDS);
    if (!fields.ok) return { ok: false, reason: 'worker_protocol' };
    var type = ownData(message, 'type');
    if (!type.ok || !type.present || type.value !== RESULT_TYPE) return { ok: false, reason: 'worker_protocol' };
    var identityFields = ['requestId', 'gameId', 'rulesVersion', 'solverVersion', 'matchGeneration', 'turn', 'positionHash'];
    for (var index = 0; index < identityFields.length; index += 1) {
      var field = ownData(message, identityFields[index]);
      if (!field.ok || !field.present || field.value !== request[identityFields[index]]) return { ok: false, reason: 'response_identity_mismatch' };
    }
    var okField = ownData(message, 'ok');
    if (!okField.ok || !okField.present || typeof okField.value !== 'boolean') return { ok: false, reason: 'worker_protocol' };
    if (okField.value === false) {
      var failure = ownData(message, 'reason');
      return { ok: false, reason: failure.ok && failure.present && typeof failure.value === 'string' ? failure.value.slice(0, 64) : 'worker_failed' };
    }
    var rankedField = ownData(message, 'ranked');
    var ranked = normalizeRanked(rankedField.value, request);
    if (!ranked.ok) return ranked;
    var choiceField = ownData(message, 'choiceId');
    var choiceId = choiceField.present ? choiceField.value : ranked.ranked[0].id;
    if (!validId(choiceId, ID_PATTERN, MAX_CANDIDATE_ID_LENGTH) || choiceId !== ranked.ranked[0].id) {
      return { ok: false, reason: 'result_choice_not_legal' };
    }
    var output = resultBase(request, true, null, 'worker');
    output.choiceId = choiceId;
    output.ranked = ranked.ranked;
    return { ok: true, value: freeze(output) };
  }

  function normalizeSyncResult(raw, request) {
    if (!isPlainRecord(raw)) return { ok: false, reason: 'fallback_invalid' };
    var fields = validateFieldNames(raw, SYNC_RESULT_FIELDS);
    if (!fields.ok) return { ok: false, reason: 'fallback_invalid' };
    var identity = resultBase(request, true, null, 'sync');
    var rankedField = ownData(raw, 'ranked');
    var ranked = normalizeRanked(rankedField.value, request);
    if (!ranked.ok) return { ok: false, reason: ranked.reason };
    var choiceField = ownData(raw, 'choiceId');
    var choiceId = choiceField.present ? choiceField.value : ranked.ranked[0].id;
    if (!validId(choiceId, ID_PATTERN, MAX_CANDIDATE_ID_LENGTH) || choiceId !== ranked.ranked[0].id) return { ok: false, reason: 'fallback_choice_not_legal' };
    identity.choiceId = choiceId;
    identity.ranked = ranked.ranked;
    return { ok: true, value: freeze(identity) };
  }

  function safeInvokeSync(adapter, request) {
    try {
      if (typeof adapter === 'function') return Promise.resolve(adapter(request));
      if (adapter && typeof adapter.request === 'function') return Promise.resolve(adapter.request(request));
      if (adapter && typeof adapter.choose === 'function') return Promise.resolve(adapter.choose(request));
      return Promise.resolve(null);
    } catch (_error) {
      return Promise.reject(_error);
    }
  }

  function kernelSyncAdapter() {
    var kernel = root && root.BoardAIKernel;
    if (!kernel) return null;
    try {
      if (typeof kernel.solve === 'function') return function kernelSolve(request) {
        var solved = kernel.solve(request);
        return solved && solved.accepted && Array.isArray(solved.ranked) && solved.ranked.length
          ? { choiceId: solved.ranked[0].id, ranked: solved.ranked }
          : null;
      };
      if (typeof kernel.request === 'function') return function kernelRequest(request) { return kernel.request(request); };
      if (typeof kernel.create === 'function') {
        var created = kernel.create();
        if (created && typeof created.solve === 'function') {
          var createdKernelSolve = function createdKernelSolve(request) {
            var solved = created.solve(request);
            return solved && solved.accepted && Array.isArray(solved.ranked) && solved.ranked.length
              ? { choiceId: solved.ranked[0].id, ranked: solved.ranked }
              : null;
          };
          if (typeof created.clear === 'function') createdKernelSolve.clear = function clearCreatedKernel() { return created.clear(); };
          return createdKernelSolve;
        }
        if (created && typeof created.request === 'function') return created;
      }
    } catch (_error) {}
    return null;
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var enabledField = ownData(opts, 'enabled');
    var enabled = enabledField.ok && enabledField.present && enabledField.value === true;
    var workerOptInField = ownData(opts, 'workerOptIn');
    var workerOptIn = workerOptInField.ok && (!workerOptInField.present || workerOptInField.value === true);
    var workerFactoryField = ownData(opts, 'workerFactory');
    var syncAdapterField = ownData(opts, 'syncAdapter');
    var graceField = ownData(opts, 'timeoutGraceMs');
    var timeoutGraceMs = graceField.ok && finiteNumber(graceField.value) ? Math.max(0, Math.min(MAX_TIMEOUT_GRACE_MS, Math.floor(graceField.value))) : DEFAULT_TIMEOUT_GRACE_MS;
    var workerFactory = workerFactoryField.ok && typeof workerFactoryField.value === 'function' ? workerFactoryField.value : null;
    var syncAdapter = syncAdapterField.ok && syncAdapterField.present ? syncAdapterField.value : null;
    if (!syncAdapter && enabled) syncAdapter = kernelSyncAdapter();
    var state = { enabled: enabled, workerOptIn: workerOptIn, disposed: false, active: null, worker: null, seen: [] };

    function rememberRequest(requestId) {
      state.seen.push(requestId);
      while (state.seen.length > MAX_SEEN_REQUESTS) state.seen.shift();
    }

    function knownRequest(requestId) {
      return state.seen.indexOf(requestId) !== -1;
    }

    function detachWorker(worker) {
      if (!worker) return;
      try { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; } catch (_error) {}
    }

    function terminateWorker(worker) {
      if (!worker) return;
      detachWorker(worker);
      try { if (typeof worker.terminate === 'function') worker.terminate(); } catch (_error) {}
      if (state.worker === worker) state.worker = null;
    }

    function clearTicket(ticket, preserveWorker) {
      if (!ticket) return;
      if (ticket.timer !== null) {
        clearTimeout(ticket.timer);
        ticket.timer = null;
      }
      if (ticket.worker && !preserveWorker) terminateWorker(ticket.worker);
      ticket.worker = null;
      if (state.active === ticket) state.active = null;
    }

    function settle(ticket, outcome, preserveWorker) {
      if (!ticket || ticket.settled) return false;
      ticket.settled = true;
      clearTicket(ticket, preserveWorker === true);
      try { ticket.resolve(freeze(outcome)); } catch (_error) {}
      return true;
    }

    function syncFallback(ticket, reason) {
      if (!ticket || ticket.settled || ticket.fallbackStarted || state.disposed) return false;
      ticket.fallbackStarted = true;
      if (ticket.timer !== null) { clearTimeout(ticket.timer); ticket.timer = null; }
      if (ticket.worker) terminateWorker(ticket.worker);
      safeInvokeSync(syncAdapter, ticket.request).then(function syncDone(raw) {
        if (ticket.settled || state.disposed || state.active !== ticket) return;
        var parsed = normalizeSyncResult(raw, ticket.request);
        if (parsed.ok) {
          settle(ticket, parsed.value);
        } else {
          settle(ticket, fallbackOutcome(ticket.request, parsed.reason || 'fallback_failed', 'sync'));
        }
      }, function syncFailed() {
        if (ticket.settled || state.disposed || state.active !== ticket) return;
        settle(ticket, fallbackOutcome(ticket.request, 'fallback_failed', 'sync'));
      });
      return true;
    }

    function workerFailure(ticket, reason) {
      if (!ticket || ticket.settled || state.active !== ticket) return;
      if (ticket.worker) terminateWorker(ticket.worker);
      syncFallback(ticket, reason);
    }

    function handleMessage(ticket, event) {
      if (!ticket || ticket.settled || state.active !== ticket) return;
      var message = event;
      try {
        if (event && typeof event === 'object' &&
            (Object.prototype.hasOwnProperty.call(event, 'data') || (!isPlainRecord(event) && 'data' in event))) message = event.data;
      } catch (_error) {}
      var parsed = parseWorkerResult(message, ticket.request);
      if (parsed.ok) {
        settle(ticket, parsed.value, true);
      } else {
        workerFailure(ticket, parsed.reason || 'worker_protocol');
      }
    }

    function startWorker(ticket) {
      if (!state.workerOptIn || !workerFactory) return false;
      var worker = state.worker;
      try { if (!worker) worker = workerFactory(); } catch (_error) { return false; }
      if (!worker || typeof worker.postMessage !== 'function') {
        terminateWorker(worker);
        return false;
      }
      ticket.worker = worker;
      state.worker = worker;
      try {
        worker.onmessage = function onmessage(event) { handleMessage(ticket, event); };
        worker.onerror = function onerror() { workerFailure(ticket, 'worker_crash'); };
        worker.onmessageerror = function onmessageerror() { workerFailure(ticket, 'worker_message_error'); };
        worker.postMessage({ type: REQUEST_TYPE, payload: {
          requestId: ticket.request.requestId,
          gameId: ticket.request.gameId,
          rulesVersion: ticket.request.rulesVersion,
          solverVersion: ticket.request.solverVersion,
          identity: ticket.request.identity,
          matchGeneration: ticket.request.matchGeneration,
          turn: ticket.request.turn,
          positionHash: ticket.request.positionHash,
          legalCandidates: ticket.request.legalCandidates.slice(),
          difficulty: ticket.request.difficulty,
          budgetMs: ticket.request.budgetMs,
          position: frozenCopy(ticket.request.position)
        } });
      } catch (_error2) {
        workerFailure(ticket, 'worker_post_failed');
        return false;
      }
      if (ticket.settled || ticket.fallbackStarted || state.active !== ticket) return true;
      var timeoutMs = Math.min(1000, ticket.request.budgetMs + timeoutGraceMs);
      ticket.timer = setTimeout(function timeout() { workerFailure(ticket, 'timeout'); }, timeoutMs);
      return true;
    }

    function request(input) {
      var failureId = requestIdForFailure(input);
      if (state.disposed) return Promise.resolve(freeze({ ok: false, reason: 'disposed', requestId: failureId }));
      if (!state.enabled) return Promise.resolve(freeze({ ok: false, reason: 'disabled', requestId: failureId }));
      var parsed = parseRequest(input);
      if (!parsed.ok) return Promise.resolve(freeze({ ok: false, reason: parsed.reason, requestId: failureId }));
      var requestValue = parsed.value;
      if (knownRequest(requestValue.requestId)) return Promise.resolve(freeze({ ok: false, reason: 'duplicate_request', requestId: requestValue.requestId }));
      if (state.active) return Promise.resolve(freeze({ ok: false, reason: 'busy', requestId: requestValue.requestId }));
      rememberRequest(requestValue.requestId);
      var promise = new Promise(function resolveRequest(resolve) {
        state.active = {
          request: requestValue,
          resolve: resolve,
          settled: false,
          fallbackStarted: false,
          timer: null,
          worker: null
        };
      });
      var ticket = state.active;
      if (!startWorker(ticket)) syncFallback(ticket, 'worker_unavailable');
      return promise;
    }

    function cancel(requestId) {
      if (state.disposed || !state.active || state.active.request.requestId !== requestId) return false;
      var ticket = state.active;
      if (ticket.worker) {
        try { ticket.worker.postMessage({ type: CANCEL_TYPE, requestId: requestId }); } catch (_error) {}
      }
      settle(ticket, resultBase(ticket.request, false, 'cancelled', 'broker'));
      return true;
    }

    function dispose() {
      if (state.disposed) return freeze({ status: 'disposed' });
      state.disposed = true;
      var ticket = state.active;
      if (ticket) settle(ticket, resultBase(ticket.request, false, 'disposed', 'broker'));
      if (state.worker) terminateWorker(state.worker);
      try {
        if (syncAdapter && typeof syncAdapter.clear === 'function') syncAdapter.clear();
        else if (syncAdapter && typeof syncAdapter.dispose === 'function') syncAdapter.dispose();
      } catch (_error) {}
      state.active = null;
      state.seen.length = 0;
      return freeze({ status: 'disposed' });
    }

    return freeze({ request: request, cancel: cancel, dispose: dispose });
  }

  return freeze({ create: create });
}));
