import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Reporting: React.FC = () => {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const totalMapped = metrics.reduce((acc, m) => acc + parseInt(m.metrics.mapped), 0);
  const totalLocations = metrics.reduce((acc, m) => acc + parseInt(m.metrics.total), 0);
  const completionRate = totalLocations > 0 ? (totalMapped / totalLocations * 100).toFixed(1) : 0;

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
            <h3>{totalMapped}</h3>
            <p>AEDs Mapped</p>
          </div>
          <div className="card" style={{ textAlign: 'center', backgroundColor: '#fffaf0', borderBottom: '4px solid orange' }}>
            <h3>{completionRate}%</h3>
            <p>Completion Rate</p>
          </div>
        </div>

        <h3>Hierarchical Performance</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Total Assigned</th>
                <th>Mapped (Done)</th>
                <th>In Progress</th>
                <th>Pending</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const prog = m.metrics.total > 0 ? (m.metrics.mapped / m.metrics.total * 100) : 0;
                return (
                  <tr key={m.id}>
                    <td>{m.email} {m.id === user?.id && <strong>(You)</strong>}</td>
                    <td>{m.role}</td>
                    <td>{m.metrics.total}</td>
                    <td>{m.metrics.mapped}</td>
                    <td>{m.metrics.in_progress}</td>
                    <td>{m.metrics.pending}</td>
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
