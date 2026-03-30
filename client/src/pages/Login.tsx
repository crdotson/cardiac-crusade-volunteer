import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { startAuthentication } from '@simplewebauthn/browser';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usePasskey, setUsePasskey] = useState(false);
  const { login, checkAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    try {
      const optionsRes = await axios.post('api/auth/fido2/login-options', { email });
      const authResponse = await startAuthentication(optionsRes.data);
      const verifyRes = await axios.post('api/auth/fido2/login-verify', {
        email,
        body: authResponse,
      });

      if (verifyRes.data.verified) {
        await checkAuth();
        navigate('/');
      } else {
        setError('Passkey verification failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Passkey login failed. Ensure your email is correct and you have registered a passkey.');
    }
  };

  const handleSocialStub = (provider: string) => {
    alert(`${provider} login is not implemented yet in this prototype.`);
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>Login</h2>
        {error && <div className="error-message">{error}</div>}

        {!usePasskey ? (
          <form onSubmit={handleSubmit}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="primary" style={{ width: '100%', marginBottom: '1rem' }}>Login with Password</button>
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={() => setUsePasskey(true)}>Use Passkey/FIDO2</button>
          </form>
        ) : (
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email to find passkey" />
            <button type="button" className="primary" style={{ width: '100%', marginBottom: '1rem' }} onClick={handlePasskeyLogin}>Login with Passkey</button>
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={() => setUsePasskey(false)}>Back to Password</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--light-gray)', paddingTop: '1rem' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--gray)' }}>Or login with</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button onClick={() => handleSocialStub('Google')} style={{ background: '#4285F4', color: 'white' }}>G</button>
            <button onClick={() => handleSocialStub('Facebook')} style={{ background: '#3b5998', color: 'white' }}>F</button>
            <button onClick={() => handleSocialStub('Microsoft')} style={{ background: '#00a1f1', color: 'white' }}>M</button>
            <button onClick={() => handleSocialStub('Apple')} style={{ background: '#000000', color: 'white' }}>A</button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Forgot Password?</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
