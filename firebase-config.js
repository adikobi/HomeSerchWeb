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

if (typeof localStorage !== 'undefined' && localStorage.getItem('mock-firebase') === 'true') {
    console.log("Mocking Firebase for testing environment.");
    window.auth = {
        onAuthStateChanged: (callback) => {
            setTimeout(() => {
                callback({ uid: "test-uid-123", email: "test@example.com" });
            }, 50);
        },
        signOut: () => {
            console.log("Signed out of mock Firebase");
        }
    };
    window.database = {
        ref: (path) => ({
            on: (event, callback) => {
                setTimeout(() => {
                    callback({
                        val: () => {
                            if (path === 'books') {
                                return {
                                    "item1": {
                                        description: "ספר הרי פוטר ואבן החכמים",
                                        location: "מדף 2, סלון",
                                        notes: "מהדורה מיוחדת כריכה קשה",
                                        barcode: "1234567890123",
                                        author: "ג'יי קיי רולינג"
                                    },
                                    "item2": {
                                        description: "שר הטבעות: אחוות הטבעת",
                                        location: "מדף 1, חדר עבודה",
                                        notes: "תרגום ישן",
                                        barcode: "9876543210987",
                                        author: "ג'.ר.ר. טולקין"
                                    }
                                };
                            } else if (path === 'food') {
                                return {
                                    "item3": {
                                        description: "שמן זית כתית מעולה",
                                        location: "מזווה, מדף עליון",
                                        notes: "חומציות 0.5%",
                                        barcode: "7290000123456"
                                    }
                                };
                            } else {
                                return {};
                            }
                        }
                    });
                }, 50);
            },
            once: (event, callback) => {
                callback({ val: () => ({}) });
            }
        })
    };
} else {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    // Get references to Firebase services
    const database = firebase.database();
    const auth = firebase.auth();

    // Export the services
    window.database = database;
    window.auth = auth;
}
