/**
 * RendererDeviceProfile
 *
 * One presentation-only policy for translating browser/device capabilities
 * into bounded Renderer costs. It owns no DOM, game state, transport,
 * persistence, Three.js or GSAP objects. Renderers remain free to reject any
 * recommendation and keep their existing 2D fallback.
 */
(function installRendererDeviceProfile(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.RendererDeviceProfile = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createRendererDeviceProfile() {
  'use strict';

  var QUALITY = Object.freeze({ HIGH:'HIGH', BALANCED:'BALANCED', LOW:'LOW' });
  var QUALITY_SET = new Set(Object.keys(QUALITY));
  var MOBILE_UA = /Android|webOS|iPhone|iPod|Mobile|Windows Phone/i;
  var TABLET_UA = /iPad|Tablet|Kindle|Silk|PlayBook/i;

  function freeze(value) { return Object.freeze(value); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function safeRead(value, key) {
    try { return value && value[key]; }
    catch (_error) { return undefined; }
  }
  function numberOrNull(value) { return finite(value) && value >= 0 ? value : null; }
  function normalizeQuality(value) {
    var candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_SET.has(candidate) ? candidate : QUALITY.BALANCED;
  }
  function sourceEnvironment(source) {
    var value = source && typeof source === 'object' ? source : {};
    var navigatorValue = safeRead(value, 'navigator');
    var screenValue = safeRead(value, 'screen');
    var hasNavigator = navigatorValue && typeof navigatorValue === 'object';
    var nav = hasNavigator ? navigatorValue : value;
    var ua = String(safeRead(nav, 'userAgent') || safeRead(value, 'userAgent') || '');
    var platform = String(safeRead(nav, 'platform') || safeRead(value, 'platform') || '');
    var maxTouchPoints = numberOrNull(safeRead(nav, 'maxTouchPoints'));
    var hardwareConcurrency = numberOrNull(safeRead(nav, 'hardwareConcurrency'));
    var deviceMemory = numberOrNull(safeRead(nav, 'deviceMemory'));
    var devicePixelRatio = numberOrNull(safeRead(value, 'devicePixelRatio'));
    var innerWidth = numberOrNull(safeRead(value, 'innerWidth'));
    var innerHeight = numberOrNull(safeRead(value, 'innerHeight'));
    var screenWidth = numberOrNull(safeRead(screenValue, 'width'));
    var screenHeight = numberOrNull(safeRead(screenValue, 'height'));
    return freeze({
      userAgent:ua,
      platform:platform,
      maxTouchPoints:maxTouchPoints,
      hardwareConcurrency:hardwareConcurrency,
      deviceMemory:deviceMemory,
      devicePixelRatio:devicePixelRatio,
      width:innerWidth === null ? screenWidth : innerWidth,
      height:innerHeight === null ? screenHeight : innerHeight
    });
  }
  function classify(source) {
    var env = sourceEnvironment(source);
    var touchMac = /MacIntel/i.test(env.platform) && env.maxTouchPoints !== null && env.maxTouchPoints > 1;
    var tablet = TABLET_UA.test(env.userAgent) || touchMac;
    var mobile = !tablet && MOBILE_UA.test(env.userAgent);
    var lowMemory = env.deviceMemory !== null && env.deviceMemory > 0 && env.deviceMemory <= 4;
    var lowCpu = env.hardwareConcurrency !== null && env.hardwareConcurrency > 0 && env.hardwareConcurrency <= 4;
    var lowEnd = lowMemory || lowCpu;
    var constrained = mobile || tablet || lowEnd;
    return freeze({
      family:tablet ? 'TABLET' : (mobile ? 'MOBILE' : 'DESKTOP'),
      mobile:mobile,
      tablet:tablet,
      touch:env.maxTouchPoints !== null && env.maxTouchPoints > 0,
      lowMemory:lowMemory,
      lowCpu:lowCpu,
      lowEnd:lowEnd,
      constrained:constrained,
      environment:env
    });
  }
  function evaluate(qualityValue, source) {
    var quality = normalizeQuality(qualityValue);
    var profile = classify(source);
    var requestedDpr = profile.environment.devicePixelRatio === null ? 1 : Math.max(1, profile.environment.devicePixelRatio);
    var dprCap = quality === QUALITY.LOW ? 1 :
      (quality === QUALITY.HIGH ? (profile.constrained ? 1.5 : 2) : (profile.constrained ? 1.25 : 1.5));
    var shadowEnabled = quality === QUALITY.HIGH && !profile.lowEnd;
    return freeze({
      quality:quality,
      profile:profile,
      dprCap:dprCap,
      pixelRatio:Math.max(1, Math.min(dprCap, requestedDpr)),
      antialias:quality !== QUALITY.LOW && !profile.constrained,
      powerPreference:profile.constrained ? 'low-power' : 'high-performance',
      shadowEnabled:shadowEnabled,
      shadowMapSize:shadowEnabled && (profile.mobile || profile.tablet) ? 512 : 1024,
      frameBudgetMs:profile.lowEnd ? 33.34 : 16.67,
      thermalProxyOnly:true
    });
  }

  return freeze({ QUALITY:QUALITY, classify:classify, evaluate:evaluate });
}));
