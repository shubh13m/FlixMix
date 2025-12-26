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

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = function() {
            this.classList.toggle('active');
            this.innerText = this.classList.contains('active') ? "Yes" : "No";
        };
    });

    // LISTEN FOR SERVICE WORKER UPDATES
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload(); // This ensures the app reloads when the new SW takes over
    });

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
    container.innerHTML = '<div class="loading">Curating your mix...</div>';
    
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life", "Action", "Night", "Story"];
    const query = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        const res = await fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        if (data.Response === "False") throw new Error(data.Error);

        const moviePromises = data.Search.slice(0, 10).map(m => 
            fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailed = await Promise.all(moviePromises);

        state.dailyQueue = detailed
            .filter(m => {
                const rating = parseFloat(m.imdbRating);
                const isNew = !state.history.some(h => h.id === m.imdbID);
                return !isNaN(rating) && rating >= 7.0 && isNew;
            })
            .slice(0, 5);
        
        if (state.dailyQueue.length === 0) state.dailyQueue = detailed.slice(0, 5);
        
        state.queueDate = new Date().toDateString();
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();
    } catch (err) {
        container.innerHTML = `<div class="error"><p>Error loading movies</p></div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = `<div class="loading"><h3>All caught up!</h3></div>`;
        return;
    }

    // We render the queue. The last item in the array will be the "top" card.
    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; // Higher index = on top
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.Title}</h3>
                <p>⭐ ${movie.imdbRating} | ${movie.Genre}</p>
            </div>
            <div class="card-actions">
                <button class="cross-btn" onclick="handleSwipe(false)">✖</button>
                <button class="check-btn" onclick="handleSwipe(true)">✔</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- INTERACTION LOGIC ---
function handleSwipe(isMatch) {
    const cards = document.querySelectorAll('.movie-card');
    if (cards.length === 0) return;

    // The visually "top" card is the one with the highest z-index (the last one in DOM)
    const topCard = cards[cards.length - 1];
    topCard.classList.add(isMatch ? 'swipe-right-anim' : 'swipe-left-anim');

    topCard.addEventListener('animationend', () => {
        // ALWAYS remove the last item from state to match the top card
        const movie = state.dailyQueue.pop(); 
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('flixmix_picked', JSON.stringify(movie));
            showReviewScreen();
        } else {
            updateHistory(movie.imdbID, { id: movie.imdbID, title: movie.Title, skipped: true });
            renderStack(); // Redraw remaining cards
        }
    }, { once: true });
}

// --- PWA / UPDATE LOGIC ---
function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
            reg.waiting.postMessage({ action: 'skipWaiting' });
            // The controllerchange listener at the top will handle the reload
        } else {
            window.location.reload();
        }
    });
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
    
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.innerText = "No";
    });
}

function submitReview() {
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) return alert("Please select a star rating!");

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: parseInt(ratingInput.value),
        familyFriendly: document.getElementById('btn-family').classList.contains('active'),
        repeatWatch: document.getElementById('btn-repeat').classList.contains('active'),
        date: new Date().toLocaleDateString()
    };

    updateHistory(state.pickedMovie.imdbID, reviewData);
    state.pickedMovie = null;
    localStorage.removeItem('flixmix_picked');

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack();
}

function updateHistory(id, data) {
    state.history = state.history.filter(h => h.id !== id);
    state.history.push(data);
    localStorage.setItem('flixmix_history', JSON.stringify(state.history));
}

function toggleHistory(show) {
    const historySection = document.getElementById('history-view');
    if (show) { renderHistory(); historySection.classList.remove('hidden'); }
    else { historySection.classList.add('hidden'); }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    const reviews = state.history.filter(h => h.userRating);
    if (reviews.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">No reviews yet.</p>';
        return;
    }
    [...reviews].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info"><h4>${item.title}</h4><p>${item.date}</p></div>
            <div class="history-badge">${'★'.repeat(item.userRating)}</div>
        `;
        list.appendChild(div);
    });
}
