# Mobile Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Cardiac Crusade" navbar responsive, moving tabs to a second row on mobile and compacting the header.

**Architecture:** Use Flexbox `flex-wrap: wrap` on the `.nav-bar` container to allow elements to flow into a second row on mobile.

**Tech Stack:** React, CSS, TypeScript.

---

### Task 1: Refactor Navbar JSX Structure

**Files:**
- Modify: `client/src/components/Navbar.tsx`

- [ ] **Step 1: Flatten the JSX structure and add semantic classes**

```tsx
// client/src/components/Navbar.tsx

// ... (imports)

const Navbar: React.FC = () => {
  // ... (logic)

  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <h2 className="brand-title">Cardiac Crusade</h2>
      </div>
      
      <div className="nav-user-controls">
        <span className="user-email">{user.email}</span>
        <span className="user-role">({user.role})</span>
        <Link to="/settings" title="Settings" className="settings-link">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
        </Link>
        <button onClick={handleLogout} className="secondary logout-button" title="Logout">
          <span className="logout-text">Logout</span>
          <span className="logout-icon" style={{ display: 'none' }}>⏻</span>
        </button>
      </div>

      <ul className="nav-links">
        {canViewUsers && (
          <li>
            <Link to="/users" className={isActive('/users')}>Users</Link>
          </li>
        )}
        <li>
          <Link to="/map" className={isActive('/map')}>Map</Link>
        </li>
        <li>
          <Link to="/list" className={isActive('/list')}>List</Link>
        </li>
        <li>
          <Link to="/reporting" className={isActive('/reporting')}>Reporting</Link>
        </li>
      </ul>
    </nav>
  );
};
```

- [ ] **Step 2: Commit structural changes**

```bash
git add client/src/components/Navbar.tsx
git commit -m "refactor: flatten navbar structure for responsiveness"
```

---

### Task 2: Implement Responsive CSS

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Update desktop styles for the new classes**

```css
/* client/src/index.css */

.nav-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  /* ... existing styles */
}

.brand-title {
  margin: 0;
  color: var(--primary-color);
}

.nav-user-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}
```

- [ ] **Step 2: Add mobile-specific @media query (max-width: 768px)**

```css
/* client/src/index.css */

@media (max-width: 768px) {
  .nav-bar {
    padding: 0.75rem 1rem;
  }

  .nav-brand {
    flex: 1;
    text-align: left;
  }

  .brand-title {
    font-size: 1.1rem;
    white-space: nowrap;
  }

  .nav-user-controls {
    flex: 1;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .user-email {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
  }

  .user-role {
    display: none;
  }

  .logout-text {
    display: none;
  }

  .logout-icon {
    display: inline !important;
    font-size: 1.1rem;
  }

  .logout-button {
    padding: 0.25rem 0.5rem;
  }

  .nav-links {
    width: 100%;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--light-gray);
    justify-content: space-around;
    gap: 0.5rem;
  }

  .nav-links a {
    font-size: 0.9rem;
  }
}
```

- [ ] **Step 3: Commit CSS changes**

```bash
git add client/src/index.css
git commit -m "feat: add responsive styles for navbar mobile view"
```

---

### Task 3: Verification

- [ ] **Step 1: Verify layout on simulated mobile screen**
Since I cannot visually inspect, I will check the computed structure and classes.

- [ ] **Step 2: Run build to ensure no regressions**
Run: `cd client && npm run build`
Expected: SUCCESS
