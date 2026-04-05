# UI & Data Import Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve address entry with autocomplete, enhance CSV import flexibility, unify filtering on the List screen, and refine category display and search limits.

**Architecture:** 
- **Backend**: Update existing location search endpoint to respect the configured result limit.
- **Frontend (Global)**: Integrate Google Maps JS API for client-side autocomplete.
- **Frontend (Components)**: Refactor CSV parsing logic and replicate filtering UI across screens.

**Tech Stack:** React, Leaflet, Google Places JS API, Node.js/Express, PapaParse.

---

### Task 1: Backend & Global Integration

**Files:**
- Modify: `server/index.js`
- Modify: `client/index.html`

- [ ] **Step 1: Update `search-nearby` to respect limit**
Modify `POST /api/locations/search-nearby` in `server/index.js`.
```javascript
// server/index.js
mainRouter.post('/api/locations/search-nearby', ... async (req, res) => {
    // ... fetch apiKey ...
    const limitRes = await pool.query("SELECT value FROM settings WHERE key = 'google_places_limit'");
    const limit = parseInt(limitRes.rows[0]?.value || '20');

    const response = await axios.post('https://places.googleapis.com/v1/places:searchNearby', 
        { 
            locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radius } },
            maxResultCount: limit // Use setting
        },
        // ... headers ...
    );
    // ...
});
```

- [ ] **Step 2: Load Google Maps JS API**
Update `client/index.html` to include the script tag.
```html
<!-- client/index.html -->
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=places"></script>
```
*Note: The key should ideally be managed via environment variables or fetched dynamically.*

- [ ] **Step 3: Commit Task 1**
```bash
git add server/index.js client/index.html
git commit -m "feat: implement dynamic search limit and load Google Maps API"
```

---

### Task 2: Map Screen & Category Refinements

**Files:**
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Refine `formatCategoryName`**
Update the helper function in `Map.tsx`.
```typescript
// client/src/pages/Map.tsx
const formatCategoryName = (name: string) => {
  if (!name) return 'N/A';
  return name.replace(/_/g, ' ')
             .split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
             .join(' ');
};
```

- [ ] **Step 2: Add 1Password fixes to Address Input**
Update the address input attributes.
```typescript
// client/src/pages/Map.tsx (Manual Add Modal)
<input 
  name="address"
  id="address"
  autoComplete="street-address"
  data-1p-ignore
  // ... other props
/>
```

- [ ] **Step 3: Implement Google Places Autocomplete**
Initialize the autocomplete listener in a `useEffect`.
```typescript
// client/src/pages/Map.tsx
useEffect(() => {
  if (showManualAdd && window.google) {
    const input = document.getElementById('address') as HTMLInputElement;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['address'],
      fields: ['formatted_address', 'geometry']
    });
    // Add bias based on default_origin_city if available
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        setManualData(prev => ({
          ...prev,
          address: place.formatted_address || '',
          lat: place.geometry!.location!.lat(),
          lng: place.geometry!.location!.lng()
        }));
      }
    });
  }
}, [showManualAdd]);
```

- [ ] **Step 4: Commit Task 2**
```bash
git add client/src/pages/Map.tsx
git commit -m "feat: improve category formatting and implement address autocomplete"
```

---

### Task 3: Users Screen CSV Refactoring

**Files:**
- Modify: `client/src/pages/Users.tsx`

- [ ] **Step 1: Update `handleFileChange` for headerless CSVs**
Refactor parsing logic.
```typescript
// client/src/pages/Users.tsx
Papa.parse(file, {
  header: true, // Keep header mode for detection
  skipEmptyLines: true,
  complete: (results) => {
    let data = [];
    if (results.meta.fields && results.meta.fields.length > 0) {
      // Logic for CSV with headers
      data = results.data.map((row: any) => ({
        email: row.Email || row.email,
        name: row.Name || row.name || '',
        role: row.Role || row.role || 'Volunteer',
        rolls_up_to_email: row['Rolls Up To'] || row.rolls_up_to_email || ''
      }));
    } else {
      // Logic for CSV without headers
      data = results.data.map((row: any) => {
        const values = Object.values(row);
        return {
          email: values[0] || '',
          name: values[1] || '',
          role: values[2] || 'Volunteer',
          rolls_up_to_email: values[3] || ''
        };
      });
    }
    setImportData(data.filter(u => u.email));
    setShowPreview(true);
  }
});
```

- [ ] **Step 2: Commit Task 3**
```bash
git add client/src/pages/Users.tsx
git commit -m "feat: support headerless and single-column CSV imports"
```

---

### Task 4: List Screen Filtering UI

**Files:**
- Modify: `client/src/pages/List.tsx`

- [ ] **Step 1: Add Filtering State**
```typescript
// client/src/pages/List.tsx
const [filterText, setFilterText] = useState('');
const [filterCategory, setFilterCategory] = useState('All');
```

- [ ] **Step 2: Implement Filter Toolbar**
Add the UI elements before the table.
```typescript
// client/src/pages/List.tsx
<div className="filter-toolbar">
  <input 
    type="text" 
    placeholder="Filter by name or address..." 
    value={filterText} 
    onChange={e => setFilterText(e.target.value)} 
  />
  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
    <option value="All">All Categories</option>
    {[...new Set(locations.map(l => l.category).filter(Boolean))].map(cat => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Update Rendering Logic**
Filter the `locations` array.
```typescript
// client/src/pages/List.tsx
const filteredLocations = locations.filter(loc => {
  const matchesText = loc.name.toLowerCase().includes(filterText.toLowerCase()) || 
                      loc.address.toLowerCase().includes(filterText.toLowerCase());
  const matchesCat = filterCategory === 'All' || loc.category === filterCategory;
  return matchesText && matchesCat;
});
// ... map over filteredLocations instead of locations
```

- [ ] **Step 4: Commit Task 4**
```bash
git add client/src/pages/List.tsx
git commit -m "feat: add filtering UI to the List screen"
```
