import {
  $, $$, ic, toast, createSheet, openSheet, closeSheet, closeAll, isOpen, confirmDialog,
  initConfirm, autosize, setBusy, copyText, initMenu,
} from './ui.js';
import { esc, norm, tokenize, highlight, renderRich, blocksToHtml, plainPreview } from './text.js';
import * as store from './data.js';
import { scanBarcode } from './scanner.js';

const CATS = store.CATS;
const TABS = {
  books: { label: 'ספרים', one: 'ספר', ph: 'חיפוש לפי שם, סופר, מיקום או הערה' },
  food: { label: 'מזון', one: 'פריט מזון', ph: 'חיפוש לפי שם, מיקום או הערה' },
  items: { label: 'פריטים', one: 'פריט', ph: 'חיפוש לפי שם, מיקום או הערה' },
  recipes: { label: 'מתכונים', one: 'מתכון', ph: 'חיפוש לפי שם או מצרכים' },
};
const ORDER = ['books', 'food', 'items', 'recipes'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (cb) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 600));
const store_ls = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const state = {
  user: null,
  tab: 'books',
  items: { books: [], food: [], items: [] },
  raw: { books: null, food: null, items: null },
  loaded: { books: false, food: false, items: false },
  errors: {},
  unsubs: {},
  recipes: [], recipesLoaded: false, recipesError: null, recipesSub: null, recipesStarting: null, recipeApi: null,
  query: { books: '', food: '', items: '', recipes: '' },
  sort: store_ls.get('sort', 'new'),
  scroll: {},
  flashId: null, flashTitle: null,
};

const el = {
  splash: $('#splash'), auth: $('#auth'), app: $('#app'),
  list: $('#list'), count: $('#count'), search: $('#search'), searchBox: $('#search-box'),
  clear: $('#search-clear'), scan: $('#scan-btn'), add: $('#add-btn'), sort: $('#sort-btn'),
  tabs: $('#tabs'), ind: $('.tab-ind'), net: $('#net'),
};

/* ================= Theme ================= */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  store_ls.set('theme', t);
  $('#theme-color-meta').content = t === 'light' ? '#f6f2ea' : '#0f0e0c';
}
$('#theme-btn').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

/* ================= Sheets ================= */
initConfirm($('#confirm'));
const S = {
  item: createSheet($('#item-sheet'), { guard: () => itemDirty() }),
  detail: createSheet($('#detail-sheet')),
  recipeForm: createSheet($('#recipe-sheet'), { guard: () => recipeDirty() }),
  recipeView: createSheet($('#recipe-view')),
  export: createSheet($('#export-sheet')),
  import: createSheet($('#import-sheet')),
};

/* ================= Auth ================= */
const AUTH_ERR = {
  'auth/invalid-email': 'כתובת האימייל אינה תקינה.',
  'auth/user-not-found': 'לא נמצא משתמש עם האימייל הזה.',
  'auth/wrong-password': 'הסיסמה שגויה.',
  'auth/invalid-credential': 'האימייל או הסיסמה שגויים.',
  'auth/invalid-login-credentials': 'האימייל או הסיסמה שגויים.',
  'auth/email-already-in-use': 'כבר קיים חשבון עם האימייל הזה.',
  'auth/weak-password': 'הסיסמה חלשה מדי (לפחות 6 תווים).',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.',
  'auth/network-request-failed': 'אין חיבור לרשת. בדוק את החיבור ונסה שוב.',
  'auth/user-disabled': 'החשבון הזה הושבת.',
};
const authErr = $('#auth-error');
const showAuthError = (m) => { authErr.textContent = m; authErr.hidden = !m; };

async function doAuth(kind, btn) {
  const email = $('#email').value.trim();
  const pw = $('#password').value;
  if (!email || !pw) return showAuthError('נא למלא אימייל וסיסמה.');
  showAuthError('');
  setBusy(btn, true);
  $$('#auth-form .btn').forEach((b) => (b.disabled = true));
  try {
    await (kind === 'login' ? store.signIn(email, pw) : store.signUp(email, pw));
  } catch (err) {
    console.error('Auth error', err);
    showAuthError(AUTH_ERR[err.code] || 'משהו השתבש. נסה שוב.');
  } finally {
    setBusy(btn, false);
    $$('#auth-form .btn').forEach((b) => (b.disabled = false));
  }
}
$('#auth-form').addEventListener('submit', (e) => { e.preventDefault(); doAuth('login', $('#login-btn')); });
$('#register-btn').addEventListener('click', () => doAuth('register', $('#register-btn')));
$('#pw-toggle').addEventListener('click', (e) => {
  const inp = $('#password');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', show);
  e.currentTarget.innerHTML = ic(show ? 'eye-off' : 'eye');
});
$('#email').addEventListener('input', () => showAuthError(''));
$('#password').addEventListener('input', () => showAuthError(''));

