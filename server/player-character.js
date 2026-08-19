'use strict';

// Player Character v1 is intentionally a small, pure module.  It owns the
// stored schema, the current catalog and every fallback rule so callers never
// need to interpret untrusted profile data themselves.
const SCHEMA_VERSION = 'player-character-v1';
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_ID_LENGTH = 64;

const PLAYER_CHARACTER_CATALOG = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  characters: Object.freeze(['character-base-01']),
  slots: Object.freeze({
    body: Object.freeze(['body-paper-01']),
    face: Object.freeze(['face-dot-01']),
    hair: Object.freeze(['hair-none']),
    top: Object.freeze(['top-hoodie-01']),
    bottom: Object.freeze(['bottom-shorts-01']),
    footwear: Object.freeze(['footwear-sneakers-01']),
    accessory: Object.freeze(['accessory-none']),
  }),
});

const SLOT_NAMES = Object.freeze(Object.keys(PLAYER_CHARACTER_CATALOG.slots));
const DEFAULT_PLAYER_CHARACTER = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  characterId: 'character-base-01',
  slots: Object.freeze({
    body: 'body-paper-01',
    face: 'face-dot-01',
    hair: 'hair-none',
    top: 'top-hoodie-01',
    bottom: 'bottom-shorts-01',
    footwear: 'footwear-sneakers-01',
    accessory: 'accessory-none',
  }),
});

function isSafeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return !Object.keys(value).some(key => FORBIDDEN_KEYS.has(key));
  } catch {
    return false;
  }
}

function safeString(record, key) {
  if (!isSafeRecord(record) || !Object.prototype.hasOwnProperty.call(record, key)) return '';
  try {
    const value = record[key];
    return typeof value === 'string' && value.length <= MAX_ID_LENGTH ? value : '';
  } catch {
    return '';
  }
}

function defaultCharacter() {
  return {
    schemaVersion: DEFAULT_PLAYER_CHARACTER.schemaVersion,
    characterId: DEFAULT_PLAYER_CHARACTER.characterId,
    slots: { ...DEFAULT_PLAYER_CHARACTER.slots },
  };
}

function allowedCharacterId(value) {
  return PLAYER_CHARACTER_CATALOG.characters.includes(value) ? value : DEFAULT_PLAYER_CHARACTER.characterId;
}

function allowedSlotId(slot, value) {
  const allowed = PLAYER_CHARACTER_CATALOG.slots[slot];
  return allowed && allowed.includes(value) ? value : DEFAULT_PLAYER_CHARACTER.slots[slot];
}

/**
 * Convert an unknown stored value into the sole v1 representation.  It never
 * mutates input, never exposes a shared default object, and treats unknown
 * schema versions or unsafe records as a deterministic base character.
 */
function normalizeStored(value) {
  if (!isSafeRecord(value) || safeString(value, 'schemaVersion') !== SCHEMA_VERSION) return defaultCharacter();

  const normalized = defaultCharacter();
  normalized.characterId = allowedCharacterId(safeString(value, 'characterId'));

  let slots;
  try { slots = value.slots; } catch { return normalized; }
  if (!isSafeRecord(slots)) return normalized;
  for (const slot of SLOT_NAMES) normalized.slots[slot] = allowedSlotId(slot, safeString(slots, slot));
  return normalized;
}

/**
 * The only projection that may leave the authority layer.  It deliberately
 * rebuilds the object so owned items, prices, currency and credential fields
 * cannot hitch a ride from a malformed stored value.
 */
function publicPresentation(value) {
  const normalized = normalizeStored(value);
  return {
    schemaVersion: normalized.schemaVersion,
    characterId: normalized.characterId,
    slots: { ...normalized.slots },
  };
}

module.exports = Object.freeze({
  SCHEMA_VERSION,
  PLAYER_CHARACTER_CATALOG,
  DEFAULT_PLAYER_CHARACTER,
  normalizeStored,
  publicPresentation,
});
