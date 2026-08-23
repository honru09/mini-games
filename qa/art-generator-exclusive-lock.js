'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const helperPath = path.join(ROOT, 'scripts', 'art-generator-lock.js');
const lockRoot = path.join(ROOT, '.tmp', 'qa-art-generator-lock');
const lockPath = path.join(lockRoot, 'exclusive.lock');

fs.rmSync(lockRoot, { recursive: true, force: true });
fs.mkdirSync(lockRoot, { recursive: true });

const { acquireArtGeneratorLock } = require(helperPath);
const { acquireArtRegistryLock } = require(helperPath);
const release = acquireArtGeneratorLock(lockPath, { generatorId: 'qa-owner' });

const contender = spawnSync(process.execPath, [
  '-e',
  `const { acquireArtGeneratorLock } = require(${JSON.stringify(helperPath)}); acquireArtGeneratorLock(${JSON.stringify(lockPath)}, { generatorId: 'qa-contender' });`,
], { encoding: 'utf8' });

assert.notStrictEqual(contender.status, 0, 'a concurrent generator must not acquire the same lock');
assert.match(`${contender.stderr}\n${contender.stdout}`, /ART_GENERATOR_LOCKED/, 'collision must be explicit');

release();

const releaseAfterOwner = acquireArtGeneratorLock(lockPath, { generatorId: 'qa-after-owner' });
releaseAfterOwner();

fs.writeFileSync(lockPath, `${JSON.stringify({ pid: 2147483647, generatorId: 'stale-owner' })}\n`);
const releaseAfterStale = acquireArtGeneratorLock(lockPath, { generatorId: 'qa-after-stale' });
releaseAfterStale();

assert.strictEqual(fs.existsSync(lockPath), false, 'released generator lock must not remain on disk');

async function verifyBoundedReaderWait(){
  const holder = spawn(process.execPath, [
    '-e',
    `const { acquireArtGeneratorLock } = require(${JSON.stringify(helperPath)}); const release=acquireArtGeneratorLock(${JSON.stringify(lockPath)}, { generatorId:'qa-delayed-holder' }); console.log('LOCKED'); setTimeout(()=>{release();},350);`,
  ], { encoding:'utf8', stdio:['ignore','pipe','pipe'] });
  const holderExit=new Promise((resolve,reject)=>{holder.once('exit',code=>code===0?resolve():reject(new Error('delayed lock holder exited '+code)));holder.once('error',reject);});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('delayed lock holder did not become ready')),2000);
    holder.once('error',reject);
    holder.stdout.once('data',chunk=>{if(String(chunk).includes('LOCKED')){clearTimeout(timeout);resolve();}});
  });
  const started=Date.now();
  const releaseAfterWait=acquireArtGeneratorLock(lockPath,{generatorId:'qa-bounded-reader',waitMs:2000,pollMs:20});
  const elapsed=Date.now()-started;
releaseAfterWait();
  assert.ok(elapsed>=200,'a bounded reader must wait for the active generator instead of reading a partial tree');
  await holderExit;
}

function verifySharedRegistryLock(){
  const registryRoot=path.join(lockRoot,'registry-root');
  const first=acquireArtRegistryLock(registryRoot,{generatorId:'qa-registry-owner'});
  const contender=spawnSync(process.execPath,[
    '-e',
    `const { acquireArtRegistryLock } = require(${JSON.stringify(helperPath)}); acquireArtRegistryLock(${JSON.stringify(registryRoot)}, { generatorId: 'qa-registry-contender', waitMs:0 });`,
  ],{encoding:'utf8'});
  assert.notStrictEqual(contender.status,0,'registry writers must share one cross-family lock');
  assert.match(`${contender.stderr}\n${contender.stdout}`,/ART_GENERATOR_LOCKED/);
  first();
}

for (const relative of ['scripts/generate-player-character-layered-v1.js','scripts/generate-avatar-frame-effect-v1.js','scripts/generate-game-icon-system-v2.js']){
  const source=fs.readFileSync(path.join(ROOT,relative),'utf8');
  assert.match(source,/acquireArtRegistryLock/,'generator must guard global Manifest/Catalog writes: '+relative);
}

verifyBoundedReaderWait().then(()=>{
  verifySharedRegistryLock();
  assert.strictEqual(fs.existsSync(lockPath), false, 'bounded reader must release the shared family lock');
  fs.rmSync(lockRoot, { recursive: true, force: true, maxRetries:20, retryDelay:50 });
  console.log('art generator exclusive lock QA passed');
}).catch(error=>{
  console.error(error&&error.stack||error);
  process.exitCode=1;
  setTimeout(()=>{try{fs.rmSync(lockRoot,{recursive:true,force:true,maxRetries:20,retryDelay:50});}catch(_){}},500);
});
