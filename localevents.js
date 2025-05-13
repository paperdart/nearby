/**
 * LocalTraining - A simple library for determining user location
 * with multiple fallback methods.
 */
class LocalTraining {
  constructor() {
    this.locations = [];
    this.responseHeaders = null;
    this.isLoaded = false;
    this.loadingPromise = this.initialize();
    this.classes = [];
  }

  /**
   * Initialize the library by loading locations data
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize() {
    try {
      console.log('Initializing LocalTraining library...');
      const [locationsResponse, classesResponse] = await Promise.all([
        fetch('./locations.json'),
        fetch('./classes.json')
      ]);
      
      this.responseHeaders = {};
      locationsResponse.headers.forEach((value, name) => {
        this.responseHeaders[name.toLowerCase()] = value;
      });
      console.log('Response headers stored:', this.responseHeaders);
      
      this.locations = await locationsResponse.json();
      this.classes = await classesResponse.json();
      console.log(`Loaded ${this.locations.length} locations and ${this.classes.length} classes`);
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize LocalTraining:', error);
      return false;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} - Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Search events based on search text and sort by relevance
   * @param {string} searchText - Text to search for
   * @param {Object} userLocation - User's location data
   * @param {number} limit - Number of events to return
   * @returns {Array} - Array of matching events with distances
   */
  async searchEvents(searchText, userLocation, limit = 3) {
    await this.waitForLoad();

    const useMetric = !['US', 'GB'].includes(userLocation.c2);
    const searchTerms = searchText.toLowerCase().split(/[\s,]+/).filter(term => term.length > 0);

    const eventsWithScore = this.classes.map(event => {
      const distanceKm = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        event.latitude,
        event.longitude
      );

      // Calculate search relevance score
      let score = 0;
      if (searchTerms.length === 0) {
        score = 1; // All events are equally relevant when no search terms
      } else {
        const searchableText = `${event.name} ${event.type} ${event.address}`.toLowerCase();
        searchTerms.forEach(term => {
          if (searchableText.includes(term)) score++;
        });
      }

      return {
        ...event,
        distance: useMetric ? distanceKm : distanceKm * 0.621371,
        unit: useMetric ? 'km' : 'mi',
        score
      };
    });

