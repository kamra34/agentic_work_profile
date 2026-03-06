import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPages.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function LoginPage({ onLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.detail && Array.isArray(data.detail)) {
          const errorMessages = data.detail.map(err => {
            const field = err.loc[err.loc.length - 1];
            return `${field}: ${err.msg}`;
          }).join(', ');
          throw new Error(errorMessages);
        } else if (typeof data.detail === 'string') {
          throw new Error(data.detail);
        } else {
          throw new Error('Login failed');
        }
      }

      localStorage.setItem('token', data.access_token);
      onLogin(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-back-nav">
        <Link to="/" className="back-link">
          <span className="back-arrow">←</span>
          Back to Home
        </Link>
      </div>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p>Sign in to continue to your dashboard</p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <div className="auth-helper-row">
                <Link to="/forgot-password" className="auth-link helper-link">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-visual">
          <div className="visual-content">
            <h2>Start Your Job Search Journey</h2>
            <ul className="benefit-list">
              <li>
                <span className="benefit-icon">✓</span>
                Create unlimited tailored CVs
              </li>
              <li>
                <span className="benefit-icon">✓</span>
                AI-powered job matching
              </li>
              <li>
                <span className="benefit-icon">✓</span>
                Track all your applications
              </li>
              <li>
                <span className="benefit-icon">✓</span>
                Professional templates
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
