// Global variables
let currentCategory = null;
let currentItems = [];
let editingItemId = null;
let scannerIsLive = false;
// DOM Elements
const authModal = document.getElementById('auth-modal');
const mainContainer = document.getElementById('main-container');
const authForm = document.getElementById('auth-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const booksBtn = document.getElementById('books-btn');
const foodBtn = document.getElementById('food-btn');
const itemsBtn = document.getElementById('items-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const addItemBtn = document.getElementById('add-item-btn');
const scanBarcodeBtn = document.getElementById('scan-barcode-btn');
const itemsContainer = document.getElementById('items-container');
const itemModal = document.getElementById('item-modal');
const closeBtn = document.querySelector('.close-btn');
const itemForm = document.getElementById('item-form');
const scannerContainer = document.getElementById('scanner-container');
const stopScanBtn = document.getElementById('stop-scan-btn');
const authorGroup = document.getElementById('author-group');

// Authentication State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        authModal.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        loadItems();
    } else {
        // User is signed out
        authModal.classList.remove('hidden');
        mainContainer.classList.add('hidden');
        currentItems = [];
        displayItems([]);
    }
});

// Authentication Event Listeners
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            console.error('Login error:', error);
            alert('שגיאה בהתחברות: ' + error.message);
        });
});

registerBtn.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .catch(error => {
            console.error('Registration error:', error);
            alert('שגיאה בהרשמה: ' + error.message);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Live Search Implementation
searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredItems = currentItems.filter(item => {
        return (
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.location && item.location.toLowerCase().includes(searchTerm)) ||
            (item.notes && item.notes.toLowerCase().includes(searchTerm)) ||
            (item.author && item.author.toLowerCase().includes(searchTerm))
        );
    });
    displayItems(filteredItems);
});

// Event Listeners
booksBtn.addEventListener('click', () => selectCategory('books'));
foodBtn.addEventListener('click', () => selectCategory('food'));
itemsBtn.addEventListener('click', () => selectCategory('items'));
searchBtn.addEventListener('click', searchItems);
addItemBtn.addEventListener('click', showAddItemModal);
scanBarcodeBtn.addEventListener('click', startBarcodeScanner);
closeBtn.addEventListener('click', hideModal);
itemForm.addEventListener('submit', saveItem);
if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopBarcodeScanner);
}

// Category Selection
function selectCategory(category) {
    currentCategory = category;
    authorGroup.style.display = category === 'books' ? 'block' : 'none';
    loadItems();
}

// Load Items from Firebase
function loadItems() {
    if (!currentCategory) {
        console.error('No category selected');
        return;
    }

    console.log(`Loading items for category: ${currentCategory}`);
    const itemsRef = database.ref(currentCategory);
    
    itemsRef.on('value', (snapshot) => {
        console.log('Firebase snapshot received:', snapshot);
        currentItems = [];
        const data = snapshot.val();
        
        if (data) {
            console.log('Data found:', data);
            Object.entries(data).forEach(([id, item]) => {
                currentItems.push({ id, ...item });
            });
        } else {
            console.log('No data found for this category');
        }
        
        console.log('Current items array:', currentItems);
        displayItems(currentItems);
    }, (error) => {
        console.error('Error loading items:', error);
        alert('שגיאה בטעינת הפריטים. אנא נסה שוב.');
    });
}

// Display Items
function displayItems(items) {
    itemsContainer.innerHTML = '';
    items.forEach(item => {
        const itemCard = createItemCard(item);
        itemsContainer.appendChild(itemCard);
    });
}

