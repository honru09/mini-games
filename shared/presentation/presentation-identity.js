'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
const PRESENTATION_LINK = /<link\b(?=[^>]*\bdata-presentation-style\b)[^>]*\bhref="([^"]+)"[^>]*>/g;
const LAYOUT_IMPORT = /@import\s+url\(['"]?([^'")]+)['"]?\)\s*;/g;

function safePublicPath(root, href) {
  const value = String(href || '').replaceAll('\\', '/');
  if (!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value) || value.split('/').includes('..')) {
    throw new Error(`Unsafe presentation identity path: ${value || '<empty>'}`);
  }
  return path.join(root, 'public', ...value.split('/'));
}

function fingerprint(root, hrefs) {
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  const files = hrefs.map((href) => {
    const content = fs.readFileSync(safePublicPath(root, href));
    const sha256 = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
    bytes += content.length;
    hash.update(href, 'utf8');
    hash.update('\0');
    hash.update(String(content.length), 'utf8');
    hash.update('\0');
    hash.update(content);
    return Object.freeze({ path: `public/${href}`, bytes: content.length, sha256 });
  });
  return Object.freeze({ fileCount: files.length, bytes, sha256: hash.digest('hex').toUpperCase(), files: Object.freeze(files) });
}

function readPresentationIdentity(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const template = fs.readFileSync(path.join(root, 'public', 'index-template.html'), 'utf8');
  const presentationHrefs = [...template.matchAll(PRESENTATION_LINK)].map((match) => match[1]);
  if (!presentationHrefs.length) throw new Error('No presentation styles found');

  const layoutManifestHref = 'ghost-layout.css';
  const layoutManifest = fs.readFileSync(safePublicPath(root, layoutManifestHref), 'utf8');
  const layoutHrefs = [layoutManifestHref, ...[...layoutManifest.matchAll(LAYOUT_IMPORT)].map((match) => {
    const imported = match[1].replace(/^\.\//, '');
    return imported.startsWith('styles/') ? imported : `styles/${imported}`;
  })];

  const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
  const cacheVersion = (sw.match(/\bCACHE_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!cacheVersion) throw new Error('Service Worker cache version is missing');

  return Object.freeze({
    schemaVersion: 1,
    presentation: fingerprint(root, presentationHrefs),
    layout: fingerprint(root, layoutHrefs),
    cacheVersion,
  });
}

function matchesPresentationIdentity(evidenceIdentity, currentIdentity) {
  if (!evidenceIdentity || !currentIdentity) return false;
  return evidenceIdentity.schemaVersion === currentIdentity.schemaVersion &&
    evidenceIdentity.cacheVersion === currentIdentity.cacheVersion &&
    evidenceIdentity.presentation && currentIdentity.presentation &&
    evidenceIdentity.presentation.fileCount === currentIdentity.presentation.fileCount &&
    evidenceIdentity.presentation.bytes === currentIdentity.presentation.bytes &&
    evidenceIdentity.presentation.sha256 === currentIdentity.presentation.sha256 &&
    evidenceIdentity.layout && currentIdentity.layout &&
    evidenceIdentity.layout.fileCount === currentIdentity.layout.fileCount &&
    evidenceIdentity.layout.bytes === currentIdentity.layout.bytes &&
    evidenceIdentity.layout.sha256 === currentIdentity.layout.sha256;
}

module.exports = Object.freeze({ readPresentationIdentity, matchesPresentationIdentity });
