import { useState } from 'react';
import ProfileUpload from './ProfileUpload';
import ProfileEditor from './ProfileEditor';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [profile, setProfile] = useState(null);

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-content">
          <h2>CV Profile Builder</h2>
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
            className={`sidebar-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <span className="icon">📄</span>
            Upload CV
          </button>
          <button
            className={`sidebar-item ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <span className="icon">✏️</span>
            Edit Profile
          </button>
        </aside>

        <main className="main-content">
          {activeTab === 'upload' && (
            <ProfileUpload
              onUploadSuccess={(newProfile) => {
                setProfile(newProfile);
                setActiveTab('editor');
              }}
            />
          )}
          {activeTab === 'editor' && (
            <ProfileEditor
              profile={profile}
              onProfileUpdate={setProfile}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
