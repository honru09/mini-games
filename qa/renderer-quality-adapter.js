'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = {};
root.globalThis = root;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/src/core/13-renderer-runtime-governor.js'), 'utf8'), root, {
  filename: '13-renderer-runtime-governor.js',
});
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/src/core/13-renderer-quality-adapter.js'), 'utf8'), root, {
  filename: '13-renderer-quality-adapter.js',
});

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL  ' + name + ' :: ' + error.message);
  }
}

check('quality adapter exposes the bounded presentation interface', () => {
  assert.deepStrictEqual(Object.keys(root.RendererQualityAdapter), ['create', 'QUALITY']);
  const instance = root.RendererQualityAdapter.create({ quality:'HIGH', onQuality:() => true });
  assert.deepStrictEqual(Object.keys(instance), [
    'mount', 'observeFrame', 'setQuality', 'environment', 'suspend', 'resume', 'contextLost', 'dispose', 'snapshot',
  ]);
});

check('slow animation frames downshift an active HIGH renderer', () => {
  const changes = [];
  const instance = root.RendererQualityAdapter.create({
    quality:'HIGH',
    policy:{ downgradeSamples:2, upgradeSamples:3, cooldownMs:0 },
    onQuality:quality => { changes.push(quality); return true; },
  });
  instance.mount();
  instance.observeFrame(0);
  instance.observeFrame(30);
  instance.observeFrame(60);
  assert.deepStrictEqual(changes, ['BALANCED']);
  assert.strictEqual(instance.snapshot().effectiveQuality, 'BALANCED');
  assert.strictEqual(instance.snapshot().governor.dprCap, 1.5);
});

check('the requested ceiling prevents an adaptive upgrade above BALANCED', () => {
  const changes = [];
  const instance = root.RendererQualityAdapter.create({
    quality:'BALANCED',
    policy:{ downgradeSamples:2, upgradeSamples:2, cooldownMs:0 },
    onQuality:quality => { changes.push(quality); return true; },
  });
  instance.mount();
  instance.observeFrame(0);
  instance.observeFrame(5);
  instance.observeFrame(10);
  instance.observeFrame(15);
  assert.deepStrictEqual(changes, []);
  assert.strictEqual(instance.snapshot().effectiveQuality, 'BALANCED');
  assert.strictEqual(instance.snapshot().recommendationsRejected, 0);
});

check('rejected recommendations are acknowledged without mutating game state', () => {
  const instance = root.RendererQualityAdapter.create({
    quality:'HIGH',
    policy:{ downgradeSamples:1, cooldownMs:0 },
    onQuality:() => false,
  });
  instance.mount();
  instance.observeFrame(0);
  const result = instance.observeFrame(30);
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'quality_rejected');
  assert.strictEqual(instance.snapshot().effectiveQuality, 'HIGH');
  assert.strictEqual(instance.snapshot().recommendationsRejected, 1);
});

check('LOW, reduced motion, suspend, context loss and dispose stop sampling', () => {
  const instance = root.RendererQualityAdapter.create({ quality:'HIGH', onQuality:() => true });
  instance.mount();
  instance.setQuality('LOW');
  assert.strictEqual(instance.observeFrame(0).reason, 'static_quality');
  instance.setQuality('BALANCED');
  instance.environment({ reducedMotion:true });
  assert.strictEqual(instance.observeFrame(30).reason, 'static_quality');
  instance.environment({ reducedMotion:false });
  instance.suspend();
  assert.strictEqual(instance.observeFrame(60).reason, 'inactive');
  instance.resume();
  instance.contextLost();
  assert.strictEqual(instance.observeFrame(90).reason, 'inactive');
  const disposed = instance.dispose();
  assert.strictEqual(disposed.disposed, true);
  assert.strictEqual(instance.observeFrame(120).reason, 'inactive');
});

check('all six Three entries are connected to the adapter and sample active loops', () => {
  for (const name of ['gomoku', 'ludo', 'monopoly', 'xiangqi', 'tetris', 'tank']) {
    const source = fs.readFileSync(path.join(__dirname, `../public/three/${name}-entry.js`), 'utf8');
    assert(source.includes('RendererQualityAdapter'), name + ' must create the shared adapter');
    assert(source.includes('observeRuntimeQuality(timestamp)'), name + ' must sample its active animation loop');
    assert(source.includes('runtimeQualityAdapter.dispose()'), name + ' must dispose the adapter');
  }
});

if (failures.length) {
  console.error('RENDERER_QUALITY_ADAPTER_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('RENDERER_QUALITY_ADAPTER_ALL_PASS');
}