    // Sort by score first, then by distance
    return eventsWithScore
      .sort((a, b) => b.score - a.score || a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * Get closest events to the user's location
   * @param {number} limit - Number of events to return
   * @returns {Array} - Array of events with distances
   */
  async getClosestEvents(limit = 3) {
    const userLocation = await this.locationFast();
    return this.searchEvents('', userLocation, limit);
  }

  /**
   * Wait for the library to be fully loaded
   * @returns {Promise} - Resolves when library is loaded
   */
  async waitForLoad() {
    return this.loadingPromise;
  }

  /**
   * Try to get location from browser geolocation API
   * @returns {Promise} - Resolves with location data or null
   */
  async getBrowserLocation() {
    console.log('Attempting to get location from browser geolocation API...');
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('Browser geolocation API not available');
        return resolve(null);
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('Successfully obtained browser geolocation:', { latitude, longitude });
          resolve({ latitude, longitude });
        },
        (error) => {
          console.log('Failed to get browser geolocation:', error.message);
          resolve(null);
        },
        { timeout: 5000 }
      );
    });
  }

  /**
   * Extract location information from response headers
   * @returns {Object|null} - Location data or null
   */
  getLocationFromHeaders() {
    console.log('Attempting to get location from response headers...');
    if (!this.responseHeaders) {
      console.log('No response headers available');
      return null;
    }
    
    const locationData = {};
    
    if (this.responseHeaders['x-client-city-lat-long']) {
      console.log('Found x-client-city-lat-long header');
      const [lat, long] = this.responseHeaders['x-client-city-lat-long'].split(',');
      locationData.latitude = parseFloat(lat);
      locationData.longitude = parseFloat(long);
    } else {
      if (this.responseHeaders['cf-iplatitude']) {
        console.log('Found cf-iplatitude header');
        locationData.latitude = parseFloat(this.responseHeaders['cf-iplatitude']);
      }
      if (this.responseHeaders['cf-iplongitude']) {
        console.log('Found cf-iplongitude header');
        locationData.longitude = parseFloat(this.responseHeaders['cf-iplongitude']);
      }
    }
    
    if (this.responseHeaders['cf-ipcity']) {
      console.log('Found cf-ipcity header');
      locationData.city = this.responseHeaders['cf-ipcity'];
    } else if (this.responseHeaders['x-city']) {
      console.log('Found x-city header');
      locationData.city = this.responseHeaders['x-city'];
    }
    
    if (this.responseHeaders['x-country']) {
      console.log('Found x-country header');
      locationData.country = this.responseHeaders['x-country'];
    }
    
    if (Object.keys(locationData).length > 0) {
      console.log('Successfully extracted location data from headers:', locationData);
      return locationData;
    }
    
    console.log('No location data found in headers');
    return null;
  }

  /**
   * Try to get location from IATA code in response headers
   * @returns {Object|null} - Location data or null
   */
  getLocationFromCdnPopHeader() {
    console.log('Attempting to get location from IATA code in headers...');
    if (!this.responseHeaders) {
      console.log('No response headers available');
      return null;
    }
    
    const headersToCheck = ['x-served-by','cf-ray'];
    
    for (const header of headersToCheck) {
      if (this.responseHeaders[header]) {
        const headerValue = this.responseHeaders[header];
        const possibleIATA = headerValue.substring(headerValue.length - 3).toUpperCase();
        console.log(`Found possible IATA code: ${possibleIATA}`);
        
        const location = this.locations.find(loc => loc.iata === possibleIATA);
        if (location) {
          console.log('Successfully found location from IATA code:', location);
          return {
            latitude: location.latitude,
            longitude: location.longitude,
            country: location.country,
            c2: location.c2,
            c3: location.c3,
            state: location.state,
            city: location.city,
            timezone: location.timezone
          };
        }
      }
    }
    
    console.log('No valid IATA code found in headers');
    return null;
  }

  /**
   * Get location from browser language and timezone
   * @returns {Object|null} - Location data or null
   */
  getLocationFromLanguageAndTimezone() {
    console.log('Attempting to get location from browser language and timezone...');
    const language = navigator.language || navigator.userLanguage;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('Browser language:', language, 'Timezone:', timezone);

    if (!language && !timezone) {
      console.log('No browser language or timezone available');
      return null;
    }

    const countryCode = language.split('-')[1] || language.slice(-2);
    console.log('Extracted country code:', countryCode);

    let matchingLocations = this.locations;
    
    if (timezone) {
      matchingLocations = matchingLocations.filter(loc => loc.timezone === timezone);
      console.log(`Found ${matchingLocations.length} locations matching timezone`);
    }

    if (countryCode) {
      matchingLocations = matchingLocations.filter(loc => loc.c2 === countryCode.toUpperCase());
      console.log(`Found ${matchingLocations.length} locations matching country code`);
    }

    if (matchingLocations.length > 0) {
      const location = matchingLocations[0];
      console.log('Found location from language and timezone:', location);
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        c2: location.c2,
        c3: location.c3,
        state: location.state,
        city: location.city,
        timezone: location.timezone
      };
    }

    console.log('No location found for language and timezone');
    return null;
  }

  /**
   * Find the nearest location to a given set of coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object|null} - Nearest location or null
   */
  findNearestLocation(latitude, longitude) {
    console.log('Finding nearest location to coordinates:', { latitude, longitude });
    if (!this.locations.length) {
      console.log('No locations available');
      return null;
    }
    
    let nearestLocation = null;
    let minDistance = Infinity;
    
    for (const location of this.locations) {
      const distance = this.calculateDistance(latitude, longitude, location.latitude, location.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = location;
      }
    }
    
    if (nearestLocation) {
      console.log('Found nearest location:', nearestLocation);
    }
    return nearestLocation;
  }

  /**
   * Get user location quickly using fallback methods
   * @returns {Promise<Object>} - Location data
   */
  async locationFast() {
    console.log('Starting fast location determination...');
    await this.waitForLoad();
    
    // Try to get location from headers
    const headerLocation = this.getLocationFromHeaders();
    if (headerLocation && (headerLocation.latitude || headerLocation.city)) {
      console.log('Using location from headers');
      const result = { 
        locationservices: "disabled",
        language: navigator.language || navigator.userLanguage || ''
      };
      
      if (headerLocation.latitude && headerLocation.longitude) {
        const nearestLocation = this.findNearestLocation(
          headerLocation.latitude,
          headerLocation.longitude
        );
        
        if (nearestLocation) {
          Object.assign(result, {
            latitude: headerLocation.latitude,
            longitude: headerLocation.longitude,
            country: headerLocation.country || nearestLocation.country,
            c2: nearestLocation.c2,
            c3: nearestLocation.c3,
            state: nearestLocation.state,
            region: nearestLocation.state,
            city: headerLocation.city || nearestLocation.city,
            timezone: nearestLocation.timezone
          });
          return result;
        }
      }
      
      if (headerLocation.city || headerLocation.country) {
        const matchingLocation = this.locations.find(loc => 
          (headerLocation.city && loc.city === headerLocation.city) ||
          (headerLocation.country && loc.country === headerLocation.country)
        );
        
        if (matchingLocation) {
          Object.assign(result, {
            latitude: matchingLocation.latitude,
            longitude: matchingLocation.longitude,
            country: headerLocation.country || matchingLocation.country,
            c2: matchingLocation.c2,
            c3: matchingLocation.c3,
            state: matchingLocation.state,
            region: matchingLocation.state,
            city: headerLocation.city || matchingLocation.city,
            timezone: matchingLocation.timezone
          });
          return result;
        }
      }
    }
    
    // Try IATA code
    const iataLocation = this.getLocationFromCdnPopHeader();
    if (iataLocation) {
      return {
        locationservices: "disabled",
        ...iataLocation,
        region: iataLocation.state,
        language: navigator.language || navigator.userLanguage || ''
      };
    }

    // Try language and timezone
    const languageLocation = this.getLocationFromLanguageAndTimezone();
    if (languageLocation) {
      return {
        locationservices: "disabled",
        ...languageLocation,
        region: languageLocation.state,
        language: navigator.language || navigator.userLanguage || ''
      };
    }

    // Return empty location if all methods fail
    return {
      locationservices: "disabled",
      latitude: null,
      longitude: null,
      country: "",
      c2: "",
      c3: "",
      state: "",
      region: "",
      city: "",
      timezone: "",
      language: navigator.language || navigator.userLanguage || ''
    };
  }

  /**
   * Get accurate user location using browser geolocation
   * @returns {Promise<Object|null>} - Location data or null if geolocation fails
   */
  async locationAccurate() {
    console.log('Starting accurate location determination...');
    await this.waitForLoad();
    
    const browserLocation = await this.getBrowserLocation();
    if (!browserLocation || !browserLocation.latitude || !browserLocation.longitude) {
      return null;
    }

    const nearestLocation = this.findNearestLocation(
      browserLocation.latitude,
      browserLocation.longitude
    );

    if (nearestLocation) {
      return {
        locationservices: "enabled",
        latitude: browserLocation.latitude,
        longitude: browserLocation.longitude,
        country: nearestLocation.country,
        c2: nearestLocation.c2,
        c3: nearestLocation.c3,
        state: nearestLocation.state,
        region: nearestLocation.state,
        city: nearestLocation.city,
        timezone: nearestLocation.timezone,
        language: navigator.language || navigator.userLanguage || ''
      };
    }

    return null;
  }
}

// Export the library
export default LocalTraining;
