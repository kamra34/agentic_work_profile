import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { AIAnalysisProvider } from './context/AIAnalysisContext';
import './App.css';

const API_URL = 'http://localhost:8000';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: ''
  });
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser(token);
    }
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      localStorage.removeItem('token');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const body = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors from Pydantic
        if (data.detail && Array.isArray(data.detail)) {
          // Pydantic validation error format
          const errorMessages = data.detail.map(err => {
            const field = err.loc[err.loc.length - 1];
            return `${field}: ${err.msg}`;
          }).join(', ');
          throw new Error(errorMessages);
        } else if (typeof data.detail === 'string') {
          throw new Error(data.detail);
        } else {
          throw new Error('Something went wrong');
        }
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        await fetchCurrentUser(data.access_token);
      } else {
        setIsLogin(true);
        setFormData({ full_name: '', email: '', password: '' });
        setError('Registration successful! Please login.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setFormData({ full_name: '', email: '', password: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (user) {
    return (
      <AIAnalysisProvider>
        <Dashboard user={user} onLogout={handleLogout} />
      </AIAnalysisProvider>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <p className="subtitle">
          {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
        </p>

        {error && (
          <div className={`alert ${error.includes('successful') ? 'alert-success' : 'alert-error'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
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
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
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
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && (
              <small style={{ color: '#718096', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                Password must be 6-72 characters long
              </small>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="toggle-auth">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ full_name: '', email: '', password: '' });
            }}
            className="link-btn"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
