const axios = require('axios');

class GoogleMapsService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.autocompleteService = null;
    this.geocoder = null;
    this.directionsService = null;
  }

  /**
   * Initialize Google Maps services (required for frontend)
   */
  initGoogleMaps() {
    if (window.google && window.google.maps) {
      this.autocompleteService = new window.google.maps.places.AutocompleteService();
      this.geocoder = new window.google.maps.Geocoder();
      this.directionsService = new window.google.maps.DirectionsService();
    }
  }

  /**
   * Get address autocomplete suggestions
   * @param {string} query - Search term
   * @param {string} country - Country code (e.g., 'IN')
   * @returns {Promise<Array>} List of predictions
   */
  async autocompleteAddress(query, country = 'IN') {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        {
          params: {
            input: query,
            key: this.apiKey,
            components: `country:${country}`,
          },
        }
      );
      return response.data.predictions;
    } catch (error) {
      console.error('Google Places Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get coordinates (lat, lng) for an address
   * @param {string} address - Full address
   * @returns {Promise<{ lat: number, lng: number }>} Coordinates
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address,
            key: this.apiKey,
          },
        }
      );
      const location = response.data.results[0]?.geometry.location;
      return location || null;
    } catch (error) {
      console.error('Google Geocoding error:', error);
      return null;
    }
  }

  /**
   * Calculate driving distance between two points
   * @param {{ lat: number, lng: number }} origin - Start coordinates
   * @param {{ lat: number, lng: number }} destination - End coordinates
   * @returns {Promise<number>} Distance in kilometers
   */
  async calculateDistance(origin, destination) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/directions/json',
        {
          params: {
            origin: `${origin.lat},${origin.lng}`,
            destination: `${destination.lat},${destination.lng}`,
            key: this.apiKey,
          },
        }
      );
      const distanceInMeters = response.data.routes[0]?.legs[0]?.distance.value;
      return distanceInMeters ? distanceInMeters / 1000 : 0; // Convert to km
    } catch (error) {
      console.error('Google Directions API error:', error);
      return 0;
    }
  }
}

module.exports = new GoogleMapsService(process.env.GOOGLE_MAPS_API_KEY);