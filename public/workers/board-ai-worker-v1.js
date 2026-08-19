'use strict';

importScripts('../src/core/18-board-ai-kernel.js');

(() => {
  const SEARCH = 'BOARD_AI_SEARCH_V1';
  const CANCEL = 'BOARD_AI_CANCEL_V1';
  const RESULT = 'BOARD_AI_RESULT_V1';
  const MAX_CANCELLED = 64;
  const cancelled = [];
  const kernel = self.BoardAIKernel;
  let solver = null;
  try { solver = kernel && kernel.create(); } catch (_error) { solver = null; }

  const record = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      const prototype = Object.getPrototypeOf(value);
      return prototype === null || prototype === Object.prototype;
    } catch (_error) { return false; }
  };
  const own = (value, key) => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { present:false, ok:!descriptor, value:undefined };
      return { present:true, ok:true, value:descriptor.value };
    } catch (_error) { return { present:false, ok:false, value:undefined }; }
  };
  const exact = (value, names) => {
    if (!record(value)) return false;
    try {
      const keys = Object.getOwnPropertyNames(value);
      const symbols = Object.getOwnPropertySymbols(value);
      return symbols.length === 0 && keys.length === names.length && keys.every(key => names.indexOf(key) !== -1 && own(value, key).ok);
    } catch (_error) { return false; }
  };
  const binding = payload => {
    const value = record(payload) ? payload : {};
    const read = key => {
      const field = own(value, key);
      return field.ok && field.present ? field.value : null;
    };
    return {
      requestId:typeof read('requestId') === 'string' ? read('requestId') : null,
      gameId:typeof read('gameId') === 'string' ? read('gameId') : null,
      rulesVersion:typeof read('rulesVersion') === 'string' ? read('rulesVersion') : null,
      solverVersion:kernel ? kernel.SOLVER_VERSION : null,
      matchGeneration:Number.isSafeInteger(read('matchGeneration')) ? read('matchGeneration') : null,
      turn:read('turn') === 0 || read('turn') === 1 ? read('turn') : null,
      positionHash:typeof read('positionHash') === 'string' ? read('positionHash') : null
    };
  };
  const fail = (payload, reason) => ({ type:RESULT, ok:false, reason:reason || 'invalid_request', ...binding(payload), ranked:[] });
  const post = value => { try { self.postMessage(value); } catch (_error) {} };
  const isCancelled = requestId => cancelled.indexOf(requestId) !== -1;
  const forget = requestId => {
    const index = cancelled.indexOf(requestId);
    if (index !== -1) cancelled.splice(index, 1);
  };
  const remember = requestId => {
    if (typeof requestId !== 'string' || !requestId || isCancelled(requestId)) return;
    cancelled.push(requestId);
    while (cancelled.length > MAX_CANCELLED) cancelled.shift();
  };

  self.onmessage = event => {
    const data = event && event.data;
    if (!record(data)) { post(fail(null, 'invalid_request')); return; }
    const type = own(data, 'type');
    if (!type.ok || !type.present || typeof type.value !== 'string') { post(fail(null, 'invalid_request')); return; }
    if (type.value === CANCEL) {
      if (!exact(data, ['type', 'requestId'])) return;
      const requestId = own(data, 'requestId');
      if (requestId.ok && requestId.present) remember(requestId.value);
      return;
    }
    if (type.value !== SEARCH || !exact(data, ['type', 'payload'])) { post(fail(null, 'invalid_request')); return; }
    const payload = own(data, 'payload');
    if (!payload.ok || !payload.present || !solver) { post(fail(null, 'invalid_request')); return; }
    const requestId = binding(payload.value).requestId;
    let solved;
    try { solved = solver.solve(payload.value, { isCancelled: () => isCancelled(requestId) }); }
    catch (_error) { solved = fail(payload.value, 'solver_failed'); }
    forget(requestId);
    if (!solved || typeof solved !== 'object') { post(fail(payload.value, 'solver_failed')); return; }
    post({
      type:RESULT,
      ok:solved.accepted === true,
      reason:solved.reason || null,
      requestId:solved.requestId,
      gameId:solved.gameId,
      rulesVersion:solved.rulesVersion,
      solverVersion:solved.solverVersion,
      matchGeneration:solved.matchGeneration,
      turn:solved.turn,
      positionHash:solved.positionHash,
      choiceId:solved.accepted && solved.ranked && solved.ranked.length ? solved.ranked[0].id : null,
      ranked:Array.isArray(solved.ranked) ? solved.ranked : [],
    });
  };
})();
