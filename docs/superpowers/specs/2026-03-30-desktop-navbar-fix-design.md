# Desktop Navbar Fix Design Spec

## Objective
The goal is to fix the navbar layout on desktop browsers. The current implementation mistakenly places the navigation links (tabs) on the right on desktop, while they should be on a second row, left-aligned, below the brand and user controls. The existing mobile layout must be preserved.

## Design

### 1. Structural Changes (Navbar.tsx)
The current flattened structure of the navbar already supports the two-row layout. No changes are needed here.

### 2. Styling Changes (index.css)

**Row 1 (Desktop):**
- **Brand (Left):** "Cardiac Crusade" title should remain on the top-left.
- **User Controls (Right):** Email, gear icon, and logout text should remain on the top-right.

**Row 2 (Desktop):**
- **Tabs (Left):** Navigation links (Users, Map, List, Reporting) should move to a second row, left-aligned.
- **Width:** `100%`.
- **Align:** `justify-content: flex-start`.
- **Spacing:** `gap: 2rem`.
- **Top Border:** A subtle border or gap will separate the two rows.

### 3. Implementation Plan
- **index.css:** Update desktop styles for the `.nav-links` and `.nav-bar` classes.

## Verification
- Confirm that "Cardiac Crusade" is on the top-left on desktop.
- Confirm that user controls are on the top-right on desktop.
- Confirm that tabs are on a new row, left-aligned, on desktop.
- Ensure mobile layout remains unchanged.
