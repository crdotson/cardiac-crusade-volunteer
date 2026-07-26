# Cardiac Crusade Volunteer App - Deployment Summary

## Application Overview
- **Type**: Full-stack application.
- **Frontend**: Vite/React (supports path-agnostic builds via `VITE_BASE_PATH`).
- **Backend**: Node.js/Express.
- **Database**: PostgreSQL (requires `PGDATA` to be a subdirectory of the mount point, e.g., `/var/lib/postgresql/data/pgdata`).

## Infrastructure & Deployment
The application is deployed on a k3s cluster (`stormbringer`) using a GitOps workflow.

### CI/CD Workflow
1. **Trigger**: Pushing changes to the source repository (GitHub) triggers a Tekton pipeline.
2. **Tekton Pipeline (`build-pipeline`)**:
   - **`fetch-repository`**: Clones the source code.
   - **`build-image`**: Uses Kaniko to build the container image. It passes `VITE_BASE_PATH` as a build argument to ensure the frontend is correctly configured.
   - **`update-manifest`**: A Python-based Task that:
     - Clones the `stormbringer-k3s-config` repository.
     - Generates/Updates the `deployment.yaml` with the new image tag (from the local registry at `192.168.205.12:30501`).
     - Includes all necessary resources: `PersistentVolumeClaim` (Longhorn), PostgreSQL `Deployment` & `Service`, and the application `Deployment`, `Service`, and Traefik `IngressRoute`.
     - Pushes the updated manifests back to the config repo.
3. **Argo CD**:
   - Watches the `stormbringer-k3s-config` repository (`apps/cardiac-crusade-volunteer` path).
   - Automatically syncs changes to the cluster.

