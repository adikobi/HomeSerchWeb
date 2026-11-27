/* inventory.js — inventory list rendering, item detail sheet, add/edit form, scan flow. */
import { $, esc, icon, fold, tokens, matchAll, highlight, linkify, openSheet, confirmDialog, toast, haptic, copyText } from './ui.js';
import * as data from './data.js';
import { scanBarcode } from './scanner.js';

export const CAT = {
  books: { label: 'ספרים', many: 'ספרים', one: 'ספר אחד', icon: 'book', addLabel: 'הוספת ספר', emptyTitle: 'עוד אין ספרים', emptyText: 'הוסיפו את הספר הראשון, או סרקו את הברקוד שלו.', placeholder: 'חיפוש לפי שם, סופר או מיקום', nameLabel: 'שם הספר' },
  food: { label: 'מזון', many: 'פריטי מזון', one: 'פריט מזון אחד', icon: 'food', addLabel: 'הוספת מזון', emptyTitle: 'עוד אין מזון', emptyText: 'הוסיפו את הפריט הראשון, או סרקו את הברקוד שלו.', placeholder: 'חיפוש לפי שם או מיקום', nameLabel: 'שם הפריט' },
  items: { label: 'פריטים', many: 'פריטים', one: 'פריט אחד', icon: 'box', addLabel: 'הוספת פריט', emptyTitle: 'עוד אין פריטים', emptyText: 'הוסיפו את הפריט הראשון, או סרקו את הברקוד שלו.', placeholder: 'חיפוש לפי שם או מיקום', nameLabel: 'שם הפריט' },
};

let hooks = { switchTo() {}, added() {}, category: () => 'books' };
export const configure = h => { hooks = { ...hooks, ...h }; };

const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });
const hay = it => (it._h ??= fold([it.description, it.author, it.location, it.notes, it.barcode, it.name].filter(Boolean).join('\n')));

export function countText(cat, shown, total, filtered) {
  if (!total) return '';
  if (filtered) return `${shown} מתוך ${total}`;
  return total === 1 ? CAT[cat].one : `${total} ${CAT[cat].many}`;
}

const skeleton = n => Array.from({ length: n }, (_, i) =>
  `<div class="skel-row" style="--d:${i * 70}ms"><span class="skel-tile"></span><span class="skel-lines"><i></i><i></i></span></div>`).join('');

function letterOf(t) {
  const ch = String(t || '').trim().charAt(0);
  if (!ch) return '#';
  const f = fold(ch).toUpperCase();
  if (/[\u05D0-\u05EA]|[A-Z]/.test(f)) return f;
  return /\d/.test(f) ? '0-9' : '#';
}

function rowHtml(it, cat, toks, flash) {
  const title = it.description || 'ללא שם';
  const author = cat === 'books' && it.author ? `<span class="row-author">${highlight(it.author, toks)}</span>` : '';
  const loc = it.location ? `<span class="row-loc">${icon('pin', 13)}${highlight(it.location, toks)}</span>` : '';
  return `<button type="button" class="row${flash ? ' flash' : ''}" data-id="${esc(it.id)}" data-cat="${cat}">
    <span class="tile tile-${cat}">${icon(CAT[cat].icon, 22)}</span>
    <span class="row-main"><span class="row-title" dir="auto">${highlight(title, toks)}</span><span class="row-sub">${author}${loc}</span></span>
    <span class="row-chev">${icon('chevron', 18)}</span>
  </button>`;
}

