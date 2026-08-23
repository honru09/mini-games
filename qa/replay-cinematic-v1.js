'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const source=read('public/src/core/29-replay-cinematic.js'),adapter=read('public/replay-cinematic-entry.js'),online=read('public/src/online/03-websocket.js'),roster=read('public/src/ui/07-roster.js'),build=read('scripts/build.js');
const { readPresentationSource }=require('./presentation-source');
const template=readPresentationSource();

assert.match(source,/STATES=Object\.freeze\(\['idle','overview','playing','paused','seeking','result'\]\)/);
assert.match(source,/function begin\(options\)/);assert.match(source,/function beat\(options\)/);assert.match(source,/function complete\(options\)/);assert.match(source,/function end\(reason\)/);
assert.match(source,/CameraSystem25D\.to\(mode/);assert.doesNotMatch(source,/ScrollTrigger|setInterval|setTimeout|Rule|Authority|Reward|Supabase|WebSocket|localStorage/);
assert.match(source,/ENTRY_URL='\.\/replay-cinematic-entry\.js'/);assert.match(source,/reduced\(\)\|\|hidden\(\)\|\|!overlay/);assert.match(source,/visibilitychange',onVisibilityChange/);
assert.match(adapter,/gsap\.timeline/);assert.match(adapter,/addLabel\('replay-'/);assert.match(adapter,/autoAlpha/);assert.match(adapter,/timeline\.kill\(\)/);assert.doesNotMatch(adapter,/ScrollTrigger|setInterval/);
assert.match(build,/'core\/28-game-stage-2_5d\.js',[\s\S]{0,100}'core\/29-replay-cinematic\.js'/);
assert.match(template,/\.replay-cinematic25d/);assert.match(template,/data-replay25d-state="playing"/);assert.match(template,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.replay-cinematic25d-layer\{animation:none!important/);assert.match(template,/@media\(forced-colors:active\)[\s\S]*\.replay-cinematic25d/);
assert.match(online,/online\._replaying=true;playerCount=replaySeats;showGame\(replay\.game\)/);
assert.match(online,/ReplayCinematic25D/);assert.match(online,/rebuildTo\(Math\.max/);assert.match(online,/setupAccessibleOverlayDialog\(bd,card,play/);
assert.match(roster,/const replayMode=!!\(online&&online\._replaying\)/);assert.match(roster,/onEnd\(\)\{\}, isReplaying:\(\)=>true, ai:new Set\(\)/);

function classList(){const set=new Set();return{add:n=>set.add(n),remove:n=>set.delete(n),contains:n=>set.has(n)}}
function node(){return{nodeType:1,dataset:{},classList:classList(),style:{values:{},setProperty(k,v){this.values[k]=String(v)}},children:[],isConnected:true,appendChild(child){child.parent=this;this.children.push(child);return child},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)},setAttribute(k,v){this[k]=String(v)}}}
function runtime(reduced=false){const stage=node(),area=node(),calls=[];const document={getElementById(id){return id==='screen-game'?stage:id==='board-area'?area:null},createElement(){return node()}};const context={console,document,matchMedia(){return{matches:reduced}},CameraSystem25D:{to(mode,request){calls.push([mode,request.focus]);return{}},settle(reason){calls.push(['settle',reason])}}};context.globalThis=context;vm.runInContext(source,vm.createContext(context));return{api:context.ReplayCinematic25D,stage,area,calls}}
const run=runtime(false);assert.strictEqual(run.api.begin({stage:run.stage,target:run.area,total:4}),true);assert.strictEqual(run.api.snapshot().state,'overview');assert.strictEqual(run.area.children.length,1);assert.strictEqual(run.area.children[0].children.length,3);assert.ok(run.calls.some(call=>call[0]==='overview'));assert.strictEqual(run.api.beat({index:2,total:4,target:run.area}),true);assert.strictEqual(run.api.snapshot().state,'playing');assert.strictEqual(run.area.children[0].style.values['--replay-progress'],'0.5');assert.strictEqual(run.calls.at(-1)[0],'focus');assert.strictEqual(run.api.pause({target:run.area}),true);assert.strictEqual(run.api.snapshot().state,'paused');assert.strictEqual(run.api.complete({target:run.area}),true);assert.strictEqual(run.api.snapshot().state,'result');assert.strictEqual(run.calls.at(-1)[0],'result');run.api.end('qa');assert.strictEqual(run.api.snapshot().state,'idle');assert.strictEqual(run.area.children.length,0);assert.ok(!run.stage.classList.contains('replay-cinematic-active'));
const reduced=runtime(true);reduced.api.begin({stage:reduced.stage,target:reduced.area,total:1});assert.strictEqual(reduced.api.snapshot().reducedMotion,true);reduced.api.destroy();assert.strictEqual(reduced.api.snapshot().destroyed,true);
for(const file of ['server/index.js','server/replay.js','shared/rules/tetris-rule-core.js']){if(fs.existsSync(path.join(ROOT,file)))assert.doesNotMatch(read(file),/ReplayCinematic25D|replay-cinematic25d/)}
assert.match(read('art-source/production/ghost-game-art-program-v1/P2-06_LOCAL_ACCEPTANCE.md'),/Replay facts remain authoritative/);
console.log('REPLAY_CINEMATIC_V1_ALL_PASS states=6 layers=3 fallback=static authority=unchanged');
