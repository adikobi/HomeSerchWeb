/* data.js — Realtime Database access. Paths, payload shape and `itemId` field
   are identical to the original app: /books, /food, /items. Relies on the
   global `database` created by firebase-config.js. */

export const CATEGORIES = ['books', 'food', 'items'];

const cache = { books: [], food: [], items: [] };
const loaded = { books: false, food: false, items: false };
const errors = { books: null, food: null, items: null };
const listeners = {};
const subs = new Set();

const emit = cat => subs.forEach(fn => { try { fn(cat); } catch (e) { console.error(e); } });

export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const getItems = cat => cache[cat] || [];
export const isLoaded = cat => !!loaded[cat];
export const getError = cat => errors[cat];

export function start() {
  stop();
  for (const cat of CATEGORIES) {
    const ref = database.ref(cat);
    const onValue = snap => {
      const val = snap.val();
      const list = [];
      if (val && typeof val === 'object') {
        Object.entries(val).forEach(([id, item]) => {
          if (item && typeof item === 'object') list.push({ id, ...item });
        });
      }
      cache[cat] = list; loaded[cat] = true; errors[cat] = null;
      emit(cat);
    };
    const onError = err => {
      console.error('Error loading', cat, err);
      errors[cat] = err; loaded[cat] = true;
      emit(cat);
    };
    ref.on('value', onValue, onError);
    listeners[cat] = { ref, onValue };
  }
}

export function stop() {
  for (const cat of CATEGORIES) {
    const l = listeners[cat];
    if (l) l.ref.off('value', l.onValue);
    delete listeners[cat];
    cache[cat] = []; loaded[cat] = false; errors[cat] = null;
  }
}

export function watchConnection(cb) {
  database.ref('.info/connected').on('value', s => cb(s.val() === true));
}

export function findByBarcode(code) {
  const c = String(code || '').trim();
  if (!c) return null;
  for (const cat of CATEGORIES) {
    const item = cache[cat].find(i => String(i.barcode || '').trim() === c);
    if (item) return { cat, item };
  }
  return null;
}

export function locations() {
  const set = new Set();
  CATEGORIES.forEach(c => cache[c].forEach(i => { const l = String(i.location || '').trim(); if (l) set.add(l); }));
  return [...set].sort((a, b) => a.localeCompare(b, 'he'));
}

export function addItem(cat, payload) {
  const ref = database.ref(cat).push();
  const id = ref.key;
  return { id, promise: ref.set({ ...payload, itemId: id }) };
}
export const updateItem = (cat, id, payload) => database.ref(`${cat}/${id}`).update(payload);
export const removeItem = (cat, id) => database.ref(`${cat}/${id}`).remove();
export const restoreItem = (cat, id, raw) => database.ref(`${cat}/${id}`).set(raw);
