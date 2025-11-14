import { useState } from 'react';
import { Link } from 'react-router-dom';
import './ExamplesPage.css';

const sampleCVs = [
  {
    id: 1,
    role: 'Software Engineer',
    industry: 'Technology',
    template: 'Modern',
    matchScore: 95,
    description: 'Tailored for a Senior Software Engineer position at a tech startup',
    highlights: ['React', 'Node.js', 'AWS', 'Microservices'],
  },
  {
    id: 2,
    role: 'Product Manager',
    industry: 'SaaS',
    template: 'Executive',
    matchScore: 92,
    description: 'Optimized for a Product Manager role in a B2B SaaS company',
    highlights: ['Product Strategy', 'Agile', 'Analytics', 'Stakeholder Management'],
  },
  {
    id: 3,
    role: 'Marketing Director',
    industry: 'E-commerce',
    template: 'Creative',
    matchScore: 88,
    description: 'Customized for a Marketing Director position in e-commerce',
    highlights: ['Digital Marketing', 'SEO/SEM', 'Team Leadership', 'ROI Analytics'],
  },
  {
    id: 4,
    role: 'Data Scientist',
    industry: 'Finance',
    template: 'Classic',
    matchScore: 94,
    description: 'Designed for a Data Scientist role in financial services',
    highlights: ['Python', 'Machine Learning', 'SQL', 'Statistical Analysis'],
  },
  {
    id: 5,
    role: 'UX Designer',
    industry: 'Design',
    template: 'Modern',
    matchScore: 90,
    description: 'Tailored for a Senior UX Designer at a design agency',
    highlights: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
  },
  {
    id: 6,
    role: 'Sales Manager',
    industry: 'Enterprise',
    template: 'Executive',
    matchScore: 87,
    description: 'Crafted for an Enterprise Sales Manager position',
    highlights: ['B2B Sales', 'Pipeline Management', 'CRM', 'Negotiation'],
  },
];

function ExamplesPage() {
  const [selectedCV, setSelectedCV] = useState(null);

  return (
    <div className="examples-page">
      {/* Header */}
      <section className="page-hero">
        <div className="page-hero-container">
          <h1>Real CV Examples</h1>
          <p>
            See how our AI transforms generic profiles into targeted, professional
            CVs that get results. Each example is tailored to specific job roles.
          </p>
        </div>
      </section>

      {/* Examples Grid */}
      <section className="examples-section">
        <div className="section-container">
          <div className="examples-grid">
            {sampleCVs.map((cv) => (
              <div
                key={cv.id}
                className="example-card"
                onClick={() => setSelectedCV(cv)}
              >
                <div className="example-header">
                  <div className="example-template-badge">{cv.template}</div>
                  <div className="example-score">
                    <span className="score-number">{cv.matchScore}%</span>
                    <span className="score-label">Match</span>
                  </div>
                </div>

                <div className="example-preview">
                  <div className="preview-lines">
                    <div className="preview-line title"></div>
                    <div className="preview-line"></div>
                    <div className="preview-line short"></div>
                    <div className="preview-divider"></div>
                    <div className="preview-line medium"></div>
                    <div className="preview-line"></div>
                    <div className="preview-line medium"></div>
                  </div>
                </div>

                <div className="example-info">
                  <h3>{cv.role}</h3>
                  <p className="example-industry">{cv.industry}</p>
                  <p className="example-description">{cv.description}</p>

                  <div className="example-highlights">
                    {cv.highlights.map((highlight, index) => (
                      <span key={index} className="highlight-tag">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>

                <button className="example-view-btn">
                  View Full Example
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="before-after">
        <div className="section-container">
          <h2>The Power of AI Tailoring</h2>
          <p className="section-subtitle">
            See the difference between a generic CV and one optimized by our AI
          </p>

          <div className="comparison-container">
            <div className="comparison-side">
              <div className="comparison-label before">Before</div>
              <div className="comparison-card">
                <h3>Generic CV</h3>
                <ul className="comparison-list">
                  <li className="negative">Generic bullet points</li>
                  <li className="negative">No keyword optimization</li>
                  <li className="negative">Same for all applications</li>
                  <li className="negative">May not pass ATS</li>
                  <li className="negative">Lower interview rate</li>
                </ul>
              </div>
            </div>

            <div className="comparison-arrow">→</div>

            <div className="comparison-side">
              <div className="comparison-label after">After</div>
              <div className="comparison-card">
                <h3>AI-Tailored CV</h3>
                <ul className="comparison-list">
                  <li className="positive">Job-specific achievements</li>
                  <li className="positive">Optimized for ATS systems</li>
                  <li className="positive">Tailored to each role</li>
                  <li className="positive">95%+ ATS pass rate</li>
                  <li className="positive">3x more interviews</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="examples-stats">
        <div className="section-container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-value">3x</div>
              <div className="stat-label">More Interview Callbacks</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-value">5 min</div>
              <div className="stat-label">Average Generation Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✓</div>
              <div className="stat-value">95%</div>
              <div className="stat-label">ATS Pass Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-value">10k+</div>
              <div className="stat-label">CVs Generated</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="examples-cta">
        <div className="cta-box">
          <h2>Ready to Create Your Perfect CV?</h2>
          <p>Join thousands of job seekers getting more interviews</p>
          <Link to="/register" className="btn btn-large btn-primary">
            Get Started Free
            <span className="btn-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* Modal for CV Preview */}
      {selectedCV && (
        <div className="modal-overlay" onClick={() => setSelectedCV(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCV(null)}>
              ×
            </button>
            <div className="modal-header">
              <h2>{selectedCV.role}</h2>
              <div className="modal-badges">
                <span className="badge">{selectedCV.template} Template</span>
                <span className="badge score">{selectedCV.matchScore}% Match</span>
              </div>
            </div>
            <div className="modal-body">
              <div className="cv-preview-full">
                <div className="cv-header-section">
                  <div className="cv-name">John Doe</div>
                  <div className="cv-contact">john.doe@email.com | +1 234 567 890</div>
                </div>

                <div className="cv-section">
                  <div className="cv-section-title">Professional Summary</div>
                  <p>
                    Results-driven {selectedCV.role} with 8+ years of experience in
                    {' '}{selectedCV.industry}. Proven track record of delivering
                    high-impact projects and driving business growth.
                  </p>
                </div>

                <div className="cv-section">
                  <div className="cv-section-title">Key Skills</div>
                  <div className="cv-skills">
                    {selectedCV.highlights.map((skill, index) => (
                      <span key={index} className="cv-skill">{skill}</span>
                    ))}
                  </div>
                </div>

                <div className="cv-section">
                  <div className="cv-section-title">Experience</div>
                  <div className="cv-job">
                    <div className="cv-job-header">
                      <div className="cv-job-title">Senior {selectedCV.role}</div>
                      <div className="cv-job-date">2020 - Present</div>
                    </div>
                    <div className="cv-company">Tech Company Inc.</div>
                    <ul className="cv-achievements">
                      <li>Led team of 5 engineers to deliver critical product features</li>
                      <li>Improved system performance by 40% through optimization</li>
                      <li>Implemented best practices that reduced bugs by 60%</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="modal-note">
                This is a sample CV generated by our AI. Your actual CV will be
                tailored to your specific experience and the job you're applying for.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExamplesPage;
