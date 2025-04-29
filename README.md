# FARI: Animal Well-being Demo (Static Client-Side Version)

This directory contains a purely client-side version of the FARI Animal Well-being demo game.
It has been converted from the original Flask application to run directly in a web browser without a Python backend.

## How to Run

Simply open the `index.html` file in your web browser.

Alternatively, deploy the entire contents of this `static_app` directory to any static web hosting service (like Netlify, Vercel, GitHub Pages, etc.).

## Key Differences from Flask Version

*   **No Server Required:** Runs entirely in the browser.
*   **Local Storage:** Game settings (language, difficulty) and leaderboard scores are stored in the browser's `localStorage`.
*   **Leaderboard:** The leaderboard is local to each user's browser. Scores are not shared globally.
*   **Data Loading:** Game data (ads, text translations) is loaded directly from the JSON files in the `data/` directory using JavaScript's `fetch` API.

## Development Note

The `js/play.js` file contains a placeholder function `checkAdLegality`. For the game logic to be fully accurate according to the rules, this function needs to be implemented to perform the necessary checks on ad descriptions, HK numbers, locations, etc., based on the rules outlined on the rules page. 