export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const vibrate = (ms = 20) => { try { navigator.vibrate?.(ms); } catch {} };

/* ---------- Toasts ---------- */
const host = $('#toasts');
const hasPopover = 'popover' in HTMLElement.prototype;
if (hasPopover) host.setAttribute('popover', 'manual');

function dropToast(el) {
  if (el._gone) return;
  el._gone = true;
  el.classList.remove('in');
  setTimeout(() => {
    el.remove();
    if (!host.children.length && hasPopover) { try { host.hidePopover(); } catch {} }
  }, 180);
}

export function toast(msg, { type = 'info', duration = 3200, action } = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = ic(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info') + '<span></span>';
  el.querySelector('span').textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action.label;
    b.onclick = () => { action.run(); dropToast(el); };
    el.append(b);
  }
  host.append(el);
  while (host.children.length > 3) dropToast(host.firstElementChild);
  if (hasPopover) { try { host.hidePopover(); } catch {} try { host.showPopover(); } catch {} }
  void el.offsetWidth;
  el.classList.add('in');
  const t = setTimeout(() => dropToast(el), duration);
  el.addEventListener('click', (e) => { if (!e.target.closest('.toast-action')) { clearTimeout(t); dropToast(el); } });
}

/* ---------- Sheets (native <dialog>, history-aware) ---------- */
const stack = [];
const waiters = [];
const EXIT_MS = 220;

function flush() { waiters.splice(0).forEach((r) => r()); }

function waitHistory(fn, sheets) {
  return new Promise((res) => {
    waiters.push(res);
    fn();
    setTimeout(() => {
      sheets.forEach((s) => { if (stack.includes(s)) finish(s); });
      flush();
    }, 600);
  });
}

function finish(sheet) {
  const i = stack.indexOf(sheet);
  if (i < 0) return;
  stack.splice(i, 1);
  sheet._closing = null;
  sheet.onClosing?.();
  sheet.el.classList.remove('open');
  sheet.timer = setTimeout(() => {
    sheet.timer = null;
    sheet.el.close();
    sheet.panel.style.transform = '';
    sheet.panel.style.transition = '';
    sheet.onClosed?.();
  }, EXIT_MS);
}

export const isOpen = (s) => stack.includes(s);

export function createSheet(el, opts = {}) {
  const sheet = {
    el, panel: el.querySelector('.sheet-panel'), guard: null, onClosing: null,
    onClosed: null, forced: false, timer: null, _closing: null, ...opts,
  };
  el.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(sheet); });
  if (opts.backdropClose !== false) {
    el.addEventListener('click', (e) => { if (e.target === el) closeSheet(sheet); });
  }
  $$('[data-close]', el).forEach((b) => b.addEventListener('click', () => closeSheet(sheet)));
  initDrag(sheet);
  return sheet;
}

export function openSheet(sheet) {
  if (stack.includes(sheet)) return;
  clearTimeout(sheet.timer);
  sheet.timer = null;
  sheet.forced = false;
  if (!sheet.el.open) sheet.el.showModal();
  stack.push(sheet);
  history.pushState({ sheet: stack.length }, '');
  void sheet.panel.offsetWidth;
  sheet.el.classList.add('open');
}

export function closeSheet(sheet, force = false) {
  const idx = stack.indexOf(sheet);
  if (idx < 0) return Promise.resolve();
  if (sheet._closing) return sheet._closing;
  if (!force && sheet.guard?.()) {
    return askDiscard().then((ok) => (ok ? closeSheet(sheet, true) : undefined));
  }
  const n = stack.length - idx;
  const group = stack.slice(idx);
  group.forEach((s) => (s.forced = true));
  sheet._closing = waitHistory(() => history.go(-n), group);
  return sheet._closing;
}

export function closeAll() {
  if (!stack.length) return Promise.resolve();
  const group = stack.slice();
  group.forEach((s) => (s.forced = true));
  return waitHistory(() => history.go(-group.length), group);
}

window.addEventListener('popstate', () => {
  const depth = history.state?.sheet || 0;
  while (stack.length > depth) {
    const top = stack[stack.length - 1];
    if (!top.forced && top.guard?.()) {
      for (let d = depth + 1; d <= stack.length; d++) history.pushState({ sheet: d }, '');
      askDiscard().then((ok) => { if (ok) closeSheet(top, true); });
      break;
    }
    finish(top);
  }
  flush();
});
// a reload can leave a stale sheet entry in history
if (history.state?.sheet) history.replaceState(null, '');

/* Swipe-down to dismiss (mobile bottom sheets) */
function initDrag(sheet) {
  const zones = $$('.sheet-grab, .sheet-head', sheet.el);
  if (!zones.length) return;
  const mq = matchMedia('(max-width: 719px)');
  let id = null, y0 = 0, t0 = 0, dy = 0;
  zones.forEach((z) => {
    z.addEventListener('pointerdown', (e) => {
      if (id !== null || !mq.matches || e.target.closest('button,a,input')) return;
      id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0;
      z.setPointerCapture(id);
      sheet.panel.style.transition = 'none';
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const d = e.clientY - y0;
      dy = d < 0 ? d * 0.15 : d;
      sheet.panel.style.transform = `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      const v = dy / Math.max(1, performance.now() - t0);
      const dismiss = dy > 110 || (dy > 24 && v > 0.11);
      if (dismiss && !sheet.guard?.()) {
        sheet.panel.style.transition = 'transform 200ms cubic-bezier(.23,1,.32,1)';
        sheet.panel.style.transform = 'translateY(100%)';
        closeSheet(sheet, true);
      } else {
        sheet.panel.style.transition = '';
        sheet.panel.style.transform = '';
        if (dismiss) closeSheet(sheet);
      }
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  });
}

/* ---------- Confirm dialog ---------- */
let confirmSheet, cEls;
export function initConfirm(el) {
  confirmSheet = createSheet(el);
  cEls = { title: $('#confirm-title'), msg: $('#confirm-msg'), ok: $('#confirm-ok'), no: $('#confirm-cancel') };
}
export function confirmDialog({ title, message = '', confirmText = 'אישור', cancelText = 'ביטול', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    cEls.title.textContent = title;
    cEls.msg.textContent = message;
    cEls.ok.textContent = confirmText;
    cEls.no.textContent = cancelText;
    cEls.ok.className = 'btn grow ' + (danger ? 'danger-solid' : 'primary');
    const done = async (v) => {
      if (settled) return;
      settled = true;
      await closeSheet(confirmSheet, true);
      resolve(v);
    };
    cEls.ok.onclick = () => done(true);
    cEls.no.onclick = () => done(false);
    confirmSheet.onClosing = () => { if (!settled) { settled = true; resolve(false); } };
    openSheet(confirmSheet);
    cEls.no.focus();
  });
}
const askDiscard = () =>
  confirmDialog({ title: 'לבטל את השינויים?', message: 'מה שהזנת לא יישמר.', confirmText: 'בטל שינויים', cancelText: 'המשך עריכה', danger: true });

/* ---------- Misc ---------- */
export function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight + 2, innerHeight * 0.55) + 'px';
}
export function setBusy(btn, on) {
  btn.dataset.loading = on ? 'true' : 'false';
  btn.disabled = on;
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

export function initMenu(btn, menu) {
  const set = (open) => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    menu.inert = !open;
  };
  set(false);
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!menu.classList.contains('open')); if (menu.classList.contains('open')) $('button', menu).focus(); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('open')) return;
    if (e.key === 'Escape') { set(false); btn.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $$('button', menu), i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  });
  menu.addEventListener('click', () => set(false));
}
