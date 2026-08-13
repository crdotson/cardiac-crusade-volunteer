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

  let displayMetrics = [...metrics];

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

  // Sort displayMetrics by Done descending
  displayMetrics.sort((a, b) => parseInt(b.metrics.done || 0) - parseInt(a.metrics.done || 0));

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Reporting Dashboard</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f9f9f9', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: viewMode === 'Individual' ? '#000' : '#888', fontWeight: viewMode === 'Individual' ? 'bold' : 'normal' }}>Individual</span>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', margin: 0 }}>
              <input 
                type="checkbox" 
                style={{ opacity: 0, width: 0, height: 0 }}
                checked={viewMode === 'Team'}
                onChange={(e) => setViewMode(e.target.checked ? 'Team' : 'Individual')}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: viewMode === 'Team' ? '#007bff' : '#ccc', transition: '.4s', borderRadius: '24px'
              }}>
                <span style={{
                  position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                  backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                  transform: viewMode === 'Team' ? 'translateX(20px)' : 'translateX(0)'
                }}></span>
              </span>
            </label>
            <span style={{ fontSize: '0.9rem', color: viewMode === 'Team' ? '#000' : '#888', fontWeight: viewMode === 'Team' ? 'bold' : 'normal' }}>Team</span>
          </div>
        </div>
        
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
                      <div style={{ width: '120px', backgroundColor: '#fee2e2', height: '12px', borderRadius: '6px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, prog))}%`, backgroundColor: '#ef4444', height: '100%', borderRadius: '6px', position: 'relative', minWidth: prog > 0 ? '6px' : '0' }}>
                          {prog > 0 && (
                            <div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg viewBox="0 0 24 24" width="20" height="20" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))' }}>
                                <path fill="#ef4444" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                <path fill="white" d="M13 7l-3.5 5.5h3l-1 4.5 4.5-6h-3l1.5-4z"/>
                              </svg>
                            </div>
                          )}
                        </div>
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
