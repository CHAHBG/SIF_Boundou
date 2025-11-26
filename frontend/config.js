// Configuration for different environments
const config = {
    // Backend API URL - Update this after deploying backend to Render
    BACKEND_URL: (() => {
        const hostname = window.location.hostname;

        // Local development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:4000';
        }

        // Production - Netlify
        if (hostname.includes('netlify.app') || hostname.includes('sifboundou')) {
            return 'https://sif-boundou.onrender.com';
        }

        // Fallback to production
        return 'https://sif-boundou.onrender.com';
    })(),

    // Map settings
    MAP_CENTER: [-12.315, 13.730], // Centered between Bakel and Kedougou
    MAP_ZOOM: 8.5,
    MAP_PITCH: 45,
    MAP_BEARING: -17.6,

    // Performance settings
    TILE_CACHE_TIME: 3600, // 1 hour in seconds
    SEARCH_DEBOUNCE: 400, // milliseconds
    CLICK_DEBOUNCE: 500, // milliseconds
    FETCH_TIMEOUT: 10000, // 10 seconds
    FETCH_RETRIES: 3,

    // Google Maps API Key - IMPORTANT: Replace with your own key
    // For production, use environment variables or a backend proxy
    GOOGLE_MAPS_API_KEY: 'AIzaSyAjEKwaoCI7XuVrgQdvBqOdJOgEc94Xezc' // TODO: Replace this!
};

// Make config available globally
window.APP_CONFIG = config;
