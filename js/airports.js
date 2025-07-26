class AirportDataHandler {
    constructor() {
        this.airports = [];
        this.loaded = false;
    }

    async loadData() {
        try {
            const response = await fetch('data/airports.csv');
            const csvText = await response.text();
            this.parseCSV(csvText);
            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load airports data:', error);
            return false;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = this.parseCSVLine(lines[0]);
        
        this.airports = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = this.parseCSVLine(line);
                const airport = {};
                headers.forEach((header, index) => {
                    airport[header] = values[index];
                });
                return airport;
            });
    }

    parseCSVLine(line) {
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(this.cleanValue(currentValue));
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        values.push(this.cleanValue(currentValue));
        return values;
    }

    cleanValue(value) {
        value = value.trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        return value;
    }

    searchByCode(code) {
        if (!code) return [];
        code = code.toUpperCase();
        
        return this.airports.filter(airport => 
            airport.icao_code === code ||
            airport.iata_code === code ||
            airport.ident === code ||
            airport.local_code === code
        );
    }

    searchByName(query) {
        if (!query) return [];
        query = query.toLowerCase();
        
        return this.airports.filter(airport => {
            const name = airport.name.toLowerCase();
            const municipality = airport.municipality.toLowerCase();
            const keywords = airport.keywords.toLowerCase();
            
            return name.includes(query) ||
                   municipality.includes(query) ||
                   keywords.includes(query);
        });
    }

    findNearbyAirports(lat, lon, radiusNM = 300, types = ['large_airport', 'medium_airport', 'small_airport']) {
        if (!lat || !lon) return [];
        
        const nearbyAirports = this.airports
            .filter(airport => types.includes(airport.type))
            .map(airport => ({
                ...airport,
                distance: this.calculateDistance(
                    lat, lon,
                    parseFloat(airport.latitude_deg),
                    parseFloat(airport.longitude_deg)
                )
            }))
            .filter(airport => airport.distance <= radiusNM)
            .sort((a, b) => a.distance - b.distance);
            
        return nearbyAirports;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth's radius in nautical miles
        const φ1 = this.toRadians(lat1);
        const φ2 = this.toRadians(lat2);
        const Δφ = this.toRadians(lat2 - lat1);
        const Δλ = this.toRadians(lon2 - lon1);

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    getAirportInfo(airport) {
        if (!airport) return null;
        
        return {
            name: airport.name,
            type: airport.type,
            location: {
                lat: parseFloat(airport.latitude_deg),
                lng: parseFloat(airport.longitude_deg),
                elevation: parseInt(airport.elevation_ft),
                municipality: airport.municipality,
                country: airport.iso_country,
                region: airport.iso_region,
                continent: airport.continent
            },
            codes: {
                icao: airport.icao_code,
                iata: airport.iata_code,
                gps: airport.gps_code,
                local: airport.local_code
            },
            services: {
                scheduled: airport.scheduled_service === 'yes'
            },
            links: {
                home: airport.home_link,
                wikipedia: airport.wikipedia_link
            },
            keywords: airport.keywords,
            weather: null // Will be populated by getWeatherStatus
        };
    }

    async getWeatherStatus(icaoCode) {
        if (!icaoCode) return null;

        try {
            const response = await fetch(`https://api.autorouter.aero/v1.0/met/metartaf/${icaoCode}`);
            const data = await response.json();
            
            if (!data.metar && !data.taf) return null;
            
            const status = {
                isRed: false,
                conditions: []
            };
            
            if (data.metar) {
                const metarConditions = this.checkWeatherConditions(data.metar);
                status.conditions.push(...metarConditions);
            }
            
            if (data.taf) {
                const tafConditions = this.checkWeatherConditions(data.taf);
                status.conditions.push(...tafConditions);
            }
            
            status.isRed = status.conditions.length > 0;
            return status;
        } catch (error) {
            console.error(`Failed to fetch weather for ${icaoCode}:`, error);
            return null;
        }
    }

    checkWeatherConditions(weatherString) {
        const conditions = [];
        
        // Check wind speed (>18kts)
        const windMatch = weatherString.match(/\d{2}(\d{2})KT/);
        if (windMatch && parseInt(windMatch[1]) > 18) {
            conditions.push('High winds');
        }
        
        // Check visibility (<5000m)
        const visiMatch = weatherString.match(/\s(\d{4})\s/);
        if (visiMatch && parseInt(visiMatch[1]) < 5000) {
            conditions.push('Low visibility');
        }
        
        // Check for CB (Cumulonimbus)
        if (weatherString.includes('CB')) {
            conditions.push('Cumulonimbus present');
        }
        
        return conditions;
    }
}

// Export for use in other modules
window.AirportDataHandler = AirportDataHandler;
