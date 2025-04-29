document.addEventListener('DOMContentLoaded', async () => {
    // --- Game State Variables ---
    let map;
    let vectorLayer;
    let controls;
    let epsg4326, projectTo;
    let ads = [];
    let text = {};
    let currentscore = 0;
    let timer = 300; // Default timer
    let game_over = 0;
    let good_answers = 0;
    let wrong_answers = 0;
    let AI_good_answers = 0;
    let AI_wrong_answers = 0;
    let AI_currentscore = 0;
    let AI_current_ad_id = 0;
    let starttime = undefined;
    let finishtime = undefined;
    let vectorID = []; // Keep track of *answered* ad IDs
    let initialTimerValue = 300;
    let level = 0; // Difficulty level (0: Easy, 1: Normal, 2: Hard)
    let language = 'EN';

    // --- DOM Elements ---
    const scoreTextElement = document.getElementById('scoretxt');
    const timerTextElement = document.getElementById('timer');
    const winTextElement = document.getElementById('wintxt');
    const sliderElement = document.getElementById('slider');
    const popupElement = document.getElementById('popup');
    const showScoreElement = document.getElementById('show_score');
    const showAccElement = document.getElementById('show_acc');
    const showScoreAIElement = document.getElementById('show_score_AI');
    const showAccAIElement = document.getElementById('show_acc_AI');
    const showTimeElement = document.getElementById('show_time');
    const usernameInputElement = document.getElementById('username');
    const saveButton = document.getElementById('button');
    const quitButton = document.getElementById('quit');
    const mapElement = document.getElementById('m');
    const audioWin = document.getElementById('audio_win');
    const audioLose = document.getElementById('audio_lose');
    const audioClick = document.getElementById('audio_click'); // AI click sound

    // --- LocalStorage Keys ---
    const LANG_KEY = 'gameLanguage';
    const DIFF_KEY = 'gameDifficulty';
    const SCORE_KEY = 'leaderboardScores'; // Key for storing leaderboard locally

    // --- Initialization ---
    async function initializeGame() {
        // 1. Get settings from localStorage
        language = localStorage.getItem(LANG_KEY) || 'EN';
        level = parseInt(localStorage.getItem(DIFF_KEY) || '0', 10);

        // 2. Load language text
        await loadLanguageText(language);

        // 3. Load ads data
        await loadAdsData(language);

        // 4. Set up timer based on difficulty
        setupTimer();

        // 5. Initialize Map
        initializeMap();

        // 6. Add ads to map
        resetMap(); // Initially load all ads

        // 7. Setup Map Controls
        setupMapControls();

        // 8. Display initial UI
        updateScoreDisplay();
        updateTimerDisplay();
        changeLangUIElements(); // Apply loaded language text to UI

        // 9. Start Timers/Intervals
        startIntervals();

        // 10. Show first ad popup
        if (vectorLayer && vectorLayer.features.length > 0) {
            createPopup(vectorLayer.features[0]);
        }

        // 11. Add event listeners for buttons
        setupEventListeners();
    }

    // --- Data Loading ---
    async function loadLanguageText(lang) {
        try {
            const response = await fetch(`data/text_${lang}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            text = await response.json();
        } catch (error) {
            console.error("Could not load language file:", error);
            // Fallback to English if error
            if (lang !== 'EN') {
                await loadLanguageText('EN');
            }
        }
    }

    async function loadAdsData(lang) {
        try {
            const filename = `data/ads_${lang}.json`;
            const response = await fetch(filename);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            ads = data.ads;
        } catch (error) {
            console.error("Could not load ads data:", error);
            ads = []; // Ensure ads is an empty array on failure
        }
    }

    // --- UI Updates ---
    function updateScoreDisplay() {
        scoreTextElement.innerHTML = `${text['score'] || 'Score :'} ${currentscore}`;
    }

    function updateTimerDisplay() {
        if (timer > 0) {
            const minutes = Math.floor(timer / 60);
            const remainingSeconds = timer % 60;
            if (minutes > 0) {
                timerTextElement.innerHTML = `${text['time'] || 'Time :'} ${minutes} min`;
            } else {
                 timerTextElement.innerHTML = `${text['time'] || 'Time :'} ${remainingSeconds} sec`;
                //timerTextElement.innerHTML = `${text['time'] || 'Time :'} <1 min`; // Original text
            }
        } else {
            timerTextElement.innerHTML = `${text['time'] || 'Time :'} 0 sec`; // Show 0 sec when time is up
           // timerTextElement.innerHTML = `${text['time'] || 'Time :'} <1 min`; // Original text
        }
    }

     function changeLangUIElements() {
        document.getElementById('home').innerHTML = text["home"];
        document.getElementById('playy').innerHTML = text["playy"];
        document.getElementById('leader').innerHTML = text["leader"];
        document.getElementById('quit').innerHTML = text["quit"];
        // Score and Timer updated separately
    }

    // --- Map Functions ---
    function initializeMap() {
        map = new OpenLayers.Map("m");
        map.addLayer(new OpenLayers.Layer.OSM());
        epsg4326 = new OpenLayers.Projection("EPSG:4326"); // WGS 1984 projection
        projectTo = map.getProjectionObject(); // The map projection (Spherical Mercator)
        const lonLat = new OpenLayers.LonLat(4.55, 50.84865).transform(epsg4326, projectTo);
        const zoom = 11;
        map.setCenter(lonLat, zoom);
        vectorLayer = new OpenLayers.Layer.Vector("Overlay");
        map.addLayer(vectorLayer);
    }

    // Reset map (add features not in answered list)
    function resetMap() {
        vectorLayer.destroyFeatures(); // Clear existing features
        const answeredSet = new Set(vectorID);
        for (let i = 0; i < ads.length; i++) {
            if (!answeredSet.has(ads[i]['id'])) { // Only add if not already answered
                const feature = new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.Point(ads[i]['lat'], ads[i]['long']).transform(epsg4326, projectTo),
                    { description: [ads[i]['description'], ads[i]['id'], ads[i]['error'], ads[i]['whereError']] },
                    { externalGraphic: 'img/marker.png', graphicHeight: 40, graphicWidth: 40, graphicXOffset: -12, graphicYOffset: -25 }
                );
                vectorLayer.addFeatures(feature);
            }
        }
    }

    function setupMapControls() {
        controls = {
            selector: new OpenLayers.Control.SelectFeature(vectorLayer, { onSelect: createPopup, onUnselect: destroyPopup })
        };
        map.addControl(controls['selector']);
        controls['selector'].activate();
    }

    // Show the side window with the information about the ad
    function createPopup(feature) {
        if (!feature || game_over) return; // Don't show popup if game over or no feature

        starttime = Date.now();
        const adData = feature.attributes.description[0]; // Assuming this is the HTML content
        const adId = feature.attributes.description[1];
        const gain = feature.attributes.description[0].includes("but_legal") ? 100 : 0; // Simple check if legal/illegal button is present - NEEDS REFINEMENT based on actual data structure

        sliderElement.innerHTML = adData; // Display the ad content
        // We need to dynamically add click handlers to the Legal/Illegal buttons inside the description
        const legalButton = sliderElement.querySelector('.but_legal');
        const illegalButton = sliderElement.querySelector('.but_illegal');

        if(legalButton) {
             // Check if the ad is ACTUALLY legal based on rules (this is complex, using a placeholder)
            const isTrulyLegal = checkAdLegality(feature.attributes.description); // Placeholder - implement this
            legalButton.onclick = () => doAction(isTrulyLegal ? 100 : 0, adId); // 100 points if correct, 0 if wrong
        }
        if(illegalButton) {
            const isTrulyLegal = checkAdLegality(feature.attributes.description);
            illegalButton.onclick = () => doAction(isTrulyLegal ? 0 : 100, adId); // 100 points if correct, 0 if wrong
        }

        sliderElement.style.opacity = '1';
        sliderElement.style.marginLeft = 'calc(100% - 535px)';
        sliderElement.scrollTo(0, 0);
    }

    // Placeholder function - needs implementation based on rules defined in rules.html
    function checkAdLegality(adAttributes) {
        // adAttributes = [descriptionHTML, id, errorText, whereErrorSteps]
        // Logic needed here to parse descriptionHTML, check image rules (hard without image analysis),
        // check location, HK number presence, legal mention etc.
        // Returning true for now, meaning all ads are marked legal by default.
        // This NEEDS to be implemented correctly for the game logic to work.
        console.warn("checkAdLegality is a placeholder. Implement rule checking!");
        // Example check based on the error field structure provided in the data:
        const errorReason = adAttributes[2];
        // Add safety check for errorReason being a string
        if (typeof errorReason === 'string') {
            return errorReason.toLowerCase().includes("this ad is legal"); // Basic check
        }
        console.warn(`Ad ID ${adAttributes[1]} missing valid error reason.`);
        return false; // Default to illegal if error reason is missing/invalid
    }

    // Hide the side window with the information about the ad
    function destroyPopup() {
        if (sliderElement.style.opacity !== '0') {
             sliderElement.style.opacity = '0';
             // Optional: Add a delay before truly hiding/clearing content
             // setTimeout(() => { sliderElement.innerHTML = ''; }, 500); // Adjust timing
        }
    }

    // Remove the popup from the map once the user classifies it
    function removeFeatureById(id) {
        let featureToRemove = null;
        for (let i = 0; i < vectorLayer.features.length; i++) {
            if (vectorLayer.features[i]['attributes']['description'][1] === id) {
                featureToRemove = vectorLayer.features[i];
                break;
            }
        }
        if (featureToRemove) {
            try {
                 vectorLayer.removeFeatures(featureToRemove);
            } catch (e) {
                console.error("Error removing feature: ", e);
            }
        }
    }

    // --- Game Logic ---
    function doAction(pointsAwarded, id) {
        if (game_over) return;

        const currenttime = Date.now();
        const deltatime = starttime ? currenttime - starttime : 1000; // Avoid NaN if starttime is missing
        let value = 0;

        if (pointsAwarded === 0) { // Incorrect Answer
            wrong_answers += 1;
            audioLose.play();
            displaySolution(id, 0); // Show wrong answer explanation
        } else { // Correct Answer
            good_answers += 1;
            audioWin.play();
            // Calculate score: Base points minus time penalty (scaled by difficulty)
            value = Math.max(5, parseInt(pointsAwarded - (level + 1) * (deltatime / 1500))); // Adjusted formula
            displaySolution(id, 1); // Show correct answer explanation
        }

        // Update score
        currentscore += value;
        console.log("currentscore: " + currentscore);
        updateScoreDisplay();

        // Show points gained feedback
        if (value > 0) {
            winTextElement.innerHTML = "+" + String(value);
            winTextElement.style.display = "block";
            winTextElement.style.opacity = '1';
            setTimeout(() => { winTextElement.style.opacity = '0'; }, 1500); // Fade out faster
        }

        vectorID.push(id); // Add answered ad ID to the list
        // Don't remove feature immediately, let displaySolution handle it via Next button
    }

    // Explain the answer and provide a "Next" button
    function displaySolution(id, solutionType) { // 0 = wrong, 1 = correct
        let feature = null;
        for (let i = 0; i < vectorLayer.features.length; i++) {
             if(vectorLayer.features[i]['attributes']['description'][1] == id){
                 feature = vectorLayer.features[i];
                 break;
             }
         }
        if (!feature) return;

        const errorReason = feature.attributes.description[2];
        const errorSteps = feature.attributes.description[3]; // AI steps

        let solutionHTML = "<button class='but_close' onclick='closeSolutionSlider()'>x</button>"; // Direct call
        solutionHTML += "<div class='markerContent'>";

        if (solutionType === 0) {
            solutionHTML += `<h2 class='soluttext_w'>${text['wrong_solut'] || 'Wrong!'}</h2>`;
            solutionHTML += `<b><p class='description'>${text['ai_reason'] || 'The AI chose the other solution because of the following reason:'}</p></b>`;
        } else {
            solutionHTML += `<h2 class='soluttext_r'>${text['correct_solut'] || 'Correct!'}</h2>`;
            solutionHTML += `<b><p class='description'>${text['your_reason'] || 'You chose the correct answer because:'}</p></b>`;
        }

        solutionHTML += errorReason;
        solutionHTML += `<b><p class='description'>${text['ai_steps'] || 'Steps made by the AI to classify this ads:'}</p></b>`;
        solutionHTML += errorSteps;
        solutionHTML += `<button class='but_next' onclick='nextAds(${id})'>${text['next_ad'] || 'Next'}</button>`; // Pass ID to nextAds
        solutionHTML += "</div>";

        sliderElement.innerHTML = solutionHTML;
        sliderElement.style.opacity = '1';
        sliderElement.style.marginLeft = 'calc(100% - 535px)'; // Ensure visible
        sliderElement.scrollTo(0, 0);

        // Make map non-interactive while solution is shown
        mapElement.style.pointerEvents = 'none';

        // Add temporary global functions for the inline onclick handlers
        window.closeSolutionSlider = closeSolutionSlider;
        window.nextAds = nextAds;
    }

    // Function called by the solution slider "X" button
    function closeSolutionSlider() {
        destroyPopup();
         // Restore map interaction ONLY IF the game is not over
         if (!game_over) {
            mapElement.style.pointerEvents = 'auto';
         }
    }

    // Show the following ad after closing the solution slider
    function nextAds(answeredId) {
        removeFeatureById(answeredId); // Remove the answered ad feature now
        closeSolutionSlider(); // Hide the solution slider

        if (vectorLayer.features.length > 0) {
            // Select a random remaining feature
            const index = Math.floor(Math.random() * vectorLayer.features.length);
            const nextFeature = vectorLayer.features[index];
            // Need a slight delay for popup creation after removal/slider close
            setTimeout(() => createPopup(nextFeature), 100); 
        } else {
            checkFinish(); // No more ads, check if game should end
        }
    }

    // Decrement the timer
    function tickTimer() {
        if (timer > 0 && !game_over) {
            timer -= 1;
            updateTimerDisplay();
        }
    }

    // Check if the game is finished
    function checkFinish() {
        if ((vectorLayer.features.length === 0 || timer <= 0) && game_over === 0) {
            finishtime = Date.now();
            game_over = 1;
            console.log("Game Over!");

            // Stop game intervals
            stopIntervals();

            // Calculate final stats
            let finalScore = currentscore;
            console.log("finalScore: " + finalScore);
            const totalAnswers = good_answers + wrong_answers;
            const accuracy = totalAnswers > 0 ? good_answers / totalAnswers : 0;
            const timetakenSeconds = initialTimerValue - timer;
            let timeTakenText = '';
            if (timetakenSeconds < 60) {
                timeTakenText = `${timetakenSeconds} ${text['seconds'] || 'seconds'}`;
            } else {
                timeTakenText = `${Math.round(timetakenSeconds / 60)} ${text['minutes'] || 'minutes'}`;
            }

            // Bonus for perfect score (adjust points as needed)
             if (good_answers === ads.length && wrong_answers === 0) { // Check against total ads loaded
                const bonusPoints = [50, 100, 150]; // Bonus based on difficulty
                finalScore += bonusPoints[level] || 50;
                console.log(`Perfect game bonus: +${bonusPoints[level] || 50}`);
             }

             currentscore = finalScore; // Update score with potential bonus

            // Update Game Over Popup
            showScoreElement.innerHTML = finalScore;
            showAccElement.innerHTML = `${Number((accuracy * 100).toFixed(1))}%`;
            showTimeElement.innerHTML = timeTakenText;

             // Start AI's turn visualization
            runAIPlay();

            popupElement.style.display = "block";
            mapElement.style.pointerEvents = 'none'; // Disable map interaction
            destroyPopup(); // Hide ad slider

        } else if (game_over === 1) {
             // If game is already over, check for timeout on username input
             const timeSinceFinish = Date.now() - finishtime;
             if (timeSinceFinish > 40000 && popupElement.style.display === "block") { // 40 seconds timeout
                 console.log("Username input timeout. Redirecting...");
                 window.location.href = quitButton.href; // Redirect using quit button's link
             }
         }
    }

    // --- Fake AI Logic ---
    function runAIPlay() {
        // Simulate AI playing through the *original* set of ads
        AI_currentscore = 0;
        AI_good_answers = 0;
        AI_wrong_answers = 0;
        let aiDelay = 250; // ms between AI actions

        for (let i = 0; i < ads.length; i++) {
            setTimeout(() => {
                const ad = ads[i];
                // Construct the array expected by checkAdLegality
                const adAttributesForCheck = [ad.description, ad.id, ad.error, ad.whereError];
                const isTrulyLegal = checkAdLegality(adAttributesForCheck); // Use the constructed array
                let pointsAwarded = 0;

                // Simulate AI making one mistake (e.g., on ad ID 14 if it exists)
                // Note: Ad IDs might not be sequential 0-14 in JSON
                const mistakeAdId = 14; // Example ID for mistake
                let makeMistake = (ad.id === mistakeAdId);

                if (makeMistake) {
                    if (isTrulyLegal) AI_wrong_answers += 1; else AI_good_answers += 1; pointsAwarded = isTrulyLegal ? 0 : 100;
                } else {
                    if (isTrulyLegal) AI_good_answers += 1; else AI_wrong_answers += 1; pointsAwarded = isTrulyLegal ? 100 : 0;
                }

                 // AI gets fixed points per correct answer, no time penalty
                if(pointsAwarded > 0) {
                     AI_currentscore += 100;
                }

                audioClick.play(); // Play AI sound

                // Update AI stats display after each simulated step
                updateAIDisplay();

            }, i * aiDelay);
        }

        // Final update after all timeouts complete
        setTimeout(updateAIDisplay, ads.length * aiDelay + 50);
    }

    function updateAIDisplay() {
        const totalAIAnswers = AI_good_answers + AI_wrong_answers;
        const aiAccuracy = totalAIAnswers > 0 ? AI_good_answers / totalAIAnswers : 0;
        showScoreAIElement.innerHTML = AI_currentscore;
        showAccAIElement.innerHTML = `${Number((aiAccuracy * 100).toFixed(1))}%`;
    }

    // --- Local Score Saving ---
    function saveScoreLocally() {
        const username = usernameInputElement.value.trim();
        if (username === "" || !isNaN(username)) {
            alert(text['invalid_username'] || "Please enter a valid (non-numeric) username.");
            return;
        }

        const scoreData = {
            pseudo: username,
            score: currentscore
        };

        let leaderboard = [];
        try {
            const storedScores = localStorage.getItem(SCORE_KEY);
            if (storedScores) {
                leaderboard = JSON.parse(storedScores);
            }
        } catch (e) {
            console.error("Error reading leaderboard from localStorage:", e);
            leaderboard = []; // Reset if data is corrupt
        }

        // Prevent duplicate entries for the same session (optional)
        // leaderboard = leaderboard.filter(entry => entry.pseudo !== username);

        leaderboard.push(scoreData);

        // Optional: Keep only top N scores
        leaderboard.sort((a, b) => b.score - a.score);
        // leaderboard = leaderboard.slice(0, 20); // Keep top 20 for example

        try {
            localStorage.setItem(SCORE_KEY, JSON.stringify(leaderboard));
            console.log("Score saved locally for:", username, "Score:", currentscore);
            // Redirect is handled by the <a> tag's href in the HTML
        } catch (e) {
            console.error("Error saving leaderboard to localStorage:", e);
            alert(text['save_error'] || "Could not save score.");
        }
    }

    // --- Timer Management ---
    let timerInterval;
    let checkFinishInterval;

    function setupTimer() {
        if (level === 1) { // Normal
            timer = 210; // 3.5 min
        } else if (level === 2) { // Hard
            timer = 150; // 2.5 min
        } else { // Easy (level 0 or default)
            timer = 300; // 5 min
        }
        initialTimerValue = timer; // Store the starting time
    }

    function startIntervals() {
        stopIntervals(); // Clear any existing intervals first
        timerInterval = setInterval(tickTimer, 1000);
        checkFinishInterval = setInterval(checkFinish, 500);
    }

    function stopIntervals() {
        clearInterval(timerInterval);
        clearInterval(checkFinishInterval);
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
         saveButton.addEventListener('click', (event) => {
             event.preventDefault(); // Prevent default link navigation
             saveScoreLocally();
             // Manually navigate after saving
             window.location.href = saveButton.href;
         });

         quitButton.addEventListener('click', () => {
             // Clear potentially sensitive game state before leaving
             localStorage.removeItem('gameState'); // If we were saving mid-game progress
             // Navigation is handled by the <a> tag's href
         });
    }

    // --- Start the game --- 
    initializeGame();

}); 