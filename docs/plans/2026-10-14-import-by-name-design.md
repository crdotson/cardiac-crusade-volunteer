# Import by Business Name - Design Document

**Date:** 2026-10-14  
**Status:** Approved  
**Author:** Antigravity  

## 1. Overview
The "Import by Name" feature allows administrators and city coordinators to search Google Maps for businesses matching a given business name (e.g. "Starbucks", "Planet Fitness", "Kroger") in their active region, view the returned candidates, and import selected businesses into the application database.

## 2. Requirements & User Intent
* **Role Permissions**: Accessible by `Application Administrator` and `City Coordinator`.
* **Geographic Scope**: Automatically targets the area around the current map center / viewport without requiring the user to type a city name. When accessed from the Locations List view, it defaults to the configured `default_map_center` from settings.
* **Category Mapping**: Automatically uses the category returned by Google Places (e.g. `places.primaryTypeDisplayName` or `places.primaryType`), formatted into clean human-readable text.
* **Deduplication**: Filters out businesses that already exist in the database (via string similarity on name and address).
* **Grid Auto-Assignment**: When imported, locations falling inside assigned volunteer grid squares are automatically assigned to those volunteers with `assignment_type = 'Grid'`.

## 3. Architecture & API Design

### Endpoint: `POST /api/locations/search-by-name`
* **Access Control**: Authenticated via JWT, authorized for roles `Application Administrator` and `City Coordinator`.
* **Payload**:
  ```json
  {
    "name": "Planet Fitness",
    "center": { "lat": 38.0406, "lng": -84.5037 },
    "radiusMiles": 25
  }
  ```
* **Processing**:
  1. Retrieve `google_api_key` and `google_places_limit` from `settings` table.
  2. Parse the target coordinates (fallback to `settings.default_map_center` if not provided).
  3. Call Google Places API (New) `https://places.googleapis.com/v1/places:searchText`:
     * `textQuery`: `<business name>`
     * `locationBias`: circular area centered at `{ latitude, longitude }` with radius in meters.
     * `pageSize`: up to 20, looping with `nextPageToken` up to `google_places_limit`.
     * Headers: `X-Goog-FieldMask`: `places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.primaryType,places.primaryTypeDisplayName,places.types,nextPageToken`.
  4. Query existing locations from PostgreSQL database.
  5. Compare each result against existing locations using `stringSimilarity.compareTwoStrings` on lowercase name and address (> 0.8 threshold).
  6. Return unique candidates with fields: `{ name, address, lat, lng, phone, category }`.

### Endpoint: `POST /api/locations/confirm-import` (Existing)
* Used directly to batch-insert selected candidates, automatically check against `grid_squares` boundaries, and persist records as `Unvisited`.

## 4. Frontend Design

### Components & Entry Points
* **Action Buttons**:
  * Added to `CreateImportActions.tsx` (for the Locations List view).
  * Added to `Map.tsx` (for the Map view toolbar).
* **Modal Dialog**:
  * **Search View**: Single input for business name, search button, cancel button.
    * When triggered on Map view: reads `map.getCenter()`.
    * When triggered on List view: uses `settings.default_map_center`.
  * **Review & Selection View**:
    * Checkbox list of returned candidates (all pre-selected by default).
    * Candidate details: Name, Address, Category (formatted), Phone.
    * Filter bar: text filter, category dropdown, "Select Filtered", "Deselect All", counter.
    * "Confirm Import" and "Cancel" buttons.
    * Loading indicators during search and import.

## 5. Error Handling & Edge Cases
* **Missing Google API Key**: Returns HTTP 400 with a descriptive error message.
* **Google API Errors / Permissions**: Captures response error status (e.g. `PERMISSION_DENIED`) and presents actionable feedback.
* **Zero Results**: Displays "No businesses matching '<name>' found nearby" and keeps search input accessible.
* **Malformed Coordinates**: Falls back gracefully to `settings.default_map_center` or system default.

## 6. Verification Plan
* Compile and type-check with `npm run build` in `client`.
* Verify backend syntax and route handling.
* End-to-end test searching and importing candidates.
