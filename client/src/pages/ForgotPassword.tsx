import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const navigate = useNavigate();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      if (res.data.isSocial) {
        setMessage(res.data.message);
      } else {
        setMessage(res.data.message);
        setStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp });
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'OTP verification failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post('/api/auth/reset-password', { token: resetToken, newPassword });
      setMessage('Password reset successful. You can now login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Password reset failed');
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>Forgot Password</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {step === 1 && (
          <form onSubmit={handleSendOTP}>
            <p style={{ marginBottom: '1rem' }}>Enter your email to receive a 6-digit OTP.</p>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="primary" style={{ width: '100%' }}>Send OTP</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP}>
            <p style={{ marginBottom: '1rem' }}>Enter the 6-digit OTP sent to {email}.</p>
            <label>OTP</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
            <button type="submit" className="primary" style={{ width: '100%' }}>Verify OTP</button>
            <button type="button" className="secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setStep(1)}>Back</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <p style={{ marginBottom: '1rem' }}>Enter your new password.</p>
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <button type="submit" className="primary" style={{ width: '100%' }}>Reset Password</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/login" style={{ color: 'var(--gray)' }}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
