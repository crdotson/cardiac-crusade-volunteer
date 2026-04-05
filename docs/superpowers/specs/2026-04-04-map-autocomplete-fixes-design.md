# Design Spec: Map Autocomplete & Geocoding Fixes

## 1. Overview
Resolve issues with manual location addition by fixing the Google Places Autocomplete visibility and implementing a geocoding fallback to ensure every location has valid GPS coordinates.

## 2. Goals & Success Criteria
- **G1**: Ensure Google Places Autocomplete dropdown is visible and functional in the "Manually Add" modal.
- **G2**: Implement a backend geocoding API to resolve addresses to coordinates.
- **G3**: Automatically geocode addresses during manual submission if coordinates are missing.
- **Success Criteria**: Users see autocomplete suggestions when typing an address; coordinates are automatically retrieved and saved for all manual entries.

## 3. Architecture & Data Flow

### 3.1 Backend Updates (`server/index.js`)
- **API: Geocoding Proxy**:
  - New `POST /api/locations/geocode` endpoint.
  - Accepts `address`.
  - Uses Google Geocoding API to return `lat` and `lng`.
- **API: Search Nearby**:
  - Keep `maxResultCount` capped at 20 (API restriction).

### 3.2 Frontend Updates (`client/src/pages/Map.tsx`)
- **Autocomplete Visibility**:
  - Add CSS to `client/src/index.css` to force `.pac-container` (Google's dropdown) to have a high `z-index` (e.g., 2000).
- **Autocomplete Initialization**:
  - Improve the `useEffect` to poll for `window.google` or use a listener to ensure initialization happens after the script loads.
  - Apply `default_origin_city` as a bias/filter.
- **Submission Logic**:
  - Update `handleManualSubmit`:
    - If coordinates are at default values, call the new `/api/locations/geocode` endpoint first.
    - Proceed with creation once coordinates are resolved.

## 4. UI/UX Design
- No major UI changes; the experience should simply become functional.
- The address input will now provide real-time suggestions.

## 5. Security & Error Handling
- **API Failures**: Handle cases where geocoding fails (e.g., invalid address) by showing an alert to the user.
- **Loading States**: Disable the "Add Location" button while geocoding is in progress.

## 6. Testing Strategy
- **Manual Verification**:
  - Type an address in the "Manually Add" modal and confirm suggestions appear.
  - Select a suggestion and verify the location is placed on the map.
  - Type a partial address, do *not* select a suggestion, and click "Add Location" to verify the geocoding fallback works.
