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
    console.log("showAddItemModal");
    editingItemId = null;
    document.getElementById('modal-title').textContent = 'הוסף פריט חדש';
    document.getElementById('item-description').value = '';
    document.getElementById('item-location').value = '';
    document.getElementById('item-notes').value = '';
    document.getElementById('item-barcode').value = '';
    document.getElementById('item-author').value = '';
    itemModal.classList.remove('hidden');
    itemModal.style.display = "block";
    console.log("doneshowAddItemModal");
}

// Hide Modal
function hideModal() {
    itemModal.classList.add('hidden');
}

// Save Item
function saveItem(e) {
    e.preventDefault();
    
    const itemData = {
        description: document.getElementById('item-description').value,
        location: document.getElementById('item-location').value,
        notes: document.getElementById('item-notes').value,
        barcode: document.getElementById('item-barcode').value
    };

    if (currentCategory === 'books') {
        itemData.author = document.getElementById('item-author').value;
    }

    if (editingItemId) {
        // Update existing item
        database.ref(`${currentCategory}/${editingItemId}`).update(itemData)
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
        database.ref(currentCategory).push(itemData)
            .then(() => {
                console.log('Item added successfully');
                hideModal();
            })
            .catch(error => {
                console.error('Error adding item:', error);
                alert('שגיאה בהוספת הפריט. אנא נסה שוב.');
            });
    }
}

// Edit Item
function editItem(itemId) {
    editingItemId = itemId;
    const item = currentItems.find(i => i.id === itemId);
    console.log(item);
    document.getElementById('modal-title').textContent = 'ערוך פריט';
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-location').value = item.location || '';
    document.getElementById('item-notes').value = item.notes || '';
    document.getElementById('item-barcode').value = item.barcode || '';
    document.getElementById('item-author').value = item.author || '';
    
    itemModal.classList.remove('hidden');
}

// Delete Item
function deleteItem(itemId) {
    if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
        database.ref(`${currentCategory}/${itemId}`).remove();
    }
}

// Barcode Scanner
function startBarcodeScanner() {
    scannerContainer.classList.remove('hidden');
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector("#interactive"),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            },
        },
        decoder: {
            readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader"]
        }
    }, function(err) {
        if (err) {
            console.error(err);
            alert('שגיאה בהפעלת הסורק');
            return;
        }
        Quagga.start();
        scannerIsLive = true;
    });

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        stopBarcodeScanner();
        searchByBarcode(code);
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
        searchInput.value = barcode;
        displayItems([item]);
    } else {
        alert(barcode);
    }
} 