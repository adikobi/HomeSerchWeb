document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    setTimeout(() => {
        splashScreen.classList.add('hidden');
    }, 2000); // 2 second delay

    // Handle active category state from URL parameter or set default
    const urlParams = new URLSearchParams(window.location.search);
    const activeParam = urlParams.get('active');

    const allCategoryButtons = document.querySelectorAll('.category-buttons .category-btn');
    allCategoryButtons.forEach(btn => btn.classList.remove('active'));

    if (activeParam === 'recipes') {
        document.getElementById('recipes-btn').classList.add('active');
        currentCategory = null; // This is a link, not a data category
        document.getElementById('items-container').innerHTML = '';
    } else {
        // Default to 'books'
        document.getElementById('books-btn').classList.add('active');
        currentCategory = 'books'; // Explicitly set default
    }
});

// Global variables
let currentCategory = "books";
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
const recipesBtn = document.getElementById('recipes-btn');
const itemsBtn = document.getElementById('items-btn'); // This should be here for the dropdown
const moreBtn = document.getElementById('more-btn');
const dropdownContent = document.getElementById('dropdown-content');
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
const exportBtn = document.getElementById('export-btn');
const exportModal = document.getElementById('export-modal');
const closeExportModalBtn = document.querySelector('.close-export-modal-btn');
const exportForm = document.getElementById('export-form');
const importBtn = document.getElementById('import-btn');
const importModal = document.getElementById('import-modal');
const closeImportModalBtn = document.querySelector('.close-import-modal-btn');
const importForm = document.getElementById('import-form');
const importResults = document.getElementById('import-results');

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
recipesBtn.addEventListener('click', () => {
    window.location.href = 'recipe-book/recipe-book.html';
});
exportBtn.addEventListener('click', () => {
    exportModal.classList.remove('hidden');
    exportModal.style.display = 'block';
});
closeExportModalBtn.addEventListener('click', () => {
    exportModal.classList.add('hidden');
    exportModal.style.display = 'none';
});
exportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('export-category').value;
    exportDataToExcel(category);
    exportModal.classList.add('hidden');
    exportModal.style.display = 'none';
});
importBtn.addEventListener('click', () => {
    importModal.classList.remove('hidden');
    importModal.style.display = 'block';
    importResults.innerHTML = ''; // Clear previous results
});
closeImportModalBtn.addEventListener('click', () => {
    importModal.classList.add('hidden');
    importModal.style.display = 'none';
});
importForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('import-file');
    const category = document.getElementById('import-category').value;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        importDataFromExcel(file, category);
    } else {
        alert('Please select a file to import.');
    }
});

// Dropdown logic
moreBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevents the window click event from firing immediately
    dropdownContent.classList.toggle('show');
});

