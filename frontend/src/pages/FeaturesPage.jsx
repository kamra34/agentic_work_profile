import { Link } from 'react-router-dom';
import './FeaturesPage.css';

function FeaturesPage() {
  return (
    <div className="features-page">
      {/* Header */}
      <section className="page-hero">
        <div className="page-hero-container">
          <h1>Powerful Features for Modern Job Seekers</h1>
          <p>
            Everything you need to create professional, tailored CVs that get you
            noticed by recruiters and pass through ATS systems.
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="main-features">
        <div className="section-container">
          <div className="feature-detail">
            <div className="feature-detail-content">
              <div className="feature-detail-icon">🤖</div>
              <h2>AI-Powered CV Tailoring</h2>
              <p>
                Our advanced AI analyzes job descriptions and automatically
                optimizes your CV to match the requirements. It highlights your
                most relevant experiences, adjusts keywords for ATS systems, and
                ensures your application stands out.
              </p>
              <ul className="feature-benefits">
                <li>Automatic keyword matching</li>
                <li>Experience relevance scoring</li>
                <li>Skills highlighting based on job requirements</li>
                <li>ATS-friendly formatting</li>
              </ul>
            </div>
            <div className="feature-detail-visual">
              <div className="visual-box">
                <div className="ai-analysis-demo">
                  <div className="demo-header">AI Analysis</div>
                  <div className="analysis-item">
                    <span className="analysis-label">Keyword Match</span>
                    <div className="analysis-bar">
                      <div className="analysis-fill" style={{width: '92%'}}>92%</div>
                    </div>
                  </div>
                  <div className="analysis-item">
                    <span className="analysis-label">Experience Relevance</span>
                    <div className="analysis-bar">
                      <div className="analysis-fill" style={{width: '88%'}}>88%</div>
                    </div>
                  </div>
                  <div className="analysis-item">
                    <span className="analysis-label">Skills Match</span>
                    <div className="analysis-bar">
                      <div className="analysis-fill" style={{width: '95%'}}>95%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-detail reverse">
            <div className="feature-detail-content">
              <div className="feature-detail-icon">📝</div>
              <h2>Master Profile Management</h2>
              <p>
                Create one comprehensive master profile containing all your work
                history, skills, achievements, and education. Generate unlimited
                tailored CVs without ever starting from scratch.
              </p>
              <ul className="feature-benefits">
                <li>Centralized profile storage</li>
                <li>Import from LinkedIn</li>
                <li>Manual entry with AI suggestions</li>
                <li>Version control and history</li>
              </ul>
            </div>
            <div className="feature-detail-visual">
              <div className="visual-box">
                <div className="profile-demo">
                  <div className="profile-section">
                    <div className="profile-icon">👤</div>
                    <div className="profile-text">Personal Info</div>
                  </div>
                  <div className="profile-section">
                    <div className="profile-icon">💼</div>
                    <div className="profile-text">Work Experience (8)</div>
                  </div>
                  <div className="profile-section">
                    <div className="profile-icon">🎓</div>
                    <div className="profile-text">Education (3)</div>
                  </div>
                  <div className="profile-section">
                    <div className="profile-icon">⚡</div>
                    <div className="profile-text">Skills (24)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-detail">
            <div className="feature-detail-content">
              <div className="feature-detail-icon">🎨</div>
              <h2>Professional Templates</h2>
              <p>
                Choose from a variety of professionally designed, ATS-friendly
                templates. Each template is carefully crafted to highlight your
                qualifications while maintaining readability for both humans and
                automated systems.
              </p>
              <ul className="feature-benefits">
                <li>Multiple modern designs</li>
                <li>ATS-compatible formatting</li>
                <li>Customizable layouts</li>
                <li>Industry-specific templates</li>
              </ul>
            </div>
            <div className="feature-detail-visual">
              <div className="visual-box">
                <div className="templates-grid">
                  <div className="template-thumb">Modern</div>
                  <div className="template-thumb">Classic</div>
                  <div className="template-thumb">Creative</div>
                  <div className="template-thumb">Executive</div>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-detail reverse">
            <div className="feature-detail-content">
              <div className="feature-detail-icon">📊</div>
              <h2>Application Tracking System</h2>
              <p>
                Keep track of all your job applications in one organized dashboard.
                Monitor application statuses, schedule follow-ups, and track
                interview dates to stay on top of your job search.
              </p>
              <ul className="feature-benefits">
                <li>Application status tracking</li>
                <li>Interview scheduling</li>
                <li>Follow-up reminders</li>
                <li>Analytics and insights</li>
              </ul>
            </div>
            <div className="feature-detail-visual">
              <div className="visual-box">
                <div className="tracker-demo">
                  <div className="tracker-item applied">
                    <span className="tracker-status">Applied</span>
                    <span className="tracker-count">12</span>
                  </div>
                  <div className="tracker-item interview">
                    <span className="tracker-status">Interview</span>
                    <span className="tracker-count">5</span>
                  </div>
                  <div className="tracker-item offer">
                    <span className="tracker-status">Offer</span>
                    <span className="tracker-count">2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="additional-features">
        <div className="section-container">
          <h2>More Features to Boost Your Job Search</h2>
          <div className="features-grid-small">
            <div className="feature-small">
              <div className="feature-small-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Generate a complete CV in under 5 minutes</p>
            </div>
            <div className="feature-small">
              <div className="feature-small-icon">🔒</div>
              <h3>Secure & Private</h3>
              <p>Bank-level encryption for your data</p>
            </div>
            <div className="feature-small">
              <div className="feature-small-icon">📱</div>
              <h3>Mobile Friendly</h3>
              <p>Access and edit from any device</p>
            </div>
            <div className="feature-small">
              <div className="feature-small-icon">💾</div>
              <h3>Version Control</h3>
              <p>Track changes and restore previous versions</p>
            </div>
            <div className="feature-small">
              <div className="feature-small-icon">🌐</div>
              <h3>Multi-Language</h3>
              <p>Create CVs in multiple languages</p>
            </div>
            <div className="feature-small">
              <div className="feature-small-icon">📥</div>
              <h3>Export Options</h3>
              <p>Download as PDF, Word, or plain text</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="features-cta">
        <div className="cta-box">
          <h2>Ready to Experience These Features?</h2>
          <p>Start creating professional, tailored CVs today</p>
          <Link to="/register" className="btn btn-large btn-primary">
            Get Started Free
            <span className="btn-arrow">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default FeaturesPage;
