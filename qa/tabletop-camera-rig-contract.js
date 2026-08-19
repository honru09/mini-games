'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const ROOT=path.join(__dirname,'..');
const MODULE='public/src/games/00-tabletop-camera-rig.js';
const source=fs.readFileSync(path.join(ROOT,MODULE),'utf8');
const build=fs.readFileSync(path.join(ROOT,'scripts/build.js'),'utf8');
const sandbox={globalThis:{},Object,Array,Set,Number,String,Math};
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:MODULE});
const rig=sandbox.globalThis.TabletopCameraRig;

assert.ok(rig&&Object.isFrozen(rig),'camera rig exports one frozen global Interface');
assert.deepStrictEqual(Array.from(rig.MODES),['overview','entrance','turn-focus','action-follow','impact','result','spectator','portrait'],
  'camera vocabulary remains explicit and bounded');
assert.strictEqual(rig.profile('gomoku').projection,'perspective');
assert.strictEqual(rig.profile('tank').projection,'orthographic');
assert.deepStrictEqual(JSON.parse(JSON.stringify(rig.profile('gomoku').camera)),{x:0,y:15.5,z:14.5},
  'Gomoku profile preserves the proven overview pose');
assert.strictEqual(rig.modeForEvent({type:'piece_placed'}),'action-follow');
assert.strictEqual(rig.modeForEvent({type:'winning_line'}),'result');
assert.strictEqual(rig.modeForEvent({type:'piece_locked'}),'impact');

const high=rig.plan('gomoku','action-follow',{x:4,y:0,z:-3},{quality:'HIGH',reducedMotion:false});
const balanced=rig.plan('gomoku','action-follow',{x:4,y:0,z:-3},{quality:'BALANCED',reducedMotion:false});
const low=rig.plan('gomoku','action-follow',{x:4,y:0,z:-3},{quality:'LOW',reducedMotion:false});
const reduced=rig.plan('gomoku','result',{x:1,y:0,z:2},{quality:'HIGH',reducedMotion:true});
assert.ok(Object.isFrozen(high)&&Object.isFrozen(high.camera)&&Object.isFrozen(high.aim)&&Object.isFrozen(high.target),
  'plans and nested poses are immutable');
assert.ok(high.duration>balanced.duration&&balanced.duration>0,'BALANCED shortens rather than duplicates the HIGH beat');
const overview=rig.plan('ludo','overview',{x:99,y:99,z:99},{quality:'HIGH',reducedMotion:false});
assert.deepStrictEqual(JSON.parse(JSON.stringify(overview.camera)),{x:0,y:16.4,z:14.8},
  'overview returns the game profile base camera instead of inheriting an action target');
assert.ok(overview.duration>0&&overview.animated,'overview can restore a finite renderer-local camera timeline');
assert.strictEqual(low.duration,0,'LOW settles camera motion immediately');
assert.strictEqual(low.animated,false,'LOW reports a static pose');
assert.strictEqual(reduced.duration,0,'reduced motion keeps the result pose but removes travel');
assert.strictEqual(reduced.mode,'result');
assert.ok(Object.values(high.camera).every(Number.isFinite)&&Object.values(high.aim).every(Number.isFinite),
  'camera plans expose finite numeric poses only');
const hostile=rig.plan('__proto__','portrait',{x:Infinity,y:'bad',z:NaN},{quality:'???'});
assert.strictEqual(hostile.gameId,'tabletop');
assert.ok(Object.values(hostile.camera).every(Number.isFinite)&&Object.values(hostile.aim).every(Number.isFinite),
  'unknown profiles and malformed targets fail into the generic finite plan');

const perspectiveIndex=build.indexOf("'games/00-tabletop-perspective.js'");
const rigIndex=build.indexOf("'games/00-tabletop-camera-rig.js'");
const loaderIndex=build.indexOf("'core/14-game-module-loader.js'");
const gomokuIndex=build.indexOf("'games/gomoku.js'");
assert.ok(perspectiveIndex>=0&&rigIndex>perspectiveIndex&&rigIndex<loaderIndex&&rigIndex<gomokuIndex,
  'the pure camera vocabulary loads before optional renderer callers');
assert.ok(!/\bTHREE\b|\bgsap\b|ScrollTrigger|document\.|window\.|reward|Replay|WebSocket|Supabase/.test(source),
  'camera planning stays renderer-agnostic and outside rule/network/economy ownership');

console.log('TABLETOP_CAMERA_RIG_CONTRACT_ALL_PASS');
