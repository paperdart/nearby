import LocalTraining from './localevents.js'
import { createLoadingIndicator, renderLocationData, renderNearbyEvents, createEventSearch } from './ui.js'

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  // Create loading indicator
  const loadingIndicator = createLoadingIndicator();
  const loadingContainer = document.getElementById('loadingContainer');
  loadingContainer.appendChild(loadingIndicator.element);
  
  // Get location container
  const locationContainer = document.getElementById('locationContainer');
  
  // Show loading indicator
  loadingIndicator.show();
  
  try {
    // Initialize LocalTraining library
    const localTraining = new LocalTraining();
    
    // Get fast location first
    const fastLocation = await localTraining.locationFast();
    
    // Hide loading indicator
    loadingIndicator.hide();
    
    // Render initial location data
    renderLocationData(fastLocation, locationContainer);

    // Create location text for search placeholder
    const locationText = fastLocation.city && fastLocation.country 
      ? `${fastLocation.city}, ${fastLocation.country}`
      : 'current location';

    // Get search parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search') || '';

    // Create and add search input
    const searchContainer = createEventSearch(locationText, async (searchText) => {
      const searchResults = await localTraining.searchEvents(searchText, fastLocation, 3);
      const existingEvents = locationContainer.querySelector('.nearby-events');
      if (existingEvents) {
        existingEvents.remove();
      }
      renderNearbyEvents(searchResults, locationContainer);
      
      // Update URL with search parameter
      const newUrl = new URL(window.location);
      if (searchText) {
        newUrl.searchParams.set('search', searchText);
      } else {
        newUrl.searchParams.delete('search');
      }
      window.history.pushState({}, '', newUrl);
    });
    locationContainer.appendChild(searchContainer);

    // If there's a search query in the URL, perform the search
    if (searchQuery) {
      const searchInput = document.getElementById('event-search');
      if (searchInput) {
        searchInput.value = searchQuery;
        const searchResults = await localTraining.searchEvents(searchQuery, fastLocation, 3);
        renderNearbyEvents(searchResults, locationContainer);
      }
    } else {
      // Get and render nearby events if no search query
      const nearbyEvents = await localTraining.getClosestEvents(3);
      renderNearbyEvents(nearbyEvents, locationContainer);
    }

    // Try to get more accurate location
    const accurateLocation = await localTraining.locationAccurate();
    if (accurateLocation) {
      // Update the display with accurate location
      renderLocationData(accurateLocation, locationContainer);
      
      // Update events with accurate location if no search query
      if (!searchQuery) {
        const updatedEvents = await localTraining.getClosestEvents(3);
        const existingEvents = locationContainer.querySelector('.nearby-events');
        if (existingEvents) {
          existingEvents.remove();
        }
        renderNearbyEvents(updatedEvents, locationContainer);
      }
    }
    
  } catch (error) {
    console.error('Error loading application:', error);
    loadingIndicator.updateText('Error loading location data. Please try again.');
    
    // Create an error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
      <h3>Error Loading Location</h3>
      <p>There was a problem determining your location. Please try refreshing the page.</p>
      <p class="error-details">${error.message}</p>
    `;
    
    loadingIndicator.hide();
    locationContainer.appendChild(errorElement);
  }
});
