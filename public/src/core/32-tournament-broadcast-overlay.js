/*
 * Ghost Tournament Broadcast Overlay
 *
 * Presentation-only composition for an already-authoritative tournament
 * snapshot. It owns no tournament, spectator, replay, streaming, room,
 * identity, permission, protocol, timer or persistence fact.
 */
(function installGhostTournamentBroadcastOverlay(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.GhostTournamentBroadcastOverlay = api.create({ root: root });
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGhostTournamentBroadcastOverlayModule() {
  'use strict';

  var TONES = Object.freeze({ neutral: true, waiting: true, live: true, complete: true, finished: true });
  var TABLE_TONES = Object.freeze({ waiting: true, live: true, complete: true });
  var MAX_TABLES = 3;

  function text(value, limit) {
    return String(value === undefined || value === null ? '' : value).normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ').trim().slice(0, limit);
  }
  function integer(value, low, high, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? Math.max(low, Math.min(high, Math.floor(parsed))) : fallback;
  }
  function createNode(doc, tag, className, value) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }
  function reduced(root) {
    try { return !!(root && typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (_error) { return false; }
  }
  function hidden(root) {
    try { return !!(root && root.document && root.document.hidden === true); }
    catch (_error) { return false; }
  }
  function enabled(root, opts) {
    if (typeof opts.enabled === 'boolean') return opts.enabled;
    try { return !root || typeof root.tournamentBroadcastOverlayEnabled !== 'function' || root.tournamentBroadcastOverlayEnabled(); }
    catch (_error) { return true; }
  }

  function normalize(input) {
    if (!input || typeof input !== 'object') return null;
    var title = text(input.title, 96);
    var round = integer(input.round, 0, 99, -1);
    var maxRounds = integer(input.maxRounds, 1, 99, -1);
    if (!title || round < 0 || maxRounds < 1 || round > maxRounds) return null;
    var tables = Array.isArray(input.tables) ? input.tables.slice(0, MAX_TABLES).map(function (item) {
      item = item && typeof item === 'object' ? item : {};
      return Object.freeze({
        label: text(item.label, 40),
        players: text(item.players, 100),
        status: text(item.status, 48),
        tone: TABLE_TONES[String(item.tone || '')] ? String(item.tone) : 'waiting'
      });
    }).filter(function (item) { return item.label && item.players && item.status; }) : [];
    return Object.freeze({
      tone: TONES[String(input.tone || '')] ? String(input.tone) : 'neutral',
      brand: text(input.brand || 'GHOST GAME', 32),
      kicker: text(input.kicker, 48),
      title: title,
      status: text(input.status, 64),
      round: round,
      maxRounds: maxRounds,
      roundLabel: text(input.roundLabel, 48),
      leaderLabel: text(input.leaderLabel, 48),
      leaderName: text(input.leaderName, 64),
      leaderScore: text(input.leaderScore, 48),
      tablesLabel: text(input.tablesLabel, 48),
      emptyLabel: text(input.emptyLabel, 80),
      tables: Object.freeze(tables)
    });
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    var resolveArt = typeof opts.resolveArt === 'function' ? opts.resolveArt : function () {
      if (!root || typeof root.resolveCommunityReplayTournamentCardUrl !== 'function') return Promise.resolve('');
      return root.resolveCommunityReplayTournamentCardUrl('card-tournament', reduced(root));
    };
    var loader = typeof opts.loadAdapter === 'function'
      ? opts.loadAdapter
      : function loadDefaultAdapter() { return import('./tournament-broadcast-motion-entry.js'); };

    function mount(host, input) {
      var doc = host && host.ownerDocument || root && root.document;
      var model = normalize(input);
      if (!enabled(root, opts) || !host || !doc || typeof doc.createElement !== 'function' || !model) return null;
      var destroyed = false;
      var generation = 1;
      var adapter = null;
      var adapterPromise = null;
      var active = null;
      var reduceQuery = null;
      try { if (root && typeof root.matchMedia === 'function') reduceQuery = root.matchMedia('(prefers-reduced-motion: reduce)'); } catch (_error) {}
      function isReduced() { return reduceQuery ? !!reduceQuery.matches : reduced(root); }

      var overlay = createNode(doc, 'section', 'tournament-broadcast-overlay tournament-broadcast-overlay--' + model.tone);
      overlay.dataset && (overlay.dataset.tournamentBroadcastOverlay = 'v1');
      overlay.dataset && (overlay.dataset.broadcastTone = model.tone);
      overlay.setAttribute && overlay.setAttribute('aria-hidden', 'true');

      var art = createNode(doc, 'img', 'tournament-broadcast-art');
      art.alt = '';
      art.loading = 'lazy';
      art.decoding = 'async';
      art.hidden = true;
      art.setAttribute && art.setAttribute('aria-hidden', 'true');
      overlay.appendChild(art);

      var header = createNode(doc, 'header', 'tournament-broadcast-header');
      var signal = createNode(doc, 'span', 'tournament-broadcast-signal');
      signal.appendChild(createNode(doc, 'i', 'tournament-broadcast-dot'));
      signal.appendChild(createNode(doc, 'span', null, model.kicker));
      header.appendChild(signal);
      header.appendChild(createNode(doc, 'span', 'tournament-broadcast-brand', model.brand));
      overlay.appendChild(header);

      var hero = createNode(doc, 'div', 'tournament-broadcast-hero tournament-broadcast-motion-item');
      var copy = createNode(doc, 'div', 'tournament-broadcast-copy');
      copy.appendChild(createNode(doc, 'small', 'tournament-broadcast-status', model.status));
      copy.appendChild(createNode(doc, 'strong', 'tournament-broadcast-title', model.title));
      copy.appendChild(createNode(doc, 'span', 'tournament-broadcast-round', model.roundLabel));
      hero.appendChild(copy);
      var ghost = createNode(doc, 'span', 'tournament-broadcast-ghost');
      ghost.appendChild(createNode(doc, 'i', 'tournament-broadcast-eye tournament-broadcast-eye--left'));
      ghost.appendChild(createNode(doc, 'i', 'tournament-broadcast-eye tournament-broadcast-eye--right'));
      hero.appendChild(ghost);
      overlay.appendChild(hero);

      var leader = createNode(doc, 'div', 'tournament-broadcast-leader tournament-broadcast-motion-item');
      leader.appendChild(createNode(doc, 'span', 'tournament-broadcast-label', model.leaderLabel));
      leader.appendChild(createNode(doc, 'strong', 'tournament-broadcast-leader-name', model.leaderName || '—'));
      leader.appendChild(createNode(doc, 'b', 'tournament-broadcast-leader-score', model.leaderScore));
      overlay.appendChild(leader);

      var tables = createNode(doc, 'div', 'tournament-broadcast-tables');
      tables.appendChild(createNode(doc, 'span', 'tournament-broadcast-label', model.tablesLabel));
      var tableGrid = createNode(doc, 'div', 'tournament-broadcast-table-grid');
      if (!model.tables.length) tableGrid.appendChild(createNode(doc, 'div', 'tournament-broadcast-empty tournament-broadcast-motion-item', model.emptyLabel));
      model.tables.forEach(function (table) {
        var card = createNode(doc, 'div', 'tournament-broadcast-table tournament-broadcast-table--' + table.tone + ' tournament-broadcast-motion-item');
        card.appendChild(createNode(doc, 'span', 'tournament-broadcast-table-label', table.label));
        card.appendChild(createNode(doc, 'strong', 'tournament-broadcast-table-players', table.players));
        card.appendChild(createNode(doc, 'small', 'tournament-broadcast-table-status', table.status));
        tableGrid.appendChild(card);
      });
      tables.appendChild(tableGrid);
      overlay.appendChild(tables);
      host.appendChild(overlay);

      var artRequest = generation;
      function failArt() {
        if (destroyed || artRequest !== generation || overlay.isConnected === false) return;
        art.hidden = true;
        try { art.removeAttribute && art.removeAttribute('src'); } catch (_error) {}
        overlay.dataset && (overlay.dataset.artState = 'fallback');
      }
      function revealArt() {
        if (destroyed || artRequest !== generation || overlay.isConnected === false) return;
        art.hidden = false;
        overlay.dataset && (overlay.dataset.artState = 'ready');
      }
      Promise.resolve().then(resolveArt).then(function (url) {
        if (destroyed || artRequest !== generation || overlay.isConnected === false) return;
        if (!url) { failArt(); return; }
        art.onload = function () {
          if (typeof art.decode !== 'function') { revealArt(); return; }
          Promise.resolve().then(function () { return art.decode(); }).then(revealArt).catch(failArt);
        };
        art.onerror = failArt;
        art.src = String(url);
      }).catch(failArt);

      function settle() {
        if (active && typeof active.kill === 'function') { try { active.kill(); } catch (_error) {} }
        active = null;
        if (adapter && typeof adapter.settle === 'function') { try { adapter.settle(); } catch (_error) {} }
      }
      function loadMotion() {
        if (adapter) return Promise.resolve(adapter);
        if (!adapterPromise) adapterPromise = Promise.resolve().then(loader).then(function (moduleValue) {
          if (!moduleValue || typeof moduleValue.createTournamentBroadcastMotionAdapter !== 'function') return null;
          var created = moduleValue.createTournamentBroadcastMotionAdapter({ root: overlay });
          if (destroyed) { try { created && created.dispose && created.dispose(); } catch (_error) {} return null; }
          adapter = created;
          return adapter;
        }).catch(function () { return null; });
        return adapterPromise;
      }
      function animate() {
        if (destroyed || isReduced() || hidden(root) || overlay.isConnected === false) return 'static';
        var request = generation;
        loadMotion().then(function (motion) {
          if (destroyed || request !== generation || isReduced() || hidden(root) || overlay.isConnected === false || !motion || typeof motion.intro !== 'function') return;
          active = motion.intro({
            shell: overlay,
            items: overlay.querySelectorAll ? overlay.querySelectorAll('.tournament-broadcast-motion-item') : [],
            dot: model.tone === 'live' && overlay.querySelector ? overlay.querySelector('.tournament-broadcast-dot') : null,
            onComplete: function () { if (!destroyed && request === generation) active = null; }
          });
        });
        return 'loading';
      }
      function onVisibilityChange() { if (hidden(root)) settle(); }
      function onReducedChange(event) { if (event && event.matches) settle(); }
      if (doc.addEventListener) doc.addEventListener('visibilitychange', onVisibilityChange);
      if (reduceQuery && typeof reduceQuery.addEventListener === 'function') reduceQuery.addEventListener('change', onReducedChange);
      else if (reduceQuery && typeof reduceQuery.addListener === 'function') reduceQuery.addListener(onReducedChange);
      animate();

      function destroy() {
        if (destroyed) return false;
        destroyed = true; generation += 1; settle();
        art.onload = null; art.onerror = null;
        try { art.removeAttribute && art.removeAttribute('src'); } catch (_error) {}
        if (doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisibilityChange);
        if (reduceQuery && typeof reduceQuery.removeEventListener === 'function') reduceQuery.removeEventListener('change', onReducedChange);
        else if (reduceQuery && typeof reduceQuery.removeListener === 'function') reduceQuery.removeListener(onReducedChange);
        if (adapter && typeof adapter.dispose === 'function') { try { adapter.dispose(); } catch (_error) {} }
        adapter = null;
        if (overlay.parentNode && typeof overlay.parentNode.removeChild === 'function') overlay.parentNode.removeChild(overlay);
        else if (typeof overlay.remove === 'function') overlay.remove();
        return true;
      }
      return Object.freeze({ root: overlay, destroy: destroy, snapshot: function () {
        return Object.freeze({ destroyed: destroyed, tone: model.tone, round: model.round, maxRounds: model.maxRounds, tables: model.tables.length, adapterLoaded: !!adapter });
      } });
    }

    return Object.freeze({ mount: mount });
  }

  return Object.freeze({ create: create });
}));
