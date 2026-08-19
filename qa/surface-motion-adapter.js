#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SOURCE = fs.readFileSync(path.join(__dirname, '../public/surface-motion-entry.js'), 'utf8')
  .replace("import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';", 'const {gsap,CSSPlugin}=__GSAP_MODULE__;')
  .replace('export const VERSIONS', 'const VERSIONS')
  .replace('export function createSurfaceMotionAdapter', 'function createSurfaceMotionAdapter')
  .concat('\nmodule.exports={VERSIONS,createSurfaceMotionAdapter};');

let failures=0, assertions=0;
function check(value,label){assertions+=1;if(value)console.log('PASS',label);else{failures+=1;console.error('FAIL',label);}}
function node(){return{style:{}};}
const calls={sets:[],timelines:[],contexts:0,reverts:0};
function timeline(options){const tl={options,labels:[],steps:[],killed:0,addLabel(name,at){this.labels.push([name,at]);return this;},fromTo(target,from,to,at){this.steps.push(['fromTo',target,from,to,at]);return this;},to(target,vars,at){this.steps.push(['to',target,vars,at]);return this;},kill(){this.killed+=1;}};calls.timelines.push(tl);return tl;}
const gsap={set(targets,vars){calls.sets.push([targets,vars]);},timeline,context(fn){calls.contexts+=1;fn();return{revert(){calls.reverts+=1;}};}};
const moduleValue={exports:{}};
vm.runInNewContext(SOURCE,{module:moduleValue,exports:moduleValue.exports,__GSAP_MODULE__:{gsap,CSSPlugin:{}},Object,Array,String,Set,Error},{filename:'surface-motion-entry.js'});
const api=moduleValue.exports;
check(Object.isFrozen(api.VERSIONS)&&api.VERSIONS.gsap==='3.15.0','adapter freezes its version contract');
const adapter=api.createSurfaceMotionAdapter();
check(Object.isFrozen(adapter)&&JSON.stringify(Object.keys(adapter))===JSON.stringify(['run','settle','dispose']),'adapter exposes the exact private Interface');
const root=node(),panel=node(),from=node(),to=node(),itemA=node(),itemB=node();let complete=0;
const open=adapter.run({surface:'direct-message',phase:'open',root,panel,onComplete(){complete+=1;}});const openTl=calls.timelines.at(-1);
check(openTl.labels.map(item=>item[0]).join(',')==='committed,settled'&&openTl.steps.length===2,'open uses one labelled two-layer timeline');
check(openTl.steps.every(step=>!['width','height','top','left'].some(key=>Object.prototype.hasOwnProperty.call(step[step[0]==='to'?2:3]||{},key))),'open timeline uses no layout property');
openTl.options.onComplete();check(complete===1&&calls.sets.length>=1,'completion clears inline state before notifying bridge');
adapter.run({surface:'direct-message',phase:'thread',root,panel,from,to});const threadTl=calls.timelines.at(-1);
check(threadTl.steps.some(step=>step[0]==='fromTo'&&step[1]===to),'thread phase brings the committed target into view');
const outcomeItems=[itemA,itemB];
const outcome=adapter.run({surface:'victory-dialog',phase:'open',root,panel,items:outcomeItems});const outcomeTl=calls.timelines.at(-1);
const isOutcomeTarget=target=>Array.isArray(target)&&target.length===2&&target[0]===itemA&&target[1]===itemB;
check(outcomeTl.steps.some(step=>step[0]==='fromTo'&&isOutcomeTarget(step[1])&&step[3].stagger&&
  step[2].y===10&&step[2].autoAlpha===0&&step[3].y===0&&step[3].autoAlpha===1),
  'dialog outcome items enter through one finite staggered transform and autoAlpha step');
const closeWithItems=adapter.run({surface:'reward-dialog',phase:'close',root,panel,items:outcomeItems});const closeItemsTl=calls.timelines.at(-1);
check(closeItemsTl.steps.some(step=>step[0]==='to'&&isOutcomeTarget(step[1])&&step[2].stagger&&
  step[2].y===6&&step[2].autoAlpha===0),
  'dialog outcome items leave through one finite reverse stagger step');
check(calls.sets.at(-1)[0].includes(itemA)&&calls.sets.at(-1)[0].includes(itemB),
  'superseding an item timeline clears its complete unique node set');
const closeHandle=adapter.run({surface:'direct-message',phase:'close',root,panel});const closeTl=calls.timelines.at(-1);closeHandle.kill();
check(closeTl.killed===1&&calls.sets.length>=2,'external kill owns its finite timeline and cleanup');
adapter.dispose('test');adapter.dispose('again');
check(calls.reverts>=1,'dispose reverts the active GSAP context');
check(!/ScrollTrigger|requestAnimationFrame|setInterval/.test(SOURCE),'adapter has no scroll plugin or persistent loop');
if(failures)process.exitCode=1;else console.log('SURFACE_MOTION_ADAPTER_ALL_PASS assertions='+assertions);
