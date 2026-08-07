'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const languages = ['zh-CN', 'en-US', 'uk-UA'];

function topLevelJsonKeys(source) {
  const keys = [];
  let depth = 0, expectingKey = false;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '"') {
      const start = i++;
      let escaped = false;
      for (; i < source.length; i++) {
        if (escaped) { escaped = false; continue; }
        if (source[i] === '\\') { escaped = true; continue; }
        if (source[i] === '"') break;
      }
      if (depth === 1 && expectingKey) {
        let cursor = i + 1;
        while (/\s/.test(source[cursor] || '')) cursor++;
        if (source[cursor] === ':') {
          keys.push(JSON.parse(source.slice(start, i + 1)));
          expectingKey = false;
        }
      }
      continue;
    }
    if (source[i] === '{' || source[i] === '[') {
      depth++;
      if (depth === 1) expectingKey = true;
    } else if (source[i] === '}' || source[i] === ']') {
      if (depth === 1) expectingKey = false;
      depth--;
    } else if (source[i] === ',' && depth === 1) {
      expectingKey = true;
    }
  }
  return keys;
}

for (const language of languages) {
  const file = path.join(root, 'public', 'locales', `${language}.json`);
  const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const keys = topLevelJsonKeys(source);
  const seen = new Set(), duplicates = new Set();
  keys.forEach(key => { if (seen.has(key)) duplicates.add(key); else seen.add(key); });
  if (duplicates.size) {
    throw new Error(`${language} has duplicate keys: ${[...duplicates].join(', ')}`);
  }
  fs.writeFileSync(file, JSON.stringify(JSON.parse(source), null, 2) + '\n', 'utf8');
  console.log(`Formatted ${language}: ${keys.length} keys`);
}