const t0 = performance.now();
let firstAuth = true;
store.onAuth(async (user) => {
  if (firstAuth) { firstAuth = false; await sleep(Math.max(0, 550 - (performance.now() - t0))); }
  if (user) enterApp(user); else leaveApp();
  el.splash.classList.add('gone');
  setTimeout(() => (el.splash.hidden = true), 320);
});

function enterApp(user) {
  if (state.user?.uid === user.uid) return;
  state.user = user;
  el.auth.hidden = true;
  el.app.hidden = false;
  showAuthError('');
  $('#password').value = '';
  setTab(tabFromLocation(), { initial: true });
  CATS.forEach(subscribeCat);
  store.watchConnection(onConnection);
  idle(startRecipes);
}

function leaveApp() {
  state.user = null;
  Object.values(state.unsubs).forEach((u) => u && u());
  state.unsubs = {};
  state.recipesSub?.(); state.recipesSub = null; state.recipesLoaded = false; state.recipes = [];
  CATS.forEach((c) => { state.items[c] = []; state.raw[c] = null; state.loaded[c] = false; });
  closeAll();
  el.app.hidden = true;
  el.auth.hidden = false;
}

/* Connectivity pill (debounced so the initial handshake doesn't flash) */
let netTimer;
function onConnection(ok) {
  clearTimeout(netTimer);
  if (ok) el.net.hidden = true;
  else netTimer = setTimeout(() => (el.net.hidden = false), 2500);
}
addEventListener('online', () => onConnection(true));

/* ================= Data subscriptions ================= */
function toList(raw) {
  return Object.entries(raw || {})
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({
      ...v, id,
      _h: norm([v.description, v.name, v.author, v.location, v.notes, v.barcode].filter((x) => x != null && x !== '').join(' ')),
    }));
}

function subscribeCat(cat) {
  state.unsubs[cat]?.();
  state.errors[cat] = null;
  state.unsubs[cat] = store.subscribeCategory(
    cat,
    (raw) => {
      state.raw[cat] = raw;
      state.items[cat] = toList(raw);
      state.loaded[cat] = true;
      state.errors[cat] = null;
      refreshSuggestions();
      if (cat === state.tab) render();
      refreshDetail(cat);
    },
    (err) => {
      console.error('Load error', cat, err);
      state.errors[cat] = err;
      state.loaded[cat] = true;
      if (cat === state.tab) render();
      toast('שגיאה בטעינת הנתונים', { type: 'error' });
    }
  );
}

async function getRecipeApi() {
  if (!state.recipeApi) state.recipeApi = await import('./recipes-data.js');
  return state.recipeApi;
}

function startRecipes() {
  if (state.recipesSub || state.recipesStarting) return state.recipesStarting;
  state.recipesError = null;
  state.recipesStarting = (async () => {
    try {
      const api = await getRecipeApi();
      state.recipesSub = api.subscribeRecipes(
        (list) => {
          state.recipes = list.map((r) => ({ ...r, _h: norm((r.title || '') + ' ' + (r.content || '')) }));
          state.recipesLoaded = true;
          state.recipesError = null;
          if (state.tab === 'recipes') render();
          refreshRecipeView();
        },
        (err) => {
          console.error('Recipes error', err);
          state.recipesError = err; state.recipesLoaded = true; state.recipesSub = null;
          if (state.tab === 'recipes') render();
        }
      );
    } catch (err) {
      console.error('Recipes load failed', err);
      state.recipesError = err; state.recipesLoaded = true;
      if (state.tab === 'recipes') render();
    } finally { state.recipesStarting = null; }
  })();
  return state.recipesStarting;
}

