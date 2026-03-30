import { useState, type FC, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { startAuthentication } from '@simplewebauthn/browser';

const Login: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, checkAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
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
      // Trigger discoverable login immediately
      const optionsRes = await axios.post('api/auth/fido2/login-options', { email: undefined });
      const authResponse = await startAuthentication({
        optionsJSON: optionsRes.data
      });
      const verifyRes = await axios.post('api/auth/fido2/login-verify', {
        email: undefined,
        body: authResponse,
      });

      if (verifyRes.data.verified) {
        await checkAuth();
        navigate('/');
      } else {
        setError('Passkey verification failed');
      }
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setError('Passkey login failed. Please ensure you have a registered passkey on this device.');
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>Login</h2>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="primary" style={{ width: '100%', marginBottom: '1.5rem' }}>Login with Password</button>
        </form>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', height: '1px', background: 'var(--light-gray)', margin: '1rem 0' }}>
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              background: 'white', 
              padding: '0 10px', 
              color: 'var(--gray)',
              fontSize: '0.8rem'
            }}>OR</span>
          </div>
        </div>

        <button 
          type="button" 
          className="secondary" 
          style={{ width: '100%', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
          onClick={handlePasskeyLogin}
        >
          <span>Use a Passkey / FaceID</span>
        </button>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Forgot Password?</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
