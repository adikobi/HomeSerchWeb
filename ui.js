/* ui.js — shared primitives: DOM helpers, icons, text folding/search, links,
   layers (sheets / alerts), history-aware back handling, toasts. */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

/* ---------- Icons ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10M12 7v10M16 7v10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  food: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  box: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  chef: '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  chevron: '<path d="m15 18-6-6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flash: '<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.9 17.9 0 0 1-2.16 3.19"/><path d="M6.6 6.6A17.5 17.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/>',
  sort: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>',
  sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M10 9H8"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3.5"/>',
};
export const icon = (name, size = 20, sw = 1.75) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

/* ---------- Text folding / search ---------- */
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export const fold = s => String(s ?? '')
  .toLowerCase()
  .replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '')
  .replace(/[ךםןףץ]/g, c => FINALS[c]);
export const tokens = q => fold(q).split(/\s+/).filter(Boolean);
export const matchAll = (hay, toks) => toks.every(t => hay.includes(t));

export function highlight(text, toks) {
  text = String(text ?? '');
  if (!toks || !toks.length) return esc(text);
  let folded = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i); }
  }
  const mark = new Uint8Array(text.length);
  for (const t of toks) {
    if (!t) continue;
    let p = 0;
    while ((p = folded.indexOf(t, p)) !== -1) {
      for (let k = p; k < p + t.length; k++) mark[map[k]] = 1;
      p += t.length;
    }
  }
  let out = '', open = false;
  for (let i = 0; i < text.length; i++) {
    if (mark[i] && !open) { out += '<mark>'; open = true; }
    else if (!mark[i] && open) { out += '</mark>'; open = false; }
    out += esc(text[i]);
  }
  return open ? out + '</mark>' : out;
}

