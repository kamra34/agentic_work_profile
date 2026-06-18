import { useNavigate } from 'react-router-dom';
import './DashboardHomePage.css';

function DashboardHomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-view">
      <div className="welcome-section">
        <h1 className="welcome-title">Welcome to Your Agentic CV Builder</h1>
        <p className="welcome-subtitle">
          An intelligent AI-powered platform that transforms how you create CVs. Build your complete professional profile once with unlimited hierarchical structure, then let dual-AI models (OpenAI + Claude) analyze jobs and intelligently select the best-matching content for each application - no AI-generated content, just smart selection from YOUR experiences.
        </p>
      </div>

      <div className="workflow-container">
        <h2 className="workflow-heading">Your Complete Workflow</h2>
        <div className="steps-grid">
          <div className="step-card step-1">
            <div className="step-number">1</div>
            <div className="step-icon">👤</div>
            <div className="step-content">
              <h3>My Profile</h3>
              <p>Set your core contact information (phone, email, name, LinkedIn, GitHub, portfolio) that will be used across all generated CVs. Your professional identity in one place.</p>
              <button className="step-btn" onClick={() => navigate('/dashboard/profile')}>
                Edit My Profile →
              </button>
            </div>
          </div>

          <div className="step-card step-2">
            <div className="step-number">2</div>
            <div className="step-icon">📝</div>
            <div className="step-content">
              <h3>Profile Pool</h3>
              <p>Your comprehensive repository of ALL experiences, skills, and achievements with unlimited nested structure. Sections, entries, sub-entries, bullet points, text paragraphs - organize your complete career story in any form you need.</p>
              <button className="step-btn" onClick={() => navigate('/dashboard/pool')}>
                Build Profile Pool →
              </button>
            </div>
          </div>

          <div className="step-card step-3">
            <div className="step-number">3</div>
            <div className="step-icon">✨</div>
            <div className="step-content">
              <h3>Tailor CV</h3>
              <p>Paste a job description and watch dual-AI magic: OpenAI and Claude analyze requirements, calculate your Profile Fit score and ATS compatibility, provide expert recruiter verdict on whether to apply, and intelligently SELECT (never generate) the best items from your Profile Pool optimized for this specific role. AI works in the background so you can continue and return when ready.</p>
              <button className="step-btn" onClick={() => navigate('/dashboard/tailor')}>
                Tailor with AI →
              </button>
            </div>
          </div>

          <div className="step-card step-4">
            <div className="step-number">4</div>
            <div className="step-icon">💼</div>
            <div className="step-content">
              <h3>CV Portfolio</h3>
              <p>View each tailored CV with complete job details and AI scores from both models. Include/exclude suggested parts and see real-time impact on your ATS score. Customize your CV, preview live, and export professional PDFs in multiple templates (Professional, Creative, Compact, ATS-Optimized).</p>
              <button className="step-btn" onClick={() => navigate('/dashboard/portfolio')}>
                View Portfolio →
              </button>
            </div>
          </div>

          <div className="step-card step-5">
            <div className="step-number">5</div>
            <div className="step-icon">📊</div>
            <div className="step-content">
              <h3>Application Tracker</h3>
              <p>See all applications in beautiful Kanban board or table view. Track status by dragging and dropping between columns (Applied → Phone Screen → Interview → Offer). Full timeline tracking with dates for each stage. Later download the exact CV used for each application.</p>
              <button className="step-btn" onClick={() => navigate('/dashboard/applications')}>
                Track Applications →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <h2>Why Choose AI-Powered CV Tailoring?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h4>Dual-AI Intelligence</h4>
            <p>Get unbiased recommendations from both OpenAI and Claude. Items selected by both models = strongest matches.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h4>10x Faster</h4>
            <p>No more spending hours customizing CVs. AI analyzes job requirements and selects your best-fit content in seconds.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h4>Smart Scoring</h4>
            <p>Real-time Profile Fit and ATS Compatibility scores show exactly how well you match each role before applying.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h4>ATS-Optimized</h4>
            <p>Professional PDFs designed to pass Applicant Tracking Systems while maintaining visual appeal for human recruiters.</p>
          </div>
        </div>
      </div>

      <div className="quick-stats-section">
        <div className="stat-card">
          <div className="stat-number">2</div>
          <div className="stat-label">AI Models</div>
          <div className="stat-description">OpenAI + Claude</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">∞</div>
          <div className="stat-label">CV Versions</div>
          <div className="stat-description">Unlimited tailoring</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">100%</div>
          <div className="stat-label">Your Content</div>
          <div className="stat-description">AI selects, never creates</div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHomePage;
