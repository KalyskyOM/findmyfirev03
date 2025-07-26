// Coordinate handling and conversion
class Coordinates {
    constructor() {
        this.currentFormat = localStorage.getItem('fmf-format') || 'dd';
        this.currentPrecision = parseInt(localStorage.getItem('fmf-precision')) || 4;
        this.fireLocation = this.loadSavedLocation('fire');
        this.baseLocation = this.loadSavedLocation('base');
        this.AVERAGE_SPEED = 150; // mph
    }

    loadSavedLocation(type) {
        const saved = localStorage.getItem(`fmf-${type}-location`);
        return saved ? JSON.parse(saved) : null;
    }

    saveLocation(type, coords) {
        localStorage.setItem(`fmf-${type}-location`, JSON.stringify(coords));
    }

    decimalToDMS(decimal, isLatitude) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const seconds = (minutesNotTruncated - minutes) * 60;
        
        const direction = isLatitude
            ? (decimal >= 0 ? 'N' : 'S')
            : (decimal >= 0 ? 'E' : 'W');

        return {
            degrees,
            minutes,
            seconds,
            direction
        };
    }

    DMSToDecimal(dms, isLatitude) {
        let decimal = dms.degrees + (dms.minutes / 60) + (dms.seconds / 3600);
        if ((isLatitude && dms.direction === 'S') || (!isLatitude && dms.direction === 'W')) {
            decimal = -decimal;
        }
        return decimal;
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

    calculateMagneticTrack(lat1, lon1, lat2, lon2) {
        // TODO: Implement magnetic variation calculation
        // For now, returning true track
        const y = Math.sin(this.toRadians(lon2-lon1)) * Math.cos(this.toRadians(lat2));
        const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
                Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(this.toRadians(lon2-lon1));
        let track = this.toDegrees(Math.atan2(y, x));
        return (track + 360) % 360;
    }

    calculateFlightTime(distance) {
        const hours = distance / this.AVERAGE_SPEED;
        const hoursWhole = Math.floor(hours);
        const minutes = Math.round((hours - hoursWhole) * 60);
        return `${hoursWhole}:${minutes.toString().padStart(2, '0')}`;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    formatCoordinate(decimal, isLatitude) {
        switch(this.currentFormat) {
            case 'dd':
                return this.formatDD(decimal, isLatitude);
            case 'ddm':
                return this.formatDDM(decimal, isLatitude);
            case 'dms':
                return this.formatDMS(decimal, isLatitude);
            default:
                return this.formatDD(decimal, isLatitude);
        }
    }

    formatDD(decimal, isLatitude) {
        const direction = isLatitude
            ? (decimal >= 0 ? 'N' : 'S')
            : (decimal >= 0 ? 'E' : 'W');
        return `${Math.abs(decimal).toFixed(this.currentPrecision)}°${direction}`;
    }

    formatDDM(decimal, isLatitude) {
        const dms = this.decimalToDMS(decimal, isLatitude);
        const minutes = ((Math.abs(decimal) - Math.floor(Math.abs(decimal))) * 60).toFixed(this.currentPrecision);
        return `${dms.degrees}°${minutes}'${dms.direction}`;
    }

    formatDMS(decimal, isLatitude) {
        const dms = this.decimalToDMS(decimal, isLatitude);
        return `${dms.degrees}°${dms.minutes}'${dms.seconds.toFixed(this.currentPrecision)}"${dms.direction}`;
    }

    parseDMSString(input) {
        // Remove any whitespace
        input = input.trim();
        
        // Get the direction (last character)
        const direction = input.slice(-1).toUpperCase();
        if (!['N', 'S', 'E', 'W'].includes(direction)) {
            throw new Error('Invalid direction, must be N, S, E, or W');
        }
        
        // Remove the direction
        input = input.slice(0, -1).trim();
        
        // Split by degree symbol
        const parts = input.split('°');
        if (parts.length !== 2) {
            throw new Error('Invalid format: missing degree symbol');
        }
        
        const degrees = parseInt(parts[0]);
        
        // Split minutes and seconds
        const minSecParts = parts[1].split('\'');
        if (minSecParts.length !== 2) {
            throw new Error('Invalid format: missing minute symbol');
        }
        
        const minutes = parseInt(minSecParts[0]);
        
        // Get seconds (remove the double quote)
        let seconds = minSecParts[1].replace('"', '');
        seconds = parseFloat(seconds);
        
        // Validate ranges
        const isLatitude = direction === 'N' || direction === 'S';
        if (isLatitude && (degrees < 0 || degrees > 90)) {
            throw new Error('Latitude degrees must be between 0 and 90');
        }
        if (!isLatitude && (degrees < 0 || degrees > 180)) {
            throw new Error('Longitude degrees must be between 0 and 180');
        }
        if (minutes >= 60) {
            throw new Error('Minutes must be less than 60');
        }
        if (seconds >= 60) {
            throw new Error('Seconds must be less than 60');
        }
        
        return {
            degrees,
            minutes,
            seconds,
            direction
        };
    }

    parseCoordinatePair(latString, lonString) {
        try {
            const latDMS = this.parseDMSString(latString);
            const lonDMS = this.parseDMSString(lonString);
            
            // Validate latitude/longitude directions
            if (latDMS.direction !== 'N' && latDMS.direction !== 'S') {
                throw new Error('Latitude must use N or S direction');
            }
            if (lonDMS.direction !== 'E' && lonDMS.direction !== 'W') {
                throw new Error('Longitude must use E or W direction');
            }
            
            return {
                latitude: this.DMSToDecimal(latDMS, true),
                longitude: this.DMSToDecimal(lonDMS, false)
            };
        } catch (error) {
            throw new Error(`Invalid coordinate pair: ${error.message}`);
        }
    }

    parseCoordinateString(input) {
        if (!input) {
            return { success: false, error: 'No input provided' };
        }

        // Try to match DMS format first (most specific)
        const dmsRegex = /(\d+)°(\d+)'(\d+(?:\.\d+)?)?"?([NS])[\s,]+(\d+)°(\d+)'(\d+(?:\.\d+)?)?"?([EW])/i;
        const dmsMatch = input.match(dmsRegex);

        if (dmsMatch) {
            try {
                const [_, latDeg, latMin, latSec, latDir, lngDeg, lngMin, lngSec, lngDir] = dmsMatch;
                return {
                    success: true,
                    detectedFormat: 'dms',
                    data: {
                        lat: {
                            degrees: parseInt(latDeg),
                            minutes: parseInt(latMin),
                            seconds: parseFloat(latSec || '0'),
                            direction: latDir.toUpperCase()
                        },
                        lng: {
                            degrees: parseInt(lngDeg),
                            minutes: parseInt(lngMin),
                            seconds: parseFloat(lngSec || '0'),
                            direction: lngDir.toUpperCase()
                        }
                    }
                };
            } catch (error) {
                return { success: false, error: 'Invalid DMS format' };
            }
        }

        // Try DDM format
        const ddmRegex = /(\d+)°(\d+(?:\.\d+)?)'([NS])[\s,]+(\d+)°(\d+(?:\.\d+)?)'([EW])/i;
        const ddmMatch = input.match(ddmRegex);

        if (ddmMatch) {
            try {
                const [_, latDeg, latMin, latDir, lngDeg, lngMin, lngDir] = ddmMatch;
                return {
                    success: true,
                    detectedFormat: 'ddm',
                    data: {
                        lat: {
                            degrees: parseInt(latDeg),
                            minutes: parseFloat(latMin),
                            seconds: 0,
                            direction: latDir.toUpperCase()
                        },
                        lng: {
                            degrees: parseInt(lngDeg),
                            minutes: parseFloat(lngMin),
                            seconds: 0,
                            direction: lngDir.toUpperCase()
                        }
                    }
                };
            } catch (error) {
                return { success: false, error: 'Invalid DDM format' };
            }
        }

        // Try DD format
        const ddRegex = /(\d+(?:\.\d+)?)[NS][\s,]+(\d+(?:\.\d+)?)[EW]/i;
        const ddMatch = input.match(ddRegex);

        if (ddMatch) {
            try {
                const [_, lat, lng] = ddMatch;
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lng);
                const latDMS = this.decimalToDMS(latNum, true);
                const lngDMS = this.decimalToDMS(lngNum, false);
                return {
                    success: true,
                    detectedFormat: 'dd',
                    data: {
                        lat: latDMS,
                        lng: lngDMS
                    }
                };
            } catch (error) {
                return { success: false, error: 'Invalid DD format' };
            }
        }

        return {
            success: false,
            error: 'Could not parse coordinates. Please use DD, DDM, or DMS format.'
        };
    }
}

// Export for use in other modules
window.Coordinates = Coordinates;
