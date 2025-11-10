import { useState } from 'react';
import ProfileManagement from './ProfileManagement';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('profiles');

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-content">
          <h2>Professional Profile Manager</h2>
          <div className="navbar-right">
            <span className="user-name">{user.full_name}</span>
            <button onClick={onLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <aside className="sidebar">
          <button
            className={`sidebar-item ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            <span className="icon">📝</span>
            My Profiles
          </button>
          <button
            className="sidebar-item"
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <span className="icon">🎯</span>
            Job Matching
            <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>Coming Soon</span>
          </button>
          <button
            className="sidebar-item"
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <span className="icon">📄</span>
            Generate CV
            <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>Coming Soon</span>
          </button>
        </aside>

        <main className="main-content">
          {activeTab === 'profiles' && (
            <ProfileManagement />
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
