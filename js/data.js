/* Realtime Database + Auth layer.
   Paths and payload shapes are unchanged: /books, /food, /items → { id: {description,location,notes,barcode,[author],itemId} }
   `database` and `auth` come from the existing firebase-config.js. */
const db = () => (typeof database !== 'undefined' ? database : firebase.database());
const au = () => (typeof auth !== 'undefined' ? auth : firebase.auth());

export const CATS = ['books', 'food', 'items'];

/* Auth */
export const onAuth = (cb) => au().onAuthStateChanged(cb);
export const signIn = (e, p) => au().signInWithEmailAndPassword(e, p);
export const signUp = (e, p) => au().createUserWithEmailAndPassword(e, p);
export const signOut = () => au().signOut();

/* Items */
export function subscribeCategory(cat, onData, onError) {
  const ref = db().ref(cat);
  const handler = (snap) => onData(snap.val());
  ref.on('value', handler, onError);
  return () => ref.off('value', handler);
}
export const newKey = (cat) => db().ref(cat).push().key;
export function addItem(cat, key, data) {
  data.itemId = key;
  return db().ref(`${cat}/${key}`).set(data);
}
export const updateItem = (cat, id, data) => db().ref(`${cat}/${id}`).update(data);
export const removeItem = (cat, id) => db().ref(`${cat}/${id}`).remove();
export const fetchOnce = (cat) => db().ref(cat).once('value').then((s) => s.val() || {});
export const bulkAdd = (cat, updates) => db().ref(cat).update(updates);

export function watchConnection(cb) {
  const ref = db().ref('.info/connected');
  const h = (s) => cb(!!s.val());
  ref.on('value', h);
  return () => ref.off('value', h);
}
