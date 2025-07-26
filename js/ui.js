class UIHandler {
    constructor(coordinates, airportHandler) {
        this.coordinates = coordinates;
        this.airportHandler = airportHandler;
        this.menuOpen = false;
        this.settingsOpen = false;
        this.initializeUI();
        this.setupEventListeners();
        this.checkLocationPermission();
        this.loadApiKey();
    }

    initializeUI() {
        // Initialize format buttons
        const formatBtns = document.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === this.coordinates.currentFormat);
        });

        // Initialize state buttons
        this.updateStateButtons('fire');

        // Create coordinate inputs based on current format
        this.createCoordinateInputs();

        // Initially hide location button since we start in fire mode
        const locationBtn = document.getElementById('locationBtn');
        locationBtn.style.display = 'none';
    }

    setupEventListeners() {
        // Menu trigger
        const menuTrigger = document.getElementById('menuTrigger');
        menuTrigger.addEventListener('click', () => this.toggleMenu());

        // Quick input parsing
        const quickInputText = document.getElementById('quickInputText');
        const parseBtn = document.getElementById('parseBtn');

        parseBtn.addEventListener('click', () => {
            const inputText = quickInputText.value.trim();
            if (!inputText) {
                this.showError('Please enter coordinates to parse');
                return;
            }

            const parseResult = this.coordinates.parseCoordinateString(inputText);
            if (parseResult.success) {
                // Update format to match parsed format
                this.currentFormat = parseResult.detectedFormat.toUpperCase();
                localStorage.setItem('fmf-format', this.currentFormat);

                // Update UI
                const formatBtns = document.querySelectorAll('.format-btn');
                formatBtns.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.format === this.currentFormat);
                });

                // Set coordinate values
                this.coordinates.lat = parseResult.data.lat;
                this.coordinates.lng = parseResult.data.lng;

                // Rebuild inputs and update display
                this.rebuildInputs();
                this.updatePreview();
                this.showSuccess(`Coordinates parsed successfully as ${parseResult.detectedFormat.toUpperCase()} format`);
                quickInputText.value = '';
            } else {
                this.showError(parseResult.error);
            }
        });

        quickInputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                parseBtn.click();
            }
        });

        // Format selector
        const formatBtns = document.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                formatBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFormat = btn.dataset.format;
                localStorage.setItem('fmf-format', this.currentFormat);
                this.rebuildInputs();
            });
        });

        // Format buttons
        formatBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleFormatChange(btn.dataset.format));
        });

        // State buttons
        const stateBtns = document.querySelectorAll('.state-btn');
        stateBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleStateChange(btn.dataset.state));
        });

        // Utility buttons
        document.getElementById('locationBtn').addEventListener('click', () => this.getCurrentLocation());
        document.getElementById('validateBtn').addEventListener('click', () => this.validateCoordinates());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyCoordinates());

        // Listen for location updates from map
        window.addEventListener('locationUpdated', (e) => this.handleLocationUpdate(e.detail));

        // Airport search
        const airportSearchInput = document.getElementById('airportSearchInput');
        airportSearchInput.addEventListener('input', (e) => this.handleAirportSearch(e));
        
        // Close airport results when clicking outside
        document.addEventListener('click', (e) => {
            const airportResults = document.getElementById('airportResults');
            if (!e.target.closest('.airport-search')) {
                airportResults.classList.remove('show');
            }
        });

        // Settings panel
        document.getElementById('settingsTrigger').addEventListener('click', () => this.toggleSettings());
        document.querySelector('.close-settings-btn').addEventListener('click', () => this.toggleSettings());
        document.getElementById('requestLocationBtn').addEventListener('click', () => this.requestLocationPermission());
        document.getElementById('saveApiKeyBtn').addEventListener('click', () => this.saveApiKey());
    }

    toggleMenu() {
        const sideMenu = document.querySelector('.side-menu');
        const menuIcon = document.querySelector('#menuTrigger .material-icons');
        
        this.menuOpen = !this.menuOpen;
        sideMenu.classList.toggle('open', this.menuOpen);
        menuIcon.textContent = this.menuOpen ? 'close' : 'menu';

        // Prevent scrolling on body when menu is open
        document.body.style.overflow = this.menuOpen ? 'hidden' : '';
    }

    handleFormatChange(format) {
        this.coordinates.currentFormat = format;
        localStorage.setItem('fmf-format', format);

        // Update UI
        const formatBtns = document.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === format);
        });

        // Recreate coordinate inputs
        this.createCoordinateInputs();
    }

    handleStateChange(state) {
        window.mapHandler.setState(state);
        this.updateStateButtons(state);
        
        // Show/hide location button based on state
        const locationBtn = document.getElementById('locationBtn');
        locationBtn.style.display = state === 'base' ? 'flex' : 'none';
    }

    updateStateButtons(activeState) {
        const stateBtns = document.querySelectorAll('.state-btn');
        stateBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.state === activeState);
        });
    }

    createCoordinateInputs() {
        const container = document.getElementById('coordinateInputs');
        container.innerHTML = '';
        container.className = `${this.coordinates.currentFormat}-only`;

        // Create latitude input row
        const latRow = this.createCoordinateRow('Lat', true);
        container.appendChild(latRow);

        // Create longitude input row
        const lngRow = this.createCoordinateRow('Lng', false);
        container.appendChild(lngRow);
    }

    createCoordinateRow(label, isLatitude) {
        const row = document.createElement('div');
        row.className = 'coordinate-row';

        const labelEl = document.createElement('div');
        labelEl.className = 'coord-label';
        labelEl.textContent = label;
        row.appendChild(labelEl);

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';

        switch(this.coordinates.currentFormat) {
            case 'dd':
                this.createDDInputs(inputGroup, isLatitude);
                break;
            case 'ddm':
                this.createDDMInputs(inputGroup, isLatitude);
                break;
            case 'dms':
                this.createDMSInputs(inputGroup, isLatitude);
                break;
        }

        row.appendChild(inputGroup);
        return row;
    }

    createDDInputs(container, isLatitude) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'coord-input degrees';
        input.step = '0.000001';
        input.placeholder = '0.0';
        container.appendChild(input);

        const symbol = document.createElement('span');
        symbol.className = 'coord-symbol degrees';
        symbol.textContent = '°';
        container.appendChild(symbol);

        const direction = document.createElement('select');
        direction.className = 'coord-input direction';
        const options = isLatitude ? ['N', 'S'] : ['E', 'W'];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            direction.appendChild(option);
        });
        container.appendChild(direction);
    }

    createDDMInputs(container, isLatitude) {
        // Degrees
        const degInput = document.createElement('input');
        degInput.type = 'number';
        degInput.className = 'coord-input degrees';
        degInput.placeholder = '0';
        container.appendChild(degInput);

        const degSymbol = document.createElement('span');
        degSymbol.className = 'coord-symbol degrees';
        degSymbol.textContent = '°';
        container.appendChild(degSymbol);

        // Minutes
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'coord-input minutes';
        minInput.step = '0.0001';
        minInput.placeholder = '0.0';
        container.appendChild(minInput);

        const minSymbol = document.createElement('span');
        minSymbol.className = 'coord-symbol minutes';
        minSymbol.textContent = "'";
        container.appendChild(minSymbol);

        // Direction
        const direction = document.createElement('select');
        direction.className = 'coord-input direction';
        const options = isLatitude ? ['N', 'S'] : ['E', 'W'];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            direction.appendChild(option);
        });
        container.appendChild(direction);
    }

    createDMSInputs(container, isLatitude) {
        // Degrees
        const degInput = document.createElement('input');
        degInput.type = 'number';
        degInput.className = 'coord-input degrees';
        degInput.placeholder = '0';
        container.appendChild(degInput);

        const degSymbol = document.createElement('span');
        degSymbol.className = 'coord-symbol degrees';
        degSymbol.textContent = '°';
        container.appendChild(degSymbol);

        // Minutes
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'coord-input minutes';
        minInput.placeholder = '0';
        container.appendChild(minInput);

        const minSymbol = document.createElement('span');
        minSymbol.className = 'coord-symbol minutes';
        minSymbol.textContent = "'";
        container.appendChild(minSymbol);

        // Seconds
        const secInput = document.createElement('input');
        secInput.type = 'number';
        secInput.className = 'coord-input seconds';
        secInput.step = '0.0001';
        secInput.placeholder = '0.0';
        container.appendChild(secInput);

        const secSymbol = document.createElement('span');
        secSymbol.className = 'coord-symbol seconds';
        secSymbol.textContent = '"';
        container.appendChild(secSymbol);

        // Direction
        const direction = document.createElement('select');
        direction.className = 'coord-input direction';
        const options = isLatitude ? ['N', 'S'] : ['E', 'W'];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            direction.appendChild(option);
        });
        container.appendChild(direction);
    }

    validateCoordinates() {
        const format = this.coordinates.currentFormat;
        const state = window.mapHandler.getState();
        let isValid = true;
        let message = '';

        // Get all input fields for the current format
        const inputs = document.querySelectorAll(`#coordinateInputs .${format}-input`);
        const values = {};

        // Collect all input values
        inputs.forEach(input => {
            const name = input.name;
            values[name] = parseFloat(input.value);
        });

        // Validate based on format
        switch (format) {
            case 'dd':
                // Validate latitude (-90 to 90)
                if (isNaN(values.lat) || values.lat < -90 || values.lat > 90) {
                    isValid = false;
                    message = 'Latitude must be between -90° and 90°';
                }
                // Validate longitude (-180 to 180)
                else if (isNaN(values.lng) || values.lng < -180 || values.lng > 180) {
                    isValid = false;
                    message = 'Longitude must be between -180° and 180°';
                }
                break;

            case 'ddm':
                // Validate latitude degrees (-90 to 90)
                if (isNaN(values.latDeg) || values.latDeg < -90 || values.latDeg > 90) {
                    isValid = false;
                    message = 'Latitude degrees must be between -90° and 90°';
                }
                // Validate latitude minutes (0 to 59.999...)
                else if (isNaN(values.latMin) || values.latMin < 0 || values.latMin >= 60) {
                    isValid = false;
                    message = 'Latitude minutes must be between 0 and 59.999';
                }
                // Validate longitude degrees (-180 to 180)
                else if (isNaN(values.lngDeg) || values.lngDeg < -180 || values.lngDeg > 180) {
                    isValid = false;
                    message = 'Longitude degrees must be between -180° and 180°';
                }
                // Validate longitude minutes (0 to 59.999...)
                else if (isNaN(values.lngMin) || values.lngMin < 0 || values.lngMin >= 60) {
                    isValid = false;
                    message = 'Longitude minutes must be between 0 and 59.999';
                }
                break;

            case 'dms':
                // Validate latitude degrees (-90 to 90)
                if (isNaN(values.latDeg) || values.latDeg < -90 || values.latDeg > 90) {
                    isValid = false;
                    message = 'Latitude degrees must be between -90° and 90°';
                }
                // Validate latitude minutes (0 to 59)
                else if (isNaN(values.latMin) || values.latMin < 0 || values.latMin >= 60) {
                    isValid = false;
                    message = 'Latitude minutes must be between 0 and 59';
                }
                // Validate latitude seconds (0 to 59.999...)
                else if (isNaN(values.latSec) || values.latSec < 0 || values.latSec >= 60) {
                    isValid = false;
                    message = 'Latitude seconds must be between 0 and 59.999';
                }
                // Validate longitude degrees (-180 to 180)
                else if (isNaN(values.lngDeg) || values.lngDeg < -180 || values.lngDeg > 180) {
                    isValid = false;
                    message = 'Longitude degrees must be between -180° and 180°';
                }
                // Validate longitude minutes (0 to 59)
                else if (isNaN(values.lngMin) || values.lngMin < 0 || values.lngMin >= 60) {
                    isValid = false;
                    message = 'Longitude minutes must be between 0 and 59';
                }
                // Validate longitude seconds (0 to 59.999...)
                else if (isNaN(values.lngSec) || values.lngSec < 0 || values.lngSec >= 60) {
                    isValid = false;
                    message = 'Longitude seconds must be between 0 and 59.999';
                }
                break;
        }

        // Show validation result
        if (isValid) {
            // Convert to decimal degrees if needed
            let lat, lng;
            if (format === 'dd') {
                lat = values.lat;
                lng = values.lng;
            } else if (format === 'ddm') {
                lat = this.coordinates.DMSToDecimal({ degrees: values.latDeg, minutes: values.latMin, seconds: 0, direction: values.latDeg >= 0 ? 'N' : 'S' }, true);
                lng = this.coordinates.DMSToDecimal({ degrees: Math.abs(values.lngDeg), minutes: values.lngMin, seconds: 0, direction: values.lngDeg >= 0 ? 'E' : 'W' }, false);
            } else { // dms
                lat = this.coordinates.DMSToDecimal({ degrees: Math.abs(values.latDeg), minutes: values.latMin, seconds: values.latSec, direction: values.latDeg >= 0 ? 'N' : 'S' }, true);
                lng = this.coordinates.DMSToDecimal({ degrees: Math.abs(values.lngDeg), minutes: values.lngMin, seconds: values.lngSec, direction: values.lngDeg >= 0 ? 'E' : 'W' }, false);
            }

            // Save and update map
            this.coordinates.saveLocation(state, { lat, lng });
            if (state === 'fire') {
                window.mapHandler.setFireLocation(lat, lng);
            } else {
                window.mapHandler.setBaseLocation(lat, lng);
            }

            // Show success message
            const preview = document.getElementById('coordinatePreview');
            preview.classList.add('valid');
            setTimeout(() => preview.classList.remove('valid'), 2000);
        } else {
            // Show error message
            const preview = document.getElementById('coordinatePreview');
            preview.textContent = message;
            preview.classList.add('invalid');
            setTimeout(() => {
                preview.classList.remove('invalid');
                this.updatePreview();
            }, 3000);
        }
    }

    handleStateChange(state) {
        window.mapHandler.setState(state);
        this.updateStateButtons(state);
        
        // Show/hide location button based on state
        const locationBtn = document.getElementById('locationBtn');
        locationBtn.style.display = state === 'base' ? 'flex' : 'none';
    }

    getCurrentLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const state = window.mapHandler.getState();
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;

                    // Update map
                    if (state === 'fire') {
                        window.mapHandler.setFireLocation(latitude, longitude);
                    } else if (state === 'base') {
                        window.mapHandler.setBaseLocation(latitude, longitude);
                    }

                    // Save location
                    this.coordinates.saveLocation(state, { lat: latitude, lng: longitude });

                    // Update UI
                    this.handleLocationUpdate({ type: state, lat: latitude, lng: longitude });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Could not get your location. Please check your permissions.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser');
        }
    }

    handleLocationUpdate(detail) {
        const { type, lat, lng } = detail;
        
        // Update coordinate inputs
        const container = document.getElementById('coordinateInputs');
        const rows = container.querySelectorAll('.coordinate-row');
        
        const latRow = rows[0];
        const lngRow = rows[1];

        if (type === window.mapHandler.getState()) {
            this.updateCoordinateInputs(type === 'fire' ? latRow : lngRow, lat, true);
            this.updateCoordinateInputs(type === 'fire' ? lngRow : latRow, lng, false);
        }

        // Update preview
        this.updatePreview();
    }

    updateCoordinateInputs(row, value, isLatitude) {
        const inputs = row.querySelectorAll('.coord-input');
        const dms = this.coordinates.decimalToDMS(value, isLatitude);

        switch(this.coordinates.currentFormat) {
            case 'dd':
                inputs[0].value = Math.abs(value);
                inputs[1].value = dms.direction;
                break;
            case 'ddm':
                inputs[0].value = dms.degrees;
                inputs[1].value = (dms.minutes + (dms.seconds / 60)).toFixed(4);
                inputs[2].value = dms.direction;
                break;
            case 'dms':
                inputs[0].value = dms.degrees;
                inputs[1].value = dms.minutes;
                inputs[2].value = dms.seconds.toFixed(4);
                inputs[3].value = dms.direction;
                break;
        }
    }

    updatePreview() {
        const preview = document.getElementById('coordinatePreview');
        const state = window.mapHandler.getState();
        const location = this.coordinates.loadSavedLocation(state);
        
        if (location) {
            const { lat, lng } = location;
            preview.textContent = `${this.coordinates.formatCoordinate(lat, true)} ${this.coordinates.formatCoordinate(lng, false)}`;
        } else {
            preview.textContent = '--';
        }
    }

    toggleSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        this.settingsOpen = !this.settingsOpen;
        settingsPanel.classList.toggle('show', this.settingsOpen);

        // Close menu if open
        if (this.settingsOpen && this.menuOpen) {
            this.toggleMenu();
        }

        // Update body scroll
        document.body.style.overflow = this.settingsOpen ? 'hidden' : '';
    }

    async checkLocationPermission() {
        const statusEl = document.getElementById('locationStatus');
        const requestBtn = document.getElementById('requestLocationBtn');

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            statusEl.textContent = result.state === 'granted' ? 'Granted' : 'Not granted';
            statusEl.className = `setting-status ${result.state === 'granted' ? 'granted' : 'denied'}`;
            requestBtn.style.display = result.state === 'granted' ? 'none' : 'block';

            // Listen for changes
            result.addEventListener('change', () => {
                statusEl.textContent = result.state === 'granted' ? 'Granted' : 'Not granted';
                statusEl.className = `setting-status ${result.state === 'granted' ? 'granted' : 'denied'}`;
                requestBtn.style.display = result.state === 'granted' ? 'none' : 'block';
            });
        } catch (error) {
            console.error('Error checking location permission:', error);
            statusEl.textContent = 'Error checking permission';
            statusEl.className = 'setting-status denied';
        }
    }

    async requestLocationPermission() {
        if ('geolocation' in navigator) {
            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                this.checkLocationPermission();
            } catch (error) {
                console.error('Error requesting location permission:', error);
                const statusEl = document.getElementById('locationStatus');
                statusEl.textContent = 'Permission denied';
                statusEl.className = 'setting-status denied';
            }
        }
    }

    loadApiKey() {
        const apiKeyInput = document.getElementById('autoRouterKey');
        const savedKey = localStorage.getItem('autorouter-api-key');
        if (savedKey) {
            apiKeyInput.value = savedKey;
        }
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('autoRouterKey');
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('autorouter-api-key', key);
            alert('API key saved successfully');
        } else {
            alert('Please enter a valid API key');
        }
    }

    async handleAirportSearch(e) {
        const query = e.target.value.trim();
        const resultsContainer = document.getElementById('airportResults');

        if (query.length < 2) {
            resultsContainer.classList.remove('show');
            return;
        }

        // Search airports
        const results = await this.airportHandler.searchAirports(query);

        // Clear previous results
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No airports found</div>';
        } else {
            results.forEach(airport => {
                const item = document.createElement('div');
                item.className = 'airport-result-item';
                item.innerHTML = `
                    <div class="airport-name">${airport.name}</div>
                    <div class="airport-codes">${airport.codes.icao || airport.codes.iata || airport.codes.local}</div>
                    <div class="airport-location">${airport.location.municipality}, ${airport.location.country}</div>
                    <div class="airport-coords">${this.coordinates.formatCoordinate(airport.location.lat, true)} ${this.coordinates.formatCoordinate(airport.location.lng, false)}</div>
                `;

                item.addEventListener('click', () => {
                    const state = window.mapHandler.getState();
                    if (state === 'fire') {
                        window.mapHandler.setFireLocation(airport.location.lat, airport.location.lng);
                    } else if (state === 'base') {
                        window.mapHandler.setBaseLocation(airport.location.lat, airport.location.lng);
                    }
                    this.coordinates.saveLocation(state, { lat: airport.location.lat, lng: airport.location.lng });
                    this.handleLocationUpdate({ type: state, lat: airport.location.lat, lng: airport.location.lng });
                    resultsContainer.classList.remove('show');
                    e.target.value = '';
                });

                resultsContainer.appendChild(item);
            });
        }

        resultsContainer.classList.add('show');
    }
}

// Export for use in other modules
window.UIHandler = UIHandler;
