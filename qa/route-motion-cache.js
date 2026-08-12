#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');let failures=0,assertions=0;
function check(value,label){assertions+=1;if(value)console.log('PASS',label);else{failures+=1;console.error('FAIL',label);}}
check(/ghost-game-shell-v[5-9]-20260812/.test(sw),'route motion retains or advances the atomic cache revision');
const shell=(/const SHELL=\[([^;]+)\]/.exec(sw)||[])[1]||'';
check(!/route-motion-entry|CSSPlugin|gsap-core|vendor\/gsap/.test(shell),'DOM GSAP island is excluded from install shell');
check(/CACHEABLE_DESTINATIONS=new Set\(\['image','style','script','font','manifest'\]\)/.test(sw),'same-origin module scripts remain demand cached');
check(/privateRequest/.test(sw)&&/authorization/.test(sw)&&/api/.test(sw)&&/ws/.test(sw),'private request exclusions remain intact');
if(failures)process.exitCode=1;else console.log('ALL_PASS route-motion-cache assertions='+assertions);
