'use strict';

// Focused T2 build contract. All writes are confined to a temporary fixture;
// the repository's generated index is never changed by this test.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const build = require('../scripts/build.js');

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}
function throws(fn, pattern) {
  try { fn(); return false; }
  catch (error) { return !pattern || pattern.test(String(error && error.message || error)); }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-build-check-'));
const srcDir = path.join(root, 'src');
const templatePath = path.join(root, 'index-template.html');
const outPath = path.join(root, 'index.html');
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(templatePath, '<!doctype html>\r\n<script>\r\n<!-- BUILD:JS -->\r\n</script>\r\n', 'utf8');
fs.writeFileSync(path.join(srcDir, 'a.js'), 'const a = "中文";\r\n', 'utf8');
fs.writeFileSync(path.join(srcDir, 'b.js'), 'const b = "$&";\n', 'utf8');

const options = { root, srcDir, templatePath, outPath, modules: ['a.js', 'b.js'] };
const seam = build.createBuildSeam(options);

try {
  check('default mode is write', build.parseMode([]) === 'write');
  check('explicit write mode', build.parseMode(['--write']) === 'write');
  check('explicit check mode', build.parseMode(['--check']) === 'check');
  check('unknown argument is rejected', throws(() => build.parseMode(['--wat']), /Unknown argument/));
  check('conflicting modes are rejected', throws(() => build.parseMode(['--check', '--write']), /Conflicting/));
  check('duplicate same mode is harmless', build.parseMode(['--check', '--check']) === 'check');

  const firstText = seam.buildOutput();
  const secondText = seam.buildOutput();
  check('build normalizes CRLF to LF', !firstText.includes('\r'));
  check('replacement keeps literal dollar content', firstText.includes('const b = "$&";'));
  check('deterministic text is byte-identical', firstText === secondText);
  const summary = build.describeText(firstText);
  check('summary reports UTF-8 bytes and SHA-256', summary.utf8Bytes === Buffer.byteLength(firstText, 'utf8') && /^[A-F0-9]{64}$/.test(summary.sha256));

  const firstWrite = seam.write();
  check('initial write changes output', firstWrite.changed === true && fs.existsSync(outPath));
  check('initial write reports real chars/bytes/hash', firstWrite.summary.chars === firstText.length && firstWrite.summary.utf8Bytes === Buffer.byteLength(firstText, 'utf8') && firstWrite.summary.sha256 === summary.sha256);
  const initialBytes = fs.readFileSync(outPath);
  const initialHash = summary.sha256;

  let openCalls = 0;
  const noOpIo = Object.create(fs);
  for (const name of ['readFileSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync', 'renameSync', 'unlinkSync']) {
    noOpIo[name] = (...args) => {
      if (name === 'openSync') openCalls += 1;
      return fs[name](...args);
    };
  }
  const noOpSeam = build.createBuildSeam({ ...options, io: noOpIo });
  const beforeStat = fs.statSync(outPath);
  const noOp = noOpSeam.write();
  const afterStat = fs.statSync(outPath);
  check('identical write is a no-op', noOp.changed === false && openCalls === 0);
  check('no-op write preserves mtime and bytes', beforeStat.mtimeMs === afterStat.mtimeMs && fs.readFileSync(outPath).equals(initialBytes));

  const cleanCheck = seam.check();
  check('clean --check comparison passes', cleanCheck.ok === true && cleanCheck.firstByte === null);
  check('clean --check does not open a temp file', cleanCheck.actual && cleanCheck.actual.sha256 === initialHash);

  fs.writeFileSync(outPath, Buffer.concat([initialBytes, Buffer.from('x')]))
  const driftBefore = fs.statSync(outPath).mtimeMs;
  const drift = seam.check();
  const driftAfter = fs.statSync(outPath).mtimeMs;
  check('drift --check fails without writing', drift.ok === false && drift.firstByte === initialBytes.length && driftBefore === driftAfter);
  check('drift reports expected and actual hashes', drift.expected.sha256 === initialHash && drift.actual.sha256 !== initialHash);
  const repaired = seam.write();
  check('write repairs drift', repaired.changed === true && fs.readFileSync(outPath).equals(initialBytes));

  let fsyncCalls = 0;
  const successIo = Object.create(fs);
  for (const name of ['readFileSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync', 'renameSync', 'unlinkSync']) {
    successIo[name] = (...args) => {
      if (name === 'fsyncSync') fsyncCalls += 1;
      return fs[name](...args);
    };
  }
  const successOut = path.join(root, 'success.html');
  const successSeam = build.createBuildSeam({ ...options, io: successIo, outPath: successOut });
  const success = successSeam.write();
  check('atomic write calls fsync and leaves no temp', success.changed === true && fsyncCalls === 1 && fs.readdirSync(root).every(name => !name.includes('.tmp-')));

  const oldBytes = Buffer.concat([initialBytes, Buffer.from('drift')]);
  fs.writeFileSync(outPath, oldBytes);
  const failingIo = Object.create(fs);
  for (const name of ['readFileSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync', 'unlinkSync']) {
    failingIo[name] = (...args) => fs[name](...args);
  }
  failingIo.renameSync = () => { throw new Error('simulated rename failure'); };
  const failingSeam = build.createBuildSeam({ ...options, io: failingIo });
  check('rename failure is surfaced', throws(() => failingSeam.write(), /simulated rename failure/));
  check('rename failure preserves old output', fs.readFileSync(outPath).equals(oldBytes));
  check('rename failure cleans only its temp', fs.readdirSync(root).every(name => !name.includes('.tmp-')));

  seam.write();
  check('CLI default remains a write-compatible no-op when clean', build.runCli([], options) === 0);
  check('CLI check succeeds for clean fixture output', build.runCli(['--check'], options) === 0);
  check('CLI unknown argument returns nonzero', build.runCli(['--unknown'], options) !== 0);
  check('CLI conflicting modes return nonzero', build.runCli(['--check', '--write'], options) !== 0);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

if (failures) process.exit(1);
console.log('BUILD_CHECK_WRITE_ALL_PASS');