/* ================= Router / tabs ================= */
function tabFromLocation() {
  const h = location.hash.replace(/^#\/?/, '');
  if (TABS[h]) return h;
  const q = new URLSearchParams(location.search).get('active');
  if (TABS[q]) return q;
  const saved = store_ls.get('tab', 'books');
  return TABS[saved] ? saved : 'books';
}

function placeIndicator(animate = true) {
  const b = $(`.tab[data-tab="${state.tab}"]`);
  if (!b || !el.tabs.getClientRects().length) return;
  const nr = el.tabs.getBoundingClientRect(), br = b.getBoundingClientRect();
  if (!animate) el.ind.style.transition = 'none';
  el.ind.style.width = br.width + 'px';
  el.ind.style.transform = `translateX(${br.left - nr.left - el.tabs.clientLeft}px)`;
  if (!animate) { void el.ind.offsetWidth; el.ind.style.transition = ''; }
}

function setTab(tab, { initial = false } = {}) {
  if (!TABS[tab] || (tab === state.tab && !initial)) return;
  if (!initial) state.scroll[state.tab] = scrollY;
  state.tab = tab;
  store_ls.set('tab', tab);
  try { history.replaceState(history.state, '', '#/' + tab); } catch {}
  const isR = tab === 'recipes';
  $$('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  });
  el.search.value = state.query[tab];
  el.search.placeholder = TABS[tab].ph;
  el.clear.hidden = !state.query[tab];
  el.scan.hidden = isR;
  el.searchBox.dataset.scan = String(!isR);
  el.sort.hidden = isR;
  el.add.setAttribute('aria-label', 'הוסף ' + TABS[tab].one);
  updateSortLabel();
  placeIndicator(!initial);
  render({ animate: true });
  scrollTo(0, state.scroll[tab] || 0);
  if (isR) startRecipes();
}

el.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) setTab(b.dataset.tab);
});
el.tabs.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const rtl = getComputedStyle(el.tabs).direction === 'rtl';
  let i = ORDER.indexOf(state.tab);
  if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = ORDER.length - 1;
  else i += (e.key === 'ArrowLeft') === rtl ? 1 : -1;
  i = Math.max(0, Math.min(ORDER.length - 1, i));
  setTab(ORDER[i]);
  $(`.tab[data-tab="${ORDER[i]}"]`).focus();
});
addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (state.user && TABS[h]) setTab(h);
});
addEventListener('resize', () => placeIndicator(false));
document.fonts?.ready.then(() => placeIndicator(false));
$('#brand').addEventListener('click', () => scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' }));

/* ================= Rendering ================= */
let enterTimer;
const sortItems = (list) =>
  state.sort === 'az'
    ? [...list].sort((a, b) => (a.description || '').localeCompare(b.description || '', 'he'))
    : [...list].reverse();

function updateSortLabel() {
  el.sort.textContent = 'מיון: ' + (state.sort === 'az' ? 'א–ת' : 'חדשים');
}

function countText(n, total, filtered) {
  const t = TABS[state.tab];
  if (filtered) return n === 1 ? 'תוצאה אחת' : `${n} תוצאות`;
  return total === 1 ? `${t.one} אחד` : `${total} ${t.label}`;
}

const skeletons = () => Array.from({ length: 6 }, () => '<div class="skel"></div>').join('');

function emptyState(tab, q, total) {
  const t = TABS[tab];
  const icon = { books: 'book', food: 'food', items: 'box', recipes: 'chef' }[tab];
  if (q.trim() && total) {
    return `<div class="empty">${ic('search', 'big')}<h3>לא נמצאו תוצאות</h3>
      <p>לא מצאנו משהו שמתאים ל־״${esc(q.trim())}״</p>
      <div class="empty-actions"><button class="btn" data-act="clear">נקה חיפוש</button>
      <button class="btn primary" data-act="add-q">${ic('plus')}הוסף ״${esc(q.trim().slice(0, 24))}״</button></div></div>`;
  }
  return `<div class="empty">${ic(icon, 'big')}<h3>עוד אין ${t.label}</h3>
    <p>הוסף את ה${t.one} הראשון וימצא את מקומו כאן.</p>
    <div class="empty-actions"><button class="btn primary" data-act="add">${ic('plus')}הוסף ${t.one}</button></div></div>`;
}

const errorState = () => `<div class="empty">${ic('alert', 'big')}<h3>לא הצלחנו לטעון</h3>
  <p>בדוק את החיבור ונסה שוב.</p>
  <div class="empty-actions"><button class="btn primary" data-act="retry">${ic('refresh')}נסה שוב</button></div></div>`;

function itemCard(it, tokens, i) {
  const bc = it.barcode != null && it.barcode !== '' ? String(it.barcode) : '';
  return `<article class="card" role="button" tabindex="0" data-id="${esc(it.id)}" style="--i:${Math.min(i, 8)}">
    <h3 class="card-title">${highlight(it.description || 'ללא שם', tokens)}</h3>
    ${it.author ? `<p class="card-sub">${ic('user')}<span>${highlight(it.author, tokens)}</span></p>` : ''}
    <div class="chips">
      ${it.location ? `<span class="chip">${ic('pin')}<span>${highlight(it.location, tokens)}</span></span>` : ''}
      ${bc ? `<span class="chip mono">${ic('barcode')}<span>${highlight(bc, tokens)}</span></span>` : ''}
    </div>
    ${it.notes ? `<p class="card-notes">${highlight(it.notes, tokens)}</p>` : ''}
  </article>`;
}

function recipeCard(r, tokens, i) {
  const hasUrl = /(https?:\/\/|www\.)/i.test(r.content || '');
  return `<article class="card" role="button" tabindex="0" data-id="${esc(r.id)}" style="--i:${Math.min(i, 8)}">
    <h3 class="card-title">${highlight(r.title || 'ללא כותרת', tokens)}</h3>
    <p class="card-notes">${highlight(plainPreview(r.content), tokens)}</p>
    ${hasUrl ? `<div class="chips"><span class="chip">${ic('link')}<span>קישור</span></span></div>` : ''}
  </article>`;
}

function render({ animate = false } = {}) {
  const tab = state.tab, isR = tab === 'recipes', list = el.list;
  const q = state.query[tab], tokens = tokenize(q);
  const loaded = isR ? state.recipesLoaded : state.loaded[tab];
  const err = isR ? state.recipesError : state.errors[tab];
  list.setAttribute('aria-busy', String(!loaded));
  if (!loaded) { list.innerHTML = skeletons(); list.dataset.state = 'skeleton'; el.count.textContent = ''; return; }
  if (list.dataset.state === 'skeleton') animate = true;
  list.dataset.state = 'ready';
  if (err) { list.innerHTML = errorState(); el.count.textContent = ''; return; }
  const all = isR ? state.recipes : sortItems(state.items[tab]);
  const rows = tokens.length ? all.filter((x) => tokens.every((t) => x._h.includes(t))) : all;
  el.count.textContent = countText(rows.length, all.length, tokens.length > 0);
  if (!rows.length) { list.innerHTML = emptyState(tab, q, all.length); return; }
  list.innerHTML = rows.map((x, i) => (isR ? recipeCard(x, tokens, i) : itemCard(x, tokens, i))).join('');
  if (animate && !reduced.matches) {
    list.classList.remove('enter'); void list.offsetWidth; list.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => list.classList.remove('enter'), 700);
  }
  let target = null;
  if (state.flashId) target = list.querySelector(`[data-id="${CSS.escape(state.flashId)}"]`);
  else if (state.flashTitle && isR) {
    const r = state.recipes.find((x) => x.title === state.flashTitle);
    if (r) target = list.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
  }
  if (target) {
    state.flashId = state.flashTitle = null;
    target.classList.add('flash');
    target.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  }
}

