import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './AuthPages.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      setMessage(data.message || 'Password reset successful.');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-back-nav">
        <Link to="/login" className="back-link">
          <span className="back-arrow">←</span>
          Back to Login
        </Link>
      </div>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Set New Password</h1>
            <p>Create a new password for your account.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repeat the new password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
          <div className="auth-footer">
            <p>
              Need a new link?{' '}
              <Link to="/forgot-password" className="auth-link">
                Request again
              </Link>
            </p>
          </div>
        </div>
        <div className="auth-visual">
          <div className="visual-content">
            <h2>Account Security</h2>
            <ul className="benefit-list">
              <li><span className="benefit-icon">✓</span>Reset links expire automatically</li>
              <li><span className="benefit-icon">✓</span>Old links become invalid after reset</li>
              <li><span className="benefit-icon">✓</span>Admin fallback remains available</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