### Key Deployment Details
- **Test URL**: [https://test-cardiaccrusade.dotson97.org](https://test-cardiaccrusade.dotson97.org)
- **Deployment Time**: Changes typically take about **3 minutes** to reflect on the test site after a push.
- **Registry**: Uses a local insecure registry at `192.168.205.12:30501`. All cluster nodes must have this configured in `/etc/rancher/k3s/registries.yaml`.
- **TLS**: Uses the `dotson97-wildcard-tls` secret for HTTPS.

## Operational Notes
- The application is now **path-agnostic**, but for the test deployment, it is mounted at the root of the `test-cardiaccrusade.dotson97.org` subdomain.
- Future changes to the deployment structure (e.g., adding environment variables) should be made in the `git-update-manifest` Tekton Task script.

## AI Agent Guidelines
1. **Committing Changes**: When asked to commit changes, always run `git status` to inspect each changed file. Ensure you clean up by removing any unneeded/temporary files and only add/commit the files that are necessary.
2. **Build Verification**: After making edits, always run an npm build (e.g. `npm run build` in the `client` directory) to verify that there are no compilation errors and ensure that the Dockerfile will successfully build in CI.
3. **Sandbox Limitations**: Note that the agent is running in an isolated sandbox. Actions that require external git credentials (like `git push`), an interactive local Docker daemon (`docker build`), or similar local system privileges will not work. Be sure to inform the user when these limits are encountered so they can perform the action themselves.
4. **Project Log**: After each commit, update the project notes with any changes made and any difficulties encountered so that future sessions can avoid those difficulties.

## Recent Changes & Learnings

### Session: Grid Generation & Google API Pagination
**Changes Made:**
1. **Grid UI:** Replaced the native Javascript `prompt()` with a custom React modal for grid size generation, as browsers silently block `prompt()` within complex React workflows.
2. **Geoman Listeners:** Modified `MapEvents.tsx` to handle `pm:create` events using `useRef` rather than putting dependencies in the `useEffect` array, preventing Leaflet-Geoman's listener dropping drawing events.
3. **Map UX:** Configured Geoman to instantly clear shape layers (`e.layer.remove()`) after yielding their bounds. Replaced the "Import by Area" Tool from `Circle` to `Rectangle`. Visually hid all default Geoman toolbar buttons (`drawRectangle: false`) to keep the interface clean while retaining programmatic drawing functionality.
4. **Grid Wipe Protocol:** Adjusted the generated grid endpoint to require user confirmation, then reliably wipe existing grids and decouple current assignment IDs from the database before replacement.
5. **Pagination Architecture:** Re-wrote Google API calls (`/api/locations/search` & `/api/locations/search-nearby`) to feature `while` loops that natively negotiate `nextPageToken` properties up to the database's `google_places_limit`. "Import by Area" API converted entirely to `searchText` employing `locationRestriction.rectangle` bounding constraints.

**Difficulties Encountered:**
- **Places API "New" Limitations:** The modern `searchNearby` API endpoint strictly defaults to a maximum 20 results and absolutely does not support pagination tokens. It also severely restricts multiple-category queries. 
- **Legacy Trade-offs:** Avoid Legacy Google API endpoints (`maps/api/place/nearbysearch/*`) due to loss of phone numbers and enforced 2-second timeout suspensions required between page tokens.
- **Solution:** Always utilize the **New `searchText`** endpoint which accepts `pageToken` and geographic limits (`locationRestriction`). This maintains response speed and robust metadata while simulating Area searches precisely.
- **React Effect Unmounting:** Integrating leaflet/geoman drawing controls straight into React `useEffect` structures creates fatal sync issues. Always decouple the active configuration into refs `useRef()` that safely proxy events to avoid detachments mid-draw!

### Session: Fixing Location Import & Geocoding Constraints
**Changes Made:**
1. **Assignments Table Deprecation Fix:** Updated the backend `confirm-import` route to query `grid_squares` instead of `assignments` when mapping bounds. The `assignments` table was previously dropped in favor of the new grid system, which caused "Import by Category" and "Import by Area" to fail with a `relation "assignments" does not exist` database error.
2. **Robust Geocoding Extraction:** Updated the autocomplete address extraction logic on the frontend (`Map.tsx`) to be universally compatible with the varying structures provided by the legacy Maps library, Google Places REST API, and modern `google.maps.places.Place` objects. This resolves a bug where coordinate properties were mapped to `undefined` during autocomplete selection, yielding a `null value in column "lat"` Postgres exception when users attempted to manually add a location.

**Difficulties Encountered:**
- The new `PlaceAutocompleteElement` can yield varying representations of a `Place` object depending on what libraries are loaded, sometimes providing `.location` as a `google.maps.LatLng` (with functions like `.lat()`) and sometimes providing properties (like `.latitude`). Added explicit checks for both functional and property-based coordinate structures to prevent `undefined` properties from skipping geocoding validation.

### Session: Removing Browser-Native Prompts & Fixing Bulk Deletion
**Changes Made:**
1. **Removed `window.confirm` Modal Blocks:** Removed all usages of native `window.confirm` dialogues across the Map component (including bulk delete, single delete, and grid generation warnings). Complex React state changes, combined with user preference settings, often cause browsers to silently block these native dialogues resulting in features "doing nothing". Replaced them with robust React state-driven modals.
2. **Delete All Locations:** Added a robust `POST /api/locations/bulk-delete-all` route to the backend. Added a `Delete All Locations` button to the frontend `Map.tsx` toolbar, heavily restricted by `user?.role === 'Application Administrator'`. Created an explicit warning modal requiring user confirmation before wiping the database.

**Difficulties Encountered:**
- **Silently Blocked Dialogues:** Features using `window.confirm` failed without console errors because the browser intercepted and auto-declined the native prompt. Always favor custom HTML/React modals for user confirmation rather than relying on `prompt()` or `confirm()`.

### Session: Resolving Foreign Key Restraints & Consolidating Google APIs
**Changes Made:**
1. **Audit Logs Cleanup**: All location deletion endpoints (`DELETE /api/locations/:id`, `POST /api/locations/bulk-delete`, `POST /api/locations/bulk-delete-all`) were updated to first query `DELETE FROM audit_logs` for matching `location_id` rows before attempting to drop the locations. This resolves `foreign key constraint` Postgres violations that previously aborted location deletion whenever a location's status had been altered and logged.
2. **Consolidating Geocoding APIs**: The `/api/locations/geocode` backend route was completely refactored to utilize the **Places API (New) `searchText`** endpoint instead of the legacy Geocoding API. This consolidates external dependencies so the application only requires a single enabled API in Google Cloud Console, preventing manual additions from failing with a `400 Bad Request` if the user hadn't manually enabled the separate legacy Geocoding API.

### Session: Implement Import from CSV Feature
**Changes Made:**
1. **Frontend CSV Parsing**: Integrated `papaparse` in `Map.tsx` to handle CSV file reading directly in the browser. Added strict logic to ensure headers either accurately define a `name,address` structure, a 6-column `name,address,phone,category,status,assignto` structure, or are omitted entirely (in which case it enforces column count validation). Added an `Application Administrator` restricted "Import from CSV" modal to guide the process.
2. **Backend CSV Processing**: Added `POST /api/locations/import-csv` to process bulk row uploads. The backend iteratively geocodes each address via Google Places API (reporting failures), checks the database to skip existing addresses, and dynamically creates missing `Volunteer` user profiles if an `assignto` name does not exist. Results, including failures and skips, are clearly aggregated and returned to the admin.

### Session: Implement Notes Field for Locations
**Changes Made:**
1. **Database Schema**: Added an `ALTER TABLE locations ADD COLUMN IF NOT EXISTS notes TEXT;` instruction to the backend `initDB` routine to ensure the field initializes automatically.
2. **CSV Import Compatibility**: Upgraded the `papaparse` CSV engine logic and text instructions to expect either 2 columns (`name, address`) or 7 columns (`name, address, phone, category, status, assignto, notes`). The backend `import-csv` route was also updated to extract the 7th column and push it to the new `notes` database field.
3. **Frontend Integration**: Plumbed the new `notes` field through the entire user interface. A multi-line textarea for notes was added to the "Manually Add" modal. Map marker Popups were updated to dynamically display an *editable* textarea for notes that saves automatically on blur. The `List` view was upgraded with a new column exclusively for rendering notes. Finally, `LocationDetails.tsx` (the "Details" button view) was updated with a dedicated "Update Notes" block to modify the text string. A new backend route `PATCH /api/locations/:id/notes` was created to support these dynamic updates.
4. **Duplicate Row Logic (Allowing Duplicates)**: The database `UNIQUE(name, address)` constraint on `locations` was dropped to support multiple markers at the same address. The CSV import route checks the database for existing matches. If a row is an *exact* match (every single metadata field matches, including notes and status), it ignores it. If *any* field differs, it inserts a brand new location row, effectively allowing duplicate geographic entries with differing notes or statuses.

### Session: UI Actions in List Tab, Multi-Select Grid Claiming, and Build Versioning
**Changes Made:**
1. **Create/Import Actions in List Tab**: Created a unified, reusable `CreateImportActions.tsx` component encapsulating all location import (by Category, by Area, and CSV) and creation ("Manually Add") UI and logic. Integrated this component into both `List.tsx` and `Map.tsx`, allowing users to perform import and manual location creation directly from the Locations List view. Updated routing state handling in `Map.tsx` so clicking "Import by Area" in the List view transitions seamlessly to drawing tools on the map.
2. **Volunteer Multi-Select Grid Claiming**: Replaced immediate single-click claiming for volunteers on the map with a multi-select mode. Added a "Claim/Unclaim Squares" toggle button that changes to "Save Claims" when active. In claiming mode, clicking squares toggles their selection in pending state with immediate visual feedback (color, opacity, weight). Clicking "Save Claims" batch-updates only modified grid ownerships concurrently using `Promise.all`. Removed popup alerts instructing volunteers to click "Claim/Unclaim Squares"; clicks on grid squares outside of claiming mode are now silently ignored. While in claiming mode (`isClaimingMode`), location markers are set to `interactive={false}` and have popups disabled so that clicking on a location pin passes through directly to the underlying grid square to claim or unclaim it.
3. **Build Version in Admin Gear Menu**: Statically defined `__APP_VERSION__` in `vite.config.ts` by executing `git log -1 --format=%cd --date=short` during build (with date fallback), generating a `yyyy-mm-dd` version string updated automatically on source code changes. Displayed the version prominently in the admin gear menu in `Navbar.tsx` (`⚙️ v2026-07-25`) as well as in `Settings.tsx` under Admin Controls and the page header.
4. **List View Enhancements**: In `List.tsx`, the "Assigned To" column header and table cells are now dynamically hidden when the user's role is `Volunteer`, keeping the view concise since volunteers only see their own assigned locations. In addition, the status field in the list view was converted from a static badge (which caused white-on-white text rendering due to CSS class mismatches) to an interactive `<select>` pulldown with dark readable font formatting. Users can now directly update location status from the list screen, triggering instant API updates and celebration confetti when set to a "Done" state.
5. **Mobile Layout Optimizations & Navbar Portal**: Optimized header responsiveness in `Navbar.tsx` and `index.css` so that on mobile devices, the top header row fits cleanly on a single line without wrapping. Removed the inline version date string next to the gear icon (retaining it inside `/settings`). For volunteers on the Map tab, removed the bulky card and explanation text above the map; instead, utilized `ReactDOM.createPortal` to render the button (shortened to `"Claim Squares"`) directly into the navigation tab bar (`<li id="navbar-actions">`) alongside Map, List, and Reporting.
6. **Mobile List View Margins & Padding**: Reduced container and card padding on mobile devices for the Locations List view (`.list-container` and `.list-card` in `index.css` and `List.tsx`) from the default `2rem` (32px) down to `0.25rem` (4px) and `0.5rem` (8px) respectively, and tightened table cell padding (`0.4rem 0.35rem`). This allows the list box and table to span almost the full width of mobile screens without excessive margins.
