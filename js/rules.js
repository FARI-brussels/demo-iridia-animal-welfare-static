document.addEventListener('DOMContentLoaded', () => {
    const languageSelect = document.getElementById('language');
    const difficultySelect = document.getElementById('difficulty');
    const playButton = document.getElementById('button');
    const playLinkTopbar = document.getElementById('playy'); // Get the topbar play link

    // --- State Management ---
    // Function to get state from localStorage
    const getState = () => {
        return {
            language: localStorage.getItem('gameLanguage') || 'EN',
            difficulty: localStorage.getItem('gameDifficulty') || '0' // Default to '0' (Easy)
        };
    };

    // Function to save state to localStorage
    const saveState = (lang, diff) => {
        localStorage.setItem('gameLanguage', lang);
        localStorage.setItem('gameDifficulty', diff);
    };

    // --- Language Loading and Text Update ---
    let currentTextData = {};

    async function fetchAndApplyLanguage(lang) {
        try {
            const response = await fetch(`data/text_${lang}.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            currentTextData = await response.json();
            applyText(currentTextData);
            // Update select dropdown to reflect current language
            languageSelect.value = lang;
        } catch (error) {
            console.error("Could not load language file:", error);
            // Optionally load default English text as fallback
            if (lang !== 'EN') {
                await fetchAndApplyLanguage('EN');
            }
        }
    }

    function applyText(text) {
        // Update all elements with IDs matching keys in the text object
        Object.keys(text).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.innerHTML = text[key];
            }
        });
         // Ensure button text is updated if it was missed by ID matching
        if (playButton && text["button"]) {
             playButton.innerHTML = text["button"];
        }
    }

    // --- Event Listeners ---
    languageSelect.addEventListener('change', (event) => {
        const selectedLang = event.target.value;
        saveState(selectedLang, difficultySelect.value); // Save current difficulty too
        fetchAndApplyLanguage(selectedLang);
    });

    difficultySelect.addEventListener('change', (event) => {
        const selectedDiff = event.target.value;
        saveState(languageSelect.value, selectedDiff); // Save current language too
    });

    playButton.addEventListener('click', () => {
        // Save final selections before navigating
        saveState(languageSelect.value, difficultySelect.value);
        // Clear previous game state if any (score, time, etc.)
        localStorage.removeItem('gameState'); // We'll define gameState structure in play.js
        // Navigation is handled by the <a> tag's href
    });

    // --- Initial Setup ---
    const initialState = getState();
    languageSelect.value = initialState.language; // Set dropdown to stored language
    difficultySelect.value = initialState.difficulty; // Set dropdown to stored difficulty
    fetchAndApplyLanguage(initialState.language); // Load initial language text

    // Enable the topbar "Play" link immediately in static version
    playLinkTopbar.href = "static_play.html";
}); 