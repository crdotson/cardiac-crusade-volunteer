# Remaining Tasks for Map & Users Screen Updates

- [x] **Task 2: Map UI Enhancements**
    - [x] Add [X] close icons to `showImport` and `showManualAdd` modals in `Map.tsx`.
    - [x] Replace "Back to Search" with "Cancel" button in `showImport` results.
    - [x] Ensure `formatCategoryName` is used for category display in `Map.tsx`.
    - [x] Verify automated Rectangle tool activation on volunteer selection (already partially done).
- [ ] **Task 3: Integrated Map Popup**
    - [ ] Refactor marker popups in `Map.tsx` to include status/assignment handlers.
    - [ ] Implement `handleUpdateStatus` and `handleAssign` in `Map.tsx`.
    - [ ] Add "Verify at aed.new" button and status selection dropdown to popup.
    - [ ] Trigger confetti on "Done" status.
- [ ] **Task 4: Users Screen CSV Import**
    - [ ] Add `name` field to manual user creation form in `Users.tsx`.
    - [ ] Implement CSV parsing using `papaparse` in `Users.tsx`.
    - [ ] Create preview modal for imported users.
    - [ ] Implement bulk submission to `POST /api/users/bulk`.