/* ================= Search ================= */
let raf = 0;
el.search.addEventListener('input', () => {
  state.query[state.tab] = el.search.value;
  el.clear.hidden = !el.search.value;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => render());
});
el.search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && el.search.value) { e.preventDefault(); clearSearch(); }
  if (e.key === 'Enter') el.search.blur();
});
function clearSearch(focus = true) {
  el.search.value = ''; state.query[state.tab] = ''; el.clear.hidden = true;
  render();
  if (focus && finePointer.matches) el.search.focus();
}
el.clear.addEventListener('click', () => { clearSearch(); el.search.focus(); });
document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || el.app.hidden) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault(); el.search.focus(); el.search.select();
  }
});
el.sort.addEventListener('click', () => {
  state.sort = state.sort === 'az' ? 'new' : 'az';
  store_ls.set('sort', state.sort);
  updateSortLabel(); render();
});

/* ================= List interactions ================= */
function openFromCard(card) {
  const id = card.dataset.id;
  if (state.tab === 'recipes') openRecipeView(id); else openItemDetail(state.tab, id);
}
el.list.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) {
    if (act === 'clear') clearSearch();
    else if (act === 'retry') retry();
    else if (act === 'add') addNew();
    else if (act === 'add-q') addNew(state.query[state.tab].trim());
    return;
  }
  const card = e.target.closest('.card');
  if (card) openFromCard(card);
});
el.list.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('card')) {
    e.preventDefault(); openFromCard(e.target);
  }
});
function retry() {
  if (state.tab === 'recipes') { state.recipesLoaded = false; state.recipesError = null; render(); startRecipes(); }
  else { state.loaded[state.tab] = false; render(); subscribeCat(state.tab); }
}
function addNew(text = '') {
  if (state.tab === 'recipes') openRecipeForm({ prefill: { title: text } });
  else openItemForm({ prefill: { description: text } });
}
el.add.addEventListener('click', () => addNew());

/* ================= Menu ================= */
initMenu($('#menu-btn'), $('#menu'));
$('#menu').addEventListener('click', (e) => {
  const a = e.target.closest('[data-menu]')?.dataset.menu;
  if (!a) return;
  if (a === 'export') openExport();
  else if (a === 'import') openImport();
  else if (a === 'recipes-word') exportRecipesWord();
  else if (a === 'logout') store.signOut();
});

