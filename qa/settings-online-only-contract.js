'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appShellSource = fs.readFileSync(path.join(__dirname, '../public/src/core/02-app-shell.js'), 'utf8');
const rawWebsocketSource = fs.readFileSync(path.join(__dirname, '../public/src/online/03-websocket.js'), 'utf8');
const websocketSource = rawWebsocketSource
  + '\n;globalThis.__online = online; globalThis.__resolveServer = resolveServer;';
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL  ' + name + ' :: ' + error.message);
  }
}

function loadClient(location, legacyServerValue) {
  const sockets = [];
  let legacyServerRead = false;
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      sockets.push(this);
    }
    send() {}
  }
  const node = {
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    innerHTML: '',
    textContent: '',
  };
  const context = {
    console, Date, Map, Set, JSON, URLSearchParams,
    WebSocket: FakeWebSocket,
    location,
    localStorage: {
      getItem(key) {
        if (key === 'mg_server') {
          legacyServerRead = true;
          return legacyServerValue;
        }
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    document: {},
    $: () => node,
    t: key => key,
    toast() {},
    localizeRuntimeText: value => value,
    showHub() {},
    closeTournamentStateModal() {},
    currentGameId: null,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  context.globalThis = context;
  vm.runInNewContext(websocketSource, context, { filename: '03-websocket.js' });
  return { online: context.__online, resolveServer: context.__resolveServer, sockets, readLegacyServer: () => legacyServerRead };
}

check('settings source exposes no mutable server address surface', () => {
  const settingsSource = appShellSource + '\n' + rawWebsocketSource;
  assert(!/\bmg_server\b/.test(settingsSource), 'settings must not read or write mg_server');
  assert(!/server_(?:config|placeholder|note)/.test(settingsSource), 'settings must not render server controls');
});

check('production connection ignores legacy mg_server and uses Render', () => {
  const client = loadClient({ protocol: 'https:', host: 'honru09.github.io', hostname: 'honru09.github.io' }, 'https://legacy.example.invalid');
  assert.strictEqual(client.resolveServer(), 'https://mini-games-online.onrender.com');
  assert.strictEqual(client.readLegacyServer(), false, 'legacy storage must be retained but never read');
  client.online.connect();
  assert.strictEqual(client.sockets[0].url, 'wss://mini-games-online.onrender.com/ws');
});

check('local development remains same-origin despite a legacy mg_server value', () => {
  const client = loadClient({ protocol: 'http:', host: 'localhost:8080', hostname: 'localhost' }, 'https://legacy.example.invalid');
  assert.strictEqual(client.resolveServer(), '');
  assert.strictEqual(client.readLegacyServer(), false, 'local development must not consult legacy storage');
  client.online.connect();
  assert.strictEqual(client.sockets[0].url, 'ws://localhost:8080/ws');
});

if (failures.length) {
  console.error('SETTINGS_ONLINE_ONLY_CONTRACT_FAILED');
  process.exit(1);
}
console.log('SETTINGS_ONLINE_ONLY_CONTRACT_ALL_PASS');
