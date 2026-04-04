import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const List: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const navigate = useNavigate();

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

  if (loading) return <div className="container">Loading...</div>;

  const filteredLocations = locations.filter(loc => {
    const matchesText = (loc.name || '').toLowerCase().includes(filterText.toLowerCase()) || 
                        (loc.address || '').toLowerCase().includes(filterText.toLowerCase());
    const matchesCat = filterCategory === 'All' || loc.category === filterCategory;
    return matchesText && matchesCat;
  });

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ color: 'var(--primary-color)' }}>Locations List</h2>
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
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map(loc => (
                <tr key={loc.id}>
                  <td>{loc.name}</td>
                  <td>{loc.address}</td>
                  <td>{formatCategoryName(loc.category)}</td>
                  <td>
                    <span className={`badge status-${(loc.status || 'Pending').replace(/\s+/g, '-').toLowerCase()}`}>
                      {loc.status || 'Pending'}
                    </span>
                  </td>
                  <td>{loc.assigned_volunteer_email || 'Unassigned'}</td>
                  <td>
                    <button onClick={() => navigate(`/locations/${loc.id}`)} className="secondary" style={{ padding: '0.25rem 0.5rem' }}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>No locations found.</td>
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
