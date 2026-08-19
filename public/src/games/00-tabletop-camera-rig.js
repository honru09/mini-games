/* Shared, presentation-only camera vocabulary for Ghost3D renderer islands. */
(function installTabletopCameraRig(root){
  'use strict';

  const MODES = Object.freeze(['overview','entrance','turn-focus','action-follow','impact','result','spectator','portrait']);
  const MODE_SET = new Set(MODES);
  const QUALITY_SCALE = Object.freeze({ HIGH:1, BALANCED:.72, LOW:0, FALLBACK:0 });
  const DEFAULT_PROFILE = Object.freeze({
    projection:'perspective',
    camera:Object.freeze({ x:0, y:15, z:14 }),
    aim:Object.freeze({ x:0, y:0, z:0 }),
    entrance:Object.freeze({ xFactor:0, yDelta:3.2, zDelta:4, aimY:.3, duration:.26, ease:'power2.out' }),
    shots:Object.freeze({
      overview:Object.freeze({ xFactor:0, yDelta:0, zFactor:0, aimY:0, duration:.22, ease:'power2.inOut' }),
      'turn-focus':Object.freeze({ xFactor:.18, yDelta:-.9, zFactor:.14, aimY:0, duration:.22, ease:'power2.out' }),
      'action-follow':Object.freeze({ xFactor:.2, yDelta:-1, zFactor:.16, aimY:0, duration:.24, ease:'power2.out' }),
      impact:Object.freeze({ xFactor:.14, yDelta:-.55, zFactor:.1, aimY:.04, duration:.16, ease:'power2.out' }),
      result:Object.freeze({ xFactor:.06, yDelta:1.1, zDelta:1.35, zFactor:.05, aimY:.12, duration:.42, ease:'power2.inOut' }),
      spectator:Object.freeze({ xFactor:0, yDelta:1.7, zDelta:2.1, zFactor:0, aimY:0, duration:.34, ease:'power2.inOut' }),
      portrait:Object.freeze({ xFactor:.26, yDelta:-1.8, zFactor:.2, aimY:.2, duration:.3, ease:'power2.inOut' }),
    }),
  });
  const PROFILES = Object.freeze({
    gomoku:Object.freeze({ projection:'perspective', camera:Object.freeze({ x:0, y:15.5, z:14.5 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
    ludo:Object.freeze({ projection:'perspective', camera:Object.freeze({ x:0, y:16.4, z:14.8 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
    monopoly:Object.freeze({ projection:'perspective', camera:Object.freeze({ x:0, y:16.2, z:14.7 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
    xiangqi:Object.freeze({ projection:'perspective', camera:Object.freeze({ x:0, y:14.8, z:13.6 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
    tetris:Object.freeze({ projection:'perspective', camera:Object.freeze({ x:0, y:.75, z:24.5 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
    tank:Object.freeze({ projection:'orthographic', camera:Object.freeze({ x:0, y:16.5, z:13.5 }), aim:Object.freeze({ x:0, y:0, z:0 }) }),
  });

  function finite(value, fallback){ return Number.isFinite(Number(value)) ? Number(value) : fallback; }
  function quality(value){
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return Object.prototype.hasOwnProperty.call(QUALITY_SCALE, normalized) ? normalized : 'BALANCED';
  }
  function point(value){
    const source = value && typeof value === 'object' ? value : {};
    return Object.freeze({ x:finite(source.x,0), y:finite(source.y,0), z:finite(source.z,0) });
  }
  function profile(gameId){
    const known = typeof gameId === 'string' && Object.prototype.hasOwnProperty.call(PROFILES,gameId);
    const selected = known ? PROFILES[gameId] : DEFAULT_PROFILE;
    return Object.freeze({
      id:known ? gameId : 'tabletop',
      projection:selected.projection || DEFAULT_PROFILE.projection,
      camera:selected.camera || DEFAULT_PROFILE.camera,
      aim:selected.aim || DEFAULT_PROFILE.aim,
    });
  }
  function modeForEvent(value){
    const type = String(value && value.type || value || '').trim().toLowerCase();
    if (type === 'camera_entrance' || type === 'entrance') return 'entrance';
    if (type === 'aim' || type === 'select' || type === 'turn_focus' || type === 'turn-focus') return 'turn-focus';
    if (type === 'piece_placed' || type === 'token_moved' || type === 'piece_moved' || type === 'action_follow' || type === 'action-follow') return 'action-follow';
    if (type === 'impact' || type === 'piece_locked' || type === 'capture' || type === 'hit') return 'impact';
    if (type === 'winning_line' || type === 'terminal' || type === 'result' || type === 'ko') return 'result';
    if (type === 'spectator') return 'spectator';
    if (type === 'portrait') return 'portrait';
    return 'overview';
  }
  function plan(gameId, requestedMode, targetValue, options){
    const selectedProfile = profile(gameId);
    const mode = MODE_SET.has(requestedMode) ? requestedMode : modeForEvent(requestedMode);
    const target = point(targetValue);
    const opts = options && typeof options === 'object' ? options : {};
    const selectedQuality = quality(opts.quality);
    const scale = opts.reducedMotion === true ? 0 : QUALITY_SCALE[selectedQuality];
    const baseCamera = selectedProfile.camera;
    const baseAim = selectedProfile.aim;
    let shot = DEFAULT_PROFILE.shots[mode] || null;
    let camera;
    let aim;
    let duration = 0;
    let ease = 'power2.out';

    if (mode === 'entrance') {
      shot = DEFAULT_PROFILE.entrance;
      camera = Object.freeze({
        x:baseCamera.x * (shot.xFactor || 0),
        y:baseCamera.y + shot.yDelta,
        z:baseCamera.z + shot.zDelta,
      });
      aim = Object.freeze({ x:baseAim.x, y:shot.aimY, z:baseAim.z });
    } else if (shot) {
      camera = Object.freeze({
        x:baseCamera.x + target.x * shot.xFactor,
        y:baseCamera.y + shot.yDelta,
        z:baseCamera.z + finite(shot.zDelta,0) + target.z * shot.zFactor,
      });
      aim = Object.freeze({ x:target.x, y:target.y + shot.aimY, z:target.z });
    } else {
      camera = Object.freeze({ x:baseCamera.x, y:baseCamera.y, z:baseCamera.z });
      aim = Object.freeze({ x:baseAim.x, y:baseAim.y, z:baseAim.z });
    }
    if (shot && scale > 0) duration = Math.max(0, shot.duration * scale);
    if (shot && typeof shot.ease === 'string') ease = shot.ease;
    return Object.freeze({
      gameId:selectedProfile.id,
      projection:selectedProfile.projection,
      mode,
      quality:selectedQuality,
      reducedMotion:opts.reducedMotion === true,
      animated:duration > 0,
      duration,
      ease,
      camera,
      aim,
      target,
    });
  }

  root.TabletopCameraRig = Object.freeze({ MODES, profile, modeForEvent, plan });
})(typeof globalThis!=='undefined'?globalThis:this);
