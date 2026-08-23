'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
const sql = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8');
const slice = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));
const priceSource = slice(server, 'const SHOP_PRICES', 'const GAME_COSMETIC_CATALOG');
const context = vm.createContext({});
vm.runInContext(priceSource + '\nglobalThis.prices = SHOP_PRICES;', context);
const prices = context.prices;
assert(prices && typeof prices === 'object');

const categories = Object.keys(prices);
for (const category of categories) {
  const start = sql.indexOf(`when '${category}' then case p_item_id`);
  assert(start >= 0, `missing SQL category ${category}`);
  const end = sql.indexOf("\n    when '", start + 10);
  const block = sql.slice(start, end >= 0 ? end : sql.indexOf('\n    else null', start));
  for (const [id, price] of Object.entries(prices[category])) {
    assert(new RegExp(`when\\s+${Number(id)}\\s+then\\s+${Number(price)}\\b`).test(block), `${category}:${id}=${price} missing from apply_purchase_v1`);
  }
}

assert(/sbApplyPurchaseTransaction\([\s\S]*?\.then\([\s\S]*?\.catch\(\(\)\s*=>/.test(server), 'Supabase purchase rejection must map to purchase_sync_failed');
console.log(`SHOP_SUPABASE_CATALOG_PARITY_ALL_PASS categories=${categories.length} items=${categories.reduce((n, key) => n + Object.keys(prices[key]).length, 0)}`);
