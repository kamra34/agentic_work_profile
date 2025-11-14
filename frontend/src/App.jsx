import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/layouts/PublicLayout';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import ExamplesPage from './pages/ExamplesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { AIAnalysisProvider } from './context/AIAnalysisContext';
import { setLogoutCallback, initializeActivityTracking, cleanupActivityTracking } from './utils/api';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up logout callback for the API client
    setLogoutCallback(handleLogout);

    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser(token);
      // Initialize activity tracking for token refresh
      initializeActivityTracking();
    } else {
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      cleanupActivityTracking();
    };
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
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (token) => {
    await fetchCurrentUser(token);
    initializeActivityTracking();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    cleanupActivityTracking();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.25rem',
        color: '#667eea'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          <PublicLayout>
            <LandingPage />
          </PublicLayout>
        } />
        <Route path="/features" element={
          <PublicLayout>
            <FeaturesPage />
          </PublicLayout>
        } />
        <Route path="/examples" element={
          <PublicLayout>
            <ExamplesPage />
          </PublicLayout>
        } />
        <Route path="/how-it-works" element={
          <PublicLayout>
            <HowItWorksPage />
          </PublicLayout>
        } />

        {/* Auth Routes */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : <RegisterPage />
        } />

        {/* Protected Routes */}
        <Route path="/dashboard/*" element={
          <ProtectedRoute isAuthenticated={!!user}>
            <AIAnalysisProvider>
              <Dashboard user={user} onLogout={handleLogout} />
            </AIAnalysisProvider>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
