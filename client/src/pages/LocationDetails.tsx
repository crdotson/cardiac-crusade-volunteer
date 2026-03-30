import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

const LocationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const statuses = [
    'Unvisited',
    'AED status unknown - Follow-up',
    'AED located and mapped at aed.new - Done',
    'Refused or requested not to be mapped - Done',
    'AED located, not mapped yet - Follow up',
    'AED not present - Done'
  ];

  const fetchLocation = async () => {
    try {
      const res = await axios.get(`api/locations/${id}`);
      setLocation(res.data);
      setNewStatus(res.data.status);
      setSelectedAssignee(res.data.assigned_volunteer_id || '');
    } catch (err) {
      console.error('Failed to fetch location', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableUsers = async () => {
    if (['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(currentUser?.role || '')) {
      try {
        const res = await axios.get('api/users/assignable');
        setAssignableUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch assignable users', err);
      }
    }
  };

  useEffect(() => {
    fetchLocation();
    fetchAssignableUsers();
  }, [id, currentUser]);

  const handleStatusChange = async (status: string) => {
    if (status === 'AED located and mapped at aed.new - Done') {
      setShowConfirmation(true);
      return;
    }
    updateStatus(status);
  };

  const updateStatus = async (status: string) => {
    try {
      await axios.patch(`api/locations/${id}/status`, { status });
      setLocation({ ...location, status });
      setNewStatus(status);
      
      if (status === 'AED located and mapped at aed.new - Done') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      setShowConfirmation(false);
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status.');
    }
  };

  const handleAssign = async () => {
    try {
      await axios.post(`api/locations/${id}/assign`, { volunteerId: selectedAssignee });
      alert('Location assigned successfully');
      fetchLocation();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign location');
    }
  };

  if (loading) return <div className="container">Loading...</div>;
  if (!location) return <div className="container">Location not found.</div>;

  const canAssign = ['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(currentUser?.role || '');

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--primary-color)' }}>{location.name}</h2>
          <button className="secondary" onClick={() => navigate(-1)}>Back</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <p><strong>Address:</strong> {location.address}</p>
            <p><strong>Category:</strong> {location.category || 'N/A'}</p>
            <p><strong>Phone:</strong> {location.phone || 'N/A'}</p>
            <p><strong>Current Status:</strong> 
              <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--light-gray)', color: 'var(--dark-gray)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                {location.status}
              </span>
            </p>
            <p><strong>Assigned To:</strong> {location.volunteer_email || 'Unassigned'}</p>
            
            <div style={{ marginTop: '2rem' }}>
              <a 
                href="https://aed.new" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="button primary"
                style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1rem' }}
              >
                Identify or Verify this AED
              </a>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>
                Opens aed.new in a new window to map the AED.
              </p>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3>Update Status</h3>
              <div className="form-group">
                <select value={newStatus} onChange={(e) => handleStatusChange(e.target.value)}>
                  {statuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button className="primary" style={{ marginTop: '0.5rem' }} onClick={() => updateStatus(newStatus)}>Save Status</button>
              </div>
            </div>

            {canAssign && (
              <div style={{ padding: '1.5rem', border: '1px solid var(--light-gray)', borderRadius: '8px' }}>
                <h3>Assign Location</h3>
                <div className="form-group">
                  <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {assignableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.email} ({u.role}) {u.id === currentUser?.id ? '- (Me)' : ''}
                      </option>
                    ))}
                  </select>
                  <button className="secondary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={handleAssign}>Confirm Assignment</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showConfirmation && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '400px' }}>
            <h3 style={{ color: 'var(--primary-color)' }}>Confirm Completion</h3>
            <p>Please confirm that you have mapped this in https://aed.new.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="primary" onClick={() => updateStatus('AED located and mapped at aed.new - Done')}>Confirm</button>
              <button className="secondary" onClick={() => setShowConfirmation(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationDetails;