'use strict';

const fs=require('fs');
const path=require('path');
const presentation=require('../public/src/games/monopoly-character-presentation');
let failed=0;
function check(name,condition){if(condition)console.log('PASS ',name);else{console.error('FAIL ',name);failed++;}}
function base(extra={}){return presentation.project({players:[{pos:0,visualPos:0,alive:true},{pos:6,visualPos:5,alive:true}],seats:[{seatId:0,playerCharacter:{schemaVersion:'player-character-v1',characterId:'character-base-01',slots:{body:'body-paper-01',face:'face-dot-01',hair:'hair-none',top:'top-hoodie-01',bottom:'bottom-shorts-01',footwear:'footwear-sneakers-01',accessory:'accessory-none'}}},{seatId:1}],current:1,phase:'moving',source:'live',...extra});}

check('module exposes one deep projection entry point',Object.isFrozen(presentation)&&typeof presentation.project==='function'&&Object.keys(presentation).filter(key=>typeof presentation[key]==='function').length===1);
check('malformed input returns an empty stable collection',Array.isArray(presentation.project(null))&&presentation.project(null).length===0);
const live=base();
check('live movement keeps authority and visual positions distinct',live[1].authorityPosition===6&&live[1].displayPosition===5);
check('snapshot forces the server authority position without animation',base({source:'snapshot'})[1].displayPosition===6&&base({source:'snapshot'})[1].transition==='instant');
check('reduced motion keeps live movement instant',base({reducedMotion:true})[1].transition==='instant');
check('normal live movement uses step transition',live[1].state==='moving'&&live[1].transition==='step');
check('movement and idle facing derive deterministically from board position',live[1].facing==='south'&&live[0].facing==='south');
check('reverse movement flips the tangent facing',base({players:[{pos:0,visualPos:0,alive:true},{pos:6,visualPos:6,motionDirection:-1,alive:true}]})[1].facing==='north');
check('authority phases map to stable presentation states',base({phase:'buy'})[1].state==='purchase'&&base({phase:'auction'})[1].state==='auction'&&base({phase:'chance'})[1].state==='event');
const end=base({over:true,winner:1});
check('terminal state separates winner and settled players',end[0].state==='settled'&&end[1].state==='winner');
check('bankrupt players remain represented but invisible',base({players:[{pos:0,alive:false}]})[0].state==='bankrupt'&&!base({players:[{pos:0,alive:false}]})[0].visible);
const privateInput={schemaVersion:'player-character-v1',characterId:'unknown',slots:{body:'unknown'},owned:[3001],coins:999,token:'secret'};
const safe=presentation.project({players:[{pos:0}],seats:[{seatId:0,playerCharacter:privateInput}]})[0].character;
check('unknown and private character fields collapse to the fixed public fallback',safe.characterId==='character-base-01'&&safe.slots.body==='body-paper-01'&&!('owned'in safe)&&!('coins'in safe)&&!('token'in safe));
check('runtime cannot activate unapproved art paths',live.every(item=>item.renderMode==='code-fallback'&&!('assetPath'in item)&&!('assetId'in item)));

const root=path.join(__dirname,'..');
const monopoly=fs.readFileSync(path.join(root,'public/src/games/monopoly.js'),'utf8');
const roster=fs.readFileSync(path.join(root,'public/src/ui/07-roster.js'),'utf8');
const online=fs.readFileSync(path.join(root,'public/src/online/03-websocket.js'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build.js'),'utf8');
const template=fs.readFileSync(path.join(root,'public/index-template.html'),'utf8');
check('Monopoly consumes the projection without changing shared rules',monopoly.includes('MonopolyCharacterPresentation.project({players,seats,current:cur,phase,over,winner')&&monopoly.includes("const renderSource=source||'snapshot'"));
check('online caller supplies current public Seat projections lazily',roster.includes('getPublicSeats: () => online.roomInfo'));
check('online forwards the existing root transition without changing the wire contract',online.includes("onMonopolyRuleState(msg.payload||msg,msg.transition||null)")&&online.includes("onMonopolyRuleState(p.monopolyRuleSnapshot,null,'reconnect')"));
check('build orders the presentation module before Monopoly',build.indexOf("'games/monopoly-character-presentation.js'")<build.indexOf("'games/monopoly.js'"));
check('code fallback has reduced-motion and accessible renderer hooks',template.includes('monopoly-character-fallback')&&template.includes('@media (prefers-reduced-motion:reduce)')&&monopoly.includes("setAttribute('aria-label',tokenTitle)"));
check('presentation module never reads economy, rule or reward fields',!/(\bcoins\b|\bowned\b|\bprice\b|\breward\b|\bdice\b|\bdamage\b|\bspeed\b|\bxp\b|\bwins\b)/i.test(fs.readFileSync(path.join(root,'public/src/games/monopoly-character-presentation.js'),'utf8')));

if(failed){console.error('MONOPOLY_CHARACTER_PRESENTATION_FAILED',failed);process.exit(1);}console.log('MONOPOLY_CHARACTER_PRESENTATION_ALL_PASS');
