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
  const [editingUser, setEditingUser] = useState<User | null>(null);
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
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length === 0) return;

          let data: any[] = [];
          const firstRow = rows[0];
          
          // Detection: check if any cell in the first row contains "email" (case-insensitive)
          const hasHeader = firstRow.some(cell => 
            cell && typeof cell === 'string' && cell.toLowerCase().includes('email')
          );

          if (hasHeader) {
            const headers = firstRow.map(h => (h || '').toLowerCase().trim());
            const emailIdx = headers.findIndex(h => h.includes('email'));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            const roleIdx = headers.findIndex(h => h.includes('role'));
            const supervisorIdx = headers.findIndex(h => 
              h.includes('rolls up to') || h.includes('supervisor') || h.includes('rolls_up_to')
            );

            data = rows.slice(1).map(row => ({
              email: emailIdx !== -1 ? row[emailIdx] || '' : '',
              name: nameIdx !== -1 ? row[nameIdx] || '' : '',
              role: roleIdx !== -1 ? row[roleIdx] || 'Volunteer' : 'Volunteer',
              rolls_up_to_email: supervisorIdx !== -1 ? row[supervisorIdx] || '' : ''
            }));
          } else {
            // No headers: Map by index
            data = rows.map(row => {
              const values = Object.values(row).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
              if (values.length === 1) {
                return { 
                  email: values[0], 
                  name: '', 
                  role: 'Volunteer', 
                  rolls_up_to_email: '' 
                };
              }
              return {
                email: row[0] || '',
                name: row[1] || '',
                role: row[2] || 'Volunteer',
                rolls_up_to_email: row[3] || ''
              };
            });
          }

          // Ensure email is present and default role to Volunteer if missing
          const finalData = data
            .filter(u => u.email && u.email.trim() !== '')
            .map(u => ({
              ...u,
              role: u.role || 'Volunteer'
            }));

          setImportData(finalData);
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

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    setMessage('');
    try {
      let roll_up_to_id = editingUser.roll_up_to_id;
      // Resolve supervisor email to ID if provided
      if (editingUser.roll_up_to_email && editingUser.roll_up_to_email.trim() !== '') {
        const emailToFind = editingUser.roll_up_to_email.trim();
        if (emailToFind === currentUser?.email) {
          roll_up_to_id = currentUser.id;
        } else {
          const supervisor = users.find(u => u.email === emailToFind);
          if (supervisor) {
            roll_up_to_id = supervisor.id;
          } else {
            setError('Supervisor email not found in your user list');
            return;
          }
        }
      } else {
        roll_up_to_id = null;
      }

      await axios.patch(`api/users/${editingUser.id}`, { 
        email: editingUser.email, 
        name: editingUser.name, 
        role: editingUser.role,
        roll_up_to_id 
      });
      setMessage('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const getEditRoles = () => {
    if (currentUser?.role === 'Application Administrator') {
      return ['Application Administrator', 'City Coordinator', 'Volunteer leader', 'Volunteer'];
    }
    if (currentUser?.role === 'City Coordinator') {
      return ['City Coordinator', 'Volunteer leader', 'Volunteer'];
    }
    return [];
  };

  const getAvailableRoles = () => {
    if (currentUser?.role === 'Application Administrator') {
      return ['Application Administrator', 'City Coordinator', 'Volunteer leader', 'Volunteer'];
    }
    if (currentUser?.role === 'City Coordinator') {
      return ['Volunteer leader', 'Volunteer'];
    }
    if (currentUser?.role === 'Volunteer leader') {
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
              <th style={{ padding: '1rem' }}>Actions</th>
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
                <td style={{ padding: '1rem' }}>
                  <button className="button secondary small" onClick={() => setEditingUser(u)}>Edit</button>
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

      {editingUser && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <button className="close-btn" onClick={() => setEditingUser(null)}>&times;</button>
            <h2 style={{ color: 'var(--primary-color)' }}>Edit User</h2>
            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Email</label>
                <input 
                  type="email" 
                  value={editingUser.email} 
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Name</label>
                <input 
                  type="text" 
                  value={editingUser.name || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} 
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Role</label>
                <select 
                  value={editingUser.role} 
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  disabled={currentUser?.role === 'Volunteer leader'}
                >
                  {(currentUser?.role === 'Application Administrator' || currentUser?.role === 'City Coordinator') ? (
                    getEditRoles().map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))
                  ) : (
                    <option value={editingUser.role}>{editingUser.role}</option>
                  )}
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Rolls Up To (Email)</label>
                <input 
                  type="text" 
                  placeholder="Supervisor email"
                  value={editingUser.roll_up_to_email || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, roll_up_to_email: e.target.value })}
                />
                <small style={{ color: 'var(--gray)' }}>Changing this requires the supervisor to already exist.</small>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
