# API Client Usage Guide

## Overview

We've implemented a centralized API client (`src/utils/api.js`) that handles:

1. **Automatic 401 detection** - Redirects to login when session expires
2. **Token refresh** - Extends session for active users (refreshes every 30 minutes)
3. **Activity tracking** - Monitors user interaction to prevent logout during active work
4. **Centralized error handling** - Consistent error handling across all API calls

## How to Use in Components

### Import the API client

```javascript
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
```

### Before (Old Way)

```javascript
// Old way - No automatic 401 handling
const response = await fetch(`${API_URL}/api/profiles`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

### After (New Way)

```javascript
// New way - Automatic 401 handling and token refresh
const response = await apiGet('/api/profiles');
if (response.ok) {
  const data = await response.json();
}
```

## API Methods

### GET Request
```javascript
const response = await apiGet('/api/profiles');
```

### POST Request
```javascript
const response = await apiPost('/api/profiles', {
  name: 'My Profile',
  description: 'Test'
});
```

### PUT Request
```javascript
const response = await apiPut(`/api/profiles/${id}`, {
  name: 'Updated Name'
});
```

### DELETE Request
```javascript
const response = await apiDelete(`/api/profiles/${id}`);
```

## Benefits

1. **Session Management**: Token is automatically refreshed every 30 minutes if user is active
2. **Auto-logout**: User is automatically redirected to login when unauthorized (401)
3. **Activity Detection**: Tracks mouse, keyboard, scroll, and touch events
4. **No More Manual Token Handling**: Authorization header is added automatically
5. **Consistent Error Handling**: All 401 errors trigger the same logout flow

## Migration Example

### Dashboard.jsx - Fetching Versions

**Before:**
```javascript
const fetchVersions = async () => {
  try {
    const backendResponse = await fetch(`${API_URL}/api/version`);
    if (backendResponse.ok) {
      const backendData = await backendResponse.json();
      setBackendVersion(backendData.version);
    }
  } catch (err) {
    console.error('Error fetching versions:', err);
  }
};
```

**After:**
```javascript
import { apiGet } from '../utils/api';

const fetchVersions = async () => {
  try {
    const backendResponse = await apiGet('/api/version');
    if (backendResponse.ok) {
      const backendData = await backendResponse.json();
      setBackendVersion(backendData.version);
    }
  } catch (err) {
    console.error('Error fetching versions:', err);
  }
};
```

### TailorCV.jsx - Creating CV

**Before:**
```javascript
const response = await fetch(`${API_URL}/api/tailor/save`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    profile_id: profileId,
    job_description: jobDescription,
    // ... other fields
  })
});
```

**After:**
```javascript
import { apiPost } from '../utils/api';

const response = await apiPost('/api/tailor/save', {
  profile_id: profileId,
  job_description: jobDescription,
  // ... other fields
});
```

## What Happens on 401 Error?

When any API call receives a 401 Unauthorized response:

1. Token is removed from localStorage
2. `logoutCallback` is triggered (set in App.jsx)
3. User state is cleared
4. User is redirected to login screen
5. Activity tracking is cleaned up

This ensures users always know when they need to log in again, preventing the confusion of silent failures in the backend logs.

## Implementation Status

- ✅ Backend: Token expiration increased from 30 minutes to 24 hours
- ✅ Backend: Token refresh endpoint added (`/api/refresh-token`)
- ✅ Frontend: Centralized API client created
- ✅ Frontend: Activity tracking implemented
- ✅ Frontend: Auto-logout on 401 implemented
- ⏳ Frontend: Components need to be migrated to use the new API client

## Next Steps

Components should be gradually migrated to use the new API client. Priority components:

1. TailorCV.jsx (high frequency of API calls)
2. SavedCVs.jsx
3. ApplicationTracker.jsx
4. ProfilePage.jsx
5. MasterProfile.jsx

Delete this file when migration is complete.
