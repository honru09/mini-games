#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SOURCE = fs.readFileSync(path.join(__dirname, '../public/src/core/11-surface-motion.js'), 'utf8')
  .replace('import(ENTRY_URL)', '__importAdapter(ENTRY_URL)');

let failures = 0;
let assertions = 0;
function check(value, label) { assertions += 1; if (value) console.log('PASS', label); else { failures += 1; console.error('FAIL', label); } }
function node() { return { style:{ transform:'', opacity:'', visibility:'', willChange:'' } }; }

function harness(options = {}) {
  const listeners = {};
  const query = { matches:!!options.reduced, addEventListener(_name, fn){this.listener=fn;}, removeEventListener(){this.listener=null;} };
  const calls = { imports:0, runs:[], settles:[], disposes:0, kills:0 };
  const adapter = {
    run(request) { calls.runs.push(request); return { kill(){calls.kills += 1;} }; },
    settle(surface, reason) { calls.settles.push([surface, reason]); },
    dispose() { calls.disposes += 1; }
  };
  const document = {
    hidden:!!options.hidden,
    addEventListener(name, fn){listeners['document:'+name]=fn;},
    removeEventListener(name){delete listeners['document:'+name];}
  };
  const sandbox = {
    module:{exports:{}}, exports:{}, document, console, Promise, Object, Array, String, Set, Math,
    matchMedia(){return query;},
    addEventListener(name, fn){listeners[name]=fn;}, removeEventListener(name){delete listeners[name];},
    __importAdapter(){calls.imports += 1; return options.reject ? Promise.reject(new Error('offline')) : Promise.resolve({createSurfaceMotionAdapter(){return adapter;}});}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(SOURCE, sandbox, {filename:'11-surface-motion.js'});
  return { api:sandbox.module.exports, listeners, query, calls, document };
}

(async () => {
  const h = harness();
  check(JSON.stringify(Object.keys(h.api)) === JSON.stringify(['run','settle','dispose','snapshot']), 'bridge exposes the exact narrow Interface');
  const firstDone = [];
  const firstRequest = {surface:'direct-message',phase:'open',root:node(),panel:node(),onComplete:reason=>firstDone.push(reason)};
  const first = h.api.run(firstRequest);
  check(first.status === 'loading' && h.calls.imports === 1 && firstDone[0] === 'loading', 'first normal request settles synchronously and preheats once');
  await Promise.resolve(); await Promise.resolve();
  check(h.api.snapshot().available === true, 'lazy adapter becomes available without replaying the first phase');
  let completed = 0;
  const second = h.api.run({surface:'direct-message',phase:'thread',root:node(),panel:node(),from:node(),to:node(),onComplete(){completed += 1;}});
  check(second.status === 'animating' && h.calls.runs.length === 1, 'subsequent phase animates through the adapter');
  h.calls.runs[0].onComplete();
  check(completed === 1 && h.api.snapshot().status === 'idle', 'current adapter completion settles exactly once');

  const beforeSupersede = h.api.run({surface:'direct-message',phase:'thread',root:node(),panel:node(),onComplete(){completed += 10;}});
  const oldRequest = h.calls.runs.at(-1);
  const afterSupersede = h.api.run({surface:'direct-message',phase:'back',root:node(),panel:node(),onComplete(){completed += 100;}});
  oldRequest.onComplete();
  check(beforeSupersede.status === 'animating' && afterSupersede.status === 'animating' && h.calls.kills >= 1 && completed === 1,
    'generation last-wins ignores stale completion after supersede');
  h.api.settle('direct-message','manual');
  check(completed === 101 && h.api.snapshot().status === 'idle', 'explicit settle completes the current semantic phase once');

  const reduced = harness({reduced:true});
  const reducedResult = reduced.api.run({surface:'direct-message',phase:'open',root:node(),panel:node()});
  check(reducedResult.status === 'settled' && reduced.calls.imports === 0 && reduced.api.snapshot().reducedMotion, 'reduced motion stays static without loading GSAP');
  const hidden = harness({hidden:true});
  hidden.api.run({surface:'direct-message',phase:'open',root:node(),panel:node()});
  check(hidden.calls.imports === 0 && hidden.api.snapshot().hidden, 'hidden document stays static without loading GSAP');
  const shell = harness(); shell.listeners['ghostgame:shellchange']({detail:{active:true}});
  shell.api.run({surface:'direct-message',phase:'open',root:node(),panel:node()});
  check(shell.calls.imports === 0 && shell.api.snapshot().shellActive, 'Game Shell blocks overlay motion preheat');

  const failed = harness({reject:true});
  failed.api.run({surface:'direct-message',phase:'open',root:node(),panel:node()});
  await Promise.resolve(); await Promise.resolve();
  const failedAgain = failed.api.run({surface:'direct-message',phase:'open',root:node(),panel:node()});
  check(failed.api.snapshot().loaderFailed && failedAgain.status === 'settled' && failed.calls.imports === 1,
    'loader failure is sticky and never reports or retries perpetual loading');

  h.api.dispose('test'); h.api.dispose('again');
  check(h.api.snapshot().status === 'disposed' && h.calls.disposes === 1 && !h.listeners['ghostgame:shellchange'] && !h.listeners['document:visibilitychange'],
    'dispose is idempotent and removes lifecycle listeners');

  if (failures) process.exitCode = 1;
  else console.log('SURFACE_MOTION_RUNTIME_ALL_PASS assertions=' + assertions);
})().catch(error => { console.error(error); process.exitCode = 1; });
