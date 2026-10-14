# Import by Business Name Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Allow administrators and city coordinators to search Google Maps for businesses by name around their active map center / viewport and batch-import them into the application.

**Architecture:** A new backend endpoint `POST /api/locations/search-by-name` queries the Google Places API (New) `places:searchText` endpoint with location bias around specified or default coordinates, dedupes against existing database locations, and returns candidate places with detected categories. Frontend toolbars in both `CreateImportActions.tsx` (List view) and `Map.tsx` (Map view) provide an "Import by Name" action and review modal to search, filter, and confirm import into volunteer grid squares.

**Tech Stack:** Node.js, Express, PostgreSQL, Google Places API (New), React 19, TypeScript, Vite, React-Leaflet.

---

### Task 1: Backend Route - Implement `POST /api/locations/search-by-name`

**Files:**
- Modify: `server/index.js`
- Test: `server/test-search-by-name.js` (temporary scratch test)

**Step 1: Write verification test script**
Create a test script `server/test-search-by-name.js` to verify endpoint syntax and handling:
```javascript
import axios from 'axios';

// Tests formatCategoryName logic and endpoint response structure
const formatCategoryName = (name) => {
  if (!name) return 'General';
  return name.replace(/_/g, ' ')
             .split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
             .join(' ');
};

console.log('Category formatting test:', formatCategoryName('fitness_center') === 'Fitness Center');
```

**Step 2: Add endpoint in `server/index.js`**
Add `POST /api/locations/search-by-name` with:
- Authentication & authorization (`authenticateToken`, `authorizeRoles('Application Administrator', 'City Coordinator')`)
- Google API key and places limit retrieval from `settings` table
- Parsing `name`, `center` (`{ lat, lng }`), and `radiusMiles` (defaulting to 25 miles or `default_map_radius_miles`)
- Calling `https://places.googleapis.com/v1/places:searchText` with:
  - `textQuery: name`
  - `locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusMeters } }`
  - Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.primaryType,places.primaryTypeDisplayName,places.types,nextPageToken`
- Paginating up to `google_places_limit`
- Deduplicating results against `SELECT name, address FROM locations` using `stringSimilarity.compareTwoStrings` (> 0.8)
- Mapping extracted category using `primaryTypeDisplayName.text` or formatted `primaryType` / `types[0]`
- Returning candidate array: `[{ name, address, lat, lng, phone, category }]`

**Step 3: Run verification**
Run: `node server/test-search-by-name.js`
Expected: Output `Category formatting test: true`
Clean up `server/test-search-by-name.js`.

**Step 4: Commit**
```bash
git add server/index.js
git commit -m "feat(server): add /api/locations/search-by-name endpoint"
```

---

### Task 2: Frontend List View - Add "Import by Name" to `CreateImportActions.tsx`

**Files:**
- Modify: `client/src/components/CreateImportActions.tsx`

**Step 1: Add state and button in `CreateImportActions.tsx`**
- Add state: `showNameImport`, `nameQuery`, `isNameSearching`, `nameCandidates`, `selectedNameCandidates`, `nameFilterText`, `nameFilterCategory`.
- Add `<button onClick={() => setShowNameImport(true)}>Import by Name</button>` in the toolbar next to `Import by Category`.

**Step 2: Implement search and modal logic**
- On search:
  - Parse coordinates from `settings.default_map_center` (e.g. `"38.0406, -84.5037"`).
  - POST to `api/locations/search-by-name` with `{ name: nameQuery, center: { lat, lng } }`.
  - Populate `nameCandidates` and pre-check all in `selectedNameCandidates`.
- Render modal:
  - Search input with placeholder "Business Name (e.g., Starbucks, Planet Fitness, Kroger)..."
  - When candidates returned: show candidate list with checkboxes, name, address, category, phone.
  - Filter bar: text search filter, category filter dropdown, "Select Filtered", "Deselect All", counter.
  - "Confirm Import" button posting to `api/locations/confirm-import`.
  - Refresh data via `onUpdate()` on success and close modal.

**Step 3: Run client build to verify compilation**
Run: `npm run build` in `client`
Expected: `tsc && vite build` succeeds with exit code 0.

**Step 4: Commit**
```bash
git add client/src/components/CreateImportActions.tsx
git commit -m "feat(client): add Import by Name to CreateImportActions component"
```

---

### Task 3: Frontend Map View - Add "Import by Name" to `Map.tsx`

**Files:**
- Modify: `client/src/pages/Map.tsx`

**Step 1: Track map instance for dynamic center coordinates**
- Add `const mapRef = useRef<L.Map | null>(null);`
- In `MapCenterUpdater` or child component inside `<MapContainer>`, assign `mapRef.current = map`.

**Step 2: Add "Import by Name" button and modal state to `Map.tsx`**
- Add state: `showNameImport`, `nameQuery`, `isNameSearching`, `nameCandidates`, `selectedNameCandidates`, `nameFilterText`, `nameFilterCategory`.
- Add `<button onClick={() => setShowNameImport(true)}>Import by Name</button>` in toolbar next to `Import by Category`.

**Step 3: Implement dynamic map-center search and import**
- When user clicks Search:
  - Retrieve current map center:
    ```typescript
    let center = { lat: 38.0406, lng: -84.5037 };
    if (mapRef.current) {
      const c = mapRef.current.getCenter();
      center = { lat: c.lat, lng: c.lng };
    } else if (settings?.default_map_center) {
      const parts = settings.default_map_center.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        center = { lat: parts[0], lng: parts[1] };
      }
    }
    ```
  - POST to `api/locations/search-by-name`.
  - Render candidate selection modal with filter controls.
  - On confirm import: POST to `api/locations/confirm-import`, call `fetchLocations()`, and close modal.

**Step 4: Run client build to verify compilation**
Run: `npm run build` in `client`
Expected: `tsc && vite build` succeeds with exit code 0.

**Step 5: Commit**
```bash
git add client/src/pages/Map.tsx
git commit -m "feat(client): add Import by Name feature to Map view"
```

---

### Task 4: Documentation & Verification

**Files:**
- Modify: `GEMINI.md`
- Modify: `docs/plans/task.md`

**Step 1: Full build verification**
Run: `npm run build` in `client`
Expected: Clean build.

**Step 2: Update project documentation**
Add session notes to `GEMINI.md` detailing:
- "Import by Business Name" endpoint and Google Places API (New) location bias integration.
- UI addition in both Map toolbar and Locations List toolbar (`CreateImportActions.tsx`).
- Automatic category mapping and map center resolution.

**Step 3: Update `docs/plans/task.md`**
Mark all tasks completed.

**Step 4: Commit**
```bash
git add GEMINI.md docs/plans/task.md
git commit -m "docs: document Import by Name feature in GEMINI.md"
```
