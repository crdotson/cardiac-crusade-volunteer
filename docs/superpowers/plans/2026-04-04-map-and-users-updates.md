# Map & Users Screen Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Map screen with integrated location management and automated tools, and expand user management with full names and CSV bulk imports.

**Architecture:** 
- **Backend**: Extend the `users` table with a `name` column and add a bulk creation API.
- **Frontend (Map)**: Refactor Leaflet popups to handle status updates and assignments directly, and add automated tool triggers.
- **Frontend (Users)**: Implement a CSV parsing and preview workflow for bulk user creation.

**Tech Stack:** React, Leaflet, Node.js/Express, PostgreSQL, PapaParse (for CSV).

---

### Task 1: Backend Foundation (User Name & Bulk API)

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add `name` column to `users` table**
Update `initDB` to include the `name` column.
```javascript
// server/index.js
// Inside initDB users table creation
`CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255), -- Added
  password_hash VARCHAR(255),
  ...
);`
```

- [ ] **Step 2: Update User API for `name`**
Modify `POST /api/users` and `GET /api/users` to handle the `name` field.
```javascript
// server/index.js
// GET /api/users
query = `SELECT u.id, u.email, u.name, u.role, ...`;
// POST /api/users
const { email, name, password, role } = req.body;
await pool.query('INSERT INTO users (email, name, password_hash, role, ...) ...', [email, name, hash, role, ...]);
```

- [ ] **Step 3: Implement Bulk User API**
Add `POST /api/users/bulk`.
```javascript
// server/index.js
mainRouter.post('/api/users/bulk', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { users } = req.body; // Array of { email, name, role, rolls_up_to_email }
    try {
        for (const u of users) {
            const supervisorRes = await pool.query('SELECT id FROM users WHERE email = $1', [u.rolls_up_to_email]);
            const supervisorId = supervisorRes.rows[0]?.id || null;
            const hash = await bcrypt.hash('changeme', 10); // Default password
            await pool.query(
                'INSERT INTO users (email, name, password_hash, role, roll_up_to_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
                [u.email, u.name || null, hash, u.role || 'Volunteer', supervisorId]
            );
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 4: Commit Task 1**
```bash
git add server/index.js
git commit -m "feat: add user name field and bulk import API"
```

---

### Task 2: Map UI Enhancements (Modals & Automation)

**Files:**
- Modify: `client/src/pages/Map.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Implement `formatCategoryName` helper**
```typescript
// client/src/pages/Map.tsx
const formatCategoryName = (name: string) => {
  if (!name) return 'N/A';
  return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};
```

- [ ] **Step 2: Add [X] icons and Cancel button to modals**
Update `showImport` and `showManualAdd` modals.
```typescript
// client/src/pages/Map.tsx
// Add <button className="close-btn" onClick={() => setShowImport(false)}>&times;</button>
// Replace "Back to Search" with "Cancel"
<button className="secondary" onClick={() => { setShowImport(false); setCandidates([]); }}>Cancel</button>
```

- [ ] **Step 3: Automate Rectangle Tool on volunteer selection**
Add a side-effect to the volunteer dropdown.
```typescript
// client/src/pages/Map.tsx
<select value={selectedVolunteer} onChange={(e) => {
  const val = e.target.value;
  setSelectedVolunteer(val);
  if (val) setActiveTool('Rectangle'); // Custom logic needed in MapEvents
}}>
```

- [ ] **Step 4: Commit Task 2**
```bash
git add client/src/pages/Map.tsx client/src/index.css
git commit -m "feat: improve Map modals and automate tool activation"
```

---

### Task 3: Integrated Map Popup

**Files:**
- Modify: `client/src/pages/Map.tsx`

- [ ] **Step 1: Refactor Marker Popups**
Embed status/assignment logic directly in the Leaflet `Popup`.
```typescript
// client/src/pages/Map.tsx (inside locations.map)
<Popup>
  <div className="popup-content">
    <h3>{loc.name}</h3>
    <p>{loc.address}</p>
    <div className="form-group">
      <select defaultValue={loc.status} onChange={(e) => handleUpdateStatus(loc.id, e.target.value)}>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    {canAssign && (
       <select defaultValue={loc.assigned_volunteer_id} onChange={(e) => handleAssign(loc.id, e.target.value)}>
         <option value="">Unassigned</option>
         {volunteers.map(v => <option key={v.id} value={v.id}>{v.email}</option>)}
       </select>
    )}
    <a href="https://aed.new" target="_blank" className="button primary">Verify at aed.new</a>
  </div>
</Popup>
```

- [ ] **Step 2: Add handleUpdateStatus and handleAssign to Map**
```typescript
// client/src/pages/Map.tsx
const handleUpdateStatus = async (id: number, status: string) => {
  await axios.patch(`api/locations/${id}/status`, { status });
  if (status.endsWith('Done')) confetti(...);
  fetchLocations();
};
```

- [ ] **Step 3: Commit Task 3**
```bash
git add client/src/pages/Map.tsx
git commit -m "feat: integrate location management into map popups"
```

---

### Task 4: Users Screen (CSV Import Workflow)

**Files:**
- Modify: `client/src/pages/Users.tsx`

- [ ] **Step 1: Add `name` field to creation form**
```typescript
// client/src/pages/Users.tsx
<label>Name</label>
<input type="text" value={name} onChange={(e) => setName(e.target.value)} />
```

- [ ] **Step 2: Implement CSV Parsing and Preview Modal**
Use `papaparse` to handle CSV data.
```typescript
// client/src/pages/Users.tsx
const [importData, setImportData] = useState<any[]>([]);
const [showPreview, setShowPreview] = useState(false);

const handleFileChange = (e: any) => {
  Papa.parse(e.target.files[0], {
    header: true,
    complete: (results) => {
      setImportData(results.data);
      setShowPreview(true);
    }
  });
};
```

- [ ] **Step 3: Implement Bulk Submission**
```typescript
// client/src/pages/Users.tsx
const handleBulkImport = async () => {
  await axios.post('api/users/bulk', { users: importData });
  setShowPreview(false);
  fetchUsers();
};
```

- [ ] **Step 4: Commit Task 4**
```bash
git add client/src/pages/Users.tsx
git commit -m "feat: implement CSV bulk user import"
```
