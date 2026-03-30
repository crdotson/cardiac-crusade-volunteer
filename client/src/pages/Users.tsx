import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface User {
  id: number;
  email: string;
  role: string;
  roll_up_to_id: number | null;
  roll_up_to_email: string | null;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Volunteer');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
      await axios.post('api/users', { email, password, role });
      setMessage('User created successfully');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
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
        <h2 style={{ color: 'var(--primary-color)' }}>Create User</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
              <th style={{ padding: '1rem' }}>Role</th>
              <th style={{ padding: '1rem' }}>Rolls Up To</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--light-gray)' }}>
                <td style={{ padding: '1rem' }}>{u.email}</td>
                <td style={{ padding: '1rem' }}>{u.role}</td>
                <td style={{ padding: '1rem' }}>
                  {u.roll_up_to_email || <span style={{ color: 'var(--gray)', fontStyle: 'italic' }}>(will not be included in reporting)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
