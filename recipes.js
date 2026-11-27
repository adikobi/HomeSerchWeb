/* recipes.js — recipe book (Firestore). Same project instance, path
   notes/{USER_ID}/myNotes, ordered by title, fields { title, content }. */
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { recipeFirestore } from '../recipe-book/firebase-recipes.js';
import { $, $$, esc, icon, fold, tokens, matchAll, highlight, linkify, findLinks, openSheet, confirmDialog, toast, haptic, copyText, downloadBlob } from './ui.js';

const USER_ID = 'FgETS4BeELaIGQ3QziwnDCqDQUx2';
const MOCK = typeof localStorage !== 'undefined' && localStorage.getItem('mock-firebase') === 'true';

let recipes = [], status = 'idle', unsub = null, ctx = null;

const skeleton = n => Array.from({ length: n }, (_, i) =>
  `<div class="skel-card" style="--d:${i * 70}ms"><i></i><i></i><i></i></div>`).join('');

/* ---------- Parsing ---------- */
const BULLET = /^\s*(?:[-–—•*·▪])\s+(.*)$/;
const NUM = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const isHeading = l => /^#{1,3}\s+\S/.test(l) || (/:\s*$/.test(l) && l.trim().length <= 40 && !/https?:\/\//.test(l));

export function parseRecipe(text) {
  const blocks = [];
  let cur = null;
  const add = (type, t) => {
    if (cur && cur.type === type) cur.items.push(t);
    else { cur = { type, items: [t] }; blocks.push(cur); }
  };
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { cur = null; continue; }
    let m;
    if ((m = line.match(BULLET))) add('ul', m[1]);
    else if ((m = line.match(NUM))) add('ol', m[2]);
    else if (isHeading(line)) { blocks.push({ type: 'h', items: [line.trim().replace(/:\s*$/, '').replace(/^#+\s*/, '')] }); cur = null; }
    else add('p', line.trim());
  }
  return blocks;
}

function analyze(r) {
  if (r._a) return r._a;
  const blocks = parseRecipe(r.content);
  let ingredients = 0;
  blocks.forEach(b => { if (b.type === 'ul') ingredients += b.items.length; });
  const ul = blocks.find(b => b.type === 'ul');
  const p = blocks.find(b => b.type === 'p');
  const ol = blocks.find(b => b.type === 'ol');
  let snippet = ul ? ul.items.slice(0, 5).join(', ') : p ? p.items.join(' ') : ol ? ol.items.join(' · ') : '';
  snippet = snippet.replace(/(?:https?:\/\/|www\.)\S+/gi, '').replace(/\s+/g, ' ').trim();
  if (snippet.length > 140) snippet = snippet.slice(0, 138) + '…';
  return (r._a = { ingredients, snippet, links: findLinks(r.content).length });
}
const hay = r => (r._h ??= fold((r.title || '') + '\n' + (r.content || '')));

/* ---------- List ---------- */
function cardHtml(r, toks) {
  const a = analyze(r);
  const tags = (a.ingredients ? `<span class="tag">${a.ingredients} מצרכים</span>` : '') + (a.links ? `<span class="tag">${icon('link', 13)}קישור</span>` : '');
  return `<button type="button" class="rcard" data-id="${esc(r.id)}">
    <h3 class="rcard-title" dir="auto">${highlight(r.title || 'ללא שם', toks)}</h3>
    ${a.snippet ? `<p class="rcard-snippet" dir="auto">${highlight(a.snippet, toks)}</p>` : ''}
    ${tags ? `<span class="rcard-meta">${tags}</span>` : ''}</button>`;
}

export function render() {
  if (!ctx) return;
  const host = ctx.list;
  if (status === 'idle' || status === 'loading') { host.innerHTML = skeleton(6); ctx.onStats({ loading: true, text: '' }); return; }
  if (status === 'error') {
    host.innerHTML = `<div class="empty"><div class="empty-art is-error">${icon('alert', 28)}</div><h3>לא הצלחנו לטעון את המתכונים</h3><p>בדקו את החיבור ונסו שוב.</p><div class="empty-actions"><button class="btn btn-soft" data-act="retry">נסו שוב</button></div></div>`;
    ctx.onStats({ loading: false, text: '' });
    return;
  }
  const q = ctx.getQuery();
  const toks = tokens(q);
  const list = toks.length ? recipes.filter(r => matchAll(hay(r), toks)) : recipes;
  if (!list.length) {
    host.innerHTML = toks.length
      ? `<div class="empty"><div class="empty-art">${icon('search', 28)}</div><h3 dir="auto">אין תוצאות ל־“${esc(q.trim())}”</h3><p>חיפוש לפי שם המתכון או מצרכים.</p></div>`
      : `<div class="empty"><div class="empty-art tile-recipes">${icon('chef', 30)}</div><h3>ספר המתכונים ריק</h3><p>הוסיפו את המתכון הראשון — אפשר גם להדביק קישור.</p><div class="empty-actions"><button class="btn btn-primary" data-act="add">${icon('plus', 18)}מתכון חדש</button></div></div>`;
  } else host.innerHTML = list.map(r => cardHtml(r, toks)).join('');
  const total = recipes.length;
  ctx.onStats({ loading: false, text: !total ? '' : toks.length ? `${list.length} מתוך ${total}` : total === 1 ? 'מתכון אחד' : `${total} מתכונים` });
}

export function mount(c) {
  ctx = c;
  c.list.addEventListener('click', e => {
    const card = e.target.closest('.rcard');
    if (card) { openReader(card.dataset.id); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'add') openEditor();
    if (a.dataset.act === 'retry') { stop(); start(); }
  });
  render();
}

export function start() {
  if (unsub) return;
  status = 'loading'; render();
  if (MOCK) {
    recipes = [
      { id: 'recipe1', title: 'עוגת שוקולד חמה חגיגית', content: 'חומרים:\n- 200 גרם שוקולד מריר\n- 100 גרם חמאה\n- 3 ביצים\n\nאופן ההכנה:\nממיסים שוקולד וחמאה, טורפים ביצים וסוכר, מקפלים קמח ואופים ב-180 מעלות.' },
      { id: 'recipe2', title: 'סלט יווני עם פטה', content: 'רכיבים:\n- עגבניות, מלפפונים, בצל סגול\n- גבינת פטה\n- שמן זית' },
    ];
    status = 'ready'; unsub = () => {}; render(); return;
  }
  const col = collection(recipeFirestore, 'notes', USER_ID, 'myNotes');
  unsub = onSnapshot(query(col, orderBy('title')), snap => {
    recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    status = 'ready'; render();
  }, err => {
    console.error('Error loading recipes:', err);
    status = 'error'; render();
    toast('שגיאה בטעינת המתכונים', { tone: 'error' });
  });
}

export function stop() {
  if (unsub) unsub();
  unsub = null; recipes = []; status = 'idle';
  render();
}

const docRef = id => doc(recipeFirestore, 'notes', USER_ID, 'myNotes', id);
const fail = err => { console.error(err); toast('הפעולה נכשלה. נסו שוב.', { tone: 'error' }); };

/* ---------- Reader ---------- */
const checksKey = 'mm-checks';
const loadChecks = id => { try { return new Set((JSON.parse(sessionStorage.getItem(checksKey)) || {})[id] || []); } catch { return new Set(); } };
const saveChecks = (id, set) => { try { const all = JSON.parse(sessionStorage.getItem(checksKey)) || {}; all[id] = [...set]; sessionStorage.setItem(checksKey, JSON.stringify(all)); } catch {} };

function docHtml(r) {
  const blocks = parseRecipe(r.content);
  const checked = loadChecks(r.id);
  let html = '';
  blocks.forEach((b, bi) => {
    if (b.type === 'h') html += `<h3 class="doc-h" dir="auto">${esc(b.items[0])}</h3>`;
    else if (b.type === 'p') html += `<p class="doc-p" dir="auto">${b.items.map(t => linkify(t)).join('<br>')}</p>`;
    else {
      const tag = b.type;
      html += `<${tag} class="${tag === 'ul' ? 'checklist' : 'steps'}">` + b.items.map((t, ii) => {
        const k = `${bi}.${ii}`;
        return `<li><label class="check"><input type="checkbox" data-k="${k}"${checked.has(k) ? ' checked' : ''}><span class="box" data-n="${ii + 1}"></span><span class="txt" dir="auto">${linkify(t)}</span></label></li>`;
      }).join('') + `</${tag}>`;
    }
  });
  return html || '<p class="muted">אין תוכן.</p>';
}

export function openReader(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const a = analyze(r);
  const links = [];
  const seen = new Set();
  findLinks(r.content).forEach(l => { if (!seen.has(l.href)) { seen.add(l.href); links.push(l); } });
  const canWake = 'wakeLock' in navigator;
  const content = `<article class="recipe-doc">
    ${links.length ? `<div class="links-strip">${links.map(l => `<a class="link-chip" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" dir="ltr">${icon('external', 14)}<span>${esc(l.label)}</span></a>`).join('')}</div>` : ''}
    ${canWake ? `<label class="switch"><input type="checkbox" id="wl"><span class="sw" aria-hidden="true"></span><span>השאר את המסך דלוק</span></label>` : ''}
    <div class="doc-body">${docHtml(r)}</div></article>`;
  const ctrl = openSheet({
    title: r.title || 'ללא שם', content, className: 'layer-reader',
    footer: `<button type="button" class="btn btn-ghost-danger icon-only" data-act="del" aria-label="מחיקה">${icon('trash', 18)}</button>
      <button type="button" class="btn btn-ghost" data-act="share">${icon('share', 18)}שיתוף</button>
      <button type="button" class="btn btn-primary" data-act="edit">${icon('edit', 18)}עריכה</button>`,
  });
  const checked = loadChecks(r.id);
  ctrl.body.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    e.target.checked ? checked.add(k) : checked.delete(k);
    saveChecks(r.id, checked);
    haptic(8);
  });

  let lock = null;
  const wl = $('#wl', ctrl.el);
  const acquire = async () => {
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    catch { toast('לא ניתן להשאיר את המסך דלוק'); if (wl) wl.checked = false; }
  };
  const onVis = () => { if (document.visibilityState === 'visible' && wl && wl.checked && !lock) acquire(); };
  if (wl) { wl.addEventListener('change', () => { if (wl.checked) acquire(); else if (lock) lock.release(); }); document.addEventListener('visibilitychange', onVis); }
  ctrl.closed.then(() => { document.removeEventListener('visibilitychange', onVis); if (lock) lock.release(); });

  ctrl.foot.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'edit') { ctrl.close(); openEditor(r.id); }
    if (b.dataset.act === 'share') {
      const text = `${r.title}\n\n${r.content}`;
      if (navigator.share) { try { await navigator.share({ title: r.title, text }); } catch {} }
      else toast((await copyText(text)) ? 'המתכון הועתק' : 'ההעתקה נכשלה');
    }
    if (b.dataset.act === 'del') {
      const ok = await confirmDialog({ title: `למחוק את “${r.title || 'המתכון'}”?`, message: 'אפשר לבטל מיד אחרי המחיקה.', confirmText: 'מחיקה', danger: true });
      if (ok) { ctrl.close(); removeRecipe(r); }
    }
  });
}

