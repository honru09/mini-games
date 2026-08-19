#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'boundaries', 'auth-profile.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const SERVER_SOURCE = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
const {
  createAuthProfileBoundary,
  createJsonRuntimeAuthProfileAdapter,
  createMemoryAuthProfileAdapter,
} = require(MODULE_PATH);
const MODULE_EXPORT_KEYS = Object.keys(require(MODULE_PATH)).sort();

const GAMES = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log('PASS  ' + label);
  } catch (error) {
    failures += 1;
    console.error('FAIL  ' + label + ' :: ' + (error && error.message || error));
  }
}

function fixture(initial = []) {
  let now = 1_700_000_000_000;
  const friends = new Set();
  const blocked = new Set();
  const adapter = createMemoryAuthProfileAdapter(initial);
  const mastery = wins => ({ byGame: Object.fromEntries(GAMES.map(game => [game, { wins: Number(wins && wins[game]) || 0 }])) });
  const boundary = createAuthProfileBoundary({
    adapter,
    now: () => now,
    tokenTtlMs: 1000,
    tokenLimit: 5,
    normalizeUser: user => user,
    normalizeOwned: owned => owned || { avatars: [0], frames: [0], effects: [0], backgrounds: [0], game_cosmetics: [] },
    normalizeGameCosmetics: value => value || {},
    publicPlayerCharacter: value => value || { id: 'honru-default' },
    deriveMastery: mastery,
    levelProgress: xp => ({ current: Number(xp) || 0 }),
    xpForLevel: level => Number(level) * 10,
    dailyTasksPayload: user => ({ play: Number(user.daily && user.daily.play) || 0 }),
    publicPresence: () => 'online',
    virtualProfile: value => value,
    isHidden: uid => uid === 'admin',
    isTestAdmin: uid => uid === 'admin',
    validOwnedId: (kind, id) => kind === 'avatars' && id >= 0 && id < 3,
    ownsItem: (_user, kind, id) => kind === 'avatars' && id >= 0 && id < 3,
    sanitizePlainText: (value, max) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max),
    validGames: GAMES,
    getShopPrices: () => ({ avatars: { 2: 10 } }),
    canCompare: (viewer, target) => friends.has(viewer.uid + '|' + target.uid) && !blocked.has(viewer.uid + '|' + target.uid),
  });
  return { adapter, boundary, get now() { return now; }, setNow(value) { now = value; }, friends, blocked };
}

function user(uid, extra = {}) {
  return {
    uid,
    name: uid,
    avatar: 0,
    coins: 123,
    xp: 20,
    level: 3,
    streak: 2,
    bestStreak: 4,
    played: { gomoku: 2 },
    total: 2,
    wins: { gomoku: 1 },
    totalWins: 1,
    owned: { avatars: [0, 1], frames: [0], effects: [0], backgrounds: [0], game_cosmetics: [] },
    gameCosmetics: {},
    achievements: ['first_win'],
    playmates: {},
    daily: { play: 1, win: 1, streak: 1 },
    nameFx: 0,
    signature: 'hello',
    countryRegion: 'US',
    genderTag: 'hidden',
    showcase: null,
    presencePreference: 'joinable',
    presenceVisibility: 'everyone',
    lang: 'zh-CN',
    authTokens: [],
    ephemeral: false,
    ...extra,
  };
}

check('module exports deep boundary and two concrete Adapters', () => {
  assert.deepStrictEqual(MODULE_EXPORT_KEYS, [
    'createAuthProfileBoundary',
    'createJsonRuntimeAuthProfileAdapter',
    'createMemoryAuthProfileAdapter',
  ].sort());
  const adapterKeys = ['get', 'list', 'put', 'remove'];
  assert.deepStrictEqual(Object.keys(createMemoryAuthProfileAdapter()).sort(), adapterKeys.sort());
  assert.deepStrictEqual(Object.keys(createJsonRuntimeAuthProfileAdapter({
    readUser: () => null, readUsers: () => ({}), putUser: () => {}, removeUser: () => {},
  })).sort(), adapterKeys.sort());
  const runtime = fixture();
  assert.deepStrictEqual(Object.keys(runtime.boundary).sort(), ['profile', 'session']);
  assert(Object.isFrozen(runtime.boundary));
  assert(!SOURCE.includes('require(\'../server/index\')') && !SOURCE.includes('WebSocket'));
});

check('server consumes the seam through compatibility wrappers and narrow wire call sites', () => {
  assert(SERVER_SOURCE.includes("require('./boundaries/auth-profile')"));
  assert(SERVER_SOURCE.includes('createJsonRuntimeAuthProfileAdapter'));
  assert(SERVER_SOURCE.includes("authProfileBoundary.session({ action:'issue'"));
  assert(SERVER_SOURCE.includes("authProfileBoundary.session({ action:'revoke'"));
  assert(SERVER_SOURCE.includes("authProfileBoundary.profile({ action:'read'"));
  assert(SERVER_SOURCE.includes("authProfileBoundary.profile({ action:'compare'"));
  assert(SERVER_SOURCE.includes("authProfileBoundary.profile({ action:'update'"));
  assert(!SERVER_SOURCE.includes('function parseAuthTokenRecord'));
});

check('memory Adapter detaches initial state', () => {
  const original = user('detached');
  const adapter = createMemoryAuthProfileAdapter([original]);
  original.name = 'mutated outside';
  assert.strictEqual(adapter.get('detached').name, 'detached');
});

