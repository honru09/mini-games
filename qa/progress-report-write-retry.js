'use strict';

const assert = require('assert');
const { writeFileWithTransientRetry } = require('../scripts/generate-progress-reports');

let attempts = 0;
writeFileWithTransientRetry('report.md', 'ok', (filePath, content, encoding) => {
  attempts += 1;
  assert.equal(filePath, 'report.md');
  assert.equal(content, 'ok');
  assert.equal(encoding, 'utf8');
  if (attempts < 3) {
    const error = new Error('transient lock');
    error.code = attempts === 1 ? 'UNKNOWN' : 'EBUSY';
    throw error;
  }
});
assert.equal(attempts, 3, 'transient writes should retry until success');

const fatal = new Error('disk full');
fatal.code = 'ENOSPC';
let fatalAttempts = 0;
assert.throws(() => writeFileWithTransientRetry('report.md', 'no', () => {
  fatalAttempts += 1;
  throw fatal;
}), error => error === fatal);
assert.equal(fatalAttempts, 1, 'non-transient writes should fail immediately');

let exhaustedAttempts = 0;
assert.throws(() => writeFileWithTransientRetry('report.md', 'no', () => {
  exhaustedAttempts += 1;
  const error = new Error('still locked');
  error.code = 'EPERM';
  throw error;
}), error => error && error.code === 'EPERM');
assert.equal(exhaustedAttempts, 5, 'transient writes should stop after the bounded limit');

console.log('PROGRESS_REPORT_WRITE_RETRY_ALL_PASS');
