// --- CONFIGURATION ---
const OMDB_API_KEY = "7ee6529c"; 
const BASE_URL = "https://www.omdbapi.com/";

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: JSON.parse(localStorage.getItem('flixmix_queue')) || [],
    queueDate: localStorage.getItem('flixmix_date') || "",
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    const today = new Date().toDateString();
    
    if (state.pickedMovie) {
        showReviewScreen();
    } else if (state.dailyQueue.length > 0 && state.queueDate === today) {
        renderStack();
    } else {
        startDailyDiscovery();
    }
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

        const moviePromises = data.Search.slice(0, 10).map(m => 
            fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailed = await Promise.all(moviePromises);

        // Filter and save
        state.dailyQueue = detailed
            .filter(m => parseFloat(m.imdbRating) >= 7.0 && !state.history.includes(m.imdbID))
            .slice(0, 5);
        
        state.queueDate = new Date().toDateString();
        
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();
    } catch (err) {
        container.innerHTML = `<div class="error">Connection Error. <br> <small>${err.message}</small></div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = '<div class="loading">Daily limit reached! Come back tomorrow.</div>';
        return;
    }

    // We use a copy to render so that index 0 is at the bottom, last index on top
    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; // Last item has highest Z-index
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.Title} (${movie.Year})</h3>
                <p>⭐ IMDb: ${movie.imdbRating} | ${movie.Genre}</p>
            </div>
            <div class="card-actions">
                <button class="cross-btn">✖</button>
                <button class="check-btn">✔</button>
            </div>
        `;

        // Manual listeners to ensure correct movie reference
        card.querySelector('.cross-btn').onclick = () => handleSwipe(false);
        card.querySelector('.check-btn').onclick = () => handleSwipe(true);
        
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
        // pop() gets the item that was visually on top
        const movie = state.dailyQueue.pop(); 
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('flixmix_picked', JSON.stringify(movie));
            showReviewScreen();
        } else {
            updateHistory(movie.imdbID);
            renderStack(); // Just re-render what's left
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
    
    // Reset star inputs for new review
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
}

function submitReview() {
    if (state.pickedMovie) {
        updateHistory(state.pickedMovie.imdbID);
        state.pickedMovie = null;
        localStorage.removeItem('flixmix_picked');
    }

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack();
}

// --- PWA Logic ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}

function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg.waiting) reg.waiting.postMessage({ action: 'skipWaiting' });
        window.location.reload();
    });
}
