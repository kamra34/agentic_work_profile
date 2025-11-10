import { useState } from 'react';
import ProfileManagement from './ProfileManagement';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-left">
            <h2>🎯 Agentic CV Builder</h2>
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
            <button
              className={`sidebar-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span className="icon">🏠</span>
              <span className="label">Home</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Build Your Profile</div>
            <button
              className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span className="icon">📝</span>
              <span className="label">Master Profile</span>
              <span className="badge">Essential</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">AI-Powered CV</div>
            <button
              className={`sidebar-item ${activeTab === 'tailor' ? 'active' : ''}`}
              onClick={() => setActiveTab('tailor')}
            >
              <span className="icon">🎯</span>
              <span className="label">Tailor CV</span>
              <span className="badge badge-ai">AI</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <span className="icon">📄</span>
              <span className="label">Export CV</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">My CVs</div>
            <button
              className={`sidebar-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <span className="icon">💾</span>
              <span className="label">Saved CVs</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === 'home' && <HomeView onNavigate={setActiveTab} />}
          {activeTab === 'profile' && <ProfileManagement />}
          {activeTab === 'tailor' && <TailorCVView />}
          {activeTab === 'export' && <ExportCVView />}
          {activeTab === 'saved' && <SavedCVsView />}
        </main>
      </div>
    </div>
  );
}

// Home View Component
function HomeView({ onNavigate }) {
  return (
    <div className="home-view">
      <div className="welcome-section">
        <h1 className="welcome-title">Welcome to Your AI-Powered CV Builder</h1>
        <p className="welcome-subtitle">
          Create a master profile of all your skills and experiences, then let AI tailor perfect CVs for each job application.
        </p>
      </div>

      <div className="steps-grid">
        <div className="step-card step-1">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Build Your Master Profile</h3>
            <p>Add all your work experiences, education, skills, projects, and achievements. This is your complete professional portfolio - don't worry about length or relevance yet.</p>
            <button className="step-btn" onClick={() => onNavigate('profile')}>
              Start Building →
            </button>
          </div>
        </div>

        <div className="step-card step-2">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Tailor CV with AI</h3>
            <p>Paste a job description and let our AI analyze it against your master profile. Get intelligent suggestions on which experiences and skills to include for maximum impact.</p>
            <button className="step-btn" onClick={() => onNavigate('tailor')}>
              Tailor CV with AI →
            </button>
          </div>
        </div>

        <div className="step-card step-3">
          <div className="step-number">3</div>
          <div className="step-content">
            <h3>Export & Apply</h3>
            <p>Download your tailored CV as a professional PDF, perfectly optimized for the specific role. Save multiple versions for different applications.</p>
            <button className="step-btn" onClick={() => onNavigate('export')}>
              Export CV →
            </button>
          </div>
        </div>
      </div>

      <div className="features-section">
        <h2>Why Use AI-Powered CV Tailoring?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h4>Intelligent Matching</h4>
            <p>AI analyzes job requirements and recommends the most relevant experiences from your profile.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h4>Save Time</h4>
            <p>No more manually customizing CVs for each application. Let AI do the heavy lifting.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h4>Fit Score</h4>
            <p>See how well your profile matches the job requirements and identify gaps.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h4>Professional Output</h4>
            <p>Generate clean, ATS-friendly PDFs that get past automated screening systems.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tailor CV View Component (Placeholder)
function TailorCVView() {
  return (
    <div className="placeholder-view">
      <div className="placeholder-content">
        <div className="placeholder-icon">🎯</div>
        <h2>AI-Powered CV Tailoring</h2>
        <p className="placeholder-description">
          This feature is under development. Soon you'll be able to:
        </p>
        <ul className="placeholder-list">
          <li>Paste job descriptions for AI analysis</li>
          <li>Get intelligent recommendations on which profile items to include</li>
          <li>See fit scores and gap analysis</li>
          <li>Generate tailored CVs optimized for specific roles</li>
          <li>Save multiple CV versions for different applications</li>
        </ul>
        <div className="placeholder-cta">
          <p>Start by building your master profile with all your experiences and skills!</p>
        </div>
      </div>
    </div>
  );
}

// Export CV View Component (Placeholder)
function ExportCVView() {
  return (
    <div className="placeholder-view">
      <div className="placeholder-content">
        <div className="placeholder-icon">📄</div>
        <h2>Export Your CV</h2>
        <p className="placeholder-description">
          This feature is under development. Soon you'll be able to:
        </p>
        <ul className="placeholder-list">
          <li>Download CVs as professional PDFs</li>
          <li>Choose from multiple templates and layouts</li>
          <li>Customize colors, fonts, and styling</li>
          <li>Export in ATS-friendly formats</li>
          <li>Generate cover letters from your profile</li>
        </ul>
        <div className="placeholder-cta">
          <p>For now, you can preview your CV in the Master Profile section.</p>
        </div>
      </div>
    </div>
  );
}

// Saved CVs View Component (Placeholder)
function SavedCVsView() {
  return (
    <div className="placeholder-view">
      <div className="placeholder-content">
        <div className="placeholder-icon">💾</div>
        <h2>Your Saved CVs</h2>
        <p className="placeholder-description">
          This feature is under development. Soon you'll be able to:
        </p>
        <ul className="placeholder-list">
          <li>View all your saved CV versions</li>
          <li>Track which CV was used for which application</li>
          <li>See creation and modification dates</li>
          <li>Duplicate and modify existing CVs</li>
          <li>Organize CVs by job type or company</li>
        </ul>
        <div className="placeholder-cta">
          <p>Start creating tailored CVs to build your collection!</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
