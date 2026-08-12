#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let assertions = 0;
function check(condition, label) { assertions += 1; if (condition) console.log('PASS', label); else { failures += 1; console.error('FAIL', label); } }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function hash(relative) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex').toUpperCase(); }

const expected = {
  'public/vendor/gsap/3.15.0/esm/index.js': ['070038235BA75EC2186D054EBD83AE94E6DE6A971F5D3F3D6CD1037551F94FAA', 664],
  'public/vendor/gsap/3.15.0/esm/CSSPlugin.js': ['41D061E8B0A2DDFDB647F8F85DA690EC6D19194403021ACCA7088926105FE6BD', 65156],
  'public/vendor/gsap/3.15.0/esm/gsap-core.js': ['83C4B6C0B020BEBA737B90896181560B76747342B0F7BAA5BA1B185A75F65B65', 171676]
};
Object.entries(expected).forEach(([file, [sha, bytes]]) => {
  check(fs.existsSync(path.join(ROOT, file)), file + ' exists');
  check(fs.statSync(path.join(ROOT, file)).size === bytes, file + ' byte length is pinned');
  check(hash(file) === sha, file + ' SHA-256 is pinned');
});
const entry = read('public/route-motion-entry.js');
const index = read('public/vendor/gsap/3.15.0/esm/index.js');
const css = read('public/vendor/gsap/3.15.0/esm/CSSPlugin.js');
check(/from '\.\/vendor\/gsap\/3\.15\.0\/esm\/index\.js'/.test(entry), 'route entry imports the local versioned index');
check(/from "\.\/gsap-core\.js"/.test(index) && /from "\.\/CSSPlugin\.js"/.test(index), 'index closes over core and CSSPlugin with relative imports');
check(/from "\.\/gsap-core\.js"/.test(css), 'CSSPlugin closes over core with a relative import');
check(/registerPlugin\(CSSPlugin\)/.test(index) && !/registerPlugin\(CSSPlugin\)/.test(entry), 'official index registers CSSPlugin exactly once before DOM tween use');
check(/export \{ gsapWithCSS as gsap/.test(index) && /export var CSSPlugin/.test(css), 'official DOM exports are present');
check(!/https?:\/\//.test(entry) && !/ScrollTrigger|ScrollSmoother|GSDevTools|SplitText/.test(entry + index), 'runtime graph has no CDN or unused plugin token');
check(!/CSSPlugin/.test(read('public/three/gomoku-entry.js')), 'Gomoku remains on its separate core-only graph');
if (failures) process.exitCode = 1; else console.log('ALL_PASS gsap-dom-esm-graph assertions=' + assertions);
