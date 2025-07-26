/**
 * AutoRouter API client for weather and NOTAM data
 */
class AutoRouterClient {
    constructor() {
        this.baseUrl = 'https://api.autorouter.aero/v1.0';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get the stored API credentials
     * @returns {Object|null} Object with email and apiKey, or null if not set
     */
    getStoredCredentials() {
        const email = localStorage.getItem('fmf-autorouter-email');
        const apiKey = localStorage.getItem('fmf-autorouter-key');
        return email && apiKey ? { email, apiKey } : null;
    }

    /**
     * Save API credentials to localStorage
     * @param {string} email - AutoRouter account email
     * @param {string} apiKey - AutoRouter account password/API key
     */
    saveCredentials(email, apiKey) {
        localStorage.setItem('fmf-autorouter-email', email);
        localStorage.setItem('fmf-autorouter-key', apiKey);
    }

    /**
     * Clear stored API credentials
     */
    clearCredentials() {
        localStorage.removeItem('fmf-autorouter-email');
        localStorage.removeItem('fmf-autorouter-key');
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Check if we have valid credentials and a non-expired token
     * @returns {boolean} True if we can make API calls
     */
    isAuthenticated() {
        return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry;
    }

    /**
     * Get an access token using stored credentials
     * @returns {Promise<boolean>} True if authentication succeeded
     */
    async authenticate() {
        const credentials = this.getStoredCredentials();
        if (!credentials) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: credentials.email,
                    client_secret: credentials.apiKey
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Authentication failed:', error);
                return false;
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    /**
     * Make an authenticated API call
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} API response data
     */
    async apiCall(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Authentication required');
            }
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (response.status === 403) {
            // Token expired, try to re-authenticate once
            this.accessToken = null;
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Authentication failed');
            }
            return this.apiCall(endpoint, options);
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || 'API call failed');
        }

        return response.json();
    }

    /**
     * Get METAR and TAF for an airport
     * @param {string} icao - ICAO code of the airport
     * @returns {Promise<Object>} Object with metar and taf properties
     */
    async getWeather(icao) {
        return this.apiCall(`/met/metartaf/${icao}`);
    }

    /**
     * Get NOTAMs for an airport
     * @param {string} icao - ICAO code of the airport
     * @param {Object} options - Query options (offset, limit)
     * @returns {Promise<Object>} Object with total and rows (array of NOTAMs)
     */
    async getNotams(icao, options = { offset: 0, limit: 10 }) {
        const params = new URLSearchParams({
            itemas: JSON.stringify([icao]),
            offset: options.offset.toString(),
            limit: options.limit.toString()
        });
        return this.apiCall(`/notam?${params}`);
    }

    /**
     * Parse METAR for weather status
     * @param {string} metar - METAR string
     * @returns {Object} Weather status object
     */
    parseWeatherStatus(metar) {
        if (!metar) return { isRed: false, reason: null };

        const status = {
            isRed: false,
            reason: []
        };

        // Check wind speed (>18kts)
        const windMatch = metar.match(/\b(\d{2})(?:G\d{2})?KT\b/);
        if (windMatch && parseInt(windMatch[1]) > 18) {
            status.isRed = true;
            status.reason.push('High winds');
        }

        // Check visibility (<5000m)
        const visMatch = metar.match(/\b(\d{4})\b/);
        if (visMatch && parseInt(visMatch[1]) < 5000) {
            status.isRed = true;
            status.reason.push('Low visibility');
        }

        // Check for CB (cumulonimbus)
        if (metar.includes('CB')) {
            status.isRed = true;
            status.reason.push('Cumulonimbus clouds');
        }

        return status;
    }
}

// Create global instance
window.autoRouterClient = new AutoRouterClient();