/* ================= Item form ================= */
const f = {
  form: $('#item-form'), title: $('#item-sheet-title'), cat: $('#if-cat'), desc: $('#if-desc'),
  author: $('#if-author'), authorField: $('#if-author-field'), loc: $('#if-loc'), notes: $('#if-notes'),
  barcode: $('#if-barcode'), hint: $('#if-barcode-hint'), del: $('#if-delete'), save: $('#if-save'),
};
let itemCtx = null, itemSnap = '';
const itemValues = () => JSON.stringify([f.cat.value, f.desc.value, f.author.value, f.loc.value, f.notes.value, f.barcode.value]);
const itemDirty = () => !!itemCtx && !itemCtx.saving && itemValues() !== itemSnap;

function fieldError(input, msg) {
  const field = input.closest('.field');
  field.classList.toggle('invalid', !!msg);
  const p = $('.field-error', field);
  if (p) { p.textContent = msg || ''; p.hidden = !msg; }
  input.setAttribute('aria-invalid', !!msg);
}
const clearErrors = (root) => $$('.field', root).forEach((fl) => { const i = $('.input', fl); if (i) fieldError(i, ''); });
$$('.input', document).forEach((i) => i.addEventListener('input', () => { if (i.closest('.field')?.classList.contains('invalid')) fieldError(i, ''); }));

const toggleAuthor = () => (f.authorField.hidden = f.cat.value !== 'books');
f.cat.addEventListener('change', toggleAuthor);
f.notes.addEventListener('input', () => autosize(f.notes));

function findByBarcode(code, { exclude } = {}) {
  const order = [...new Set([...(CATS.includes(state.tab) ? [state.tab] : []), ...CATS])];
  for (const cat of order) {
    const item = state.items[cat].find((i) => String(i.barcode ?? '') === code && i.id !== exclude);
    if (item) return { cat, item };
  }
  return null;
}
function updateBarcodeHint() {
  const v = f.barcode.value.trim();
  const hit = v && findByBarcode(v, { exclude: itemCtx?.id });
  f.hint.hidden = !hit;
  if (hit) f.hint.textContent = `הברקוד כבר קיים: ״${hit.item.description || 'ללא שם'}״ (${TABS[hit.cat].label})`;
}
f.barcode.addEventListener('input', updateBarcodeHint);

$('#if-scan').addEventListener('click', async () => {
  const code = await scanBarcode();
  if (code) { f.barcode.value = code; updateBarcodeHint(); toast('הברקוד נסרק', { type: 'success', duration: 1800 }); }
});

function refreshSuggestions() {
  const count = (arr) => {
    const m = new Map();
    arr.forEach((v) => { v = String(v ?? '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([v]) => `<option value="${esc(v)}">`).join('');
  };
  $('#dl-locations').innerHTML = count(CATS.flatMap((c) => state.items[c].map((i) => i.location)));
  $('#dl-authors').innerHTML = count(state.items.books.map((i) => i.author));
}

function openItemForm({ mode = 'add', cat, item = null, prefill = {} } = {}) {
  itemCtx = { mode, cat: cat || (CATS.includes(state.tab) ? state.tab : 'items'), id: item?.id || null, saving: false };
  f.title.textContent = mode === 'edit' ? 'עריכת פריט' : 'פריט חדש';
  f.cat.value = itemCtx.cat;
  f.cat.disabled = mode === 'edit';
  f.desc.value = item?.description ?? prefill.description ?? '';
  f.author.value = item?.author ?? '';
  f.loc.value = item?.location ?? '';
  f.notes.value = item?.notes ?? '';
  f.barcode.value = item?.barcode != null ? String(item.barcode) : prefill.barcode ?? '';
  f.del.hidden = mode !== 'edit';
  clearErrors(f.form); toggleAuthor(); updateBarcodeHint();
  itemSnap = itemValues();
  openSheet(S.item);
  requestAnimationFrame(() => autosize(f.notes));
  if (finePointer.matches) setTimeout(() => f.desc.focus(), 60);
}
S.item.onClosed = () => { itemCtx = null; };

f.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!itemCtx || itemCtx.saving) return;
  const v = {
    description: f.desc.value.trim(), location: f.loc.value.trim(), notes: f.notes.value.trim(),
    barcode: f.barcode.value.trim(), author: f.author.value.trim(),
  };
  let ok = true;
  if (!v.description) { fieldError(f.desc, 'נא להזין שם'); ok = false; }
  if (!v.location) { fieldError(f.loc, 'נא להזין מיקום'); ok = false; }
  if (!ok) { (f.desc.closest('.invalid') ? f.desc : f.loc).focus(); return; }

  const cat = itemCtx.cat;
  const data = { description: v.description, location: v.location, notes: v.notes, barcode: v.barcode };
  if (cat === 'books') data.author = v.author;
  itemCtx.saving = true;
  let p;
  if (itemCtx.mode === 'edit') {
    p = store.updateItem(cat, itemCtx.id, data);
  } else {
    const key = store.newKey(cat);
    state.flashId = key;
    state.query[cat] = '';
    if (cat !== state.tab) setTab(cat);
    else { el.search.value = ''; el.clear.hidden = true; }
    p = store.addItem(cat, key, data);
  }
  const edit = itemCtx.mode === 'edit';
  closeSheet(S.item, true);
  p.then(() => toast(edit ? 'השינויים נשמרו' : 'נוסף בהצלחה', { type: 'success' }))
    .catch((err) => { console.error(err); toast('השמירה נכשלה. נסה שוב.', { type: 'error' }); });
});
f.del.addEventListener('click', () => itemCtx && deleteItem(itemCtx.cat, itemCtx.id));

