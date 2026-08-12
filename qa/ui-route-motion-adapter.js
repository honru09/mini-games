#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../public/route-motion-entry.js'), 'utf8')
  .replace("import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';", 'const { gsap, CSSPlugin } = __GSAP_MODULE__;')
  .replace('export const VERSIONS', 'const VERSIONS')
  .replace('export function createRouteMotionAdapter', 'function createRouteMotionAdapter')
  .concat('\nmodule.exports={VERSIONS,createRouteMotionAdapter};');
let failures = 0;
let assertions = 0;
function check(condition, label) { assertions += 1; if (condition) console.log('PASS', label); else { failures += 1; console.error('FAIL', label); } }
function classList() { const set = new Set(); return { add(...v){v.forEach(x=>set.add(x));}, remove(...v){v.forEach(x=>set.delete(x));}, contains(v){return set.has(v);} }; }
function node(children=[]) { return { style:{}, classList:classList(), querySelectorAll(){return children;} }; }
const calls = { registered:0, contexts:0, reverts:0, sets:[], timelines:[] };
function timeline(options) {
  const value = {
    options, labels:[], steps:[], killed:0,
    addLabel(name, at){this.labels.push([name,at]);return this;},
    to(target, vars, at){this.steps.push(['to',target,vars,at]);return this;},
    call(fn,_params,at){this.steps.push(['call',fn,at]);return this;},
    fromTo(target,from,to,at){this.steps.push(['fromTo',target,from,to,at]);return this;},
    kill(){this.killed+=1;}
  };
  calls.timelines.push(value); return value;
}
const gsap = {
  registerPlugin(plugin){if(plugin)calls.registered+=1;},
  context(){calls.contexts+=1;return {add(fn){fn();},revert(){calls.reverts+=1;}};},
  set(targets,vars){calls.sets.push([targets,vars]);}, timeline
};
const moduleValue = { exports:{} };
vm.runInNewContext(source, {module:moduleValue,exports:moduleValue.exports,__GSAP_MODULE__:{gsap,CSSPlugin:{name:'css'}},Object,Array,String,Math,Error}, {filename:'route-motion-entry.js'});
const api = moduleValue.exports;
check(Object.isFrozen(api.VERSIONS) && api.VERSIONS.gsap === '3.15.0', 'adapter freezes its version contract');
const from = node(), items=[node(),node(),node()], to=node(items), root={querySelector(){return to;},querySelectorAll(){return [];}};
const adapter=api.createRouteMotionAdapter({root,targetSelector:'[data-route-motion-item]'});
check(Object.isFrozen(adapter) && JSON.stringify(Object.keys(adapter))===JSON.stringify(['run','settle','dispose']), 'adapter exposes the exact private renderer Interface');
check(calls.registered===0 && calls.contexts===1, 'official index owns plugin registration while the adapter owns one local context');
let completes=0;
const handle=adapter.run({from:'home',to:'games',toNode:to,direction:1,onComplete(){completes+=1;}});
const tl=calls.timelines[0];
check(tl.labels.map(v=>v[0]).join(',')==='committed,enter,settled', 'normal route timeline has semantic labels');
check(tl.steps.filter(v=>v[0]==='to').length===0 && tl.steps.filter(v=>v[0]==='fromTo').length===2, 'normal route timeline contains only two coordinated target entrance layers');
check(to.classList.contains('route-motion-entering'), 'already-committed target immediately owns entrance presentation');
tl.options.onComplete();
check(completes===1 && !to.classList.contains('route-motion-entering'), 'completion settles classes before notifying the bridge');
handle.kill('late');
const cancelHandle=adapter.run({from:'games',to:'profile',toNode:to,direction:1,onComplete(){}});
const cancelTl=calls.timelines.at(-1);cancelHandle.kill('superseded');
check(cancelTl.killed===1 && calls.sets.length>=2, 'external kill terminates an active timeline and clears its target route');
const newerHandle=adapter.run({from:'profile',to:'home',toNode:to,direction:-1,onComplete(){}});
const newerTl=calls.timelines.at(-1);cancelHandle.kill('stale_handle');
check(newerTl.killed===0, 'a stale handle cannot kill a newer route timeline');
newerHandle.kill('cleanup');
adapter.dispose('test'); adapter.dispose('again');
check(calls.reverts===1, 'dispose is idempotent and reverts the local GSAP context exactly once');

check(tl.steps.every(v=>v[0]!=='call'), 'adapter cannot own or delay route business commit');

if (failures) process.exitCode=1; else console.log('ALL_PASS ui-route-motion-adapter assertions='+assertions);
