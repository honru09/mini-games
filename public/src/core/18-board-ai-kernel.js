/*
 * BoardAIKernel
 *
 * A pure, deterministic Module shared by the Board AI Worker Adapter and its
 * synchronous fallback Adapter.  Its Interface accepts only canonical board
 * state and already legal candidate IDs; it returns only ranked candidate IDs
 * with finite scores.  Authoritative and persistent product state remains
 * outside this Seam.
 */
(function installBoardAIKernel(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.BoardAIKernel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createBoardAIKernelModule() {
  'use strict';

  var SOLVER_VERSION = 'board-ai-kernel-v1';
  var RULE_VERSIONS = Object.freeze(['xiangqi-rule-v2', 'gomoku-local-v1']);
  var LIMITS = Object.freeze({
    maxTTEntries: 4096,
    maxCandidates: 200,
    maxRanked: 40,
    maxBudgetMs: 1000,
    maxRequestIdLength: 80,
    maxIdentityLength: 80,
    maxPositionHashLength: 48
  });
  var XQ_ROWS = 10;
  var XQ_COLS = 9;
  var GOMOKU_SIZE = 15;
  var XQ_TYPES = Object.freeze(['k', 'a', 'e', 'h', 'r', 'c', 'p']);
  var XQ_TYPE_INDEX = Object.freeze({ k:0, a:1, e:2, h:3, r:4, c:5, p:6 });
  var XQ_VALUE = Object.freeze({ p:100, a:250, e:260, h:470, c:500, r:1000, k:30000 });
  var MATE = 10000000;
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
  var HASH_PATTERN = /^[a-z][a-z0-9-]{1,15}-v1-[0-9a-f]{8}$/;

  function freeze(value) {
    try { return Object.freeze(value); } catch (_error) { return value; }
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null || prototype === Object.prototype) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (_error) { return false; }
  }

  function ownData(record, key) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor) return { present:false, ok:true, value:undefined };
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { present:true, ok:false, value:undefined };
      return { present:true, ok:true, value:descriptor.value };
    } catch (_error) { return { present:false, ok:false, value:undefined }; }
  }

  function exactKeys(record, allowed, required) {
    if (!isPlainRecord(record)) return false;
    var names;
    var symbols;
    try {
      names = Object.getOwnPropertyNames(record);
      symbols = typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(record) : [];
    } catch (_error) { return false; }
    if (symbols.length) return false;
    for (var index = 0; index < names.length; index += 1) {
      if (allowed.indexOf(names[index]) === -1) return false;
      if (!ownData(record, names[index]).ok) return false;
    }
    for (var requiredIndex = 0; requiredIndex < required.length; requiredIndex += 1) {
      if (names.indexOf(required[requiredIndex]) === -1) return false;
    }
    return true;
  }

  function safeInteger(value, minimum, maximum) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= minimum && value <= maximum;
  }

  function safeString(value, pattern, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum && pattern.test(value) ? value : null;
  }

  function cloneBoard(board) {
    return board.map(function cloneRow(row) {
      return row.map(function cloneCell(piece) { return piece ? { p:piece.p, t:piece.t } : null; });
    });
  }

  function xorshift32(value) {
    var state = value >>> 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  function fixedTable(length, seed) {
    var output = new Uint32Array(length);
    var state = seed >>> 0;
    for (var index = 0; index < length; index += 1) {
      state = xorshift32(state || (index + 1));
      output[index] = state || (0x9e3779b9 ^ index);
    }
    return output;
  }

  var XQ_ZOBRIST = fixedTable(XQ_ROWS * XQ_COLS * XQ_TYPES.length * 2 + 2, 0x51a7c0de);
  var GOMOKU_ZOBRIST = fixedTable(GOMOKU_SIZE * GOMOKU_SIZE * 2 + 2, 0x6f6d6f6b);

  function mix32(value) {
    var state = (Number(value) >>> 0) ^ 0x9e3779b9;
    state = Math.imul(state ^ (state >>> 16), 0x85ebca6b) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35) >>> 0;
    return (state ^ (state >>> 16)) >>> 0;
  }

  function hex32(value) { return (value >>> 0).toString(16).padStart(8, '0'); }

  function coordinate(value, rows, cols) {
    if (!Array.isArray(value) || value.length !== 2 || !safeInteger(value[0], 0, rows - 1) || !safeInteger(value[1], 0, cols - 1)) return null;
    return [value[0], value[1]];
  }

  function parseLastMove(value) {
    if (value === null) return null;
    if (!exactKeys(value, ['from', 'to'], ['from', 'to'])) return undefined;
    var from = coordinate(ownData(value, 'from').value, XQ_ROWS, XQ_COLS);
    var to = coordinate(ownData(value, 'to').value, XQ_ROWS, XQ_COLS);
    if (!from || !to || (from[0] === to[0] && from[1] === to[1])) return undefined;
    return { from:from, to:to };
  }

  function parseXiangqiPosition(value) {
    if (!exactKeys(value, ['board', 'lastMove', 'moveCount'], ['board', 'lastMove', 'moveCount'])) return null;
    var board = ownData(value, 'board').value;
    var lastMove = parseLastMove(ownData(value, 'lastMove').value);
    var moveCount = ownData(value, 'moveCount').value;
    if (!Array.isArray(board) || board.length !== XQ_ROWS || lastMove === undefined || !safeInteger(moveCount, 0, 1000)) return null;
    var copy = [];
    for (var row = 0; row < XQ_ROWS; row += 1) {
      if (!Array.isArray(board[row]) || board[row].length !== XQ_COLS) return null;
      var nextRow = [];
      for (var col = 0; col < XQ_COLS; col += 1) {
        var piece = board[row][col];
        if (piece === null) { nextRow.push(null); continue; }
        if (!exactKeys(piece, ['p', 't'], ['p', 't'])) return null;
        var player = ownData(piece, 'p').value;
        var type = ownData(piece, 't').value;
        if ((player !== 0 && player !== 1) || typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(XQ_TYPE_INDEX, type)) return null;
        nextRow.push({ p:player, t:type });
      }
      copy.push(nextRow);
    }
    return { board:copy, lastMove:lastMove, moveCount:moveCount };
  }

  function parseGomokuLast(value, board) {
    if (value === null) return null;
    if (typeof value !== 'string' || !/^([0-9]|1[0-4]),([0-9]|1[0-4])$/.test(value)) return undefined;
    var parts = value.split(',').map(Number);
    if (board[parts[0]][parts[1]] === '.') return undefined;
    return value;
  }

  function parseGomokuPosition(value) {
    if (!exactKeys(value, ['board', 'last', 'moves'], ['board', 'last', 'moves'])) return null;
    var encoded = ownData(value, 'board').value;
    var moves = ownData(value, 'moves').value;
    if (typeof encoded !== 'string' || encoded.length !== GOMOKU_SIZE * GOMOKU_SIZE + GOMOKU_SIZE - 1 || !safeInteger(moves, 0, GOMOKU_SIZE * GOMOKU_SIZE)) return null;
    var rows = encoded.split('/');
    if (rows.length !== GOMOKU_SIZE || rows.some(function invalidRow(row) { return !/^[.01]{15}$/.test(row); })) return null;
    var board = rows.map(function toCells(row) { return row.split(''); });
    var counted = board.reduce(function sum(total, row) { return total + row.filter(function occupied(cell) { return cell !== '.'; }).length; }, 0);
    if (counted !== moves) return null;
    var last = parseGomokuLast(ownData(value, 'last').value, board);
    if (last === undefined || (moves === 0 && last !== null) || (moves > 0 && last === null)) return null;
    return { board:board, last:last, moves:moves };
  }

  function hashXiangqi(position, turn) {
    var hash = XQ_ZOBRIST[XQ_ZOBRIST.length - 2 + turn] >>> 0;
    for (var row = 0; row < XQ_ROWS; row += 1) for (var col = 0; col < XQ_COLS; col += 1) {
      var piece = position.board[row][col];
      if (!piece) continue;
      var cell = row * XQ_COLS + col;
      hash ^= XQ_ZOBRIST[(cell * XQ_TYPES.length * 2) + (piece.p * XQ_TYPES.length) + XQ_TYPE_INDEX[piece.t]];
    }
    hash ^= mix32(position.moveCount + 0x10001);
    if (position.lastMove) {
      hash ^= mix32((position.lastMove.from[0] * XQ_COLS + position.lastMove.from[1] + 1) * 131 + position.lastMove.to[0] * XQ_COLS + position.lastMove.to[1] + 1);
    }
    return 'xq-v1-' + hex32(hash);
  }

  function hashGomoku(position, turn) {
    var hash = GOMOKU_ZOBRIST[GOMOKU_ZOBRIST.length - 2 + turn] >>> 0;
    for (var row = 0; row < GOMOKU_SIZE; row += 1) for (var col = 0; col < GOMOKU_SIZE; col += 1) {
      var value = position.board[row][col];
      if (value === '.') continue;
      hash ^= GOMOKU_ZOBRIST[(row * GOMOKU_SIZE + col) * 2 + Number(value)];
    }
    hash ^= mix32(position.moves + 0x20002);
    if (position.last) {
      var parts = position.last.split(',').map(Number);
      hash ^= mix32((parts[0] * GOMOKU_SIZE + parts[1] + 1) * 313);
    }
    return 'gomoku-v1-' + hex32(hash);
  }

  function hashPosition(gameId, rulesVersion, position, turn) {
    if (!safeInteger(turn, 0, 1)) return null;
    if (gameId === 'xiangqi' && rulesVersion === 'xiangqi-rule-v2') {
      var xiangqi = parseXiangqiPosition(position);
      return xiangqi ? hashXiangqi(xiangqi, turn) : null;
    }
    if (gameId === 'gomoku' && rulesVersion === 'gomoku-local-v1') {
      var gomoku = parseGomokuPosition(position);
      return gomoku ? hashGomoku(gomoku, turn) : null;
    }
    return null;
  }

  function parseXiangqiCandidate(id) {
    if (typeof id !== 'string' || !/^([0-9]),([0-8])>([0-9]),([0-8])$/.test(id)) return null;
    var values = id.match(/\d/g).map(Number);
    return { id:id, from:[values[0], values[1]], to:[values[2], values[3]] };
  }

  function parseGomokuCandidate(id) {
    if (typeof id !== 'string' || !/^([0-9]|1[0-4]),([0-9]|1[0-4])$/.test(id)) return null;
    var values = id.split(',').map(Number);
    return { id:id, row:values[0], col:values[1] };
  }

  function xqFindKing(board, player) {
    for (var row = 0; row < XQ_ROWS; row += 1) for (var col = 0; col < XQ_COLS; col += 1) {
      var piece = board[row][col];
      if (piece && piece.p === player && piece.t === 'k') return [row, col];
    }
    return null;
  }

  function xqInPalace(row, col, player) {
    return col >= 3 && col <= 5 && (player === 1 ? row >= 0 && row <= 2 : row >= 7 && row <= 9);
  }

  function xqCanMoveTo(board, player, row, col) {
    return row >= 0 && row < XQ_ROWS && col >= 0 && col < XQ_COLS && (!board[row][col] || board[row][col].p !== player);
  }

  function xqPseudoMoves(board, player, row, col) {
    var piece = board[row][col];
    if (!piece || piece.p !== player) return [];
    var result = [];
    var index;
    if (piece.t === 'k') {
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(function step(delta) {
        var nextRow = row + delta[0], nextCol = col + delta[1];
        if (xqInPalace(nextRow, nextCol, player) && xqCanMoveTo(board, player, nextRow, nextCol)) result.push([nextRow, nextCol]);
      });
      var opposingKing = xqFindKing(board, player ^ 1);
      if (opposingKing && opposingKing[1] === col) {
        var blocked = false;
        for (var kingRow = Math.min(row, opposingKing[0]) + 1; kingRow < Math.max(row, opposingKing[0]); kingRow += 1) if (board[kingRow][col]) { blocked = true; break; }
        if (!blocked) result.push(opposingKing);
      }
    } else if (piece.t === 'a') {
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function step(delta) {
        var nextRow = row + delta[0], nextCol = col + delta[1];
        if (xqInPalace(nextRow, nextCol, player) && xqCanMoveTo(board, player, nextRow, nextCol)) result.push([nextRow, nextCol]);
      });
    } else if (piece.t === 'e') {
      [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(function step(delta) {
        var nextRow = row + delta[0], nextCol = col + delta[1];
        var eyeRow = row + delta[0] / 2, eyeCol = col + delta[1] / 2;
        if (!xqCanMoveTo(board, player, nextRow, nextCol) || board[eyeRow][eyeCol]) return;
        if ((player === 1 && nextRow > 4) || (player === 0 && nextRow < 5)) return;
        result.push([nextRow, nextCol]);
      });
    } else if (piece.t === 'h') {
      var horse = [[[-1,0],[-2,-1]],[[-1,0],[-2,1]],[[1,0],[2,-1]],[[1,0],[2,1]],[[0,-1],[-1,-2]],[[0,-1],[1,-2]],[[0,1],[-1,2]],[[0,1],[1,2]]];
      horse.forEach(function route(item) {
        var leg = item[0], step = item[1];
        var legRow = row + leg[0], legCol = col + leg[1], nextRow = row + step[0], nextCol = col + step[1];
        if (legRow < 0 || legRow >= XQ_ROWS || legCol < 0 || legCol >= XQ_COLS || board[legRow][legCol]) return;
        if (xqCanMoveTo(board, player, nextRow, nextCol)) result.push([nextRow, nextCol]);
      });
    } else if (piece.t === 'r' || piece.t === 'c') {
      var directions = [[-1,0],[1,0],[0,-1],[0,1]];
      for (index = 0; index < directions.length; index += 1) {
        var delta = directions[index], nextRow = row + delta[0], nextCol = col + delta[1], screened = false;
        while (nextRow >= 0 && nextRow < XQ_ROWS && nextCol >= 0 && nextCol < XQ_COLS) {
          var target = board[nextRow][nextCol];
          if (piece.t === 'r') {
            if (!target) result.push([nextRow, nextCol]);
            else { if (target.p !== player) result.push([nextRow, nextCol]); break; }
          } else if (!screened) {
            if (!target) result.push([nextRow, nextCol]); else screened = true;
          } else if (target) {
            if (target.p !== player) result.push([nextRow, nextCol]);
            break;
          }
          nextRow += delta[0]; nextCol += delta[1];
        }
      }
    } else if (piece.t === 'p') {
      var forward = player === 1 ? 1 : -1;
      if (xqCanMoveTo(board, player, row + forward, col)) result.push([row + forward, col]);
      if ((player === 1 && row >= 5) || (player === 0 && row <= 4)) {
        if (xqCanMoveTo(board, player, row, col - 1)) result.push([row, col - 1]);
        if (xqCanMoveTo(board, player, row, col + 1)) result.push([row, col + 1]);
      }
    }
    return result;
  }

  function xqIsCheck(board, player) {
    var king = xqFindKing(board, player);
    if (!king) return true;
    for (var row = 0; row < XQ_ROWS; row += 1) for (var col = 0; col < XQ_COLS; col += 1) {
      var piece = board[row][col];
      if (piece && piece.p !== player && xqPseudoMoves(board, piece.p, row, col).some(function hits(square) { return square[0] === king[0] && square[1] === king[1]; })) return true;
    }
    return false;
  }

  function xqApply(board, move) {
    var next = cloneBoard(board);
    var piece = next[move.from[0]][move.from[1]];
    var capture = next[move.to[0]][move.to[1]];
    next[move.from[0]][move.from[1]] = null;
    next[move.to[0]][move.to[1]] = piece;
    return { board:next, capture:capture, piece:piece };
  }

  function xqLegalMoves(board, player) {
    var all = [];
    for (var row = 0; row < XQ_ROWS; row += 1) for (var col = 0; col < XQ_COLS; col += 1) {
      var piece = board[row][col];
      if (!piece || piece.p !== player) continue;
      var pseudo = xqPseudoMoves(board, player, row, col);
      for (var index = 0; index < pseudo.length; index += 1) {
        var to = pseudo[index];
        var move = { id:row + ',' + col + '>' + to[0] + ',' + to[1], from:[row, col], to:to };
        var applied = xqApply(board, move);
        if (!xqIsCheck(applied.board, player)) all.push({ id:move.id, from:move.from, to:move.to, piece:piece, capture:applied.capture });
      }
    }
    return all;
  }

  function xqPieceSquare(piece, row, col) {
    var forward = piece.p === 0 ? 9 - row : row;
    var center = 4 - Math.abs(col - 4);
    if (piece.t === 'p') return forward * 7 + center * (forward >= 5 ? 5 : 2) + (forward >= 5 ? 28 : 0);
    if (piece.t === 'h') return center * 10 + (4.5 - Math.abs(row - 4.5)) * 5;
    if (piece.t === 'c') return center * 5 + (forward >= 2 && forward <= 7 ? 10 : 0);
    if (piece.t === 'r') return center * 3 + forward;
    if (piece.t === 'a') return col === 4 ? 14 : 8;
    if (piece.t === 'e') return center * 2 + (forward <= 4 ? 8 : 0);
    if (piece.t === 'k') return -Math.abs(col - 4) * 12 - forward * 5;
    return 0;
  }

  function xqEvaluate(board, perspective) {
    if (!xqFindKing(board, perspective)) return -MATE;
    if (!xqFindKing(board, perspective ^ 1)) return MATE;
    var score = [0, 0];
    for (var row = 0; row < XQ_ROWS; row += 1) for (var col = 0; col < XQ_COLS; col += 1) {
      var piece = board[row][col];
      if (!piece) continue;
      score[piece.p] += XQ_VALUE[piece.t] + xqPieceSquare(piece, row, col);
    }
    if (xqIsCheck(board, perspective)) score[perspective] -= 190;
    if (xqIsCheck(board, perspective ^ 1)) score[perspective ^ 1] -= 190;
    return score[perspective] - score[perspective ^ 1];
  }

  function xqOrder(move) {
    var capture = move.capture ? (move.capture.t === 'k' ? MATE : XQ_VALUE[move.capture.t] * 12 - XQ_VALUE[move.piece.t]) : 0;
    return capture + xqPieceSquare(move.piece, move.to[0], move.to[1]) - xqPieceSquare(move.piece, move.from[0], move.from[1]);
  }

  function gomokuWin(board, row, col, player) {
    var directions = [[1,0],[0,1],[1,1],[1,-1]];
    for (var index = 0; index < directions.length; index += 1) {
      var delta = directions[index], total = 1;
      for (var side = -1; side <= 1; side += 2) {
        var nextRow = row + delta[0] * side, nextCol = col + delta[1] * side;
        while (nextRow >= 0 && nextRow < GOMOKU_SIZE && nextCol >= 0 && nextCol < GOMOKU_SIZE && board[nextRow][nextCol] === String(player)) {
          total += 1; nextRow += delta[0] * side; nextCol += delta[1] * side;
        }
      }
      if (total >= 5) return true;
    }
    return false;
  }

  function gomokuThreat(board, row, col, player) {
    if (board[row][col] !== '.') return -MATE;
    var directions = [[1,0],[0,1],[1,1],[1,-1]];
    var score = 0;
    board[row][col] = String(player);
    try {
      if (gomokuWin(board, row, col, player)) return MATE;
      for (var index = 0; index < directions.length; index += 1) {
        var delta = directions[index], count = 1, open = 0;
        for (var side = -1; side <= 1; side += 2) {
          var nextRow = row + delta[0] * side, nextCol = col + delta[1] * side;
          while (nextRow >= 0 && nextRow < GOMOKU_SIZE && nextCol >= 0 && nextCol < GOMOKU_SIZE && board[nextRow][nextCol] === String(player)) {
            count += 1; nextRow += delta[0] * side; nextCol += delta[1] * side;
          }
          if (nextRow >= 0 && nextRow < GOMOKU_SIZE && nextCol >= 0 && nextCol < GOMOKU_SIZE && board[nextRow][nextCol] === '.') open += 1;
        }
        if (count >= 4 && open >= 1) score += open === 2 ? 1200000 : 240000;
        else if (count === 3 && open === 2) score += 28000;
        else if (count === 3 && open === 1) score += 7000;
        else if (count === 2 && open === 2) score += 1100;
        else if (count === 2 && open === 1) score += 180;
      }
    } finally { board[row][col] = '.'; }
    return score;
  }

  function gomokuNearby(board, limit) {
    var found = new Set();
    var hasStone = false;
    for (var row = 0; row < GOMOKU_SIZE; row += 1) for (var col = 0; col < GOMOKU_SIZE; col += 1) {
      if (board[row][col] === '.') continue;
      hasStone = true;
      for (var rowOffset = -2; rowOffset <= 2; rowOffset += 1) for (var colOffset = -2; colOffset <= 2; colOffset += 1) {
        var nextRow = row + rowOffset, nextCol = col + colOffset;
        if (nextRow >= 0 && nextRow < GOMOKU_SIZE && nextCol >= 0 && nextCol < GOMOKU_SIZE && board[nextRow][nextCol] === '.') found.add(nextRow + ',' + nextCol);
      }
    }
    if (!hasStone) return ['7,7'];
    return Array.from(found).sort(function byCenter(left, right) {
      var leftParts = left.split(',').map(Number), rightParts = right.split(',').map(Number);
      var leftDistance = Math.abs(leftParts[0] - 7) + Math.abs(leftParts[1] - 7);
      var rightDistance = Math.abs(rightParts[0] - 7) + Math.abs(rightParts[1] - 7);
      return leftDistance - rightDistance || left.localeCompare(right);
    }).slice(0, limit || 24);
  }

  function gomokuStatic(board, id, player) {
    var parsed = parseGomokuCandidate(id);
    if (!parsed || board[parsed.row][parsed.col] !== '.') return -MATE;
    var own = gomokuThreat(board, parsed.row, parsed.col, player);
    var opposing = gomokuThreat(board, parsed.row, parsed.col, player ^ 1);
    var center = Math.abs(parsed.row - 7) + Math.abs(parsed.col - 7);
    return own + opposing * 1.1 - center * 2;
  }

  function createControl(runtime, budgetMs, maxNodes) {
    var options = isPlainRecord(runtime) ? runtime : {};
    var nowSource = ownData(options, 'now');
    var cancelSource = ownData(options, 'isCancelled');
    var now = nowSource.ok && nowSource.present && typeof nowSource.value === 'function' ? nowSource.value : Date.now;
    var cancelled = cancelSource.ok && cancelSource.present && typeof cancelSource.value === 'function' ? cancelSource.value : function neverCancelled() { return false; };
    var started;
    try { started = Number(now()); } catch (_error) { started = Date.now(); }
    if (!Number.isFinite(started)) started = Date.now();
    var state = { reason:null, nodes:0 };
    state.check = function checkpoint() {
      state.nodes += 1;
      try { if (cancelled() === true) { state.reason = 'cancelled'; return false; } } catch (_error) { state.reason = 'cancelled'; return false; }
      var current;
      try { current = Number(now()); } catch (_error) { current = started + budgetMs + 1; }
      if (!Number.isFinite(current) || current - started >= budgetMs) { state.reason = 'timeout'; return false; }
      if (state.nodes > maxNodes) { state.reason = 'node_limit'; return false; }
      return true;
    };
    return state;
  }

  function profileFor(gameId, difficulty) {
    if (gameId === 'xiangqi') {
      if (difficulty === 'easy') return { depth:1, width:8, nodes:1800 };
      if (difficulty === 'normal') return { depth:2, width:12, nodes:6200 };
      return { depth:3, width:16, nodes:18000 };
    }
    if (difficulty === 'easy') return { depth:1, width:5, nodes:1200 };
    if (difficulty === 'normal') return { depth:2, width:7, nodes:4200 };
    return { depth:2, width:10, nodes:10000 };
  }

  function initialXiangqiPosition() {
    var board = Array.from({ length:XQ_ROWS }, function makeRow() { return Array(XQ_COLS).fill(null); });
    var back = ['r','h','e','a','k','a','e','h','r'];
    for (var col = 0; col < XQ_COLS; col += 1) { board[0][col] = { p:1, t:back[col] }; board[9][col] = { p:0, t:back[col] }; }
    board[2][1] = { p:1, t:'c' }; board[2][7] = { p:1, t:'c' }; board[7][1] = { p:0, t:'c' }; board[7][7] = { p:0, t:'c' };
    [0,2,4,6,8].forEach(function pawn(col) { board[3][col] = { p:1, t:'p' }; board[6][col] = { p:0, t:'p' }; });
    return { board:board, lastMove:null, moveCount:0 };
  }

  var OPENING_BOOK_VERSION = 'board-opening-book-v1';
  var OPENING_BOOK = (function makeOpeningBook() {
    var xiangqi = initialXiangqiPosition();
    var gomoku = { board:Array.from({ length:GOMOKU_SIZE }, function row() { return '...............'; }).join('/'), last:null, moves:0 };
    return freeze({
      version:OPENING_BOOK_VERSION,
      metadata:freeze({
        bookVersion:OPENING_BOOK_VERSION,
        solverVersion:SOLVER_VERSION,
        rulesVersions:freeze({ xiangqi:'xiangqi-rule-v2', gomoku:'gomoku-local-v1' }),
        source:'internal-deterministic-seed-v1'
      }),
      entries:freeze({
        xiangqi:freeze({ [hashXiangqi(xiangqi, 0)]:'6,0>5,0' }),
        gomoku:freeze({ [hashGomoku(parseGomokuPosition(gomoku), 0)]:'7,7' })
      })
    });
  }());

  function openingBookMove(request) {
    var metadata = OPENING_BOOK.metadata;
    if (!metadata || metadata.bookVersion !== OPENING_BOOK_VERSION || metadata.solverVersion !== SOLVER_VERSION) return null;
    if (!metadata.rulesVersions || metadata.rulesVersions[request.gameId] !== request.rulesVersion) return null;
    var entries = OPENING_BOOK.entries[request.gameId];
    return entries && entries[request.positionHash] || null;
  }

  function ttKey(request, hash, depth) {
    return request.identity + '|' + request.gameId + '|' + request.rulesVersion + '|' + SOLVER_VERSION + '|' + OPENING_BOOK_VERSION + '|' + request.matchGeneration + '|' + hash + '|' + request.turn + '|' + depth;
  }

  function insertTT(table, key, value) {
    if (table.has(key)) table.delete(key);
    table.set(key, value);
    while (table.size > LIMITS.maxTTEntries) table.delete(table.keys().next().value);
  }

  function lookupTT(table, key, depth) {
    var value = table.get(key);
    if (!value || value.depth < depth || !Number.isFinite(value.score)) return null;
    table.delete(key); table.set(key, value);
    return value;
  }

  function xqNegamax(board, side, depth, alpha, beta, request, table, control, moveCount, lastMove) {
    if (!control.check()) return null;
    if (!xqFindKing(board, side)) return -MATE;
    if (!xqFindKing(board, side ^ 1)) return MATE;
    if (depth <= 0) return xqEvaluate(board, side);
    var hash = hashXiangqi({ board:board, moveCount:moveCount, lastMove:lastMove }, side);
    var key = ttKey(request, hash, depth);
    var cached = lookupTT(table, key, depth);
    if (cached) return cached.score;
    var moves = xqLegalMoves(board, side).map(function decorate(move) { move.order = xqOrder(move); return move; }).sort(function compare(left, right) { return right.order - left.order || left.id.localeCompare(right.id); }).slice(0, profileFor('xiangqi', request.difficulty).width);
    if (!moves.length) return xqIsCheck(board, side) ? -MATE + depth : -800;
    var best = -Infinity;
    for (var index = 0; index < moves.length; index += 1) {
      if (!control.check()) return null;
      var move = moves[index], applied = xqApply(board, move);
      var score;
      if (applied.capture && applied.capture.t === 'k') score = MATE - depth;
      else {
        var child = xqNegamax(applied.board, side ^ 1, depth - 1, -beta, -alpha, request, table, control, moveCount + 1, { from:move.from, to:move.to });
        if (child === null) return null;
        score = -child;
      }
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    insertTT(table, key, { depth:depth, score:best });
    return best;
  }

  function solveXiangqi(request, table, control) {
    var legal = xqLegalMoves(request.position.board, request.turn);
    var byId = new Map(legal.map(function mapMove(move) { return [move.id, move]; }));
    var roots = request.legalCandidates.map(function choose(id) { return byId.get(id); });
    if (roots.some(function missing(move) { return !move; })) return { error:'unknown_candidate' };
    var bookMove = openingBookMove(request);
    if (!control.check()) return null;
    if (bookMove && request.legalCandidates.indexOf(bookMove) !== -1) return { source:'opening-book', ranked:[{ id:bookMove, score:MATE - 1 }] };
    var profile = profileFor('xiangqi', request.difficulty);
    var ranked = [];
    for (var index = 0; index < roots.length; index += 1) {
      if (!control.check()) return null;
      var root = roots[index], applied = xqApply(request.position.board, root);
      var score;
      if (applied.capture && applied.capture.t === 'k') score = MATE;
      else {
        var child = xqNegamax(applied.board, request.turn ^ 1, profile.depth - 1, -MATE, MATE, request, table, control, request.position.moveCount + 1, { from:root.from, to:root.to });
        if (child === null) return null;
        score = -child;
      }
      ranked.push({ id:root.id, score:score });
    }
    ranked.sort(function compare(left, right) { return right.score - left.score || left.id.localeCompare(right.id); });
    return { source:'search', ranked:ranked.slice(0, LIMITS.maxRanked) };
  }

  function gomokuBoardText(board) { return board.map(function row(value) { return value.join(''); }).join('/'); }

  function gomokuNegamax(board, side, depth, alpha, beta, request, table, control, moves, last) {
    if (!control.check()) return null;
    if (depth <= 0) return 0;
    var position = { board:gomokuBoardText(board), last:last, moves:moves };
    var hash = hashGomoku(position, side);
    var key = ttKey(request, hash, depth);
    var cached = lookupTT(table, key, depth);
    if (cached) return cached.score;
    var profile = profileFor('gomoku', request.difficulty);
    var candidates = gomokuNearby(board, profile.width * 2).map(function score(id) { return { id:id, score:gomokuStatic(board, id, side) }; }).sort(function compare(left, right) { return right.score - left.score || left.id.localeCompare(right.id); }).slice(0, profile.width);
    if (!candidates.length) return 0;
    var best = -Infinity;
    for (var index = 0; index < candidates.length; index += 1) {
      if (!control.check()) return null;
      var parsed = parseGomokuCandidate(candidates[index].id);
      board[parsed.row][parsed.col] = String(side);
      var score;
      if (gomokuWin(board, parsed.row, parsed.col, side)) score = MATE - depth;
      else {
        var child = gomokuNegamax(board, side ^ 1, depth - 1, -beta, -alpha, request, table, control, moves + 1, candidates[index].id);
        if (child === null) { board[parsed.row][parsed.col] = '.'; return null; }
        score = -child;
      }
      board[parsed.row][parsed.col] = '.';
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    insertTT(table, key, { depth:depth, score:best });
    return best;
  }

  function solveGomoku(request, table, control) {
    var roots = request.legalCandidates.map(parseGomokuCandidate);
    if (roots.some(function malformed(item) { return !item || request.position.board[item.row][item.col] !== '.'; })) return { error:'unknown_candidate' };
    var bookMove = openingBookMove(request);
    if (!control.check()) return null;
    if (bookMove && request.legalCandidates.indexOf(bookMove) !== -1) return { source:'opening-book', ranked:[{ id:bookMove, score:MATE - 1 }] };
    var profile = profileFor('gomoku', request.difficulty);
    var ranked = [];
    for (var index = 0; index < roots.length; index += 1) {
      if (!control.check()) return null;
      var root = roots[index];
      var staticScore = gomokuStatic(request.position.board, root.id, request.turn);
      request.position.board[root.row][root.col] = String(request.turn);
      var score;
      if (gomokuWin(request.position.board, root.row, root.col, request.turn)) score = MATE;
      else {
        var child = gomokuNegamax(request.position.board, request.turn ^ 1, profile.depth - 1, -MATE, MATE, request, table, control, request.position.moves + 1, root.id);
        if (child === null) { request.position.board[root.row][root.col] = '.'; return null; }
        score = -child;
      }
      request.position.board[root.row][root.col] = '.';
      ranked.push({ id:root.id, score:score + staticScore * 0.02 });
    }
    ranked.sort(function compare(left, right) { return right.score - left.score || left.id.localeCompare(right.id); });
    return { source:'search', ranked:ranked.slice(0, LIMITS.maxRanked) };
  }

  function looseBinding(input) {
    var source = isPlainRecord(input) ? input : {};
    function loose(key, fallback) {
      var field = ownData(source, key);
      return field.ok && field.present ? field.value : fallback;
    }
    return {
      requestId:typeof loose('requestId', null) === 'string' ? loose('requestId', null) : null,
      gameId:typeof loose('gameId', null) === 'string' ? loose('gameId', null) : null,
      rulesVersion:typeof loose('rulesVersion', null) === 'string' ? loose('rulesVersion', null) : null,
      matchGeneration:safeInteger(loose('matchGeneration', -1), 0, Number.MAX_SAFE_INTEGER) ? loose('matchGeneration', -1) : null,
      turn:safeInteger(loose('turn', -1), 0, 1) ? loose('turn', -1) : null,
      positionHash:typeof loose('positionHash', null) === 'string' ? loose('positionHash', null) : null
    };
  }

  function result(binding, accepted, reason, source, ranked) {
    var safeRanked = Array.isArray(ranked) ? ranked.slice(0, LIMITS.maxRanked).filter(function valid(row) {
      return row && typeof row.id === 'string' && Number.isFinite(row.score);
    }).map(function project(row) { return freeze({ id:row.id, score:Number(row.score) }); }) : [];
    return freeze({
      accepted:accepted === true,
      reason:reason || null,
      requestId:binding.requestId,
      gameId:binding.gameId,
      rulesVersion:binding.rulesVersion,
      solverVersion:SOLVER_VERSION,
      matchGeneration:binding.matchGeneration,
      turn:binding.turn,
      positionHash:binding.positionHash,
      source:source || null,
      ranked:freeze(safeRanked)
    });
  }

  function parseRequest(input) {
    var binding = looseBinding(input);
    var fields = ['requestId','gameId','rulesVersion','solverVersion','identity','matchGeneration','turn','positionHash','position','legalCandidates','difficulty','budgetMs'];
    if (!exactKeys(input, fields, fields)) return { binding:binding, error:'invalid_request' };
    var requestId = safeString(ownData(input, 'requestId').value, ID_PATTERN, LIMITS.maxRequestIdLength);
    var gameId = ownData(input, 'gameId').value;
    var rulesVersion = ownData(input, 'rulesVersion').value;
    var solverVersion = ownData(input, 'solverVersion').value;
    var identity = safeString(ownData(input, 'identity').value, ID_PATTERN, LIMITS.maxIdentityLength);
    var matchGeneration = ownData(input, 'matchGeneration').value;
    var turn = ownData(input, 'turn').value;
    var positionHash = ownData(input, 'positionHash').value;
    var difficulty = ownData(input, 'difficulty').value;
    var budgetMs = ownData(input, 'budgetMs').value;
    var candidates = ownData(input, 'legalCandidates').value;
    if (!requestId || (gameId !== 'xiangqi' && gameId !== 'gomoku') || typeof rulesVersion !== 'string' || solverVersion !== SOLVER_VERSION || !identity ||
        !safeInteger(matchGeneration, 0, Number.MAX_SAFE_INTEGER) || !safeInteger(turn, 0, 1) || typeof positionHash !== 'string' || positionHash.length > LIMITS.maxPositionHashLength || !HASH_PATTERN.test(positionHash) ||
        ['easy','normal','hard'].indexOf(difficulty) === -1 || !safeInteger(budgetMs, 1, LIMITS.maxBudgetMs) || !Array.isArray(candidates) || !candidates.length) return { binding:binding, error:'invalid_request' };
    if ((gameId === 'xiangqi' && rulesVersion !== 'xiangqi-rule-v2') || (gameId === 'gomoku' && rulesVersion !== 'gomoku-local-v1')) return { binding:binding, error:'invalid_rules_version' };
    if (candidates.length > LIMITS.maxCandidates) return { binding:binding, error:'too_many_candidates' };
    if (candidates.some(function invalidCandidate(candidate) { return typeof candidate !== 'string' || candidate.length > 80; }) || new Set(candidates).size !== candidates.length) return { binding:binding, error:'invalid_candidate' };
    var parsedPosition = gameId === 'xiangqi' ? parseXiangqiPosition(ownData(input, 'position').value) : parseGomokuPosition(ownData(input, 'position').value);
    if (!parsedPosition) return { binding:binding, error:'invalid_position' };
    if (gameId === 'gomoku' && parsedPosition.moves % 2 !== turn) return { binding:binding, error:'invalid_turn' };
    var expectedHash = gameId === 'xiangqi' ? hashXiangqi(parsedPosition, turn) : hashGomoku(parsedPosition, turn);
    if (positionHash !== expectedHash) return { binding:binding, error:'hash_mismatch' };
    binding = { requestId:requestId, gameId:gameId, rulesVersion:rulesVersion, matchGeneration:matchGeneration, turn:turn, positionHash:positionHash };
    return { binding:binding, value:{ requestId:requestId, gameId:gameId, rulesVersion:rulesVersion, identity:identity, matchGeneration:matchGeneration, turn:turn, positionHash:positionHash, position:parsedPosition, legalCandidates:candidates.slice(), difficulty:difficulty, budgetMs:budgetMs } };
  }

  function create() {
    var table = new Map();
    function solve(input, runtime) {
      var parsed = parseRequest(input);
      if (parsed.error) return result(parsed.binding, false, parsed.error, null, []);
      var request = parsed.value;
      var control = createControl(runtime, request.budgetMs, profileFor(request.gameId, request.difficulty).nodes);
      if (!control.check()) return result(parsed.binding, false, control.reason, null, []);
      var solved = request.gameId === 'xiangqi' ? solveXiangqi(request, table, control) : solveGomoku(request, table, control);
      if (control.reason) return result(parsed.binding, false, control.reason, null, []);
      if (!solved) return result(parsed.binding, false, 'solver_failed', null, []);
      if (solved.error) return result(parsed.binding, false, solved.error, null, []);
      if (!solved.ranked || !solved.ranked.length) return result(parsed.binding, false, 'no_legal_candidate', null, []);
      return result(parsed.binding, true, null, solved.source, solved.ranked);
    }
    function clear() { table.clear(); return true; }
    return freeze({ solve:solve, clear:clear });
  }

  return freeze({
    SOLVER_VERSION:SOLVER_VERSION,
    RULE_VERSIONS:RULE_VERSIONS,
    LIMITS:LIMITS,
    OPENING_BOOK_VERSION:OPENING_BOOK_VERSION,
    hashPosition:hashPosition,
    create:create
  });
}));
