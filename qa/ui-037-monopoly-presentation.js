'use strict';

const assert=require('assert');
const fs=require('fs');
const Ui=require('../public/src/games/monopoly-ui-state.js');

let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error.message);process.exitCode=1;}}
function base(overrides={}){
  const state={players:[{id:0,pos:2,alive:true},{id:1,pos:6,alive:true}],current:0,phase:'roll',round:3,terminal:false,winner:-1,...(overrides.state||{})};
  const out={source:'live',seats:[{seatId:0,online:true},{seatId:1,online:true}],allowMutation:true,maxRound:30,cellNames:Array.from({length:24},(_,i)=>'Cell '+i),...overrides};
  out.authority={round:state.round,phase:state.phase,state,serverNow:1000,...(overrides.authority||{})};
  delete out.state;
  return out;
}

check('entering waits for an authoritative board',()=>assert.strictEqual(Ui.derive({source:'started'}).id,'entering'));
check('roll-ready exposes the roll action only to an eligible actor',()=>{
  assert.strictEqual(Ui.derive(base()).actionMode,'roll');
  assert.strictEqual(Ui.derive(base({allowMutation:false})).actionMode,'observe');
});
check('roll/move transitions lock mutation while resolving',()=>{
  const value=base({state:{phase:'resolving'},transition:{events:[{type:'roll',player:0,dice:[2,3]},{type:'move',player:0,from:2,to:7,steps:5}]}});
  assert.strictEqual(Ui.derive(value).id,'roll_resolving');
  assert.strictEqual(Ui.derive(value).canMutate,false);
});
check('landing uses the authoritative event player and position',()=>{
  const value=base({transition:{events:[{type:'land',player:1,position:6}]}}),out=Ui.derive(value);
  assert.strictEqual(out.id,'landing');assert.deepStrictEqual(out.args,[2,'Cell 6']);
});
check('chance card state is visible without replaying the card',()=>assert.strictEqual(Ui.derive(base({transition:{events:[{type:'chance',player:0,index:2}]}})).id,'chance'));
check('buy decision exposes controls only to the current eligible player',()=>{
  const value=base({state:{phase:'buy'},property:{name:'Blue Bay',price:300}}),out=Ui.derive(value);
  assert.strictEqual(out.id,'buy_decision');assert.strictEqual(out.actionMode,'buy');
  assert.strictEqual(Ui.derive({...value,allowMutation:false}).actionMode,'observe');
});
check('purchase, rent and tax events map to read-only payment state',()=>{
  for(const type of ['purchase','rent','tax','payment'])assert.strictEqual(Ui.derive(base({transition:{events:[{type}]}})).id,'payment');
});
check('auction countdown is display-only for non-actors',()=>{
  const value=base({state:{phase:'auction',auction:{currentBid:450}},authority:{auctionEndAt:6100,serverNow:1100},allowMutation:false}),out=Ui.derive(value);
  assert.strictEqual(out.id,'auction');assert.strictEqual(out.actionMode,'observe');assert.deepStrictEqual(out.args,[450,5]);
});
check('bankruptcy event is visible and cannot mutate seats',()=>assert.strictEqual(Ui.derive(base({transition:{events:[{type:'bankruptcy',player:1}]}})).id,'bankrupt'));
check('authority diff may focus a newly bankrupt player without exposing economy state',()=>assert.strictEqual(Ui.derive(base({state:{players:[{id:0,pos:2,alive:true},{id:1,pos:6,alive:false}]},focusBankrupt:1})).id,'bankrupt'));
check('unsupported trade is explicit and does not fabricate a workflow',()=>assert.strictEqual(Ui.derive(base({action:'trade'})).id,'trade_unavailable'));
check('current-seat disconnect does not change the authority state',()=>{
  const value=base({seats:[{seatId:0,online:false},{seatId:1,online:true}]}),before=JSON.stringify(value.authority.state),out=Ui.derive(value);
  assert.strictEqual(out.id,'disconnected');assert.strictEqual(JSON.stringify(value.authority.state),before);
});
check('reconnect and spectator snapshots always remain read-only',()=>{
  assert.strictEqual(Ui.derive(base({source:'reconnect'})).id,'rejoined');
  const spectator=Ui.derive(base({source:'spectator-bootstrap',spectator:true}));assert.strictEqual(spectator.id,'spectator');assert.strictEqual(spectator.actionMode,'observe');
});
check('terminal server state outranks reconnect and spectator decoration',()=>assert.strictEqual(Ui.derive(base({source:'reconnect',state:{terminal:true,phase:'finished',winner:0}})).id,'terminal'));
check('invalid presentation fallback is safe and does not leak economy fields',()=>{
  const out=Ui.derive(base({fallbackReason:'seat_mapping_invalid',owned:[3001],coins:999,price:30})),text=JSON.stringify(out);
  assert.strictEqual(out.id,'protocol_or_asset_fallback');assert(!text.includes('3001')&&!text.includes('999')&&!text.includes('price'));
});
check('runtime state rail uses the reduced DOM contract and no unsupported insertion API',()=>{
  const source=fs.readFileSync(require('path').join(__dirname,'../public/src/games/monopoly.js'),'utf8');
  assert(source.includes("const stageState = el('div','monopoly-stage-state')"));
  assert(source.includes('extra.appendChild(stageState)'));
  assert(!source.includes('insertBefore(stageState'));
  assert(source.includes("modal.setAttribute('role','dialog')"));
  assert(source.includes("event.key==='Escape'"));
  assert(source.includes('stopStageCountdown()'));
});

if(!process.exitCode)console.log('UI037_MONOPOLY_STATE_MATRIX_ALL_PASS',passed);
