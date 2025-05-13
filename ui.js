/**
 * UI helper functions for the Local Instructor Training application
 */

/**
 * Creates and manages the loading indicator
 */
export function createLoadingIndicator() {
  const loadingContainer = document.createElement('div');
  loadingContainer.className = 'loading-container';
  
  const loadingText = document.createElement('div');
  loadingText.className = 'loading-text';
  loadingText.textContent = 'Loading location data...';
  
  loadingContainer.appendChild(loadingText);
  
  return {
    element: loadingContainer,
    
    show() {
      loadingContainer.style.display = 'block';
    },
    
    hide() {
      loadingContainer.style.display = 'none';
    },
    
    updateText(text) {
      loadingText.textContent = text;
    }
  };
}

/**
 * Creates a search input for events
 * @param {string} locationText - Current location text for placeholder
 * @param {Function} onSearch - Callback function when search text changes
 * @returns {HTMLElement} The search container element
 */
export function createEventSearch(locationText, onSearch) {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'event-search';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'search-icon-container';
  const icon = document.createElement('img');
  icon.src = './E0A9.svg';
  icon.alt = 'Location';
  icon.className = 'search-location-icon';
  iconContainer.appendChild(icon);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'event-search';
  input.className = 'event-search-input';
  input.placeholder = locationText;

  input.addEventListener('input', (e) => onSearch(e.target.value));

  searchContainer.appendChild(iconContainer);
  searchContainer.appendChild(input);

  return searchContainer;
}

/**
 * Renders the location data in the UI
 * @param {Object} locationData - The location data to display
 * @param {HTMLElement} container - The container to render into
 */
export function renderLocationData(locationData, container) {
  // Location banner has been removed
}

/**
 * Renders nearby events in the UI
 * @param {Array} events - Array of events with distances
 * @param {HTMLElement} container - The container to render into
 */
export function renderNearbyEvents(events, container) {
  if (!events.length) return;

  // Find and remove only the existing events section
  const existingEvents = container.querySelector('.nearby-events');
  if (existingEvents) {
    existingEvents.remove();
  }

  const eventsSection = document.createElement('div');
  eventsSection.className = 'nearby-events';
  
  eventsSection.innerHTML = `
    <div class="events-grid">
      ${events.map(event => `
        <div class="event-card">
          <h4>${event.name}</h4>
          <p class="event-type">${event.type}</p>
          <p class="event-address">
            ${event.address}
            <span class="event-distance">(${Math.round(event.distance)} ${event.unit})</span>
          </p>
          <p class="event-start">Starts: ${event.start}</p>
        </div>
      `).join('')}
    </div>
  `;

  // Append the events section after the search box
  container.appendChild(eventsSection);
}
