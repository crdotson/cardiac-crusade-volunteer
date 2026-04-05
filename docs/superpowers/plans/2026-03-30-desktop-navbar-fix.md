# Desktop Navbar Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the desktop navbar to have a two-row layout: Brand and User controls on the top row (left and right), and Navigation tabs on the second row (left-aligned).

**Architecture:** Utilize `flex-wrap: wrap` on the `.nav-bar` and force `.nav-links` to occupy the full width, causing them to move to a new row. Use `justify-content` to align elements appropriately in each row.

**Tech Stack:** CSS.

---

### Task 1: Update Desktop Navbar Styles

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Force navigation links to a new row on desktop**
Update `.nav-links` to take full width and align left.

```css
/* client/src/index.css */

.nav-links {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  align-items: center;
  /* New styles for desktop two-row layout */
  width: 100%;
  margin-top: 1rem;
  justify-content: flex-start;
  border-top: 1px solid var(--light-gray);
  padding-top: 0.75rem;
}
```

- [ ] **Step 2: Ensure brand and user controls stay on the top row**
Verify `.nav-bar` flex properties and ensure `.nav-brand` and `.nav-user-controls` handle their alignment.

```css
/* client/src/index.css */

.nav-bar {
  /* ... existing styles */
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}
```

- [ ] **Step 3: Commit CSS changes**

```bash
git add client/src/index.css
git commit -m "fix: move desktop navbar tabs to a second row, left-aligned"
```

---

### Task 2: Verify Responsive Layout

- [ ] **Step 1: Run build to ensure no syntax errors**
Run: `cd client && npm run build`
Expected: SUCCESS

- [ ] **Step 2: Verify mobile layout still works as expected**
Ensure the `@media` query in `index.css` still correctly overrides the desktop styles.
(Note: Since `.nav-links` now has `width: 100%` on desktop, we should verify it doesn't conflict with mobile styles or if we should move the `width: 100%` into a base style).

Actually, it's safer to:
1. Set the two-row layout as the base style.
2. Ensure the mobile `@media` query adjusts it (e.g., `justify-content: space-around`).

- [ ] **Step 3: Commit verification**
```bash
git commit --allow-empty -m "test: verified desktop and mobile navbar layout"
```
