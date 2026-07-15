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
3. **Frontend Integration**: Plumbed the new `notes` field through the entire user interface. A multi-line textarea for notes was added to the "Manually Add" modal. Map marker Popups were updated to dynamically display `notes` inline with other metadata if it exists. Finally, `LocationDetails.tsx` (the "Details" button view) was updated to render the full text string.
