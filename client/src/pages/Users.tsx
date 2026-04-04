import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  roll_up_to_id: number | null;
  roll_up_to_email: string | null;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Volunteer');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importData, setImportData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      const res = await axios.get('api/users');
      setUsers(res.data);
    } catch (err: any) {
      setError('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('api/users', { email, name, password, role });
      setMessage('User created successfully');
      setEmail('');
      setName('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Normalize headers to expected keys: email, name, role, rolls_up_to_email
          const normalized = results.data.map((row: any) => ({
            email: row.Email || row.email,
            name: row.Name || row.name,
            role: row.Role || row.role || 'Volunteer',
            rolls_up_to_email: row['Rolls Up To'] || row.rolls_up_to_email || row.supervisor_email
          }));
          setImportData(normalized);
          setShowPreview(true);
        }
      });
    }
  };

  const handleBulkImport = async () => {
    try {
      await axios.post('api/users/bulk', { users: importData });
      setMessage('Bulk import successful');
      setShowPreview(false);
      setImportData([]);
      fetchUsers();
    } catch (err: any) {
      setError('Bulk import failed');
    }
  };

  const getAvailableRoles = () => {
    if (currentUser?.role === 'Application Administrator') {
      return ['Application Administrator', 'City Coordinator', 'CHAARG leader', 'Volunteer'];
    }
    if (currentUser?.role === 'City Coordinator') {
      return ['CHAARG leader', 'Volunteer'];
    }
    if (currentUser?.role === 'CHAARG leader') {
      return ['Volunteer'];
    }
    return [];
  };

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--primary-color)', margin: 0 }}>Create User</h2>
          {(currentUser?.role === 'Application Administrator' || currentUser?.role === 'City Coordinator') && (
            <div>
              <input 
                type="file" 
                accept=".csv" 
                style={{ display: 'none' }} 
                id="csv-upload" 
                onChange={handleFileChange} 
              />
              <label htmlFor="csv-upload" className="button secondary" style={{ cursor: 'pointer' }}>
                Bulk Import Users
              </label>
            </div>
          )}
        </div>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {getAvailableRoles().map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="primary" style={{ marginBottom: '1rem' }}>Create User</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ color: 'var(--primary-color)' }}>User Hierarchy</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--light-gray)' }}>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Rolls Up To</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--light-gray)' }}>
                <td style={{ padding: '1rem' }}>{u.email}</td>
                <td style={{ padding: '1rem' }}>{u.name || <span style={{ color: 'var(--gray)', fontStyle: 'italic' }}>N/A</span>}</td>
                <td style={{ padding: '1rem' }}>{u.role}</td>
                <td style={{ padding: '1rem' }}>
                  {u.roll_up_to_email || <span style={{ color: 'var(--gray)', fontStyle: 'italic' }}>(will not be included in reporting)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPreview && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <button className="close-btn" onClick={() => setShowPreview(false)}>&times;</button>
            <h2 style={{ color: 'var(--primary-color)' }}>Preview Users for Import</h2>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Rolls Up To</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.map((u, i) => (
                    <tr key={i}>
                      <td>{u.email}</td>
                      <td>{u.name || <span style={{ color: 'var(--gray)', fontStyle: 'italic' }}>N/A</span>}</td>
                      <td>{u.role}</td>
                      <td>{u.rolls_up_to_email || <span style={{ color: 'var(--gray)', fontStyle: 'italic' }}>N/A</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setShowPreview(false)}>Cancel</button>
              <button className="primary" onClick={handleBulkImport}>Import {importData.length} Users</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
