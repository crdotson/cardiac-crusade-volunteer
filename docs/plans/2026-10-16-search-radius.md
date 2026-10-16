# Import by Name Search Radius Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Add an editable "Search Radius (miles)" parameter to the "Import by Business Name" modal that defaults to the admin-configured default map radius.

**Architecture:** Both `CreateImportActions.tsx` (List view) and `Map.tsx` (Map view) provide a numeric input in the business name import modal pre-populated with `settings.default_map_radius_miles` (or 5 miles if not set). The backend endpoint `POST /api/locations/search-by-name` safely clamps the requested radius between 500m and 50,000m to conform to Google Places API limits.

**Tech Stack:** Node.js, Express, React 19, TypeScript, Vite.

---

### Task 1: Backend Route - Update Radius Default & Clamping in `server/index.js`

**Files:**
- Modify: `server/index.js:995-1010`

**Step 1: Update radius fallback logic**
In `POST /api/locations/search-by-name`:
```javascript
        let miles = parseFloat(radiusMiles);
        if (isNaN(miles) || miles <= 0) {
            const radRes = await pool.query("SELECT value FROM settings WHERE key = 'default_map_radius_miles'");
            const radVal = parseFloat(radRes.rows[0]?.value);
            miles = (!isNaN(radVal) && radVal > 0) ? radVal : 5;
        }
        const radiusMeters = Math.min(50000, Math.max(500, Math.round(miles * 1609.34)));
```

**Step 2: Run syntax check**
Run: `node --check server/index.js`
Expected: Exit code 0.

**Step 3: Commit**
```bash
git add server/index.js
git commit -m "fix(server): align search-by-name fallback radius to 5 miles"
```

---

### Task 2: Frontend List View - Add Radius Input to `CreateImportActions.tsx`

**Files:**
- Modify: `client/src/components/CreateImportActions.tsx`

**Step 1: Add `nameRadiusInput` state and sync with settings**
- Add `const [nameRadiusInput, setNameRadiusInput] = useState<string>('5');`
- In `useEffect` where `settings` are fetched:
  `if (settsRes.data?.default_map_radius_miles) setNameRadiusInput(settsRes.data.default_map_radius_miles);`
- In `handleNameSearch`, read `parseFloat(nameRadiusInput) || parseFloat(settings?.default_map_radius_miles) || 5` for `radiusMiles`.

**Step 2: Add Search Radius form-group in modal**
Add:
```tsx
<div className="form-group">
  <label>Search Radius (miles)</label>
  <input 
    type="number" 
    min="1" 
    max="31" 
    step="1" 
    placeholder="5" 
    value={nameRadiusInput} 
    onChange={(e) => setNameRadiusInput(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') handleNameSearch(); }}
  />
  <small style={{ color: '#666', fontSize: '0.8rem' }}>Max 31 miles (Google Places limit)</small>
</div>
```

**Step 3: Run client build**
Run: `npm run build` in `client`
Expected: Exit code 0.

**Step 4: Commit**
```bash
git add client/src/components/CreateImportActions.tsx
git commit -m "feat(client): add search radius input to CreateImportActions name import modal"
```

---

### Task 3: Frontend Map View - Add Radius Input to `Map.tsx`

**Files:**
- Modify: `client/src/pages/Map.tsx`

**Step 1: Add `nameRadiusInput` state and sync with settings**
- Add `const [nameRadiusInput, setNameRadiusInput] = useState<string>('5');`
- In `useEffect` syncing settings: update `nameRadiusInput` if settings load.
- In `handleNameSearch`, read `parseFloat(nameRadiusInput) || parseFloat(settings?.default_map_radius_miles) || 5` for `radiusMiles`.

**Step 2: Add Search Radius form-group in modal**
Add identical input field in the `showNameImport` modal in `Map.tsx`.

**Step 3: Run client build**
Run: `npm run build` in `client`
Expected: Exit code 0.

**Step 4: Commit**
```bash
git add client/src/pages/Map.tsx
git commit -m "feat(client): add search radius input to Map view name import modal"
```

---

### Task 4: Documentation & Verification

**Files:**
- Modify: `GEMINI.md`
- Modify: `docs/plans/task.md`

**Step 1: Verify production build**
Run: `npm run build` in `client`

**Step 2: Update `GEMINI.md`**
Log session notes on search radius configuration in `GEMINI.md`.

**Step 3: Update `docs/plans/task.md`**
Mark all tasks completed.

**Step 4: Commit**
```bash
git add GEMINI.md docs/plans/task.md
git commit -m "docs: document search radius parameter in GEMINI.md"
```
