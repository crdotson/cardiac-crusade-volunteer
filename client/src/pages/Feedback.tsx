import { useState, useEffect, type FC, type FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface FeedbackEntry {
  id: number;
  user_id: number | null;
  user_email: string;
  user_name: string | null;
  message: string;
  status: 'New' | 'Reviewed' | string;
  email_sent: boolean;
  email_error: string | null;
  created_at: string;
}

const Feedback: FC = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const isAdmin = user?.role === 'Application Administrator';

  const fetchFeedback = async () => {
    try {
      const res = await axios.get('api/feedback');
      setEntries(res.data);
    } catch (err) {
      console.error('Failed to load feedback log', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please enter your feedback before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('api/feedback', { message: trimmed });
      setMessage('');
      const saved: FeedbackEntry | undefined = res.data?.feedback;
      if (saved?.email_sent) {
        setSuccess('Thank you! Your feedback has been logged and emailed to the administrator.');
      } else {
        setSuccess('Thank you! Your feedback has been logged.');
      }
      await fetchFeedback();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (entry: FeedbackEntry) => {
    const nextStatus = entry.status === 'Reviewed' ? 'New' : 'Reviewed';
    setUpdatingId(entry.id);
    setError('');
    try {
      const res = await axios.patch(`api/feedback/${entry.id}`, { status: nextStatus });
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? res.data : item)));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update feedback status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container">
      <h2 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>Feedback</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Send Feedback</h3>
        <p style={{ color: 'var(--gray)', fontSize: '0.95rem', marginTop: 0 }}>
          Share bug reports, suggestions, or questions. Your feedback is saved to the internal log and sent to the application administrator.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="feedback-message">Your Feedback</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Describe what worked well, what didn't, or what you'd like to see..."
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '4px',
              border: '1px solid var(--light-gray)',
              fontFamily: 'inherit',
              fontSize: '1rem',
              resize: 'vertical',
              marginBottom: '1rem',
              boxSizing: 'border-box',
            }}
            required
          />
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {isAdmin ? 'Internal Feedback Log' : 'My Submitted Feedback'}
        </h3>
        {loading ? (
          <p style={{ color: 'var(--gray)' }}>Loading feedback...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: 'var(--gray)', fontStyle: 'italic' }}>
            {isAdmin ? 'No feedback has been submitted yet.' : 'You have not submitted any feedback yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid var(--light-gray)',
                  borderRadius: '6px',
                  padding: '0.9rem 1rem',
                  backgroundColor: entry.status === 'Reviewed' ? '#fafafa' : '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>
                    {isAdmin && (
                      <strong style={{ color: '#222', marginRight: '0.5rem' }}>
                        {entry.user_name ? `${entry.user_name} (${entry.user_email})` : entry.user_email}
                      </strong>
                    )}
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isAdmin && (
                      <span
                        title={entry.email_error || (entry.email_sent ? 'Email delivered' : 'Email not sent')}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          backgroundColor: entry.email_sent ? '#e6f4ea' : '#fce8e6',
                          color: entry.email_sent ? '#137333' : '#c5221f',
                          fontWeight: 600,
                        }}
                      >
                        {entry.email_sent ? 'Email Sent' : 'Email Failed'}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: entry.status === 'Reviewed' ? '#e8f0fe' : '#fef7e0',
                        color: entry.status === 'Reviewed' ? '#1967d2' : '#b06000',
                        fontWeight: 600,
                      }}
                    >
                      {entry.status || 'New'}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={updatingId === entry.id}
                        onClick={() => handleToggleStatus(entry)}
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', marginBottom: 0 }}
                      >
                        {entry.status === 'Reviewed' ? 'Mark New' : 'Mark Reviewed'}
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{entry.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feedback;
