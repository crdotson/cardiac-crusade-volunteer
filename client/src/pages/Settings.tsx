import { useState, useEffect, type FC, type FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';

const Settings: FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googlePlacesLimit, setGooglePlacesLimit] = useState('10');
  const [defaultOriginCity, setDefaultOriginCity] = useState('');
  const [credentials, setCredentials] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const fetchSettings = async () => {
    try {
      const res = await axios.get('api/settings');
      setGoogleApiKey(res.data.google_api_key || '');
      setGooglePlacesLimit(res.data.google_places_limit || '10');
      setDefaultOriginCity(res.data.default_origin_city || 'Lexington, KY');
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  const fetchCredentials = async () => {
    try {
      const res = await axios.get('api/auth/fido2/credentials');
      setCredentials(res.data);
    } catch (err) {
      console.error('Failed to fetch credentials');
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCredentials();
  }, []);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('api/settings/change-password', { currentPassword, newPassword });
      setMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password');
    }
  };

  const handleSaveAdminSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('api/settings', {
        settings: {
          google_api_key: googleApiKey,
          google_places_limit: googlePlacesLimit,
          default_origin_city: defaultOriginCity,
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
    
    const passkeyName = window.prompt("Provide a name for this passkey, to remind you which device you created it on.");
    if (!passkeyName) return;

    try {
      const optionsRes = await axios.post('api/auth/fido2/register-options', { email: user?.email });
      const regResponse = await startRegistration({
        optionsJSON: optionsRes.data
      });
      const verifyRes = await axios.post('api/auth/fido2/register-verify', {
        email: user?.email,
        body: regResponse,
        deviceName: passkeyName,
      });

      if (verifyRes.data.verified) {
        setMessage('Passkey registered successfully');
        fetchCredentials(); // Refresh list
      } else {
        setError('Passkey registration failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Passkey registration failed');
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this passkey?')) return;
    try {
      await axios.delete(`api/auth/fido2/credentials/${id}`);
      setMessage('Passkey deleted successfully');
      fetchCredentials(); // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete passkey');
    }
  };

  const handleBackup = async () => {
    const res = await axios.post('api/admin/backup');
    alert(res.data.message);
  };

  const handleRestore = async () => {
    const res = await axios.post('api/admin/restore');
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
          <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Passkeys provide a more secure, passwordless login experience.
          </p>
          <button onClick={handleRegisterPasskey} className="secondary" style={{ width: '100%', marginBottom: '1rem' }}>Register New Passkey</button>
          
          <div className="credentials-list" style={{ marginTop: '1rem' }}>
            <h4>Registered Passkeys</h4>
            {credentials.length === 0 ? (
              <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--gray)' }}>No passkeys registered yet.</p>
            ) : (
              credentials.map((cred) => (
                <div key={cred.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '0.75rem', 
                  border: '1px solid var(--light-gray)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{cred.deviceName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>
                      Added: {new Date(cred.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeletePasskey(cred.id)}
                    className="danger" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
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
              <label>Default Origin City</label>
              <input type="text" value={defaultOriginCity} onChange={(e) => setDefaultOriginCity(e.target.value)} />
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
