const { execFileSync } = require('node:child_process');
const { mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.cwd();
const tempRoot = process.env.PUBLISH_GIT_ROOT;
if (!tempRoot) throw new Error('PUBLISH_GIT_ROOT missing');
const objects = join(tempRoot, 'objects');
const index = join(tempRoot, 'index');
mkdirSync(objects, { recursive: true });
rmSync(index, { force: true });

const env = {
  ...process.env,
  GIT_INDEX_FILE: index,
  GIT_OBJECT_DIRECTORY: objects,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: join(workspace, '.git', 'objects'),
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Codex',
  GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'codex@localhost',
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Codex',
  GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'codex@localhost',
};
const git = (args) => execFileSync('git', args, { cwd: workspace, env, encoding: 'utf8' }).trim();
git(['read-tree', 'HEAD']);
git(['add', '-A']);
const tree = git(['write-tree']);
const parent = git(['rev-parse', 'HEAD']);
const commit = git([
  'commit-tree', tree, '-p', parent,
  '-m', 'chore: close theme contrast and sync mainline evidence',
  '-m', 'Final local verification: quality gates and full npm test pass; deterministic build hash synced. External visual/device gates remain pending.',
]);
const names = git(['ls-tree', '-r', '--name-only', commit]).split(/\r?\n/).filter(Boolean);
const excluded = names.filter((name) => name.startsWith('.tmp-chrome-wavec/') || name.startsWith('.codex-tmp/'));
if (excluded.length) throw new Error(`temporary files entered publish tree: ${excluded.length}`);
console.log(`PUBLISH_COMMIT=${commit}`);
console.log(`PUBLISH_TREE=${git(['rev-parse', `${commit}^{tree}`])}`);
console.log(`PUBLISH_PARENT=${parent}`);
console.log(`TREE_FILES=${names.length}`);
