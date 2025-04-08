// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBUH1IN5iO3cVxGwqG3KIuL9gR2LKK1GeA",
    authDomain: "homesearch-b222a.firebaseapp.com",
    databaseURL: "https://homesearch-b222a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "homesearch-b222a",
    storageBucket: "homesearch-b222a.appspot.com",
    messagingSenderId: "516235274810",
    appId: "1:516235274810:web:e5deaedb40633f0392a303"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to Firebase services
const database = firebase.database();
const auth = firebase.auth();

// Export the services
window.database = database;
window.auth = auth; 