export function render(host, { category, query, sort, flashId }) {
  const c = CAT[category];
  if (!data.isLoaded(category)) { host.innerHTML = skeleton(7); return { loading: true, text: '' }; }
  const err = data.getError(category);
  if (err) {
    host.innerHTML = `<div class="empty"><div class="empty-art is-error">${icon('alert', 28)}</div><h3>לא הצלחנו לטעון</h3><p>בדקו את החיבור ונסו שוב.</p><div class="empty-actions"><button class="btn btn-soft" data-act="retry">נסו שוב</button></div></div>`;
    return { loading: false, text: '' };
  }
  const all = data.getItems(category);
  const toks = tokens(query);
  const list = toks.length ? all.filter(it => matchAll(hay(it), toks)) : all.slice();
  if (sort === 'new') list.sort((a, b) => (a.id < b.id ? 1 : -1));
  else list.sort((a, b) => collator.compare(a.description || '', b.description || ''));

  if (!list.length) {
    if (!toks.length) {
      host.innerHTML = `<div class="empty"><div class="empty-art tile-${category}">${icon(c.icon, 30)}</div><h3>${c.emptyTitle}</h3><p>${c.emptyText}</p>
        <div class="empty-actions"><button class="btn btn-primary" data-act="add">${icon('plus', 18)}${c.addLabel}</button><button class="btn btn-soft" data-act="scan">${icon('scan', 18)}סריקת ברקוד</button></div></div>`;
    } else {
      const others = data.CATEGORIES.filter(k => k !== category).map(k => ({ k, n: data.getItems(k).filter(it => matchAll(hay(it), toks)).length })).filter(o => o.n);
      host.innerHTML = `<div class="empty"><div class="empty-art">${icon('search', 28)}</div><h3 dir="auto">אין תוצאות ל־“${esc(query.trim())}”</h3>
        <p>${others.length ? 'נמצאו תוצאות בקטגוריות אחרות:' : 'נסו מילה אחרת, או הוסיפו את זה עכשיו.'}</p>
        <div class="empty-actions">${others.map(o => `<button class="chip" data-switch="${o.k}">${CAT[o.k].label} · ${o.n}</button>`).join('')}
        <button class="btn btn-soft" data-act="add-named" data-name="${esc(query.trim())}">${icon('plus', 18)}הוספה כחדש</button></div></div>`;
    }
    return { loading: false, text: countText(category, 0, all.length, !!toks.length) };
  }

  let html = '', lastLetter = '';
  const grouped = sort !== 'new' && !toks.length;
  for (const it of list) {
    if (grouped) {
      const l = letterOf(it.description);
      if (l !== lastLetter) { html += `<div class="sect" role="presentation">${esc(l)}</div>`; lastLetter = l; }
    }
    html += rowHtml(it, category, toks, flashId && it.id === flashId);
  }
  host.innerHTML = html;
  if (flashId) {
    const row = host.querySelector('.row.flash');
    if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
  return { loading: false, text: countText(category, list.length, all.length, !!toks.length) };
}

export function bind(host) {
  host.addEventListener('click', e => {
    const row = e.target.closest('.row');
    if (row) { openItemDetail(row.dataset.cat, row.dataset.id); return; }
    const sw = e.target.closest('[data-switch]');
    if (sw) { hooks.switchTo(sw.dataset.switch); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'add') openItemForm({ mode: 'add', category: hooks.category() });
    else if (a.dataset.act === 'add-named') openItemForm({ mode: 'add', category: hooks.category(), name: a.dataset.name });
    else if (a.dataset.act === 'scan') scanAndFind();
    else if (a.dataset.act === 'retry') data.start();
  });
}

/* ---------- Detail ---------- */
export function openItemDetail(cat, id) {
  const it = data.getItems(cat).find(x => x.id === id);
  if (!it) return;
  const c = CAT[cat];
  const facts = [];
  if (it.location) facts.push(['מיקום', linkify(it.location)]);
  if (cat === 'books' && it.author) facts.push(['מחבר', linkify(it.author)]);
  if (it.notes) facts.push(['הערות', linkify(it.notes), 'pre']);
  if (it.barcode) facts.push(['ברקוד', `<code class="code">${esc(it.barcode)}</code><button type="button" class="icon-btn sm" data-copy aria-label="העתקת ברקוד">${icon('copy', 16)}</button>`, 'code']);
  const content = `<div class="detail-hero"><span class="tile tile-${cat}">${icon(c.icon, 24)}</span><span class="detail-cat">${c.label}</span></div>
    <dl class="facts">${facts.map(([k, v, m]) => `<div class="fact${m ? ' fact-' + m : ''}"><dt>${k}</dt><dd dir="auto">${v}</dd></div>`).join('') || '<p class="muted">אין פרטים נוספים.</p>'}</dl>`;
  const ctrl = openSheet({
    title: it.description || 'ללא שם', content,
    footer: `<button type="button" class="btn btn-ghost-danger" data-act="del">${icon('trash', 18)}מחיקה</button><button type="button" class="btn btn-primary" data-act="edit">${icon('edit', 18)}עריכה</button>`,
  });
  ctrl.el.addEventListener('click', async e => {
    if (e.target.closest('[data-copy]')) { toast((await copyText(it.barcode)) ? 'הברקוד הועתק' : 'ההעתקה נכשלה'); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'edit') { ctrl.close(); openItemForm({ mode: 'edit', category: cat, item: it }); }
    if (a.dataset.act === 'del') {
      const ok = await confirmDialog({ title: `למחוק את “${it.description || 'הפריט'}”?`, message: 'אפשר לבטל מיד אחרי המחיקה.', confirmText: 'מחיקה', danger: true });
      if (ok) { ctrl.close(); removeWithUndo(cat, it); }
    }
  });
}

function removeWithUndo(cat, it) {
  const { id, _h, ...raw } = it;
  data.removeItem(cat, id).catch(() => toast('המחיקה נכשלה', { tone: 'error' }));
  toast(`“${it.description || 'הפריט'}” נמחק`, {
    action: 'ביטול',
    onAction: () => data.restoreItem(cat, id, raw).catch(() => toast('השחזור נכשל', { tone: 'error' })),
  });
}

/* ---------- Add / edit ---------- */
export function openItemForm({ mode = 'add', category = 'books', item = null, barcode = '', name = '' } = {}) {
  const editing = mode === 'edit';
  const init = {
    description: (item && item.description) || name || '',
    author: (item && item.author) || '',
    location: (item && item.location) || '',
    notes: (item && item.notes) || '',
    barcode: (item && item.barcode) || barcode || '',
  };
  const locs = data.locations();
  const content = `<form id="item-form" novalidate autocomplete="off">
    ${editing ? '' : `<div class="field"><span class="label" id="cat-l">קטגוריה</span>
      <div class="seg" role="radiogroup" aria-labelledby="cat-l">${data.CATEGORIES.map(k =>
        `<label class="seg-opt"><input type="radio" name="cat" value="${k}"${k === category ? ' checked' : ''}><span>${CAT[k].label}</span></label>`).join('')}</div></div>`}
    <div class="field"><label for="f-desc" id="f-desc-l">${CAT[category].nameLabel}</label>
      <input id="f-desc" name="description" dir="auto" enterkeyhint="next" autofocus value="${esc(init.description)}">
      <p class="field-error">נא למלא שם</p></div>
    <div class="collapse" data-open="${category === 'books'}"><div><div class="field"><label for="f-author">סופר</label>
      <input id="f-author" name="author" dir="auto" enterkeyhint="next" value="${esc(init.author)}"></div></div></div>
    <div class="field"><label for="f-loc">מיקום</label>
      <input id="f-loc" name="location" dir="auto" list="f-locs" enterkeyhint="next" value="${esc(init.location)}">
      <datalist id="f-locs">${locs.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
      <p class="field-error">נא למלא מיקום</p></div>
    <div class="field"><label for="f-notes">הערות</label><textarea id="f-notes" name="notes" rows="2" dir="auto">${esc(init.notes)}</textarea></div>
    <div class="field"><label for="f-bar">ברקוד</label>
      <div class="input-row"><input id="f-bar" name="barcode" inputmode="numeric" dir="ltr" value="${esc(init.barcode)}">
      <button type="button" class="btn btn-soft" data-scan>${icon('scan', 18)}סריקה</button></div>
      <p class="field-hint" hidden></p></div>
  </form>`;
  const read = () => {
    const f = form.elements;
    return { description: f.description.value.trim(), author: f.author.value.trim(), location: f.location.value.trim(), notes: f.notes.value.trim(), barcode: f.barcode.value.trim(), cat: editing ? category : f.cat.value };
  };
  const baseline = JSON.stringify({ description: init.description.trim(), author: init.author.trim(), location: init.location.trim(), notes: init.notes.trim(), barcode: init.barcode.trim(), cat: category });
  const ctrl = openSheet({
    title: editing ? 'עריכה' : 'פריט חדש', content,
    footer: `<button type="button" class="btn btn-ghost" data-close>ביטול</button><button type="submit" form="item-form" class="btn btn-primary">${editing ? 'שמירה' : 'הוספה'}</button>`,
    beforeClose: async () => JSON.stringify(read()) === baseline || confirmDialog({ title: 'לסגור בלי לשמור?', message: 'השינויים לא יישמרו.', confirmText: 'סגירה', cancelText: 'המשך עריכה', danger: true }),
  });
  const form = $('#item-form', ctrl.el);
  const notes = form.elements.notes, bar = form.elements.barcode, hint = $('.field-hint', ctrl.el);
  const grow = () => { notes.style.height = 'auto'; notes.style.height = Math.min(notes.scrollHeight + 2, 240) + 'px'; };
  grow(); notes.addEventListener('input', grow);

  const checkDup = () => {
    const v = bar.value.trim();
    const hit = v && data.findByBarcode(v);
    if (hit && !(editing && hit.cat === category && hit.item.id === item.id)) {
      hint.hidden = false;
      hint.innerHTML = `${icon('alert', 14)}<span>כבר קיים: ${esc(hit.item.description || '')} (${CAT[hit.cat].label})</span>`;
    } else hint.hidden = true;
  };
  bar.addEventListener('input', checkDup); checkDup();

  form.addEventListener('input', e => { const f = e.target.closest('.field'); if (f && e.target.value.trim()) f.classList.remove('invalid'); });
  if (!editing) form.addEventListener('change', e => {
    if (e.target.name !== 'cat') return;
    const k = e.target.value;
    $('.collapse', form).dataset.open = String(k === 'books');
    $('#f-desc-l', form).textContent = CAT[k].nameLabel;
  });

  $('[data-scan]', form).addEventListener('click', async () => {
    const code = await scanBarcode();
    if (code) { bar.value = code; checkDup(); haptic(20); }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = read();
    let first = null;
    for (const n of ['description', 'location']) {
      const el = form.elements[n];
      const bad = !v[n];
      el.closest('.field').classList.toggle('invalid', bad);
      if (bad && !first) first = el;
    }
    if (first) { first.focus(); haptic(15); return; }
    const payload = { description: v.description, location: v.location, notes: v.notes, barcode: v.barcode };
    if (v.cat === 'books') payload.author = v.author;
    const fail = err => { console.error(err); toast('השמירה נכשלה. נסו שוב.', { tone: 'error' }); };
    if (editing) {
      data.updateItem(v.cat, item.id, payload).catch(fail);
      ctrl.close();
      toast('השינויים נשמרו');
    } else {
      const { id, promise } = data.addItem(v.cat, payload);
      promise.catch(fail);
      ctrl.close();
      hooks.added(v.cat, id);
      toast(`נוסף: ${v.description}`);
    }
  });
}

/* ---------- Scan to find ---------- */
export async function scanAndFind() {
  const code = await scanBarcode();
  if (!code) return;
  const hit = data.findByBarcode(code);
  if (hit) {
    hooks.switchTo(hit.cat);
    openItemDetail(hit.cat, hit.item.id);
  } else {
    toast('ברקוד חדש — אפשר להוסיף אותו עכשיו');
    openItemForm({ mode: 'add', category: hooks.category(), barcode: code });
  }
}
