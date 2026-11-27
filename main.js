/* main.js — app shell: auth, tabs, search, menu, theme, wiring. */
import { $, $$, icon, toast, enter, confirmDialog, closeAllLayers, hasLayers } from './ui.js';
import * as data from './data.js';
import * as inv from './inventory.js';
import { openExport, openImport } from './excel.js';

const TABS = ['books', 'food', 'items', 'recipes'];
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

const state = {
  tab: 'books', q: { inv: '', rec: '' }, sort: store.get('mm-sort') === 'new' ? 'new' : 'alpha',
  flash: null, user: null,
};
{
  const p = new URLSearchParams(location.search).get('active');
  const saved = store.get('mm-tab');
  state.tab = p === 'recipes' ? 'recipes' : TABS.includes(saved) ? saved : 'books';
}
const isRec = () => state.tab === 'recipes';
const qKey = () => (isRec() ? 'rec' : 'inv');
const scrollPos = {};

/* ---------- Elements ---------- */
const body = document.body;
const listInv = $('#list-inv'), listRec = $('#list-rec'), panelRec = $('#panel-recipes');
const searchInput = $('#search'), clearBtn = $('#search-clear'), scanBtn = $('#search-scan');
const countEl = $('#count'), sortBtn = $('#sort-btn'), fab = $('#fab'), fabLabel = $('#fab-label');
const dock = $('#dock'), menu = $('#menu'), menuBtn = $('#menu-btn');

$$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, +el.dataset.size || 20, +el.dataset.sw || 1.75); });

/* ---------- Theme ---------- */
function applyThemeMeta() {
  const m = $('#theme-color-meta');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0e1311';
}
$('#theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  applyThemeMeta();
});
applyThemeMeta();

