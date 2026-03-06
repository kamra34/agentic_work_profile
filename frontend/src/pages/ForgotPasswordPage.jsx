import { useState } from 'react';
import { Link } from 'react-router-dom';
import './AuthPages.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to request password reset');
      }
      setMessage(data.message || 'If the email is registered, a reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Failed to request password reset');
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
            <h1>Forgot Password</h1>
            <p>Enter your email and we will send you a reset link.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <div className="auth-footer">
            <p>
              Remembered your password?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
        <div className="auth-visual">
          <div className="visual-content">
            <h2>Secure Account Recovery</h2>
            <ul className="benefit-list">
              <li><span className="benefit-icon">✓</span>Token expires automatically</li>
              <li><span className="benefit-icon">✓</span>No passwords sent by email</li>
              <li><span className="benefit-icon">✓</span>Works with your existing account</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
