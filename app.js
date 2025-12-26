// --- CONFIGURATION ---
const OMDB_API_KEY = "7ee6529c"; 
const BASE_URL = "https://www.omdbapi.com/"; // Fixed URL

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: [],
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    state.pickedMovie ? showReviewScreen() : startDailyDiscovery();
});

// --- FETCHING LOGIC ---
async function startDailyDiscovery() {
    const container = document.getElementById('card-container');
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life", "Action", "Night"];
    const query = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        const res = await fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`);
        const data = await res.json();

        if (data.Response === "False") throw new Error(data.Error);

        // Fetch details & filter in one pipeline
        const moviePromises = data.Search.slice(0, 8).map(m => 
            fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailed = await Promise.all(moviePromises);

        state.dailyQueue = detailed
            .filter(m => parseFloat(m.imdbRating) >= 7.0 && !state.history.includes(m.imdbID))
            .slice(0, 5);

        renderStack();
    } catch (err) {
        container.innerHTML = `<div class="error">Limit reached or Connection Error. <br> <small>${err.message}</small></div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = '<div class="loading">Refining search...</div>';
        startDailyDiscovery(); 
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = state.dailyQueue.length - index;
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.Title} (${movie.Year})</h3>
                <p>⭐ IMDb: ${movie.imdbRating} | ${movie.Genre}</p>
            </div>
            <div class="card-actions">
                <button onclick="handleSwipe(false)">✖</button>
                <button onclick="handleSwipe(true)">✔</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- INTERACTION LOGIC ---
function handleSwipe(isMatch) {
    const cards = document.getElementsByClassName('movie-card');
    if (cards.length === 0) return;

    const topCard = cards[cards.length - 1];
    topCard.classList.add(isMatch ? 'swipe-right-anim' : 'swipe-left-anim');

    topCard.addEventListener('animationend', () => {
        const movie = state.dailyQueue.pop(); 

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('flixmix_picked', JSON.stringify(movie));
            showReviewScreen();
        } else {
            updateHistory(movie.imdbID);
            state.dailyQueue.length === 0 ? startDailyDiscovery() : renderStack();
        }
    }, { once: true });
}

function updateHistory(id) {
    if (!state.history.includes(id)) {
        state.history.push(id);
        localStorage.setItem('flixmix_history', JSON.stringify(state.history));
    }
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
}

function submitReview() {
    updateHistory(state.pickedMovie.imdbID);
    state.pickedMovie = null;
    localStorage.removeItem('flixmix_picked');

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    startDailyDiscovery();
}

// --- PWA REGISTRATION ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}
