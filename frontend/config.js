// Configuration for different environments
const config = {
    // Backend API URL - Update this after deploying backend to Render
    BACKEND_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:4000'
        : 'https://sif-boundou-api.onrender.com', // ⚠️ UPDATE THIS WITH YOUR RENDER URL

    // Map settings
    MAP_CENTER: [-13.669070, 13.732617],
    MAP_ZOOM: 15,
    MAP_PITCH: 45,
    MAP_BEARING: -17.6
};

// Make config available globally
window.APP_CONFIG = config;
