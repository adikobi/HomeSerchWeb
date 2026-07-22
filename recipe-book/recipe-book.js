// Import Firestore functions from the full URL and the recipe-specific Firestore instance
import {
    collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { recipeFirestore } from './firebase-recipes.js';

// Helper function to find and replace URLs with clickable links
function linkify(text) {
    if (!text) return '';
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        const fullUrl = url.startsWith('www.') ? 'http://' + url : url;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Handler
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // DOM Elements
    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const recipeModal = document.getElementById('recipe-modal');
    const closeRecipeModalBtn = document.querySelector('.close-recipe-modal-btn');
    const recipeForm = document.getElementById('recipe-form');
    const recipesContainer = document.getElementById('recipes-container');
    const recipeSearchInput = document.getElementById('recipe-search-input');
    const recipeModalTitle = document.getElementById('recipe-modal-title');
    // New elements for the view modal
    const recipeViewModal = document.getElementById('recipe-view-modal');
    const closeViewModalBtn = document.querySelector('.close-view-modal-btn');
    const viewRecipeTitle = document.getElementById('view-recipe-title');
    const viewRecipeContent = document.getElementById('view-recipe-content');
    const exportRecipesBtn = document.getElementById('export-recipes-btn');


    let currentRecipes = [];
    let editingRecipeId = null;

    // --- Firestore Logic ---
    const USER_ID = "FgETS4BeELaIGQ3QziwnDCqDQUx2";
    const notesCollectionRef = collection(recipeFirestore, "notes", USER_ID, "myNotes");
    // Create a query to order recipes by title
    const recipesQuery = query(notesCollectionRef, orderBy("title"));


    // Function to load recipes and listen for real-time updates
    const loadRecipes = () => {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('mock-firebase') === 'true') {
            console.log("Mocking recipes for testing environment.");
            currentRecipes = [
                {
                    id: "recipe1",
                    title: "עוגת שוקולד חמה חגיגית",
                    content: "חומרים:\n- 200 גרם שוקולד מריר\n- 100 גרם חמאה\n- 3 ביצים\n- חצי כוס סוכר\n- רבע כוס קמח\n\nאופן ההכנה:\nממיסים שוקולד וחמאה, טורפים ביצים וסוכר, מקפלים קמח ואופים ב-180 מעלות כ-15 דקות."
                },
                {
                    id: "recipe2",
                    title: "סלט יווני אסלי עם פטה",
                    content: "רכיבים:\n- עגבניות, מלפפונים, בצל סגול\n- גבינת פטה פרימיום\n- שמן זית מאיכות מעולה\n- זעתר, מלח פלפל"
                }
            ];
            displayRecipes(currentRecipes);
            return;
        }
        // Use the sorted query instead of the direct collection reference
        onSnapshot(recipesQuery, (snapshot) => {
            currentRecipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayRecipes(currentRecipes);
        }, (error) => {
            console.error("Error loading recipes: ", error);
            alert("שגיאה בטעינת המתכונים.");
        });
    };

    // Function to display recipes on the page
    const displayRecipes = (recipes) => {
        recipesContainer.innerHTML = '';
        if (recipes.length === 0) {
            recipesContainer.innerHTML = '<p>לא נמצאו מתכונים. נסו להוסיף אחד!</p>';
            return;
        }
        recipes.forEach(recipe => {
            const recipeCard = document.createElement('div');
            recipeCard.className = 'item-card'; // Reusing style from main app
            recipeCard.dataset.id = recipe.id; // Add data-id to the card itself
            recipeCard.innerHTML = `
                <h3>${recipe.title}</h3>
                <div class="item-details-list">
                    <div class="item-detail-row">
                        <span class="item-detail-label">סוג פריט:</span>
                        <span class="item-detail-value badge-tag badge-tag-warning">מתכון</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="card-action-btn card-edit-btn" data-id="${recipe.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>ערוך</span>
                    </button>
                    <button class="card-action-btn card-delete-btn" data-id="${recipe.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        <span>מחק</span>
                    </button>
                </div>
            `;
            recipesContainer.appendChild(recipeCard);
        });
    };

    // --- Modal Handling (Add/Edit) ---
    const showModal = (isEditing = false, recipe = {}) => {
        editingRecipeId = isEditing ? recipe.id : null;
        recipeModalTitle.textContent = isEditing ? 'ערוך מתכון' : 'הוסף מתכון חדש';
        document.getElementById('recipe-title').value = isEditing ? recipe.title : '';
        document.getElementById('recipe-content').value = isEditing ? recipe.content : '';
        recipeModal.classList.remove('hidden');
        recipeModal.style.display = 'block';
    };

    const hideModal = () => {
        recipeModal.classList.add('hidden');
        recipeModal.style.display = 'none';
        recipeForm.reset();
        editingRecipeId = null;
    };

    // --- Modal Handling (View) ---
    const showViewModal = (recipe) => {
        viewRecipeTitle.textContent = recipe.title;
        // Use linkify to convert URLs in the content to clickable links
        viewRecipeContent.innerHTML = linkify(recipe.content);
        recipeViewModal.classList.remove('hidden');
        recipeViewModal.style.display = 'block';

        // Scroll to the top of the modal content
        const modalContent = recipeViewModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    };

    const hideViewModal = () => {
        recipeViewModal.classList.add('hidden');
        recipeViewModal.style.display = 'none';
    };

    // --- Event Listeners ---
    addRecipeBtn.addEventListener('click', () => showModal(false));
    closeRecipeModalBtn.addEventListener('click', hideModal);
    closeViewModalBtn.addEventListener('click', hideViewModal);
    exportRecipesBtn.addEventListener('click', exportRecipesToWord);


    // Save or Update Recipe
    recipeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('recipe-title').value;
        const content = document.getElementById('recipe-content').value;

        if (!title || !content) {
            alert("יש למלא כותרת ותוכן למתכון.");
            return;
        }

        try {
            if (editingRecipeId) {
                // Update existing recipe
                const recipeDocRef = doc(recipeFirestore, "notes", USER_ID, "myNotes", editingRecipeId);
                await updateDoc(recipeDocRef, { title, content });
            } else {
                // Add new recipe
                await addDoc(notesCollectionRef, { title, content });
            }
            hideModal();
        } catch (error) {
            console.error("Error saving recipe: ", error);
            alert("שגיאה בשמירת המתכון.");
        }
    });

    // Handle clicks within the recipes container
    recipesContainer.addEventListener('click', async (e) => {
        const target = e.target;

        const editButton = target.closest('.card-edit-btn');
        const deleteButton = target.closest('.card-delete-btn');
        const card = target.closest('.item-card');

        if (editButton) {
            const recipeId = editButton.dataset.id;
            const recipe = currentRecipes.find(r => r.id === recipeId);
            if (recipe) {
                showModal(true, recipe);
            }
            return;
        }

        if (deleteButton) {
            const recipeId = deleteButton.dataset.id;
            if (confirm('האם אתה בטוח שברצונך למחוק את המתכון?')) {
                try {
                    const recipeDocRef = doc(recipeFirestore, "notes", USER_ID, "myNotes", recipeId);
                    await deleteDoc(recipeDocRef);
                } catch (error) {
                    console.error("Error deleting recipe: ", error);
                    alert("שגיאה במחיקת המתכון.");
                }
            }
            return;
        }

        if (card) {
            const recipeId = card.dataset.id;
            const recipe = currentRecipes.find(r => r.id === recipeId);
            if (recipe) {
                showViewModal(recipe);
            }
        }
    });

    // Live Search
    recipeSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        // The search now filters the already sorted list
        const filteredRecipes = currentRecipes.filter(recipe =>
            recipe.title.toLowerCase().includes(searchTerm) ||
            recipe.content.toLowerCase().includes(searchTerm)
        );
        displayRecipes(filteredRecipes);
    });

    // Initial load of recipes
    loadRecipes();

    // --- Export Functionality ---
    function exportRecipesToWord() {
        if (currentRecipes.length === 0) {
            alert('אין מתכונים לייצא.');
            return;
        }

        // Combine all recipes into a single string with formatting
        const content = currentRecipes.map(recipe => {
            return `כותרת: ${recipe.title}\n\nתוכן:\n${recipe.content}\n\n----------------------------------------\n\n`;
        }).join('');

        // Create a Blob with the content
        const blob = new Blob([content], { type: 'application/msword;charset=utf-8' });

        // Create a link to trigger the download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'recipes.doc';

        // Append to body, click, and then remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});