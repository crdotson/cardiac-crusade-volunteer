# Design Spec: Map Screen & Users Screen Updates

## 1. Overview
Update the application to improve the user experience on the Map screen, enhance location popups, and expand user management capabilities. This includes modal refinements, integrated location management in popups, and bulk user importing.

## 2. Goals & Success Criteria
- **G1**: Streamline the Map UI with improved modal controls and automated tool activation.
- **G2**: Consolidate location management by moving detail actions into map popups.
- **G3**: Enhance user records with full names and bulk creation support via CSV.
- **Success Criteria**: All modals have [X] close icons; Map popups allow status updates and assignment; Users can be imported in bulk from a CSV file.

## 3. Architecture & Data Flow

### 3.1 Backend Updates (`server/index.js`)
- **Database Schema**: 
  - Add `name` column to the `users` table (`VARCHAR(255)`).
- **API: User Management**:
  - Update `POST /api/users` and `GET /api/users` to include the `name` field.
  - New `POST /api/users/bulk` endpoint for processing multiple user records.
    - Logic: Look up supervisor IDs by email, default missing roles to 'Volunteer', and handle existing email conflicts gracefully.
- **API: Location Management**:
  - (Existing endpoints `PATCH /api/locations/:id/status` and `POST /api/locations/:id/assign` will be called directly from the map popup).

### 3.2 Frontend Updates

#### 3.2.1 Map Screen (`client/src/pages/Map.tsx`)
- **Modal Refinement**:
  - Add `[X]` close icons to all modals (Import, Manual Add, etc.).
  - Replace "Back to Search" in the Import results view with a "Cancel" button that dismisses the modal.
  - Implement a `formatCategoryName` helper to clean up Google category strings (e.g., `amusement_park` -> "Amusement Park").
- **Volunteer Assignment Side-effect**:
  - When a volunteer is selected in the header's "Assign to" dropdown, automatically trigger the Leaflet-Geoman **Rectangle** tool.
- **Consolidated Popup**:
  - Replace the "Details" link with integrated controls:
    - Status selection dropdown with a "Save Status" button.
    - Location-specific "Assign to" dropdown (if authorized).
    - "Verify at aed.new" button.
    - Trigger `canvas-confetti` directly on the Map screen when a status is marked as "Done".

#### 3.2.2 Users Screen (`client/src/pages/Users.tsx`)
- **Name Field**: Add a `name` field to the manual user creation form.
- **CSV Import Workflow**:
  - **File Input**: Add a "Bulk Import Users" button.
  - **Preview Modal**: 
    - Parse CSV data (Columns: `Email`, `Name`, `Role`, `Rolls Up To`).
    - Display a table of the parsed users with default values applied.
    - Header: `Preview Users for Import`.
    - Footer: `[ Import ] [ Cancel ] [ X ]`.
  - **Submission**: Send validated records to `POST /api/users/bulk`.

## 4. UI/UX Design

### 4.1 Location Popup (New)
```
[ Location Name ]
[ Address ]
[ Category ] [ Assigned To ]
[ Status Dropdown ] [ Save Button ]
[ (Optional) Assignment Dropdown ] [ Assign Button ]
[ Verify at aed.new Button ]
```

### 4.2 CSV Preview Modal
- Table with columns: Email, Name, Role, Rolls Up To (Email).
- Validation indicator (e.g., highlighting rows with invalid data).

## 5. Security & Error Handling
- **Role Permissions**: Ensure only authorized users can perform status updates and assignments from the popup.
- **CSV Validation**: Validate email formats and roles during the preview stage.
- **Database Safety**: Use transactions or bulk insert logic for CSV imports to ensure atomicity.

## 6. Testing Strategy
- **Manual Verification**:
  - Confirm [X] buttons work on all modals.
  - Verify that selecting a volunteer enables the rectangle tool.
  - Test status updates and assignment from the Map popup.
  - Verify the confetti animation triggers on the Map.
  - Test the CSV import with various edge cases (missing roles, invalid supervisor emails, duplicate user emails).