/* ---------- Links ---------- */
export function findLinks(text) {
  text = String(text ?? '');
  const out = [];
  const re = /(?:https?:\/\/|www\.)[^\s<>"'\u0590-\u05FF]+/gi;
  let m;
  while ((m = re.exec(text))) {
    const url = m[0].replace(/[.,;:!?)\]}'"]+$/, '');
    if (url.length < 6) continue;
    const href = /^www\./i.test(url) ? 'https://' + url : url;
    let u;
    try { u = new URL(href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) continue;
    let label = u.hostname.replace(/^www\./, '');
    const rest = (u.pathname + u.search).replace(/^\/$/, '');
    if (rest) label += rest.length > 18 ? rest.slice(0, 16) + '…' : rest;
    out.push({ start: m.index, end: m.index + url.length, href, label });
  }
  return out;
}

export function linkify(text, { toks = [], plain = false } = {}) {
  text = String(text ?? '');
  let out = '', last = 0;
  for (const l of findLinks(text)) {
    out += highlight(text.slice(last, l.start), toks);
    out += plain
      ? `<a href="${esc(l.href)}">${esc(l.href)}</a>`
      : `<a class="link" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" dir="ltr"><span>${esc(l.label)}</span>${icon('external', 13)}</a>`;
    last = l.end;
  }
  return out + highlight(text.slice(last), toks);
}

/* ---------- Misc helpers ---------- */
export const haptic = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

const scripts = new Map();
export function loadScript(src) {
  if (scripts.has(src)) return scripts.get(src);
  const p = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res();
    s.onerror = () => { scripts.delete(src); s.remove(); rej(new Error('load failed: ' + src)); };
    document.head.append(s);
  });
  scripts.set(src, p);
  return p;
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Quick directional entrance for a view (tab switches). */
export function enter(el, dir = 0) {
  el.getAnimations().forEach(a => a.cancel());
  if (reducedMotion()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' }); return; }
  el.animate(
    [{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' }
  );
}

/* ---------- Toasts ---------- */
export function toast(message, { action, onAction, duration, tone = 'default' } = {}) {
  const host = $('#toasts');
  if (!host) return () => {};
  duration = duration ?? (action ? 5500 : 2800);
  const el = document.createElement('div');
  el.className = 'toast' + (tone !== 'default' ? ' toast-' + tone : '');
  el.innerHTML = `<span class="toast-msg">${esc(message)}</span>` +
    (action ? `<button type="button" class="toast-action">${esc(action)}</button>` : '');
  host.append(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  void el.offsetHeight;
  el.classList.add('in');
  let gone = false, timer;
  const dismiss = () => {
    if (gone) return; gone = true; clearTimeout(timer);
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };
  timer = setTimeout(dismiss, duration);
  const btn = $('.toast-action', el);
  if (btn) btn.addEventListener('click', () => { try { onAction && onAction(); } finally { dismiss(); } });
  return dismiss;
}

/* ---------- Layers (sheets, alerts, scanner) ---------- */
const stack = [];
let histPushed = false, expectedPops = 0, uid = 0;
const root = () => $('#layers');

function setInert(el, on) {
  if (!el) return;
  if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
  else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
}
function syncInert() {
  setInert($('#app'), stack.length > 0);
  document.documentElement.classList.toggle('locked', stack.length > 0);
  stack.forEach((l, i) => setInert(l.el, i < stack.length - 1));
}

/* One history entry represents "a layer is open", so the system back
   button / swipe closes the top layer instead of leaving the app. */
function syncHistory() {
  if (expectedPops > 0) return;
  if (stack.length > 0 && !histPushed) {
    try { history.pushState({ mm: 1 }, ''); histPushed = true; } catch {}
  } else if (stack.length === 0 && histPushed) {
    histPushed = false; expectedPops++; history.back();
  }
}
window.addEventListener('popstate', async () => {
  if (expectedPops > 0) { expectedPops--; syncHistory(); return; }
  if (!histPushed) return;
  histPushed = false;
  const top = stack[stack.length - 1];
  if (top) await top.requestClose({});
  syncHistory();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (top) { e.preventDefault(); top.requestClose({}); }
});

export function pushLayer(layer) {
  layer.opener = document.activeElement;
  stack.push(layer);
  syncInert();
  syncHistory();
}
export function popLayer(layer) {
  const i = stack.indexOf(layer);
  if (i < 0) return;
  stack.splice(i, 1);
  syncInert();
  setTimeout(syncHistory, 0);
  const o = layer.opener;
  if (o && o.isConnected && typeof o.focus === 'function') requestAnimationFrame(() => o.focus({ preventScroll: true }));
}
export function closeAllLayers() {
  [...stack].reverse().forEach(l => l.requestClose({ force: true }));
}
export const hasLayers = () => stack.length > 0;

function enableDrag(sheet, handle, requestClose, guarded) {
  const mobile = () => matchMedia('(max-width: 699.98px)').matches;
  let pid = null, startY = 0, startT = 0, dy = 0;
  handle.addEventListener('pointerdown', e => {
    if (!mobile() || pid !== null || e.button > 0 || e.target.closest('button,a,input')) return;
    pid = e.pointerId; startY = e.clientY; startT = performance.now(); dy = 0;
    handle.setPointerCapture(pid);
    sheet.style.transition = 'none';
  });
  handle.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const raw = e.clientY - startY;
    dy = raw > 0 ? raw : raw * 0.12;
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = async e => {
    if (e.pointerId !== pid) return;
    pid = null;
    const v = dy / Math.max(1, performance.now() - startT);
    sheet.style.transition = '';
    if (dy > 110 || (dy > 12 && v > 0.11)) {
      if (!guarded) sheet.style.transform = 'translateY(100%)'; else sheet.style.transform = '';
      const ok = await requestClose({});
      if (!ok) sheet.style.transform = '';
    } else sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

export function openSheet({ title = '', content = '', footer = '', variant = 'sheet', className = '', beforeClose, onClosed } = {}) {
  const id = 'sh' + (++uid);
  const el = document.createElement('div');
  el.className = `layer layer-${variant} ${className}`.trim();
  el.innerHTML = `
    <div class="scrim"></div>
    <section class="sheet" role="${variant === 'alert' ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="${id}-t" tabindex="-1">
      <div class="sheet-head">
        <span class="grip" aria-hidden="true"></span>
        <h2 class="sheet-title" id="${id}-t" dir="auto"></h2>
        <button type="button" class="icon-btn sheet-close" data-close aria-label="סגירה">${icon('x')}</button>
      </div>
      <div class="sheet-body"></div>
      <div class="sheet-foot"></div>
    </section>`;
  const sheet = $('.sheet', el), body = $('.sheet-body', el), foot = $('.sheet-foot', el), head = $('.sheet-head', el);
  $('.sheet-title', el).textContent = title;
  const put = (t, c) => { if (c instanceof Node) t.append(c); else t.innerHTML = c; };
  put(body, content);
  if (footer) put(foot, footer); else foot.hidden = true;

  let closing = false, resolveClosed;
  const closed = new Promise(r => { resolveClosed = r; });
  const layer = { el, requestClose };

  function close(result) {
    if (closing) return;
    closing = true;
    popLayer(layer);
    el.classList.remove('open');
    setTimeout(() => { el.remove(); try { onClosed && onClosed(result); } finally { resolveClosed(result); } }, 280);
  }
  async function requestClose(opts = {}) {
    if (closing) return true;
    if (beforeClose && !opts.force) {
      const ok = await beforeClose();
      if (ok === false) return false;
    }
    close(undefined);
    return true;
  }
  el.addEventListener('click', e => {
    if (e.target.closest('.scrim') || e.target.closest('[data-close]')) requestClose({});
  });
  enableDrag(sheet, head, requestClose, !!beforeClose);

  root().append(el);
  pushLayer(layer);
  void el.offsetHeight;
  el.classList.add('open');
  const first = $('[autofocus]', sheet);
  if (first && matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
  else sheet.focus({ preventScroll: true });

  return {
    el, sheet, body, foot, closed, close, requestClose,
    setTitle: t => { $('.sheet-title', el).textContent = t; },
  };
}

export function confirmDialog({ title, message = '', confirmText = 'אישור', cancelText = 'ביטול', danger = false }) {
  return new Promise(resolve => {
    const ctrl = openSheet({
      variant: 'alert', title,
      content: message ? `<p class="alert-msg">${esc(message)}</p>` : '',
      footer: `<button type="button" class="btn btn-ghost" data-act="cancel">${esc(cancelText)}</button>
               <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(confirmText)}</button>`,
    });
    ctrl.foot.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) ctrl.close(b.dataset.act === 'ok');
    });
    ctrl.closed.then(r => resolve(r === true));
  });
}
