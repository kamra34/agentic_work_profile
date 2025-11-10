import { useState } from 'react';
import ProfileManagement from './ProfileManagement';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
            <h3>Analyze Job Requirements with AI</h3>
            <p>Paste a job description and let AI analyze the requirements using both OpenAI GPT-4o and Anthropic Claude Sonnet 4.5. Get detailed insights about required skills, education, experience level, and job category (technical, managerial, leadership, etc.).</p>
            <button className="step-btn" onClick={() => onNavigate('tailor')}>
              Analyze Job with AI →
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

// Tailor CV View Component
function TailorCVView() {
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description to analyze');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/job/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ job_description: jobDescription })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze job description');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setJobDescription('');
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="tailor-cv-view">
      <div className="tailor-header">
        <h1>AI-Powered Job Description Analysis</h1>
        <p className="tailor-subtitle">
          Paste a job description below and let our AI analyze the requirements, skills, and qualifications needed for the role.
        </p>
      </div>

      <div className="tailor-content">
        <div className="job-input-section">
          <label className="input-label">
            Job Description
            <span className="input-hint">Paste the complete job posting including requirements, responsibilities, and qualifications</span>
          </label>
          <textarea
            className="job-description-input"
            placeholder="Paste the job description here...

Example:
Senior Software Engineer - AI/ML

We are seeking an experienced Senior Software Engineer to join our AI/ML team...

Requirements:
• 5+ years of software development experience
• Strong Python and machine learning expertise
• Bachelor's degree in Computer Science or related field
..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={12}
          />

          <div className="action-buttons">
            <button
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={analyzing || !jobDescription.trim()}
            >
              {analyzing ? (
                <>
                  <span className="spinner"></span>
                  Analyzing with AI...
                </>
              ) : (
                <>
                  🤖 Analyze with AI
                </>
              )}
            </button>
            {(jobDescription || analysis) && (
              <button className="btn-clear" onClick={handleClear}>
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {analysis && (
          <div className="analysis-results">
            <h2 className="results-title">Analysis Results</h2>
            <p className="results-subtitle">
              Powered by OpenAI GPT-4o and Anthropic Claude Sonnet 4.5
            </p>

            {analysis.analyses && analysis.analyses.map((result, idx) => (
              <div key={idx} className="analysis-block">
                <div className="analysis-header">
                  <h3 className="provider-name">
                    {result.provider === 'openai' ? '🟢 OpenAI GPT-4o' : '🔵 Anthropic Claude Sonnet 4.5'}
                  </h3>
                  {result.model && <span className="model-badge">{result.model}</span>}
                </div>

                {result.error ? (
                  <div className="provider-error">
                    <span className="error-icon">⚠️</span>
                    Error: {result.error}
                  </div>
                ) : result.analysis && (
                  <div className="analysis-content">
                    {renderAnalysisSection('Job Category', result.analysis.job_category || result.analysis['Job Category'])}
                    {renderAnalysisSection('Job Level', result.analysis.job_level || result.analysis['Job Level'])}
                    {renderAnalysisSection('Technical Skills', result.analysis.technical_skills || result.analysis['Technical Skills'])}
                    {renderAnalysisSection('Soft Skills', result.analysis.soft_skills || result.analysis['Soft Skills'])}
                    {renderAnalysisSection('Education Requirements', result.analysis.education_requirements || result.analysis['Education Requirements'])}
                    {renderAnalysisSection('Experience Requirements', result.analysis.experience_requirements || result.analysis['Experience Requirements'])}
                    {renderAnalysisSection('Responsibilities', result.analysis.responsibilities || result.analysis['Responsibilities'])}
                    {renderAnalysisSection('Preferred Qualifications', result.analysis.preferred_qualifications || result.analysis['Preferred Qualifications'])}
                    {renderAnalysisSection('Domain/Industry', result.analysis.domain || result.analysis['Domain/Industry'])}
                    {renderAnalysisSection('Key Requirements', result.analysis.key_requirements || result.analysis['Key Requirements'])}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to render analysis sections
function renderAnalysisSection(title, content) {
  if (!content) return null;

  return (
    <div className="analysis-section">
      <h4 className="section-title">{title}</h4>
      <div className="section-content">
        {Array.isArray(content) ? (
          <ul className="content-list">
            {content.map((item, idx) => (
              <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
            ))}
          </ul>
        ) : typeof content === 'object' ? (
          <div className="content-object">
            {Object.entries(content).map(([key, value]) => (
              <div key={key} className="object-item">
                <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}
              </div>
            ))}
          </div>
        ) : (
          <p className="content-text">{String(content)}</p>
        )}
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
