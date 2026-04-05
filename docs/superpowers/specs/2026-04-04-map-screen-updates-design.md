# Design Spec: Map Screen Updates

## 1. Overview
Update the application's Map screen to improve location management and discovery. This includes renaming existing features, adding circular area-based imports, manual location entry, and UI refinements for better organization.

## 2. Goals & Success Criteria
- **G1**: Improve the "Import Locations" workflow with category and area-based options.
- **G2**: Enable manual addition of locations with mandatory and optional fields.
- **G3**: Streamline the Map UI by removing redundant text and grouping actions.
- **G4**: Allow administrative configuration of the default origin city for search/autocomplete.
- **Success Criteria**: Users can import locations within a drawn circle, manually add locations with geocoding, and filter results with an "Excel-like" UI.

## 3. Architecture & Data Flow

### 3.1 Backend Updates (`server/index.js`)
- **Settings**: Add `default_origin_city` to the `settings` table (default: "Lexington, KY").
- **API: Search by Area**: New `POST /api/locations/search-nearby` endpoint.
  - Accepts `lat`, `lng`, and `radius` (meters).
  - Uses Google Places `searchNearby` (v1) API.
  - Returns a list of businesses within the specified circular area.
- **API: Manual Add**: New `POST /api/locations` endpoint.
  - Accepts `name`, `address`, `lat`, `lng`, `phone`, `category`, `assigned_volunteer_id`, and `status`.
  - Performs duplicate checks similar to the import logic.
- **API: Geocoding/Autocomplete Proxy**: (Optional but recommended) Endpoints to securely proxy Google Places Autocomplete and Geocoding requests to avoid exposing the API key on the frontend.

### 3.2 Frontend Updates (`client/src/pages/Map.tsx`)
- **Header Refactor**:
  - Remove `<h2>Map View</h2>`.
  - Implement a `ButtonGroup` component for "Import by Category", "Import by Area", and "Manually Add".
- **Import by Area Logic**:
  - Integrate Leaflet-Geoman's `Circle` draw tool.
  - On `pm:create` for a Circle, capture `center` and `radius` to trigger the search.
- **Results Modal**:
  - Unified modal for both Category and Area imports.
  - **Excel-like Filtering**:
    - Real-time text filter for name/address.
    - Multi-select dropdown for categories returned in the search results.
    - "Select All" / "Deselect All" checkboxes.
- **Manual Add Modal**:
  - Form with fields: Name, Address (with Google Places Autocomplete), Phone, Category, Assigned To, Status.
  - "📍 Use My Location" button: Uses `navigator.geolocation` and reverse-geocoding.
  - Google Places Autocomplete: Biased/Filtered by `default_origin_city`.

### 3.3 Settings Updates (`client/src/pages/Settings.tsx`)
- Add an input field for `default_origin_city` in the Admin Controls section.
- Ensure the value is saved to and retrieved from the backend settings.

## 4. UI/UX Design

### 4.1 Button Group Layout
```
[ Import by Category ] [ Import by Area ] [ Manually Add ] | [ Assign to: Select Volunteer ]
```
- The `|` represents a visual separator (divider or increased margin).

### 4.2 Search Results Modal (Excel-style)
- Header: `Importing from Google Places`
- Toolbar: `[ Search Box ] [ Category Filter ] [ Select All ]`
- Body: Scrollable list of results with checkboxes.
- Footer: `[ Cancel ] [ Confirm Import (# selected) ]`

## 5. Security & Error Handling
- **API Key Protection**: All Google API calls should ideally be proxied through the backend or use restricted keys if on the frontend.
- **Duplicate Prevention**: Both manual and imported locations must be checked against the existing database using string similarity and/or exact address matching.
- **Geocoding Failures**: Gracefully handle cases where an address cannot be resolved to coordinates.

## 6. Testing Strategy
- **Unit Tests**: Test the string similarity logic and backend search result parsing.
- **Integration Tests**: Verify that drawing a circle on the map correctly triggers the search-nearby API.
- **Manual Verification**:
  - Confirm that changing the `default_origin_city` in settings updates the autocomplete bias.
  - Verify that manual additions correctly assign users and statuses.
  - Test the "Excel-like" filtering with a large set of results (>20).