function removeRecipe(r) {
  const { id, _h, _a, ...raw } = r;
  if (MOCK) { toast('מצב הדגמה — לא נמחק'); return; }
  deleteDoc(docRef(id)).catch(fail);
  toast(`“${r.title || 'המתכון'}” נמחק`, { action: 'ביטול', onAction: () => setDoc(docRef(id), raw).catch(fail) });
}

/* ---------- Editor ---------- */
const DRAFT = 'mm-recipe-draft';
const readDraft = () => { try { const d = JSON.parse(sessionStorage.getItem(DRAFT)); return d && (d.title || d.content) ? d : null; } catch { return null; } };

function insertAtCursor(ta, text) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  const before = ta.value.slice(0, s), after = ta.value.slice(e);
  const prefix = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  ta.value = before + prefix + text + after;
  const pos = (before + prefix + text).length;
  ta.setSelectionRange(pos, pos);
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function continueList(e, ta) {
  if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
  const pos = ta.selectionStart;
  if (pos !== ta.selectionEnd) return;
  const start = ta.value.lastIndexOf('\n', pos - 1) + 1;
  const line = ta.value.slice(start, pos);
  let m = line.match(/^(\s*)([-–•*])\s+(.*)$/), marker, body;
  if (m) { marker = `${m[1]}${m[2]} `; body = m[3]; }
  else if ((m = line.match(/^(\s*)(\d{1,2})([.)])\s+(.*)$/))) { marker = `${m[1]}${+m[2] + 1}${m[3]} `; body = m[4]; }
  else return;
  e.preventDefault();
  if (!body.trim()) {
    ta.value = ta.value.slice(0, start) + ta.value.slice(pos);
    ta.setSelectionRange(start, start);
  } else {
    ta.value = ta.value.slice(0, pos) + '\n' + marker + ta.value.slice(pos);
    const np = pos + 1 + marker.length;
    ta.setSelectionRange(np, np);
  }
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

