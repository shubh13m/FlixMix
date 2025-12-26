// --- CONFIGURATION ---
const OMDB_API_KEY = "7ee6529c"; // Your new key from the email

// --- REPLACED FETCH LOGIC ---
async function startDailyDiscovery() {
    const container = document.getElementById('card-container');
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life"];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        // 1. Search for a list of movies using a keyword
        const searchResponse = await fetch(`https://www.omdbapi.org/?s=${randomKeyword}&type=movie&apikey=${OMDB_API_KEY}`);
        const searchData = await searchResponse.json();

        if (searchData.Response === "False") throw new Error(searchData.Error);

        // 2. OMDb search results only give basic info. 
        // We need to fetch full details for the first 5-8 to get the ratings.
        const moviePromises = searchData.Search.slice(0, 8).map(m => 
            fetch(`https://www.omdbapi.org/?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(res => res.json())
        );

        const detailedMovies = await Promise.all(moviePromises);

        // 3. Filter for movies with high IMDb ratings (7.0+) and check history
        state.dailyQueue = detailedMovies
            .filter(m => parseFloat(m.imdbRating) >= 7.0 && !state.history.some(h => h.imdbID === m.imdbID))
            .slice(0, 5);

        renderStack();

    } catch (error) {
        console.error("OMDb Error:", error);
        container.innerHTML = `<div class="error">Error: ${error.message}. Please try refreshing.</div>`;
    }
}

function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = '<div class="error">No top-rated movies found in this batch. Refreshing...</div>';
        setTimeout(startDailyDiscovery, 2000);
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = state.dailyQueue.length - index;
        
        // Handle missing posters
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}">
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