/* ---------- Recipes (lazy module) ---------- */
let recipesMod = null, recipesPromise = null;
function setCount(text) { countEl.textContent = text || ''; }
function ensureRecipes() {
  if (recipesPromise) return recipesPromise;
  recipesPromise = import('./recipes.js').then(mod => {
    recipesMod = mod;
    mod.mount({ list: listRec, getQuery: () => state.q.rec, onStats: s => { if (isRec()) setCount(s.text); } });
    if (state.user) mod.start();
    return mod;
  }).catch(err => {
    console.error('recipes module failed', err);
    recipesPromise = null;
    listRec.innerHTML = `<div class="empty"><div class="empty-art is-error">${icon('alert', 28)}</div><h3>לא הצלחנו לטעון את ספר המתכונים</h3><p>בדקו את החיבור ונסו שוב.</p><div class="empty-actions"><button class="btn btn-soft" data-act="retry-mod">נסו שוב</button></div></div>`;
    throw err;
  });
  return recipesPromise;
}
listRec.addEventListener('click', e => { if (e.target.closest('[data-act="retry-mod"]')) { listRec.innerHTML = ''; ensureRecipes().catch(() => {}); } });
listRec.innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="skel-card" style="--d:${i * 70}ms"><i></i><i></i><i></i></div>`).join('');

/* ---------- Rendering ---------- */
let rafId = 0;
const scheduleRender = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); };

function render() {
  if (isRec()) { if (recipesMod) recipesMod.render(); return; }
  const r = inv.render(listInv, { category: state.tab, query: state.q.inv, sort: state.sort, flashId: state.flash && state.flash.cat === state.tab ? state.flash.id : null });
  setCount(r.text);
}

function syncChrome() {
  const rec = isRec();
  dock.dataset.tab = state.tab;
  dock.style.setProperty('--i', TABS.indexOf(state.tab));
  $$('.tab', dock).forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === state.tab)));
  listInv.hidden = rec; panelRec.hidden = !rec;
  scanBtn.hidden = rec; sortBtn.hidden = rec;
  searchInput.value = state.q[qKey()];
  clearBtn.hidden = !searchInput.value;
  searchInput.placeholder = rec ? 'חיפוש לפי שם או מצרכים' : inv.CAT[state.tab].placeholder;
  fabLabel.textContent = rec ? 'מתכון חדש' : 'הוספה';
  fab.setAttribute('aria-label', rec ? 'מתכון חדש' : inv.CAT[state.tab].addLabel);
  sortBtn.innerHTML = `${icon('sort', 16)}<span>${state.sort === 'new' ? 'החדשים ראשון' : 'א–ת'}</span>`;
}

function setTab(tab) {
  if (tab === state.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const prev = TABS.indexOf(state.tab), next = TABS.indexOf(tab);
  scrollPos[state.tab] = window.scrollY;
  state.tab = tab;
  store.set('mm-tab', tab);
  syncChrome();
  if (isRec()) ensureRecipes().catch(() => {});
  render();
  enter(isRec() ? panelRec : listInv, -Math.sign(next - prev));
  window.scrollTo(0, scrollPos[tab] || 0);
}

/* ---------- Inventory wiring ---------- */
inv.configure({
  switchTo: cat => setTab(cat),
  category: () => (isRec() ? 'books' : state.tab),
  added: (cat, id) => {
    state.flash = { cat, id };
    state.q.inv = '';
    if (cat !== state.tab || isRec()) setTab(cat); else { syncChrome(); render(); }
    setTimeout(() => { state.flash = null; if (!isRec()) render(); }, 1800);
  },
});
inv.bind(listInv);
data.subscribe(cat => { if (!isRec() && cat === state.tab) scheduleRender(); });

/* ---------- Search ---------- */
searchInput.addEventListener('input', () => {
  state.q[qKey()] = searchInput.value;
  clearBtn.hidden = !searchInput.value;
  scheduleRender();
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (searchInput.value) { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); } else searchInput.blur(); }
  if (e.key === 'Enter') searchInput.blur();
});
clearBtn.addEventListener('click', () => { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); searchInput.focus(); });
scanBtn.addEventListener('click', () => inv.scanAndFind());
document.addEventListener('keydown', e => {
  if (e.key === '/' && !hasLayers() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && body.dataset.view === 'app') { e.preventDefault(); searchInput.focus(); }
});
sortBtn.addEventListener('click', () => {
  state.sort = state.sort === 'alpha' ? 'new' : 'alpha';
  store.set('mm-sort', state.sort);
  syncChrome(); render();
});

/* ---------- Tabs / FAB ---------- */
dock.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.tab); });
dock.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const i = TABS.indexOf(state.tab) + (e.key === 'ArrowLeft' ? 1 : -1);
  if (TABS[i]) { setTab(TABS[i]); $(`.tab[data-tab="${TABS[i]}"]`, dock).focus(); }
});
fab.addEventListener('click', async () => {
  if (isRec()) { try { (await ensureRecipes()).openEditor(); } catch {} }
  else inv.openItemForm({ mode: 'add', category: state.tab });
});
{
  let lastY = window.scrollY;
  addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - lastY) > 6) { fab.classList.toggle('compact', y > lastY && y > 160); lastY = y; }
  }, { passive: true });
  new IntersectionObserver(([en]) => $('.toolbar').classList.toggle('stuck', !en.isIntersecting)).observe($('#sentinel'));
}

/* ---------- Menu ---------- */
function toggleMenu(open) {
  open = open ?? !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) { const f = $('button', menu); f && requestAnimationFrame(() => f.focus({ preventScroll: true })); }
}
menuBtn.addEventListener('click', () => toggleMenu());
document.addEventListener('pointerdown', e => { if (menu.classList.contains('open') && !menu.contains(e.target) && !menuBtn.contains(e.target)) toggleMenu(false); });
document.addEventListener('keydown', e => {
  if (!menu.classList.contains('open')) return;
  if (e.key === 'Escape') { toggleMenu(false); menuBtn.focus(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = $$('button', menu), i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }
});
menu.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  toggleMenu(false);
  const cat = isRec() ? 'books' : state.tab;
  switch (b.dataset.act) {
    case 'export-xlsx': openExport(cat); break;
    case 'import-xlsx': openImport(cat); break;
    case 'export-word': try { (await ensureRecipes()).exportWord(); } catch {} break;
    case 'logout':
      if (await confirmDialog({ title: 'להתנתק?', message: 'תצטרכו להתחבר שוב כדי לראות את הנתונים.', confirmText: 'התנתקות' })) auth.signOut();
      break;
  }
});

/* ---------- Auth ---------- */
const authForm = $('#auth-form'), emailEl = $('#email'), passEl = $('#password'), authErr = $('#auth-error');
const loginBtn = $('#login-btn'), registerBtn = $('#register-btn');
const AUTH_ERRORS = {
  'auth/invalid-email': 'כתובת האימייל אינה תקינה.',
  'auth/user-not-found': 'לא נמצא חשבון עם האימייל הזה.',
  'auth/wrong-password': 'הסיסמה שגויה.',
  'auth/invalid-credential': 'האימייל או הסיסמה שגויים.',
  'auth/invalid-login-credentials': 'האימייל או הסיסמה שגויים.',
  'auth/email-already-in-use': 'כבר קיים חשבון עם האימייל הזה. נסו להתחבר.',
  'auth/weak-password': 'הסיסמה חלשה מדי — לפחות 6 תווים.',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
  'auth/network-request-failed': 'אין חיבור לאינטרנט.',
  'auth/user-disabled': 'החשבון הזה הושבת.',
};
const showAuthError = msg => { authErr.textContent = msg; authErr.hidden = !msg; };
function authBusy(btn, on) { [loginBtn, registerBtn].forEach(b => { b.disabled = on; }); btn.classList.toggle('loading', on); }
function credentials() {
  const email = emailEl.value.trim(), password = passEl.value;
  if (!email || !password) { showAuthError('נא למלא אימייל וסיסמה.'); (email ? passEl : emailEl).focus(); return null; }
  showAuthError('');
  return { email, password };
}
async function runAuth(btn, fn, fallback) {
  const c = credentials();
  if (!c) return;
  authBusy(btn, true);
  try { await fn(c.email, c.password); }
  catch (err) { console.error(fallback, err); showAuthError(AUTH_ERRORS[err.code] || 'משהו השתבש. נסו שוב.'); }
  finally { authBusy(btn, false); }
}
authForm.addEventListener('submit', e => { e.preventDefault(); passEl.autocomplete = 'current-password'; runAuth(loginBtn, (a, b) => auth.signInWithEmailAndPassword(a, b), 'Login error:'); });
registerBtn.addEventListener('click', () => { passEl.autocomplete = 'new-password'; runAuth(registerBtn, (a, b) => auth.createUserWithEmailAndPassword(a, b), 'Registration error:'); });
$('#pass-toggle').addEventListener('click', e => {
  const show = passEl.type === 'password';
  passEl.type = show ? 'text' : 'password';
  e.currentTarget.innerHTML = icon(show ? 'eyeoff' : 'eye', 20);
  e.currentTarget.setAttribute('aria-label', show ? 'הסתרת סיסמה' : 'הצגת סיסמה');
});

const splash = $('#splash'), t0 = performance.now();
let splashGone = false;
function hideSplash() {
  if (splashGone) return; splashGone = true;
  setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 400); }, Math.max(0, 450 - (performance.now() - t0)));
}

function onSignedIn(user) {
  state.user = user;
  $('#menu-user').textContent = user.email || '';
  body.dataset.view = 'app';
  syncChrome();
  data.start();
  render();
  ensureRecipes().catch(() => {});
  if (recipesMod) recipesMod.start();
}
function onSignedOut() {
  state.user = null;
  closeAllLayers();
  toggleMenu(false);
  data.stop();
  if (recipesMod) recipesMod.stop();
  state.q = { inv: '', rec: '' };
  passEl.value = ''; passEl.type = 'password';
  showAuthError('');
  body.dataset.view = 'auth';
  if (matchMedia('(pointer: fine)').matches) emailEl.focus();
}

if (typeof auth === 'undefined' || typeof database === 'undefined') {
  body.dataset.view = 'auth';
  showAuthError('לא ניתן להתחבר לשרת. רעננו את הדף ונסו שוב.');
  hideSplash();
} else {
  auth.onAuthStateChanged(user => { user ? onSignedIn(user) : onSignedOut(); hideSplash(); });
  setTimeout(hideSplash, 6000);

  let wasOnline = null, offTimer = 0;
  data.watchConnection(on => {
    if (on) { clearTimeout(offTimer); if (wasOnline === false) toast('החיבור חזר'); wasOnline = true; }
    else if (wasOnline !== false) offTimer = setTimeout(() => { wasOnline = false; toast('אין חיבור — שינויים יסונכרנו כשהחיבור יחזור', { duration: 4200 }); }, 4000);
  });
}

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('יש גרסה חדשה', { action: 'רענון', onAction: () => location.reload(), duration: 10000 });
        });
      });
    }).catch(() => {});
  });
}
