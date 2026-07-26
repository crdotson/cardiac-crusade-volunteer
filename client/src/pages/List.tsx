import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CreateImportActions from '../components/CreateImportActions';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

const List: React.FC = () => {
  const { user } = useAuth();
  const showAssignedTo = user?.role !== 'Volunteer';
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const navigate = useNavigate();

  const statuses = [
    'Unvisited',
    'AED status unknown - Follow-up',
    'AED located and mapped at aed.new - Done',
    'Refused or requested not to be mapped - Done',
    'AED located, not mapped yet - Follow up',
    'AED not present - Done'
  ];

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await axios.patch(`api/locations/${id}/status`, { status });
      if (status.includes('Done')) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      fetchLocations();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get('api/locations');
      setLocations(res.data);
    } catch (err) {
      console.error('Failed to fetch locations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const formatCategoryName = (name: string) => {
    if (!name) return 'N/A';
    return name.replace(/_/g, ' ')
               .split(' ')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
               .join(' ');
  };

  if (loading) return <div className="container"><p>Loading locations...</p></div>;

  const filteredLocations = locations.filter(loc => {
    const matchesText = (loc.name || '').toLowerCase().includes(filterText.toLowerCase()) || 
                        (loc.address || '').toLowerCase().includes(filterText.toLowerCase()) ||
                        (loc.notes || '').toLowerCase().includes(filterText.toLowerCase());
    const matchesCat = filterCategory === 'All' || loc.category === filterCategory;
    return matchesText && matchesCat;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="container list-container">
      <div className="card list-card">
        <h2 style={{ color: 'var(--primary-color)' }}>Locations List</h2>
        <CreateImportActions onUpdate={fetchLocations} />
        <div className="filter-toolbar">
          <input 
            type="text" 
            placeholder="Filter by name or address..." 
            value={filterText} 
            onChange={e => setFilterText(e.target.value)} 
            style={{ flex: 1 }}
          />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 'auto' }}>
            <option value="All">All Categories</option>
            {[...new Set(locations.map(l => l.category).filter(Boolean))].map(cat => (
              <option key={cat} value={cat}>{formatCategoryName(cat)}</option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Status</th>
                {showAssignedTo && <th>Assigned To</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map(loc => (
                <tr key={loc.id}>
                  <td>{loc.name}</td>
                  <td>{loc.address}</td>
                  <td>{formatCategoryName(loc.category)}</td>
                  <td>{loc.notes}</td>
                  <td>
                    <select
                      key={`${loc.id}-${loc.status}`}
                      defaultValue={loc.status || 'Unvisited'}
                      onChange={(e) => handleUpdateStatus(loc.id, e.target.value)}
                      style={{ 
                        fontSize: '0.85rem', 
                        padding: '4px', 
                        marginBottom: 0, 
                        width: 'auto', 
                        maxWidth: '220px',
                        color: '#333', 
                        backgroundColor: '#fff', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px' 
                      }}
                    >
                      {loc.status && !statuses.includes(loc.status) && (
                        <option key={loc.status} value={loc.status}>{loc.status}</option>
                      )}
                      {statuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  {showAssignedTo && <td>{loc.assigned_volunteer_email || 'Unassigned'}</td>}
                  <td>
                    <button onClick={() => navigate(`/locations/${loc.id}`)} className="secondary" style={{ padding: '0.25rem 0.5rem' }}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={showAssignedTo ? 7 : 6} style={{ textAlign: 'center' }}>No locations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default List;
