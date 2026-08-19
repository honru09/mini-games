'use strict';

/*
 * Tank snapshot delivery adapter.
 *
 * This adapter owns only the per-recipient v2 transport base.  It never
 * delivers bytes, changes the Authority, or decides room membership.  The
 * caller keeps those responsibilities and falls back to the original full
 * `tank_snapshot` payload whenever this default-off adapter declines work.
 */
const TankSnapshotWireCodec = require('../../shared/protocol/tank-snapshot-wire-codec');

const TANK_SNAPSHOT_DELTA_PROTOCOL = TankSnapshotWireCodec.V2_PROTOCOL;

function safeRecipient(value) {
  const key = String(value || '');
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(key) ? key : null;
}

function createTankSnapshotStream(options = {}) {
  const enabled = options.enabled === true;
  const codec = options.codec && typeof options.codec.encode === 'function'
    ? options.codec
    : TankSnapshotWireCodec.create({
      keyframeEveryTicks: options.keyframeEveryTicks,
      maxRecipients: options.maxRecipients,
      maxFramesPerRecipient: options.maxFramesPerRecipient,
    });
  let disposed = false;

  function result(accepted, reason, extras) {
    return Object.freeze({ accepted: accepted === true, reason: reason || null, ...(extras || {}) });
  }

  function encodeFor(recipientKey, snapshot, config = {}) {
    if (disposed) return result(false, 'disposed');
    if (!enabled) return result(false, 'disabled');
    const key = safeRecipient(recipientKey);
    if (!key) return result(false, 'invalid_recipient');
    const encoded = codec.encode(snapshot, { recipientKey: key, forceKeyframe: config.forceKeyframe === true });
    if (!encoded || encoded.accepted !== true || !encoded.envelope) {
      return result(false, encoded && encoded.reason || 'codec_rejected');
    }
    return result(true, null, {
      envelope: encoded.envelope,
      mode: encoded.mode,
      frameId: encoded.frameId,
      baseFrameId: encoded.baseFrameId,
    });
  }

  function forget(recipientKey) {
    if (disposed) return result(false, 'disposed');
    const key = safeRecipient(recipientKey);
    if (!key) return result(false, 'invalid_recipient');
    const forgotten = codec.forget(key);
    return result(!!(forgotten && forgotten.accepted), forgotten && forgotten.reason || null);
  }

  function reset(matchId) {
    if (disposed) return result(false, 'disposed');
    const outcome = codec.reset({ matchId: matchId === undefined ? null : matchId });
    return result(!!(outcome && outcome.accepted), outcome && outcome.reason || null);
  }

  function dispose() {
    if (!disposed) {
      disposed = true;
      if (codec && typeof codec.dispose === 'function') codec.dispose();
    }
    return Object.freeze({ status: 'disposed' });
  }

  return Object.freeze({
    protocol: TANK_SNAPSHOT_DELTA_PROTOCOL,
    enabled,
    encodeFor,
    forget,
    reset,
    dispose,
  });
}

module.exports = Object.freeze({
  TANK_SNAPSHOT_DELTA_PROTOCOL,
  createTankSnapshotStream,
});
