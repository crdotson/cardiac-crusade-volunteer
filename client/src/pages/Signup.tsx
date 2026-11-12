import { useState, type FC, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { startRegistration, type RegistrationResponseJSON } from '@simplewebauthn/browser';

const Signup: FC = () => {
  const [step, setStep] = useState<'form' | 'passkey_prompt'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passkeyOnly, setPasskeyOnly] = useState(false);
  const [passkeyDisabled, setPasskeyDisabled] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { checkAuth } = useAuth();
  const navigate = useNavigate();

  const handleSignupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passkeyOnly) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    if (passkeyDisabled) {
      await finishSignup();
    } else {
      setStep('passkey_prompt');
    }
  };

  const finishSignup = async (passkey?: { signupToken: string; response: RegistrationResponseJSON }) => {
    setLoading(true);
    try {
      await axios.post('api/signup', {
        name,
        email,
        password: passkeyOnly ? null : password,
        passkey,
      });
      setAccountCreated(true);
      if (await checkAuth()) {
        navigate('/map');
      } else {
        setError('Your account was created, but automatic sign-in failed. Please log in.');
      }
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.message || 'Sign up failed. Please try again.' : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePasskey = async () => {
    setError('');
    setLoading(true);
    try {
      const optionsRes = await axios.post('api/signup/passkey-options', { email });
      const regResponse = await startRegistration({
        optionsJSON: optionsRes.data.options,
      });
      await finishSignup({ signupToken: optionsRes.data.signupToken, response: regResponse });
    } catch (err: unknown) {
      console.error('Passkey registration error:', err);
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || (passkeyOnly
        ? 'Passkey setup failed or was cancelled. Retry or return to sign up with a password.'
        : 'Passkey setup failed or was cancelled. Retry or skip to sign up with your password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToSignup = () => {
    setPasskeyOnly(false);
    setPasskeyDisabled(true);
    setError('');
    setStep('form');
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
        {accountCreated ? (
          <div style={{ textAlign: 'center' }}>
            <div className="error-message">{error}</div>
            <Link to="/login">Log In</Link>
          </div>
        ) : step === 'form' ? (
          <>
            <h2 style={{ textAlign: 'center', color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Volunteer Sign Up</h2>
            <p style={{ textAlign: 'center', color: 'var(--gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Create your account to start mapping and surveying locations.
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSignupSubmit}>
              <label>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />

              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />

              <div style={{ margin: '1rem 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="passkeyOnly"
                  checked={passkeyOnly}
                  disabled={passkeyDisabled}
                  onChange={(e) => setPasskeyOnly(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <label htmlFor="passkeyOnly" style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'normal' }}>
                  Sign up with Passkey only (no password)
                </label>
              </div>
              {passkeyDisabled && <p>Passkey setup is skipped for this signup. You can add a passkey later in Settings.</p>}

              {!passkeyOnly && (
                <>
                  <label>Password (min. 8 characters)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!passkeyOnly}
                    minLength={8}
                  />

                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!passkeyOnly}
                    minLength={8}
                  />
                </>
              )}

              <button
                type="submit"
                className="primary"
                style={{ width: '100%', marginTop: '1rem', marginBottom: '1rem' }}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : (passkeyOnly ? 'Continue to Passkey Setup' : 'Sign Up')}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--light-gray)' }}>
              <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>Already have an account? </span>
              <Link to="/login" style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.9rem' }}>
                Log In
              </Link>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔐</div>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>Set Up a Passkey</h2>
            <p style={{ color: 'var(--gray)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Would you like to create a passkey for faster and more secure sign-ins with Face ID, Touch ID, or your device lock?
            </p>

            {error && <div className="error-message" style={{ textAlign: 'left', marginBottom: '1rem' }}>{error}</div>}

            <button
              type="button"
              className="primary"
              style={{ width: '100%', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={loading}
              onClick={handleCreatePasskey}
            >
              <span>{loading ? 'Configuring Passkey...' : 'Create Passkey'}</span>
            </button>

            <button
              type="button"
              className="secondary"
              style={{ width: '100%' }}
              disabled={loading}
              onClick={passkeyOnly ? handleReturnToSignup : () => void finishSignup()}
            >
              {passkeyOnly ? 'Return to Sign Up' : 'Skip for Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
