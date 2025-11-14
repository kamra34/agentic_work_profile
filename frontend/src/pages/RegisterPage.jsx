import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPages.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
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
      const response = await fetch(`${API_URL}/api/register`, {
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
          throw new Error('Registration failed');
        }
      }

      // Registration successful, redirect to login
      navigate('/login?registered=true');
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
            <h1>Create Your Account</h1>
            <p>Start creating professional CVs in minutes</p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="full_name">Full Name</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                autoComplete="name"
                placeholder="John Doe"
              />
            </div>

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
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
              <small className="form-hint">
                Password must be 6-72 characters long
              </small>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-visual">
          <div className="visual-content">
            <h2>Join Thousands of Job Seekers</h2>
            <div className="stats-showcase">
              <div className="stat-item">
                <div className="stat-number">10,000+</div>
                <div className="stat-text">CVs Generated</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">95%</div>
                <div className="stat-text">Success Rate</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">5 min</div>
                <div className="stat-text">Average Time</div>
              </div>
            </div>
            <ul className="benefit-list">
              <li>
                <span className="benefit-icon">✓</span>
                No credit card required
              </li>
              <li>
                <span className="benefit-icon">✓</span>
                Free to get started
              </li>
              <li>
                <span className="benefit-icon">✓</span>
                Cancel anytime
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
