/* ================= 象棋 ================= */
function gameXiangqi(area, extra, n, opts){
  opts = opts || {};
  const COLS = 9, ROWS = 10;
  const PIECE = { 'k':'帅','a':'仕','e':'相','h':'马','r':'车','c':'炮','p':'兵' };
  const BLACK_PIECE = { 'k':'将','a':'士','e':'象','h':'马','r':'车','c':'炮','p':'卒' };
  const EMOJI = { '帅':'🤴','仕':'🧑‍⚖️','相':'🧓','马':'🐴','车':'🚗','炮':'💣','兵':'🪖','将':'👑','士':'🧑‍⚖️','象':'🐘','卒':'🪖' };
  function xiangqiPieceName(piece){return piece?t('xiangqi_piece_'+(piece.p===0?'red_':'black_')+piece.t):'';}
  function xiangqiCapturedName(label){
    for(const [type,name] of Object.entries(PIECE))if(name===label)return t('xiangqi_piece_red_'+type);
    for(const [type,name] of Object.entries(BLACK_PIECE))if(name===label)return t('xiangqi_piece_black_'+type);
    return label;
  }
  let board = Array.from({length:ROWS}, () => Array(COLS).fill(null)); // {p, t}
  let cur = 0, over = false, winner = -1, selected = null, legalMoves = [], lastMove = null;
  let aiPending = false, aiEpoch = 0;
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator;
  let startedAt = Date.now(), finishedAt = 0, moveCount = 0, captureCount = 0, checkCount = 0;
  let capturedPieces = [[], []], motion = null, motionEpoch = 0;
  // Wave C presentation is deliberately local-only.  It visualizes the
  // existing authority state without changing Xiangqi Rule Core, clocks or
  // the online action protocol.
  const XIANGQI_WAVE_C_PROCESS_STEPS = ['turn','select','move','capture','check','clock','terminal'];
  let xiangqiWaveCProcess = 'turn', xiangqiWaveCProcessDetail = '', xiangqiWaveCProcessEpoch = 0, xiangqiWaveCProcessRevision = 0;
  const xiangqiWaveCProcessTimers = new Set();
  let xiangqiWaveCProcessRail = null, xiangqiWaveCProcessLabel = null, xiangqiWaveCProcessSteps = [], xiangqiWaveCBoard = null;
  let destroyed = false;
  const RULE_PROTOCOL='xiangqi-rule-v2';
  const ruleAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol===RULE_PROTOCOL&&typeof opts.sendXiangqiAction==='function'&&typeof XiangqiRules!=='undefined');
  const clockAuthority=!!(opts.online&&opts.gameplayMeta&&['xiangqi-clock-v1',RULE_PROTOCOL].includes(opts.gameplayMeta.protocol));
  let clockMoveSeq=0;
  let clockMode = ['rapid','blitz'].includes(opts.clockMode) ? opts.clockMode : 'casual';
  let clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
  let lastClockAt = Date.now();
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';
  const clockHud = el('div','xiangqi-clock-hud');
  const capturedHud = el('div','xiangqi-captured-hud');
  extra.appendChild(clockHud); extra.appendChild(capturedHud);
  function normalizeCosmetic(value){
    if (typeof value === 'string') return {default:value === 'jade' ? 'jade' : 'classic',players:{}};
    const source=value||{},base=source.default||source.pieces;
    return {default:base === 'jade' ? 'jade' : 'classic',players:{...(source.players||{})}};
  }
  function pieceSkin(player){const value=cosmetic.players&&cosmetic.players[player];return value === 'jade' || (value&&value.pieces==='jade') ? 'jade' : cosmetic.default;}
  function formatClock(value){
    if (value === null) return 'Casual';
    const seconds = Math.max(0, Math.ceil(value / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  function syncClock(){
    const now = Date.now();
    if (!over && clockRemaining[cur] !== null) clockRemaining[cur] = Math.max(0, clockRemaining[cur] - (now - lastClockAt));
    lastClockAt = now;
  }
  function clearXiangqiWaveCProcessTimers(){
    xiangqiWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    xiangqiWaveCProcessTimers.clear();
  }
  function scheduleXiangqiWaveCProcess(callback, delay){
    const epoch = xiangqiWaveCProcessEpoch;
    const timer = setTimeout(() => {
      xiangqiWaveCProcessTimers.delete(timer);
      if (!destroyed && epoch === xiangqiWaveCProcessEpoch) callback();
    }, Math.max(0, Number(delay) || 0));
    if (timer && typeof timer.unref === 'function') timer.unref();
    xiangqiWaveCProcessTimers.add(timer);
    return timer;
  }
  function xiangqiWaveCData(node, key, value){
    if (!node) return;
    const datasetKey = key.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
    if (node.dataset) node.dataset[datasetKey] = String(value);
    if (node.setAttribute) node.setAttribute('data-' + key, String(value));
  }
  function xiangqiWaveCProcessText(){
    if (xiangqiWaveCProcess === 'select') return t('xiangqi_initial_turn');
    if (xiangqiWaveCProcess === 'move') return t('player_turn', cur + 1);
    if (xiangqiWaveCProcess === 'capture') return t('xiangqi_captured_count', captureCount);
    if (xiangqiWaveCProcess === 'check') return t('xiangqi_player_in_check', cur + 1);
    if (xiangqiWaveCProcess === 'clock') return t('xiangqi_clock_active', cur + 1, formatClock(clockRemaining[cur]));
    if (xiangqiWaveCProcess === 'terminal') return t('match_over');
    return t('xiangqi_turn_status', spectator ? t('spectating_prefix') : '', t(cur === 0 ? 'xiangqi_red_side' : 'xiangqi_black_side'), t(opts.online && cur === opts.myIdx && !spectator ? 'your_turn' : 'thinking'));
  }
  function paintXiangqiWaveCProcess(){
    xiangqiWaveCData(area, 'xiangqi-process', xiangqiWaveCProcess);
    xiangqiWaveCData(xiangqiWaveCBoard, 'xiangqi-process', xiangqiWaveCProcess);
    if (xiangqiWaveCProcessRail){
      xiangqiWaveCData(xiangqiWaveCProcessRail, 'xiangqi-process', xiangqiWaveCProcess);
      if (xiangqiWaveCProcessLabel) xiangqiWaveCProcessLabel.textContent = xiangqiWaveCProcessText();
      xiangqiWaveCProcessSteps.forEach(step => {
        const active = step && step.dataset && step.dataset.xiangqiProcessStep === xiangqiWaveCProcess;
        xiangqiWaveCData(step, 'xiangqi-process-active', active ? 'true' : 'false');
        if (step && step.style){
          step.style.background = active ? 'linear-gradient(90deg,var(--accent,#435ac1),#f59e0b)' : 'rgba(76,43,21,.16)';
          step.style.boxShadow = active ? '0 2px 0 rgba(43,32,37,.2),0 5px 10px rgba(245,158,11,.28)' : 'inset 0 1px 1px rgba(255,255,255,.65)';
          step.style.transform = active && !(typeof prefersReducedMotion === 'function' && prefersReducedMotion()) ? 'translateY(-2px) scaleY(1.16)' : 'none';
        }
      });
    }
  }
  function setXiangqiWaveCProcess(next, detail){
    const process = XIANGQI_WAVE_C_PROCESS_STEPS.includes(next) ? next : 'turn';
    const processDetail = detail === undefined || detail === null ? '' : String(detail);
    if (process === xiangqiWaveCProcess && processDetail === xiangqiWaveCProcessDetail) return;
    xiangqiWaveCProcess = process;
    xiangqiWaveCProcessDetail = processDetail;
    xiangqiWaveCProcessRevision++;
    paintXiangqiWaveCProcess();
  }
  function settleXiangqiWaveCProcess(next, detail, delay){
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) { setXiangqiWaveCProcess(next, detail); return; }
    const revision = xiangqiWaveCProcessRevision;
    scheduleXiangqiWaveCProcess(() => {
      if (revision === xiangqiWaveCProcessRevision) setXiangqiWaveCProcess(next, detail);
    }, delay);
  }
  function pulseXiangqiWaveCClock(){
    if (over){
      setXiangqiWaveCProcess('terminal', winner);
      return;
    }
    setXiangqiWaveCProcess('clock', cur);
    settleXiangqiWaveCProcess('turn', cur, 180);
  }
  function renderAux(){
    clockHud.innerHTML = '';
    for (let i = 0; i < 2; i++){
      const chip = el('span','xiangqi-clock' + (i === cur && !over ? ' active' : ''), t(i===0?'xiangqi_red_side':'xiangqi_black_side')+' '+formatClock(clockRemaining[i]));
      chip.style.cssText = 'display:inline-flex;margin:3px;padding:6px 10px;border-radius:999px;background:' + (i === cur && !over ? 'var(--accent)' : 'var(--card)') + ';color:' + (i === cur && !over ? '#fff' : 'var(--text)') + ';font-weight:800;';
      clockHud.appendChild(chip);
    }
    capturedHud.textContent = t('xiangqi_captured_summary',capturedPieces[0].length?capturedPieces[0].map(xiangqiCapturedName).join(' '):'—',capturedPieces[1].length?capturedPieces[1].map(xiangqiCapturedName).join(' '):'—');
    capturedHud.style.cssText = 'text-align:center;font-size:12px;color:var(--muted);margin:4px 0 8px;';
  }
  function initBoard(){
    board = Array.from({length:ROWS}, () => Array(COLS).fill(null));
    const setup = [
      ['r','h','e','a','k','a','e','h','r'],
      [null,null,null,null,null,null,null,null,null],
      [null,'c',null,null,null,null,null,'c',null],
      ['p',null,'p',null,'p',null,'p',null,'p'],
      [null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null],
      ['p',null,'p',null,'p',null,'p',null,'p'],
      [null,'c',null,null,null,null,null,'c',null],
      [null,null,null,null,null,null,null,null,null],
      ['r','h','e','a','k','a','e','h','r'],
    ];
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const t = setup[r][c];
        if (t) board[r][c] = { p: r < 5 ? 1 : 0, t };
      }
    }
  }
  function inPalace(r, c, p){
    return c >= 3 && c <= 5 && (p === 1 ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9));
  }
  function findKing(p){
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      if (board[r][c] && board[r][c].p === p && board[r][c].t === 'k') return [r,c];
    }
    return null;
  }
  function isCheck(p){
    const k = findKing(p);
    if (!k) return true;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (piece && piece.p !== p){
        if (movesOf(piece.p, r, c).some(([mr,mc]) => mr === k[0] && mc === k[1])) return true;
      }
    }
    return false;
  }
  function movesOf(p, r, c){
    const piece = board[r][c];
    if (!piece || piece.p !== p) return [];
    const res = [];
    const oppKing = findKing(p ^ 1);
    const canMoveTo = (nr, nc) => {
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      if (board[nr][nc] && board[nr][nc].p === p) return false;
      return true;
    };
    if (piece.t === 'k'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nr = r+dr, nc = c+dc;
        if (inPalace(nr, nc, p) && canMoveTo(nr,nc)) res.push([nr,nc]);
      }
      // 飞将
      if (oppKing && oppKing[1] === c){
        let blocked = false;
        for (let rr = Math.min(r, oppKing[0]) + 1; rr < Math.max(r, oppKing[0]); rr++){
          if (board[rr][c]){ blocked = true; break; }
        }
        if (!blocked) res.push(oppKing);
      }
    } else if (piece.t === 'a'){
      for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
        const nr = r+dr, nc = c+dc;
        if (inPalace(nr, nc, p) && canMoveTo(nr,nc)) res.push([nr,nc]);
      }
    } else if (piece.t === 'e'){
      for (const [dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]){
        const nr = r+dr, nc = c+dc;
        const eye = [r+dr/2, c+dc/2];
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const cross = p === 1 ? nr <= 4 : nr >= 5;
        if (!cross) continue;
        if (board[eye[0]][eye[1]]) continue;
        if (canMoveTo(nr,nc)) res.push([nr,nc]);
      }
    } else if (piece.t === 'h'){
      const legs = [[[-1,0],[-2,-1]],[[-1,0],[-2,1]],[[1,0],[2,-1]],[[1,0],[2,1]],[[0,-1],[-1,-2]],[[0,-1],[1,-2]],[[0,1],[-1,2]],[[0,1],[1,2]]];
      for (const [leg, step] of legs){
        const lr = r+leg[0], lc = c+leg[1];
        const nr = r+step[0], nc = c+step[1];
        if (!canMoveTo(nr,nc)) continue;
        if (board[lr][lc]) continue;
        res.push([nr,nc]);
      }
    } else if (piece.t === 'r'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr = r+dr, nc = c+dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS){
          if (!board[nr][nc]){ res.push([nr,nc]); }
          else { if (board[nr][nc].p !== p) res.push([nr,nc]); break; }
          nr += dr; nc += dc;
        }
      }
    } else if (piece.t === 'c'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr = r+dr, nc = c+dc, screen = false;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS){
          if (!screen){
            if (!board[nr][nc]) res.push([nr,nc]);
            else screen = true;
          } else {
            if (board[nr][nc]){
              if (board[nr][nc].p !== p) res.push([nr,nc]);
              break;
            }
          }
          nr += dr; nc += dc;
        }
      }
    } else if (piece.t === 'p'){
      const fwd = p === 1 ? 1 : -1;
      const nr = r + fwd;
      if (nr >= 0 && nr < ROWS && canMoveTo(nr, c)) res.push([nr, c]);
      if ((p === 1 && r >= 5) || (p === 0 && r <= 4)){
        for (const dc of [-1,1]){
          if (canMoveTo(r, c+dc)) res.push([r, c+dc]);
        }
      }
    }
    return res;
  }
  function legalMovesOf(p, r, c){
    if(ruleAuthority&&typeof XiangqiRules!=='undefined')return XiangqiRules.legalMovesForPiece({protocol:RULE_PROTOCOL,board:board.map(row=>row.map(piece=>piece?{...piece}:null)),current:cur,terminal:over},p,r,c);
    return movesOf(p, r, c).filter(([nr,nc]) => {
      const from = board[r][c], to = board[nr][nc];
      board[r][c] = null; board[nr][nc] = from;
      const bad = isCheck(p);
      board[r][c] = from; board[nr][nc] = to;
      return !bad;
    });
  }
  const XQ_VALUE = { p:100, a:250, e:260, h:470, c:500, r:1000, k:30000 };
  const XQ_MATE = 10000000;
  function xqPieceSquare(piece, r, c){
    const forward = piece.p === 0 ? 9 - r : r;
    const center = 4 - Math.abs(c - 4);
    const middleRank = 4.5 - Math.abs(r - 4.5);
    if (piece.t === 'p') return forward * 7 + center * (forward >= 5 ? 5 : 2) + (forward >= 5 ? 28 : 0);
    if (piece.t === 'h') return center * 10 + middleRank * 5 - ((c === 0 || c === 8) ? 18 : 0);
    if (piece.t === 'c') return center * 5 + middleRank * 3 + (forward >= 2 && forward <= 7 ? 10 : 0);
    if (piece.t === 'r') return center * 3 + middleRank * 2 + forward;
    if (piece.t === 'a') return c === 4 ? 14 : 8;
    if (piece.t === 'e') return center * 2 + (forward <= 4 ? 8 : 0);
    if (piece.t === 'k') return -Math.abs(c - 4) * 12 - forward * 5;
    return 0;
  }
  function xqAllLegal(p){
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (!piece || piece.p !== p) continue;
      legalMovesOf(p, r, c).forEach(to => all.push({ from:[r,c], to }));
    }
    return all;
  }
  function xqMakeMove(move){
    const piece = board[move.from[0]][move.from[1]];
    const captured = board[move.to[0]][move.to[1]];
    board[move.from[0]][move.from[1]] = null;
    board[move.to[0]][move.to[1]] = piece;
    return captured;
  }
  function xqUndoMove(move, captured){
    board[move.from[0]][move.from[1]] = board[move.to[0]][move.to[1]];
    board[move.to[0]][move.to[1]] = captured;
  }
  function xqMoveKey(move){ return move.from.join(',') + '>' + move.to.join(','); }
  function xqMoveOrderScore(move){
    const piece = board[move.from[0]][move.from[1]];
    const target = board[move.to[0]][move.to[1]];
    if (!piece) return -Infinity;
    const capture = target ? (target.t === 'k' ? XQ_MATE : XQ_VALUE[target.t] * 12 - XQ_VALUE[piece.t]) : 0;
    return capture + xqPieceSquare(piece, move.to[0], move.to[1]) - xqPieceSquare(piece, move.from[0], move.from[1]);
  }
  function xqOrderedMoves(p, limit, capturesOnly){
    let moves = xqAllLegal(p);
    if (capturesOnly) moves = moves.filter(move => !!board[move.to[0]][move.to[1]]);
    moves.forEach(move => { move.order = xqMoveOrderScore(move); });
    moves.sort((a, b) => b.order - a.order || xqMoveKey(a).localeCompare(xqMoveKey(b)));
    return limit ? moves.slice(0, limit) : moves;
  }
  // 确定性局面评估：子力、位置、机动性、王区守卫/压力与将军状态。
  function xqEvaluate(perspective){
    const kings = [findKing(0), findKing(1)];
    if (!kings[perspective]) return -XQ_MATE;
    if (!kings[perspective ^ 1]) return XQ_MATE;
    const score = [0, 0], pressure = [0, 0];
    const mobilityWeight = { p:1, a:1, e:1, h:3, c:2, r:2, k:1 };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (!piece) continue;
      const moves = movesOf(piece.p, r, c);
      score[piece.p] += XQ_VALUE[piece.t] + xqPieceSquare(piece, r, c) + moves.length * mobilityWeight[piece.t];
      const enemyKing = kings[piece.p ^ 1];
      if (enemyKing){
        for (const [mr, mc] of moves){
          const distance = Math.abs(mr - enemyKing[0]) + Math.abs(mc - enemyKing[1]);
          if (distance <= 1) pressure[piece.p] += distance ? 1 : 4;
        }
      }
    }
    for (let p = 0; p < 2; p++){
      const king = kings[p];
      let guards = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){
        if (!dr && !dc) continue;
        const r = king[0] + dr, c = king[1] + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] && board[r][c].p === p) guards++;
      }
      score[p] += guards * 15 - pressure[p ^ 1] * 13;
      if (isCheck(p)) score[p] -= 190;
    }
    return score[perspective] - score[perspective ^ 1];
  }
  function xqBudgetExceeded(control){
    control.nodes++;
    if (control.nodes > control.maxNodes || Date.now() >= control.deadline){ control.stopped = true; return true; }
    return false;
  }
  function xqQuiescence(side, alpha, beta, qDepth, ply, control){
    if (xqBudgetExceeded(control)) return xqEvaluate(side);
    if (!findKing(side)) return -XQ_MATE + ply;
    if (!findKing(side ^ 1)) return XQ_MATE - ply;
    const checked = isCheck(side);
    const stand = xqEvaluate(side);
    if (!checked){
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qDepth <= 0) return alpha;
    } else if (qDepth < 0){
      return stand;
    }
    const moves = xqOrderedMoves(side, checked ? 20 : 9, !checked);
    if (!moves.length) return checked ? -XQ_MATE + ply : alpha;
    for (const move of moves){
      const captured = xqMakeMove(move);
      const score = captured && captured.t === 'k'
        ? XQ_MATE - ply
        : -xqQuiescence(side ^ 1, -beta, -alpha, qDepth - 1, ply + 1, control);
      xqUndoMove(move, captured);
      if (control.stopped) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
  function xqNegamax(side, depth, alpha, beta, ply, control){
    if (xqBudgetExceeded(control)) return xqEvaluate(side);
    if (!findKing(side)) return -XQ_MATE + ply;
    if (!findKing(side ^ 1)) return XQ_MATE - ply;
    if (depth <= 0) return xqQuiescence(side, alpha, beta, 1, ply, control);
    const checked = isCheck(side);
    const width = checked ? 24 : (depth >= 3 ? 12 : (depth === 2 ? 16 : 19));
    const moves = xqOrderedMoves(side, width, false);
    if (!moves.length) return -XQ_MATE + ply;
    let best = -Infinity;
    for (const move of moves){
      const captured = xqMakeMove(move);
      const score = captured && captured.t === 'k'
        ? XQ_MATE - ply
        : -xqNegamax(side ^ 1, depth - 1, -beta, -alpha, ply + 1, control);
      xqUndoMove(move, captured);
      if (control.stopped) return best > -Infinity ? best : xqEvaluate(side);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }
  function xqDifficultyProfile(difficulty, pieceCount){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { rootWidth:10, maxDepth:2, deadline:65, maxNodes:1600, candidates:4 };
    if (id === 'hard') return { rootWidth:36, maxDepth:pieceCount <= 12 ? 5 : 4, deadline:280, maxNodes:12000, candidates:12 };
    // 普通档延续当前迭代加深预算。
    return { rootWidth:28, maxDepth:pieceCount <= 12 ? 4 : 3, deadline:190, maxNodes:7200, candidates:8 };
  }
  function xqSearchRoot(side, difficulty){
    const all = xqOrderedMoves(side, 0, false);
    if (!all.length) return [];
    const fallback = [];
    for (const move of all){
      const captured = xqMakeMove(move);
      const givesCheck = !!findKing(side ^ 1) && isCheck(side ^ 1);
      const score = captured && captured.t === 'k' ? XQ_MATE : xqEvaluate(side) + (givesCheck ? 26 : 0);
      xqUndoMove(move, captured);
      fallback.push({ move, score, givesCheck, captured, order:move.order });
    }
    fallback.sort((a, b) => b.score - a.score || b.order - a.order || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
    const pieceCount = board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const profile = xqDifficultyProfile(difficulty, pieceCount);
    let completed = fallback.slice(0, profile.rootWidth);
    const control = { deadline:Date.now() + profile.deadline, nodes:0, maxNodes:profile.maxNodes, stopped:false };
    for (let depth = 2; depth <= profile.maxDepth; depth++){
      const iteration = [];
      control.stopped = false;
      for (const base of completed){
        if (Date.now() >= control.deadline || control.nodes >= control.maxNodes){ control.stopped = true; break; }
        const move = base.move;
        const captured = xqMakeMove(move);
        const score = captured && captured.t === 'k'
          ? XQ_MATE
          : -xqNegamax(side ^ 1, depth - 1, -XQ_MATE, XQ_MATE, 1, control);
        xqUndoMove(move, captured);
        if (control.stopped) break;
        iteration.push({ move, score, givesCheck:base.givesCheck, captured:base.captured, order:base.order });
      }
      if (control.stopped || iteration.length !== completed.length) break;
      iteration.sort((a, b) => b.score - a.score || b.order - a.order || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
      completed = iteration;
    }
    return completed;
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = aiEpoch;
    const turn = cur;
    setStatus(t('ai_thinking'));
    setTimeout(async () => {
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'hard' };
      const ranked = xqSearchRoot(cur, difficulty);
      if (!ranked.length){ aiPending = false; lose(cur); return; }
      const best = ranked[0];
      const band = best.score >= XQ_MATE / 2 ? 1 : 48;
      const pieceCount = board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
      const profile = xqDifficultyProfile(difficulty, pieceCount);
      const near = ranked.filter(item => item.score >= best.score - band).slice(0, profile.candidates)
        .sort((a, b) => b.score - a.score || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
      const choices = near.map(item => xqMoveKey(item.move));
      const moveByChoice = new Map(near.map(item => [xqMoveKey(item.move), item.move]));
      const learningCandidates = near.map(item => ({ choice:xqMoveKey(item.move), features:{
        quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.score - item.score) / Math.max(1, band))),
        search_value:Math.max(-1, Math.min(1, item.score / 1200)),
        capture_value:item.captured ? Math.min(1, XQ_VALUE[item.captured.t] / 1200) : 0,
        gives_check:item.givesCheck ? 1 : 0,
        move_order:Math.max(-1, Math.min(1, item.order / 1000)),
        search_depth:Math.min(1, profile.maxDepth / 5),
      } }));
      const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
      const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };
      const requestStateKey = JSON.stringify({ board:board.map(row => row.map(item => item ? (item.p + item.t) : '--')), cur, lastMove });
      // 候选会在所有难度中进入个性化学习；远端裁决仅能影响困难档。
      const remoteChoice = await aiChoose('xiangqi', {
        board: board.map(row => row.map(item => item ? (item.p + item.t) : '--')),
        turn: cur, inCheck: isCheck(cur), lastMove,
      }, choices, remoteProfile, learningCandidates);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn ||
          JSON.stringify({ board:board.map(row => row.map(item => item ? (item.p + item.t) : '--')), cur, lastMove }) !== requestStateKey){
        aiPending = false;
        return;
      }
      const localIndex = typeof aiDifficultyLocalChoiceIndex === 'function'
        ? aiDifficultyLocalChoiceIndex(difficulty, choices.length) : (difficulty.id === 'easy' ? Math.min(choices.length - 1, 1) : 0);
      const localChoice = choices[Math.max(0, localIndex)] || choices[0];
      const xqMv = remoteAllowed && moveByChoice.has(remoteChoice) ? moveByChoice.get(remoteChoice) : moveByChoice.get(localChoice);
      const executedChoice = xqMoveKey(xqMv);
      aiPending = false;
      aiSpeak(difficulty, 'think');
      if (opts.online && opts.ai && opts.ai.has(turn) && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { from:xqMv.from, to:xqMv.to });
      if (doMove(xqMv.from, xqMv.to) && typeof confirmAIReady === 'function') {
        confirmAIReady('xiangqi', executedChoice);
      }
    }, 750);
  }
  function doMove(from, to){
    if (over || !Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return false;
    const coords = from.concat(to).map(Number);
    if (!coords.every(Number.isInteger)) return false;
    from = coords.slice(0, 2); to = coords.slice(2, 4);
    if (from[0] < 0 || from[0] >= ROWS || from[1] < 0 || from[1] >= COLS ||
        to[0] < 0 || to[0] >= ROWS || to[1] < 0 || to[1] >= COLS) return false;
    const piece = board[from[0]][from[1]];
    if (!piece || piece.p !== cur || !legalMovesOf(cur, from[0], from[1]).some(m => m[0] === to[0] && m[1] === to[1])) return false;
    syncClock();
    const captured = board[to[0]][to[1]];
    playFeedback(captured ? 'capture' : 'move');
    if (captured){
      capturedPieces[cur].push(captured.p === 0 ? PIECE[captured.t] : BLACK_PIECE[captured.t]);
      captureCount++;
    }
    const animateMove = !(typeof prefersReducedMotion === 'function' && prefersReducedMotion());
    setXiangqiWaveCProcess(captured ? 'capture' : 'move', cur);
    motion = animateMove ? { from: from.slice(), to: to.slice(), piece: { ...piece }, captured: captured ? { ...captured } : null } : null;
    const thisMotion = ++motionEpoch;
    board[from[0]][from[1]] = null;
    board[to[0]][to[1]] = piece;
    lastMove = [from, to];
    moveCount++;
    selected = null; legalMoves = [];
    cur ^= 1;
    lastClockAt = Date.now();
    // 判断对方是否被将死
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const p2 = board[r][c];
      if (p2 && p2.p === cur) legalMovesOf(cur, r, c).forEach(m => all.push([r,c,m]));
    }
    if (!all.length){
      over = true; finishedAt = Date.now();
      winner = cur ^ 1;
      if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: cur, coins: 0, rank: 2 }]);
      motion = null; motionEpoch++; clearXiangqiWaveCProcessTimers();
      setXiangqiWaveCProcess('terminal', winner);
      render();
      return true;
    }
    const checked = isCheck(cur);
    if (checked) checkCount++;
    render();
    setStatus(checked ? t('xiangqi_player_in_check',cur+1) : t('player_turn',cur+1));
    settleXiangqiWaveCProcess(checked ? 'check' : 'turn', cur, 280);
    if (animateMove) scheduleXiangqiWaveCProcess(() => { if (thisMotion === motionEpoch){ motion = null; render(); } }, 260);
    scheduleAI();
    return true;
  }
  function lose(pi, reason, suppressReport){
    if (over) return;
    over = true; finishedAt = Date.now();
    winner = pi ^ 1;
    if (!suppressReport && opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: pi, coins: 0, rank: 2 }]);
    motion = null; motionEpoch++; clearXiangqiWaveCProcessTimers();
    setXiangqiWaveCProcess('terminal', winner);
    render();
    if (reason) setStatus(t('xiangqi_win_reason',winner+1,reason), true);
  }
  function render(){
    // Treat the board and its process rail as one measured stage.  Desktop
    // and tablet place the rail beside the tall board; narrow/short screens
    // stack it below, keeping the complete 9×10 playfield in the Arena.
    const availableWidth = Math.max(220, Number(area.clientWidth) || 520);
    const availableHeight = Math.max(0, Number(area.clientHeight) || 0);
    const useSideProcessRail = availableWidth >= 700 && availableHeight >= 450;
    const railWidth = Math.max(180, Math.min(260, Math.round(availableWidth * .25)));
    const widthBudget = Math.max(220, Math.min((useSideProcessRail ? availableWidth - railWidth - 24 : availableWidth - 16), 980));
    const heightBudget = availableHeight > 0 ? Math.max(220, (availableHeight - 16) * COLS / ROWS) : widthBudget;
    const S = Math.min(widthBudget, heightBudget);
    Array.from(area.children || []).forEach(node => {
      if (node && node.id !== 'honru-game-reaction' && typeof node.remove === 'function') node.remove();
    });
    xiangqiWaveCProcessRail = null; xiangqiWaveCProcessLabel = null; xiangqiWaveCProcessSteps = []; xiangqiWaveCBoard = null;
    const wrap = el('div','xiangqi-wrap');
    wrap.classList.add('xiangqi-wave-c-stage');
    wrap.style.cssText='display:grid;grid-template-areas:' + (useSideProcessRail ? '"board process"' : '"board" "process"') + ';grid-template-columns:' + (useSideProcessRail ? 'minmax(0,1fr) ' + railWidth + 'px' : 'minmax(0,1fr)') + ';place-items:center;align-content:start;gap:10px;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:4px;box-sizing:border-box;';
    const boardEl = el('div','xiangqi-board');
    xiangqiWaveCBoard = boardEl;
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(boardEl, 'xiangqi-board', { variant: boardTheme });
    boardEl.style.width = S + 'px'; boardEl.style.height = S * ROWS / COLS + 'px'; boardEl.style.maxWidth = '100%'; boardEl.style.boxSizing = 'border-box'; boardEl.style.margin = '0 auto'; boardEl.style.transform = 'translateZ(0)'; boardEl.style.gridArea = 'board';
    if (boardEl.style && typeof boardEl.style.setProperty === 'function') boardEl.style.setProperty('--xiangqi-wave-c-board-size', S + 'px');
    boardEl.style.touchAction = 'none'; boardEl.style.overscrollBehavior = 'contain';
    const cs = S / COLS;
    const cv = document.createElement('canvas');
    cv.style.position = 'absolute'; cv.style.left = '0'; cv.style.top = '0';
    const dpr = window.devicePixelRatio || 1;
    cv.width = S*dpr; cv.height = S*ROWS/COLS*dpr;
    boardEl.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (tabletop){
      const grassPaper = boardTheme === 'grass';
      const paper = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,S*ROWS/COLS) : null;
      if (paper && paper.addColorStop){
        paper.addColorStop(0,grassPaper?'#F7F9E7':'#FFF9F2'); paper.addColorStop(.58,grassPaper?'#D7E8B6':'#F3E5C4'); paper.addColorStop(1,grassPaper?'#A7C27C':'#E7C57F'); ctx.fillStyle = paper;
      } else ctx.fillStyle = grassPaper ? '#D7E8B6' : '#F3E5C4';
      ctx.strokeStyle = grassPaper ? '#3A5E3B' : '#443443';
    } else if (boardTheme === 'grass'){
      const grass = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,S*ROWS/COLS) : null;
      if (grass && grass.addColorStop){ grass.addColorStop(0,'#dff3c8'); grass.addColorStop(1,'#94c973'); ctx.fillStyle = grass; }
      else ctx.fillStyle = '#b7d995';
      ctx.strokeStyle = '#315f36';
    } else {
      const wood = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,0) : null;
      if (wood && wood.addColorStop){ wood.addColorStop(0,'#f2d4a5'); wood.addColorStop(.5,'#dfb77b'); wood.addColorStop(1,'#f0cea0'); ctx.fillStyle = wood; }
      else ctx.fillStyle = '#e9c79a';
      ctx.strokeStyle = '#8a5a2b';
    }
    ctx.fillRect(0,0,S,S*ROWS/COLS); ctx.lineWidth = tabletop ? 2.25 : 1.4; ctx.lineCap = tabletop ? 'round' : 'butt'; ctx.lineJoin = tabletop ? 'round' : 'miter';
    const pad = cs/2;
    for (let c = 0; c < COLS; c++){
      ctx.beginPath(); ctx.moveTo(pad + c*cs, pad); ctx.lineTo(pad + c*cs, S - pad); ctx.stroke();
    }
    if (lastMove){
      lastMove.forEach(([r,c], idx) => {
        ctx.fillStyle = idx === 0 ? 'rgba(245,158,11,.24)' : 'rgba(245,158,11,.42)';
        ctx.beginPath(); ctx.arc(pad + c*cs, pad + r*cs, cs*(idx === 0 ? .26 : .48), 0, Math.PI*2); ctx.fill();
      });
    }
    for (let r = 0; r < ROWS; r++){
      ctx.beginPath(); ctx.moveTo(pad, pad + r*cs); ctx.lineTo(S - pad, pad + r*cs); ctx.stroke();
    }
    // 九宫斜线
    const palace = (r0) => {
      ctx.beginPath();
      ctx.moveTo(pad + 3*cs, pad + r0*cs); ctx.lineTo(pad + 5*cs, pad + (r0+2)*cs);
      ctx.moveTo(pad + 5*cs, pad + r0*cs); ctx.lineTo(pad + 3*cs, pad + (r0+2)*cs);
      ctx.stroke();
    };
    palace(0); palace(7);
    // 河界
    ctx.setLineDash([6,5]);
    ctx.beginPath(); ctx.moveTo(pad, pad + 5*cs); ctx.lineTo(S - pad, pad + 5*cs); ctx.stroke();
    ctx.setLineDash([]);
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (!piece) continue;
        const x = pad + c*cs, y = pad + r*cs;
        const skin = pieceSkin(piece.p);
        ctx.beginPath(); ctx.arc(x, y, cs*0.42, 0, Math.PI*2);
        if (tabletop){
          const jade = skin === 'jade';
          const base = jade ? (piece.p === 0 ? '#E2F4E6' : '#DDF4F2') : (piece.p === 0 ? '#FFF0E9' : '#EDF6F4');
          const shade = jade ? (piece.p === 0 ? '#8FBE9C' : '#80B8BE') : (piece.p === 0 ? '#E99A7B' : '#82AAB3');
          ctx.save();
          ctx.shadowColor = 'rgba(33,25,35,.22)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = Math.max(1,cs*.07); ctx.shadowOffsetY = Math.max(1.5,cs*.1);
          ctx.fillStyle = base; ctx.fill(); ctx.strokeStyle = '#211923'; ctx.lineWidth = Math.max(2,cs*.07); ctx.stroke(); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.arc(x,y,cs*.385,0,Math.PI*2); ctx.clip(); ctx.globalAlpha=.52; ctx.fillStyle=shade; ctx.fillRect(x,y,cs*.48,cs*.48); ctx.restore();
          ctx.fillStyle='#FFF9F2'; ctx.beginPath(); ctx.arc(x-cs*.14,y-cs*.16,cs*.07,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle = skin === 'jade'
            ? (piece.p === 0 ? '#d1fae5' : '#cffafe')
            : (piece.p === 0 ? '#fde2d3' : '#d9e6f2');
          ctx.fill();
          ctx.strokeStyle = skin === 'jade'
            ? (piece.p === 0 ? '#b91c1c' : '#164e63')
            : (piece.p === 0 ? '#b23a1f' : '#1f4e79');
          ctx.lineWidth = skin === 'jade' ? 2.2 : 1.6; ctx.stroke();
        }
        const label = xiangqiPieceName(piece);
        ctx.fillStyle = piece.p === 0 ? (tabletop ? (skin === 'jade' ? '#A23D37' : '#B85245') : '#b23a1f') : (tabletop ? (skin === 'jade' ? '#1F6570' : '#315D78') : '#1f4e79');
        ctx.font = 'bold ' + (cs*0.5) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 1);
        if (lastMove && ((lastMove[0][0] === r && lastMove[0][1] === c) || (lastMove[1][0] === r && lastMove[1][1] === c))){
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(x, y, cs*0.46, 0, Math.PI*2); ctx.stroke();
        }
      }
    }
    if (selected){
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(pad + selected[1]*cs, pad + selected[0]*cs, cs*0.46, 0, Math.PI*2); ctx.stroke();
      legalMoves.forEach(([nr,nc]) => {
        if (board[nr][nc]){
          ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pad + nc*cs, pad + nr*cs, cs*0.31, 0, Math.PI*2); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(34,160,107,.5)';
          ctx.beginPath(); ctx.arc(pad + nc*cs, pad + nr*cs, cs*0.16, 0, Math.PI*2); ctx.fill();
        }
      });
    }
    if (motion){
      const renderedMotion = motion;
      const label = xiangqiPieceName(renderedMotion.piece);
      const mover = el('div','xiangqi-motion-piece',label);
      mover.style.cssText = 'position:absolute;z-index:4;width:' + (cs*.84) + 'px;height:' + (cs*.84) + 'px;line-height:' + (cs*.84) + 'px;text-align:center;border-radius:50%;font-weight:900;background:rgba(255,255,255,.9);box-shadow:0 8px 18px rgba(0,0,0,.25);pointer-events:none;transition:transform .24s cubic-bezier(.2,.8,.2,1);left:' + (pad + renderedMotion.from[1]*cs - cs*.42) + 'px;top:' + (pad + renderedMotion.from[0]*cs - cs*.42) + 'px;';
      boardEl.appendChild(mover);
      scheduleXiangqiWaveCProcess(() => {
        if (renderedMotion === motion && !destroyed) mover.style.transform = 'translate(' + ((renderedMotion.to[1]-renderedMotion.from[1])*cs) + 'px,' + ((renderedMotion.to[0]-renderedMotion.from[0])*cs) + 'px)';
      }, 0);
    }
    boardEl.addEventListener('click', e => {
      if (spectator || over) return;
      if (opts.online && cur !== opts.myIdx) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const rect = boardEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * S;
      const y = (e.clientY - rect.top) / (rect.height) * S * ROWS / COLS;
      const c = Math.round((x - pad) / cs), r = Math.round((y - pad) / cs);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (selected){
        if (legalMoves.some(([mr,mc]) => mr === r && mc === c)){
          if (opts.onProgress) opts.onProgress({ from: selected, to: [r,c] });
          if (opts.online){const move={from:selected,to:[r,c],seq:++clockMoveSeq};if(ruleAuthority&&typeof opts.sendXiangqiAction==='function')opts.sendXiangqiAction(move);else opts.sendMove(move);}
          doMove(selected, [r,c]);
          return;
        }
        selected = null; legalMoves = []; setXiangqiWaveCProcess('turn', cur);
      }
      const piece = board[r][c];
      if (piece && piece.p === cur){
        selected = [r,c];
        legalMoves = legalMovesOf(cur, r, c);
        setXiangqiWaveCProcess('select', r + ',' + c);
      }
      render();
    });
    if (over){
      const winnerName = t('player_number',winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: t('xiangqi_victory_subtitle'), coins: 1, onRestart: reset, onShare: () => shareGameLink('xiangqi')
      });
    }
    wrap.appendChild(boardEl);
    xiangqiWaveCProcessRail = el('section','xiangqi-wave-c-process');
    xiangqiWaveCProcessRail.setAttribute('role','status'); xiangqiWaveCProcessRail.setAttribute('aria-live','polite');
    xiangqiWaveCProcessLabel = el('output','xiangqi-wave-c-process-label');
    const track = el('div','xiangqi-wave-c-process-track');
    xiangqiWaveCProcessSteps = XIANGQI_WAVE_C_PROCESS_STEPS.map(step => {
      const node = el('span','xiangqi-wave-c-process-step');
      node.dataset.xiangqiProcessStep = step; node.setAttribute('data-xiangqi-process-step',step); track.appendChild(node); return node;
    });
    xiangqiWaveCProcessRail.appendChild(xiangqiWaveCProcessLabel); xiangqiWaveCProcessRail.appendChild(track); wrap.appendChild(xiangqiWaveCProcessRail);
    xiangqiWaveCProcessRail.style.cssText='display:grid;grid-area:process;align-self:' + (useSideProcessRail ? 'stretch' : 'start') + ';gap:7px;width:' + (useSideProcessRail ? '100%' : 'min(100%,' + Math.max(240, Math.min(640, S)) + 'px)') + ';padding:9px 10px;box-sizing:border-box;border:1px solid rgba(43,32,37,.28);border-radius:14px;background:linear-gradient(135deg,rgba(67,90,193,.12),rgba(255,255,255,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 3px 0 rgba(76,43,21,.12);color:var(--stage-ink,var(--text));';
    xiangqiWaveCProcessLabel.style.cssText='min-width:0;font-size:10px;font-weight:900;line-height:1.35;overflow-wrap:anywhere;';
    track.style.cssText='display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;min-height:8px;';
    xiangqiWaveCProcessSteps.forEach(step => { step.style.cssText='display:block;min-width:0;height:7px;border-radius:999px;background:rgba(76,43,21,.16);box-shadow:inset 0 1px 1px rgba(255,255,255,.65);'; });
    area.appendChild(wrap);
    paintXiangqiWaveCProcess();
    renderAux();
    const turnText = over ? t('match_over') : t('xiangqi_turn_status',spectator ? t('spectating_prefix') : '',t(cur === 0 ? 'xiangqi_red_side' : 'xiangqi_black_side'),t(opts.online && cur === opts.myIdx && !spectator ? 'your_turn' : 'thinking'));
    setStatus(turnText + (isCheck(cur) && !over ? t('xiangqi_check_suffix') : ''));
    renderPlayers(cur, capturedPieces.map(list => t('xiangqi_captured_count',list.length)));
  }
  opts.onMove = (payload, player) => {
    if(ruleAuthority)return;
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    doMove(payload.from, payload.to);
  };
  function resetLocal(){
    aiEpoch++; destroyed = false; clearXiangqiWaveCProcessTimers(); xiangqiWaveCProcessEpoch++;
    initBoard();
    cur = 0; over = false; winner = -1; selected = null; legalMoves = []; lastMove = null; aiPending = false;
    startedAt = Date.now(); finishedAt = 0; moveCount = 0; captureCount = 0; checkCount = 0; capturedPieces = [[], []]; motion = null; motionEpoch++;
    if(clockAuthority){
      const state=opts.gameplayMeta&&opts.gameplayMeta.clock;clockMode='rapid';
      clockRemaining=state&&Array.isArray(state.remainingMsByPlayer)?state.remainingMsByPlayer.slice(0,2):[600000,600000];
    } else clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    clockMoveSeq=0;lastClockAt = Date.now();
    setXiangqiWaveCProcess('turn', cur);
    render();
    setStatus(t('xiangqi_initial_turn'));
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function snapshot(){ return {
    board: board.map(r => r.map(x => x ? { p: x.p, t: x.t } : null)), cur, over, winner,
    lastMove: lastMove ? lastMove.map(x => x.slice()) : null, capturedPieces: capturedPieces.map(x => x.slice()),
    clockMode, clockRemaining: clockRemaining.slice(), moveCount, captureCount, checkCount,
  }; }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.board) || state.board.length !== ROWS) return false;
    aiEpoch++; motionEpoch++; motion = null; clearXiangqiWaveCProcessTimers(); xiangqiWaveCProcessEpoch++;
    board = state.board.map(row => row.map(x => x && (x.p === 0 || x.p === 1) && PIECE[x.t] ? { p:x.p, t:x.t } : null));
    cur = state.cur === 1 ? 1 : 0; over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    lastMove = Array.isArray(state.lastMove) ? state.lastMove.map(x => x.slice()) : null;
    capturedPieces = Array.isArray(state.capturedPieces) ? state.capturedPieces.map(x => Array.isArray(x) ? x.slice() : []) : [[],[]];
    clockMode = ['rapid','blitz'].includes(state.clockMode) ? state.clockMode : 'casual';
    clockRemaining = Array.isArray(state.clockRemaining) ? state.clockRemaining.slice(0,2) : [null,null];
    moveCount = Number(state.moveCount) || 0; captureCount = Number(state.captureCount) || 0; checkCount = Number(state.checkCount) || 0;
    selected = null; legalMoves = []; aiPending = false; lastClockAt = Date.now();
    if (value && value.presentation){ setBoardTheme(value.presentation.boardTheme); setCosmetic(value.presentation.cosmetic); }
    setXiangqiWaveCProcess(over ? 'terminal' : (isCheck(cur) ? 'check' : 'turn'), cur);
    render(); return true;
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; render(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); render(); return {default:cosmetic.default,players:{...cosmetic.players}}; }
  function setSpectators(value){
    spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value;
    selected = null; legalMoves = [];
    if (over) setXiangqiWaveCProcess('terminal', winner);
    else if (xiangqiWaveCProcess === 'select') setXiangqiWaveCProcess('turn', cur);
    render(); return spectator;
  }
  // Canvas text is not part of the DOM i18n pass, so the platform calls this
  // optional instance hook after a locale has finished loading.
  function onLanguageChange(){ render(); return true; }
  function setClockMode(mode){
    clockMode = ['rapid','blitz'].includes(mode) ? mode : 'casual';
    clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    lastClockAt = Date.now(); pulseXiangqiWaveCClock(); renderAux(); return getClockState();
  }
  function getClockState(){ syncClock(); return { mode: clockMode, remaining: clockRemaining.slice(), authoritative: !opts.online }; }
  function setClockState(value){
    if (!value || !Array.isArray(value.remaining)) return false;
    clockMode = ['rapid','blitz'].includes(value.mode) ? value.mode : 'casual';
    clockRemaining = value.remaining.slice(0,2).map(v => v === null ? null : Math.max(0, Number(v) || 0)); lastClockAt = Date.now(); pulseXiangqiWaveCClock(); renderAux(); return true;
  }
  function onClockState(value){
    const state=value&&value.clock?value.clock:value;
    if(!clockAuthority||!state||state.protocol!=='xiangqi-clock-v1'||!Array.isArray(state.remainingMsByPlayer))return false;
    clockMode='rapid';clockRemaining=state.remainingMsByPlayer.slice(0,2).map(v=>Math.max(0,Number(v)||0));lastClockAt=Date.now();
    if(over){ setXiangqiWaveCProcess('terminal', winner); renderAux(); return true; }
    if(state.finished&&Number.isInteger(state.loser))lose(state.loser,t('xiangqi_clock_expired'),true);else renderAux();
    return true;
  }
  function onXiangqiRuleState(value){
    if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL||String(value.matchId||'')!==String(typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||''))return false;
    const clock=value.clock||{};return onRestore({board:value.board,cur:value.current,over:!!value.terminal,winner:Number.isInteger(value.winner)?value.winner:-1,lastMove:value.lastMove?[value.lastMove.from,value.lastMove.to]:null,capturedPieces:[[],[]],clockMode:'rapid',clockRemaining:Array.isArray(clock.remainingMsByPlayer)?clock.remainingMsByPlayer:[600000,600000],moveCount:Number(value.moveNumber)||0,captureCount:0,checkCount:value.check?1:0});
  }
  function onXiangqiRuleResult(value){if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL)return false;return onXiangqiRuleState(value.state||value);}
  function getMatchStats(){ return {
    duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: moveCount, captures: captureCount,
    checks: checkCount, remainingTime: clockRemaining.slice(), winner,
  }; }
  function startMatch(playerA, playerB, spectators){ setSpectators(spectators || false); return { activePlayers:[playerA,playerB], spectators:spectators || [] }; }
  function reportGameResult(){ const result = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(result); return result; }
  const clockTimer = setInterval(() => {
    if (over || clockRemaining[cur] === null) return;
    syncClock(); renderAux();
    if (!clockAuthority && clockRemaining[cur] <= 0) lose(cur, t('xiangqi_clock_expired'));
  }, 250);
  if (clockTimer && typeof clockTimer.unref === 'function') clockTimer.unref();
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore, onClockState,onXiangqiRuleState,onXiangqiRuleResult,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, onLanguageChange,
    setClockMode, getClockState, setClockState, getMatchStats, startMatch, reportGameResult,
    getTournamentRequirement: count => count > 2 ? 'TOURNAMENT_ORCHESTRATOR_V1' : null,
    getMultiplayerRequirement: () => opts.online ? (ruleAuthority?'XIANGQI_RULE_PROTOCOL_V2':(clockMode !== 'casual'?'XIANGQI_CLOCK_PROTOCOL_V1':null)) : null,
    getPresentationState: () => ({process:xiangqiWaveCProcess,detail:xiangqiWaveCProcessDetail,epoch:xiangqiWaveCProcessEpoch,revision:xiangqiWaveCProcessRevision}),
    destroy: () => { destroyed = true; aiEpoch++; motionEpoch++; xiangqiWaveCProcessEpoch++; xiangqiWaveCProcessRevision++; aiPending = false; clearXiangqiWaveCProcessTimers(); clearInterval(clockTimer); area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
  };
}