async function deleteItem(cat, id) {
  const it = state.items[cat].find((x) => x.id === id);
  const ok = await confirmDialog({
    title: 'למחוק את הפריט?', message: `״${it?.description || 'ללא שם'}״ יימחק לצמיתות.`,
    confirmText: 'מחק', danger: true,
  });
  if (!ok) return;
  await closeAll();
  store.removeItem(cat, id)
    .then(() => toast('הפריט נמחק', { type: 'success' }))
    .catch((err) => { console.error(err); toast('המחיקה נכשלה', { type: 'error' }); });
}

/* ================= Item detail ================= */
const detail = { body: $('#detail-body'), ctx: null };
const fact = (icon, label, html) =>
  `<div class="fact">${ic(icon)}<div><dt>${label}</dt><dd>${html}</dd></div></div>`;

function renderDetail(it) {
  const { cat } = detail.ctx;
  $('#detail-title').textContent = it.description || 'ללא שם';
  const bc = it.barcode != null && it.barcode !== '' ? String(it.barcode) : '';
  detail.body.innerHTML = `
    <div class="detail-tags"><span class="badge">${TABS[cat].one}</span>${it.author ? `<span class="badge subtle">${ic('user')}${esc(it.author)}</span>` : ''}</div>
    <dl class="facts">
      ${fact('pin', 'מיקום', it.location ? esc(it.location) : '<span class="muted">לא צוין</span>')}
      ${it.notes ? fact('note', 'הערות', '<div class="rich" id="detail-notes"></div>') : ''}
      ${bc ? fact('barcode', 'ברקוד', `<button type="button" class="copy-code" data-copy="${esc(bc)}" dir="ltr">${esc(bc)}${ic('copy')}</button>`) : ''}
    </dl>`;
  if (it.notes) renderRich($('#detail-notes'), it.notes);
}
function openItemDetail(cat, id) {
  const it = state.items[cat].find((x) => x.id === id);
  if (!it) return;
  detail.ctx = { cat, id };
  renderDetail(it);
  detail.body.scrollTop = 0;
  openSheet(S.detail);
}
function refreshDetail(cat) {
  if (!isOpen(S.detail) || detail.ctx?.cat !== cat) return;
  const it = state.items[cat].find((x) => x.id === detail.ctx.id);
  if (it) renderDetail(it); else closeAll();
}
detail.body.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (b && (await copyText(b.dataset.copy))) toast('הועתק', { type: 'success', duration: 1500 });
});
$('#detail-edit').addEventListener('click', () => {
  const { cat, id } = detail.ctx;
  const item = state.items[cat].find((x) => x.id === id);
  if (item) openItemForm({ mode: 'edit', cat, item });
});
$('#detail-delete').addEventListener('click', () => deleteItem(detail.ctx.cat, detail.ctx.id));

/* ================= Toolbar scan ================= */
el.scan.addEventListener('click', async () => {
  const code = await scanBarcode();
  if (!code) return;
  const hit = findByBarcode(code);
  if (hit) {
    if (hit.cat !== state.tab) setTab(hit.cat);
    state.query[hit.cat] = code;
    el.search.value = code; el.clear.hidden = false;
    render();
    openItemDetail(hit.cat, hit.item.id);
  } else {
    toast('הברקוד לא נמצא — אפשר להוסיף אותו', { duration: 2400 });
    openItemForm({ prefill: { barcode: code } });
  }
});

/* ================= Recipes ================= */
const rf = {
  form: $('#recipe-form'), title: $('#rf-title'), content: $('#rf-content'),
  del: $('#rf-delete'), heading: $('#recipe-sheet-title'),
};
let recipeCtx = null, recipeSnap = '';
const recipeValues = () => JSON.stringify([rf.title.value, rf.content.value]);
const recipeDirty = () => !!recipeCtx && !recipeCtx.saving && recipeValues() !== recipeSnap;
rf.content.addEventListener('input', () => autosize(rf.content));
rf.content.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); rf.form.requestSubmit(); }
});

