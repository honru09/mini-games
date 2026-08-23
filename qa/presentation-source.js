'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'index-template.html');
const PRESENTATION_LINK = /<link\b(?=[^>]*\bdata-presentation-style\b)[^>]*\bhref="([^"]+)"[^>]*>/g;

function readTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf8');
}

function presentationStylePaths(template = readTemplate()) {
  const paths = [];
  for (const match of template.matchAll(PRESENTATION_LINK)) {
    const href = match[1];
    if (!href || /^(?:[a-z]+:|\/\/)/i.test(href) || href.includes('..')) {
      throw new Error(`Unsafe presentation stylesheet href: ${href || '<empty>'}`);
    }
    paths.push(path.join(ROOT, 'public', ...href.split('/')));
  }
  if (!paths.length) throw new Error('No data-presentation-style links found in index-template.html');
  return Object.freeze(paths);
}

function readPresentationCss(template = readTemplate()) {
  return presentationStylePaths(template)
    .map(filePath => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function readPresentationSource() {
  const template = readTemplate();
  // Tests that inspect DOM and CSS can use one stable read seam even though
  // production keeps the presentation modules external. The synthetic style
  // wrapper is QA-only and is never emitted into a browser build.
  return `${template}\n<style data-qa-presentation-source>\n${readPresentationCss(template)}\n</style>`;
}

module.exports = Object.freeze({
  ROOT,
  TEMPLATE_PATH,
  presentationStylePaths,
  readPresentationCss,
  readPresentationSource,
  readTemplate,
});
