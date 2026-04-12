# Grid-Based Turf Assignment Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Refactor turf assignment to use a pre-generated map grid system (0.25 mile squares) instead of arbitrary on-the-fly rectangle drawing, enabling volunteers and admins to claim squares individually, while supporting dynamic auto-assignment of locations within those squares.

**Architecture:** 
A new `grid_squares` table will store bounds (`north`, `south`, `east`, `west`). An admin generates a city-wide grid by sending a large bounding box and a grid size. When a grid is assigned to a volunteer from the Map UI (via clicking), all existing locations inside that grid with no explicit manual assignment will inherit that volunteer. New locations dynamically auto-assign to the owning volunteer of the grid they fall into. Manual location assignments take precedence over grid assignments.

**Tech Stack:** React, Leaflet, Node.js/Express, PostgreSQL

---

### Task 1: Database Schema

**Files:**
- Modify: `server/index.js`

**Step 1: Modify initDB**
```javascript
      await pool.query(`
        CREATE TABLE IF NOT EXISTS grid_squares (
          id SERIAL PRIMARY KEY,
          north DOUBLE PRECISION NOT NULL,
          south DOUBLE PRECISION NOT NULL,
          east DOUBLE PRECISION NOT NULL,
          west DOUBLE PRECISION NOT NULL,
          assigned_volunteer_id INTEGER REFERENCES users(id)
        );
      `);
      
      // We drop the OLD assignments table entirely during this transition since turf logic is changing
      await pool.query(`DROP TABLE IF EXISTS assignments;`);
```

### Task 2: Backend Grids Management

**Files:**
- Modify: `server/index.js`

**Step 1: Fetch Grids API**
```javascript
mainRouter.get('/api/grids', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT g.*, u.email as assigned_volunteer_email 
            FROM grid_squares g 
            LEFT JOIN users u ON g.assigned_volunteer_id = u.id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

**Step 2: Generate Grids API**
```javascript
mainRouter.post('/api/grids/generate', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator'), async (req, res) => {
    const { bounds, gridSizeMiles } = req.body;
    try {
        const { _northEast, _southWest } = bounds;
        const latDegrees = gridSizeMiles / 69.0;
        const lngDegrees = gridSizeMiles / 54.6; // approx for scaling
        
        let startLat = _southWest.lat;
        let queries = [];
        
        while (startLat < _northEast.lat) {
            let startLng = _southWest.lng;
            let endLat = startLat + latDegrees;
            
            while (startLng < _northEast.lng) {
                let endLng = startLng + lngDegrees;
                queries.push(pool.query(
                    'INSERT INTO grid_squares (north, south, east, west) VALUES ($1, $2, $3, $4)',
                    [endLat, startLat, endLng, startLng]
                ));
                startLng = endLng;
            }
            startLat = endLat;
        }
        
        await Promise.all(queries);
        res.json({ success: true, count: queries.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

**Step 3: Assign Grid API**
```javascript
mainRouter.post('/api/grids/:id/assign', authenticateToken, authorizeRoles('Application Administrator', 'City Coordinator', 'CHAARG leader'), async (req, res) => {
    const { volunteerId } = req.body;
    const gridId = req.params.id;
    try {
        // Update Grid Owner
        await pool.query('UPDATE grid_squares SET assigned_volunteer_id = $1 WHERE id = $2', [volunteerId, gridId]);
        
        // Dynamic cascading update to locations in the grid that are NOT manually assigned
        if (volunteerId) {
            const gridRes = await pool.query('SELECT * FROM grid_squares WHERE id = $1', [gridId]);
            const g = gridRes.rows[0];
            await pool.query(`
                UPDATE locations 
                SET assigned_volunteer_id = $1, assignment_type = 'Grid' 
                WHERE lat <= $2 AND lat >= $3 AND lng <= $4 AND lng >= $5
                AND (assignment_type IS NULL OR assignment_type != 'Manual')
            `, [volunteerId, g.north, g.south, g.east, g.west]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### Task 3: Automatic Location Auto-Assignment 

**Files:**
- Modify: `server/index.js`

**Step 1: Update Location POST (`/api/locations`)**
In `mainRouter.post('/api/locations'...` before the INSERT:
```javascript
        let finalVolunteerId = assigned_volunteer_id || null;
        let finalAssignmentType = assigned_volunteer_id ? 'Manual' : null;

        if (!assigned_volunteer_id) {
            // Auto calculate grid
            const gridRes = await pool.query(`
                SELECT assigned_volunteer_id FROM grid_squares
                WHERE $1 <= north AND $1 >= south AND $2 <= east AND $2 >= west
                AND assigned_volunteer_id IS NOT NULL LIMIT 1
            `, [lat, lng]);
            if (gridRes.rows.length > 0) {
                finalVolunteerId = gridRes.rows[0].assigned_volunteer_id;
                finalAssignmentType = 'Grid';
            }
        }
```
Update the INSERT payload to use these `finalVolunteerId` and `finalAssignmentType`.

### Task 4 & 5: UI Integration 

**Files:**
- Modify: `client/src/pages/Map.tsx`

**Step 1: Map Variables**
Remove `userAssignments` parsing. Add `grids` state variable.
```javascript
  const [grids, setGrids] = useState<any[]>([]);
  const fetchGrids = async () => {
    const res = await axios.get('api/grids');
    setGrids(res.data);
  };
  useEffect(() => { fetchGrids(); }, [user]);
```

**Step 2: Map Buttons & Events**
Add `Generate Grid Area` button triggering `activeTool = 'MasterRectangle'`.
Handle drawing event:
```javascript
  const handleGridAreaCreated = async (bounds: L.LatLngBounds) => {
      const sizeStr = prompt("Enter grid square size in miles", "0.25");
      if (!sizeStr) return;
      await axios.post('api/grids/generate', { bounds, gridSizeMiles: parseFloat(sizeStr) });
      fetchGrids();
  };
```

**Step 3: Rendering the Grids and Clicking**
In the MapContainer:
```tsx
    {grids.map((grid) => (
      <Rectangle 
          key={grid.id} 
          bounds={[[grid.south, grid.west], [grid.north, grid.east]]}
          pathOptions={{ 
             color: grid.assigned_volunteer_id ? 'blue' : 'gray', 
             fillOpacity: grid.assigned_volunteer_id ? 0.3 : 0.1 
          }}
          eventHandlers={{
             click: async () => {
                 try {
                     await axios.post(`api/grids/${grid.id}/assign`, { volunteerId: selectedVolunteer || null });
                     fetchGrids();
                     fetchLocations();
                 } catch(err) { alert('Failed to assign grid'); }
             }
          }}
      />
    ))}
```
