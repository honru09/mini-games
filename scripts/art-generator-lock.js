'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const waitCell = new Int32Array(new SharedArrayBuffer(4));

function waitSync(milliseconds) {
  const duration = Math.max(0, Math.floor(Number(milliseconds) || 0));
  if (duration > 0) Atomics.wait(waitCell, 0, 0, duration);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !error || error.code !== 'ESRCH';
  }
}

function readOwner(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function acquireArtGeneratorLock(lockPath, options = {}) {
  const resolved = path.resolve(lockPath);
  const generatorId = String(options.generatorId || 'unknown-art-generator');
  const waitMs = Math.max(0, Math.min(300000, Number(options.waitMs) || 0));
  const pollMs = Math.max(10, Math.min(1000, Number(options.pollMs) || 50));
  const deadline = Date.now() + waitMs;
  let staleAttempted = false;
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  while (true) {
    const token = crypto.randomBytes(16).toString('hex');
    let fd;
    try {
      fd = fs.openSync(resolved, 'wx');
      fs.writeFileSync(fd, `${JSON.stringify({
        pid: process.pid,
        generatorId,
        token,
        acquiredAt: new Date().toISOString(),
      })}\n`);

      let released = false;
      return function releaseArtGeneratorLock() {
        if (released) return;
        released = true;
        try { fs.closeSync(fd); } catch (_) {}
        const current = readOwner(resolved);
        if (current && current.token === token) {
          try { fs.unlinkSync(resolved); } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
          }
        }
      };
    } catch (error) {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch (_) {}
      }
      if (!error || error.code !== 'EEXIST') throw error;

      const owner = readOwner(resolved);
      if (!staleAttempted && owner && Number.isInteger(owner.pid) && !isProcessAlive(owner.pid)) {
        staleAttempted = true;
        try {
          fs.unlinkSync(resolved);
          continue;
        } catch (unlinkError) {
          if (!unlinkError || unlinkError.code !== 'ENOENT') throw unlinkError;
          continue;
        }
      }

      const remaining = deadline - Date.now();
      if (remaining > 0) {
        waitSync(Math.min(pollMs, remaining));
        continue;
      }

      const collision = new Error(
        `ART_GENERATOR_LOCKED: ${generatorId} cannot acquire ${resolved}; held by ${owner && owner.generatorId || 'unknown'} (pid ${owner && owner.pid || 'unknown'})`,
      );
      collision.code = 'ART_GENERATOR_LOCKED';
      throw collision;
    }
  }
}

function acquireArtRegistryLock(rootPath, options = {}) {
  const root = path.resolve(rootPath);
  return acquireArtGeneratorLock(
    path.join(root, '.tmp', 'art-generator-locks', 'asset-registry.lock'),
    {
      ...options,
      generatorId:String(options.generatorId || 'unknown-art-registry-writer'),
      waitMs:options.waitMs === undefined ? 120000 : options.waitMs,
    },
  );
}

module.exports = { acquireArtGeneratorLock, acquireArtRegistryLock };
