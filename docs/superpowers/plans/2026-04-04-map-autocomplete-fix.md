# Map Autocomplete & Geocoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure manual location addition correctly identifies coordinates via autocomplete dropdown or backend geocoding fallback.

**Architecture:** 
- **Backend**: Provide a secure proxy for the Google Geocoding API.
- **Frontend**: Force autocomplete dropdown visibility via CSS and implement a mandatory geocoding step before saving a location if coordinates are missing.

---

### Task 1: Backend Geocoding API

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Implement Geocode Proxy**
Add `POST /api/locations/geocode` to `server/index.js`.
```javascript
// server/index.js
mainRouter.post('/api/locations/geocode', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { address } = req.body;
    try {
        const keyRes = await pool.query("SELECT value FROM settings WHERE key = 'google_api_key'");
        const apiKey = keyRes.rows[0]?.value;
        if (!apiKey) return res.status(400).json({ message: 'Google API key not configured' });

        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address, key: apiKey }
        });

        if (response.data.status !== 'OK') {
            return res.status(400).json({ message: `Geocoding failed: ${response.data.status}` });
        }

        const location = response.data.results[0].geometry.location;
        res.json({ lat: location.lat, lng: location.lng, formatted_address: response.data.results[0].formatted_address });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Commit Task 1**
```bash
git add server/index.js
git commit -m "feat: add backend geocoding proxy endpoint"
```

---

### Task 2: Frontend Visibility & Autocomplete Reliability

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Force Autocomplete Visibility**
Add CSS to `client/src/index.css`.
```css
/* client/src/index.css */
.pac-container {
  z-index: 10000 !important; /* Ensure it stays above modals */
}
```

- [ ] **Step 2: Refactor Autocomplete Initialization**
Ensure initialization waits for the script and applies origin city bias.
```typescript
// client/src/pages/Map.tsx
useEffect(() => {
  if (showManualAdd) {
    const initAutocomplete = () => {
      if (!(window as any).google) {
        setTimeout(initAutocomplete, 100);
        return;
      }
      const input = document.getElementById('address') as HTMLInputElement;
      if (!input) return;
      
      const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        fields: ['formatted_address', 'geometry']
      });
      
      // Fetch default_origin_city from settings to bias results
      axios.get('api/settings').then(res => {
        const city = res.data.default_origin_city;
        if (city) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: city }, (results, status) => {
            if (status === 'OK' && results![0].geometry.viewport) {
              autocomplete.setBounds(results![0].geometry.viewport);
            }
          });
        }
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          setManualData((prev: any) => ({
            ...prev,
            address: place.formatted_address || '',
            lat: place.geometry!.location!.lat(),
            lng: place.geometry!.location!.lng()
          }));
        }
      });
    };
    initAutocomplete();
  }
}, [showManualAdd]);
```

- [ ] **Step 3: Commit Task 2**
```bash
git add client/src/index.css client/src/pages/Map.tsx
git commit -m "fix: resolve autocomplete visibility and initialization race conditions"
```

---

### Task 3: Geocoding Fallback Submission

**Files:**
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Implement Geocoding step in `handleManualSubmit`**
Check for missing coordinates and geocode if needed.
```typescript
// client/src/pages/Map.tsx
const handleManualSubmit = async () => {
  let dataToSave = { ...manualData };
  
  // Default coordinates check (using 38.0406 as 'missing' indicator)
  if (dataToSave.lat === 38.0406) {
    try {
      const res = await axios.post('api/locations/geocode', { address: dataToSave.address });
      dataToSave.lat = res.data.lat;
      dataToSave.lng = res.data.lng;
      dataToSave.address = res.data.formatted_address;
    } catch (err: any) {
      alert('Could not find location for this address. Please be more specific or select an option from the list.');
      return;
    }
  }

  try {
    await axios.post('api/locations', dataToSave);
    setShowManualAdd(false);
    setManualData({
      name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', lat: 38.0406, lng: -84.5037
    });
    fetchLocations();
  } catch (err) {
    alert('Failed to add location');
  }
};
```

- [ ] **Step 2: Commit Task 3**
```bash
git add client/src/pages/Map.tsx
git commit -m "feat: implement geocoding fallback for manual location addition"
```
