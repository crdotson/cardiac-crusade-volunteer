# Import by Name Search Radius Parameter - Design Document

**Date:** 2026-10-16  
**Status:** Approved  
**Author:** Antigravity  

## 1. Overview
The "Import by Name" feature allows administrators and city coordinators to search Google Maps for businesses by name. This update introduces an editable "Search Radius (miles)" parameter in the import modal that defaults to the "Default Map Radius (miles)" configured in Admin Settings.

## 2. Requirements & User Intent
* **Default Value**: The search radius input field pre-populates with the `default_map_radius_miles` setting from the database (falling back to `5` if unconfigured).
* **Editable Input**: Users can adjust the search radius directly in the "Import by Business Name" modal before searching.
* **API Boundary Safeguards**: Google Places API (New) limits circular bias to a maximum radius of 50,000 meters (~31.06 miles). The UI sets `max="31"` and the backend clamps the radius between 500m and 50,000m to prevent `400 Bad Request` exceptions.
* **Component Coverage**: Applied consistently to both the Map view (`Map.tsx`) and the Locations List view (`CreateImportActions.tsx`).

## 3. Architecture & Data Flow

### Frontend (`CreateImportActions.tsx` and `Map.tsx`)
* Maintain a state variable `nameRadiusInput` initialized to `settings?.default_map_radius_miles || '5'`.
* In the search dialog, render a number input with label "Search Radius (miles)" alongside "Business Name".
* Pass `radiusMiles: parseFloat(nameRadiusInput) || parseFloat(settings?.default_map_radius_miles) || 5` in the payload to `POST /api/locations/search-by-name`.

### Backend (`server/index.js`)
* In `POST /api/locations/search-by-name`:
  * Read `radiusMiles` from request body.
  * If missing or invalid, read `default_map_radius_miles` from the `settings` table, defaulting to `5`.
  * Calculate radius in meters: `Math.min(50000, Math.max(500, Math.round(miles * 1609.34)))`.
  * Execute `places:searchText` with `locationBias.circle`.

## 4. Verification Plan
* Validate frontend build with `npm run build` in `client`.
* Validate backend syntax with `node --check server/index.js`.
* Update `docs/plans/task.md` and `GEMINI.md`.
