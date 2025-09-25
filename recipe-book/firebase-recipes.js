// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const recipeFirebaseConfig = {
  apiKey: "AIzaSyAyduZJV4ShlLFRSgjik7RX8bwxPnAVn_0",
  authDomain: "recipe-book-83c89.firebaseapp.com",
  databaseURL: "https://recipe-book-83c89.firebaseio.com",
  projectId: "recipe-book-83c89",
  storageBucket: "recipe-book-83c89.appspot.com",
  messagingSenderId: "455704276627",
  appId: "1:455704276627:web:38a9fd87d9ac9ece11e766"
};

// Initialize a new, secondary Firebase app
const recipeApp = initializeApp(recipeFirebaseConfig, "recipe-book");

// Get a reference to the Firestore service
const recipeFirestore = getFirestore(recipeApp);