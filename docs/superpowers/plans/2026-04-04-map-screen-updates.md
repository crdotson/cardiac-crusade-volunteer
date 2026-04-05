# Map Screen Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Map screen to support circular area-based imports, manual location entry, and improved result filtering, while centralizing configuration for the default origin city.

**Architecture:** 
- **Backend**: Extend the `settings` table and add new endpoints for nearby search and manual location creation.
- **Frontend**: Refactor the Map header into a button group, integrate Leaflet-Geoman's circle tool, and implement complex modals for imports and manual entry.
- **Filtering**: Implement a client-side "Excel-like" filtering system for search results before confirmation.

**Tech Stack:** React, Leaflet, Leaflet-Geoman, Node.js/Express, PostgreSQL, Google Places API (v1).

---

### Task 1: Admin Settings & Manual Add API

**Files:**
- Modify: `server/index.js`
- Modify: `client/src/pages/Settings.tsx`

- [ ] **Step 1: Update DB initialization for `default_origin_city`**
Modify `initDB` in `server/index.js` to include the new setting.
```javascript
// server/index.js
// Inside initDB function after other default settings
await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['default_origin_city', 'Lexington, KY']);
```

- [ ] **Step 2: Add `default_origin_city` to Settings UI**
Modify `client/src/pages/Settings.tsx` to allow admins to edit this value.
```typescript
// client/src/pages/Settings.tsx
// Add state
const [defaultOriginCity, setDefaultOriginCity] = useState('');
// Inside fetchSettings
setDefaultOriginCity(res.data.default_origin_city || 'Lexington, KY');
// Inside handleSaveAdminSettings
settings: {
  google_api_key: googleApiKey,
  google_places_limit: googlePlacesLimit,
  default_origin_city: defaultOriginCity,
}
// Inside JSX (Admin Controls)
<label>Default Origin City</label>
<input type="text" value={defaultOriginCity} onChange={(e) => setDefaultOriginCity(e.target.value)} />
```

