// --- CONFIGURATION ---
const TMDB_TOKEN = "YOUR_TMDB_READ_ACCESS_TOKEN"; 

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: [],
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    if (state.pickedMovie) {
        showReviewScreen();
    } else {
        startDailyDiscovery();
    }
});

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.title}?`;
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    document.getElementById('update-banner').classList.add('show');
                }
            };
        };
    });
}

function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        reg.waiting.postMessage({ action: 'skipWaiting' });
    });
}
