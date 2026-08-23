/* ================= 迷你大富翁 ================= */
function gameMonopoly(area, extra, n, opts){
  opts = opts || {};
  const acceptedAudioCue = typeof emitAcceptedAudioCue === 'function' ? emitAcceptedAudioCue : null;
  const audioCue = (type, context, intensity, pan) => {
    try {
      if (acceptedAudioCue) return acceptedAudioCue(type, context, intensity, pan);
      if (typeof playFeedback === 'function') {
        const fallbackContext = context && typeof context === 'object' ? { ...context, audioType:type } : { audioType:type };
        return playFeedback(fallbackContext.reaction || 'tap', fallbackContext);
      }
    } catch (_error) {}
    return { accepted:false, reason:'unavailable' };
  };
  const CELLS = [
    {name:'起点', type:'go', emo:'💰'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'蓝湾', type:'prop', price:300, col:'#60a5fa'},
    {name:'纳税', type:'tax', amt:500, emo:'🧾'},
    {name:'绿谷', type:'prop', price:350, col:'#34d399'},
    {name:'车站', type:'prop', price:400, col:'#94a3b8'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'金街', type:'prop', price:450, col:'#fbbf24'},
    {name:'红山', type:'prop', price:500, col:'#f87171'},
    {name:'休息', type:'rest', emo:'☕'},
    {name:'紫苑', type:'prop', price:550, col:'#a78bfa'},
    {name:'橙园', type:'prop', price:600, col:'#fb923c'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'黄都', type:'prop', price:650, col:'#facc15'},
    {name:'青湖', type:'prop', price:700, col:'#22d3ee'},
    {name:'纳税', type:'tax', amt:700, emo:'🧾'},
    {name:'粉港', type:'prop', price:750, col:'#f472b6'},
    {name:'白塔', type:'prop', price:800, col:'#cbd5e1'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'灰堡', type:'prop', price:850, col:'#9ca3af'},
    {name:'棕野', type:'prop', price:900, col:'#a16207'},
    {name:'车站', type:'prop', price:950, col:'#64748b'},
    {name:'黑金', type:'prop', price:1000, col:'#334155'},
    {name:'机会', type:'chance', emo:'🎁'},
  ];
  const CHANCE = [
    {text:'意外之财，获得 800', v:800},
    {text:'房屋维修，支出 600', v:-600},
    {text:'前进 3 格', move:3},
    {text:'后退 2 格', move:-2},
    {text:'直达起点，获得 2000', go:true},
    {text:'大家赞助你，每人给你 200', each:200},
    {text:'请大家吃饭，给每人 200', each:-200},
    {text:'投资回报，获得 500', v:500},
  ];
  function monopolyCellName(value){
    const index=Number.isInteger(value)?value:CELLS.indexOf(value),key='monopoly_cell_'+index,localized=t(key);
    return localized===key&&CELLS[index]?CELLS[index].name:localized;
  }
  function monopolyChanceText(value){
    const index=Number.isInteger(value)?value:CHANCE.indexOf(value),key='monopoly_chance_'+index,localized=t(key);
    return localized===key&&CHANCE[index]?CHANCE[index].text:localized;
  }
  const START_MONEY = 2000;
  const MAX_ROUND = 30;
  let players = [], cur = 0, phase = 'roll', over = false, winner = -1, round = 1;
  let chanceDeck = [];
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator;
  const RULE_PROTOCOL='monopoly-rule-v2';
  const fullRuleAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol===RULE_PROTOCOL&&typeof opts.sendMonopolyAction==='function'&&typeof MonopolyRules!=='undefined');
  const auctionAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol==='monopoly-auction-v1'&&typeof opts.sendMonopolyAuctionOpen==='function');
  let auctionState=null,auctionBidSeq=0,monopolySeq=0,monopolyAudioSequence=0;
  const presentationAdapter=typeof MonopolyPresentationAdapter!=='undefined'&&typeof MonopolyPresentationAdapter.create==='function'?MonopolyPresentationAdapter.create():null;
  let uiSource='live',uiTransition=null,uiBankruptPlayer=-1,authorityReady=true,stageCountdownTimer=null;
  // Wave B is a local, presentation-only seam. Missing/unknown values enable
  // it; only the exact string "0" rolls back to the existing Wave A DOM.
  // Storage failures deliberately fail closed so a blocked browser never
  // receives a half-mounted presentation tree.
  const MONOPOLY_WAVE_B_STORAGE_KEY='mg_art_game_stage_wave_b_v1';
  function monopolyWaveBEnabled(){
    try{
      const storage=typeof window!=='undefined'?window.localStorage:null;
      if(!storage||typeof storage.getItem!=='function')return false;
      return storage.getItem(MONOPOLY_WAVE_B_STORAGE_KEY)!=='0';
    }catch(_error){return false;}
  }
  let monopolyWaveBActive=monopolyWaveBEnabled();
  let monopolyWaveBStage=null,monopolyWaveBBoardFrame=null,monopolyWaveBMeta=null,monopolyWaveBCommand=null;
  let monopolyWaveBTurn=null,monopolyWaveBState=null,monopolyWaveBProperty=null,monopolyWaveBChance=null,monopolyWaveBAuction=null,monopolyWaveBTrade=null;
  let monopolyWaveBChanceModal=null,monopolyWaveBChanceCard=null;
  const monopolyFinalArtRequested=typeof monopolyFinalArtEnabled==='function'&&monopolyFinalArtEnabled();
  let monopolyFinalArtActive=false,monopolyFinalArtState=monopolyFinalArtRequested?'loading':'disabled';
  let monopolyFinalArtRequest=0,monopolyFinalArtLayers=null,monopolyFinalArtVfxSeq=0,monopolyFinalArtVfxRole=null;
  const monopolyFinalArtImageFactory=()=>typeof Image==='function'?new Image():null;
  // This density is derived only from the mounted DOM board's content box.
  // It is deliberately presentation-local: changing a viewport may reflow
  // labels and the retained roll control, but can never change a rule state.
  let monopolyWaveBBoardDensity='full';
  let monopolyDestroyed=false,monopolyPresentationMatchId='';
  let monopolyPresentationResizeWindow=null,monopolyPresentationResizeObserver=null,cancelMonopolyPresentationResize=null;
  let monopolyOutcomeScheduled=false,monopolyOutcomeVisible=false,monopolyOutcomeTimer=null,monopolyOutcomePending=null;
  // Wave C is visual choreography only. It describes the player-facing turn
  // process but never changes the monopoly Rule Core state or wire protocol.
  const MONOPOLY_WAVE_C_PROCESS_STEPS=['roll','walk','land','buy','event','auction','trade','turn-end'];
  let monopolyWaveCProcess='roll',monopolyWaveCProcessDetail='';
  let monopolyWaveCProcessRail=null,monopolyWaveCProcessLabel=null,monopolyWaveCProcessSteps=[];
  let startedAt = Date.now(), finishedAt = 0;
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none';
  area.style.overscrollBehavior = 'contain';
  function normalizeCosmetic(value){
    const source=value||{},defaultToken=source.default||source.token;
    return {default:defaultToken==='car'?'car':'character',players:{...(source.players||{})}};
  }
  function tokenSkin(pi){const value=cosmetic.players&&cosmetic.players[pi];return value==='car'||(value&&value.token==='car')?'car':cosmetic.default;}
  // WebSocket 保证消息顺序，但不同客户端的动画计时并不同步；远端输入必须等本地逻辑阶段就绪。
  let remoteInputs = [];
  let drainingRemoteInputs = false;
  let epoch = 0;
  let monopolyWaveCProcessTimers = new Set();
  let idleWaiters = [];
  function isIdle(){ return over || ((phase === 'roll' || phase === 'buy' || phase === 'auction') && !drainingRemoteInputs); }
  function notifyIdle(){
    if (!isIdle()) return;
    const waiters = idleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
  function whenIdle(){ return isIdle() ? Promise.resolve() : new Promise(resolve => idleWaiters.push(resolve)); }
  function later(fn, delay){
    const scheduledEpoch = epoch;
    let timer = null;
    timer = setTimeout(() => {
      monopolyWaveCProcessTimers.delete(timer);
      if (scheduledEpoch === epoch) fn();
    }, delay);
    monopolyWaveCProcessTimers.add(timer);
    return timer;
  }
  function clearMonopolyWaveCProcessTimers(){
    monopolyWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    monopolyWaveCProcessTimers.clear();
  }
  function invalidateAsync(){
    epoch++;
    clearMonopolyWaveCProcessTimers();
    clearMonopolyOutcomeTimer();
    stopStageCountdown();
    const waiters = idleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
  let S = 520;
  const board = el('div','m-board');
  area.appendChild(board);
  const diceFaces = [makeDice3D(46, true), makeDice3D(46, true)];
  const center = el('div','m-center');
  const turnHud = el('div','game-turn-hud monopoly-turn-hud');
  const leaderHud = el('div','monopoly-leader-hud');
  const diceRow = el('div','dice-row');
  diceFaces.forEach(f => diceRow.appendChild(f.wrap));
  const rollBtn = el('button','btn btn-primary',t('monopoly_roll'));
  rollBtn.addEventListener('click', roll);
  center.appendChild(turnHud);
  center.appendChild(leaderHud);
  center.appendChild(diceRow);
  center.appendChild(rollBtn);
  board.appendChild(center);
  let aiPending = false;
  function aiClamp(value, scale){ return Math.max(-1, Math.min(1, value / (scale || 1))); }
  const DICE_SUMS = [0,0,1,2,3,4,5,6,5,4,3,2,1].map(value => value / 36);
  function landingDistribution(position, turns){
    let distribution = new Map([[position, 1]]);
    for (let turn = 0; turn < turns; turn++){
      const next = new Map();
      for (const [from, probability] of distribution){
        for (let roll = 2; roll <= 12; roll++){
          const target = (from + roll) % CELLS.length;
          next.set(target, (next.get(target) || 0) + probability * DICE_SUMS[roll]);
        }
      }
      distribution = next;
    }
    return distribution;
  }
  function liabilityAt(pi, cell){
    if (cell.type === 'tax') return cell.amt;
    if (cell.type === 'prop' && cell.owner >= 0 && cell.owner !== pi) return rentOf(cell);
    return 0;
  }
  function futureLiability(pi, remainingTurns, horizon){
    const p = players[pi];
    let expected = 0, worst = 0;
    const depth = Math.max(1, Math.min(Number(horizon) || 2, remainingTurns || 1));
    Array.from({ length:depth }, (_, index) => index + 1).filter(turns => turns <= remainingTurns).forEach(turns => {
      const weight = turns === 1 ? 1 : (turns === 2 ? .7 : .45);
      for (const [position, probability] of landingDistribution(p.pos, turns)){
        const liability = liabilityAt(pi, CELLS[position]);
        expected += probability * liability * weight;
        if (probability > 0) worst = Math.max(worst, liability);
      }
    });
    return { expected, worst };
  }
  function propertyVisits(pi, propertyPosition, remainingRounds, horizon){
    let visits = 0;
    const lookahead = Math.max(1, Math.min(remainingRounds, Number(horizon) || remainingRounds));
    const fullHorizon = Number(horizon) >= remainingRounds;
    players.forEach((opponent, other) => {
      if (other === pi || !opponent.alive) return;
      const remainingTurns = fullHorizon ? remainingRounds + (other > pi ? 1 : 0) : Math.min(lookahead, remainingRounds + (other > pi ? 1 : 0));
      if (remainingTurns >= 1) visits += landingDistribution(opponent.pos, 1).get(propertyPosition) || 0;
      if (remainingTurns >= 2) visits += (landingDistribution(opponent.pos, 2).get(propertyPosition) || 0) * .7;
      visits += Math.max(0, remainingTurns - 2) / CELLS.length;
    });
    return visits;
  }
  function monopolyDifficultyProfile(difficulty){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { riskHorizon:1, visitHorizon:1, candidates:2 };
    if (id === 'hard') return { riskHorizon:3, visitHorizon:MAX_ROUND, candidates:2 };
    // 普通档保持原有两回合风险和完整持有期访问估计。
    return { riskHorizon:2, visitHorizon:MAX_ROUND, candidates:2 };
  }
  function evaluatePurchase(pi, cell, profile){
    const p = players[pi];
    const remainingRounds = Math.max(0, MAX_ROUND - round);
    const liability = futureLiability(pi, remainingRounds, profile.riskHorizon);
    const aliveOpponents = players.filter((opponent, other) => other !== pi && opponent.alive);
    const opponentWorth = aliveOpponents.length ? Math.max(...players.map((opponent, other) =>
      other !== pi && opponent.alive ? netWorth(other) : -Infinity)) : 0;
    const leadGap = netWorth(pi) - opponentWorth;
    const visits = propertyVisits(pi, p.pos, remainingRounds, profile.visitHorizon);
    const expectedRent = rentOf(cell) * visits;
    const reserve = 420 + liability.expected * 1.65 + liability.worst * .55 + aliveOpponents.length * 45;
    const criticalReserve = 260 + liability.expected + liability.worst * .35;
    const cashAfter = p.money - cell.price;
    const reserveShortfall = Math.max(0, reserve - cashAfter);
    const criticalShortfall = Math.max(0, criticalReserve - cashAfter);
    const remainingRatio = remainingRounds / MAX_ROUND;
    const catchupLicense = Math.max(0, -leadGap) * .035 * remainingRatio;
    const protectLead = Math.max(0, leadGap) * .025 * (reserveShortfall > 0 ? 1 : 0);
    let buyUtility = expectedRent + cell.price * .08 * remainingRatio + catchupLicense -
      reserveShortfall * 1.25 - criticalShortfall * 2.2 - protectLead;
    const nearBand = Math.max(65, cell.price * .14);
    return { buyUtility, nearBand, remainingRounds, remainingRatio, leadGap, expectedRent, visits,
      futureRisk:liability.expected, worstRisk:liability.worst, reserve, criticalReserve, cashAfter,
      reserveMargin:cashAfter - reserve, affordable:p.money >= cell.price };
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = epoch;
    const turn = cur;
    setStatus(t('ai_thinking'));
    later(async () => {
      if (opts.destroyed || over || gen !== epoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      if (phase === 'roll'){
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        aiPending = false;
        if (opts.online && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { roll:[d1,d2] });
        applyRoll(d1, d2);
        return;
      }
      if (phase === 'buy'){
        const p = players[cur];
        const cell = CELLS[p.pos];
        const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'hard' };
        const profile = monopolyDifficultyProfile(difficulty);
        const advice = evaluatePurchase(cur, cell, profile);
        const ranked = advice.affordable
          ? [{ choice:'buy', score:advice.buyUtility }, { choice:'pass', score:0 }].sort((a, b) => b.score - a.score || (a.choice === 'pass' ? 1 : -1))
          : [{ choice:'pass', score:0 }];
        const best = ranked[0];
        const near = ranked.filter(item => item.score >= best.score - advice.nearBand).slice(0, profile.candidates);
        const choices = near.map(item => item.choice);
        const learningCandidates = near.map(item => {
          const buying = item.choice === 'buy';
          const candidateCash = buying ? advice.cashAfter : p.money;
          return { choice:item.choice, features:{
            quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.score - item.score) / Math.max(1, advice.nearBand))),
            buy_action:buying ? 1 : -1,
            net_worth:aiClamp(netWorth(cur), 8000),
            cash_after:aiClamp(candidateCash, 3000),
            reserve_margin:aiClamp(candidateCash - advice.reserve, 2000),
            survival_reserve:aiClamp(candidateCash - advice.criticalReserve, 1500),
            future_tax_rent:aiClamp(-advice.futureRisk, 900),
            worst_liability:aiClamp(-advice.worstRisk, 1000),
            expected_rent:buying ? aiClamp(advice.expectedRent, 1200) : 0,
            property_roi:buying ? aiClamp(advice.expectedRent / Math.max(1, cell.price), 1) : 0,
            remaining_rounds:aiClamp(advice.remainingRatio, 1),
            lead_gap:aiClamp(advice.leadGap, 4000),
            risk_horizon:aiClamp(profile.riskHorizon / 3, 1),
          } };
        });
        const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
        const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };
        const requestStateKey = JSON.stringify({ phase, cur, round, players:players.map(item => ({ pos:item.pos, money:item.money, props:item.props.slice(), alive:item.alive })) });
        // 所有档位保留服务端学习候选；仅困难档可以让远端建议覆盖本地首选。
        const remoteChoice = await aiChoose('monopoly', {
          turn: cur, round, money: p.money, position: p.pos,
          property: { name: monopolyCellName(cell), price: cell.price, owner: cell.owner },
          owned: p.props.slice(),
          netWorth: netWorth(cur), leadGap: Math.round(advice.leadGap),
          cashReserve: Math.round(advice.reserve), futureTaxRentRisk: Math.round(advice.futureRisk),
          worstLiability: Math.round(advice.worstRisk), expectedRent: Math.round(advice.expectedRent),
          remainingRounds: advice.remainingRounds, localAdvice: best.choice,
        }, choices, remoteProfile, learningCandidates);
        if (opts.destroyed || over || gen !== epoch || cur !== turn || phase !== 'buy' || players[cur].pos !== p.pos ||
            JSON.stringify({ phase, cur, round, players:players.map(item => ({ pos:item.pos, money:item.money, props:item.props.slice(), alive:item.alive })) }) !== requestStateKey){
          aiPending = false;
          return;
        }
        const localIndex = typeof aiDifficultyLocalChoiceIndex === 'function'
          ? aiDifficultyLocalChoiceIndex(difficulty, choices.length) : (difficulty.id === 'easy' ? Math.min(choices.length - 1, 1) : 0);
        const localChoice = choices[Math.max(0, localIndex)] || best.choice;
        const decision = remoteAllowed && choices.includes(remoteChoice) ? remoteChoice : localChoice;
        aiPending = false;
        aiSpeak(difficulty, 'think');
        if (opts.online && typeof opts.sendBotMove === 'function') opts.sendBotMove(cur, { decision });
        if (applyDecision(cur, decision) && typeof confirmAIReady === 'function') {
          confirmAIReady('monopoly', decision);
        }
        return;
      }
      aiPending = false;
    }, 750);
  }
  const moneyRow = el('div','money-row');
  extra.appendChild(moneyRow);
  const actionRow = el('div','monopoly-action-row');
  extra.appendChild(actionRow);
  const settleBtn = el('button','btn',t('monopoly_settle_early'));
  settleBtn.addEventListener('click', () => {
    if (spectator || over) return;
    if (opts.online && !opts.isHost){ toast(t('host_only_settle')); return; }
    if (opts.onProgress) opts.onProgress({ decision: 'settle' });
    if (opts.online) opts.sendMove({ decision: 'settle' });
    remoteInputs.push({ payload: { decision: 'settle' }, trustedHost: true });
    drainRemoteInputs();
  });
  extra.appendChild(settleBtn);
  const stageState = el('div','monopoly-stage-state');
  stageState.setAttribute('role','status');
  stageState.setAttribute('aria-live','polite');
  extra.appendChild(stageState);

  function monopolyWaveBClass(node,className,enabled){
    if(!node||!node.classList)return;
    if(enabled)node.classList.add(className);else node.classList.remove(className);
  }
  function monopolyWaveBData(node,name,value){
    if(!node)return;
    const attr='data-'+name,key=name.replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase());
    if(value===null||value===undefined){
      if(typeof node.removeAttribute==='function')node.removeAttribute(attr);
      else if(node.dataset)delete node.dataset[key];
      return;
    }
    if(typeof node.setAttribute==='function')node.setAttribute(attr,String(value));
    else if(node.dataset)node.dataset[key]=String(value);
  }
  function monopolyWaveBLayoutDensity(size){
    const value=Number(size)||0;
    if(value>0&&value<236)return 'micro';
    if(value>0&&value<432)return 'compact';
    return 'full';
  }
  function applyMonopolyWaveBLayoutDensity(size){
    const density=monopolyWaveBActive?monopolyWaveBLayoutDensity(size):'full';
    monopolyWaveBBoardDensity=density;
    const value=monopolyWaveBActive?density:null;
    [board,center,diceRow,monopolyWaveBStage,monopolyWaveBBoardFrame].forEach(node=>monopolyWaveBData(node,'monopoly-density',value));
    syncMonopolyWaveBRollControl();
    return density;
  }
  function syncMonopolyWaveBRollControl(){
    if(!rollBtn||!center)return false;
    const useCommand=!!monopolyWaveBCommand&&monopolyWaveBBoardDensity!=='full';
    if(useCommand){
      if(rollBtn.parentNode!==monopolyWaveBCommand){
        if(typeof monopolyWaveBCommand.insertBefore==='function')monopolyWaveBCommand.insertBefore(rollBtn,monopolyWaveBCommand.firstChild||null);
        else monopolyWaveBCommand.appendChild(rollBtn);
      }
      monopolyWaveBData(rollBtn,'monopoly-compact-control','command');
      return true;
    }
    if(rollBtn.parentNode!==center)center.appendChild(rollBtn);
    monopolyWaveBData(rollBtn,'monopoly-compact-control',null);
    return false;
  }
  function clearMonopolyWaveBLayoutDensity(){
    monopolyWaveBBoardDensity='full';
    [board,center,diceRow,monopolyWaveBStage,monopolyWaveBBoardFrame].forEach(node=>monopolyWaveBData(node,'monopoly-density',null));
    syncMonopolyWaveBRollControl();
  }
  function monopolyWaveCProcessText(){
    const player=cur+1,cell=players[cur]&&CELLS[players[cur].pos];
    if(monopolyWaveCProcess==='walk')return t('monopoly_player_rolling',player);
    if(monopolyWaveCProcess==='land')return t('monopoly_landed',player,cell?monopolyCellName(players[cur].pos):'');
    if(monopolyWaveCProcess==='buy')return cell&&cell.type==='prop'?t('monopoly_buy_prompt',player,monopolyCellName(players[cur].pos),cell.price):t('monopoly_action_buy');
    if(monopolyWaveCProcess==='event')return t('monopoly_chance_title');
    if(monopolyWaveCProcess==='auction')return t('monopoly_state_auction');
    if(monopolyWaveCProcess==='trade')return t('monopoly_state_trade_unavailable');
    if(monopolyWaveCProcess==='turn-end')return t('monopoly_round_turn',Math.min(round,MAX_ROUND),MAX_ROUND,player);
    return t('monopoly_roll');
  }
  function paintMonopolyWaveCProcess(){
    if(!monopolyWaveBActive||!monopolyWaveBStage)return;
    [area,monopolyWaveBStage,board].forEach(node=>monopolyWaveBData(node,'monopoly-process',monopolyWaveCProcess));
    if(monopolyWaveCProcessRail){
      monopolyWaveBData(monopolyWaveCProcessRail,'monopoly-process',monopolyWaveCProcess);
      monopolyWaveBData(monopolyWaveCProcessRail,'monopoly-trade','unavailable');
      if(monopolyWaveCProcessLabel)monopolyWaveCProcessLabel.textContent=monopolyWaveCProcessText();
    }
    monopolyWaveCProcessSteps.forEach((step,index)=>{
      const active=step&&step.dataset&&step.dataset.monopolyProcessStep===monopolyWaveCProcess;
      monopolyWaveBData(step,'monopoly-process-active',active?'true':'false');
      monopolyWaveBData(step,'monopoly-process-index',index);
      if(step&&step.dataset&&step.dataset.monopolyProcessStep==='trade')monopolyWaveBData(step,'monopoly-trade','unavailable');
    });
  }
  function setMonopolyWaveCProcess(next,detail){
    const nextProcess=MONOPOLY_WAVE_C_PROCESS_STEPS.includes(next)?next:'roll';
    const nextDetail=detail===undefined||detail===null?'':String(detail);
    const changed=nextProcess!==monopolyWaveCProcess||nextDetail!==monopolyWaveCProcessDetail;
    monopolyWaveCProcess=nextProcess;
    monopolyWaveCProcessDetail=nextDetail;
    paintMonopolyWaveCProcess();
    if(changed&&typeof emitGameStage25DEvent==='function'&&['walk','land','buy','event','auction','turn-end'].includes(nextProcess))emitGameStage25DEvent({type:'phase',game:'monopoly',phase:nextProcess,detail:nextDetail,reducedMotion:prefersReducedMotion()});
  }
  function emitMonopolyTerminal25D(){
    if(typeof emitGameStage25DEvent!=='function')return;
    const viewer=opts.online?Number(opts.myIdx):0;
    const outcome=spectator||!Number.isInteger(winner)||winner<0||!Number.isInteger(viewer)?'draw':(winner===viewer?'win':'loss');
    emitGameStage25DEvent({type:'phase',game:'monopoly',phase:'terminal',detail:winner,reducedMotion:prefersReducedMotion(),outcome});
  }
  function monopolyWaveCProcessFromPhase(){
    if(over)return 'turn-end';
    if(phase==='moving'||phase==='resolving')return 'walk';
    if(phase==='buy')return 'buy';
    if(phase==='chance')return 'event';
    if(phase==='auction')return 'auction';
    if(phase==='done')return 'turn-end';
    return 'roll';
  }
  function removeMonopolyWaveBNode(node){
    if(!node)return;
    if(typeof node.remove==='function')node.remove();
    else if(node.parentNode&&typeof node.parentNode.removeChild==='function')node.parentNode.removeChild(node);
  }
  function mountMonopolyWaveBPresentation(){
    if(!monopolyWaveBActive||monopolyWaveBStage)return;
    monopolyWaveBStage=el('section','monopoly-wave-b-stage');
    monopolyWaveBStage.setAttribute('role','group');
    monopolyWaveBStage.setAttribute('aria-label',t('game_monopoly'));
    monopolyWaveBBoardFrame=el('div','monopoly-wave-b-board-frame');
    monopolyWaveBBoardFrame.setAttribute('role','group');
    monopolyWaveBBoardFrame.setAttribute('aria-label',t('game_monopoly'));
    monopolyWaveBMeta=el('div','monopoly-wave-b-meta');
    monopolyWaveBMeta.setAttribute('role','status');
    monopolyWaveBMeta.setAttribute('aria-live','polite');
    monopolyWaveBTurn=el('output','monopoly-wave-b-turn');
    monopolyWaveBState=el('output','monopoly-wave-b-state');
    monopolyWaveBProperty=el('output','monopoly-wave-b-property');
    monopolyWaveBChance=el('output','monopoly-wave-b-chance');
    monopolyWaveBAuction=el('output','monopoly-wave-b-auction');
    monopolyWaveBTrade=el('output','monopoly-wave-b-trade');
    monopolyWaveCProcessRail=el('section','monopoly-wave-c-process');
    monopolyWaveCProcessRail.setAttribute('role','status');
    monopolyWaveCProcessRail.setAttribute('aria-live','polite');
    monopolyWaveCProcessLabel=el('output','monopoly-wave-c-process-label');
    const monopolyWaveCProcessTrack=el('div','monopoly-wave-c-process-track');
    monopolyWaveCProcessSteps=MONOPOLY_WAVE_C_PROCESS_STEPS.map(step=>{
      const node=el('span','monopoly-wave-c-process-step');
      monopolyWaveBData(node,'monopoly-process-step',step);
      node.setAttribute('aria-hidden','true');
      monopolyWaveCProcessTrack.appendChild(node);
      return node;
    });
    monopolyWaveCProcessRail.appendChild(monopolyWaveCProcessLabel);
    monopolyWaveCProcessRail.appendChild(monopolyWaveCProcessTrack);
    [monopolyWaveBTurn,monopolyWaveBState,monopolyWaveBProperty,monopolyWaveBChance,monopolyWaveBAuction,monopolyWaveBTrade].forEach(node=>{
      node.setAttribute('aria-live','polite');
    });
    monopolyWaveBMeta.appendChild(monopolyWaveBTurn);
    monopolyWaveBMeta.appendChild(monopolyWaveBState);
    monopolyWaveBMeta.appendChild(monopolyWaveBProperty);
    monopolyWaveBMeta.appendChild(monopolyWaveBChance);
    monopolyWaveBMeta.appendChild(monopolyWaveBAuction);
    monopolyWaveBMeta.appendChild(monopolyWaveBTrade);
    monopolyWaveBMeta.appendChild(monopolyWaveCProcessRail);
    monopolyWaveBBoardFrame.appendChild(board);
    monopolyWaveBStage.appendChild(monopolyWaveBBoardFrame);
    area.appendChild(monopolyWaveBStage);
    monopolyWaveBCommand=el('div','monopoly-wave-b-command');
    [moneyRow,actionRow,settleBtn,stageState,monopolyWaveBMeta].forEach(node=>monopolyWaveBCommand.appendChild(node));
    extra.appendChild(monopolyWaveBCommand);
    monopolyWaveBClass(area,'monopoly-wave-b-arena',true);
    monopolyWaveBClass(monopolyWaveBStage,'monopoly-wave-b-arena',true);
    monopolyWaveBClass(board,'monopoly-wave-b-board',true);
    monopolyWaveBClass(monopolyWaveBBoardFrame,'monopoly-wave-b-board-frame',true);
    monopolyWaveBClass(monopolyWaveBCommand,'monopoly-wave-b-command',true);
    monopolyWaveBClass(center,'monopoly-wave-b-center',true);
    monopolyWaveBClass(turnHud,'monopoly-wave-b-turn-hud',true);
    monopolyWaveBClass(diceRow,'monopoly-wave-b-dice-row',true);
    monopolyWaveBClass(rollBtn,'monopoly-wave-b-dice',true);
    monopolyWaveBClass(stageState,'monopoly-wave-b-command-state',true);
    monopolyWaveBData(area,'game-stage-wave-b','active');
    monopolyWaveBData(monopolyWaveBStage,'game-stage-wave-b','active');
    monopolyWaveBData(monopolyWaveBBoardFrame,'monopoly-region','board');
    monopolyWaveBData(board,'monopoly-region','board');
    monopolyWaveBData(monopolyWaveBMeta,'monopoly-region','meta');
    monopolyWaveBData(monopolyWaveBState,'monopoly-region','state');
    monopolyWaveBData(monopolyWaveBProperty,'monopoly-region','property');
    monopolyWaveBData(monopolyWaveBChance,'monopoly-region','chance');
    monopolyWaveBData(monopolyWaveBAuction,'monopoly-region','auction');
    monopolyWaveBData(monopolyWaveBTrade,'monopoly-region','trade');
    monopolyWaveBData(monopolyWaveCProcessRail,'monopoly-region','process');
    monopolyWaveBData(monopolyWaveBCommand,'monopoly-region','command');
    monopolyWaveBData(center,'monopoly-region','center');
    monopolyWaveBData(turnHud,'monopoly-region','turn');
    monopolyWaveBData(diceRow,'monopoly-region','dice');
    monopolyWaveBData(rollBtn,'monopoly-control','dice');
    monopolyWaveBData(settleBtn,'monopoly-control','settle');
    monopolyWaveBData(stageState,'monopoly-region','command-state');
    monopolyWaveBData(monopolyWaveBTrade,'monopoly-trade','unavailable');
    paintMonopolyWaveCProcess();
  }
  function releaseMonopolyWaveBPresentation(){
    // Restore the pre-Wave-B control location before detaching the command
    // tray. This keeps exact Wave A rollback independent of viewport size.
    clearMonopolyWaveBLayoutDensity();
    clearMonopolyWaveBTransient(false);
    if(monopolyWaveBChanceModal){monopolyWaveBClass(monopolyWaveBChanceModal,'monopoly-wave-b-chance-modal',false);monopolyWaveBData(monopolyWaveBChanceModal,'monopoly-region',null);}
    if(monopolyWaveBChanceCard){monopolyWaveBClass(monopolyWaveBChanceCard,'monopoly-wave-b-chance-card',false);monopolyWaveBData(monopolyWaveBChanceCard,'monopoly-chance',null);}
    if(monopolyWaveBStage&&monopolyWaveBBoardFrame&&board.parentNode===monopolyWaveBBoardFrame)area.appendChild(board);
    if(monopolyWaveBCommand&&monopolyWaveBCommand.parentNode===extra){
      const children=Array.from(monopolyWaveBCommand.children||[]);
      children.forEach(child=>{
        if(child===monopolyWaveBMeta){removeMonopolyWaveBNode(child);return;}
        if(typeof extra.insertBefore==='function')extra.insertBefore(child,monopolyWaveBCommand);
        else extra.appendChild(child);
      });
      removeMonopolyWaveBNode(monopolyWaveBCommand);
    }
    removeMonopolyWaveBNode(monopolyWaveBStage);
    monopolyWaveBClass(area,'monopoly-wave-b-arena',false);
    monopolyWaveBClass(board,'monopoly-wave-b-board',false);
    monopolyWaveBClass(monopolyWaveBBoardFrame,'monopoly-wave-b-board-frame',false);
    monopolyWaveBClass(center,'monopoly-wave-b-center',false);
    monopolyWaveBClass(turnHud,'monopoly-wave-b-turn-hud',false);
    monopolyWaveBClass(diceRow,'monopoly-wave-b-dice-row',false);
    monopolyWaveBClass(rollBtn,'monopoly-wave-b-dice',false);
    monopolyWaveBClass(stageState,'monopoly-wave-b-command-state',false);
    monopolyWaveBData(area,'game-stage-wave-b',null);
    monopolyWaveBData(area,'monopoly-phase',null);
    monopolyWaveBData(area,'monopoly-status',null);
    monopolyWaveBData(area,'monopoly-active-player',null);
    monopolyWaveBData(area,'monopoly-state',null);
    monopolyWaveBData(area,'monopoly-action-mode',null);
    monopolyWaveBData(area,'monopoly-trade',null);
    monopolyWaveBData(area,'monopoly-process',null);
    monopolyWaveBData(board,'monopoly-region',null);
    monopolyWaveBData(board,'monopoly-phase',null);
    monopolyWaveBData(board,'monopoly-active-player',null);
    monopolyWaveBData(board,'monopoly-process',null);
    monopolyWaveBData(center,'monopoly-region',null);
    monopolyWaveBData(turnHud,'monopoly-region',null);
    monopolyWaveBData(turnHud,'monopoly-phase',null);
    monopolyWaveBData(turnHud,'monopoly-active-player',null);
    monopolyWaveBData(diceRow,'monopoly-region',null);
    monopolyWaveBData(diceRow,'monopoly-dice-state',null);
    monopolyWaveBData(rollBtn,'monopoly-control',null);
    monopolyWaveBData(rollBtn,'monopoly-dice-state',null);
    monopolyWaveBData(settleBtn,'monopoly-control',null);
    monopolyWaveBData(stageState,'monopoly-region',null);
    monopolyWaveBData(stageState,'monopoly-state',null);
    monopolyWaveBData(stageState,'monopoly-status',null);
    monopolyWaveBData(monopolyWaveBMeta,'monopoly-region',null);
    [monopolyWaveBState,monopolyWaveBProperty,monopolyWaveBChance,monopolyWaveBAuction,monopolyWaveBTrade].forEach(node=>monopolyWaveBData(node,'monopoly-region',null));
    monopolyWaveBData(actionRow,'monopoly-phase',null);
    monopolyWaveBData(moneyRow,'monopoly-phase',null);
    Array.from(actionRow.children||[]).forEach(node=>{monopolyWaveBData(node,'monopoly-control',null);monopolyWaveBData(node,'monopoly-bid-amount',null);});
    monopolyWaveBStage=null;monopolyWaveBBoardFrame=null;monopolyWaveBMeta=null;monopolyWaveBCommand=null;
    monopolyWaveBTurn=null;monopolyWaveBState=null;monopolyWaveBProperty=null;monopolyWaveBChance=null;monopolyWaveBAuction=null;monopolyWaveBTrade=null;
    monopolyWaveCProcessRail=null;monopolyWaveCProcessLabel=null;monopolyWaveCProcessSteps=[];
    monopolyWaveBChanceModal=null;monopolyWaveBChanceCard=null;
  }
  function syncMonopolyWaveBPresentation(){
    const enabled=monopolyWaveBEnabled();
    if(!enabled){
      if(monopolyWaveBStage)releaseMonopolyWaveBPresentation();
      monopolyWaveBActive=false;
      return false;
    }
    monopolyWaveBActive=true;
    if(!monopolyWaveBStage)mountMonopolyWaveBPresentation();
    return true;
  }
  function clearMonopolyWaveBTransient(removeChance){
    stopStageCountdown();
    if(removeChance&&monopolyWaveBChanceModal){
      removeMonopolyWaveBNode(monopolyWaveBChanceModal);
      monopolyWaveBChanceModal=null;monopolyWaveBChanceCard=null;
    }
  }
  function monopolyWaveBStatus(){
    if(over)return 'finished';
    if(spectator)return 'spectating';
    if(!authorityReady)return 'awaiting-authority';
    if(opts.online&&cur!==opts.myIdx)return 'waiting';
    if(opts.ai&&opts.ai.has(cur))return 'thinking';
    return 'active';
  }
  function monopolyWaveBDiceState(){
    if(over)return 'finished';
    if(phase==='roll')return opts.online&&cur!==opts.myIdx?'waiting':'roll';
    if(phase==='moving'||phase==='resolving')return 'moving';
    return phase;
  }
  function updateMonopolyWaveBPresentation(ui){
    if(!monopolyWaveBActive||!monopolyWaveBStage)return;
    const status=monopolyWaveBStatus(),stateId=ui&&ui.id||'active',cell=players[cur]&&CELLS[players[cur].pos],auction=auctionState&&auctionState.auction;
    [area,monopolyWaveBStage].forEach(node=>{
      monopolyWaveBData(node,'game-stage-wave-b','active');
      monopolyWaveBData(node,'monopoly-phase',phase);
      monopolyWaveBData(node,'monopoly-status',status);
      monopolyWaveBData(node,'monopoly-active-player',cur);
      monopolyWaveBData(node,'monopoly-state',stateId);
      monopolyWaveBData(node,'monopoly-action-mode',ui&&ui.actionMode||'observe');
      monopolyWaveBData(node,'monopoly-trade','unavailable');
    });
    monopolyWaveBData(board,'monopoly-phase',phase);
    monopolyWaveBData(board,'monopoly-active-player',cur);
    monopolyWaveBData(turnHud,'monopoly-phase',phase);
    monopolyWaveBData(turnHud,'monopoly-active-player',cur);
    monopolyWaveBData(actionRow,'monopoly-phase',phase);
    monopolyWaveBData(moneyRow,'monopoly-phase',phase);
    monopolyWaveBData(rollBtn,'monopoly-dice-state',monopolyWaveBDiceState());
    monopolyWaveBData(diceRow,'monopoly-dice-state',monopolyWaveBDiceState());
    monopolyWaveBData(stageState,'monopoly-state',stateId);
    monopolyWaveBData(stageState,'monopoly-status',status);
    monopolyWaveBData(monopolyWaveBState,'monopoly-state',stateId);
    monopolyWaveBData(monopolyWaveBState,'monopoly-status',status);
    monopolyWaveBData(monopolyWaveBProperty,'monopoly-property',cell&&cell.type==='prop'?players[cur].pos:null);
    monopolyWaveBData(monopolyWaveBChance,'monopoly-chance',phase==='chance'?'active':null);
    monopolyWaveBData(monopolyWaveBAuction,'monopoly-auction',auction?'active':null);
    monopolyWaveBTurn.textContent=turnHud.textContent||t('player_turn',cur+1);
    monopolyWaveBState.textContent=stageState.textContent||t('monopoly_state_roll_ready',round,MAX_ROUND,cur+1);
    monopolyWaveBProperty.textContent=phase==='buy'&&cell&&cell.type==='prop'?t('monopoly_buy_prompt',cur+1,monopolyCellName(players[cur].pos),cell.price):'';
    monopolyWaveBChance.textContent=phase==='chance'?t('monopoly_chance_title'):'';
    monopolyWaveBAuction.textContent=auction?t('monopoly_auction_status',monopolyCellName(auction.propertyId),auction.currentBid,auction.currentBidder>=0?t('monopoly_bidder',auction.currentBidder+1):'',Math.ceil(Math.max(0,auction.endAt-Date.now())/1000)):'';
    monopolyWaveBTrade.textContent=t('monopoly_state_trade_unavailable');
    paintMonopolyWaveCProcess();
  }

  function rentOf(cell){ return Math.round(cell.price/3/10)*10; }
  function aliveList(){ return players.map((p,i)=>p.alive?i:-1).filter(i=>i>=0); }
  function netWorth(pi){
    const p = players[pi];
    if (!p) return 0;
    return p.money + p.props.reduce((sum, idx) => sum + Number(CELLS[idx] && CELLS[idx].price || 0), 0);
  }
  function identityOf(value){
    if (value < 2500) return t('monopoly_identity_citizen');
    if (value < 4000) return t('monopoly_identity_comfortable');
    if (value < 6000) return t('monopoly_identity_middle');
    if (value < 9000) return t('monopoly_identity_rich');
    return t('monopoly_identity_tycoon');
  }
  function placement(){
    return players.map((_, i) => i).sort((a, b) =>
      ((players[b].alive ? 1 : 0) - (players[a].alive ? 1 : 0)) ||
      (netWorth(b) - netWorth(a)) || a - b);
  }
  function showCashChange(pi, amount, reason){
    const pop = el('div','monopoly-cash-pop', (amount >= 0 ? '+' : '-') + '¥' + Math.abs(amount) + (reason ? ' · ' + reason : ''));
    pop.style.position = 'absolute'; pop.style.left = '50%'; pop.style.top = '58%';
    pop.style.transform = 'translate(-50%,-50%)'; pop.style.zIndex = '8';
    pop.style.padding = '7px 12px'; pop.style.borderRadius = '999px';
    pop.style.background = amount >= 0 ? 'rgba(16,185,129,.92)' : 'rgba(239,68,68,.92)';
    pop.style.color = '#fff'; pop.style.fontWeight = '800'; pop.style.pointerEvents = 'none';
    board.appendChild(pop);
    later(() => pop.remove(), 700);
  }
  function init(){
    players = Array.from({length:n}, () => ({ money: START_MONEY, pos: 0, visualPos: 0, motionDirection: 1, alive: true, props: [], buildings: 0 }));
    CELLS.forEach(c => { if (c.type==='prop') c.owner = -1; });
    chanceDeck = CHANCE.map((c,i)=>i);
    if (!opts.online){
      for (let i=chanceDeck.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [chanceDeck[i],chanceDeck[j]]=[chanceDeck[j],chanceDeck[i]]; }
    }
    cur = 0; phase = 'roll'; over = false; winner = -1; round = 1; startedAt = Date.now(); finishedAt = 0;
  }
  function characterViews(source){
    if(typeof MonopolyCharacterPresentation==='undefined'||typeof MonopolyCharacterPresentation.project!=='function')return [];
    let seats=[];try{seats=typeof opts.getPublicSeats==='function'?opts.getPublicSeats():[];}catch{seats=[];}
    return MonopolyCharacterPresentation.project({players,seats,current:cur,phase,over,winner,source:source||'live',reducedMotion:prefersReducedMotion()});
  }
  function monopolyWaveBBoardContentWidth(){
    if(!monopolyWaveBActive||!monopolyWaveBBoardFrame)return 0;
    const frameClientWidth=Number(monopolyWaveBBoardFrame.clientWidth)||0;
    if(frameClientWidth<=0)return 0;
    try{
      const style=typeof window.getComputedStyle==='function'?window.getComputedStyle(monopolyWaveBBoardFrame):null;
      const horizontalPadding=(Number.parseFloat(style&&style.paddingLeft)||0)+(Number.parseFloat(style&&style.paddingRight)||0);
      return Math.max(0,frameClientWidth-horizontalPadding);
    }catch(_error){return frameClientWidth;}
  }
  function scheduleMonopolyPresentationResize(){
    if(monopolyDestroyed||opts.destroyed||cancelMonopolyPresentationResize)return;
    const root=typeof window!=='undefined'?window:null;
    const run=()=>{
      cancelMonopolyPresentationResize=null;
      if(monopolyDestroyed||opts.destroyed)return;
      renderBoard();
    };
    if(root&&typeof root.requestAnimationFrame==='function'){
      const ticket=root.requestAnimationFrame(run);
      cancelMonopolyPresentationResize=()=>{
        if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(ticket);
      };
      return;
    }
    const ticket=setTimeout(run,0);
    cancelMonopolyPresentationResize=()=>clearTimeout(ticket);
  }
  function installMonopolyPresentationResize(){
    if(monopolyPresentationResizeWindow||monopolyPresentationResizeObserver)return;
    if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
      monopolyPresentationResizeWindow=window;
      monopolyPresentationResizeWindow.addEventListener('resize',scheduleMonopolyPresentationResize);
      monopolyPresentationResizeWindow.addEventListener('orientationchange',scheduleMonopolyPresentationResize);
    }
    if(typeof ResizeObserver==='function'){
      try{
        monopolyPresentationResizeObserver=new ResizeObserver(scheduleMonopolyPresentationResize);
        monopolyPresentationResizeObserver.observe(area);
        if(monopolyWaveBBoardFrame)monopolyPresentationResizeObserver.observe(monopolyWaveBBoardFrame);
      }catch(_error){monopolyPresentationResizeObserver=null;}
    }
  }
  function releaseMonopolyPresentationResize(){
    if(cancelMonopolyPresentationResize){
      cancelMonopolyPresentationResize();
      cancelMonopolyPresentationResize=null;
    }
    if(monopolyPresentationResizeWindow&&typeof monopolyPresentationResizeWindow.removeEventListener==='function'){
      monopolyPresentationResizeWindow.removeEventListener('resize',scheduleMonopolyPresentationResize);
      monopolyPresentationResizeWindow.removeEventListener('orientationchange',scheduleMonopolyPresentationResize);
    }
    monopolyPresentationResizeWindow=null;
    if(monopolyPresentationResizeObserver&&typeof monopolyPresentationResizeObserver.disconnect==='function')monopolyPresentationResizeObserver.disconnect();
    monopolyPresentationResizeObserver=null;
  }

  function clearMonopolyFinalArtVfx(){
    monopolyFinalArtVfxSeq++;
    monopolyFinalArtVfxRole=null;
    if(monopolyFinalArtLayers&&monopolyFinalArtLayers.vfxHost&&monopolyFinalArtLayers.vfxHost.parentNode){
      monopolyFinalArtLayers.vfxHost.remove();
      monopolyFinalArtLayers.vfxHost=null;
    }
  }

  function renderMonopolyFinalArtLayers(){
    if(!monopolyFinalArtActive||!monopolyFinalArtLayers)return null;
    const host=el('div','monopoly-final-art-layers');
    host.setAttribute('aria-hidden','true');
    host.dataset.monopolyFinalArt=monopolyFinalArtState;
    ['background','midground','foreground'].forEach((layer,index)=>{
      const url=monopolyFinalArtLayers[layer];
      if(!url)return;
      const image=el('img','monopoly-final-art-layer monopoly-final-art-layer-'+layer);
      image.alt=''; image.decoding='async'; image.loading='eager'; image.src=url;
      image.dataset.monopolyFinalArtLayer=layer;
      image.style.zIndex=String(index);
      host.appendChild(image);
    });
    board.appendChild(host);
    monopolyFinalArtLayers.host=host;
    return host;
  }

  function showMonopolyFinalArtVfx(role){
    if(!monopolyFinalArtActive||!monopolyFinalArtLayers||!monopolyFinalArtLayers.vfx)return false;
    const url=monopolyFinalArtLayers.vfx[role];
    if(!url)return false;
    monopolyFinalArtVfxRole=role;
    const host=monopolyFinalArtLayers.host||renderMonopolyFinalArtLayers();
    if(!host)return false;
    let vfxHost=monopolyFinalArtLayers.vfxHost;
    if(!vfxHost){
      vfxHost=el('div','monopoly-final-art-vfx-host');
      vfxHost.setAttribute('aria-hidden','true');
      host.appendChild(vfxHost);
      monopolyFinalArtLayers.vfxHost=vfxHost;
    }
    const node=el('img','monopoly-final-art-vfx');
    node.alt='';node.decoding='async';node.src=url;node.dataset.monopolyFinalArtVfx=role;
    vfxHost.appendChild(node);
    const seq=++monopolyFinalArtVfxSeq;
    later(()=>{if(seq===monopolyFinalArtVfxSeq&&node.parentNode)node.remove();},prefersReducedMotion()?220:900);
    return true;
  }

  function initMonopolyFinalArtSurface(){
    if(!monopolyFinalArtRequested||typeof resolveMonopolyFinalArtUrl!=='function')return;
    const request=++monopolyFinalArtRequest,reduced=prefersReducedMotion();
    const boardRoles=['background','midground','foreground'].map(id=>'board-'+id);
    const vfxRoles=['landing','opportunity','auction','purchase','payment','tax','bankruptcy','turn-result','final-result'].map(id=>'vfx-'+id);
    Promise.all([
      ...boardRoles.map(role=>resolveMonopolyFinalArtUrl(role,reduced)),
      ...vfxRoles.map(role=>resolveMonopolyFinalArtUrl(role,reduced)),
    ]).then(urls=>{
      if(request!==monopolyFinalArtRequest||monopolyDestroyed||opts.destroyed)return;
      const boardUrls=urls.slice(0,3),vfxUrls=urls.slice(3);
      if(boardUrls.some(url=>!url)||vfxUrls.some(url=>!url)){
        monopolyFinalArtState='fallback';monopolyFinalArtActive=false;renderBoard('fallback');return;
      }
      const probes=boardUrls.map(url=>new Promise(resolve=>{const image=monopolyFinalArtImageFactory();if(!image){resolve(false);return;}image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=url;}));
      return Promise.all(probes).then(results=>{
        if(request!==monopolyFinalArtRequest||monopolyDestroyed||opts.destroyed)return;
        if(results.some(value=>!value)){monopolyFinalArtState='fallback';monopolyFinalArtActive=false;renderBoard('fallback');return;}
        monopolyFinalArtLayers={background:boardUrls[0],midground:boardUrls[1],foreground:boardUrls[2],vfx:Object.fromEntries(vfxRoles.map((role,index)=>[role.slice(4),vfxUrls[index]])),host:null,vfxHost:null};
        monopolyFinalArtActive=true;monopolyFinalArtState='active';renderBoard('live');
      });
    }).catch(()=>{if(request===monopolyFinalArtRequest&&!monopolyDestroyed){monopolyFinalArtState='fallback';monopolyFinalArtActive=false;renderBoard('fallback');}});
  }

  function monopolyOutcomeOptions(){
    const order=placement();
    const terminalOnly = spectator || (!opts.online && !(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0));
    return {
      winner,
      winnerName:t('player_number',winner+1),
      emoji:'🏆',
      subtitle:t('monopoly_assets_subtitle',players[winner]?players[winner].money:0),
      coins:1,
      viewerSlot:terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0),
      audioType:terminalOnly ? 'match_terminal' : undefined,
      audioId:'monopoly-outcome-' + String(epoch) + '-' + String(winner),
      podium:order.map((playerId,index)=>({rank:index+1,name:t('player_number',playerId+1),color:PLAYER_COLORS[playerId]})),
      onRestart:reset,
      onShare:()=>shareGameLink('monopoly'),
    };
  }
  function revealMonopolyOutcome(){
    monopolyOutcomeTimer=null;
    monopolyOutcomeScheduled=false;
    if(monopolyDestroyed||opts.destroyed||!over||monopolyOutcomeVisible||typeof monopolyOutcomePending!=='function')return false;
    const present=monopolyOutcomePending;
    monopolyOutcomePending=null;
    monopolyOutcomeVisible=true;
    try{present();}catch(_error){}
    return true;
  }
  function queueMonopolyOutcome(present){
    if(!over||monopolyOutcomeVisible||typeof present!=='function')return false;
    monopolyOutcomePending=present;
    if(monopolyOutcomeScheduled)return true;
    return revealMonopolyOutcome();
  }
  function clearMonopolyOutcomeTimer(){
    if(monopolyOutcomeTimer!==null)clearTimeout(monopolyOutcomeTimer);
    monopolyOutcomeTimer=null;
    monopolyOutcomeScheduled=false;
    monopolyOutcomeVisible=false;
    monopolyOutcomePending=null;
  }
  function renderBoard(source){
    if(source)uiSource=source;
    syncMonopolyWaveBPresentation();
    const preservedVfxRole=monopolyFinalArtVfxRole;
    const arenaSize = typeof measureGameStageArena === 'function' ? measureGameStageArena(area,520,0) : {width:Number(area.clientWidth)||520,height:Number(area.clientHeight)||0};
    const w = monopolyWaveBBoardContentWidth() || arenaSize.width || 520;
    const h = arenaSize.height;
    const heightLimit = h > 320 ? Math.max(260, Math.min(680, h - 16)) : 640;
    S = Math.min(w, heightLimit);
    const density=applyMonopolyWaveBLayoutDensity(S);
    if (board.style && typeof board.style.setProperty === 'function') board.style.setProperty('--monopoly-wave-c-board-size', S + 'px');
    board.style.width = S + 'px'; board.style.height = S + 'px';
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(board, 'monopoly-board', { variant: boardTheme });
    board.style.background = tabletop
      ? 'radial-gradient(circle at 35% 26%,rgba(255,255,255,.76),transparent 26%),linear-gradient(135deg,#FFF9F2,#F3E5C4)'
      : boardTheme === 'grass'
      ? 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.82),rgba(236,253,245,.72) 42%,rgba(22,101,52,.34)),repeating-linear-gradient(105deg,#5f9f55 0 5px,#4f8e49 5px 9px)'
      : 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.92),rgba(255,247,237,.88) 48%,rgba(146,64,14,.24)),repeating-linear-gradient(90deg,#c99b6b 0 8px,#b98555 8px 16px)';
    board.innerHTML = '';
    if(monopolyFinalArtLayers){
      // board.innerHTML invalidates the previous hosts. Clear their references
      // before mounting again so VFX never targets a detached DOM subtree.
      monopolyFinalArtLayers.host=null;
      monopolyFinalArtLayers.vfxHost=null;
    }
    if(monopolyFinalArtActive){
      renderMonopolyFinalArtLayers();
      if(preservedVfxRole)showMonopolyFinalArtVfx(preservedVfxRole);
    }
    rollBtn.disabled = !authorityReady || spectator || over || phase !== 'roll' || (opts.online && cur !== opts.myIdx) || (opts.ai && opts.ai.has(cur));
    const c = S/2, R = S*0.40;
    const ang = i => (-90 + i * 360/CELLS.length) * Math.PI/180;
    // A 24-cell circle has roughly .104S of chord distance between cells.
    // Compact boards leave a visible gap rather than allowing labels and
    // shadows to overlap; the full descriptive labels remain in the DOM.
    const cellScale=density==='full'?.103:(density==='compact'?.092:.086);
    const cellFloor=density==='micro'?14:18;
    const cellSize = Math.min(54, Math.max(cellFloor,Math.floor(S*cellScale)));
    // Follow the same visible position as the retained DOM token during a
    // local walk, then settle to the committed authority position.
    const activePlayer=players[cur];
    const activePosition=activePlayer&&Number.isInteger(activePlayer.visualPos)?activePlayer.visualPos:(activePlayer&&Number.isInteger(activePlayer.pos)?activePlayer.pos:-1);
    CELLS.forEach((cell, i) => {
      const x = c + R*Math.cos(ang(i)), y = c + R*Math.sin(ang(i));
      const current=i===activePosition;
      const cellName=monopolyCellName(i);
      const cellAmount=cell.type==='prop'?cell.price:(cell.type==='tax'?cell.amt:null);
      const ownerText=cell.owner>=0?t('monopoly_owned_by',cell.owner+1):'';
      const accessibleLabel=[cellName,cellAmount===null?'':'¥'+cellAmount,ownerText].filter(Boolean).join(' · ');
      const d = el('div','m-cell monopoly-cell');
      d.style.left = (x - cellSize/2) + 'px'; d.style.top = (y - cellSize/2) + 'px';
      d.style.width = d.style.height = cellSize + 'px';
      d.setAttribute('role','img');
      d.setAttribute('aria-label',accessibleLabel);
      d.title=accessibleLabel;
      if(current){d.classList.add('is-current-cell');d.setAttribute('aria-current','location');}
      if (cell.type === 'prop'){
        d.style.borderColor = cell.col;
        const st = el('div','stripe'); st.style.background = cell.col;
        st.setAttribute('aria-hidden','true');
        d.appendChild(st);
        const glyph=el('span','monopoly-cell-glyph','◆');glyph.setAttribute('aria-hidden','true');d.appendChild(glyph);
        const label=el('span','monopoly-cell-label',cellName);label.setAttribute('aria-hidden','true');d.appendChild(label);
        const value=el('span','monopoly-cell-value','¥'+cell.price);value.setAttribute('aria-hidden','true');d.appendChild(value);
        if (cell.owner >= 0){
          const od = el('div','owner-dot');
          od.style.background = PLAYER_COLORS[cell.owner];
          od.setAttribute('aria-hidden','true');
          od.title = t('monopoly_owned_by',cell.owner+1);
          d.appendChild(od);
          const ownerBadge = el('span','property-owner-avatar',t('player_number',cell.owner+1));
          ownerBadge.setAttribute('aria-hidden','true');
          ownerBadge.style.cssText = 'position:absolute;right:2px;bottom:2px;border-radius:999px;padding:1px 3px;font-size:9px;font-weight:800;color:#fff;background:' + PLAYER_COLORS[cell.owner] + ';';
          d.appendChild(ownerBadge);
        }
      } else {
        d.style.borderColor = '#d7deea';
        const emoji=el('span','emo', cell.emo);emoji.setAttribute('aria-hidden','true');d.appendChild(emoji);
        const label=el('span','monopoly-cell-label',cellName);label.setAttribute('aria-hidden','true');d.appendChild(label);
      }
      if(monopolyWaveBActive){
        monopolyWaveBData(d,'monopoly-cell',i);
        monopolyWaveBData(d,'monopoly-cell-type',cell.type);
        monopolyWaveBData(d,'monopoly-cell-owner',cell.owner>=0?cell.owner:null);
        monopolyWaveBData(d,'monopoly-cell-current',current?'true':null);
        monopolyWaveBData(d,'monopoly-cell-density',density);
      }
      board.appendChild(d);
    });
    const projectedCharacters=characterViews(source);
    // 棋子标记：权威位置只经纯表现模块消费；已授权图层只改变表现层，
    // 任何 manifest/解码失败仍由 playerCharacterLayeredNode 保留同族与代码 fallback。
    players.forEach((p, pi) => {
      if (!p.alive) return;
      const view=projectedCharacters[pi]||null;
      const pos = view ? view.displayPosition : (Number.isInteger(p.visualPos) ? p.visualPos : p.pos);
      const x = c + R*Math.cos(ang(pos)), y = c + R*Math.sin(ang(pos));
      const a = (pi / n) * Math.PI*2 - Math.PI/2;
      const m = el('div','m-marker monopoly-character-token');
      if(m.style&&typeof m.style.setProperty==='function')m.style.setProperty('--monopoly-token-color',PLAYER_COLORS[pi]);else if(m.style)m.style['--monopoly-token-color']=PLAYER_COLORS[pi];
      const skin = tokenSkin(pi);
      let renderedLayered=false;
      if(skin==='car'){m.classList.add('is-car');m.textContent='🚗';}
      else{
        const layered=typeof playerCharacterLayeredNode==='function'&&view&&view.character
          ? playerCharacterLayeredNode(view.character,{size:'128',className:'monopoly-player-character-art',fallbackText:String(pi+1),onRendererState:state=>{m.dataset.characterRenderer=state;}})
          : null;
        if(layered){renderedLayered=true;m.appendChild(layered);}
        else{const fallback=el('span','monopoly-character-fallback',String(pi+1));fallback.setAttribute('aria-hidden','true');m.appendChild(fallback);}
      }
      const tokenTitle=t('monopoly_token_title',pi+1,t(skin==='car'?'monopoly_token_car':'monopoly_token_character'));
      m.title=tokenTitle;m.setAttribute('role','img');m.setAttribute('aria-label',tokenTitle);
      if(view){m.dataset.characterState=view.state;m.dataset.characterFacing=view.facing;m.dataset.characterTransition=view.transition;m.dataset.characterRenderer=renderedLayered&&m.children&&m.children[0]&&m.children[0].dataset?m.children[0].dataset.playerCharacterRenderer:view.renderMode;}
      m.style.left = (x + Math.cos(a)*7) + 'px';
      m.style.top = (y + Math.sin(a)*7) + 'px';
      if(monopolyWaveBActive){
        monopolyWaveBData(m,'monopoly-player',pi);
        monopolyWaveBData(m,'monopoly-position',pos);
        monopolyWaveBData(m,'monopoly-active',pi===cur?'true':'false');
        monopolyWaveBData(m,'monopoly-alive',p.alive?'true':'false');
      }
      board.appendChild(m);
    });
    // 中心
    const cs = S*0.40;
    center.style.left = (S/2) + 'px'; center.style.top = (S/2) + 'px';
    center.style.width = center.style.height = cs + 'px';
    center.style.marginLeft = center.style.marginTop = (-cs/2) + 'px';
    center.style.fontSize = Math.max(11, cs*0.085) + 'px';
    const leader = placement()[0];
    turnHud.textContent = spectator
      ? t('spectator_player_turn',cur+1)
      : (opts.online && cur === opts.myIdx ? t('your_turn') : t('player_turn',cur+1));
    leaderHud.textContent = leader === undefined ? '' : t('monopoly_leader',leader+1,netWorth(leader));
    turnHud.style.cssText = 'font-weight:900;margin-bottom:3px;transition:opacity .2s ease;';
    leaderHud.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:5px;';
    renderStageState(source);
    board.appendChild(center);
    // 结束覆盖层
    if (over){
      queueMonopolyOutcome(()=>showVictoryOverlay(area,monopolyOutcomeOptions()));
    }
    renderMoney();
  }
  function renderMoney(){
    moneyRow.innerHTML = '';
    players.forEach((p, i) => {
      const chip = el('div','money-chip' + (i===cur && !over ? ' active' : '') + (!p.alive ? ' bankrupt' : ''));
      if(monopolyWaveBActive){
        monopolyWaveBData(chip,'monopoly-player',i);
        monopolyWaveBData(chip,'monopoly-active',i===cur&&!over?'true':'false');
        monopolyWaveBData(chip,'monopoly-alive',p.alive?'true':'false');
      }
      const dot = el('span','dot'); dot.style.background = PLAYER_COLORS[i];
      chip.appendChild(dot);
      chip.appendChild(el('span', null, t('player_number',i+1)));
      chip.appendChild(el('span','amt', '¥' + p.money));
      const worth = netWorth(i);
      chip.appendChild(el('span','monopoly-identity', t('monopoly_identity_worth',identityOf(worth),worth)));
      chip.appendChild(el('span','monopoly-assets', '🏠 ' + p.props.length + ' · 🏢 ' + (p.buildings || 0) + ' · ' + (p.props.length ? p.props.map(idx => monopolyCellName(idx).slice(0,1)).join(' ') : t('monopoly_no_properties'))));
      moneyRow.appendChild(chip);
    });
    renderPlayers(cur, players.map((p,i) => p.alive ? t('monopoly_player_summary',identityOf(netWorth(i)),p.money,p.props.length) : t('monopoly_bankrupt')), players.map(p => !p.alive));
  }
  function roll(){
    if (!authorityReady || spectator || over || phase !== 'roll') return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    setMonopolyWaveCProcess('roll');
    if(fullRuleAuthority){phase='moving';rollBtn.disabled=true;opts.sendMonopolyAction({matchId:typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||'',seq:++monopolySeq,action:{type:'roll'}});setStatus(t('monopoly_server_rolling'));return;}
    const d1 = 1 + Math.floor(Math.random()*6), d2 = 1 + Math.floor(Math.random()*6);
    if (opts.onProgress) opts.onProgress({ roll: [d1, d2] });
    if (opts.online) opts.sendMove({ roll: [d1, d2] });
    applyRoll(d1, d2);
  }
  function applyRoll(d1, d2){
    if (over || phase !== 'roll') return;
    const pi = cur;
    const actionEpoch = epoch;
    phase = 'moving';
    if ([d1,d2].every(value => Number.isInteger(value) && value >= 1 && value <= 6)) {
      audioCue('monopoly_roll', { actionId:'monopoly-local-' + epoch + '-' + (++monopolyAudioSequence) + '-roll', reaction:'tap' }, 1);
    }
    setMonopolyWaveCProcess('roll', d1 + d2);
    rollBtn.disabled = true;
    setStatus(t('monopoly_player_rolling',pi+1));
    renderStageState();
    diceFaces[0].roll(d1, () => {
      if (actionEpoch !== epoch) return;
      diceFaces[1].roll(d2, () => {
      if (actionEpoch !== epoch) return;
      movePlayer(pi, d1 + d2, () => {
        if (actionEpoch !== epoch) return;
        resolveCell(pi);
      });
      });
    });
  }
  function movePlayer(pi, steps, cb){
    const p = players[pi];
    const old = p.pos;
    const signed = Number(steps) || 0;
    const npos = ((old + signed) % CELLS.length + CELLS.length) % CELLS.length;
    if (signed > 0 && old + signed >= CELLS.length){
      p.money += 2000;
      toast(t('monopoly_passed_start'));
      showCashChange(pi, 2000, t('monopoly_passed_start_reason'));
    }
    p.pos = npos;
    audioCue('monopoly_land', { actionId:'monopoly-local-' + epoch + '-' + (++monopolyAudioSequence) + '-land', reaction:'move' }, .65);
    showMonopolyFinalArtVfx('landing');
    setMonopolyWaveCProcess('walk', Math.abs(signed));
    if (prefersReducedMotion()){
      p.visualPos = npos;
      renderBoard();
      setStatus(t('monopoly_landed',pi+1,monopolyCellName(npos)));
      setMonopolyWaveCProcess('land', npos);
      if (cb) cb();
      return;
    }
    const direction = signed < 0 ? -1 : 1;
    p.motionDirection = direction;
    const total = Math.abs(signed);
    let step = 0;
    const motionDelay = total ? Math.max(55, Math.min(140, Math.floor(760 / total))) : 0;
    const advance = () => {
      if (step >= total){
        p.visualPos = npos;
        renderBoard();
        setStatus(t('monopoly_landed',pi+1,monopolyCellName(npos)));
        setMonopolyWaveCProcess('land', npos);
        later(cb, 120);
        return;
      }
      step++;
      p.visualPos = ((old + direction * step) % CELLS.length + CELLS.length) % CELLS.length;
      renderBoard();
      later(advance, motionDelay);
    };
    advance();
  }
  function resolveCell(pi, depth){
    if (over) return;
    const p = players[pi];
    if (!p.alive) { nextTurn(); return; }
    const cell = CELLS[p.pos];
    if (cell.type === 'go'){
      setMonopolyWaveCProcess('turn-end');
      nextTurn();
    } else if (cell.type === 'rest'){
      setMonopolyWaveCProcess('event', cell.type);
      setStatus(t('monopoly_rest_status',pi+1));
      later(nextTurn, 500);
    } else if (cell.type === 'tax'){
      setMonopolyWaveCProcess('event', cell.type);
      pay(pi, cell.amt, t('monopoly_tax_reason',cell.amt));
      later(() => { if (!over) nextTurn(); }, 400);
    } else if (cell.type === 'chance'){
      setMonopolyWaveCProcess('event', cell.type);
      showChance(pi, depth || 0);
    } else if (cell.type === 'prop'){
      if (cell.owner === -1){
        phase = 'buy';
        setMonopolyWaveCProcess('buy', p.pos);
        renderBoard();
        if(opts.online&&opts.isHost&&typeof opts.sendMonopolyState==='function')opts.sendMonopolyState(snapshot());
        setStatus(t('monopoly_buy_prompt',pi+1,monopolyCellName(cell),cell.price));
        actionRow.innerHTML = '';
        const buy = el('button','btn btn-primary',t('monopoly_buy_button',cell.price));
        if(monopolyWaveBActive)monopolyWaveBData(buy,'monopoly-control','buy');
        buy.addEventListener('click', () => {
          if (spectator) return;
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.onProgress) opts.onProgress({ decision: 'buy' });
           if (opts.online&&!fullRuleAuthority) opts.sendMove({ decision: 'buy' });
          applyDecision(pi, 'buy');
        });
        const pass = el('button','btn',t('monopoly_pass'));
        if(monopolyWaveBActive)monopolyWaveBData(pass,'monopoly-control','pass');
        pass.addEventListener('click', () => {
          if (spectator) return;
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.onProgress) opts.onProgress({ decision: 'pass' });
           if (fullRuleAuthority){applyDecision(pi,'pass');}
           else if (auctionAuthority){phase='auction';setMonopolyWaveCProcess('auction',p.pos);actionRow.innerHTML='';opts.sendMonopolyAuctionOpen({propertyId:p.pos});setStatus(t('monopoly_opening_auction',monopolyCellName(cell)));renderBoard();}
           else {if (opts.online&&!fullRuleAuthority) opts.sendMove({ decision: 'pass' });applyDecision(pi, 'pass');}
        });
        actionRow.appendChild(buy); actionRow.appendChild(pass);
        drainRemoteInputs();
        if (phase === 'buy') { scheduleAI(); notifyIdle(); }
      } else if (cell.owner === pi){
        setMonopolyWaveCProcess('event', cell.type);
        setStatus(t('monopoly_own_property',pi+1));
        later(nextTurn, 500);
      } else {
        setMonopolyWaveCProcess('event', cell.type);
        const rent = rentOf(cell);
        pay(pi, rent, t('monopoly_rent_reason',cell.owner+1,rent));
        later(() => { if (!over) nextTurn(); }, 450);
      }
    }
  }
  function applyDecision(pi, decision){
    if (over || phase !== 'buy' || pi !== cur || (decision !== 'buy' && decision !== 'pass')) return false;
    setMonopolyWaveCProcess(decision === 'buy' ? 'buy' : (auctionAuthority ? 'auction' : 'turn-end'));
    if(fullRuleAuthority){opts.sendMonopolyAction({matchId:typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||'',seq:++monopolySeq,action:{type:decision}});setStatus(t('monopoly_server_processing',t(decision==='buy'?'monopoly_action_buy':'monopoly_action_auction')));return true;}
    const p = players[pi];
    const cell = CELLS[p.pos];
    if (!cell || cell.type !== 'prop' || cell.owner !== -1) return false;
    if (decision === 'buy'){
      if (p.money >= cell.price){
        p.money -= cell.price; cell.owner = pi; p.props.push(p.pos);
        audioCue('monopoly_purchase', { actionId:'monopoly-local-' + epoch + '-' + (++monopolyAudioSequence) + '-purchase', reaction:'score' }, .9);
        toast(t('monopoly_bought',monopolyCellName(cell)));
        showMonopolyFinalArtVfx('purchase');
        showCashChange(pi, -cell.price, t('monopoly_purchase_reason',monopolyCellName(cell)));
      } else {
        toast(t('monopoly_insufficient_cash'));
      }
    }
    phase = 'done';
    setMonopolyWaveCProcess('turn-end');
    actionRow.innerHTML = '';
    renderBoard();
    later(nextTurn, 450);
    return true;
  }
  function pay(pi, amt, why){
    const p = players[pi];
    p.money -= amt;
    if (Number.isFinite(amt) && amt > 0) audioCue('monopoly_pay', { actionId:'monopoly-local-' + epoch + '-' + (++monopolyAudioSequence) + '-pay', reaction:'tap' }, .75);
    showMonopolyFinalArtVfx(why&&String(why).toLowerCase().includes('税')?'tax':'payment');
    showCashChange(pi, -amt, why || t('monopoly_cash_change'));
    if (p.money < 0){
      p.alive = false;
      p.props.forEach(idx => CELLS[idx].owner = -1);
      p.props = [];
      showMonopolyFinalArtVfx('bankruptcy');
      audioCue('monopoly_bankrupt', { actionId:'monopoly-local-' + epoch + '-' + (++monopolyAudioSequence) + '-bankrupt', reaction:'capture' }, 1);
      toast(t('monopoly_bankrupt_toast',pi+1));
      const alive = aliveList();
      if (alive.length === 1){
        over = true; winner = alive[0];
        emitMonopolyTerminal25D();
        creditGame();
        renderBoard();
        setStatus(t('result_winner',winner+1), true);
        notifyIdle();
        return;
      }
    }
    renderBoard();
    if (why) setStatus(t('monopoly_player_event',pi+1,why));
  }
  function showChance(pi, depth){
    if (depth >= 3){ setStatus(t('monopoly_chance_chain_stopped')); later(nextTurn, 500); return; }
    phase = 'chance';
    setMonopolyWaveCProcess('event', 'chance');
    renderStageState();
    const idx = chanceDeck.shift();
    chanceDeck.push(idx);
    const card = CHANCE[idx];
    showMonopolyFinalArtVfx('opportunity');
    const modal = el('div','chance-modal');
    const box = el('div','chance-card');
    if(monopolyWaveBActive){
      monopolyWaveBClass(modal,'monopoly-wave-b-chance-modal',true);
      monopolyWaveBData(modal,'monopoly-region','chance');
      monopolyWaveBClass(box,'monopoly-wave-b-chance-card',true);
      monopolyWaveBData(box,'monopoly-chance',idx);
      monopolyWaveBChanceModal=modal;monopolyWaveBChanceCard=box;
    }
    const titleId='monopoly-chance-title-'+epoch+'-'+pi;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby',titleId);
    box.appendChild(el('div','emo','🎁'));
    const heading=el('h3',null,t('monopoly_chance_title'));heading.id=titleId;box.appendChild(heading);
    box.appendChild(el('p', null, monopolyChanceText(card)));
    const autoResolve=!!(opts.online||spectator||(opts.ai&&opts.ai.has(pi)));
    const ok = el('button','btn btn-primary',autoResolve?t('monopoly_revealing'):t('ok'));
    ok.type='button';let resolved=false;
    const resolve=()=>{if(resolved)return;resolved=true;modal.remove();if(monopolyWaveBChanceModal===modal)monopolyWaveBChanceModal=null;if(monopolyWaveBChanceCard===box)monopolyWaveBChanceCard=null;applyChance(pi,card,depth);};
    ok.addEventListener('click',resolve);
    box.appendChild(ok);
    modal.appendChild(box);
    board.appendChild(modal);
    modal.addEventListener('keydown',event=>{if(event.key==='Tab'){if(event.preventDefault)event.preventDefault();if(typeof ok.focus==='function')ok.focus();}else if(event.key==='Escape'&&!ok.disabled){if(event.preventDefault)event.preventDefault();resolve();}});
    modal.addEventListener('click',event=>{if(event.target===modal&&!ok.disabled)resolve();});
    if(autoResolve){
      ok.disabled = true;
      modal.setAttribute('tabindex','-1');
      if(typeof modal.focus==='function')modal.focus();
      later(resolve,650);
    }else if(typeof ok.focus==='function')ok.focus();
  }
  function applyChance(pi, card, depth){
    const p = players[pi];
    if (!p.alive) return;
    if (card.v !== undefined) pay(pi, -card.v, t('monopoly_chance_reason'));
    else if (card.each !== undefined){
      if (card.each > 0){
        let got = 0;
        players.forEach((q, qi) => { if (qi !== pi && q.alive){ q.money -= card.each; got += card.each; } });
        p.money += got;
        renderBoard();
        setStatus(t('monopoly_sponsored',pi+1,card.each));
      } else {
        let aliveOthers = 0;
        players.forEach((q, qi) => {
          if (qi !== pi && q.alive){ q.money += -card.each; aliveOthers++; }
        });
        p.money += card.each * aliveOthers;
        renderBoard();
        setStatus(t('monopoly_treated_everyone',pi+1,-card.each));
      }
      // 检查其他人破产
      let ended = false;
      players.forEach((q, qi) => {
        if (qi !== pi && q.alive && q.money < 0){
          q.alive = false;
          q.props.forEach(idx => CELLS[idx].owner = -1);
          q.props = [];
          toast(t('monopoly_bankrupt_toast',qi+1));
          const alive = aliveList();
          if (alive.length === 1){ over = true; winner = alive[0]; ended = true; emitMonopolyTerminal25D(); creditGame(); renderBoard(); setStatus(t('result_winner',winner+1), true); notifyIdle(); }
        }
      });
      if (ended) return;
    }
    else if (card.move !== undefined){
      setStatus(t('monopoly_move_spaces',pi+1,t(card.move > 0 ? 'monopoly_forward' : 'monopoly_backward'),Math.abs(card.move)));
      movePlayer(pi, card.move, () => resolveCell(pi, depth+1));
      return;
    }
    else if (card.go){
      p.money += 2000;
      p.pos = 0;
      p.visualPos = 0;
      showCashChange(pi, 2000, t('monopoly_go_start_reason'));
      renderBoard();
      setStatus(t('monopoly_go_start_status',pi+1));
    }
    later(() => { if (!over) nextTurn(); }, 600);
  }
  function nextTurn(){
    if (over) return;
    setMonopolyWaveCProcess('turn-end');
    showMonopolyFinalArtVfx('turn-result');
    const previous=cur;
    phase = 'roll';
    actionRow.innerHTML = '';
    if (cur === n - 1) round++;
    cur = (cur + 1) % n;
    while (!players[cur].alive) cur = (cur + 1) % n;
    if(opts.online&&opts.myIdx===previous&&typeof opts.sendMonopolyTurnEnd==='function')opts.sendMonopolyTurnEnd(cur);
    if (round > MAX_ROUND){ settle(); return; }
    renderBoard();
    setStatus(t('monopoly_round_turn',Math.min(round,MAX_ROUND),MAX_ROUND,cur+1));
    drainRemoteInputs();
    if (phase === 'roll') { scheduleAI(); notifyIdle(); }
  }
  function settle(){
    if (over) return;
    over = true; finishedAt = Date.now(); area.style.touchAction = 'auto';
    creditGame();
    const order = placement();
    winner = order[0];
    showMonopolyFinalArtVfx('final-result');
    emitMonopolyTerminal25D();
    renderBoard();
    const lines = order.map((i, k) => t('monopoly_settlement_line',k+1,i+1,netWorth(i),players[i].money,players[i].alive ? '' : t('monopoly_bankrupt_suffix')));
    const overlayAlreadyVisible=monopolyOutcomeVisible;
    const showSettlement=()=>{
      if(!overlayAlreadyVisible)showVictoryOverlay(area,monopolyOutcomeOptions());
      showModal(t('monopoly_settlement_title',winner+1), lines, t('ok'));
    };
    if(monopolyOutcomeVisible)showModal(t('monopoly_settlement_title',winner+1), lines, t('ok'));
    else queueMonopolyOutcome(showSettlement);
    setStatus(t('monopoly_final_winner',winner+1), true);
    notifyIdle();
  }
  function creditGame(){
    const order = placement();
    const res = order.map((i, k) => ({ slot: i, coins: k === 0 ? 1 : 0, rank: k + 1 }));
    if (opts.onEnd) opts.onEnd(res);
  }
  function monopolyAuthorityCue(value,type,index,reaction,intensity){
    const revision=Number.isSafeInteger(value&&value.revision)?value.revision:0;
    return audioCue(type,{actionId:'monopoly-rule-'+revision+'-'+type.replace('monopoly_','')+'-'+(index||0),reaction:reaction||'tap'},intensity);
  }
  function emitMonopolyAuthorityCues(value,transition,source,beforePlayers){
    if(source!=='live'||!transition||transition.type!=='monopoly_transition'||!Array.isArray(transition.events))return false;
    const events=transition.events.filter(event=>event&&typeof event.type==='string');
    const types=new Set(events.map(event=>event.type));
    let cueIndex=0,emitted=false;
    if(transition.action==='roll'||types.has('roll')){
      monopolyAuthorityCue(value,'monopoly_roll',++cueIndex,'tap',1);emitted=true;
    }
    if(types.has('move')||types.has('land')){
      monopolyAuthorityCue(value,'monopoly_land',++cueIndex,'move',.65);emitted=true;
      showMonopolyFinalArtVfx('landing');
    }
    if(types.has('purchase')){
      monopolyAuthorityCue(value,'monopoly_purchase',++cueIndex,'score',.9);emitted=true;
      showMonopolyFinalArtVfx('purchase');
    }
    if(types.has('auction_open')||types.has('auction_bid')||types.has('auction_closed')){
      monopolyAuthorityCue(value,'monopoly_auction',++cueIndex,'tap',.8);emitted=true;
      showMonopolyFinalArtVfx('auction');
    }
    const afterPlayers=value&&value.state&&Array.isArray(value.state.players)?value.state.players:[];
    const spent=Array.isArray(beforePlayers)&&beforePlayers.some((player,id)=>player&&afterPlayers[id]&&Number(afterPlayers[id].money)<Number(player.money));
    if(spent&&!types.has('purchase')&&!types.has('auction_closed')){
      monopolyAuthorityCue(value,'monopoly_pay',++cueIndex,'tap',.75);emitted=true;
      showMonopolyFinalArtVfx('payment');
    }
    const bankrupt=Array.isArray(beforePlayers)&&beforePlayers.some((player,id)=>player&&player.alive!==false&&afterPlayers[id]&&afterPlayers[id].alive===false);
    if(bankrupt){monopolyAuthorityCue(value,'monopoly_bankrupt',++cueIndex,'capture',1);showMonopolyFinalArtVfx('bankruptcy');emitted=true;}
    if(transition.action==='turn_end'){showMonopolyFinalArtVfx('turn-result');}
    return emitted;
  }
  function renderAuctionActions(){
    if(!auctionState||!auctionState.auction||auctionState.auction.status!=='open')return;
    showMonopolyFinalArtVfx('auction');
    const auction=auctionState.auction,cell=CELLS[auction.propertyId];phase='auction';actionRow.innerHTML='';
    setMonopolyWaveCProcess('auction', auction.propertyId);
    setStatus(t('monopoly_auction_status',cell?monopolyCellName(cell):t('monopoly_property'),auction.currentBid,auction.currentBidder>=0?t('monopoly_bidder',auction.currentBidder+1):'',Math.ceil(Math.max(0,auction.endAt-Date.now())/1000)));
    if(!spectator&&auction.eligiblePlayers.includes(opts.myIdx)){
      [100,250].forEach(step=>{const amount=auction.currentBid+step,button=el('button','btn'+(step===250?' btn-primary':''),t('monopoly_bid_button',amount));if(monopolyWaveBActive){monopolyWaveBData(button,'monopoly-control','bid');monopolyWaveBData(button,'monopoly-bid-amount',amount);}button.disabled=!players[opts.myIdx]||players[opts.myIdx].money<amount;button.addEventListener('click',()=>{opts.sendMonopolyBid({auctionId:auction.auctionId,amount,revision:auction.revision,bidId:'bid_'+opts.myIdx+'_'+(++auctionBidSeq)+'_'+Date.now()});});actionRow.appendChild(button);});
    }
    renderBoard();notifyIdle();
  }
  function onAuctionEvent(type,value){
    if(!auctionAuthority||!value||value.protocol!=='monopoly-auction-v1'||String(value.matchId||'')!==String(typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||''))return false;
    auctionState=value;
    if(type==='auction_open'||type==='auction_bid'||type==='auction_state'){
      if(type!=='auction_state')audioCue('monopoly_auction',{actionId:'monopoly-auction-'+(Number(value.revision)||Number(value.auction&&value.auction.revision)||0)+'-'+type,reaction:'tap'},.75);
      renderAuctionActions();return true;
    }
    if(type==='auction_closed'&&value.auction){
      const auction=value.auction,cell=CELLS[auction.propertyId];
      if(cell&&cell.type==='prop'&&auction.currentBidder>=0&&cell.owner===-1){const bidder=auction.currentBidder;cell.owner=bidder;players[bidder].props.push(auction.propertyId);players[bidder].money=Math.max(0,players[bidder].money-auction.currentBid);toast(t('monopoly_auction_won',bidder+1,auction.currentBid,monopolyCellName(cell)));}
      else if(cell)toast(t('monopoly_auction_unsold',monopolyCellName(cell)));
      audioCue('monopoly_auction',{actionId:'monopoly-auction-'+(Number(value.revision)||Number(auction.revision)||0)+'-closed',reaction:auction.currentBidder>=0?'score':'tap'},auction.currentBidder>=0?.9:.65);
      auctionState=null;phase='done';setMonopolyWaveCProcess('turn-end');actionRow.innerHTML='';renderBoard();later(nextTurn,350);return true;
    }
    return false;
  }
  function drainRemoteInputs(){
    if (drainingRemoteInputs || over) return;
    drainingRemoteInputs = true;
    try {
      while (remoteInputs.length && !over){
        const event = remoteInputs[0] || {};
        const payload = event.payload || {};
        if (payload.decision === 'settle'){
          // 提前结算也必须排在当前完整行动之后；buy 阶段尚未完成本回合。
          if (phase === 'buy'){
            // settle 可能先于当前玩家的购买决定到达；先完成该决定，再在下一 roll 边界结算。
            const decisionIdx = remoteInputs.findIndex((item, idx) => idx > 0 && item && item.payload &&
              item.payload.decision && item.payload.decision !== 'settle' && item.player === cur);
            if (decisionIdx < 0) break;
            const decision = remoteInputs.splice(decisionIdx, 1)[0].payload;
            applyDecision(cur, decision.decision);
            break;
          }
          if (phase !== 'roll') break;
          remoteInputs.shift();
          settle();
        } else {
          if (!Number.isInteger(event.player)){
            remoteInputs.shift();
            continue;
          }
          if (event.player !== cur){
            // 当前行动仍在动画中时，保留已到达的下一位玩家输入。
            if (phase !== 'roll' && phase !== 'buy') break;
            remoteInputs.shift();
            continue;
          }
          if (payload.roll){
          if (phase !== 'roll'){
            if (phase !== 'buy') break;
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyRoll(payload.roll[0], payload.roll[1]);
          } else if (payload.decision){
          if (phase !== 'buy'){
            if (phase !== 'roll') break;
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyDecision(cur, payload.decision);
          } else {
          remoteInputs.shift();
          }
        }
      }
    } finally {
      drainingRemoteInputs = false;
    }
  }
  opts.onMove = (payload, player) => {
    if(fullRuleAuthority)return;
    if (!payload) return;
    if (!payload.roll && !payload.decision) return;
    if (opts.online && !Number.isInteger(player)) return;
    remoteInputs.push({ payload, player });
    drainRemoteInputs();
  };
  function resetLocal(){
    invalidateAsync();
    clearMonopolyWaveBTransient(true);
    if(presentationAdapter)presentationAdapter.reset('new-match');
    authorityReady=true;uiSource='live';uiTransition=null;uiBankruptPlayer=-1;
    monopolyPresentationMatchId='';
    init();
    setMonopolyWaveCProcess('roll');
    remoteInputs = [];auctionState=null;auctionBidSeq=0;monopolySeq=0;monopolyAudioSequence=0;
    actionRow.innerHTML = '';
    rollBtn.disabled = false;
    diceFaces.forEach(f => f.reset());
    aiPending = false;
    renderBoard();
    setStatus(t('monopoly_round_turn',1,MAX_ROUND,1));
    notifyIdle();
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  init();
  renderBoard();
  if(monopolyFinalArtRequested)initMonopolyFinalArtSurface();
  installMonopolyPresentationResize();
  setStatus(t('monopoly_round_turn',1,MAX_ROUND,1));
  function snapshot(){
    return {
      players: players.map(p => ({ money: p.money, pos: p.pos, alive: p.alive, props: p.props.slice(), buildings: p.buildings || 0 })),
      cur, phase, round, over, winner,
      owners: CELLS.map(c => c.owner),
      deck: chanceDeck.slice(),
    };
  }
  function animatePresentationFrame(frame){
    if(!frame||!frame.animation||frame.animation.mode!=='step')return;
    const item=frame.players&&frame.players[frame.animation.player];if(!item)return;
    const p=players[frame.animation.player];if(!p||!p.alive)return;
    const actionEpoch=epoch,from=Number(frame.animation.from),direction=Number(frame.animation.direction)<0?-1:1,total=Math.abs(Number(frame.animation.steps)||0);
    if(!Number.isInteger(from)||!total)return;
    let step=0;const delay=Math.max(55,Math.min(140,Math.floor(760/total)));
    const advance=()=>{if(actionEpoch!==epoch||opts.destroyed)return;if(step>=total){p.visualPos=Number(item.authorityPosition);renderBoard('live');return;}step++;p.visualPos=((from+direction*step)%CELLS.length+CELLS.length)%CELLS.length;renderBoard('live');later(advance,delay);};
    advance();
  }
  function renderStageState(source){
    if(!stageState)return;
    syncMonopolyWaveBPresentation();
    const currentPlayer=players[cur]||{};
    const cell=currentPlayer&&CELLS[currentPlayer.pos];
    const auction=auctionState&&auctionState.auction;
    const authority=authorityReady?{state:{players:players.map(p=>({pos:p.pos,alive:p.alive})),current:cur,phase,round,terminal:over,winner},round,terminal:over,winner,auctionEndAt:auction&&auction.endAt,serverNow:Date.now()}:{};
    let ui;
    if(typeof MonopolyUiState!=='undefined'&&typeof MonopolyUiState.derive==='function'){
      const deadPlayer=players.findIndex(player=>player&&player.alive===false);
      ui=MonopolyUiState.derive({source:source||uiSource,authority,transition:uiTransition,seats:typeof opts.getPublicSeats==='function'?opts.getPublicSeats():[],spectator,role:spectator?'spectator':'player',allowMutation:authorityReady&&!spectator&&(!opts.online||opts.myIdx===cur)&&!(opts.ai&&opts.ai.has(cur)),maxRound:MAX_ROUND,property:cell&&cell.type==='prop'?{name:monopolyCellName(currentPlayer.pos),price:cell.price}:null,cellName:cell?monopolyCellName(currentPlayer.pos):'',cellNames:CELLS.map((_,index)=>monopolyCellName(index)),countdown:auction?Math.max(0,auction.endAt-Date.now()):0,focusBankrupt:uiBankruptPlayer>=0?uiBankruptPlayer:deadPlayer,fallbackReason:source==='fallback'?'renderer_fallback':''});
    }else{
      const fallbackId=!authorityReady?'entering':over?'terminal':phase==='auction'?'auction':phase==='buy'?'buy_decision':phase==='chance'?'chance':phase==='moving'||phase==='resolving'?'roll_resolving':'roll_ready';
      ui={id:fallbackId,i18nKey:fallbackId==='auction'?'monopoly_state_auction':fallbackId==='buy_decision'?'monopoly_state_buy_decision':fallbackId==='chance'?'monopoly_state_chance':fallbackId==='terminal'?'monopoly_state_terminal':fallbackId==='entering'?'monopoly_state_entering':'monopoly_state_roll_ready',args:fallbackId==='roll_ready'?[round,MAX_ROUND,cur+1]:[],actionMode:'observe',ariaLive:'polite'};
    }
    stageState.dataset.state=ui.id;
    stageState.dataset.actionMode=ui.actionMode;
    stageState.setAttribute('aria-live',ui.ariaLive||'polite');
    const message=typeof t==='function'?t(ui.i18nKey,...(ui.args||[])):ui.i18nKey;
    stageState.textContent=message===ui.i18nKey?String(ui.id).replace(/_/g,' '):message;
    stageState.title=stageState.textContent;
    syncStageCountdown(ui,auction&&auction.endAt);
    updateMonopolyWaveBPresentation(ui);
  }
  function stopStageCountdown(){if(stageCountdownTimer){clearTimeout(stageCountdownTimer);stageCountdownTimer=null;}}
  function syncStageCountdown(ui,deadline){
    if(prefersReducedMotion()||!ui||ui.id!=='auction'||!Number.isFinite(Number(deadline))||Number(deadline)<=Date.now()){stopStageCountdown();return;}
    if(stageCountdownTimer)return;
    stageCountdownTimer=later(()=>{stageCountdownTimer=null;renderStageState();},Math.min(1000,Math.max(120,Number(deadline)-Date.now())));
  }
  function validMonopolyPresentationOrigin(meta){
    return !!meta&&['live','room-restored','reconnect','spectator-bootstrap'].includes(meta.source)&&
      typeof meta.matchId==='string'&&meta.matchId.length>0&&
      Number.isSafeInteger(meta.authorityRevision)&&meta.authorityRevision>=0&&
      typeof meta.stateHash==='string'&&meta.stateHash.length>0;
  }
  function monopolyPresentationPosition(value){
    const number=Number(value);
    return Number.isInteger(number)&&number>=0&&number<CELLS.length?number:null;
  }
  function monopolyPresentationMotion(frame,source){
    const animation=frame&&frame.animation;
    if(source!=='live'||!animation||animation.mode!=='step'||prefersReducedMotion()||over===true)return null;
    const actor=Number(animation.player),from=monopolyPresentationPosition(animation.from),to=monopolyPresentationPosition(animation.to);
    const steps=Number(animation.steps),direction=Number(animation.direction),forward=Number.isSafeInteger(steps)&&steps>=2&&steps<=12,backward=steps===-2;
    if(!Number.isSafeInteger(actor)||actor<0||actor>=players.length||from===null||to===null||(!forward&&!backward)||
      !Number.isSafeInteger(direction)||(forward&&direction!==1)||(backward&&direction!==-1)||steps!==direction*Math.abs(steps)||
      ((from+steps)%CELLS.length+CELLS.length)%CELLS.length!==to)return null;
    const player=players[actor],planned=Array.isArray(frame.players)?frame.players[actor]:null;
    if(!player||monopolyPresentationPosition(player.pos)!==to||!planned||
      monopolyPresentationPosition(planned.authorityPosition)!==to||monopolyPresentationPosition(planned.displayPosition)!==from)return null;
    return {actor,from,to,steps,direction};
  }
  function snapMonopolyPresentationFrame(frame){
    if(!frame||!Array.isArray(frame.players))return null;
    return {...frame,players:frame.players.map(player=>player&&typeof player==='object'?{...player,displayPosition:player.authorityPosition}:player),animation:{mode:'snap'}};
  }
  function onRestore(value,source,presentationFrame,originMeta,freshGeneration){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.players)) return false;
    invalidateAsync();
    const restoreSource=source||'snapshot';
    const hasAcceptedOnlineOrigin=validMonopolyPresentationOrigin(originMeta);
    // Online DOM/2.5D motion is renderable only when the presentation adapter
    // accepted the matching authority frame. Authority state still renders.
    if(opts.online&&!hasAcceptedOnlineOrigin){
      presentationFrame=null;
    }else if(opts.online){
      monopolyPresentationMatchId=originMeta.matchId;
    }else{
      monopolyPresentationMatchId='';
    }
    if(fullRuleAuthority)authorityReady=true;
    players = state.players.map((p,index) => ({
      money: Number(p.money) || 0, pos: Number(p.pos) || 0, visualPos: presentationFrame&&presentationFrame.players&&presentationFrame.players[index]?Number(presentationFrame.players[index].displayPosition):Number(p.pos) || 0, motionDirection: presentationFrame&&presentationFrame.animation&&presentationFrame.animation.player===index&&Number(presentationFrame.animation.direction)<0?-1:1,
      alive: p.alive !== false, props: Array.isArray(p.props) ? p.props.slice() : [], buildings: Number(p.buildings) || 0,
    }));
    cur = Number.isInteger(state.cur) ? state.cur : 0;
    phase = ['roll','buy','chance','moving','done','auction','finished'].includes(state.phase) ? state.phase : 'roll';
    round = Number(state.round) || 1; over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    const pendingMotion=opts.online&&hasAcceptedOnlineOrigin?monopolyPresentationMotion(presentationFrame,restoreSource):null;
    // A claimed step that does not pass the signed/circular contract is not a
    // partial visual state.  It becomes a static authority-position snap.
    if(opts.online&&!pendingMotion&&presentationFrame&&presentationFrame.animation&&presentationFrame.animation.mode==='step'){
      const snapped=snapMonopolyPresentationFrame(presentationFrame);
      if(snapped){
        presentationFrame=snapped;
        players.forEach(player=>{player.visualPos=player.pos;player.motionDirection=1;});
      }
    }
    setMonopolyWaveCProcess(monopolyWaveCProcessFromPhase());
    CELLS.forEach((cell, i) => { if (cell.type === 'prop') cell.owner = Array.isArray(state.owners) && Number.isInteger(state.owners[i]) ? state.owners[i] : -1; });
    chanceDeck = Array.isArray(state.deck) && state.deck.length ? state.deck.slice() : CHANCE.map((_, i) => i);
    if (value && value.presentation){ setBoardTheme(value.presentation.boardTheme); setCosmetic(value.presentation.cosmetic); }
    const renderSource=source||'snapshot';uiSource=renderSource;uiTransition=null;actionRow.innerHTML = ''; renderBoard(renderSource); if(fullRuleAuthority)renderRuleActions();else renderRestoredPurchaseActions();if(presentationFrame)animatePresentationFrame(presentationFrame);notifyIdle(); return true;
  }
  function renderRestoredPurchaseActions(){
    if(phase!=='buy'||spectator||opts.online&&cur!==opts.myIdx)return;const p=players[cur],cell=p&&CELLS[p.pos];if(!cell||cell.type!=='prop'||cell.owner!==-1)return;
    const buy=el('button','btn btn-primary',t('monopoly_buy_button',cell.price));if(monopolyWaveBActive)monopolyWaveBData(buy,'monopoly-control','buy');buy.addEventListener('click',()=>{if(opts.online)opts.sendMove({decision:'buy'});applyDecision(cur,'buy');});
    const pass=el('button','btn',t('monopoly_pass'));if(monopolyWaveBActive)monopolyWaveBData(pass,'monopoly-control','pass');pass.addEventListener('click',()=>{if(auctionAuthority){phase='auction';setMonopolyWaveCProcess('auction',p.pos);actionRow.innerHTML='';opts.sendMonopolyAuctionOpen({propertyId:p.pos});setStatus(t('monopoly_opening_auction',monopolyCellName(cell)));renderBoard();}else{if(opts.online)opts.sendMove({decision:'pass'});applyDecision(cur,'pass');}});actionRow.appendChild(buy);actionRow.appendChild(pass);
  }
  function renderRuleActions(){
    if(!fullRuleAuthority||!authorityReady||spectator||over||opts.myIdx!==cur)return;actionRow.innerHTML='';
    if(phase==='buy'){
      const propertyId=players[cur]&&players[cur].pos,cell=RulesCell(propertyId),runtimeCell=CELLS[propertyId];if(!cell||cell.type!=='prop'||!runtimeCell||runtimeCell.owner!==-1)return;
      const buy=el('button','btn btn-primary',t('monopoly_buy_button',cell.price));if(monopolyWaveBActive)monopolyWaveBData(buy,'monopoly-control','buy');buy.addEventListener('click',()=>applyDecision(cur,'buy'));const pass=el('button','btn',t('monopoly_pass_auction'));if(monopolyWaveBActive)monopolyWaveBData(pass,'monopoly-control','pass-auction');pass.addEventListener('click',()=>applyDecision(cur,'pass'));actionRow.appendChild(buy);actionRow.appendChild(pass);
    }else if(phase==='auction'&&auctionState&&auctionState.auction){const auction=auctionState.auction;[100,250].forEach(step=>{const button=el('button','btn'+(step===250?' btn-primary':''),t('monopoly_bid_button',auction.currentBid+step));button.addEventListener('click',()=>opts.sendMonopolyAction({matchId:typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||'',seq:++monopolySeq,action:{type:'bid',amount:auction.currentBid+step,revision:auction.revision,bidId:'bid-'+opts.myIdx+'-'+monopolySeq}}));actionRow.appendChild(button);});}
  }
  function RulesCell(index){return typeof MonopolyRules!=='undefined'&&MonopolyRules.CELLS?MonopolyRules.CELLS[index]:CELLS[index];}
  function onMonopolyRuleState(value,transition,cause){
    if(!fullRuleAuthority||!value||value.protocol!==RULE_PROTOCOL)return false;
    const expectedMatchId=String(typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||'');
    // A callback from an already replaced match is a no-op.  It must not
    // dismantle the current generation or revive its stale renderer state.
    if(String(value.matchId||'')!==expectedMatchId)return false;
    const state=value.state;if(!state)return false;
    const wasOver=over;
    const beforeAudioPlayers=players.map(player=>({money:player.money,alive:player.alive}));
    const rawCause=typeof cause==='string'?cause:'live';
    const causeName=rawCause.toLowerCase();
    const explicitNewMatch=causeName==='started'||causeName==='new-match'||causeName==='new_match'||causeName==='new match';
    const incomingTerminal=!!(state.terminal||value.terminal);
    const matchChanged=!!monopolyPresentationMatchId&&monopolyPresentationMatchId!==String(value.matchId||'');
    const terminalToNewMatch=over===true&&!incomingTerminal;
    const reconnectGeneration=causeName==='reconnect'||causeName==='room-restored'||causeName==='spectator-bootstrap';
    const freshGeneration=explicitNewMatch||matchChanged||terminalToNewMatch||reconnectGeneration;
    // A same-match terminal restart must not let the adapter derive a move
    // from the old terminal frame.  The next accepted frame is a snap.
    if(freshGeneration&&presentationAdapter&&typeof presentationAdapter.reset==='function')presentationAdapter.reset('new-match');
    const adapterCause=explicitNewMatch?'started':(reconnectGeneration?causeName:'live');
    const plan=presentationAdapter?presentationAdapter.consume({cause:adapterCause,authority:value,transition:transition||value.transition||null,seats:typeof opts.getPublicSeats==='function'?opts.getPublicSeats():[],reducedMotion:prefersReducedMotion()}):null;
    const bridgeSource=reconnectGeneration?causeName:'live';
    const acceptedFrame=plan&&plan.accepted===true&&plan.frame?plan.frame:null;
    const originMeta=acceptedFrame?{source:bridgeSource,matchId:acceptedFrame.matchId,authorityRevision:acceptedFrame.revision,stateHash:acceptedFrame.stateHash}:null;
    if(!validMonopolyPresentationOrigin(originMeta))return false;
    const owners=Array.from({length:CELLS.length},()=>-1);Object.keys(state.owners||{}).forEach(id=>{owners[Number(id)]=Number(state.owners[id]);});const snapshot={players:(state.players||[]).map(player=>({money:player.money,pos:player.pos,alive:player.alive,props:Array.isArray(player.props)?player.props.slice():[],buildings:0})),cur:state.current,phase:state.phase==='resolving'?'moving':state.phase,round:state.round,over:incomingTerminal,winner:Number.isInteger(state.winner)?state.winner:-1,owners,deck:Array.isArray(state.chanceDeck)?state.chanceDeck.slice():[]};
    if(value.auctionEndAt&&state.auction){auctionState={protocol:RULE_PROTOCOL,matchId:value.matchId,auction:{...state.auction,status:'open',startAt:Date.now(),endAt:value.auctionEndAt,eligiblePlayers:state.auction.eligiblePlayers||[]},cash:state.players.map(player=>player.money),ownership:{...state.owners}};}else auctionState=null;
    authorityReady=true;
    const applied=onRestore(snapshot,bridgeSource,acceptedFrame,originMeta,freshGeneration);if(applied){uiSource=rawCause==='reconnect'?'reconnect':rawCause==='spectator-bootstrap'?'spectator-bootstrap':'live';uiTransition=transition||value.transition||null;uiBankruptPlayer=acceptedFrame&&acceptedFrame.changes&&acceptedFrame.changes.bankruptPlayers.length?acceptedFrame.changes.bankruptPlayers[0]:-1;emitMonopolyAuthorityCues(value,uiTransition,rawCause,beforeAudioPlayers);if(incomingTerminal&&!wasOver&&!reconnectGeneration&&!explicitNewMatch)emitMonopolyTerminal25D();renderStageState(uiSource);renderRuleActions();}return applied;
  }
  function onMonopolyRuleResult(value){return fullRuleAuthority&&value&&value.protocol===RULE_PROTOCOL?onMonopolyRuleState(value.state||value):false;}
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; renderBoard(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); renderBoard(); return { default:cosmetic.default,players:{...cosmetic.players} }; }
  function setSpectators(value){ spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value; renderBoard(); return spectator; }
  function getMatchStats(){
    const order = placement();
    return players.map((p, i) => ({
      duration: Math.max(0, (finishedAt || Date.now()) - startedAt), cash: p.money, netWorth: netWorth(i),
      properties: p.props.length, buildings: p.buildings || 0, placement: order.indexOf(i) + 1,
    }));
  }
  return {
    reset,
    onMove: opts.onMove,
    onRestart: resetLocal,
    destroy: () => {
      invalidateAsync();
      clearMonopolyWaveBTransient(true);
      monopolyFinalArtRequest++;
      clearMonopolyFinalArtVfx();
      monopolyFinalArtLayers=null;
      monopolyFinalArtActive=false;
      if(presentationAdapter)presentationAdapter.destroy();
      monopolyDestroyed=true;opts.destroyed=true;
      releaseMonopolyPresentationResize();
      releaseMonopolyWaveBPresentation();
      monopolyWaveBActive=false;
      stopStageCountdown();
      aiPending = false;
      remoteInputs = [];
      diceFaces.forEach(face => face.reset());
      area.style.touchAction = previousTouchAction;
      area.style.overscrollBehavior = previousOverscroll;
    },
    whenIdle,
    snapshot, onRestore,onAuctionEvent,onMonopolyRuleState,onMonopolyRuleResult,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic: { default:cosmetic.default,players:{...cosmetic.players} } }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, getMatchStats,
    getMultiplayerRequirement: () => ({ quickAuction: opts.online ? (fullRuleAuthority?'MONOPOLY_RULE_PROTOCOL_V2':'MONOPOLY_AUCTION_PROTOCOL_V1') : null }),
  };
}