- [ ] **Step 3: Implement Manual Add API**
Add `POST /api/locations` to `server/index.js`.
```javascript
// server/index.js
mainRouter.post('/api/locations', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { name, address, lat, lng, phone, category, assigned_volunteer_id, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO locations (name, address, lat, lng, phone, category, status, assigned_volunteer_id, assignment_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [name, address, lat, lng, phone, category, status || 'Unvisited', assigned_volunteer_id || null, assigned_volunteer_id ? 'Manual' : null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error adding location:', err);
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 4: Commit Phase 1**
```bash
git add server/index.js client/src/pages/Settings.tsx
git commit -m "feat: add default_origin_city setting and manual location API"
```

---

### Task 2: Area Search API & Circle Drawing

**Files:**
- Modify: `server/index.js`
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Implement Search Nearby API**
Add `POST /api/locations/search-nearby` to `server/index.js`.
```javascript
// server/index.js
mainRouter.post('/api/locations/search-nearby', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { lat, lng, radius } = req.body; // radius in meters
    try {
        const keyRes = await pool.query("SELECT value FROM settings WHERE key = 'google_api_key'");
        const apiKey = keyRes.rows[0]?.value;
        if (!apiKey) return res.status(400).json({ message: 'Google API key not configured' });

        const response = await axios.post('https://places.googleapis.com/v1/places:searchNearby', 
            { 
                locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radius } }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.types'
                }
            }
        );

        const results = (response.data.places || []).map(p => ({
            name: p.displayName.text,
            address: p.formattedAddress,
            lat: p.location.latitude,
            lng: p.location.longitude,
            phone: p.internationalPhoneNumber || null,
            categories: p.types // Use Google's types for filtering
        }));

        res.json(results);
    } catch (err) {
        console.error('Error in search-nearby:', err);
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Enable Circle Drawing in Map**
Update `MapEvents` in `client/src/pages/Map.tsx` to support circles.
```typescript
// client/src/pages/Map.tsx
const MapEvents = ({ onDrawCreated, onCircleCreated, selectedVolunteer }: { 
  onDrawCreated: (bounds: L.LatLngBounds) => void, 
  onCircleCreated: (center: L.LatLng, radius: number) => void,
  selectedVolunteer: string 
}) => {
  // ...
  drawCircle: true,
  // ...
  map.on('pm:create', (e: any) => {
    if (e.shape === 'Rectangle') {
      onDrawCreated(e.layer.getBounds());
    } else if (e.shape === 'Circle') {
      onCircleCreated(e.layer.getLatLng(), e.layer.getRadius());
      e.layer.remove(); // Remove temporary circle after search
    }
  });
};
```

- [ ] **Step 3: Handle Circle Creation in Map component**
```typescript
// client/src/pages/Map.tsx
const handleCircleCreated = async (center: L.LatLng, radius: number) => {
  setIsImporting(true);
  setShowImport(true); // Open the unified modal
  setCandidates([]);
  try {
    const res = await axios.post('api/locations/search-nearby', {
      lat: center.lat,
      lng: center.lng,
      radius: radius
    });
    setCandidates(res.data);
    setSelectedCandidates(new Set(res.data.map((_: any, i: number) => i)));
  } catch (err: any) {
    alert(err.response?.data?.message || 'Nearby search failed.');
  } finally {
    setIsImporting(false);
  }
};
```

- [ ] **Step 4: Commit Phase 2**
```bash
git add server/index.js client/src/pages/Map.tsx
git commit -m "feat: implement nearby search and circle drawing integration"
```

---

### Task 3: Unified Import Modal & Excel-like Filtering

**Files:**
- Modify: `client/src/pages/Map.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Add Filtering State to Map**
```typescript
// client/src/pages/Map.tsx
const [filterText, setFilterText] = useState('');
const [filterCategory, setFilterCategory] = useState<string>('All');
```

- [ ] **Step 2: Refactor Modal Content for Filtering**
Update the modal in `Map.tsx` to include the search box and category filter.
```typescript
// client/src/pages/Map.tsx (inside modal)
const filteredCandidates = candidates.filter(c => {
  const matchesText = c.name.toLowerCase().includes(filterText.toLowerCase()) || 
                      c.address.toLowerCase().includes(filterText.toLowerCase());
  const matchesCat = filterCategory === 'All' || (c.categories && c.categories.includes(filterCategory));
  return matchesText && matchesCat;
});

// UI elements in modal header
<div className="filter-toolbar">
  <input type="text" placeholder="Filter results..." value={filterText} onChange={e => setFilterText(e.target.value)} />
  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
    <option value="All">All Categories</option>
    {/* Unique categories from current candidates */}
    {[...new Set(candidates.flatMap(c => c.categories || []))].map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
  <button onClick={() => setSelectedCandidates(new Set(filteredCandidates.map((_, i) => i)))}>Select Filtered</button>
</div>
```

- [ ] **Step 3: Add Styles for Filtering**
```css
/* client/src/index.css */
.filter-toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}
.filter-toolbar input, .filter-toolbar select {
  padding: 4px 8px;
  border: 1px solid #ddd;
}
```

- [ ] **Step 4: Commit Phase 3**
```bash
git add client/src/pages/Map.tsx client/src/index.css
git commit -m "feat: add Excel-like filtering to import results modal"
```

---

### Task 4: Manual Add Modal & UI Finalization

**Files:**
- Modify: `client/src/pages/Map.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Add Manual Add Modal State and Form**
```typescript
// client/src/pages/Map.tsx
const [showManualAdd, setShowManualAdd] = useState(false);
const [manualData, setManualData] = useState({
  name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: ''
});

const handleManualSubmit = async () => {
  try {
    // Geocode address via backend proxy (simplified for this task)
    // In a real app, call a geocoding API here
    await axios.post('api/locations', manualData);
    setShowManualAdd(false);
    fetchLocations();
  } catch (err) { alert('Failed to add location'); }
};
```

- [ ] **Step 2: Add "Use My Location" Logic**
```typescript
// client/src/pages/Map.tsx
const useMyLocation = () => {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    // Potentially reverse-geocode here
    setManualData({ ...manualData, lat: latitude, lng: longitude });
  });
};
```

- [ ] **Step 3: Refactor Header UI**
Remove "Map View" and add the `ButtonGroup`.
```typescript
// client/src/pages/Map.tsx
<div style={{ display: 'flex', gap: '0.5rem', className: 'button-group' }}>
  <button onClick={() => setShowImport(true)}>Import by Category</button>
  <button onClick={() => { /* Toggle Circle Tool */ }}>Import by Area</button>
  <button onClick={() => setShowManualAdd(true)}>Manually Add</button>
</div>
<div style={{ borderLeft: '1px solid #ddd', height: '24px', margin: '0 1rem' }}></div>
{/* Assignment controls follow */}
```

- [ ] **Step 4: Final CSS cleanup**
```css
/* client/src/index.css */
.button-group {
  display: flex;
  border-radius: 4px;
  overflow: hidden;
}
.button-group button {
  border-radius: 0;
  border: 1px solid var(--primary-color);
  background: white;
  color: var(--primary-color);
}
.button-group button:not(:last-child) {
  border-right: none;
}
.button-group button:hover {
  background: var(--primary-color);
  color: white;
}
```

- [ ] **Step 5: Commit Phase 4**
```bash
git add client/src/pages/Map.tsx client/src/index.css
git commit -m "feat: finalize Map UI with button group and manual add modal"
```
