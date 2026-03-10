import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';

const Settings: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googlePlacesLimit, setGooglePlacesLimit] = useState('10');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/settings');
        setGoogleApiKey(res.data.google_api_key || '');
        setGooglePlacesLimit(res.data.google_places_limit || '10');
      } catch (err) {
        console.error('Failed to fetch settings');
      }
    };
    fetchSettings();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('/api/settings/change-password', { currentPassword, newPassword });
      setMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password');
    }
  };

  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('/api/settings', {
        settings: {
          google_api_key: googleApiKey,
          google_places_limit: googlePlacesLimit,
        }
      });
      setMessage('Admin settings saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save admin settings');
    }
  };

  const handleRegisterPasskey = async () => {
    setError('');
    setMessage('');
    try {
      const optionsRes = await axios.post('/api/auth/fido2/register-options', { email: user?.email });
      const regResponse = await startRegistration(optionsRes.data);
      const verifyRes = await axios.post('/api/auth/fido2/register-verify', {
        email: user?.email,
        body: regResponse,
      });

      if (verifyRes.data.verified) {
        setMessage('Passkey registered successfully');
      } else {
        setError('Passkey registration failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Passkey registration failed');
    }
  };

  const handleBackup = async () => {
    const res = await axios.post('/api/admin/backup');
    alert(res.data.message);
  };

  const handleRestore = async () => {
    const res = await axios.post('/api/admin/restore');
    alert(res.data.message);
  };

  const isAdmin = user?.role === 'Application Administrator';

  return (
    <div className="container">
      <h2 style={{ color: 'var(--primary-color)' }}>Settings</h2>
      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3>Security</h3>
          <form onSubmit={handleChangePassword}>
            <label>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <button type="submit" className="primary" style={{ width: '100%', marginBottom: '1rem' }}>Update Password</button>
          </form>
          <hr style={{ margin: '1rem 0', borderColor: 'var(--light-gray)' }} />
          <h3>Passkeys / FIDO2</h3>
          <button onClick={handleRegisterPasskey} className="secondary" style={{ width: '100%' }}>Register New Passkey</button>
          
          <hr style={{ margin: '1rem 0', borderColor: 'var(--light-gray)' }} />
          <h3>Social Logins</h3>
          <p style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Link your account to social providers (Stubs)</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => alert('Link Google Stub')} style={{ background: '#4285F4', color: 'white' }}>Link Google</button>
            <button onClick={() => alert('Link Facebook Stub')} style={{ background: '#3b5998', color: 'white' }}>Link Facebook</button>
          </div>
        </div>

        {isAdmin && (
          <div className="card">
            <h3>Admin Controls</h3>
            <form onSubmit={handleSaveAdminSettings}>
              <label>Google Places API Key</label>
              <input type="password" value={googleApiKey} onChange={(e) => setGoogleApiKey(e.target.value)} />
              <label>Google Places Limit</label>
              <input type="number" value={googlePlacesLimit} onChange={(e) => setGooglePlacesLimit(e.target.value)} />
              <button type="submit" className="primary" style={{ width: '100%', marginBottom: '1rem' }}>Save Admin Settings</button>
            </form>
            <hr style={{ margin: '1rem 0', borderColor: 'var(--light-gray)' }} />
            <h3>Database</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleBackup} className="secondary" style={{ flex: 1 }}>Backup DB</button>
              <button onClick={handleRestore} className="secondary" style={{ flex: 1 }}>Restore DB</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
