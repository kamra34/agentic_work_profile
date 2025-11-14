import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              AI-Powered CV Generation
            </div>
            <h1 className="hero-title">
              Create Perfect CVs
              <br />
              <span className="gradient-text">Tailored to Every Job</span>
            </h1>
            <p className="hero-subtitle">
              Stop spending hours crafting the perfect CV. Our AI-powered platform
              generates professional, tailored CVs in minutes based on your master
              profile and job descriptions.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-large btn-primary">
                Get Started Free
                <span className="btn-arrow">→</span>
              </Link>
              <Link to="/examples" className="btn btn-large btn-outline">
                See Examples
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">10,000+</div>
                <div className="stat-label">CVs Generated</div>
              </div>
              <div className="stat">
                <div className="stat-number">95%</div>
                <div className="stat-label">Success Rate</div>
              </div>
              <div className="stat">
                <div className="stat-number">5 min</div>
                <div className="stat-label">Average Time</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="cv-mockup">
              <div className="mockup-header">
                <div className="mockup-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="mockup-content">
                <div className="mockup-line wide"></div>
                <div className="mockup-line"></div>
                <div className="mockup-line medium"></div>
                <div className="mockup-section">
                  <div className="mockup-line short"></div>
                  <div className="mockup-line"></div>
                  <div className="mockup-line medium"></div>
                </div>
                <div className="mockup-section">
                  <div className="mockup-line short"></div>
                  <div className="mockup-line"></div>
                  <div className="mockup-line"></div>
                </div>
              </div>
              <div className="ai-badge">
                <span className="ai-icon">✨</span>
                AI-Generated
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="features-preview">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Why Choose Us</span>
            <h2>Everything You Need to Land Your Dream Job</h2>
            <p>Powerful features designed to help you stand out from the competition</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Tailoring</h3>
              <p>
                Our AI analyzes job descriptions and automatically highlights your
                most relevant skills and experiences.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Master Profile</h3>
              <p>
                Create one comprehensive profile. Generate unlimited tailored CVs
                without starting from scratch.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Professional Templates</h3>
              <p>
                Choose from multiple professionally designed templates that work
                with ATS systems.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>
                Generate a tailored CV in under 5 minutes. Spend less time
                formatting, more time applying.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Application Tracking</h3>
              <p>
                Keep track of all your applications, follow-ups, and interview
                schedules in one place.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Private</h3>
              <p>
                Your data is encrypted and secure. You maintain full control over
                your information.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Simple Process</span>
            <h2>From Profile to Perfect CV in 3 Steps</h2>
          </div>

          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Create Your Master Profile</h3>
                <p>
                  Import from LinkedIn or enter your information manually. Include
                  all your experiences, skills, and achievements.
                </p>
              </div>
            </div>

            <div className="step-connector"></div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Paste Job Description</h3>
                <p>
                  Copy the job posting you're interested in. Our AI will analyze
                  the requirements and keywords.
                </p>
              </div>
            </div>

            <div className="step-connector"></div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Generate & Download</h3>
                <p>
                  Get a perfectly tailored CV highlighting your most relevant
                  qualifications. Download as PDF instantly.
                </p>
              </div>
            </div>
          </div>

          <div className="cta-center">
            <Link to="/how-it-works" className="btn btn-secondary">
              Learn More About the Process
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="social-proof">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Testimonials</span>
            <h2>Loved by Job Seekers Worldwide</h2>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p className="testimonial-text">
                "This tool saved me countless hours. I was able to apply to 10+
                jobs in a day with perfectly tailored CVs. Got 3 interviews in the
                first week!"
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">SM</div>
                <div>
                  <div className="author-name">Sarah Martinez</div>
                  <div className="author-role">Software Engineer</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p className="testimonial-text">
                "The AI really understands what recruiters are looking for. My CV
                now highlights exactly what each company wants to see."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">JK</div>
                <div>
                  <div className="author-name">James Kim</div>
                  <div className="author-role">Product Manager</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p className="testimonial-text">
                "As someone who hates writing CVs, this is a game-changer. The
                templates are professional and the AI suggestions are spot-on."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">EP</div>
                <div>
                  <div className="author-name">Emma Patel</div>
                  <div className="author-role">Marketing Director</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="cta-container">
          <h2>Ready to Land Your Dream Job?</h2>
          <p>Join thousands of professionals who have transformed their job search</p>
          <Link to="/register" className="btn btn-large btn-white">
            Start Creating Your CV Now
            <span className="btn-arrow">→</span>
          </Link>
          <p className="cta-note">No credit card required • Free to start</p>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
