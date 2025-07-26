class MapHandler {
    constructor(coordinates, airportHandler) {
        this.coordinates = coordinates;
        this.airportHandler = airportHandler;
        this.currentState = 'fire'; // 'fire' or 'base'
        this.map = null;
        this.fireMarker = null;
        this.baseMarker = null;
        this.pathLine = null;
        this.airportMarkers = [];
        
        this.fireIcon = L.divIcon({
            html: '<span class="material-icons" style="color: #f44336; font-size: 24px;">local_fire_department</span>',
            className: 'fire-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        this.baseIcon = L.divIcon({
            html: '<span class="material-icons" style="color: #2196f3; font-size: 24px;">home</span>',
            className: 'base-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        this.initMap();
        this.loadSavedLocations();
    }

    initMap() {
        this.map = L.map('map').setView([32.0, 34.8], 8);
        
        // Add offline-compatible tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add click handler
        this.map.on('click', (e) => this.handleMapClick(e));
    }

    loadSavedLocations() {
        const fireLocation = this.coordinates.loadSavedLocation('fire');
        const baseLocation = this.coordinates.loadSavedLocation('base');

        if (fireLocation) {
            this.setFireLocation(fireLocation.lat, fireLocation.lng);
        }
        if (baseLocation) {
            this.setBaseLocation(baseLocation.lat, baseLocation.lng);
        }

        if (fireLocation && baseLocation) {
            this.updatePath();
            this.fitBounds();
        }
    }

    handleMapClick(e) {
        const { lat, lng } = e.latlng;
        
        if (this.currentState === 'fire') {
            this.setFireLocation(lat, lng);
        } else if (this.currentState === 'base') {
            this.setBaseLocation(lat, lng);
        }

        // Save location
        this.coordinates.saveLocation(this.currentState, { lat, lng });
        
        // Update path if both locations are set
        if (this.fireMarker && this.baseMarker) {
            this.updatePath();
        }

        // Trigger custom event for UI updates
        const event = new CustomEvent('locationUpdated', {
            detail: { type: this.currentState, lat, lng }
        });
        window.dispatchEvent(event);
    }

    setFireLocation(lat, lng) {
        if (this.fireMarker) {
            this.fireMarker.setLatLng([lat, lng]);
        } else {
            this.fireMarker = L.marker([lat, lng], { icon: this.fireIcon }).addTo(this.map);
        }
    }

    setBaseLocation(lat, lng) {
        if (this.baseMarker) {
            this.baseMarker.setLatLng([lat, lng]);
        } else {
            this.baseMarker = L.marker([lat, lng], { icon: this.baseIcon }).addTo(this.map);
        }
    }

    async updatePath() {
        if (!this.fireMarker || !this.baseMarker) return;

        const fireLoc = this.fireMarker.getLatLng();
        const baseLoc = this.baseMarker.getLatLng();
        
        // Update nearby airports
        await this.updateNearbyAirports(fireLoc.lat, fireLoc.lng);

        if (this.pathLine) {
            this.pathLine.setLatLngs([baseLoc, fireLoc]);
        } else {
            this.pathLine = L.polyline([baseLoc, fireLoc], {
                color: '#2196f3',
                weight: 2,
                opacity: 0.8,
                dashArray: '5, 10'
            }).addTo(this.map);
        }

        // Calculate and update navigation info
        const distance = this.coordinates.calculateDistance(
            baseLoc.lat, baseLoc.lng,
            fireLoc.lat, fireLoc.lng
        );
        const track = this.coordinates.calculateMagneticTrack(
            baseLoc.lat, baseLoc.lng,
            fireLoc.lat, fireLoc.lng
        );
        const flightTime = this.coordinates.calculateFlightTime(distance);

        // Update UI elements
        document.getElementById('distance').textContent = distance.toFixed(1);
        document.getElementById('track').textContent = Math.round(track);
        document.getElementById('flightTime').textContent = flightTime;
    }

    fitBounds() {
        if (this.fireMarker && this.baseMarker) {
            const bounds = L.latLngBounds(
                this.fireMarker.getLatLng(),
                this.baseMarker.getLatLng()
            );
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    setState(state) {
        this.currentState = state;
    }

    getState() {
        return this.currentState;
    }

    async updateNearbyAirports(lat, lng) {
        // Clear existing airport markers
        this.airportMarkers.forEach(marker => marker.remove());
        this.airportMarkers = [];

        // Find nearby airports
        const nearbyAirports = this.airportHandler.findNearbyAirports(lat, lng);

        // Create markers for each airport
        for (const airport of nearbyAirports) {
            // Create initial airport icon with loading state
            let markerColor = '#757575'; // Gray for loading
            let weatherStatus = null;
            let weatherError = null;
            
            const createIcon = (color) => L.divIcon({
                html: `<span class="material-icons" style="color: ${color}; font-size: 20px;">local_airport</span>`,
                className: 'airport-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const marker = L.marker([airport.location.lat, airport.location.lng], {
                icon: createIcon(markerColor)
            }).addTo(this.map);
            
            // Create initial popup content
            let popupContent = `
                <div class="airport-popup">
                    <h3>${airport.name}</h3>
                    <p>${airport.codes.icao || airport.codes.iata || airport.codes.local}</p>
                    <p>${airport.location.municipality}, ${airport.location.country}</p>
                    <p>Distance: ${airport.distance.toFixed(1)}nm</p>
            `;
            
            // Update weather status if we have ICAO code and auth
            if (airport.codes.icao && window.autoRouterClient.isAuthenticated()) {
                popupContent += `
                    <div class="weather-status">
                        <p>Loading weather data...</p>
                    </div>
                `;
                
                // Create popup with loading state
                marker.bindPopup(popupContent);
                
                // Fetch weather data
                try {
                    const weather = await window.autoRouterClient.getWeather(airport.codes.icao);
                    weatherStatus = window.autoRouterClient.parseWeatherStatus(weather.metar);
                    
                    // Update marker color
                    markerColor = weatherStatus && weatherStatus.isRed ? '#f44336' : '#4CAF50';
                    marker.setIcon(createIcon(markerColor));
                    
                    // Update popup content
                    if (weatherStatus && weatherStatus.reason.length > 0) {
                        popupContent = popupContent.replace(
                            '<div class="weather-status">\n                        <p>Loading weather data...</p>',
                            `<div class="weather-warning">\n                        <p><strong>Weather Warnings:</strong></p>\n                        <ul>\n                            ${weatherStatus.reason.map(r => `<li>${r}</li>`).join('')}`
                        );
                    } else {
                        popupContent = popupContent.replace(
                            '<div class="weather-status">\n                        <p>Loading weather data...</p>',
                            `<div class="weather-status">\n                        <p>Weather conditions normal</p>`
                        );
                    }
                } catch (error) {
                    console.error(`Failed to get weather for ${airport.codes.icao}:`, error);
                    weatherError = error;
                    
                    // Update popup with error
                    popupContent = popupContent.replace(
                        '<div class="weather-status">\n                        <p>Loading weather data...</p>',
                        `<div class="weather-error">\n                        <p>Failed to load weather data</p>`
                    );
                }
            } else if (!window.autoRouterClient.isAuthenticated()) {
                popupContent += `
                    <div class="weather-error">
                        <p>Weather data unavailable. Please configure AutoRouter API in settings.</p>
                    </div>
                `;
            }
            
            // Update popup content
            marker.bindPopup(popupContent);
            
            this.airportMarkers.push(marker);


        }
    }
}

// Export for use in other modules
window.MapHandler = MapHandler;
