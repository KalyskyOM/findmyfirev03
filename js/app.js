// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize core components
    const coordinates = new Coordinates();
    const airportHandler = new AirportDataHandler();
    
    // Load airport data
    await airportHandler.loadData();
    
    // Initialize map with both handlers
    window.mapHandler = new MapHandler(coordinates, airportHandler);
    const ui = new UIHandler(coordinates, airportHandler);

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.error('ServiceWorker registration failed:', err);
            });
    }
});
