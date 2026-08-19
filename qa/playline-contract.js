'use strict';

// Playline P0 server Module contract.  The test intentionally crosses only
// createPlaylineModule's four public methods; store internals are exercised
// through the same module with the two shipped adapter factories.
const assert = require('assert');
const {
  createPlaylineModule,
  createJsonPlaylineStore,
  createSupabasePlaylineStore,
  VALID_GAMES,
  MAX_TEXT_CODE_POINTS,
  MAX_TEXT_BYTES,
} = require('../server/playline');

const failures = [];
function check(name, condition, detail) {
  const ok = !!condition;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail && !ok ? ' :: ' + detail : ''));
  if (!ok) failures.push(name);
  return ok;
}
async function expectResult(promise, reason) {
  const result = await promise;
  assert.strictEqual(result && result.ok, false);
  if (reason) assert.strictEqual(result.reason, reason);
  return result;
}
function actor(uid, extra = {}) { return { uid, formal: true, ...extra }; }
function postId(index) { return 'client-post-' + String(index).padStart(4, '0'); }

async function main() {
  let clock = 1_700_000_000_000;
  let blocked = new Set();
  let friendships = new Set(['u_alice|u_bob']);
  const profiles = {
    u_alice: { uid: 'u_alice', name: 'Alice', avatar: 1, coins: 999, token: 'private' },
    u_bob: { uid: 'u_bob', name: 'Bob', avatar: 2, owned: { avatars: [1] }, passwordHash: 'private' },
  };
  const social = {
    isBlockedBetween(a, b) { return blocked.has(a + '|' + b) || blocked.has(b + '|' + a); },
    isFriend(a, b) { return friendships.has(a + '|' + b) || friendships.has(b + '|' + a); },
  };
  const module = createPlaylineModule({
    now: () => clock,
    cursorSecret: 'contract-secret',
    ...social,
    publicProfileResolver: uid => profiles[uid] || { uid, name: uid },
    resultResolver: (current, resultId) => resultId === 'result-ok-1'
      ? { gameId: 'gomoku', outcome: 'win', mode: 'online', resultId, matchId: 'private', reward: { coins: 9 }, opponentUid: 'u_bob' }
      : null,
    recordResolver: (current, replayId) => replayId === 'record-ok-1'
      ? { gameId: 'tetris', record: 'game_wins:tetris', value: 4, replayId, moveLog: ['private'] }
      : null,
    publishShortMax: 20,
    publishLongMax: 100,
  });

  const alice = actor('u_alice');
  const bob = actor('u_bob');
  const guest = actor('u_guest', { ephemeral: true });
  const admin = actor('u_admin', { testAdmin: true });

  try {
    const empty = await module.list(alice, { filter: 'all' });
    check('formal actor can read an empty page', empty.ok === true && Array.isArray(empty.posts) && empty.posts.length === 0);
    check('guest and test-admin are rejected at the Module boundary',
      (await expectResult(module.list(guest, {}), 'guest_forbidden')) &&
      (await expectResult(module.publish(admin, { clientPostId: postId(1), audience: 'all', content: { kind: 'text', text: 'x' } }), 'test_admin_isolated')));

    const textResult = await module.publish(alice, {
      clientPostId: postId(1), audience: 'all',
      content: { kind: 'text', text: '  你好\r\n世界\u202E  ' },
    });
    check('text post is normalized at the authority', textResult.ok === true && textResult.post.content.kind === 'text' && textResult.post.content.text === '你好\n世界');
    const gameResult = await module.publish(alice, {
      clientPostId: postId(2), audience: 'all', content: { kind: 'game_share', gameId: 'tetris', title: 'forged' },
    });
    check('game share rejects caption/extra fields', gameResult.ok === false && gameResult.reason === 'invalid_post_shape');
    const gameOk = await module.publish(alice, {
      clientPostId: postId(3), audience: 'all', content: { kind: 'game_share', gameId: 'tetris' },
    });
    const resultOk = await module.publish(alice, {
      clientPostId: postId(4), audience: 'friends', content: { kind: 'result_share', resultId: 'result-ok-1' },
    });
    const recordOk = await module.publish(alice, {
      clientPostId: postId(5), audience: 'friends', content: { kind: 'record_share', replayId: 'record-ok-1' },
    });
    check('all four P0 content kinds are accepted only through canonical data',
      gameOk.ok === true && resultOk.ok === true && recordOk.ok === true &&
      resultOk.post.content.gameId === 'gomoku' && recordOk.post.content.record === 'game_wins:tetris');
    check('private reference fields never enter the public projection',
      !JSON.stringify(resultOk.post).match(/resultId|replayId|matchId|reward|opponent|moveLog|seq/i) &&
      !JSON.stringify(recordOk.post).match(/resultId|replayId|matchId|reward|opponent|moveLog|seq/i));

    const duplicate = await module.publish(alice, {
      clientPostId: postId(3), audience: 'all', content: { kind: 'game_share', gameId: 'tetris' },
    });
    const conflict = await module.publish(alice, {
      clientPostId: postId(3), audience: 'friends', content: { kind: 'game_share', gameId: 'tetris' },
    });
    check('same author/clientPostId replays and differing intent conflicts', duplicate.ok === true && duplicate.duplicate === true && conflict.reason === 'idempotency_conflict');

    const friendsPage = await module.list(bob, { filter: 'friends', limit: 30 });
    check('current friends can see friends-audience posts', friendsPage.ok === true && friendsPage.posts.some(item => item.content.kind === 'result_share'));
    friendships.clear();
    const afterRemove = await module.list(bob, { filter: 'friends', limit: 30 });
    check('removing friendship immediately hides friends-audience posts', afterRemove.ok === true && !afterRemove.posts.some(item => item.content.kind === 'result_share'));
    friendships.add('u_alice|u_bob');
    blocked.add('u_bob|u_alice');
    const afterBlock = await module.list(bob, { filter: 'all', limit: 30 });
    check('either-direction Block immediately hides public posts', afterBlock.ok === true && !afterBlock.posts.some(item => item.author.uid === 'u_alice'));
    blocked.clear();

    // Cursor and keyset behavior use a separate module so the read-rate bucket
    // from the preceding visibility checks cannot affect the pagination proof.
    let pageClock = clock;
    const pageModule = createPlaylineModule({ now: () => pageClock, cursorSecret: 'page-secret', ...social, publishShortMax: 100, publishLongMax: 100 });
    for (let i = 0; i < 3; i++) {
      pageClock += 1;
      await pageModule.publish(alice, { clientPostId: 'page-post-' + String(i).padStart(4, '0'), audience: 'all', content: { kind: 'game_share', gameId: VALID_GAMES[i] } });
    }
    const first = await pageModule.list(alice, { filter: 'all', limit: 2 });
    const tampered = first.nextCursor ? first.nextCursor.slice(0, -1) + (first.nextCursor.endsWith('A') ? 'B' : 'A') : 'tampered.cursor.value';
    const invalidCursor = await pageModule.list(alice, { filter: 'all', limit: 2, cursor: tampered });
    const second = await pageModule.list(alice, { filter: 'all', limit: 2, cursor: first.nextCursor });
    check('cursor is opaque/signed and keyset pagination advances', first.ok === true && first.posts.length === 2 && invalidCursor.reason === 'invalid_cursor' && second.ok === true && second.posts.length === 1 && first.posts[0].id !== second.posts[0].id);

    const deleteTarget = gameOk.post.id;
    const removed = await module.remove(alice, { postId: deleteTarget, requestId: 'delete-request-0001' });
    const removedAgain = await module.remove(alice, { postId: deleteTarget, requestId: 'delete-request-0001' });
    const gone = await module.list(alice, { filter: 'all', limit: 30 });
    const target = await module.resolveReportTarget(alice, resultOk.post.id);
    blocked.add('u_bob|u_alice');
    const forgedTarget = await module.resolveReportTarget(bob, resultOk.post.id);
    blocked.clear();
    check('delete is an idempotent tombstone and removes the projection', removed.ok === true && removedAgain.ok === true && gone.ok === true && !gone.posts.some(item => item.id === deleteTarget));
    check('report target is bound to the stored author and visible post', target.ok === true && target.targetUid === 'u_alice' && target.contextType === 'playline' && forgedTarget.reason === 'post_unavailable');

    const oversize = await module.publish(alice, { clientPostId: 'oversize-post-01', audience: 'all', content: { kind: 'text', text: '🙂'.repeat(MAX_TEXT_CODE_POINTS + 1) } });
    const bytes = await module.publish(alice, { clientPostId: 'bytes-post-01', audience: 'all', content: { kind: 'text', text: '字'.repeat(Math.ceil(MAX_TEXT_BYTES / 3) + 10) } });
    check('text code-point and UTF-8 byte limits are enforced', oversize.reason === 'post_too_long' && bytes.reason === 'post_too_long');

    let limitedNow = 10_000;
    const limited = createPlaylineModule({ now: () => limitedNow, cursorSecret: 'rate-secret', publishShortMax: 3, publishLongMax: 15 });
    for (let i = 0; i < 3; i++) await limited.publish(alice, { clientPostId: 'rate-post-' + String(i).padStart(4, '0'), audience: 'all', content: { kind: 'game_share', gameId: 'gomoku' } });
    const rate = await limited.publish(alice, { clientPostId: 'rate-post-9999', audience: 'all', content: { kind: 'game_share', gameId: 'gomoku' } });
    check('publish frequency is author-scoped and bounded', rate.reason === 'rate_limited' && rate.retryAfter >= 1);

    const jsonAdapter = createJsonPlaylineStore({ state: { playlinePosts: [] } });
    const rpcAdapter = createSupabasePlaylineStore({ rpc: async () => ({ records: [] }) });
    check('adapter exports have the required store shape', ['listPage', 'insertIdempotent', 'deleteOwned', 'findReportTarget'].every(name => typeof jsonAdapter[name] === 'function') && ['listPage', 'insertIdempotent', 'deleteOwned', 'findReportTarget'].every(name => typeof rpcAdapter[name] === 'function'));

    const rpcNames = [];
    const supabase = createSupabasePlaylineStore({ rpc: async (name) => { rpcNames.push(name); if (name === 'create_playline_post_v1') return { post: { id: 'pl_rpc_1', seq: '1', authorUid: 'u_alice', audience: 'all', kind: 'game_share', createdAt: clock, clientPostId: postId(90), safeSnapshot: { kind: 'game_share', gameId: 'gomoku' } } }; return { records: [] }; } });
    const remoteModule = createPlaylineModule({ store: supabase, now: () => clock, cursorSecret: 'rpc-secret' });
    const remote = await remoteModule.publish(alice, { clientPostId: postId(90), audience: 'all', content: { kind: 'game_share', gameId: 'gomoku' } });
    check('Supabase adapter uses only injected RPC and maps a safe post', remote.ok === true && rpcNames.includes('create_playline_post_v1') && !JSON.stringify(remote).includes('seq'));
    check('Supabase default idempotency uses the transactional create RPC', rpcNames.includes('create_playline_post_v1') && !rpcNames.includes('find_playline_post_v1'));
    const failing = createSupabasePlaylineStore({ rpc: async () => { throw new Error('db down'); } });
    const failingModule = createPlaylineModule({ store: failing, now: () => clock, cursorSecret: 'fail-secret' });
    check('Supabase RPC failures fail closed', (await failingModule.list(alice, {})).reason === 'server_unavailable' && (await failingModule.publish(alice, { clientPostId: postId(91), audience: 'all', content: { kind: 'game_share', gameId: 'gomoku' } })).reason === 'server_unavailable');
  } catch (error) {
    check('contract executes without an unexpected exception', false, error && error.stack || String(error));
  }
  console.log(failures.length ? 'PLAYLINE_CONTRACT_HAS_FAILURES' : 'PLAYLINE_CONTRACT_ALL_PASS');
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(error => {
  console.error('PLAYLINE_CONTRACT_CRASH', error && error.stack || error);
  process.exitCode = 1;
});
