/* excel.js — Excel export / import for the inventory (SheetJS, lazy-loaded).
   Logic mirrors the original: export = Object.values(snapshot); import skips
   items whose description already exists and stores itemId = push key. */
import { $, esc, icon, loadScript, openSheet, toast } from './ui.js';
import * as data from './data.js';
import { CAT } from './inventory.js';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

const catSeg = current => `<div class="field"><span class="label" id="x-cat-l">קטגוריה</span>
  <div class="seg" role="radiogroup" aria-labelledby="x-cat-l">${data.CATEGORIES.map(k =>
    `<label class="seg-opt"><input type="radio" name="xcat" value="${k}"${k === current ? ' checked' : ''}><span>${CAT[k].label}</span></label>`).join('')}</div></div>`;

const setBusy = (btn, on, label) => {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
  if (label) btn.querySelector('.lbl').textContent = label;
};

export function openExport(current = 'books') {
  const ctrl = openSheet({
    title: 'ייצוא ל־Excel',
    content: `<p class="muted sheet-lead">הקובץ יורד למכשיר, עם כל הפריטים בקטגוריה שנבחרה.</p>${catSeg(current)}`,
    footer: `<button type="button" class="btn btn-ghost" data-close>סגירה</button><button type="button" class="btn btn-primary" id="x-go">${icon('download', 18)}<span class="lbl">הורדה</span></button>`,
  });
  const go = $('#x-go', ctrl.el);
  go.addEventListener('click', async () => {
    const cat = ctrl.el.querySelector('input[name=xcat]:checked').value;
    setBusy(go, true);
    try {
      await loadScript(XLSX_URL);
      const snap = await database.ref(cat).once('value');
      const val = snap.val();
      if (!val) { toast('אין נתונים לייצוא בקטגוריה הזו'); return; }
      const ws = XLSX.utils.json_to_sheet(Object.values(val));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, cat);
      XLSX.writeFile(wb, `${cat}.xlsx`);
      toast('הקובץ הורד');
      ctrl.close();
    } catch (err) {
      console.error(err);
      toast('הייצוא נכשל. בדקו את החיבור ונסו שוב.', { tone: 'error' });
    } finally { setBusy(go, false); }
  });
}

export function openImport(current = 'books') {
  let records = null, done = false;
  const ctrl = openSheet({
    title: 'ייבוא מ־Excel',
    content: `${catSeg(current)}
      <label class="drop" for="x-file">${icon('upload', 26)}<strong id="x-name">בחירת קובץ Excel</strong><span class="muted">.xlsx או .xls — אפשר גם לגרור לכאן</span>
        <input type="file" id="x-file" accept=".xlsx,.xls" class="sr-only"></label>
      <details class="how"><summary>איך הקובץ צריך להיראות</summary>
        <p>שורה ראשונה היא שמות העמודות:</p>
        <ul><li><b>description</b> — שם הפריט (חובה)</li><li><b>location</b> — מיקום</li><li><b>notes</b> — הערות</li><li><b>barcode</b> — ברקוד</li><li><b>author</b> — סופר (לספרים)</li></ul>
        <p>פריטים עם שם שכבר קיים בקטגוריה לא יתווספו שוב.</p></details>
      <div class="import-result" id="x-res" aria-live="polite"></div>`,
    footer: `<button type="button" class="btn btn-ghost" data-close>סגירה</button><button type="button" class="btn btn-primary" id="x-go" disabled>${icon('upload', 18)}<span class="lbl">ייבוא</span></button>`,
  });
  const file = $('#x-file', ctrl.el), res = $('#x-res', ctrl.el), go = $('#x-go', ctrl.el), drop = $('.drop', ctrl.el);
  const cat = () => ctrl.el.querySelector('input[name=xcat]:checked').value;
  const names = c => new Set(data.getItems(c).map(i => String(i.description || '').toLowerCase()));

  async function load(f) {
    records = null; go.disabled = true;
    $('#x-name', ctrl.el).textContent = f.name;
    res.innerHTML = '<p class="muted">מעבד את הקובץ…</p>';
    try {
      await loadScript(XLSX_URL);
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
      records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    } catch (err) {
      console.error(err);
      res.innerHTML = '<p class="error">שגיאה בעיבוד הקובץ. ודאו שזה קובץ Excel תקין.</p>';
      return;
    }
    if (!records.length) { res.innerHTML = '<p class="error">הקובץ ריק או שאינו בפורמט הנכון.</p>'; records = null; return; }
    preview();
  }
  function preview() {
    if (!records) return;
    const ex = names(cat());
    const fresh = records.filter(r => r.description != null && String(r.description).trim() && !ex.has(String(r.description).trim().toLowerCase())).length;
    res.innerHTML = `<p><b>${records.length}</b> שורות בקובץ · <b>${fresh}</b> חדשות · ${records.length - fresh} יידלגו</p>`;
    go.disabled = fresh === 0;
  }
  file.addEventListener('change', () => { if (file.files[0]) load(file.files[0]); });
  ctrl.el.addEventListener('change', e => { if (e.target.name === 'xcat') preview(); });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) load(f); });

  go.addEventListener('click', async () => {
    if (done) { ctrl.close(); return; }
    if (!records) return;
    setBusy(go, true);
    try {
      const ref = database.ref(cat());
      const snap = await ref.once('value');
      const existing = new Set(Object.values(snap.val() || {}).map(i => String((i && i.description) || '').toLowerCase()));
      let added = 0, failed = 0;
      const skipped = [];
      records.forEach(record => {
        const desc = record.description == null ? '' : String(record.description).trim();
        if (desc && !existing.has(desc.toLowerCase())) {
          try {
            const r = ref.push();
            record.description = desc;
            record.itemId = r.key;
            r.set(record).catch(() => { failed++; });
            existing.add(desc.toLowerCase());
            added++;
          } catch (err) { console.error(err); failed++; }
        } else skipped.push(desc || 'פריט ללא שם');
      });
      res.innerHTML = `<p><b>הייבוא הסתיים.</b></p><p>${added} פריטים חדשים נוספו.</p>` +
        (failed ? `<p class="error">${failed} שורות נכשלו (שמות עמודות לא תקינים).</p>` : '') +
        (skipped.length ? `<p>${skipped.length} פריטים לא נוספו כי הם כבר קיימים:</p><ul>${skipped.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '');
      done = true;
      go.querySelector('.lbl').textContent = 'סיום';
      toast(`נוספו ${added} פריטים`);
    } catch (err) {
      console.error(err);
      res.innerHTML = '<p class="error">הייבוא נכשל. נסו שוב.</p>';
    } finally { setBusy(go, false); }
  });
}
