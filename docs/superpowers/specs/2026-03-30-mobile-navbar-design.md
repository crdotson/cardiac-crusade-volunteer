# Mobile Navbar Design Spec

## Objective
The goal is to make the "Cardiac Crusade" app's navbar responsive for mobile devices, specifically targeting iPhone 15 Pro (393px width) and similar. On mobile, the "Cardiac Crusade" title should be smaller, on one line, and left-aligned, while user information, settings (gear), and logout (icon) should be right-aligned on the same row. The navigation links (tabs) should move to a second row.

## Design

### 1. Structural Changes (Navbar.tsx)
The current structure of the navbar nests the title and tabs within a single `div`. This will be flattened to allow the flexbox to wrap properly on mobile.

**New JSX Structure:**
- `<nav className="nav-bar">`
    - `<div className="nav-brand">...</div>` (Cardiac Crusade)
    - `<div className="nav-user-controls">...</div>` (Email, Gear, Logout)
    - `<ul className="nav-links">...</ul>` (Users, Map, List, Reporting)
- `</nav>`

### 2. Styling Changes (index.css)

**Row 1 (Mobile):**
- **Brand (Left):**
    - Font size: `1.1rem`.
    - No wrap: `white-space: nowrap`.
- **User Controls (Right):**
    - Email: Truncated with `text-overflow: ellipsis`.
    - Role: Hidden (`display: none`).
    - Logout: Changed from text button to icon button (`⏻`).

**Row 2 (Mobile):**
- **Tabs (Full width):**
    - `width: 100%`.
    - `justify-content: space-around`.
    - `margin-top: 0.5rem`.

### 3. Implementation Plan
- **Navbar.tsx:** Refactor JSX to match the new structure and add necessary classes.
- **index.css:** Add responsive styles within a `@media (max-width: 768px)` block.

## Verification
- Confirm that "Cardiac Crusade" is on one line and left-aligned on mobile.
- Confirm that user controls are right-aligned on mobile.
- Confirm that tabs are on a new row on mobile.
- Ensure desktop layout remains unchanged or improved.
