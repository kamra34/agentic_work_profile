import { Link } from 'react-router-dom';
import './HowItWorksPage.css';

function HowItWorksPage() {
  return (
    <div className="how-it-works-page">
      {/* Header */}
      <section className="page-hero">
        <div className="page-hero-container">
          <h1>How It Works</h1>
          <p>
            From your master profile to a perfect, tailored CV in just three simple
            steps. No design skills or CV writing expertise required.
          </p>
        </div>
      </section>

      {/* Main Steps */}
      <section className="detailed-steps">
        <div className="section-container">
          <div className="detailed-step">
            <div className="step-visual">
              <div className="step-number-large">1</div>
              <div className="visual-content">
                <div className="import-demo">
                  <div className="import-option">
                    <div className="import-icon linkedin">in</div>
                    <div className="import-text">
                      <strong>Import from LinkedIn</strong>
                      <p>Automatically extract your profile</p>
                    </div>
                  </div>
                  <div className="import-divider">OR</div>
                  <div className="import-option">
                    <div className="import-icon manual">✏️</div>
                    <div className="import-text">
                      <strong>Enter Manually</strong>
                      <p>Fill in your information step-by-step</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="step-content">
              <h2>Create Your Master Profile</h2>
              <p className="step-description">
                Start by building a comprehensive master profile that contains all your
                professional information. This is a one-time setup that becomes the
                foundation for all your future CVs.
              </p>

              <div className="step-features">
                <h3>What to Include:</h3>
                <ul>
                  <li>
                    <strong>Work Experience:</strong> All your job positions, including
                    responsibilities, achievements, and dates
                  </li>
                  <li>
                    <strong>Skills:</strong> Technical skills, soft skills, languages,
                    and tools you're proficient in
                  </li>
                  <li>
                    <strong>Education:</strong> Your degrees, certifications, and
                    relevant coursework
                  </li>
                  <li>
                    <strong>Projects:</strong> Side projects, open source contributions,
                    or significant achievements
                  </li>
                  <li>
                    <strong>Contact Info:</strong> Your name, email, phone, location,
                    and professional links
                  </li>
                </ul>
              </div>

              <div className="step-tip">
                <strong>💡 Pro Tip:</strong> Include everything! The more comprehensive
                your master profile, the better the AI can tailor CVs for different
                positions.
              </div>
            </div>
          </div>

          <div className="detailed-step reverse">
            <div className="step-visual">
              <div className="step-number-large">2</div>
              <div className="visual-content">
                <div className="job-description-demo">
                  <div className="demo-header">
                    <span className="demo-title">Job Description</span>
                    <button className="demo-btn">Paste</button>
                  </div>
                  <div className="demo-content">
                    <div className="demo-line"></div>
                    <div className="demo-line short"></div>
                    <div className="demo-line"></div>
                    <div className="demo-line medium"></div>
                    <div className="demo-highlight">
                      <span className="highlight-badge">Keyword detected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="step-content">
              <h2>Paste the Job Description</h2>
              <p className="step-description">
                Copy and paste the job posting you're interested in. Our AI will
                analyze it to understand what the employer is looking for.
              </p>

              <div className="step-features">
                <h3>What the AI Analyzes:</h3>
                <ul>
                  <li>
                    <strong>Required Skills:</strong> Identifies must-have technical
                    and soft skills mentioned in the posting
                  </li>
                  <li>
                    <strong>Keywords:</strong> Extracts important keywords that ATS
                    systems will scan for
                  </li>
                  <li>
                    <strong>Experience Level:</strong> Understands the seniority and
                    years of experience needed
                  </li>
                  <li>
                    <strong>Responsibilities:</strong> Analyzes the job duties to
                    highlight relevant experiences
                  </li>
                  <li>
                    <strong>Company Culture:</strong> Detects hints about company
                    values and work environment
                  </li>
                </ul>
              </div>

              <div className="step-tip">
                <strong>💡 Pro Tip:</strong> Copy the entire job posting, not just the
                title. More context helps the AI create a better match.
              </div>
            </div>
          </div>

          <div className="detailed-step">
            <div className="step-visual">
              <div className="step-number-large">3</div>
              <div className="visual-content">
                <div className="generation-demo">
                  <div className="generation-progress">
                    <div className="progress-step done">
                      <div className="progress-icon">✓</div>
                      <span>Analyzing job requirements</span>
                    </div>
                    <div className="progress-step done">
                      <div className="progress-icon">✓</div>
                      <span>Matching experiences</span>
                    </div>
                    <div className="progress-step active">
                      <div className="progress-icon spinner">⚙️</div>
                      <span>Generating tailored CV</span>
                    </div>
                  </div>
                  <div className="generation-result">
                    <div className="result-icon">✨</div>
                    <div className="result-text">Your CV is ready!</div>
                    <button className="result-btn">Download PDF</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="step-content">
              <h2>Generate & Download</h2>
              <p className="step-description">
                Click generate and watch as our AI creates a perfectly tailored CV in
                seconds. Review, make any final adjustments, and download.
              </p>

              <div className="step-features">
                <h3>What Happens:</h3>
                <ul>
                  <li>
                    <strong>Smart Selection:</strong> AI chooses the most relevant
                    experiences from your master profile
                  </li>
                  <li>
                    <strong>Keyword Optimization:</strong> Integrates important keywords
                    naturally throughout your CV
                  </li>
                  <li>
                    <strong>Achievement Highlighting:</strong> Emphasizes accomplishments
                    that align with job requirements
                  </li>
                  <li>
                    <strong>ATS Formatting:</strong> Ensures your CV passes automated
                    screening systems
                  </li>
                  <li>
                    <strong>Professional Layout:</strong> Applies a clean, professional
                    template that's easy to read
                  </li>
                </ul>
              </div>

              <div className="step-tip">
                <strong>💡 Pro Tip:</strong> You can regenerate with different templates
                or make manual edits before downloading.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="workflow-features">
        <div className="section-container">
          <h2>Beyond the Basics</h2>
          <p className="section-subtitle">
            Additional features that make your job search even more efficient
          </p>

          <div className="workflow-grid">
            <div className="workflow-card">
              <div className="workflow-icon">📊</div>
              <h3>Track Applications</h3>
              <p>
                Keep track of where you've applied, save the tailored CV you used,
                and monitor follow-ups all in one dashboard.
              </p>
            </div>

            <div className="workflow-card">
              <div className="workflow-icon">🔄</div>
              <h3>Version History</h3>
              <p>
                Access all your previously generated CVs. Compare versions and
                reuse successful CVs for similar positions.
              </p>
            </div>

            <div className="workflow-card">
              <div className="workflow-icon">✏️</div>
              <h3>Manual Editing</h3>
              <p>
                Fine-tune AI-generated content with our built-in editor. Change
                wording, reorder sections, or add custom touches.
              </p>
            </div>

            <div className="workflow-card">
              <div className="workflow-icon">🎨</div>
              <h3>Multiple Templates</h3>
              <p>
                Switch between different professional templates instantly. Find the
                perfect style for each industry and position.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-container">
          <h2>Frequently Asked Questions</h2>

          <div className="faq-grid">
            <div className="faq-item">
              <h3>How long does it take to generate a CV?</h3>
              <p>
                Once your master profile is set up, generating a tailored CV takes
                less than 5 minutes. The AI analysis and generation happens in seconds.
              </p>
            </div>

            <div className="faq-item">
              <h3>Can I edit the AI-generated CV?</h3>
              <p>
                Absolutely! You have full control to edit any part of the generated CV.
                Use our built-in editor to make adjustments before downloading.
              </p>
            </div>

            <div className="faq-item">
              <h3>Is my data secure?</h3>
              <p>
                Yes! All your data is encrypted and stored securely. We never share
                your information with third parties, and you can delete your data
                anytime.
              </p>
            </div>

            <div className="faq-item">
              <h3>How many CVs can I generate?</h3>
              <p>
                You can generate unlimited CVs from your master profile. Create a
                unique, tailored version for every job application.
              </p>
            </div>

            <div className="faq-item">
              <h3>Will my CV pass ATS systems?</h3>
              <p>
                Our templates are specifically designed to be ATS-friendly. The AI
                also optimizes keyword placement to maximize your pass rate.
              </p>
            </div>

            <div className="faq-item">
              <h3>Can I update my master profile?</h3>
              <p>
                Yes! Update your master profile anytime with new experiences, skills,
                or achievements. Changes will be available for all future CVs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="how-it-works-cta">
        <div className="cta-box">
          <h2>Ready to Get Started?</h2>
          <p>Create your master profile and generate your first tailored CV today</p>
          <Link to="/register" className="btn btn-large btn-primary">
            Start Free Now
            <span className="btn-arrow">→</span>
          </Link>
          <p className="cta-note">No credit card required • Setup takes 10 minutes</p>
        </div>
      </section>
    </div>
  );
}

export default HowItWorksPage;