// Close the dropdown if the user clicks outside of it
window.addEventListener('click', (event) => {
    if (!event.target.matches('#more-btn')) {
        if (dropdownContent.classList.contains('show')) {
            dropdownContent.classList.remove('show');
        }
    }
});

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

    // Deactivate all potential category buttons
    [booksBtn, foodBtn, itemsBtn, recipesBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    // Activate the selected button
    const selectedBtn = document.getElementById(`${category}-btn`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }

    // If 'items' is selected from dropdown, close it
    if (category === 'items') {
        if (dropdownContent.classList.contains('show')) {
            dropdownContent.classList.remove('show');
        }
    }

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
            <button class="btn edit-btn" onclick="editItem('${item.id}')">ערוך</button>
            <button class="btn delete-btn" onclick="deleteItem('${item.id}')">מחק</button>
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
    
    // Handle barcode input and scan button
    const barcodeGroup = document.querySelector('label[for="item-barcode"]').parentElement;
    const barcodeInput = document.getElementById('item-barcode');

    if (!barcodeGroup.querySelector('.form-group-inline')) {
        const inlineContainer = document.createElement('div');
        inlineContainer.className = 'form-group-inline';

        const scanBtn = document.createElement('button');
        scanBtn.type = 'button';
        scanBtn.className = 'scan-barcode-btn btn';
        scanBtn.textContent = 'סרוק';
        scanBtn.onclick = function() {
            startBarcodeScanner(false).then(code => {
                console.log("Scanned barcode:", code);
                document.getElementById('item-barcode').value = code;
            }).catch(err => {
                console.error("Scanning failed:", err);
            });
        };

        barcodeGroup.appendChild(inlineContainer);
        inlineContainer.appendChild(barcodeInput);
        inlineContainer.appendChild(scanBtn);
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
    
    // Handle barcode input and scan button
    const barcodeGroup = document.querySelector('label[for="item-barcode"]').parentElement;
    const barcodeInput = document.getElementById('item-barcode');

    if (!barcodeGroup.querySelector('.form-group-inline')) {
        const inlineContainer = document.createElement('div');
        inlineContainer.className = 'form-group-inline';

        const scanBtn = document.createElement('button');
        scanBtn.type = 'button';
        scanBtn.className = 'scan-barcode-btn btn';
        scanBtn.textContent = 'סרוק';
        scanBtn.onclick = function() {
            startBarcodeScanner(false).then(code => {
                console.log("Scanned barcode:", code);
                document.getElementById('item-barcode').value = code;
            }).catch(err => {
                console.error("Scanning failed:", err);
            });
        };

        barcodeGroup.appendChild(inlineContainer);
        inlineContainer.appendChild(barcodeInput);
        inlineContainer.appendChild(scanBtn);
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
        // Update existing item - original logic, does not add itemId
        const itemRef = database.ref(`${currentCategory}/${editingItemId}`);
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
        // Add new item
        const newItemRef = database.ref(selectedCategory).push();
        const itemId = newItemRef.key;
        itemData.itemId = itemId; // Add the generated key as itemId

        newItemRef.set(itemData)
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
    
    const constraints = {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 16/9 }
    };

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: constraints,
            area: { // defines region of the image in which to look for barcodes
                top: "25%",    // top offset
                right: "10%",  // right offset
                left: "10%",   // left offset
                bottom: "25%"  // bottom offset
            }
        },
        locator: {
            patchSize: "large",
            halfSample: false
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
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
        
        Quagga.start();
        scannerIsLive = true;
    });
 
    let lastDetectedCode = null;
    let consecutiveCount = 0;
    const requiredMatches = 3; // Lowered for better responsiveness
    const resultCooldown = 2000;
    let lastAcceptedTime = 0;
    let codeHistory = [];
    const codeHistorySize = 3;
    
    Quagga.onDetected(function(result) {
        const codeResult = result.codeResult;
        const now = Date.now();
    
        if (!codeResult || !codeResult.code) {
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

// Export data to Excel
function exportDataToExcel(category) {
    const itemsRef = database.ref(category);
    itemsRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert('No data to export for this category.');
            return;
        }

        const itemsArray = Object.values(data);
        const worksheet = XLSX.utils.json_to_sheet(itemsArray);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, category);
        XLSX.writeFile(workbook, `${category}.xlsx`);
    });
}

// Import data from Excel
function importDataFromExcel(file, category) {
    const reader = new FileReader();
    const importResults = document.getElementById('import-results');
    importResults.innerHTML = '<p>מעבד קובץ...</p>'; // "Processing file..."

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const records = XLSX.utils.sheet_to_json(worksheet);

            if (records.length === 0) {
                importResults.innerHTML = '<p class="error"> הקובץ ריק או שאינו בפורמט הנכון.</p>';
                return;
            }

            const itemsRef = database.ref(category);
            itemsRef.once('value', (snapshot) => {
                const existingData = snapshot.val() || {};
                const existingDescriptions = new Set(Object.values(existingData).map(item => (item.description || '').toLowerCase()));

                let importedCount = 0;
                const skippedItems = [];

                records.forEach(record => {
                    if (record.description && !existingDescriptions.has(record.description.toLowerCase())) {
                        // Create a new reference with a unique key from Firebase
                        const newItemRef = itemsRef.push();
                        // Get the unique key
                        const itemId = newItemRef.key;
                        // Assign the Firebase-generated key to the record as its itemId
                        record.itemId = itemId;
                        // Save the complete record with the correct itemId
                        newItemRef.set(record);
                        importedCount++;
                    } else {
                        skippedItems.push(record.description || 'פריט ללא שם');
                    }
                });

                // Display results
                let resultsHtml = `<p><strong>תהליך הייבוא הסתיים.</strong></p>`;
                resultsHtml += `<p>${importedCount} פריטים חדשים נוספו בהצלחה.</p>`;
                if (skippedItems.length > 0) {
                    resultsHtml += `<p><strong>${skippedItems.length} פריטים לא נוספו כי הם כבר קיימים:</strong></p>`;
                    resultsHtml += `<ul>${skippedItems.map(name => `<li>${name}</li>`).join('')}</ul>`;
                }
                importResults.innerHTML = resultsHtml;
            });
        } catch (error) {
            console.error("Error processing Excel file:", error);
            importResults.innerHTML = `<p class="error">שגיאה בעיבוד הקובץ. אנא ודא שהוא בפורמט الصحيح.</p>`;
        }
    };
    reader.readAsArrayBuffer(file);
}
