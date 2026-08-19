#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(ROOT, 'public/src/core/09-route-motion.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'public/src/core/02-app-shell.js'), 'utf8');
const roster = fs.readFileSync(path.join(ROOT, 'public/src/ui/07-roster.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public/index-template.html'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts/build.js'), 'utf8');
const entry = fs.readFileSync(path.join(ROOT, 'public/route-motion-entry.js'), 'utf8');
let failures = 0;
let assertions = 0;
function check(condition, label) { assertions += 1; if (condition) console.log('PASS', label); else { failures += 1; console.error('FAIL', label); } }

check(/'core\/09-route-motion\.js',[\s\S]*'core\/02-app-shell\.js'/.test(build), 'route motion bridge is concatenated before its sole app-shell caller');
check(/const commit=\(\)=>\{[\s\S]*ghostAppRoute = route;[\s\S]*ensureConnected\('route'\)[\s\S]*showHub\(\)[\s\S]*aria-current[\s\S]*silentHash[\s\S]*renderGhostHome[\s\S]*renderGhostProfile[\s\S]*Playline\.open[\s\S]*resetGhostHeroTimer/.test(shell), 'setAppRoute retains its route business side effects inside one commit closure');
check(/GhostRouteMotion\.transition\(\{from:fromRoute,to:route,commit/.test(shell) && /catch\(_error\)\{\}[\s\S]*commit\(\)/.test(shell), 'setAppRoute crosses one optional seam and keeps a synchronous failure fallback');
check(/function requireGhostAuth\(mode\)\{[\s\S]{0,220}GhostRouteMotion\.settle\('auth_required'\)/.test(shell), 'authentication gate cancels any finite route presentation before making the app inert');
check(/function completeLocalLogout\(showLogin\)\{[\s\S]{0,220}GhostRouteMotion\.settle\('logout'\)/.test(roster), 'local logout cancels route presentation before account and connection state reset');
check(/setAttribute\('aria-hidden','true'\)/.test(shell) && /setAttribute\('inert',''\)/.test(shell) && /node\.inert=true/.test(shell), 'route commit synchronizes hidden aria-hidden and inert');
check((template.match(/data-app-route="(?:games|playline|profile)" aria-hidden="true" inert/g) || []).length === 3, 'initial hidden routes are absent from the accessibility and interaction trees before shell init');
check((template.match(/data-route-motion-item/g) || []).length === 8, 'four routes expose only eight meaningful motion groups');
check(!/@keyframes ghostRouteIn/.test(template) && !/\.app-route\{animation:ghostRouteIn/.test(template), 'legacy unconditional route entrance no longer competes with the runtime');
check(/\.app-route\.route-motion-active\{will-change:transform,opacity\}/.test(template) && !/route-motion-entering\{(?:pointer-events|contain):/.test(template), 'template owns only compositing hints and never blocks or re-contains the committed target');
check(/const TRANSIENT_CLASSES/.test(bridge) && /clearInline/.test(bridge) && /willChange/.test(bridge), 'bridge explicitly settles transient classes and inline state');
check(/addLabel\('committed', 0\)/.test(entry) && /addLabel\('enter', 0\)/.test(entry) && /addLabel\('settled'/.test(entry), 'DOM adapter uses semantic committed enter and settled labels');
check(!/duration: 0\.12/.test(entry) && /duration: 0\.26/.test(entry) && /stagger: \{ amount: 0\.08/.test(entry), 'adapter stays within the frozen finite entrance budget without delaying commit');
check(!/(?:width|height|top|left|margin|padding)\s*:/.test(entry), 'adapter does not animate layout properties');
check(/\{ y: 12, opacity: 0\.15 \}/.test(entry) && !/\{ y: 12, autoAlpha: 0 \}/.test(entry), 'interactive child groups remain visible and focusable throughout entrance');
check(!/ScrollTrigger|ScrollSmoother|GSDevTools|requestAnimationFrame|setInterval/.test(entry + bridge), 'route motion has no scroll plugin, debug tool, frame loop, or interval');
check(/slice\(0, 11\)/.test(entry), 'adapter caps semantic child targets before adding the route root');
check(/context\.add\(buildTimeline\)/.test(entry) && /\.revert\(\)/.test(entry) && /ownedTimeline\.kill\(\)/.test(entry), 'adapter creates work inside its context and each handle kills only its owned timeline');

if (failures) process.exitCode = 1; else console.log('ALL_PASS ui-route-motion-contract assertions=' + assertions);
