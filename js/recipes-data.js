/* Firestore recipes layer. Paths unchanged: notes/{USER_ID}/myNotes ordered by title. */
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { recipeFirestore } from '../recipe-book/firebase-recipes.js';

const USER_ID = 'FgETS4BeELaIGQ3QziwnDCqDQUx2';
const col = collection(recipeFirestore, 'notes', USER_ID, 'myNotes');

export function subscribeRecipes(onData, onError) {
  return onSnapshot(
    query(col, orderBy('title')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}
export const addRecipe = (title, content) => addDoc(col, { title, content });
export const updateRecipe = (id, title, content) =>
  updateDoc(doc(recipeFirestore, 'notes', USER_ID, 'myNotes', id), { title, content });
export const deleteRecipe = (id) =>
  deleteDoc(doc(recipeFirestore, 'notes', USER_ID, 'myNotes', id));
