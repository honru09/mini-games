'use strict';

// Deliberately mutable: each fresh Node process must observe touches === 0
// before this probe increments it.  The parent test process may also require
// this module; a child must never see that parent's object or require.cache.
module.exports = {
  loadedPid: process.pid,
  touches: 0,
};

