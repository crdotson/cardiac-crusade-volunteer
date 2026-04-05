# Design Spec: UI & Data Import Enhancements

## 1. Overview
Further refine the application by improving the address entry experience, expanding CSV import flexibility, and unifying the filtering UI across different screens. This also includes technical fixes for password manager interference and better category display.

## 2. Goals & Success Criteria
- **G1**: Prevent 1Password from misinterpreting the address field as a password.
- **G2**: Implement Google Places Autocomplete in the "Manually Add" modal, biased by the default origin city.
- **G3**: Enhance the Users screen CSV import to handle headerless or single-column files.
- **G4**: Unify the filtering UI on the List screen with the Map's import results experience.
- **G5**: Respect the configured Google Places search limit for area-based searches.
- **Success Criteria**: 1Password ignores the address field; Address autocomplete works correctly; Headerless CSVs can be imported; List screen has a functional filter toolbar; Category names are formatted professionally.

## 3. Architecture & Data Flow

### 3.1 Backend Updates (`server/index.js`)
- **API: Search Nearby**:
  - Update `POST /api/locations/search-nearby` to fetch `google_places_limit` from the `settings` table.
  - Pass this limit to the Google Places API request (`maxResultCount`).

### 3.2 Frontend Updates

#### 3.2.1 Global Config (`client/index.html`)
- Load the Google Maps JavaScript API with the Places library.
- Note: The API key should be fetched from the backend settings dynamically if possible, or provided via environment variable during build.

#### 3.2.2 Map Screen (`client/src/pages/Map.tsx`)
- **Address Field**:
  - Add `name="address"`, `id="address"`, `autoComplete="street-address"`, and `data-1p-ignore`.
  - Initialize `google.maps.places.Autocomplete` on the address input within a `useEffect`.
  - Use `default_origin_city` from settings to set the autocomplete bounds/bias.
- **Category Formatting**:
  - Update `formatCategoryName` helper:
    - Replace all underscores with spaces.
    - Capitalize the first letter of each word.
    - Example: `amusement_park` -> "Amusement Park", `point_of_interest` -> "Point Of Interest".

#### 3.2.3 Users Screen (`client/src/pages/Users.tsx`)
- **CSV Import Logic**:
  - Modify `handleFileChange` to detect if headers are present (check if `results.meta.fields` is empty).
  - **No Headers Logic**: Map columns by index: `0: Email`, `1: Name`, `2: Role`, `3: Rolls Up To`.
  - **Single Column**: If `row.length === 1`, treat it as `Email`.
  - Ensure `Role` defaults to "Volunteer".

#### 3.2.4 List Screen (`client/src/pages/List.tsx`)
- **Filter Toolbar**:
  - Implement a `filter-toolbar` component above the table.
  - Controls: Search input (text), Category dropdown (select).
- **Filtering Logic**:
  - Filter `locations` array before rendering the `<tbody>`.
  - Criteria: Name/Address match (text), Category match (select).

## 4. UI/UX Design

### 4.1 List Screen Filter Toolbar
```
[ Filter by name or address... ] [ All Categories |v]
```
- The toolbar should match the styling of the Map's import filtering toolbar for consistency.

## 5. Security & Error Handling
- **API Key Security**: Ensure the Google API key remains secure and is only used from authorized origins.
- **CSV Validation**: Handle empty rows or rows with missing emails gracefully during import.

## 6. Testing Strategy
- **Manual Verification**:
  - Confirm 1Password no longer suggests passwords for the address field.
  - Verify address autocomplete results are relevant to the configured origin city.
  - Test CSV import with files having: headers, no headers, and only email addresses.
  - Verify that the List screen filters correctly in real-time.
  - Confirm that "Point Of Interest" and other categories are displayed nicely.
  - Check that the number of results from a large area search matches the `google_places_limit` setting.
