'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const profile = require(path.join(ROOT, 'public', 'src', 'core', '13-renderer-device-profile.js'));
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log('PASS', name);
}

function runtime(userAgent, options = {}) {
  return {
    devicePixelRatio: options.dpr ?? 1,
    innerWidth: options.width ?? 1440,
    innerHeight: options.height ?? 900,
    navigator: {
      userAgent,
      platform: options.platform || 'Win32',
      maxTouchPoints: options.touch ?? 0,
      hardwareConcurrency: options.cores,
      deviceMemory: options.memory
    }
  };
}

check('desktop HIGH preserves DPR 2, antialiasing, shadows and high-performance preference', () => {
  const result = profile.evaluate('HIGH', runtime('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151 Safari/537.36', {
    dpr: 2.5, cores: 12, memory: 16
  }));
  assert.strictEqual(result.profile.family, 'DESKTOP');
  assert.strictEqual(result.pixelRatio, 2);
  assert.strictEqual(result.antialias, true);
  assert.strictEqual(result.shadowEnabled, true);
  assert.strictEqual(result.shadowMapSize, 1024);
  assert.strictEqual(result.powerPreference, 'high-performance');
});

check('simulated Android caps BALANCED DPR and selects low-power GPU', () => {
  const result = profile.evaluate('BALANCED', runtime('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/151 Mobile Safari/537.36', {
    dpr: 3, width: 360, height: 800, touch: 5, cores: 8, memory: 8, platform: 'Linux armv8l'
  }));
  assert.strictEqual(result.profile.family, 'MOBILE');
  assert.strictEqual(result.pixelRatio, 1.25);
  assert.strictEqual(result.antialias, false);
  assert.strictEqual(result.shadowEnabled, false);
  assert.strictEqual(result.powerPreference, 'low-power');
});

check('simulated iPhone HIGH keeps bounded 1.5 DPR and 512 shadow map', () => {
  const result = profile.evaluate('HIGH', runtime('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1', {
    dpr: 3, width: 390, height: 844, touch: 5, cores: 6, platform: 'iPhone'
  }));
  assert.strictEqual(result.profile.family, 'MOBILE');
  assert.strictEqual(result.pixelRatio, 1.5);
  assert.strictEqual(result.shadowEnabled, true);
  assert.strictEqual(result.shadowMapSize, 512);
  assert.strictEqual(result.antialias, false);
});

check('touch MacIntel is classified as iPad-style tablet', () => {
  const result = profile.evaluate('BALANCED', runtime('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15', {
    dpr: 2, width: 768, height: 1024, touch: 5, cores: 8, platform: 'MacIntel'
  }));
  assert.strictEqual(result.profile.family, 'TABLET');
  assert.strictEqual(result.profile.tablet, true);
  assert.strictEqual(result.pixelRatio, 1.25);
});

check('low-end desktop disables shadows and targets a 30fps thermal proxy budget', () => {
  const result = profile.evaluate('HIGH', runtime('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151 Safari/537.36', {
    dpr: 2, cores: 4, memory: 4
  }));
  assert.strictEqual(result.profile.lowEnd, true);
  assert.strictEqual(result.pixelRatio, 1.5);
  assert.strictEqual(result.shadowEnabled, false);
  assert.strictEqual(result.frameBudgetMs, 33.34);
  assert.strictEqual(result.thermalProxyOnly, true);
});

check('LOW is a hard DPR 1, no-AA, no-shadow policy on every profile', () => {
  const result = profile.evaluate('LOW', runtime('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', { dpr: 4, cores: 16, memory: 32 }));
  assert.strictEqual(result.pixelRatio, 1);
  assert.strictEqual(result.antialias, false);
  assert.strictEqual(result.shadowEnabled, false);
});

check('hostile capability getters fail closed without throwing', () => {
  const source = { navigator:{} };
  Object.defineProperty(source, 'devicePixelRatio', { get() { throw new Error('blocked'); } });
  Object.defineProperty(source.navigator, 'userAgent', { get() { throw new Error('blocked'); } });
  const result = profile.evaluate('BALANCED', source);
  assert.strictEqual(result.profile.family, 'DESKTOP');
  assert.strictEqual(result.pixelRatio, 1);
});

check('all six Renderer islands consume the shared device policy', () => {
  for (const game of ['gomoku','ludo','monopoly','xiangqi','tetris','tank']) {
    const source = fs.readFileSync(path.join(ROOT, 'public', 'three', `${game}-entry.js`), 'utf8');
    assert(source.includes('RendererDeviceProfile'), `${game} must read the shared profile`);
    assert(source.includes('rendererPowerPreference(quality)'), `${game} must apply the power preference`);
    assert(source.includes('rendererAntialias(quality)'), `${game} must apply the AA policy`);
    assert(source.includes('rendererShadowPolicy(quality)'), `${game} must apply the shadow policy`);
  }
});

check('build order installs the profile before the quality adapter and game callers', () => {
  const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');
  const profileIndex = build.indexOf("'core/13-renderer-device-profile.js'");
  const qualityIndex = build.indexOf("'core/13-renderer-quality-adapter.js'");
  const gameIndex = build.indexOf("'games/gomoku.js'");
  assert(profileIndex >= 0 && profileIndex < qualityIndex && qualityIndex < gameIndex);
});

console.log(`RENDERER_DEVICE_PROFILE_ALL_PASS checks=${passed}`);