function openRecipeForm({ mode = 'add', recipe = null, prefill = {} } = {}) {
  recipeCtx = { mode, id: recipe?.id || null, saving: false };
  rf.heading.textContent = mode === 'edit' ? 'עריכת מתכון' : 'מתכון חדש';
  rf.title.value = recipe?.title ?? prefill.title ?? '';
  rf.content.value = recipe?.content ?? '';
  rf.del.hidden = mode !== 'edit';
  clearErrors(rf.form);
  recipeSnap = recipeValues();
  openSheet(S.recipeForm);
  requestAnimationFrame(() => autosize(rf.content));
  if (finePointer.matches) setTimeout(() => (rf.title.value ? rf.content : rf.title).focus(), 60);
}
S.recipeForm.onClosed = () => { recipeCtx = null; };

rf.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!recipeCtx || recipeCtx.saving) return;
  const title = rf.title.value.trim(), content = rf.content.value.trim();
  let ok = true;
  if (!title) { fieldError(rf.title, 'נא להזין כותרת'); ok = false; }
  if (!content) { fieldError(rf.content, 'נא להזין את תוכן המתכון'); ok = false; }
  if (!ok) { (title ? rf.content : rf.title).focus(); return; }
  recipeCtx.saving = true;
  const { mode, id } = recipeCtx;
  if (mode === 'add') {
    state.query.recipes = ''; state.flashTitle = title;
    if (state.tab === 'recipes') { el.search.value = ''; el.clear.hidden = true; }
  }
  const p = getRecipeApi().then((api) => (mode === 'edit' ? api.updateRecipe(id, title, content) : api.addRecipe(title, content)));
  closeSheet(S.recipeForm, true);
  p.then(() => toast(mode === 'edit' ? 'המתכון עודכן' : 'המתכון נוסף', { type: 'success' }))
    .catch((err) => { console.error(err); toast('שגיאה בשמירת המתכון', { type: 'error' }); });
});
rf.del.addEventListener('click', () => recipeCtx && deleteRecipe(recipeCtx.id));

async function deleteRecipe(id) {
  const r = state.recipes.find((x) => x.id === id);
  const ok = await confirmDialog({
    title: 'למחוק את המתכון?', message: `״${r?.title || ''}״ יימחק לצמיתות.`, confirmText: 'מחק', danger: true,
  });
  if (!ok) return;
  await closeAll();
  getRecipeApi().then((api) => api.deleteRecipe(id))
    .then(() => toast('המתכון נמחק', { type: 'success' }))
    .catch((err) => { console.error(err); toast('שגיאה במחיקת המתכון', { type: 'error' }); });
}

/* Recipe view */
let viewId = null, wake = null, wakeWanted = false;
const rv = { title: $('#rv-title'), content: $('#rv-content'), wake: $('#rv-wake'), share: $('#rv-share') };
if ('wakeLock' in navigator) rv.wake.hidden = false;
if (navigator.share) rv.share.hidden = false;

function renderRecipeView() {
  const r = state.recipes.find((x) => x.id === viewId);
  if (!r) return false;
  rv.title.textContent = r.title || '';
  renderRich(rv.content, r.content);
  return true;
}
function openRecipeView(id) {
  viewId = id;
  if (!renderRecipeView()) return;
  $('#recipe-view .sheet-body').scrollTop = 0;
  setWake(false);
  openSheet(S.recipeView);
}
function refreshRecipeView() {
  if (!isOpen(S.recipeView)) return;
  if (!renderRecipeView()) closeAll();
}
S.recipeView.onClosing = () => setWake(false);

async function setWake(on) {
  wakeWanted = on;
  rv.wake.setAttribute('aria-pressed', on);
  try {
    if (on) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (wake) { await wake.release(); wake = null; }
  } catch (err) {
    wakeWanted = false; rv.wake.setAttribute('aria-pressed', 'false');
    toast('לא ניתן להשאיר את המסך דלוק', { type: 'error' });
  }
}
rv.wake.addEventListener('click', () => setWake(!wakeWanted));
document.addEventListener('visibilitychange', () => {
  if (wakeWanted && document.visibilityState === 'visible' && !wake) setWake(true);
});
const viewedRecipe = () => state.recipes.find((x) => x.id === viewId);
$('#rv-copy').addEventListener('click', async () => {
  const r = viewedRecipe();
  if (r && (await copyText(`${r.title}\n\n${r.content}`))) toast('המתכון הועתק', { type: 'success', duration: 1800 });
});
rv.share.addEventListener('click', () => {
  const r = viewedRecipe();
  if (r) navigator.share({ title: r.title, text: `${r.title}\n\n${r.content}` }).catch(() => {});
});
$('#rv-edit').addEventListener('click', () => { const r = viewedRecipe(); if (r) openRecipeForm({ mode: 'edit', recipe: r }); });
$('#rv-delete').addEventListener('click', () => deleteRecipe(viewId));

