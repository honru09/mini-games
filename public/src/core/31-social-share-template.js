/*
 * Ghost Social Share Template
 *
 * Presentation-only composition for Playline game/result/record cards. The
 * module consumes already-localized, bounded display strings and existing
 * owner-cleared decorative art. It owns no post, result, replay, identity,
 * visibility, permission, signing, protocol or persistence fact.
 */
(function installGhostSocialShareTemplate(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.GhostSocialShareTemplate = api.create({ root: root });
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGhostSocialShareTemplateModule() {
  'use strict';

  var KINDS = Object.freeze({ game_share: true, result_share: true, record_share: true });
  var ROLES = Object.freeze({ 'card-playline': true, 'card-result': true, 'card-record': true });
  var ROLE_BY_KIND = Object.freeze({ game_share: 'card-playline', result_share: 'card-result', record_share: 'card-record' });
  var TONES = Object.freeze({ neutral: true, win: true, draw: true, loss: true, record: true });

  function text(value, limit) {
    var normalized = String(value === undefined || value === null ? '' : value).normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ').trim();
    return normalized.slice(0, limit);
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

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    var resolveArt = typeof opts.resolveArt === 'function' ? opts.resolveArt : function (role, useStatic) {
      if (!root || typeof root.resolveCommunityReplayTournamentCardUrl !== 'function') return Promise.resolve('');
      return root.resolveCommunityReplayTournamentCardUrl(role, useStatic);
    };

    function mount(host, input) {
      var doc = host && host.ownerDocument || root && root.document;
      if (!host || !doc || typeof doc.createElement !== 'function' || !input || typeof input !== 'object') return null;
      var kind = KINDS[String(input.kind || '')] ? String(input.kind) : '';
      var role = ROLES[String(input.role || '')] ? String(input.role) : '';
      if (!kind || !role || ROLE_BY_KIND[kind] !== role) return null;
      var model = Object.freeze({
        kind: kind,
        role: role,
        tone: TONES[String(input.tone || '')] ? String(input.tone) : 'neutral',
        kicker: text(input.kicker, 48),
        title: text(input.title, 80),
        metric: text(input.metric, 40),
        detail: text(input.detail, 120),
        brand: text(input.brand || 'GHOST GAME', 32)
      });
      var generation = 1;
      var destroyed = false;
      var figure = createNode(doc, 'figure', 'social-share-template social-share-template--' + model.kind);
      figure.dataset && (figure.dataset.socialShareTemplate = 'v1');
      figure.dataset && (figure.dataset.shareTone = model.tone);
      figure.setAttribute && figure.setAttribute('aria-hidden', 'true');

      var fallback = createNode(doc, 'div', 'social-share-template-fallback');
      var signal = createNode(doc, 'span', 'social-share-template-signal');
      signal.appendChild(createNode(doc, 'i', 'social-share-template-eye social-share-template-eye--left'));
      signal.appendChild(createNode(doc, 'i', 'social-share-template-eye social-share-template-eye--right'));
      fallback.appendChild(signal);
      figure.appendChild(fallback);

      var art = createNode(doc, 'img', 'community-card-art social-share-template-art');
      art.alt = '';
      art.loading = 'lazy';
      art.decoding = 'async';
      art.hidden = true;
      figure.appendChild(art);

      var wash = createNode(doc, 'div', 'social-share-template-wash');
      var copy = createNode(doc, 'figcaption', 'social-share-template-copy');
      var brand = createNode(doc, 'span', 'social-share-template-brand', model.brand);
      var kicker = createNode(doc, 'span', 'social-share-template-kicker', model.kicker);
      var title = createNode(doc, 'strong', 'social-share-template-title', model.title);
      var metric = createNode(doc, 'b', 'social-share-template-metric', model.metric);
      var detail = createNode(doc, 'small', 'social-share-template-detail', model.detail);
      copy.appendChild(brand); copy.appendChild(kicker); copy.appendChild(title);
      if (model.metric) copy.appendChild(metric);
      if (model.detail) copy.appendChild(detail);
      figure.appendChild(wash); figure.appendChild(copy); host.appendChild(figure);

      var request = generation;
      function failArt() {
        if (destroyed || request !== generation || figure.isConnected === false) return;
        art.hidden = true;
        try { art.removeAttribute && art.removeAttribute('src'); } catch (_error) {}
        figure.dataset && (figure.dataset.artState = 'fallback');
      }
      function revealArt() {
        if (destroyed || request !== generation || figure.isConnected === false) return;
        art.hidden = false;
        figure.dataset && (figure.dataset.artState = 'ready');
      }
      Promise.resolve().then(function () { return resolveArt(model.role, reduced(root)); }).then(function (url) {
        if (destroyed || request !== generation || figure.isConnected === false) return;
        if (!url) { failArt(); return; }
        art.onload = function () {
          if (typeof art.decode !== 'function') { revealArt(); return; }
          Promise.resolve().then(function () { return art.decode(); }).then(revealArt).catch(failArt);
        };
        art.onerror = failArt;
        art.src = String(url);
      }).catch(function () {
        failArt();
      });

      function destroy() {
        if (destroyed) return false;
        destroyed = true; generation += 1;
        art.onload = null; art.onerror = null;
        try { art.removeAttribute && art.removeAttribute('src'); } catch (_error) {}
        if (figure.parentNode && typeof figure.parentNode.removeChild === 'function') figure.parentNode.removeChild(figure);
        else if (typeof figure.remove === 'function') figure.remove();
        return true;
      }
      return Object.freeze({ root: figure, destroy: destroy, snapshot: function () {
        return Object.freeze({ destroyed: destroyed, kind: model.kind, role: model.role, tone: model.tone, artReady: !art.hidden });
      } });
    }

    return Object.freeze({ mount: mount });
  }

  return Object.freeze({ create: create });
}));
