'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const failures = [];

function check(name, condition, detail) {
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (!condition && detail ? ' :: ' + detail : ''));
  if (!condition) failures.push(name);
}

function harness() {
  const values = new Map();
  let manifest = JSON.parse(JSON.stringify(MANIFEST));
  let fetchCount = 0;
  const localStorage = {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
  const context = vm.createContext({
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object, Math, Promise,
    localStorage,
    fetch: async () => { fetchCount++; return { ok:true, json:async () => manifest }; },
  });
  vm.runInContext(ASSETS, context, { filename:'06-assets.js' });
  return {
    context,
    localStorage,
    fetchCount: () => fetchCount,
    resetManifest(value) {
      manifest = JSON.parse(JSON.stringify(value));
      vm.runInContext('runtimeAssetManifestPromise=null', context);
    },
    resolve(id, forThrow) {
      context.__emojiId = id;
      context.__forThrow = !!forThrow;
      return vm.runInContext('resolveHonruEmojiCell(__emojiId,__forThrow)', context);
    },
    enabled() { return vm.runInContext('honruEmojiEnabled()', context); },
    throwEnabled() { return vm.runInContext('honruEmojiThrowEnabled()', context); },
  };
}

async function run() {
  const runtime = harness();
  check('Emoji 所有者清除旗标缺失时默认开启', runtime.enabled() === true && runtime.throwEnabled() === true);
  runtime.localStorage.setItem('mg_art_honru_emoji_v1', '0');
  check('Emoji 总 kill switch 关闭选择器与投掷资产', runtime.enabled() === false && runtime.throwEnabled() === false && await runtime.resolve('emoji_wave', false) === null);
  runtime.localStorage.setItem('mg_art_honru_emoji_v1', '1');
  runtime.localStorage.setItem('mg_art_honru_emoji_throw_v1', '0');
  const staticCell = await runtime.resolve('emoji_wave', false);
  check('投掷 kill switch 不关闭静态选择器与气泡', !!staticCell && runtime.enabled() === true && runtime.throwEnabled() === false);
  check('投掷 kill switch 拒绝飞行资产解析', await runtime.resolve('emoji_wave', true) === null);
  runtime.localStorage.setItem('mg_art_honru_emoji_throw_v1', '1');

  const wave = await runtime.resolve('emoji_wave', true);
  const game = await runtime.resolve('emoji_game', false);
  check('合法 cell 只返回本地版本化 atlas 与冻结几何', wave && wave.url === 'assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp' && wave.x === 0 && wave.y === 0 && wave.width === 256 && wave.height === 256 && wave.atlasWidth === 1024 && wave.atlasHeight === 768 && wave.fallback === '👋', JSON.stringify(wave));
  check('末个稳定 Emoji 保持 row-major cell 与 Unicode fallback', game && game.x === 256 && game.y === 512 && game.fallback === '🎮', JSON.stringify(game));
  check('Manifest 单飞缓存避免每个 cell 重取', runtime.fetchCount() === 1, String(runtime.fetchCount()));
  check('未知/越界表达 ID fail-closed', await runtime.resolve('../emoji_wave', false) === null && await runtime.resolve('emoji_surrender', false) === null);

  const traversal = JSON.parse(JSON.stringify(MANIFEST));
  traversal.assets.find(item => item.asset_id === 'P-HONRU-EMOJI-V1').runtime_path = 'public/assets/brand/honru/emoji-v1/../../secret.webp';
  runtime.resetManifest(traversal);
  check('Manifest 路径替换不能逃逸 Emoji allowlist', await runtime.resolve('emoji_wave', false) === null);

  const wrongClearance = JSON.parse(JSON.stringify(MANIFEST));
  wrongClearance.assets.find(item => item.asset_id === 'P-HONRU-EMOJI-V1').clearance = 'TECHNICAL_PASS';
  runtime.resetManifest(wrongClearance);
  check('只有 OWNER_AUTHORIZED_ART_CLEARANCE 可进入 runtime', await runtime.resolve('emoji_wave', false) === null);

  const malformed = JSON.parse(JSON.stringify(MANIFEST));
  malformed.assets.find(item => item.asset_id === 'P-HONRU-EMOJI-V1').cells.emoji_wave.x = 900;
  runtime.resetManifest(malformed);
  check('越界 atlas cell fail-closed', await runtime.resolve('emoji_wave', false) === null);

  runtime.context.localStorage = { getItem() { throw new Error('blocked storage'); } };
  check('localStorage 异常时图片与投掷均 fail-closed', runtime.enabled() === false && runtime.throwEnabled() === false);

  if (failures.length) {
    console.error('HONRU_EMOJI_RUNTIME_FAILURES=' + failures.length + ' :: ' + failures.join('、'));
    process.exitCode = 1;
  } else {
    console.log('HONRU_EMOJI_RUNTIME_ALL_PASS');
  }
}

run().catch(error => {
  console.error('HONRU_EMOJI_RUNTIME_CRASH:', error && error.stack || error);
  process.exitCode = 1;
});
