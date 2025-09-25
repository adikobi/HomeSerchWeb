// Import Firestore functions from the full URL and the recipe-specific Firestore instance
import {
    collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { recipeFirestore } from './firebase-recipes.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const recipeModal = document.getElementById('recipe-modal');
    const closeRecipeModalBtn = document.querySelector('.close-recipe-modal-btn');
    const recipeForm = document.getElementById('recipe-form');
    const recipesContainer = document.getElementById('recipes-container');
    const recipeSearchInput = document.getElementById('recipe-search-input');
    const recipeModalTitle = document.getElementById('recipe-modal-title');

    let currentRecipes = [];
    let editingRecipeId = null;

    // --- Firestore Logic ---
    // NOTE: Using a hardcoded user ID for now.
    const USER_ID = "testUser";
    const notesCollectionRef = collection(recipeFirestore, "notes", USER_ID, "myNotes");

    // Function to load recipes and listen for real-time updates
    const loadRecipes = () => {
        onSnapshot(notesCollectionRef, (snapshot) => {
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
            recipeCard.innerHTML = `
                <h3>${recipe.title}</h3>
                <p class="recipe-content-preview">${recipe.content.substring(0, 100)}...</p>
                <div class="item-actions">
                    <button class="btn edit-btn" data-id="${recipe.id}">ערוך</button>
                    <button class="btn delete-btn" data-id="${recipe.id}">מחק</button>
                </div>
            `;
            recipesContainer.appendChild(recipeCard);
        });
    };

    // --- Modal Handling ---
    const showModal = (isEditing = false, recipe = {}) => {
        editingRecipeId = isEditing ? recipe.id : null;
        recipeModalTitle.textContent = isEditing ? 'ערוך מתכון' : 'הוסף מתכון חדש';
        document.getElementById('recipe-title').value = isEditing ? recipe.title : '';
        document.getElementById('recipe-content').value = isEditing ? recipe.content : '';
        recipeModal.classList.remove('hidden');
    };

    const hideModal = () => {
        recipeModal.classList.add('hidden');
        recipeForm.reset();
        editingRecipeId = null;
    };

    // --- Event Listeners ---
    addRecipeBtn.addEventListener('click', () => showModal(false));
    closeRecipeModalBtn.addEventListener('click', hideModal);

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

    // Handle Edit and Delete button clicks
    recipesContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const recipeId = target.dataset.id;

        if (!recipeId) return;

        if (target.classList.contains('edit-btn')) {
            const recipe = currentRecipes.find(r => r.id === recipeId);
            if (recipe) {
                showModal(true, recipe);
            }
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('האם אתה בטוח שברצונך למחוק את המתכון?')) {
                try {
                    const recipeDocRef = doc(recipeFirestore, "notes", USER_ID, "myNotes", recipeId);
                    await deleteDoc(recipeDocRef);
                } catch (error) {
                    console.error("Error deleting recipe: ", error);
                    alert("שגיאה במחיקת המתכון.");
                }
            }
        }
    });

    // Live Search
    recipeSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredRecipes = currentRecipes.filter(recipe =>
            recipe.title.toLowerCase().includes(searchTerm) ||
            recipe.content.toLowerCase().includes(searchTerm)
        );
        displayRecipes(filteredRecipes);
    });

    // Initial load of recipes
    loadRecipes();
});