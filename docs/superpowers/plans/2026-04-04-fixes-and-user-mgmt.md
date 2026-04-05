# Fixes & User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Google API integrations, implement user editing with role-based permissions, add location deletion, and enhance CSV import flexibility.

**Architecture:** 
- **Backend**: Implement granular user update logic and location deletion.
- **Frontend**: Transition to dynamic Google Maps script injection and implement modal-based user editing.

---

### Task 1: Backend Fixes & Extensions

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Fix `search-nearby` and add logging**
Cap `maxResultCount` at 20 and add catch-all logging.
```javascript
// server/index.js
// Inside /api/locations/search-nearby
const limit = Math.min(parseInt(limitRes.rows[0]?.value || '20'), 20); // API max is 20
// ...
} catch (err) {
    console.error('Error in search-nearby:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
}
```

- [ ] **Step 2: Implement User Update API**
```javascript
// server/index.js
mainRouter.patch('/api/users/:id', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { email, name, role, roll_up_to_id } = req.body;
    const targetId = req.params.id;
    const requesterRole = req.user.role;

    // Role modification logic
    if (role && role !== req.user.role) {
        if (requesterRole === 'CHAARG leader') return res.status(403).json({ message: 'CHAARG leaders cannot change roles' });
        if (requesterRole === 'City Coordinator' && !['City Coordinator', 'CHAARG leader', 'Volunteer'].includes(row)) {
             // Validate role...
        }
    }
    await pool.query('UPDATE users SET email=$1, name=$2, role=$3, roll_up_to_id=$4 WHERE id=$5', [email, name, role, roll_up_to_id, targetId]);
    res.json({ success: true });
});
```

- [ ] **Step 3: Implement Location Delete API**
```javascript
// server/index.js
mainRouter.delete('/api/locations/:id', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});
```

- [ ] **Step 4: Commit Task 1**
```bash
git add server/index.js
git commit -m "feat: implement user editing, location deletion, and nearby search fixes"
```

---

### Task 2: Frontend Reliability & Map Popups

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/main.tsx`
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Fix Google Maps script injection**
Remove script from `index.html` and inject in `main.tsx` using the environment variable.
```typescript
// client/src/main.tsx
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
if (apiKey) {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  document.head.appendChild(script);
}
```

- [ ] **Step 2: Add Delete Button to Map Popup**
```typescript
// client/src/pages/Map.tsx
const handleDeleteLocation = async (id: number) => {
  if (window.confirm('Delete this location?')) {
    await axios.delete(`api/locations/${id}`);
    fetchLocations();
  }
};
// Inside Popup JSX
{['Application Administrator', 'City Coordinator'].includes(user?.role || '') && (
  <button onClick={() => handleDeleteLocation(loc.id)} className="danger-link" style={{ color: 'red', marginTop: '10px' }}>Delete Location</button>
)}
```

- [ ] **Step 3: Commit Task 2**
```bash
git add client/index.html client/src/main.tsx client/src/pages/Map.tsx
git commit -m "fix: improve Google API loading and add location deletion to Map"
```

---

### Task 3: User Screen Improvements

**Files:**
- Modify: `client/src/pages/Users.tsx`

- [ ] **Step 1: Fix CSV Import for Email-only files**
Update `handleFileChange` logic.
```typescript
// client/src/pages/Users.tsx
data = rows.map(row => {
  const values = Object.values(row).filter(v => v !== null && v !== undefined);
  if (values.length === 1) {
    return { email: values[0], name: '', role: 'Volunteer', rolls_up_to_email: '' };
  }
  // ... rest of logic
});
```

- [ ] **Step 2: Implement Edit User Modal**
Add state for `editingUser` and render a modal similar to `showPreview`.
Include permission-based role filtering.

- [ ] **Step 3: Commit Task 3**
```bash
git add client/src/pages/Users.tsx
git commit -m "feat: implement user editing and fix email-only CSV import"
```
