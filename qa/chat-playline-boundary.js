#!/usr/bin/env node
'use strict';

/*
 * Local contract for the T7 Chat/Playline seam.  The test crosses only the
 * boundary Interface and its two storage Adapters; it does not boot a server
 * process or depend on a browser.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'boundaries', 'chat-playline.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const boundaryModule = require(MODULE_PATH);
const {
  CHAT_PROTOCOL,
  PLAYLINE_PROTOCOL,
  createChatPlaylineBoundary,
  createMemoryChatPlaylineAdapter,
  createJsonRuntimeChatPlaylineAdapter,
} = boundaryModule;

let assertions = 0;
let failures = 0;

async function check(label, run) {
  assertions += 1;
  try {
    await run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${label} :: ${error && error.message || error}`);
  }
}

function actor(uid, extra = {}) {
  return { uid, formal: true, ...extra };
}

function makeFixture(overrides = {}) {
  let now = 1_700_000_000_000;
  const users = {
    alice: { uid: 'alice', name: 'Alice', avatar: 1, lang: 'en-US' },
    bob: { uid: 'bob', name: 'Bob', avatar: 2, lang: 'zh-CN' },
    stranger: { uid: 'stranger', name: 'Stranger', avatar: 3 },
    guest: { uid: 'guest', name: 'Guest', ephemeral: true },
    admin: { uid: 'admin', name: 'Hidden Test Admin', avatar: 4 },
  };
  const friends = new Set(['alice|bob']);
  const blocked = new Set();
  const playlineCalls = [];
  const playline = {
    async list(current, query) { playlineCalls.push(['list', current.uid, query]); return { ok: true, posts: [], privateSource: { token: 'hide' } }; },
    async publish(current, intent) { playlineCalls.push(['publish', current.uid, intent]); return { ok: true, post: { id: 'post_01', content: { kind: 'text', text: 'hello' }, coins: 99 } }; },
    async remove(current, input) { playlineCalls.push(['remove', current.uid, input]); return { ok: true, postId: input.postId, owned: ['private'] }; },
    async resolveReportTarget(current, postId) { playlineCalls.push(['report', current.uid, postId]); return { ok: true, targetUid: 'bob', contextType: 'playline', privateSource: { password: 'hide' } }; },
  };
  const adapter = overrides.adapter || createMemoryChatPlaylineAdapter();
  const options = {
    adapter,
    now: () => now,
    users,
    listPeers: () => Object.keys(users),
    isFriend: (a, b) => friends.has([a, b].sort().join('|')),
    isBlockedBetween: (a, b) => blocked.has([a, b].sort().join('|')),
    isTestAdmin: uid => uid === 'admin',
    publicPeer: (_viewerUid, peerUid) => users[peerUid],
    messageIdFactory: ({ clientMessageId }) => 'msg_' + clientMessageId.slice(-10),
    playline,
    ...overrides,
  };
  const boundary = createChatPlaylineBoundary(options);
  return {
    boundary,
    adapter,
    users,
    friends,
    blocked,
    playlineCalls,
    now: () => now,
    setNow: value => { now = value; },
  };
}

async function main() {
  await check('module exports stable protocol constants, constructor and two Adapters', () => {
    assert.strictEqual(CHAT_PROTOCOL, 'direct-chat-v1');
    assert.strictEqual(PLAYLINE_PROTOCOL, 'playline-v1');
    for (const key of ['createChatPlaylineBoundary', 'createMemoryChatPlaylineAdapter', 'createJsonRuntimeChatPlaylineAdapter']) {
      assert.strictEqual(typeof boundaryModule[key], 'function');
    }
  });

  await check('Memory Adapter detaches input and output state', () => {
    const initial = { messages: [{ id: 'msg_initial', senderUid: 'alice', recipientUid: 'bob', seq: '1', clientMessageId: 'client_msg_init', text: 'x', createdAt: 1_700_000_000_000 }], reads: [], nextSeq: '1' };
    const adapter = createMemoryChatPlaylineAdapter(initial);
    initial.messages[0].text = 'mutated';
    const loaded = adapter.load();
    assert.strictEqual(loaded.messages[0].text, 'x');
    loaded.messages[0].text = 'caller mutation';
    assert.strictEqual(adapter.load().messages[0].text, 'x');
    const next = { messages: [], reads: [], nextSeq: '2' };
    adapter.commit(next);
    next.nextSeq = '999';
    assert.strictEqual(adapter.load().nextSeq, '2');
    assert(Object.isFrozen(adapter));
  });

  await check('JSON runtime Adapter supports canonical and legacy shapes without aliasing', () => {
    let runtime = { messages: [], reads: [], nextSeq: '0' };
    let metadata = null;
    const canonical = createJsonRuntimeChatPlaylineAdapter({
      read: () => runtime,
      write: next => { runtime = next; },
      commit: (next, meta) => { metadata = meta; runtime = next; return { ok: true }; },
    });
    canonical.commit({ messages: [], reads: [], nextSeq: '7' }, { operation: 'test' });
    assert.strictEqual(canonical.load().nextSeq, '7');
    assert.deepStrictEqual(metadata, { operation: 'test' });
    runtime = { chatMessages: [], chatReads: {}, nextChatSeq: '4' };
    const legacyWrites = [];
    const legacy = createJsonRuntimeChatPlaylineAdapter({
      shape: 'legacy',
      read: () => runtime,
      write: next => { legacyWrites.push(next); runtime = next; },
    });
    assert.strictEqual(legacy.load().nextSeq, '4');
    legacy.save({ messages: [], reads: [], nextSeq: '5' });
    assert.strictEqual(legacyWrites[0].nextChatSeq, '5');
    assert(Array.isArray(legacyWrites[0].chatMessages) && legacyWrites[0].chatReads);
    assert(Object.isFrozen(canonical) && Object.isFrozen(legacy));
  });

  const fixture = makeFixture();
  const { boundary, adapter, users, friends, blocked, playlineCalls, setNow } = fixture;

  await check('Boundary exposes only chat/playline and hides its Adapter', () => {
    assert.deepStrictEqual(Object.keys(boundary).sort(), ['chat', 'playline']);
    assert(Object.isFrozen(boundary));
    assert(!Object.prototype.hasOwnProperty.call(boundary, 'adapter'));
    assert(!Object.prototype.hasOwnProperty.call(boundary, 'rateBuckets'));
  });

  await check('Chat admission fails closed for missing, guest, test-admin and invalid sessions', async () => {
    assert.strictEqual((await boundary.chat({ action: 'list' })).reason, 'not_authenticated');
    assert.strictEqual((await boundary.chat({ action: 'list', actor: actor('guest', { ephemeral: true }) })).reason, 'guest_forbidden');
    assert.strictEqual((await boundary.chat({ action: 'list', actor: actor('admin', { testAdmin: true }) })).reason, 'test_admin_isolated');
    assert.strictEqual((await boundary.chat({ action: 'list', actor: actor('alice', { authenticated: false }) })).reason, 'not_authenticated');
  });

  await check('Optional capability and actor validator are fail-closed', async () => {
    const required = makeFixture({ requireCapability: true }).boundary;
    const missing = await required.chat({ action: 'list', actor: actor('alice') });
    assert.strictEqual(missing.reason, 'unsupported_capability');
    const rejected = makeFixture({ authorizeActor: () => { throw new Error('private auth detail'); } }).boundary;
    assert.strictEqual((await rejected.chat({ action: 'list', actor: actor('alice') })).reason, 'not_authenticated');
  });

  await check('Relationship Adapters accept canonical friendship rows and null non-block results', async () => {
    const objectRelations = makeFixture({
      isFriend: (a, b) => ({ id: [a, b].sort().join('|'), aUid: [a, b].sort()[0], bUid: [a, b].sort()[1] }),
      isBlockedBetween: () => null,
    });
    const result = await objectRelations.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_relation_01', text: 'row' });
    assert.strictEqual(result.ok, true);
  });

  let sent;
  await check('Send normalizes NFC/control characters and emits only server fields', async () => {
    sent = await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_msg_0001', text: '<b>plain</b>\u0000\r\n下一行' });
    assert.strictEqual(sent.ok, true);
    assert.strictEqual(sent.message.senderUid, 'alice');
    assert.strictEqual(sent.message.recipientUid, 'bob');
    assert.strictEqual(sent.message.text, '<b>plain</b>\n下一行');
    assert(/^msg_/.test(sent.message.id) && /^\d+$/.test(sent.message.seq));
    assert(!Object.prototype.hasOwnProperty.call(sent.message, 'clientMessageId'));
  });

  await check('Duplicate and conflicting client IDs are deterministic', async () => {
    const duplicate = await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_msg_0001', text: '<b>plain</b>\r\n下一行' });
    assert.strictEqual(duplicate.ok, true);
    assert.strictEqual(duplicate.duplicate, true);
    assert.strictEqual(duplicate.messageId, sent.messageId);
    const conflict = await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_msg_0001', text: 'different' });
    assert.strictEqual(conflict.reason, 'idempotency_conflict');
  });

  await check('Concurrent sends serialize sequence allocation at the Module seam', async () => {
    const parallel = makeFixture();
    const results = await Promise.all([
      parallel.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_parallel_01', text: 'one' }),
      parallel.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_parallel_02', text: 'two' }),
    ]);
    assert(results.every(item => item.ok));
    assert.notStrictEqual(results[0].seq, results[1].seq);
  });

  await check('Unknown peers, strangers, blocks, malformed IDs and oversized text are rejected', async () => {
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'nobody', clientMessageId: 'client_msg_0002', text: 'x' })).reason, 'invalid_target');
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'stranger', clientMessageId: 'client_msg_0003', text: 'x' })).reason, 'conversation_unavailable');
    blocked.add('alice|bob');
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('bob'), peerUid: 'alice', clientMessageId: 'client_msg_0004', text: 'blocked' })).reason, 'conversation_unavailable');
    blocked.clear();
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'short', text: 'x' })).reason, 'invalid_client_message_id');
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_msg_0005', text: 'x'.repeat(501) })).reason, 'message_too_long');
  });

  await check('Hidden Test Admin targets preserve the stable isolation reason', async () => {
    assert.strictEqual((await boundary.chat({ action: 'history', actor: actor('alice'), peerUid: 'admin' })).reason, 'test_admin_isolated');
    assert.strictEqual((await boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'admin', clientMessageId: 'client_admin_001', text: 'x' })).reason, 'test_admin_isolated');
    assert.strictEqual((await boundary.chat({ action: 'read', actor: actor('alice'), peerUid: 'admin', throughSeq: '1' })).reason, 'test_admin_isolated');
  });

  await check('Hidden Test Admin history never enters list or unread projections', async () => {
    const hidden = makeFixture({
      adapter: createMemoryChatPlaylineAdapter({
        messages: [{ id: 'msg_hidden_admin', conversationId: 'admin|alice', seq: '1', senderUid: 'admin', recipientUid: 'alice', text: 'hidden', createdAt: 1_700_000_000_000 }],
        reads: [],
        nextSeq: '1',
      }),
    });
    hidden.friends.clear();
    hidden.friends.add('alice|admin');
    const state = await hidden.boundary.chat({ action: 'list', actor: actor('alice') });
    assert.strictEqual(state.ok, true);
    assert.strictEqual(state.conversations.length, 0);
    assert.strictEqual(state.unreadTotal, 0);
  });

  await check('State and history preserve unread, peer projection and ascending messages', async () => {
    const state = await boundary.chat({ action: 'chat_list', actor: actor('bob'), limit: 50 });
    assert.strictEqual(state.ok, true);
    assert.strictEqual(state.conversations.length, 1);
    assert.strictEqual(state.conversations[0].unreadCount, 1);
    const history = await boundary.chat({ action: 'chat_history', actor: actor('bob'), peerUid: 'alice', limit: 30 });
    assert.strictEqual(history.ok, true);
    assert.strictEqual(history.messages.length, 1);
    assert.strictEqual(history.messages[0].id, sent.messageId);
    assert.strictEqual(history.messages[0].text, '<b>plain</b>\n下一行');
    assert.strictEqual(history.messages[0].clientMessageId, undefined);
    assert.strictEqual((await boundary.chat({ action: 'chat_history', actor: actor('bob'), peerUid: 'alice', beforeSeq: 'bad' })).reason, 'invalid_cursor');
  });

  await check('Read cursor accepts only inbound messages and never regresses', async () => {
    const read = await boundary.chat({ action: 'chat_read', actor: actor('bob'), peerUid: 'alice', throughSeq: sent.seq });
    assert.strictEqual(read.ok, true);
    assert.strictEqual(read.throughSeq, sent.seq);
    const lower = await boundary.chat({ action: 'chat_read', actor: actor('bob'), peerUid: 'alice', throughSeq: '1' });
    assert.strictEqual(lower.ok, true);
    assert.strictEqual(lower.throughSeq, sent.seq);
    assert.strictEqual((await boundary.chat({ action: 'chat_read', actor: actor('alice'), peerUid: 'bob', throughSeq: sent.seq })).reason, 'message_not_found');
    const state = await boundary.chat({ action: 'chat_state', actor: actor('bob') });
    assert.strictEqual(state.unreadTotal, 0);
  });

  await check('Rate reservations roll back on a rejected second send', async () => {
    const limited = makeFixture({ sendShortMax: 1 });
    const first = await limited.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_rate_0001', text: 'one' });
    assert.strictEqual(first.ok, true);
    const second = await limited.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_rate_0002', text: 'two' });
    assert.strictEqual(second.reason, 'rate_limited');
    limited.setNow(limited.now() + 11000);
    const third = await limited.boundary.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_rate_0003', text: 'three' });
    assert.strictEqual(third.ok, true);
  });

  await check('List/history/read query buckets are actor-scoped and bounded', async () => {
    const limited = makeFixture({ queryMax: 1 });
    assert.strictEqual((await limited.boundary.chat({ action: 'list', actor: actor('alice') })).ok, true);
    assert.strictEqual((await limited.boundary.chat({ action: 'list', actor: actor('alice') })).reason, 'rate_limited');
    assert.strictEqual((await limited.boundary.chat({ action: 'list', actor: actor('bob') })).ok, true);
  });

  await check('Adapter failures return categorical errors and do not acknowledge a message', async () => {
    let committed = 0;
    const failing = Object.freeze({
      load() { return { messages: [], reads: [], nextSeq: '0' }; },
      commit() { committed += 1; throw new Error('private storage detail'); },
    });
    const broken = makeFixture({ adapter: failing }).boundary;
    const result = await broken.chat({ action: 'send', actor: actor('alice'), peerUid: 'bob', clientMessageId: 'client_fail_0001', text: 'x' });
    assert.strictEqual(result.reason, 'server_unavailable');
    assert.strictEqual(result.message, undefined);
    assert.strictEqual(committed, 1);
    const brokenRead = makeFixture({ adapter: Object.freeze({ load() { throw new Error('private load detail'); }, commit() {} }) }).boundary;
    assert.strictEqual((await brokenRead.chat({ action: 'list', actor: actor('alice') })).reason, 'server_unavailable');
  });

  await check('Playline delegation keeps its four-action seam and strips private fields', async () => {
    const listed = await boundary.playline({ action: 'list', actor: actor('alice'), filter: 'all', limit: 20 });
    assert.strictEqual(listed.ok, true);
    assert.strictEqual(listed.privateSource, undefined);
    const published = await boundary.playline({ action: 'publish', actor: actor('alice'), clientPostId: 'client_post_0001', audience: 'all', content: { kind: 'text', text: 'hello' } });
    assert.strictEqual(published.ok, true);
    assert.deepStrictEqual(playlineCalls[1], ['publish', 'alice', { clientPostId: 'client_post_0001', audience: 'all', content: { kind: 'text', text: 'hello' } }]);
    const report = await boundary.playline({ action: 'playline_report', actor: actor('alice'), postId: 'post_0001' });
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.privateSource, undefined);
    assert.strictEqual((await boundary.playline({ action: 'list', actor: actor('guest', { ephemeral: true }) })).reason, 'guest_forbidden');
  });

  await check('Malformed Playline adapter results fail closed without leaking implementation details', async () => {
    const broken = makeFixture({ playline: { async list() { throw new Error('password=secret'); } } }).boundary;
    const result = await broken.playline({ action: 'list', actor: actor('alice') });
    assert.strictEqual(result.reason, 'server_unavailable');
    assert(!JSON.stringify(result).includes('secret'));
    const unsafeReason = makeFixture({ playline: { async list() { return { ok: false, reason: 'Bearer password=secret' }; } } }).boundary;
    const safeReason = await unsafeReason.playline({ action: 'list', actor: actor('alice') });
    assert.strictEqual(safeReason.reason, 'server_unavailable');
    assert(!JSON.stringify(safeReason).includes('secret'));
    assert.strictEqual((await boundary.playline({ action: 'unknown', actor: actor('alice') })).reason, 'unsupported_action');
  });

  await check('Boundary source has no transport, persistence-client or player-economy coupling', () => {
    for (const pattern of [/require\(['"][^'"]*(?:index|playline|reward|replay|supabase)[^'"]*['"]\)/i, /WebSocket/i, /localStorage/i, /document\./i]) {
      assert(!pattern.test(SOURCE), `unexpected coupling ${pattern}`);
    }
  });

  await check('Canonical Adapter state remains bounded and detached after operations', async () => {
    const loaded = adapter.load();
    assert(loaded.messages.length <= 50000);
    assert(loaded.reads.length <= 50000);
    loaded.messages.push({ id: 'caller_mutation' });
    assert(!adapter.load().messages.some(row => row.id === 'caller_mutation'));
    assert.strictEqual(friends.has('alice|bob'), true);
    assert.strictEqual(blocked.size, 0);
    setNow(1_700_000_000_000);
  });

  if (failures) {
    console.error(`CHAT_PLAYLINE_BOUNDARY_FAILURES=${failures}/${assertions}`);
    process.exitCode = 1;
  } else {
    console.log(`CHAT_PLAYLINE_BOUNDARY_ALL_PASS assertions=${assertions}`);
  }
}

main().catch(error => {
  console.error('CHAT_PLAYLINE_BOUNDARY_CRASH', error && error.stack || error);
  process.exitCode = 1;
});