/* Word export (HTML-based .doc, RTL) */
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function exportRecipesWord() {
  if (!state.recipesLoaded) await startRecipes();
  if (!state.recipes.length) return toast('אין מתכונים לייצוא');
  const body = state.recipes
    .map((r, i) => `<h1${i ? ' style="page-break-before:always"' : ''}>${esc(r.title)}</h1>${blocksToHtml(r.content)}`)
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>ספר מתכונים</title>
<style>body{font-family:Arial,sans-serif;direction:rtl;text-align:right;line-height:1.6}h1{font-size:22pt;border-bottom:1px solid #999;padding-bottom:6pt}h3{font-size:14pt;margin:14pt 0 4pt}</style></head><body dir="rtl">${body}</body></html>`;
  download(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), 'recipes.doc');
  toast('הקובץ ירד', { type: 'success' });
}

/* ================= Export / Import (Excel) ================= */
const presetCat = (name) => {
  const v = CATS.includes(state.tab) ? state.tab : 'books';
  const r = $(`input[name="${name}"][value="${v}"]`);
  if (r) r.checked = true;
};
const radio = (name) => $(`input[name="${name}"]:checked`)?.value;

function openExport() { presetCat('export-cat'); openSheet(S.export); }
$('#export-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cat = radio('export-cat'), raw = state.raw[cat], btn = $('#export-go');
  if (!raw || !Object.keys(raw).length) return toast('אין נתונים לייצוא בקטגוריה הזו');
  setBusy(btn, true);
  try {
    const { exportCategory } = await import('./excel.js');
    await exportCategory(cat, raw);
    closeSheet(S.export, true);
    toast('הקובץ ירד', { type: 'success' });
  } catch (err) {
    console.error(err); toast('הייצוא נכשל', { type: 'error' });
  } finally { setBusy(btn, false); }
});

const imp = { file: $('#import-file'), drop: $('#drop'), name: $('#drop-name'), sub: $('#drop-sub'), out: $('#import-results'), go: $('#import-go') };
function showFile() {
  const fl = imp.file.files[0];
  imp.name.textContent = fl ? fl.name : 'בחר קובץ או גרור לכאן';
  imp.sub.textContent = fl ? `${(fl.size / 1024).toFixed(0)} KB` : '.xlsx או .xls';
}
function openImport() {
  presetCat('import-cat');
  imp.file.value = ''; showFile(); imp.out.innerHTML = '';
  openSheet(S.import);
}
imp.file.addEventListener('change', showFile);
['dragenter', 'dragover'].forEach((t) => imp.drop.addEventListener(t, (e) => { e.preventDefault(); imp.drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => imp.drop.addEventListener(t, (e) => { e.preventDefault(); imp.drop.classList.remove('over'); }));
imp.drop.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) { imp.file.files = e.dataTransfer.files; showFile(); }
});
$('#import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = imp.file.files[0];
  if (!file) { imp.out.innerHTML = '<p class="error">נא לבחור קובץ.</p>'; return; }
  const cat = radio('import-cat');
  setBusy(imp.go, true);
  imp.out.innerHTML = '<p class="muted">מעבד קובץ…</p>';
  try {
    const { importFile } = await import('./excel.js');
    const r = await importFile(file, cat);
    let h = `<p class="ok"><b>${r.imported}</b> פריטים נוספו אל ${TABS[cat].label}.</p>`;
    if (r.invalid) h += `<p class="muted">${r.invalid} שורות ללא שם דולגו.</p>`;
    if (r.skipped.length) h += `<details><summary>${r.skipped.length} פריטים לא נוספו כי כבר קיימים</summary><ul>${r.skipped.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>`;
    imp.out.innerHTML = h;
    if (r.imported) toast('הייבוא הושלם', { type: 'success' });
  } catch (err) {
    console.error(err);
    imp.out.innerHTML = `<p class="error">${err.message === 'empty' ? 'הקובץ ריק או שאינו בפורמט הנכון.' : 'שגיאה בעיבוד הקובץ. ודא שהוא בפורמט Excel תקין.'}</p>`;
  } finally { setBusy(imp.go, false); }
});

/* ================= PWA ================= */
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
