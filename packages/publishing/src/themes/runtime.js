/**
 * The Quick Book runtime — the story side of every compiled Quick Book.
 *
 * Kept as a plain string (not a function) so the package bytes are identical
 * whether the compiler runs in Node/CI or inside the Admin Studio's Vite
 * bundle: a minifier never gets a chance to rewrite it, and the predicted
 * release id matches CI's. ES5-style on purpose; no template literals.
 *
 * Promises it keeps (and that the manifest therefore declares):
 *   keyboard       — every control is a native button/textarea; ← → between reached chapters
 *   screen reader  — one h1, chapter h2 focused on navigation, polite live region
 *   reduced motion — html[data-motion] drives CSS; no JS animation at all
 *   untimed        — nothing in the book depends on time
 * It never touches the network, storage, or the parent; it talks only
 * through the Storyframe SDK session.
 */
export const QUICKBOOK_RUNTIME = String.raw`(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('qb-data').textContent);
  var RELEASE_ID = document.documentElement.getAttribute('data-sf-release') || 'dev';
  var root = document.documentElement;
  var chapters = DATA.chapters;
  var byId = {};
  chapters.forEach(function (c, i) { c.index = i; byId[c.id] = c; });
  var S = { chapter: null, furthest: -1, found: {}, choices: {}, ach: {}, endings: {}, visited: {} };
  var session = null;
  var canNote = false;
  var toastEl = document.getElementById('qb-toast');
  var toastTimer = 0;

  function all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.className = 'qb-toast on';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'qb-toast'; }, 3400);
  }
  function shown(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if ((n.classList.contains('qb-branch') || n.classList.contains('qb-secret-body')) && n.hidden) return false;
    }
    return true;
  }
  function snap() { return { chapter: S.chapter || '', furthest: S.furthest }; }
  function commit(m) {
    if (!session) return;
    session.progress.commit(m).catch(function () { /* the shell shows sync state; reading continues */ });
  }

  /* achievements + the first ending that are visible inside scope and not yet recorded */
  function pending(scope) {
    var out = { ach: [], names: [], ending: null };
    all('.qb-ach', scope).forEach(function (el) {
      var id = el.getAttribute('data-achievement');
      if (!S.ach[id] && out.ach.indexOf(id) < 0 && shown(el)) { out.ach.push(id); out.names.push(el.getAttribute('data-name') || id); }
    });
    all('.qb-ending', scope).forEach(function (el) {
      var id = el.getAttribute('data-ending');
      if (!out.ending && !S.endings[id] && shown(el)) out.ending = id;
    });
    return out;
  }
  function settle(p, m) {
    if (p.ach.length) m.unlockAchievements = p.ach;
    if (p.ending) { m.endingId = p.ending; S.endings[p.ending] = true; }
    p.ach.forEach(function (id) { S.ach[id] = true; });
    p.names.forEach(function (n) { toast('Achievement — ' + n); });
    return m;
  }

  /* ── chapters ─────────────────────────────────────────────────────── */
  function updateToc() {
    all('#qb-toc-list button').forEach(function (b) {
      var c = byId[b.getAttribute('data-go')];
      var open = !!S.visited[c.id] || c.index <= S.furthest;
      b.disabled = !open;
      b.textContent = DATA.kicker + ' ' + (c.index + 1) + (open ? ' — ' + b.getAttribute('data-label') : '');
      if (c.id === S.chapter) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  function updatePager(article) {
    var ended = all('.qb-ending', article).some(shown);
    all('.qb-next', article).forEach(function (b) { b.hidden = ended; });
  }
  function showCover() {
    document.getElementById('qb-cover').hidden = false;
    all('.qb-chapter').forEach(function (a) { a.hidden = true; });
  }
  function showChapter(id, opts) {
    opts = opts || {};
    var c = byId[id];
    if (!c) return;
    document.getElementById('qb-cover').hidden = true;
    all('.qb-chapter').forEach(function (a) { a.hidden = a.getAttribute('data-cp') !== id; });
    var article = document.getElementById('ch-' + id);
    S.chapter = id;
    S.visited[id] = true;
    if (c.index > S.furthest) S.furthest = c.index;
    updateToc();
    updatePager(article);
    if (!opts.silent) {
      window.scrollTo(0, 0);
      var h = article.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }
    if (opts.restore) return;
    var p = pending(article);
    commit(settle(p, { type: p.ending ? 'ending' : 'checkpoint', checkpointId: id, set: snap(), visit: [id] }));
  }
  function canVisit(id) { var c = byId[id]; return !!c && (S.visited[id] || c.index <= S.furthest + 1); }

  /* ── secrets ──────────────────────────────────────────────────────── */
  function openSecret(aside, fresh) {
    var btn = aside.querySelector('.qb-secret-btn');
    var body = document.getElementById(btn.getAttribute('aria-controls'));
    body.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var id = aside.getAttribute('data-item');
    if (!fresh || S.found[id]) return;
    S.found[id] = true;
    var name = (body.querySelector('.qb-secret-name') || {}).textContent || id;
    var p = pending(body);
    var m = settle(p, { type: 'discovery', grantItems: [{ itemId: id, quantity: 1 }], set: snap() });
    commit(m);
    toast('Found — ' + name + ' (kept in your Archive)');
  }

  /* ── choices ──────────────────────────────────────────────────────── */
  function applyChoice(fs, option) {
    var id = fs.getAttribute('data-choice');
    S.choices[id] = option;
    var label = option;
    all('.qb-option', fs).forEach(function (b) {
      var on = b.getAttribute('data-option') === option;
      if (on) label = b.textContent;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.disabled = true;
    });
    var chosen = fs.querySelector('.qb-chosen');
    chosen.hidden = false;
    chosen.textContent = 'You chose: ' + label;
    chosen.setAttribute('tabindex', '-1');
    all('.qb-branch').forEach(function (br) {
      if (br.getAttribute('data-choice') === id) br.hidden = br.getAttribute('data-option') !== option;
    });
    return chosen;
  }
  function choose(btn) {
    var fs = btn.closest('.qb-choice');
    var id = fs.getAttribute('data-choice');
    if (S.choices[id] !== undefined) return;
    var option = btn.getAttribute('data-option');
    var chosen = applyChoice(fs, option);
    var p = { ach: [], names: [], ending: null };
    all('.qb-branch').forEach(function (br) {
      if (br.getAttribute('data-choice') !== id || br.hidden) return;
      var q = pending(br);
      q.ach.forEach(function (a, i) { if (p.ach.indexOf(a) < 0) { p.ach.push(a); p.names.push(q.names[i]); } });
      if (!p.ending) p.ending = q.ending;
    });
    commit(settle(p, { type: p.ending ? 'ending' : 'choice_committed', choiceId: id, choiceOption: option, set: snap() }));
    var article = fs.closest('.qb-chapter');
    if (article) updatePager(article);
    chosen.focus();
  }

  /* ── notes (protocol 1.1) ─────────────────────────────────────────── */
  function currentTitle() { return S.chapter && byId[S.chapter] ? byId[S.chapter].title : DATA.title; }
  function addNote(kind, text) {
    if (!canNote) return;
    session.notes.add({ anchorId: S.chapter || 'cover', kind: kind, text: text || '', label: currentTitle() })
      .then(function () { toast(kind === 'bookmark' ? 'Bookmarked — it waits in your Archive' : 'Note saved to your Archive'); })
      .catch(function () { toast('That note could not be saved'); });
  }

  /* ── preferences ──────────────────────────────────────────────────── */
  function applyPrefs(p) {
    if (!p) return;
    root.setAttribute('data-motion', p.motion || 'full');
    root.setAttribute('data-contrast', p.contrast || 'normal');
    root.setAttribute('data-font', p.fontMode || 'story');
    root.setAttribute('data-lh', p.lineHeight || 'normal');
    root.style.setProperty('--qb-scale', String(p.textScale || 1));
    var scheme = p.colorScheme;
    if (!scheme || scheme === 'system') scheme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-scheme', scheme);
  }

  /* ── events ───────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button, a') : null;
    if (!t) return;
    if (t.classList.contains('qb-xref')) {
      e.preventDefault();
      var ref = t.getAttribute('href').slice(1);
      if (canVisit(ref)) showChapter(ref);
      return;
    }
    if (t.hasAttribute('data-go')) {
      var go = t.getAttribute('data-go');
      var list = document.getElementById('qb-toc-list');
      if (list.contains(t)) { list.hidden = true; document.getElementById('qb-toc-btn').setAttribute('aria-expanded', 'false'); }
      if (canVisit(go)) showChapter(go);
      return;
    }
    if (t.id === 'qb-toc-btn') {
      var l = document.getElementById('qb-toc-list');
      l.hidden = !l.hidden;
      t.setAttribute('aria-expanded', l.hidden ? 'false' : 'true');
      if (!l.hidden) { var first = l.querySelector('button:not([disabled])'); if (first) first.focus(); }
      return;
    }
    if (t.classList.contains('qb-secret-btn')) {
      var aside = t.closest('.qb-secret');
      if (t.getAttribute('aria-expanded') === 'true') {
        document.getElementById(t.getAttribute('aria-controls')).hidden = true;
        t.setAttribute('aria-expanded', 'false');
      } else openSecret(aside, true);
      return;
    }
    if (t.classList.contains('qb-option')) { choose(t); return; }
    var action = t.getAttribute('data-action');
    if (action === 'bookmark') { addNote('bookmark', ''); return; }
    if (action === 'note' || action === 'note-cancel') {
      var foot = t.closest('.qb-chapter-foot');
      var form = foot.querySelector('.qb-note-form');
      var open = action === 'note' && form.hidden;
      form.hidden = !open;
      foot.querySelector('[data-action="note"]').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) form.querySelector('textarea').focus();
      return;
    }
    if (action === 'exit') {
      if (session && session.mode === 'framed') session.ui.exit();
      else toast('The end.');
    }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('qb-note-form')) return;
    e.preventDefault();
    var area = form.querySelector('textarea');
    var text = area.value.trim();
    if (!text) { area.focus(); return; }
    addNote('note', text);
    area.value = '';
    form.hidden = true;
    form.parentElement.querySelector('[data-action="note"]').setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var l = document.getElementById('qb-toc-list');
      if (!l.hidden) { l.hidden = true; var b = document.getElementById('qb-toc-btn'); b.setAttribute('aria-expanded', 'false'); b.focus(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || !S.chapter) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    var c = byId[S.chapter];
    if (e.key === 'ArrowRight' && chapters[c.index + 1]) {
      var next = document.querySelector('#ch-' + c.id + ' .qb-next');
      if (next && !next.hidden) showChapter(chapters[c.index + 1].id);
    } else if (e.key === 'ArrowLeft' && c.index > 0) showChapter(chapters[c.index - 1].id);
  });

  /* ── boot ─────────────────────────────────────────────────────────── */
  function restore(progress) {
    if (!progress) return false;
    var st = progress.storyState || {};
    Object.keys(progress.inventory || {}).forEach(function (k) { S.found[k] = true; });
    (progress.achievements || []).forEach(function (a) { S.ach[a] = true; });
    (progress.endingIds || []).forEach(function (x) { S.endings[x] = true; });
    (progress.visitedMoments || []).forEach(function (v) { if (byId[v]) S.visited[v] = true; });
    S.furthest = typeof st.furthest === 'number' ? st.furthest : -1;
    Object.keys(S.visited).forEach(function (v) { if (byId[v].index > S.furthest) S.furthest = byId[v].index; });
    var cc = progress.committedChoices || {};
    all('.qb-choice').forEach(function (fs) {
      var id = fs.getAttribute('data-choice');
      if (cc[id] !== undefined) applyChoice(fs, cc[id]);
    });
    all('.qb-secret').forEach(function (s) { if (S.found[s.getAttribute('data-item')]) openSecret(s, false); });
    var ch = st.chapter && byId[st.chapter] ? st.chapter : (byId[progress.checkpointId] && S.visited[progress.checkpointId] ? progress.checkpointId : null);
    if (!ch) return false;
    showChapter(ch, { restore: true, silent: true });
    return true;
  }
  function hideTools() { all('.qb-tools').forEach(function (t) { t.hidden = true; }); }

  if (!window.Storyframe) { hideTools(); showCover(); return; }
  window.Storyframe.connect({ storyId: DATA.storyId, releaseId: RELEASE_ID }).then(function (s) {
    session = s;
    return s.ready();
  }).then(function (boot) {
    applyPrefs(boot.preferences);
    if (session.preferences) session.preferences.onChange(applyPrefs);
    canNote = !!(session.notes && (session.capabilities || []).indexOf('notes.write') >= 0);
    if (!canNote) hideTools();
    if (!restore(boot.progress)) showCover();
  }).catch(function () {
    session = null;
    hideTools();
    showCover();
    toast('Reading without a host — nothing will be saved.');
  });
})();`