check('injected clock expires records and enforces five-session eviction', () => {
  const runtime = fixture();
  const account = user('tokens');
  runtime.adapter.put(account);
  const issued = [];
  for (let i = 0; i < 6; i += 1) {
    const result = runtime.boundary.session({ action: 'issue', user: account });
    assert.strictEqual(result.ok, true);
    issued.push(result);
    runtime.setNow(runtime.now + 1);
  }
  assert.strictEqual(account.authTokens.length, 5);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token: issued[0].token }).ok, false);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token: issued[5].token }).ok, true);
  runtime.setNow(runtime.now + 1001);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token: issued[5].token }).ok, false);
});

check('legacy bare token hash migrates once and remains valid for the injected TTL', () => {
  const runtime = fixture();
  const account = user('legacy-token');
  const token = 'legacy-client-token-12345678901234567890';
  const hash = runtime.boundary.session({ action: 'hash_token', token }).tokenHash;
  account.authTokens = [hash];
  runtime.adapter.put(account);
  const verified = runtime.boundary.session({ action: 'verify_token', user: account, token });
  assert.strictEqual(verified.ok, true);
  assert(/^t2\$/.test(account.authTokens[0]));
  runtime.setNow(runtime.now + 1001);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token }).ok, false);
});

check('logout revokes only the current token', () => {
  const runtime = fixture();
  const account = user('logout');
  runtime.adapter.put(account);
  const first = runtime.boundary.session({ action: 'issue', user: account });
  const second = runtime.boundary.session({ action: 'issue', user: account });
  assert.strictEqual(runtime.boundary.session({ action: 'revoke', user: account, tokenHash: first.tokenHash }).revoked, true);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token: first.token }).ok, false);
  assert.strictEqual(runtime.boundary.session({ action: 'verify_token', user: account, token: second.token }).ok, true);
});

check('private/public/read projections preserve privacy and owner token gate', () => {
  const runtime = fixture();
  const account = user('profile');
  runtime.adapter.put(account);
  const auth = runtime.boundary.session({ action: 'issue', user: account });
  const privateProfile = runtime.boundary.profile({ action: 'private', user: account }).profile;
  const publicProfile = runtime.boundary.profile({ action: 'public', user: account }).profile;
  const privateRead = runtime.boundary.profile({ action: 'read', targetUid: account.uid, viewerUid: account.uid, viewerTokenHash: auth.tokenHash });
  const publicRead = runtime.boundary.profile({ action: 'read', targetUid: account.uid, viewerUid: 'other', viewerTokenHash: '' });
  assert(privateProfile && privateProfile.owned && privateProfile.username === '');
  assert(publicProfile && publicProfile.owned === undefined && publicProfile.username === undefined && publicProfile.dailyTasks === undefined);
  assert.strictEqual(privateRead.private, true);
  assert.strictEqual(publicRead.private, false);
  assert.deepStrictEqual(Object.keys(privateRead.profile).sort(), Object.keys(privateProfile).sort());
});

check('profile update is an allowlist and cannot mutate authority fields', () => {
  const runtime = fixture();
  const account = user('editable');
  runtime.adapter.put(account);
  const before = { coins: account.coins, xp: account.xp, level: account.level, wins: JSON.stringify(account.wins), owned: JSON.stringify(account.owned), tokens: JSON.stringify(account.authTokens) };
  const updated = runtime.boundary.profile({ action: 'update', user: account, payload: {
    name: 'New Name', lang: 'uk-UA', avatar: 1, coins: 999999, xp: 999999, level: 999,
    wins: { gomoku: 999 }, owned: { avatars: [2] }, authTokens: ['forged'], purchaseRequests: ['forged'],
  } });
  assert.strictEqual(updated.ok, true);
  assert.strictEqual(account.name, 'New Name');
  assert.strictEqual(account.lang, 'uk-UA');
  assert.strictEqual(account.avatar, 1);
  assert.deepStrictEqual({ coins: account.coins, xp: account.xp, level: account.level, wins: JSON.stringify(account.wins), owned: JSON.stringify(account.owned), tokens: JSON.stringify(account.authTokens) }, before);
});

check('compare rechecks friend and Block permission and keeps a narrow projection', () => {
  const runtime = fixture();
  const viewer = user('viewer');
  const friend = user('friend');
  runtime.adapter.put(viewer); runtime.adapter.put(friend);
  runtime.friends.add('viewer|friend');
  const allowed = runtime.boundary.profile({ action: 'compare', viewer, target: friend, requestId: 'compare_12345678', targetUid: friend.uid });
  assert.strictEqual(allowed.ok, true);
  assert.strictEqual(allowed.self.coins, undefined);
  assert.strictEqual(allowed.friend.owned, undefined);
  runtime.blocked.add('viewer|friend');
  assert.strictEqual(runtime.boundary.profile({ action: 'compare', viewer, target: friend, requestId: 'compare_12345678', targetUid: friend.uid }).ok, false);
  const guest = user('guest', { ephemeral: true });
  assert.strictEqual(runtime.boundary.profile({ action: 'can_compare', viewer, target: guest }).allowed, false);
});

check('Test Admin is hidden from public and compare projections', () => {
  const runtime = fixture();
  const admin = user('admin');
  assert.strictEqual(runtime.boundary.profile({ action: 'public', user: admin }).profile, null);
  assert.strictEqual(runtime.boundary.profile({ action: 'compare_projection', user: admin }).profile, null);
});

if (failures) {
  console.error(`AUTH_PROFILE_BOUNDARY_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`AUTH_PROFILE_BOUNDARY_ALL_PASS assertions=${assertions}`);
}
