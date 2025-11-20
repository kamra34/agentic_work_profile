import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import GlobalAIStatusBar from './GlobalAIStatusBar';
import { useAIAnalysis } from '../context/AIAnalysisContext';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Dashboard({ user, onLogout }) {
  const [backendVersion, setBackendVersion] = useState(null);
  const [frontendVersion, setFrontendVersion] = useState(null);
  const { isAnalyzing } = useAIAnalysis();

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      // Fetch backend version
      const backendResponse = await fetch(`${API_URL}/api/version`);
      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        setBackendVersion(backendData.version);
      }

      // Fetch frontend version
      const frontendResponse = await fetch('/VERSION');
      if (frontendResponse.ok) {
        const frontendText = await frontendResponse.text();
        setFrontendVersion(frontendText.trim());
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    }
  };

  return (
    <div className="dashboard">
      {/* Global AI Status Bar - Shows across all pages */}
      <GlobalAIStatusBar />

      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-left">
            <h2>🎯 Agentic CV Builder</h2>
            <div className="navbar-versions">
              {frontendVersion && (
                <span className="version-badge">FE: v{frontendVersion}</span>
              )}
              {backendVersion && (
                <span className="version-badge">BE: v{backendVersion}</span>
              )}
            </div>
          </div>
          <div className="navbar-right">
            <span className="user-name">👤 {user.full_name}</span>
            <button onClick={onLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="sidebar-section">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">🏠</span>
              <span className="label">Dashboard</span>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">📋 Profile Management</div>
            <NavLink
              to="/dashboard/profile"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              title="View and edit your personal profile"
            >
              <span className="icon">👤</span>
              <span className="label">My Profile</span>
              <span className="badge badge-new">New</span>
            </NavLink>
            <NavLink
              to="/dashboard/pool"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isAnalyzing ? 'disabled' : ''}`}
              onClick={(e) => {
                if (isAnalyzing) {
                  e.preventDefault();
                  alert('⚠️ Cannot edit Profile Pool while AI analysis is running.\n\nPlease wait for the analysis to complete or navigate to Tailor CV to cancel it.');
                }
              }}
              title={isAnalyzing ? 'Blocked during AI analysis' : 'Your complete pool of experiences, skills, and achievements'}
            >
              <span className="icon">📝</span>
              <span className="label">Profile Pool</span>
              {isAnalyzing ? (
                <span className="badge badge-locked">🔒 Locked</span>
              ) : (
                <span className="badge">Essential</span>
              )}
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">🎯 CV Creation</div>
            <NavLink
              to="/dashboard/tailor"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">✨</span>
              <span className="label">Tailor CV</span>
              <span className="badge badge-ai">AI</span>
            </NavLink>
            <NavLink
              to="/dashboard/portfolio"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">💼</span>
              <span className="label">CV Portfolio</span>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">📊 Applications</div>
            <NavLink
              to="/dashboard/applications"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">📈</span>
              <span className="label">Application Tracker</span>
            </NavLink>
          </div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
