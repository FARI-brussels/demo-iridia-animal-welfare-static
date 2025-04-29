document.addEventListener('DOMContentLoaded', async () => {

    // --- DOM Elements ---
    const leaderboardList = document.getElementById('leaderboard');
    const playAgainButton = document.getElementById('button_again');
    const homeLink = document.getElementById('home');
    const playLink = document.getElementById('playy');
    const leaderLink = document.getElementById('leader');
    const titleScoreElement = document.getElementById('titlescore');

    // --- LocalStorage Keys ---
    const LANG_KEY = 'gameLanguage';
    const DIFF_KEY = 'gameDifficulty';
    const SCORE_KEY = 'leaderboardScores';

    // --- State ---
    let language = 'EN';
    let text = {};
    let leaderboardData = [];

    // --- Initialization ---
    async function initializeLeaderboard() {
        // 1. Get language
        language = localStorage.getItem(LANG_KEY) || 'EN';

        // 2. Load language text
        await loadLanguageText(language);

        // 3. Load leaderboard scores
        loadScores();

        // 4. Sort scores
        sortScores();

        // 5. Update UI text
        updateUIText();

        // 6. Display scores
        displayLeaderboard();

        // 7. Set up button listeners (mainly navigation)
        setupEventListeners();

        // 8. Ensure Play link viability (check if settings exist)
        checkPlayLink();
    }

    // --- Data Loading ---
    async function loadLanguageText(lang) {
        try {
            const response = await fetch(`data/text_${lang}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            text = await response.json();
        } catch (error) {
            console.error("Could not load language file:", error);
            if (lang !== 'EN') {
                await loadLanguageText('EN'); // Fallback
            }
        }
    }

    function loadScores() {
        try {
            const storedScores = localStorage.getItem(SCORE_KEY);
            if (storedScores) {
                leaderboardData = JSON.parse(storedScores);
                console.log("Loaded scores from localStorage");
            } else {
                // Optional: Load default scores from JSON if localStorage is empty
                // This part is removed as static site cannot rely on updating this file.
                // We will just show an empty leaderboard if local storage is empty.
                console.log("No scores found in localStorage. Leaderboard will be empty initially.");
                leaderboardData = []; 
                // Original code tried fetching 'leaderboard.json', which is not suitable for static only approach.
                /*
                try {
                    const response = await fetch('data/leaderboard.json');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const defaultData = await response.json();
                    leaderboardData = defaultData.players || []; // Expecting { players: [...] }
                    console.log("Loaded default scores from leaderboard.json");
                } catch (fetchError) {
                    console.error("Could not load default leaderboard file:", fetchError);
                    leaderboardData = [];
                }
                */
            }
        } catch (e) {
            console.error("Error reading leaderboard from localStorage:", e);
            leaderboardData = []; // Reset if data is corrupt
        }

        // Ensure data is always an array
        if (!Array.isArray(leaderboardData)) {
             console.warn("Leaderboard data was not an array, resetting.");
             leaderboardData = [];
        }
    }

    // --- Score Processing ---
    function sortScores() {
        leaderboardData.sort((a, b) => {
            // Ensure scores are numbers for correct sorting
            const scoreA = parseInt(a.score, 10) || 0;
            const scoreB = parseInt(b.score, 10) || 0;
            return scoreB - scoreA; // Descending order
        });
    }

    // --- UI Updates ---
    function updateUIText() {
        homeLink.innerHTML = text["home"] || "Rules";
        playLink.innerHTML = text["playy"] || "Play";
        leaderLink.innerHTML = text["leader"] || "Leaderboard";
        playAgainButton.innerHTML = text["button_again"] || "Play again";
        titleScoreElement.innerHTML = text["titlescore"] || "Name | Score";
    }

    function displayLeaderboard() {
        leaderboardList.innerHTML = ''; // Clear existing entries
        if (leaderboardData.length === 0) {
            leaderboardList.innerHTML = `<li>${text['no_scores'] || 'No scores yet! Play a game.'}</li>`;
            return;
        }

        leaderboardData.forEach(player => {
            const listItem = document.createElement('li');
            // Sanitize player.pseudo to prevent potential XSS if names were user-controlled and displayed unsafely elsewhere
            const safePseudo = player.pseudo.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            listItem.innerHTML = `<b class='textscore2'>${safePseudo}</b><p class='textscore'>${parseInt(player.score, 10) || 0}</p>`;
            leaderboardList.appendChild(listItem);
        });
    }

    // Prevent playing directly from leaderboard if language/difficulty haven't been set
    function checkPlayLink() {
         if (!localStorage.getItem(LANG_KEY) || !localStorage.getItem(DIFF_KEY)) {
             playLink.href = "index.html"; // Redirect to rules/settings first
             playAgainButton.href = "index.html";
             console.log("Language/Difficulty not set, redirecting Play links to Rules page.");
         } else {
             playLink.href = "static_play.html";
             playAgainButton.href = "static_play.html";
         }
     }

    // --- Event Listeners ---
    function setupEventListeners() {
        playAgainButton.addEventListener('click', () => {
            // Reset game state if needed (localStorage variables used by play.js)
            localStorage.removeItem('gameState'); // Example if play.js uses this
            // Navigation is handled by the href
        });
    }

    // --- Start ---
    initializeLeaderboard();

}); 