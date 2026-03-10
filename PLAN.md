# Cardiac Crusade Volunteer App - Implementation Plan

This document outlines the execution strategy for the Cardiac Crusade Volunteer web application.

## 1. Tech Stack Selection
*   **Frontend**: React (TypeScript)
    *   **Styling**: Vanilla CSS (Modern CSS features like variables, grid, and flexbox)
    *   **Maps**: Leaflet.js with Leaflet Geoman for drawing/resizing rectangles
*   **Backend**: Node.js (Express) with TypeScript
*   **Database**: PostgreSQL (Containerized with a local volume mount for persistence)
*   **Authentication**:
    *   `@simplewebauthn/server` & `@simplewebauthn/browser` for FIDO2/Passkeys
    *   Passport.js for Facebook and Google Social Login
    *   JSON Web Tokens (JWT) for session management
*   **External APIs**: Google Places API (for location imports)
*   **Deployment**: Docker & Docker Compose (supporting future K8s migration)

## 2. Database Schema (Conceptual)
*   **`users`**: `id`, `email`, `password_hash`, `role` (Admin, City Coordinator, CHAARG Leader, Volunteer), `roll_up_to_id` (FK to `users`), `fido2_credentials` (JSONB), `social_ids` (JSONB).
*   **`locations`**: `id`, `name`, `address`, `lat`, `lng`, `phone`, `status` (Enum), `category`, `assigned_volunteer_id` (FK to `users`), `assigned_by_id` (FK to `users`), `assignment_type` (Manual vs. Area).
*   **`audit_logs`**: `id`, `location_id`, `user_id`, `previous_status`, `new_status`, `timestamp`.
*   **`assignments`**: `id`, `user_id`, `geom` (Rectangle bounds), `created_at`.
*   **`settings`**: `key`, `value` (for Admin settings like Google API Key, backup metadata).
*   **`otp_storage`**: `email`, `otp_hash`, `expires_at`, `attempts`, `blocked_until`.

## 3. Implementation Phases

### Phase 1: Foundation & Authentication
*   [ ] Initialize React and Express projects with TypeScript.
*   [ ] Set up Docker Compose for PostgreSQL and the application.
*   [ ] Implement the Multi-Method Authentication:
    *   Email/Password with bcrypt.
    *   FIDO2/Passkey registration and login.
    *   Social Login (Google & Facebook).
    *   Forgot Password flow (OTP via email with brute-force protection).
*   [ ] Create the Initial Admin account on startup.

### Phase 2: User Management & Settings
*   [ ] **Users View**:
    *   Role-based hierarchy logic for creating and viewing users.
    *   "Roll-up-to" logic implementation.
    *   Visibility filters based on the user's role and hierarchy position.
*   [ ] **Settings View**:
    *   Password/Passkey/Social management.
    *   Admin controls: Google API configuration, Database Backup/Restore logic.

### Phase 3: Map & List Foundation
*   [ ] Integrate Leaflet.js.
*   [ ] Implement **List View** for browsing locations.
* [ ] Implement **Google Places Import**:
    *   Dropdown using `CATEGORIES.txt`.
    *   Lexington, KY as default city.
    *   Fuzzy deduplication logic (Name + Address).
    *   Pre-import review screen with selection toggles.
    *   **New**: Automatic assignment of imported locations if they fall within existing assignment rectangles.


### Phase 4: Assignment & Interaction
*   [ ] **Geographical Assignment**:
    *   Implement rectangle drawing and resizing.
    *   Logic to count and assign locations within bounds.
*   [ ] **Manual Assignment**:
    *   Map/List selection logic.
    *   Precedence logic (Manual override over Area).
*   [ ] **Location Details**:
    *   External link to `aed.new`.
    *   Status update workflow with Audit Logging.
    *   Confetti animation and confirmation for "Done" statuses.

### Phase 5: Reporting & Refinement
*   [ ] **Reporting View**:
    *   Aggregate metrics (Mapped vs. Other statuses).
    *   Roll-up views for City Coordinators and CHAARG Leaders.
*   [ ] **Mobile Optimization**: Ensure pinch-to-zoom and touch interactions work for map resizing.
*   [ ] **Final Audit**: Verify all audit logs and role permissions.

### Phase 6: Packaging & Documentation
*   [ ] Finalize Dockerfile for production-ready builds.
*   [ ] Document local setup and future K8s deployment considerations.

## 4. Key Logic Challenges
*   **Fuzzy Matching**: Using `string-similarity` or Jaro-Winkler distance to detect duplicate businesses during import.
*   **Hierarchy Filtering**: Ensuring complex SQL queries or backend logic correctly filter users based on the "roll-up-to" chain.
*   **Area Assignment**: Efficiently updating location assignments when a rectangle is modified or a manual override is applied.