// Create Item Card
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <h3>${item.description || 'ללא שם'}</h3>
        <p><strong>מיקום:</strong> ${item.location || 'ללא מיקום'}</p>
        <p><strong>הערות:</strong> ${item.notes || 'ללא הערות'}</p>
        ${item.barcode ? `<p><strong>ברקוד:</strong> ${item.barcode}</p>` : ''}
        ${item.author ? `<p><strong>מחבר:</strong> ${item.author}</p>` : ''}
        <div class="item-actions">
            <button class="edit-btn" onclick="editItem('${item.id}')">ערוך</button>
            <button class="delete-btn" onclick="deleteItem('${item.id}')">מחק</button>
        </div>
    `;
    return card;
}

// Search Items
function searchItems() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredItems = currentItems.filter(item => {
        return (
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.location && item.location.toLowerCase().includes(searchTerm)) ||
            (item.notes && item.notes.toLowerCase().includes(searchTerm)) ||
            (item.author && item.author.toLowerCase().includes(searchTerm))
        );
    });
    displayItems(filteredItems);
}

// Show Add Item Modal
function showAddItemModal() {
    editingItemId = null;
    document.getElementById('modal-title').textContent = 'הוסף פריט חדש';
    document.getElementById('item-description').value = '';
    document.getElementById('item-location').value = '';
    document.getElementById('item-notes').value = '';
    document.getElementById('item-barcode').value = '';
    document.getElementById('item-author').value = '';
    document.getElementById('item-category').value = currentCategory || 'items';
    
    // הוספת כפתור סריקה לשדה הברקוד
    const barcodeGroup = document.querySelector('label[for="item-barcode"]').parentElement;
    if (!barcodeGroup.querySelector('.scan-barcode-btn')) {
        const scanBtn = document.createElement('button');
        scanBtn.type = 'button';
        scanBtn.className = 'scan-barcode-btn';
        scanBtn.textContent = 'סרוק ברקוד';
        scanBtn.onclick = function() {
            startBarcodeScanner(false).then(code => {
                console.log("Scanned barcode:", code);
                document.getElementById('item-barcode').value = code;
                
            }).catch(err => {
                console.error("Scanning failed:", err);
            });
            
        };
        barcodeGroup.appendChild(scanBtn);
    }
    
    itemModal.classList.remove('hidden');
    itemModal.style.display = "block";
}

// Hide Modal
function hideModal() {
    itemModal.classList.add('hidden');
}

// Edit Item
function editItem(itemId) {
    editingItemId = itemId;
    const item = currentItems.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found');
        return;
    }
    
    document.getElementById('modal-title').textContent = 'ערוך פריט';
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-location').value = item.location || '';
    document.getElementById('item-notes').value = item.notes || '';
    document.getElementById('item-barcode').value = item.barcode || '';
    document.getElementById('item-author').value = item.author || '';
    document.getElementById('item-category').value = currentCategory;
    
    // הוספת כפתור סריקה לשדה הברקוד
    const barcodeGroup = document.querySelector('label[for="item-barcode"]').parentElement;
    if (!barcodeGroup.querySelector('.scan-barcode-btn')) {
        const scanBtn = document.createElement('button');
        scanBtn.type = 'button';
        scanBtn.className = 'scan-barcode-btn';
        scanBtn.textContent = 'סרוק ברקוד';
        scanBtn.onclick = function() {

            startBarcodeScanner(false).then(code => {
                console.log("Scanned barcode:", code);
                document.getElementById('item-barcode').value = code;

            }).catch(err => {
                console.error("Scanning failed:", err);
            });


            
            
        };
        barcodeGroup.appendChild(scanBtn);
    }
    
    itemModal.classList.remove('hidden');
    itemModal.style.display = "block";
}

// Save Item
function saveItem(e) {
    e.preventDefault();
    
    const selectedCategory = document.getElementById('item-category').value;
    const itemData = {
        description: document.getElementById('item-description').value,
        location: document.getElementById('item-location').value,
        notes: document.getElementById('item-notes').value,
        barcode: document.getElementById('item-barcode').value
    };

    if (selectedCategory === 'books') {
        itemData.author = document.getElementById('item-author').value;
    }

    if (editingItemId) {
        // Update existing item
        const itemRef = database.ref(`${currentCategory}/${editingItemId}`);
        itemRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                itemRef.update(itemData)
                    .then(() => {
                        console.log('Item updated successfully');
                        hideModal();
                    })
                    .catch(error => {
                        console.error('Error updating item:', error);
                        alert('שגיאה בעדכון הפריט. אנא נסה שוב.');
                    });
            } else {
                alert('הפריט לא נמצא במערכת. ייתכן שנמחק.');
                hideModal();
            }
        });
    } else {
        // Add new item
        database.ref(selectedCategory).push(itemData)
            .then(() => {
                console.log('Item added successfully');
                hideModal();
                // Switch to the selected category
                selectCategory(selectedCategory);
            })
            .catch(error => {
                console.error('Error adding item:', error);
                alert('שגיאה בהוספת הפריט. אנא נסה שוב.');
            });
    }
}

// Delete Item
function deleteItem(itemId) {
    if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
        database.ref(`${currentCategory}/${itemId}`).remove();
    }
}

// Barcode Scanner
function startBarcodeScanner(search=true) {
    scannerContainer.classList.remove('hidden');
    
    // iOS specific configuration
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const constraints = isIOS ? {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        facingMode: "environment",
        aspectRatio: { min: 1, max: 2 }
    } : {
        width: 640,
        height: 480,
        facingMode: "environment",
        aspectRatio: { min: 1, max: 2 }
    };

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: constraints,
            area: { // defines region of the image in which to look for barcodes
                top: "0%",    // top offset
                right: "0%",  // right offset
                left: "0%",   // left offset
                bottom: "0%"  // bottom offset
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: isIOS ? 2 : 4, // Reduce workers for iOS
        decoder: {
            readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"]
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error(err);
            alert('שגיאה בהפעלת הסורק. אנא בדוק שהמצלמה זמינה.');
            stopBarcodeScanner();
            return;
        }
        
        // iOS specific adjustments
        if (isIOS) {
            const video = document.querySelector("#interactive video");
            if (video) {
                video.style.transform = "scaleX(-1)"; // Flip video for iOS
                video.style.webkitTransform = "scaleX(-1)";
            }
        }
        
        Quagga.start();
        scannerIsLive = true;
    });
 
    let lastDetectedCode = null;
    let consecutiveCount = 0;
    const requiredMatches = isIOS ? 3 : 5; // Reduce required matches for iOS
    const resultCooldown = 2000;
    let lastAcceptedTime = 0;
    let codeHistory = [];
    const codeHistorySize = 3;
    
    Quagga.onDetected(function(result) {
        const codeResult = result.codeResult;
        const now = Date.now();
    
        if (!codeResult || !codeResult.code) {
            console.log("⛔️ No valid code detected.");
            return;
        }
    
        const code = codeResult.code;
        
        // בדיקת תקינות הברקוד
        if (!isValidBarcode(code)) {
            console.log(`❌ Invalid barcode format: ${code}`);
            return;
        }
    
        console.log(`📦 Detected barcode: ${code}`);
    
        // הוספת הקוד להיסטוריה
        codeHistory.push(code);
        if (codeHistory.length > codeHistorySize) {
            codeHistory.shift();
        }
    
        // בדיקה אם כל הקודים בהיסטוריה זהים
        const allSame = codeHistory.every(c => c === code);
    
        if (code === lastDetectedCode) {
            consecutiveCount++;
        } else {
            console.log(`🔁 New code detected. Resetting count. Previous: ${lastDetectedCode}, Current: ${code}`);
            lastDetectedCode = code;
            consecutiveCount = 1;
            codeHistory = [code];
        }
    
        console.log(`🔍 Count for ${code}: ${consecutiveCount}/${requiredMatches} (History: ${codeHistory.join(', ')})`);
    
        if (consecutiveCount >= requiredMatches && allSame) {
            if (now - lastAcceptedTime < resultCooldown) {
                console.log(`⏱ Barcode ${code} accepted recently. Ignoring.`);
                return;
            }
    
            console.log(`✅ Barcode accepted: ${code}`);
            lastAcceptedTime = now;
    
            // איפוס הכל לאחר קבלת ברקוד
            lastDetectedCode = null;
            consecutiveCount = 0;
            codeHistory = [];
    
            stopBarcodeScanner();
    
            if (search) {
                console.log("🔍 Performing search for barcode...");
                searchByBarcode(code);
            } else {
                console.log("📝 Setting barcode in input field.");
                document.getElementById('item-barcode').value = code;
                // אם אנחנו בעריכה, נחזיר את המודל למצב גלוי
                if (editingItemId) {
                    itemModal.classList.remove('hidden');
                }
                resolve(code);
            }
        }
    });
}


function stopBarcodeScanner() {
    if (scannerIsLive) {
        Quagga.stop();
    }
    console.log(scannerContainer);  // Check if the element exists
    scannerContainer.classList.add('hidden');
    console.log("!!stopped scanner");
    
    scannerIsLive = false;
}

function searchByBarcode(barcode) {
    const item = currentItems.find(item => item.barcode === barcode);
    if (item) {
        //searchInput.value = barcode;
        displayItems([item]);
    } else {
        // Open add item modal with the scanned barcode
        editingItemId = null;
        document.getElementById('modal-title').textContent = 'הוסף פריט חדש';
        document.getElementById('item-description').value = '';
        document.getElementById('item-location').value = '';
        document.getElementById('item-notes').value = '';
        document.getElementById('item-barcode').value = barcode;
        document.getElementById('item-author').value = '';
        itemModal.classList.remove('hidden');
        itemModal.style.display = "block";
    }
}

// פונקציה לבדיקת תקינות הברקוד
function isValidBarcode(code) {
    // בדיקת אורך מינימלי
    if (code.length < 8) {
        return false;
    }
    
    // בדיקת תווים חוקיים
    if (!/^\d+$/.test(code)) {
        return false;
    }
    
    // בדיקת ספרת ביקורת ל-EAN-13
    if (code.length === 13) {
        const checkDigit = parseInt(code[12]);
        const sum = code.substring(0, 12).split('').reduce((acc, digit, index) => {
            const num = parseInt(digit);
            return acc + (index % 2 === 0 ? num : num * 3);
        }, 0);
        const calculatedCheckDigit = (10 - (sum % 10)) % 10;
        return checkDigit === calculatedCheckDigit;
    }
    
    // בדיקת ספרת ביקורת ל-UPC-A
    if (code.length === 12) {
        const checkDigit = parseInt(code[11]);
        const sum = code.substring(0, 11).split('').reduce((acc, digit, index) => {
            const num = parseInt(digit);
            return acc + (index % 2 === 0 ? num * 3 : num);
        }, 0);
        const calculatedCheckDigit = (10 - (sum % 10)) % 10;
        return checkDigit === calculatedCheckDigit;
    }
    
    return true;
}

// Add event listener for category change
document.getElementById('item-category').addEventListener('change', function() {
    const selectedCategory = this.value;
    const authorGroup = document.getElementById('author-group');
    authorGroup.style.display = selectedCategory === 'books' ? 'block' : 'none';
}); 