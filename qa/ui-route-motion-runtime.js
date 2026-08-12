#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SOURCE = fs.readFileSync(path.join(__dirname, '../public/src/core/09-route-motion.js'), 'utf8');
let failed = 0;
let assertions = 0;
function check(condition, label) { assertions += 1; if (condition) console.log('PASS', label); else { failed += 1; console.error('FAIL', label); } }

function makeClassList(initial) {
  const values = new Set(initial || []);
  return { add(...names) { names.forEach(name => values.add(name)); }, remove(...names) { names.forEach(name => values.delete(name)); }, contains(name) { return values.has(name); } };
}
function makeNode(route) {
  const attrs = { 'data-app-route': route };
  return {
    inert: false, style: {}, classList: makeClassList(route === 'home' ? [] : ['hidden']), children: [],
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
    setAttribute(name, value) { attrs[name] = String(value); }, removeAttribute(name) { delete attrs[name]; },
    querySelectorAll() { return this.children; }
  };
}
function makeHarness(options = {}) {
  const routes = ['home', 'games', 'playline', 'profile'].map(makeNode);
  const listeners = {};
  const query = { matches: !!options.reduced, addEventListener(_name, fn) { this.fn = fn; }, removeEventListener() { this.fn = null; } };
  const document = {
    hidden: !!options.hidden,
    querySelectorAll(selector) { return selector === '[data-app-route]' ? routes : []; },
    querySelector(selector) { return selector === '#screen-hub' ? { querySelectorAll() { return []; } } : null; },
    addEventListener(name, fn) { listeners['document:' + name] = fn; }, removeEventListener(name) { delete listeners['document:' + name]; }
  };
  const sandbox = {
    module: { exports: {} }, exports: {}, document, matchMedia() { return query; },
    addEventListener(name, fn) { listeners[name] = fn; }, removeEventListener(name) { delete listeners[name]; },
    console, Promise, Object, Array, String, Math, Set
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(SOURCE, sandbox, { filename: '09-route-motion.js' });
  return { api: sandbox.module.exports, routes, listeners, document, query };
}

const h = makeHarness();
check(JSON.stringify(Object.keys(h.api)) === JSON.stringify(['transition','settle','dispose','snapshot']), 'module exposes the exact narrow Interface');
let commits = 0;
const first = h.api.transition({ from:null, to:'home', commit() { commits += 1; } });
check(commits === 1 && first.status === 'settled', 'initial route commits synchronously without loading motion');
check(!h.routes[0].classList.contains('hidden') && h.routes.slice(1).every(node => node.classList.contains('hidden') && node.inert), 'initial route aligns hidden aria and inert state');
const same = h.api.transition({ from:'home', to:'home', commit() { commits += 1; } });
check(commits === 2 && same.status === 'settled' && h.api.snapshot().status === 'idle', 'same route is a synchronous static refresh');
check(/commitOnce\(\);\s*if \(adapter\)/.test(SOURCE), 'normal motion also commits synchronously before consulting the adapter');
check(!/\.then\(runtime =>/.test(SOURCE), 'a first lazy load does not replay an entrance after the page is already visible');

const reduced = makeHarness({ reduced:true });
let reducedCommits = 0;
const reducedResult = reduced.api.transition({ from:'home', to:'games', commit() { reducedCommits += 1; } });
check(reducedCommits === 1 && reducedResult.status === 'settled' && reduced.routes[1].inert === false, 'reduced motion commits directly to a stable interactive target');
check(reduced.api.snapshot().reducedMotion === true && reduced.api.snapshot().loading === false, 'reduced motion never starts the lazy loader');

const hidden = makeHarness({ hidden:true });
let hiddenCommits = 0;
hidden.api.transition({ from:'home', to:'profile', commit() { hiddenCommits += 1; } });
check(hiddenCommits === 1 && hidden.api.snapshot().hidden && !hidden.api.snapshot().loading, 'hidden document settles without lazy work');

const shell = makeHarness();
shell.listeners['ghostgame:shellchange']({ detail:{ active:true } });
let shellCommits = 0;
shell.api.transition({ from:'home', to:'playline', commit() { shellCommits += 1; } });
check(shellCommits === 1 && shell.api.snapshot().shellActive && !shell.api.snapshot().loading, 'Game Shell active forces static route settlement');

h.routes[0].style.transform = 'translateX(9px)'; h.routes[0].style.opacity = '0.4'; h.routes[0].style.willChange = 'transform';
h.api.settle('test');
check(h.routes[0].style.transform === '' && h.routes[0].style.opacity === '' && h.routes[0].style.willChange === '', 'settle removes transient inline motion state');
h.api.dispose('test');
check(h.api.snapshot().status === 'disposed' && !h.listeners['ghostgame:shellchange'] && !h.listeners['document:visibilitychange'], 'dispose is terminal and removes lifecycle listeners');
let afterDispose = 0;
h.api.transition({ from:'home', to:'games', commit() { afterDispose += 1; } });
check(afterDispose === 1 && h.routes[1].inert === false, 'disposed runtime preserves synchronous navigation fallback');

check(!/ScrollTrigger|ScrollSmoother|requestAnimationFrame|setInterval/.test(SOURCE), 'bridge has no scroll plugin or persistent frame/timer loop');
check(/generation/.test(SOURCE) && /requestGeneration !== generation/.test(SOURCE), 'async callbacks are protected by generation');
check(/loaderPromise/.test(SOURCE) && /if \(loaderPromise\) return loaderPromise/.test(SOURCE), 'lazy import is deduplicated by one promise');
check(/loaderFailed = true/.test(SOURCE) && /!loaderFailed/.test(SOURCE), 'loader failure is sticky and falls back without repeated imports');

if (failed) process.exitCode = 1; else console.log('ALL_PASS ui-route-motion-runtime assertions=' + assertions);
