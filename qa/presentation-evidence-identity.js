'use strict';

const assert = require('assert');
const { readPresentationIdentity, matchesPresentationIdentity } = require('../shared/presentation/presentation-identity');

const identity = readPresentationIdentity();
assert.strictEqual(identity.schemaVersion, 1);
assert.strictEqual(identity.presentation.fileCount, 15, 'all ordered presentation modules participate in evidence identity');
assert.strictEqual(identity.layout.fileCount, 6, 'layout manifest and five imported layout modules participate in evidence identity');
assert(identity.presentation.bytes > 300000 && /^[A-F0-9]{64}$/.test(identity.presentation.sha256));
assert(identity.layout.bytes > 10000 && /^[A-F0-9]{64}$/.test(identity.layout.sha256));
assert.strictEqual(identity.cacheVersion, 'ghost-game-shell-v22-20260824');
assert(matchesPresentationIdentity(JSON.parse(JSON.stringify(identity)), identity), 'an exact recorded identity is current');
assert(!matchesPresentationIdentity(null, identity), 'missing presentation identity is never current');
assert(!matchesPresentationIdentity({...identity, cacheVersion:'stale-cache'}, identity), 'stale cache generation is never current');
assert(!matchesPresentationIdentity({...identity, presentation:{...identity.presentation, sha256:'0'.repeat(64)}}, identity), 'stale presentation CSS is never current');
assert(!matchesPresentationIdentity({...identity, layout:{...identity.layout, bytes:identity.layout.bytes+1}}, identity), 'stale layout CSS is never current');

console.log(`PRESENTATION_EVIDENCE_IDENTITY_ALL_PASS presentation=${identity.presentation.sha256} layout=${identity.layout.sha256} cache=${identity.cacheVersion}`);
