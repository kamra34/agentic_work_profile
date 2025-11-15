/**
 * Centralized API client with automatic token refresh and 401 handling
 * This ensures users are redirected to login when unauthorized
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Track the last activity time for token refresh
let lastActivityTime = Date.now();
let refreshTimer = null;

// Callback to handle logout - will be set by App.jsx
let logoutCallback = null;

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

/**
 * Update last activity time and schedule token refresh
 */
const updateActivity = () => {
  lastActivityTime = Date.now();

  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Schedule token refresh for every 30 minutes of activity
  refreshTimer = setTimeout(() => {
    refreshTokenIfNeeded();
  }, 30 * 60 * 1000); // 30 minutes
};

/**
 * Refresh token if user has been active
 */
const refreshTokenIfNeeded = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Check if there was activity in the last hour
  const timeSinceActivity = Date.now() - lastActivityTime;
  const oneHour = 60 * 60 * 1000;

  if (timeSinceActivity < oneHour) {
    try {
      const response = await fetch(`${API_URL}/api/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);

        // Schedule next refresh
        refreshTimer = setTimeout(refreshTokenIfNeeded, 30 * 60 * 1000);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }
};

/**
 * Handle 401 Unauthorized response
 */
const handle401 = () => {
  localStorage.removeItem('token');

  if (logoutCallback) {
    logoutCallback();
  } else {
    // Fallback: reload the page which will show login screen
    window.location.reload();
  }
};

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/profiles')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  // Update activity on each request
  updateActivity();

  // Prepare headers
  const headers = {
    ...options.headers,
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add content-type for JSON bodies
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      handle401();
      throw new Error('Unauthorized - Please log in again');
    }

    return response;
  } catch (error) {
    // Check if it's a network error or 401
    if (error.message.includes('Unauthorized')) {
      throw error;
    }

    console.error('API request failed:', error);
    throw error;
  }
};

/**
 * Convenience method for GET requests
 */
export const apiGet = async (endpoint) => {
  return apiRequest(endpoint, { method: 'GET' });
};

/**
 * Convenience method for POST requests
 */
export const apiPost = async (endpoint, body) => {
  return apiRequest(endpoint, {
    method: 'POST',
    body
  });
};

/**
 * Convenience method for PUT requests
 */
export const apiPut = async (endpoint, body) => {
  return apiRequest(endpoint, {
    method: 'PUT',
    body
  });
};

/**
 * Convenience method for DELETE requests
 */
export const apiDelete = async (endpoint) => {
  return apiRequest(endpoint, { method: 'DELETE' });
};

/**
 * Initialize activity tracking
 * Call this once when the app loads
 */
export const initializeActivityTracking = () => {
  // Track user interactions
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

  events.forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
  });

  // Start initial refresh timer
  updateActivity();
};

/**
 * Cleanup activity tracking
 */
export const cleanupActivityTracking = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.removeEventListener(event, updateActivity);
  });
};

export default apiRequest;
