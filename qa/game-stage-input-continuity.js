#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const shellSource = read('public/src/core/02-app-shell.js');
const rosterSource = read('public/src/ui/07-roster.js');
const template = read('public/index-template.html');
const GAME_IDS = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
let failures = 0;

function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

check('六款游戏均注册到同一 showGame/createGameInstance Shell 入口',
  GAME_IDS.every(id => new RegExp(`\\b${id}:\\s*\\{`).test(read('public/src/core/01-utils.js'))) &&
  /function showGame\(id\)[\s\S]*?createGameInstance\(id/.test(rosterSource) &&
  (rosterSource.match(/enterImmersiveGameShell\(id\)/g) || []).length >= 2);
check('局内返回按钮继续只走 showHub，不绕过 Shell 生命周期',
  /\$\('btn-back'\)\.addEventListener\('click',\s*showHub\)/.test(rosterSource) &&
  /function showHub\(\)[\s\S]*?exitImmersiveGameShell\(\)/.test(rosterSource));
check('房主结束按钮与服务端 end_game 仍进入统一 finishRoomGame',
  /\$\('btn-end-game'\)[\s\S]*?finishRoomGame\(\)/.test(rosterSource) &&
  /case 'end_game':[\s\S]*?finishRoomGame\(\)/.test(read('public/src/online/03-websocket.js')));
check('六款舞台都保留内部滚动区域，而文档滚动由 game-active 锁定',
  (template.match(/data-game-scroll-region/g) || []).length >= 3 &&
  /html\.game-active,body\.game-active\{[^}]*overflow:hidden[^}]*overscroll-behavior:none/.test(template));
check('Game Shell 控制器不停止事件传播且可移除滚轮/触摸监听',
  !/stopPropagation\s*\(/.test(shellSource.slice(shellSource.indexOf('const GAME_SHELL_SCROLL_KEYS'), shellSource.indexOf('const GAME_STAGE_FALLBACK_COLORS'))) &&
  /addEventListener\('wheel'/.test(shellSource) && /removeEventListener\('wheel'/.test(shellSource) &&
  /addEventListener\('touchmove'/.test(shellSource) && /removeEventListener\('touchmove'/.test(shellSource));

function classList() {
  const values = new Set();
  return { add: (...items) => items.forEach(item => values.add(item)), remove: (...items) => items.forEach(item => values.delete(item)), contains: item => values.has(item) };
}
function node(parent = null) {
  const attrs = Object.create(null);
  return {
    parent, dataset: {}, classList: classList(), isConnected: true, tabIndex: -1,
    focusCount: 0, scrollHeight: 100, clientHeight: 100,
    focus() { this.focusCount += 1; context.document.activeElement = this; },
    contains(target) { for (let current = target; current; current = current.parent) if (current === this) return true; return false; },
    closest(selector) { for (let current = this; current; current = current.parent) if (selector === '[data-game-scroll-region]' && current.dataset.gameScrollRegion !== undefined) return current; return null; },
    querySelectorAll() { return []; },
    setAttribute(key, value) { attrs[key] = String(value); },
    getAttribute(key) { return attrs[key] || null; },
    removeAttribute(key) { delete attrs[key]; },
  };
}

const html = node();
const body = node(html);
const stage = node(body);
stage.focus = function focus() { this.focusCount += 1; context.document.activeElement = this; };
const returnFocus = node(body);
const gameCard = node(body);
gameCard.dataset.gameId = 'gomoku';
const listeners = new Map();
const scrollCalls = [];
const context = {
  console, Set, Map, Array, Object, String, Number, Math, JSON,
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  requestAnimationFrame(fn) { fn(); return 1; },
  window: { scrollX: 12, scrollY: 34, scrollTo(x, y) { scrollCalls.push([x, y]); }, dispatchEvent() {} },
  document: {
    body, documentElement: html, activeElement: returnFocus,
    getElementById(id) { return id === 'screen-game' ? stage : null; },
    querySelectorAll(selector) { return selector === '[data-game-id]' ? [gameCard] : []; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
  },
};
context.globalThis = context;
try {
  const start = shellSource.indexOf('const GAME_SHELL_SCROLL_KEYS');
  const end = shellSource.indexOf('const GAME_STAGE_FALLBACK_COLORS');
  vm.runInNewContext(shellSource.slice(start, end), context, { filename: 'game-stage-shell-controller.js' });
  for (const id of GAME_IDS) {
    check(`进入 ${id} 更新 Shell gameId 且激活文档锁`, context.enterImmersiveGameShell(id) === true && stage.dataset.shellGame === id && html.classList.contains('game-active') && body.classList.contains('game-active'));
    check(`${id} 退出后清理 Shell 标记并恢复滚动`, context.exitImmersiveGameShell() === true && !html.classList.contains('game-active') && !body.classList.contains('game-active') && !stage.dataset.shellGame && scrollCalls.at(-1)[0] === 12 && scrollCalls.at(-1)[1] === 34);
  }
  check('六款游戏循环进入/退出后监听器无泄漏', listeners.size === 0);
} catch (error) {
  check('Game Shell 六款生命周期 VM 可执行', false, error && error.stack || String(error));
}

if (failures) {
  console.error(`GAME_STAGE_INPUT_CONTINUITY_FAILED: ${failures}`);
  process.exit(1);
}
console.log('GAME_STAGE_INPUT_CONTINUITY_ALL_PASS');
