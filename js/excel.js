import { loadScript } from './lazy.js';
import * as store from './data.js';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const ensureXlsx = () => loadScript(XLSX_URL);

export async function exportCategory(cat, raw) {
  await ensureXlsx();
  const ws = XLSX.utils.json_to_sheet(Object.values(raw));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cat);
  XLSX.writeFile(wb, `${cat}.xlsx`);
}

const cleanKey = (k) => String(k).trim().replace(/[.#$/\[\]]/g, '_');

/** Returns { imported, skipped: string[], invalid } */
export async function importFile(file, cat) {
  await ensureXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  if (!records.length) throw new Error('empty');

  const existing = await store.fetchOnce(cat);
  const seen = new Set(
    Object.values(existing).map((i) => String(i?.description ?? '').trim().toLowerCase())
  );
  const updates = {};
  const skipped = [];
  let invalid = 0;

  for (const rec of records) {
    const desc = String(rec.description ?? '').trim();
    if (!desc) { invalid++; continue; }
    const k = desc.toLowerCase();
    if (seen.has(k)) { skipped.push(desc); continue; }
    seen.add(k);
    const clean = {};
    for (const [key, v] of Object.entries(rec)) {
      const ck = cleanKey(key);
      if (!ck || v === undefined || v === null) continue;
      clean[ck] = typeof v === 'string' ? v.trim() : v;
    }
    clean.description = desc;
    if (clean.barcode !== undefined) clean.barcode = String(clean.barcode);
    const key = store.newKey(cat);
    clean.itemId = key;
    updates[key] = clean;
  }
  const imported = Object.keys(updates).length;
  if (imported) await store.bulkAdd(cat, updates);
  return { imported, skipped, invalid };
}
