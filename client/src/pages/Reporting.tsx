import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Reporting: React.FC = () => {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'Individual' | 'Team'>('Individual');
  const { user } = useAuth();

  const fetchMetrics = async () => {
    try {
      const res = await axios.get('api/reporting/metrics');
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) return <div className="container">Loading...</div>;

  const totalDone = metrics.reduce((acc, m) => acc + parseInt(m.metrics.done || 0), 0);
  const totalLocations = metrics.reduce((acc, m) => acc + parseInt(m.metrics.total || 0), 0);
  const completionRate = totalLocations > 0 ? (totalDone / totalLocations * 100).toFixed(1) : 0;

  let displayMetrics = metrics;

  if (viewMode === 'Team') {
    // 1. Filter out volunteers
    const nonVolunteers = metrics.filter(m => m.role !== 'Volunteer');

    // 2. For each non-volunteer, calculate their hierarchical rollup
    displayMetrics = nonVolunteers.map(userItem => {
      let teamTotal = 0;
      let teamDone = 0;
      let teamFollowup = 0;
      let teamUnvisited = 0;

      // Helper to find all descendant IDs recursively
      const descendantIds = new Set([userItem.id]);
      let added = true;
      while (added) {
        added = false;
        metrics.forEach(m => {
          if (descendantIds.has(m.roll_up_to_id) && !descendantIds.has(m.id)) {
            descendantIds.add(m.id);
            added = true;
          }
        });
      }

      // Sum metrics for all descendants
      descendantIds.forEach(id => {
        const u = metrics.find(m => m.id === id);
        if (u) {
          teamTotal += parseInt(u.metrics.total || 0);
          teamDone += parseInt(u.metrics.done || 0);
          teamFollowup += parseInt(u.metrics.followup || 0);
          teamUnvisited += parseInt(u.metrics.unvisited || 0);
        }
      });

      return {
        ...userItem,
        metrics: {
          total: teamTotal,
          done: teamDone,
          followup: teamFollowup,
          unvisited: teamUnvisited
        }
      };
    });
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Reporting Dashboard</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ textAlign: 'center', backgroundColor: '#f0f0f0' }}>
            <h3>{totalLocations}</h3>
            <p>Total Assigned</p>
          </div>
          <div className="card" style={{ textAlign: 'center', backgroundColor: '#e6fffa', borderBottom: '4px solid green' }}>
            <h3>{totalDone}</h3>
            <p>AEDs Mapped</p>
          </div>
          <div className="card" style={{ textAlign: 'center', backgroundColor: '#fffaf0', borderBottom: '4px solid orange' }}>
            <h3>{completionRate}%</h3>
            <p>Completion Rate</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Hierarchical Performance</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f9f9f9', padding: '0.5rem 1rem', borderRadius: '5px' }}>
            <strong>View Mode:</strong>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="viewMode" 
                checked={viewMode === 'Individual'} 
                onChange={() => setViewMode('Individual')} 
              />
              Individual
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="viewMode" 
                checked={viewMode === 'Team'} 
                onChange={() => setViewMode('Team')} 
              />
              Team
            </label>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Total Assigned</th>
                <th>Done</th>
                <th>Followup</th>
                <th>Unvisited</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {displayMetrics.map(m => {
                const prog = m.metrics.total > 0 ? (m.metrics.done / m.metrics.total * 100) : 0;
                return (
                  <tr key={m.id}>
                    <td>{m.email} {m.id === user?.id && <strong>(You)</strong>}</td>
                    <td>{m.metrics.total}</td>
                    <td>{m.metrics.done}</td>
                    <td>{m.metrics.followup}</td>
                    <td>{m.metrics.unvisited}</td>
                    <td>
                      <div style={{ width: '100px', backgroundColor: '#eee', height: '10px', borderRadius: '5px' }}>
                        <div style={{ width: `${prog}%`, backgroundColor: 'green', height: '100%', borderRadius: '5px' }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reporting;