export function openEditor(id) {
  const r = id ? recipes.find(x => x.id === id) : null;
  const editing = !!r;
  const draft = !editing ? readDraft() : null;
  const init = { title: editing ? r.title || '' : draft ? draft.title || '' : '', content: editing ? r.content || '' : draft ? draft.content || '' : '' };
  const content = `<form id="recipe-form" novalidate autocomplete="off">
    ${draft ? `<p class="draft-note">${icon('alert', 14)}<span>שוחזרה טיוטה שלא נשמרה.</span><button type="button" data-clear-draft>התחלה מחדש</button></p>` : ''}
    <div class="field"><label for="r-title">שם המתכון</label><input id="r-title" name="title" dir="auto" enterkeyhint="next" autofocus value="${esc(init.title)}"><p class="field-error">נא למלא שם</p></div>
    <div class="field"><label for="r-content">תוכן</label>
      <div class="tpl-bar" role="group" aria-label="הוספה מהירה">
        <button type="button" class="chip" data-tpl="חומרים:\n- ">${icon('plus', 14)}חומרים</button>
        <button type="button" class="chip" data-tpl="אופן ההכנה:\n1. ">${icon('plus', 14)}הוראות הכנה</button>
        <button type="button" class="chip" data-tpl="https://">${icon('link', 14)}קישור</button></div>
      <textarea id="r-content" name="content" dir="auto" rows="9" placeholder="חומרים:&#10;- ...&#10;&#10;אופן ההכנה:&#10;1. ...">${esc(init.content)}</textarea><p class="field-error">נא למלא תוכן</p></div>
  </form>`;
  const form0 = () => $('#recipe-form', ctrl.el);
  const read = () => ({ title: form0().elements.title.value.trim(), content: form0().elements.content.value.trim() });
  const baseline = JSON.stringify({ title: init.title.trim(), content: init.content.trim() });
  const ctrl = openSheet({
    title: editing ? 'עריכת מתכון' : 'מתכון חדש', content, className: 'layer-reader',
    footer: `<button type="button" class="btn btn-ghost" data-close>ביטול</button><button type="submit" form="recipe-form" class="btn btn-primary">${editing ? 'שמירה' : 'הוספה'}</button>`,
    beforeClose: async () => {
      if (JSON.stringify(read()) === baseline) return true;
      const ok = await confirmDialog({ title: 'לסגור בלי לשמור?', message: editing ? 'השינויים לא יישמרו.' : 'הטיוטה תישמר למקרה שתחזרו.', confirmText: 'סגירה', cancelText: 'המשך עריכה', danger: true });
      return ok;
    },
  });
  const form = form0(), ta = form.elements.content;
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.max(220, ta.scrollHeight + 2) + 'px'; };
  grow();
  let t;
  form.addEventListener('input', e => {
    const f = e.target.closest('.field');
    if (f && e.target.value.trim()) f.classList.remove('invalid');
    if (e.target === ta) grow();
    if (!editing) { clearTimeout(t); t = setTimeout(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(read())); } catch {} }, 300); }
  });
  ta.addEventListener('keydown', e => continueList(e, ta));
  form.addEventListener('click', e => {
    const tpl = e.target.closest('[data-tpl]');
    if (tpl) insertAtCursor(ta, tpl.dataset.tpl.replace(/\\n/g, '\n'));
    if (e.target.closest('[data-clear-draft]')) {
      try { sessionStorage.removeItem(DRAFT); } catch {}
      form.elements.title.value = ''; ta.value = ''; grow();
      e.target.closest('.draft-note').remove();
    }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = read();
    let first = null;
    for (const n of ['title', 'content']) {
      const el = form.elements[n], bad = !v[n];
      el.closest('.field').classList.toggle('invalid', bad);
      if (bad && !first) first = el;
    }
    if (first) { first.focus(); haptic(15); return; }
    if (MOCK) toast('מצב הדגמה — לא נשמר');
    else if (editing) { updateDoc(docRef(r.id), { title: v.title, content: v.content }).catch(fail); toast('המתכון עודכן'); }
    else { addDoc(collection(recipeFirestore, 'notes', USER_ID, 'myNotes'), { title: v.title, content: v.content }).catch(fail); toast('המתכון נוסף'); }
    try { sessionStorage.removeItem(DRAFT); } catch {}
    ctrl.close();
  });
}

/* ---------- Export ---------- */
export function exportWord() {
  if (!recipes.length) { toast('אין מתכונים לייצוא'); return; }
  const body = recipes.map(r => `<h2>${esc(r.title)}</h2><p>${linkify(r.content, { plain: true }).replace(/\n/g, '<br>')}</p><br style="page-break-before:always">`).join('');
  const html = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>ספר מתכונים</title><style>body{font-family:Arial,sans-serif;direction:rtl;text-align:right}h2{font-size:20pt}p{font-size:12pt;line-height:1.6}</style></head><body dir="rtl">${body}</body></html>`;
  downloadBlob(new Blob([html], { type: 'application/msword;charset=utf-8' }), 'recipes.doc');
  toast('הקובץ הורד');
}
