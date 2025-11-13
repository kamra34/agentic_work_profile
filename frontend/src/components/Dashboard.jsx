import { useState, useEffect } from 'react';
import MasterProfile from './MasterProfile';
import TailorCV from './TailorCV';
import SavedCVsWrapper from './SavedCVsWrapper';
import ApplicationTracker from './ApplicationTracker';
import GlobalAIStatusBar from './GlobalAIStatusBar';
import ProfilePage from './ProfilePage';
import { useAIAnalysis } from '../context/AIAnalysisContext';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
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
            <button
              className={`sidebar-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span className="icon">🏠</span>
              <span className="label">Dashboard</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">📋 Profile Management</div>
            <button
              className={`sidebar-item ${activeTab === 'user-profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-profile')}
              title="View and edit your personal profile"
            >
              <span className="icon">👤</span>
              <span className="label">My Profile</span>
              <span className="badge badge-new">New</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''} ${isAnalyzing ? 'disabled' : ''}`}
              onClick={() => {
                if (isAnalyzing) {
                  alert('⚠️ Cannot edit Profile Pool while AI analysis is running.\n\nPlease wait for the analysis to complete or navigate to Tailor CV to cancel it.');
                  return;
                }
                setActiveTab('profile');
              }}
              disabled={isAnalyzing}
              title={isAnalyzing ? 'Blocked during AI analysis' : 'Your complete pool of experiences, skills, and achievements'}
            >
              <span className="icon">📝</span>
              <span className="label">Profile Pool</span>
              {isAnalyzing ? (
                <span className="badge badge-locked">🔒 Locked</span>
              ) : (
                <span className="badge">Essential</span>
              )}
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">🎯 CV Creation</div>
            <button
              className={`sidebar-item ${activeTab === 'tailor' ? 'active' : ''}`}
              onClick={() => setActiveTab('tailor')}
            >
              <span className="icon">✨</span>
              <span className="label">Tailor CV</span>
              <span className="badge badge-ai">AI</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              <span className="icon">💼</span>
              <span className="label">CV Portfolio</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">📊 Applications</div>
            <button
              className={`sidebar-item ${activeTab === 'applications' ? 'active' : ''}`}
              onClick={() => setActiveTab('applications')}
            >
              <span className="icon">📈</span>
              <span className="label">Application Tracker</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activeTab === 'home' && <HomeView onNavigate={setActiveTab} />}
          {activeTab === 'user-profile' && <ProfilePage />}
          {activeTab === 'profile' && <MasterProfile />}
          <div style={{ display: activeTab === 'tailor' ? 'block' : 'none' }}>
            <TailorCV />
          </div>
          {activeTab === 'review' && <SavedCVsWrapper />}
          {activeTab === 'applications' && <ApplicationTracker />}
        </main>
      </div>
    </div>
  );
}

// Home View Component - Modern Dashboard Design
function HomeView({ onNavigate }) {
  return (
    <div className="home-view">
      <div className="welcome-section">
        <h1 className="welcome-title">Welcome to Your Agentic CV Builder</h1>
        <p className="welcome-subtitle">
          An intelligent AI-powered platform that transforms how you create CVs. Build your complete professional profile once with unlimited hierarchical structure, then let dual-AI models (GPT-4o + Claude Sonnet 4.5) analyze jobs and intelligently select the best-matching content for each application - no AI-generated content, just smart selection from YOUR experiences.
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
              <button className="step-btn" onClick={() => onNavigate('user-profile')}>
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
              <button className="step-btn" onClick={() => onNavigate('profile')}>
                Build Profile Pool →
              </button>
            </div>
          </div>

          <div className="step-card step-3">
            <div className="step-number">3</div>
            <div className="step-icon">✨</div>
            <div className="step-content">
              <h3>Tailor CV</h3>
              <p>Paste a job description and watch dual-AI magic: GPT-4o and Claude analyze requirements, calculate your Profile Fit score and ATS compatibility, provide expert recruiter verdict on whether to apply, and intelligently SELECT (never generate) the best items from your Profile Pool optimized for this specific role. AI works in the background so you can continue and return when ready.</p>
              <button className="step-btn" onClick={() => onNavigate('tailor')}>
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
              <button className="step-btn" onClick={() => onNavigate('review')}>
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
              <button className="step-btn" onClick={() => onNavigate('applications')}>
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
            <p>Get unbiased recommendations from both OpenAI GPT-4o and Claude Sonnet 4.5. Items selected by both models = strongest matches.</p>
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

// Tailor CV View Component
function TailorCVView() {
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzingFit, setAnalyzingFit] = useState(false);
  const [fitAnalysis, setFitAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [progressStep, setProgressStep] = useState('');
  const [progressDetails, setProgressDetails] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [tailoringRecs, setTailoringRecs] = useState(null);
  const [savingTailoredCV, setSavingTailoredCV] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Expandable sections state
  const [jobReqExpanded, setJobReqExpanded] = useState(false);
  const [fitExpandedOpenAI, setFitExpandedOpenAI] = useState(false);
  const [fitExpandedClaude, setFitExpandedClaude] = useState(false);
  const [atsExpandedOpenAI, setAtsExpandedOpenAI] = useState(false);
  const [atsExpandedClaude, setAtsExpandedClaude] = useState(false);

  // Data viewer expandable states
  const [fitDataExpanded, setFitDataExpanded] = useState(false);
  const [atsDataExpanded, setAtsDataExpanded] = useState(false);
  const [tailorDataExpanded, setTailorDataExpanded] = useState(false);

  // Timing states
  const [jobAnalysisTime, setJobAnalysisTime] = useState(null);
  const [fitAnalysisTime, setFitAnalysisTime] = useState(null);
  const [atsAnalysisTime, setAtsAnalysisTime] = useState(null);

  // Backend version
  const [backendVersion, setBackendVersion] = useState('loading...');

  // Fetch backend version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch(`${API_URL}/api/version`);
        if (response.ok) {
          const data = await response.json();
          setBackendVersion(data.version);
        }
      } catch (error) {
        setBackendVersion('error');
      }
    };
    fetchVersion();
  }, []);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description to analyze');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setFitAnalysis(null);
    setProgressStep('starting');
    setProgressDetails('Initializing analysis...');
    setJobAnalysisTime(null);
    setFitAnalysisTime(null);
    setAtsAnalysisTime(null);

    try {
      const token = localStorage.getItem('token');

      // Step 1: Analyze job description with OpenAI
      setProgressStep('job-analysis');
      setProgressDetails('Step 1/3: Analyzing job requirements with OpenAI GPT-4o and Claude Sonnet 4.5...');
      const jobStartTime = Date.now();

      const jobResponse = await fetch(`${API_URL}/api/job/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ job_description: jobDescription })
      });

      if (!jobResponse.ok) {
        throw new Error('Failed to analyze job description');
      }

      const jobData = await jobResponse.json();
      const jobEndTime = Date.now();
      const jobTime = ((jobEndTime - jobStartTime) / 1000).toFixed(2);
      setJobAnalysisTime(jobTime);
      setAnalysis(jobData);

      // Wait briefly to show Job Analysis completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Analyze profile fit based on job analysis
      setAnalyzingFit(true);
      setProgressStep('fit-analysis');
      setProgressDetails('Step 2/3: Analyzing your profile fit with dual AI models (this may take 10-20 seconds)...');
      const fitStartTime = Date.now();

      // Get the actual analysis object from the first successful provider
      const firstAnalysis = jobData.analyses.find(a => a.analysis && !a.error);
      if (firstAnalysis) {
        const fitResponse = await fetch(`${API_URL}/api/job/analyze-fit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ job_analysis: firstAnalysis.analysis })
        });

        if (fitResponse.ok) {
          const fitData = await fitResponse.json();

          // DEBUG: Log the response structure
          console.log('[DEBUG] Fit Analysis Response Keys:', Object.keys(fitData));
          console.log('[DEBUG] Full fitData structure:', JSON.stringify(fitData, null, 2));
          console.log('[DEBUG] Has analyses?', 'analyses' in fitData);
          if (fitData.analyses) {
            console.log('[DEBUG] Analyses:', fitData.analyses);
          }

          const fitEndTime = Date.now();
          const fitTime = ((fitEndTime - fitStartTime) / 1000).toFixed(2);

          // Set fit analysis data and timing IMMEDIATELY
          setFitAnalysisTime(fitTime);
          setFitAnalysis(fitData);
          setProgressStep('fit-complete');
          setProgressDetails('Step 2/3: Profile fit analysis complete!');

          // Wait to show Profile Fit completion before starting ATS
          await new Promise(resolve => setTimeout(resolve, 800));

          // Step 3: Show ATS analysis (data already included in fit analysis, but show progression)
          setProgressStep('ats-analysis');
          setProgressDetails('Step 3/3: Analyzing ATS compatibility...');
          const atsStartTime = Date.now();

          // Simulate ATS processing time for better UX (minimum 1.5 seconds)
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Calculate ATS timing separately
          const atsEndTime = Date.now();
          const atsTime = ((atsEndTime - atsStartTime) / 1000).toFixed(2);
          setAtsAnalysisTime(atsTime);
          setProgressStep('ats-complete');
          setProgressDetails('All analysis complete!');
        } else {
          const errorData = await fitResponse.json();
          throw new Error(errorData.detail || 'Failed to analyze profile fit');
        }
      }

      setProgressStep('complete');
      setProgressDetails('All analysis complete!');
    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
      setProgressStep('error');
      setProgressDetails('');
    } finally {
      setAnalyzing(false);
      setAnalyzingFit(false);
      // Clear progress after a short delay
      setTimeout(() => {
        setProgressStep('');
        setProgressDetails('');
      }, 2000);
    }
  };

  const handleClear = () => {
    setJobDescription('');
    setAnalysis(null);
    setFitAnalysis(null);
    setError(null);
    setTailoringRecs(null);
    setJobAnalysisTime(null);
    setFitAnalysisTime(null);
    setAtsAnalysisTime(null);
  };

  const handleTailorCV = async () => {
    setTailoring(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');

      // Get the first successful job analysis
      const firstAnalysis = analysis.analyses.find(a => a.analysis && !a.error);
      if (!firstAnalysis) {
        throw new Error('No valid job analysis available');
      }

      const response = await fetch(`${API_URL}/api/cv/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          job_analysis: firstAnalysis.analysis
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get CV tailoring recommendations');
      }

      const data = await response.json();
      setTailoringRecs(data);

      // TODO: Open review UI modal/section
      console.log('Tailoring recommendations:', data);
    } catch (err) {
      setError(err.message || 'Failed to get CV tailoring recommendations');
    } finally {
      setTailoring(false);
    }
  };

  const handleSaveTailoredCV = async () => {
    if (!tailoringRecs || !tailoringRecs.enriched_recommendations) {
      alert('No tailoring recommendations to save');
      return;
    }

    // Prompt for job title and company name
    const jobTitle = prompt('Enter job title:', '');
    if (!jobTitle) return;

    const companyName = prompt('Enter company name (optional):', '');

    setSavingTailoredCV(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // Build selected_content from enriched_recommendations
      // Send enriched data directly with recommended_by metadata
      const enriched = tailoringRecs.enriched_recommendations;
      const selectedContent = {
        enriched_data: enriched  // Send the full enriched data with recommended_by fields
      };

      // Extract scores from fitAnalysis
      // Note: The API returns fit_analyses (not analyses) with fit_analysis (not analysis) inside
      const openai_fit_result = fitAnalysis?.fit_analyses?.find(a => a.provider === 'openai')?.fit_analysis;
      const claude_fit_result = fitAnalysis?.fit_analyses?.find(a => a.provider === 'anthropic')?.fit_analysis;

      const openai_fit_score = openai_fit_result?.fit_percentage;
      const claude_fit_score = claude_fit_result?.fit_percentage;
      const openai_ats_score = openai_fit_result?.ats_compatibility?.overall_ats_score;
      const claude_ats_score = claude_fit_result?.ats_compatibility?.overall_ats_score;

      // Debug logging
      console.log('[DEBUG] Saving CV with scores:', {
        openai_fit_score,
        claude_fit_score,
        openai_ats_score,
        claude_ats_score,
        fitAnalysis: fitAnalysis
      });

      // Warn if scores are missing
      if (!openai_fit_score && !claude_fit_score && !openai_ats_score && !claude_ats_score) {
        console.warn('[WARNING] No AI scores found. Did you run "Analyze with AI" first?');
      }

      const response = await fetch(`${API_URL}/api/cv/tailored-versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          job_title: jobTitle,
          company_name: companyName || null,
          job_description: jobDescription || null,
          selected_content: selectedContent,
          openai_fit_score,
          claude_fit_score,
          openai_ats_score,
          claude_ats_score,
          openai_recommendations: tailoringRecs.tailoring_recommendations?.find(r => r.provider === 'openai')?.recommendations,
          claude_recommendations: tailoringRecs.tailoring_recommendations?.find(r => r.provider === 'anthropic')?.recommendations,
          job_analysis: analysis?.analyses || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save tailored CV');
      }

      const data = await response.json();
      alert(`✅ Tailored CV saved successfully!\n\nJob: ${jobTitle}\nCompany: ${companyName || 'N/A'}\nVersion ID: ${data.id}`);
      console.log('Saved tailored CV:', data);
    } catch (err) {
      setError(err.message || 'Failed to save tailored CV');
      alert(`❌ Failed to save: ${err.message}`);
    } finally {
      setSavingTailoredCV(false);
    }
  };

  const loadMockData = () => {
    // Mock data for testing - Based on actual Head of Data & AI role
    const mockData = {
      job_analysis: {
        job_description: "Head of Data & AI - Establishing Data & AI Center of Excellence",
        analyses: [
          {
            provider: "openai",
            model: "gpt-4o",
            analysis: {
              job_category: "Leadership / Data & AI",
              job_level: "Senior/Executive",
              technical_skills: [
                "Data architecture",
                "Data lake/lakehouse platforms",
                "Microsoft Azure",
                "Databricks",
                "AI/ML models",
                "GenAI implementations",
                "Conversational AI",
                "Agent-based systems"
              ],
              soft_skills: [
                "Strategic leadership",
                "Execution bias",
                "Team development",
                "Curiosity",
                "Boldness",
                "Adaptability to change",
                "Collaboration",
                "Effective communication"
              ],
              education_requirements: "Relevant university degree, ideally at master's level, in data/IT/analytics",
              experience_requirements: "7-10+ years of leadership experience in data, analytics, or AI roles",
              preferred_qualifications: [
                "Experience with GenAI implementations",
                "Experience from regulated industries (preferably financial services)"
              ]
            }
          }
        ]
      },
      fit_analysis: {
        fit_analyses: [
          {
            provider: "openai",
            model: "gpt-4o",
            fit_analysis: {
              fit_percentage: 85,
              fit_summary: "The candidate is a strong match for the leadership role, possessing extensive experience in AI and data science leadership, as well as a relevant educational background. However, there are some gaps in specific technical skills and industry experience that could be critical.",
              strengths: [
                "PhD in a relevant field, exceeding the educational requirement",
                "Extensive leadership experience in AI and data science",
                "Strong strategic leadership and team development skills",
                "Experience with GenAI implementations"
              ],
              critical_gaps: [
                "Lack of explicit experience with Microsoft Azure and Databricks",
                "No direct experience mentioned in regulated industries, particularly financial services"
              ],
              experience_match: "The candidate has over 10 years of relevant leadership experience, which aligns well with the senior-level requirement.",
              technical_skills_match: 75,
              ats_compatibility: {
                keyword_match: 78,
                skills_coverage: 72,
                has_metrics: true,
                action_verbs_score: 85,
                overall_ats_score: 78,
                ats_notes: "Strong keyword presence for AI/ML and leadership. Excellent use of action verbs and quantifiable achievements. Missing specific Azure/Databricks keywords."
              },
              recommendation: {
                should_apply: true,
                reasoning: "The candidate should apply as they meet most of the key requirements and have a strong leadership background in AI. Addressing the gaps in specific technical platforms and industry experience could strengthen their application."
              }
            }
          },
          {
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            fit_analysis: {
              fit_percentage: 72,
              fit_summary: "Strong technical match with solid AI/ML leadership experience, but lacks specific data architecture expertise and formal team management scale required for establishing a Data & AI CoE. The candidate has relevant technical skills and some leadership experience but falls short on enterprise data platform architecture and large-scale organizational leadership.",
              strengths: [
                "PhD in relevant field (Electrical Engineering/Automatic Control) meets education requirements",
                "5+ years of AI/ML leadership experience with hands-on technical contributions",
                "Strong GenAI and AI Agent implementation experience (AWS Bedrock, SageMaker)",
                "Proven track record in cross-functional team leadership and stakeholder management",
                "Experience with cloud platforms (AWS) and some Azure integration",
                "Strong execution bias with demonstrated program delivery success",
                "People development experience through mentoring and thesis supervision",
                "Award recognition for AI contributions shows impact delivery"
              ],
              critical_gaps: [
                "No explicit experience with data lake/lakehouse platforms or data architecture design",
                "Limited Microsoft Azure expertise (job specifically mentions Azure focus)",
                "No Databricks experience mentioned despite being a key requirement",
                "Lacks experience establishing and leading a Center of Excellence from scratch",
                "No clear evidence of managing large teams (7-10+ years leadership requirement unclear)",
                "Missing data governance and compliance experience",
                "No regulated industry experience (financial services preferred)",
                "Limited evidence of enterprise-scale data platform building"
              ],
              experience_match: "Moderate - Has 5+ years of AI/ML leadership but unclear if meets the 7-10+ years requirement for senior leadership roles. Experience is more focused on project delivery than organizational/platform leadership.",
              technical_skills_match: 60,
              ats_compatibility: {
                keyword_match: 68,
                skills_coverage: 58,
                has_metrics: true,
                action_verbs_score: 82,
                overall_ats_score: 70,
                ats_notes: "Good metrics and action verbs. Missing critical keywords: Azure, Databricks, data lake, lakehouse, financial services, data governance."
              },
              recommendation: {
                should_apply: false,
                reasoning: "While strong on AI/ML delivery, significant gaps in data architecture, Azure/Databricks, and enterprise data platform leadership make this a challenging fit."
              }
            }
          }
        ]
      }
    };

    setAnalysis(mockData.job_analysis);
    setFitAnalysis(mockData.fit_analysis);
    setTestMode(true);
    setJobDescription("Head of Data & AI - Establishing Data & AI Center of Excellence\n\nTechnical Skills: Data architecture, Data lake/lakehouse platforms, Microsoft Azure, Databricks, AI/ML models, GenAI implementations, Conversational AI, Agent-based systems\n\nExperience: 7-10+ years of leadership experience in data, analytics, or AI roles\n\n[Mock data loaded for testing - Click 'Tailor My CV' to get real recommendations from your profile]");
  };

  return (
    <div className="tailor-cv-view">
      <div className="tailor-header">
        <h1>✨ Tailor CV</h1>
        <p className="tailor-subtitle">
          Paste any job description below. Our dual-AI system (OpenAI GPT-4o + Claude Sonnet 4.5) will analyze requirements, evaluate your profile fit, calculate ATS scores, and intelligently select the best content from your master profile for this specific role. Then save your tailored CV to review and finalize later.
        </p>
      </div>

      <div className="tailor-content">
        <div className="job-input-section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
            <label className="input-label">
              Job Description
              <span className="input-hint">Paste the complete job posting including requirements, responsibilities, and qualifications</span>
            </label>
            <div style={{fontSize: '0.75rem', color: '#666', background: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
              Backend: v{backendVersion}
            </div>
          </div>
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
            <button
              className="btn-test-mode"
              onClick={loadMockData}
              disabled={analyzing}
            >
              🧪 Load Test Data
            </button>
            {(jobDescription || analysis) && (
              <button className="btn-clear" onClick={handleClear}>
                Clear
              </button>
            )}
          </div>
          {testMode && (
            <div className="test-mode-banner">
              ⚠️ Test Mode Active - Using mock data for development
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Progress Indicator */}
        {progressStep && progressStep !== 'complete' && progressStep !== 'error' && (
          <div className="progress-indicator">
            <div className="progress-steps">
              {/* Step 1: Job Analysis */}
              <div className={`progress-step ${progressStep === 'starting' || progressStep === 'job-analysis' ? 'active' : (progressStep === 'job-complete' || progressStep === 'fit-analysis' || progressStep === 'fit-complete' || progressStep === 'ats-analysis') ? 'completed' : ''}`}>
                <div className="step-icon">
                  {progressStep === 'job-analysis' || progressStep === 'starting' ? (
                    <span className="spinner-small"></span>
                  ) : (
                    <span className="check-icon">✓</span>
                  )}
                </div>
                <div className="step-label">Job Analysis</div>
              </div>

              <div className="progress-line"></div>

              {/* Step 2: Profile Fit */}
              <div className={`progress-step ${(progressStep === 'job-complete' || progressStep === 'fit-analysis') ? 'active' : (progressStep === 'fit-complete' || progressStep === 'ats-analysis') ? 'completed' : ''}`}>
                <div className="step-icon">
                  {(progressStep === 'job-complete' || progressStep === 'fit-analysis') ? (
                    <span className="spinner-small"></span>
                  ) : (progressStep === 'fit-complete' || progressStep === 'ats-analysis') ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="pending-icon">⏳</span>
                  )}
                </div>
                <div className="step-label">Profile Fit</div>
              </div>

              <div className="progress-line"></div>

              {/* Step 3: ATS Score */}
              <div className={`progress-step ${progressStep === 'ats-analysis' ? 'active' : progressStep === 'ats-complete' ? 'completed' : ''}`}>
                <div className="step-icon">
                  {progressStep === 'ats-analysis' ? (
                    <span className="spinner-small"></span>
                  ) : progressStep === 'ats-complete' ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="pending-icon">⏳</span>
                  )}
                </div>
                <div className="step-label">ATS Score</div>
              </div>
            </div>

            <div className="progress-message">
              {progressDetails}
            </div>
          </div>
        )}

        {/* Job Requirements Section - FIRST (Expandable, Default Collapsed) */}
        {analysis && (
          <div className="analysis-results">
            <div className="expandable-section-header" onClick={() => setJobReqExpanded(!jobReqExpanded)}>
              <h2 className="results-title">
                <span className="expand-arrow">{jobReqExpanded ? '▼' : '▶'}</span>
                Job Requirements Analysis
                {jobAnalysisTime && <span className="timing-badge">⏱️ {jobAnalysisTime}s</span>}
              </h2>
              <p className="results-subtitle">
                Powered by OpenAI GPT-4o and Anthropic Claude Sonnet 4.5
              </p>
            </div>

            {jobReqExpanded && (
              <div className="side-by-side-comparison">
                {analysis.analyses && analysis.analyses.map((result, idx) => (
                  <div key={idx} className="analysis-column">
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
                        {renderAnalysisSectionCompact('Job Category & Level',
                          `${result.analysis.job_category || result.analysis['Job Category'] || 'N/A'} - ${result.analysis.job_level || result.analysis['Job Level'] || 'N/A'}`
                        )}
                        {renderAnalysisSectionCompact('Technical Skills', result.analysis.technical_skills || result.analysis['Technical Skills'])}
                        {renderAnalysisSectionCompact('Soft Skills', result.analysis.soft_skills || result.analysis['Soft Skills'])}
                        {renderAnalysisSectionCompact('Education', result.analysis.education_requirements || result.analysis['Education Requirements'])}
                        {renderAnalysisSectionCompact('Experience', result.analysis.experience_requirements || result.analysis['Experience Requirements'])}
                        {renderAnalysisSectionCompact('Preferred', result.analysis.preferred_qualifications || result.analysis['Preferred Qualifications'])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Fit Analysis Section - SECOND (Scores always visible, details expandable per column) */}
        {fitAnalysis && (
          <div className="fit-analysis-container">
            <h2 className="fit-title">
              Profile Fit Analysis
              {fitAnalysisTime && <span className="timing-badge">⏱️ {fitAnalysisTime}s</span>}
            </h2>
            <p className="fit-subtitle">Unbiased assessment by dual AI models</p>

            <div className="fit-comparison">
              {fitAnalysis.fit_analyses && fitAnalysis.fit_analyses.map((result, idx) => {
                const isOpenAI = result.provider === 'openai';
                const isExpanded = isOpenAI ? fitExpandedOpenAI : fitExpandedClaude;
                const toggleExpanded = () => isOpenAI ? setFitExpandedOpenAI(!fitExpandedOpenAI) : setFitExpandedClaude(!fitExpandedClaude);

                return (
                  <div key={idx} className="fit-card">
                    <div className="fit-card-header">
                      <h3 className="fit-provider">
                        {isOpenAI ? '🟢 OpenAI' : '🔵 Claude'}
                      </h3>
                    </div>

                    {result.error ? (
                      <div className="provider-error">Error: {result.error}</div>
                    ) : result.fit_analysis && (
                      <div className="fit-content">
                        {/* ALWAYS VISIBLE: Fit percentage and verdict */}
                        <div className={`fit-percentage-box ${getFitColorClass(result.fit_analysis.fit_percentage)}`}>
                          <div className="fit-percentage">{result.fit_analysis.fit_percentage}%</div>
                          <div className="fit-label">Match</div>
                        </div>

                        <div className="fit-recommendation">
                          <strong>Verdict:</strong> {result.fit_analysis.recommendation?.should_apply ? '✅ Apply' : '❌ Do Not Apply'}
                        </div>

                        {/* EXPANDABLE TOGGLE */}
                        <button
                          className="expand-toggle-btn"
                          onClick={toggleExpanded}
                        >
                          <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
                          {isExpanded ? 'Hide Details' : 'Show Details'}
                        </button>

                        {/* EXPANDABLE CONTENT */}
                        {isExpanded && (
                          <div className="fit-expandable-content">
                            <div className="fit-summary-text">{result.fit_analysis.fit_summary}</div>

                            <div className="recommendation-reasoning">
                              <strong>Reasoning:</strong> {result.fit_analysis.recommendation?.reasoning}
                            </div>

                            {result.fit_analysis.strengths && result.fit_analysis.strengths.length > 0 && (
                              <div className="fit-strengths">
                                <h4>✅ Strengths</h4>
                                <ul>
                                  {result.fit_analysis.strengths.map((strength, i) => (
                                    <li key={i}>{strength}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {result.fit_analysis.critical_gaps && result.fit_analysis.critical_gaps.length > 0 && (
                              <div className="fit-gaps">
                                <h4>⚠️ Critical Gaps</h4>
                                <ul>
                                  {result.fit_analysis.critical_gaps.map((gap, i) => (
                                    <li key={i}>{gap}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="fit-details">
                              <div className="fit-detail-item">
                                <strong>Experience Match:</strong> {result.fit_analysis.experience_match}
                              </div>
                              <div className="fit-detail-item">
                                <strong>Technical Skills Match:</strong> {result.fit_analysis.technical_skills_match}%
                              </div>
                            </div>

                            {/* Data Viewer - View Input Data Sent to AI */}
                            <div className="data-viewer-section" style={{marginTop: '1.5rem'}}>
                              <button
                                className="data-viewer-toggle"
                                onClick={() => setFitDataExpanded(!fitDataExpanded)}
                              >
                                <span className="expand-arrow">{fitDataExpanded ? '▼' : '▶'}</span>
                                🔍 View Data Sent to AI Models for Profile Fit
                              </button>
                              {fitDataExpanded && (
                                <div className="data-viewer-content">
                                  {fitAnalysis.input_data ? (
                                    <>
                                      <div className="data-viewer-warning">
                                        ⚠️ This is the exact data that was sent to {isOpenAI ? 'OpenAI' : 'Claude'} for Profile Fit Analysis
                                      </div>
                                      <div className="data-viewer-sections">
                                        <div className="data-viewer-block">
                                          <h4>Job Analysis Data</h4>
                                          <pre>{JSON.stringify(fitAnalysis.input_data.job_analysis, null, 2)}</pre>
                                        </div>
                                        <div className="data-viewer-block">
                                          <h4>Your Profile Data</h4>
                                          <pre>{fitAnalysis.input_data.formatted_profile || 'No profile data available'}</pre>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="data-viewer-warning" style={{background: '#fff3cd', borderColor: '#ffc107'}}>
                                      ⚠️ Input data not available. This analysis was run before the data viewer feature was added.
                                      <br/><strong>Please run a fresh analysis to see the input data.</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ATS Compatibility Section - THIRD (Scores always visible, details expandable per column) */}
        {fitAnalysis && fitAnalysis.fit_analyses && fitAnalysis.fit_analyses.length > 0 && (
          <div className="ats-overall-container">
            <h2 className="ats-overall-title">
              ATS Compatibility Analysis
              {atsAnalysisTime && <span className="timing-badge">⏱️ {atsAnalysisTime}s</span>}
            </h2>
            <p className="ats-overall-subtitle">How well your profile will perform in Applicant Tracking Systems</p>

            <div className="ats-comparison">
              {fitAnalysis.fit_analyses.map((result, idx) => {
                const isOpenAI = result.provider === 'openai';
                const isExpanded = isOpenAI ? atsExpandedOpenAI : atsExpandedClaude;
                const toggleExpanded = () => isOpenAI ? setAtsExpandedOpenAI(!atsExpandedOpenAI) : setAtsExpandedClaude(!atsExpandedClaude);

                // Show error message if analysis failed
                if (result.error) {
                  return (
                    <div key={idx} className="ats-card">
                      <div className="ats-card-header">
                        <h3 className="ats-provider">
                          {isOpenAI ? '🟢 OpenAI Analysis' : '🔵 Claude Analysis'}
                        </h3>
                      </div>
                      <div className="provider-error">
                        ⚠️ Analysis Error: {result.error}
                      </div>
                    </div>
                  );
                }

                // Show ATS data if available
                return result.fit_analysis?.ats_compatibility ? (
                  <div key={idx} className="ats-card">
                    <div className="ats-card-header">
                      <h3 className="ats-provider">
                        {isOpenAI ? '🟢 OpenAI Analysis' : '🔵 Claude Analysis'}
                      </h3>
                    </div>

                    {/* ALWAYS VISIBLE: Overall ATS Score */}
                    <div className={`ats-score-box ${getFitColorClass(result.fit_analysis.ats_compatibility.overall_ats_score)}`}>
                      <div className="ats-score">{result.fit_analysis.ats_compatibility.overall_ats_score}%</div>
                      <div className="ats-label">ATS Score</div>
                    </div>

                    {/* EXPANDABLE TOGGLE */}
                    <button
                      className="expand-toggle-btn"
                      onClick={toggleExpanded}
                    >
                      <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
                      {isExpanded ? 'Hide Details' : 'Show Details'}
                    </button>

                    {/* EXPANDABLE CONTENT */}
                    {isExpanded && (
                      <div className="ats-expandable-content">
                        <div className="ats-breakdown">
                          <div className="ats-metric">
                            <span className="ats-metric-label">Keyword Match:</span>
                            <div className="ats-progress-bar">
                              <div className="ats-progress-fill" style={{width: `${result.fit_analysis.ats_compatibility.keyword_match}%`}}></div>
                            </div>
                            <span className="ats-metric-value">{result.fit_analysis.ats_compatibility.keyword_match}%</span>
                          </div>
                          <div className="ats-metric">
                            <span className="ats-metric-label">Skills Coverage:</span>
                            <div className="ats-progress-bar">
                              <div className="ats-progress-fill" style={{width: `${result.fit_analysis.ats_compatibility.skills_coverage}%`}}></div>
                            </div>
                            <span className="ats-metric-value">{result.fit_analysis.ats_compatibility.skills_coverage}%</span>
                          </div>
                          <div className="ats-metric">
                            <span className="ats-metric-label">Action Verbs:</span>
                            <div className="ats-progress-bar">
                              <div className="ats-progress-fill" style={{width: `${result.fit_analysis.ats_compatibility.action_verbs_score}%`}}></div>
                            </div>
                            <span className="ats-metric-value">{result.fit_analysis.ats_compatibility.action_verbs_score}%</span>
                          </div>
                          <div className="ats-metric">
                            <span className="ats-metric-label">Has Metrics:</span>
                            <span className="ats-metric-badge">{result.fit_analysis.ats_compatibility.has_metrics ? '✅ Yes' : '❌ No'}</span>
                          </div>
                        </div>
                        {result.fit_analysis.ats_compatibility.ats_notes && (
                          <div className="ats-notes">
                            <strong>ATS Notes:</strong> {result.fit_analysis.ats_compatibility.ats_notes}
                          </div>
                        )}

                        {/* Data Viewer for ATS - Same data as Profile Fit since ATS is part of it */}
                        <div className="data-viewer-section" style={{marginTop: '1.5rem'}}>
                          <button
                            className="data-viewer-toggle"
                            onClick={() => setAtsDataExpanded(!atsDataExpanded)}
                          >
                            <span className="expand-arrow">{atsDataExpanded ? '▼' : '▶'}</span>
                            🔍 View Data Sent to AI Models for ATS Score
                          </button>
                          {atsDataExpanded && (
                            <div className="data-viewer-content">
                              {fitAnalysis.input_data ? (
                                <>
                                  <div className="data-viewer-warning">
                                    ⚠️ This is the exact data that was sent to {isOpenAI ? 'OpenAI' : 'Claude'} for ATS Compatibility Analysis
                                  </div>
                                  <div className="data-viewer-sections">
                                    <div className="data-viewer-block">
                                      <h4>Job Analysis Data</h4>
                                      <pre>{JSON.stringify(fitAnalysis.input_data.job_analysis, null, 2)}</pre>
                                    </div>
                                    <div className="data-viewer-block">
                                      <h4>Your Profile Data</h4>
                                      <pre>{fitAnalysis.input_data.formatted_profile || 'No profile data available'}</pre>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="data-viewer-warning" style={{background: '#fff3cd', borderColor: '#ffc107'}}>
                                  ⚠️ Input data not available. This analysis was run before the data viewer feature was added.
                                  <br/><strong>Please run a fresh analysis to see the input data.</strong>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Tailor My CV Button - FOURTH - Show after fit analysis is complete */}
        {fitAnalysis && !tailoringRecs && (
          <div className="tailor-cv-action">
            <button
              className="btn-tailor-cv"
              onClick={handleTailorCV}
              disabled={tailoring}
            >
              {tailoring ? (
                <>
                  <span className="spinner-small"></span>
                  Getting AI Recommendations...
                </>
              ) : (
                <>
                  📝 Tailor My CV for This Role
                </>
              )}
            </button>
            <p className="tailor-cv-hint">
              Let AI recommend which specific content from your master profile to include for this job
            </p>
          </div>
        )}

        {/* CV Tailoring Review UI - FIFTH - Enriched with actual content */}
        {tailoringRecs && (tailoringRecs.enriched_recommendations || tailoringRecs.tailoring_recommendations) && (
          <div className="tailoring-review-container">
            <div className="tailoring-review-header">
              <div className="tailoring-header-content">
                <div>
                  <h2>📝 AI-Recommended Content for This Role</h2>
                  <p>Review the specific content recommended by OpenAI and Claude. Items recommended by both models are highlighted.</p>
                </div>
                <button
                  className="save-tailored-cv-btn"
                  onClick={handleSaveTailoredCV}
                  disabled={savingTailoredCV}
                >
                  {savingTailoredCV ? '💾 Saving...' : '💾 Save This Tailored CV'}
                </button>
              </div>
            </div>

            {/* Data Viewer for CV Tailoring */}
            {tailoringRecs.input_data && (
              <div className="data-viewer-section">
                <button
                  className="data-viewer-toggle"
                  onClick={() => setTailorDataExpanded(!tailorDataExpanded)}
                >
                  <span className="expand-arrow">{tailorDataExpanded ? '▼' : '▶'}</span>
                  🔍 View Input Data Sent to AI Models
                </button>
                {tailorDataExpanded && (
                  <div className="data-viewer-content">
                    <div className="data-viewer-warning">
                      ⚠️ This is the exact data that was sent to OpenAI and Claude for CV Tailoring Recommendations
                    </div>
                    <div className="data-viewer-sections">
                      <div className="data-viewer-block">
                        <h4>Job Analysis Data</h4>
                        <pre>{JSON.stringify(tailoringRecs.input_data.job_analysis, null, 2)}</pre>
                      </div>
                      <div className="data-viewer-block">
                        <h4>Your Profile Data</h4>
                        <pre>{tailoringRecs.input_data.formatted_profile || 'No profile data available'}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overall Strategy */}
            {tailoringRecs.enriched_recommendations && (tailoringRecs.enriched_recommendations.overall_strategy?.openai || tailoringRecs.enriched_recommendations.overall_strategy?.claude) && (
              <div className="strategy-comparison">
                {tailoringRecs.enriched_recommendations.overall_strategy.openai && (
                  <div className="strategy-card">
                    <h4>🟢 OpenAI Strategy</h4>
                    <p>{tailoringRecs.enriched_recommendations.overall_strategy.openai}</p>
                  </div>
                )}
                {tailoringRecs.enriched_recommendations.overall_strategy.claude && (
                  <div className="strategy-card">
                    <h4>🔵 Claude Strategy</h4>
                    <p>{tailoringRecs.enriched_recommendations.overall_strategy.claude}</p>
                  </div>
                )}
              </div>
            )}

            {/* Summary - Unified Layout */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.summary && tailoringRecs.enriched_recommendations.summary.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">📋 Summary</h3>
                <p className="section-subtitle">
                  {tailoringRecs.enriched_recommendations.summary.length} selected items from your profile
                </p>

                <div className="unified-summary-list">
                  {tailoringRecs.enriched_recommendations.summary.map((item, idx) => (
                    <div key={idx} className="unified-item">
                      <div className="item-content-row">
                        <span className="item-bullet">•</span>
                        <div className="item-text-wrapper">
                          <p className="item-text">{item.content}</p>
                        </div>
                        <div className="item-badges-inline">
                          {item.recommended_by && item.recommended_by.includes('openai') && <span className="badge-openai-small">🟢</span>}
                          {item.recommended_by && item.recommended_by.includes('claude') && <span className="badge-claude-small">🔵</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Experience */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.work_experience && tailoringRecs.enriched_recommendations.work_experience.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">💼 Work Experience ({tailoringRecs.enriched_recommendations.work_experience.length} entries)</h3>
                <p className="section-subtitle">AI-selected bullets from your work history that best match this role</p>

                {tailoringRecs.enriched_recommendations.work_experience.map((exp, idx) => (
                  <div key={idx} className="enriched-work-entry">
                    <div className="work-entry-header">
                      <h4 className="work-title">{exp.title}</h4>
                      <div className="work-meta">
                        {exp.subtitle && <span className="work-company">{exp.subtitle}</span>}
                        {exp.date_range && <span className="work-dates">{exp.date_range}</span>}
                        {exp.location && <span className="work-location">📍 {exp.location}</span>}
                      </div>
                    </div>

                    {/* Direct bullets under this entry */}
                    {exp.items && exp.items.length > 0 && (
                      <div className="work-bullets">
                        <p className="bullets-label">Key Achievements ({exp.items.length}):</p>
                        {exp.items.map((item, i) => (
                          <div key={i} className={`enriched-item ${item.recommended_by && item.recommended_by.length === 2 ? 'recommended-by-both' : ''}`}>
                            <div className="item-content">• {item.content}</div>
                            <div className="item-badges">
                              {item.recommended_by && item.recommended_by.includes('openai') && (
                                <span className="badge-openai">🟢</span>
                              )}
                              {item.recommended_by && item.recommended_by.includes('claude') && (
                                <span className="badge-claude">🔵</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sub-entries (hierarchical roles/subsections) */}
                    {exp.sub_entries && exp.sub_entries.length > 0 && (
                      <div className="work-sub-entries">
                        {exp.sub_entries.map((subEntry, subIdx) => (
                          <div key={subIdx} className="work-sub-entry">
                            <h5 className="sub-entry-title">└─ {subEntry.title}</h5>
                            {subEntry.items && subEntry.items.length > 0 && (
                              <div className="sub-entry-bullets">
                                {subEntry.items.map((item, i) => (
                                  <div key={i} className={`enriched-item ${item.recommended_by && item.recommended_by.length === 2 ? 'recommended-by-both' : ''}`}>
                                    <div className="item-content">• {item.content}</div>
                                    <div className="item-badges">
                                      {item.recommended_by && item.recommended_by.includes('openai') && (
                                        <span className="badge-openai">🟢</span>
                                      )}
                                      {item.recommended_by && item.recommended_by.includes('claude') && (
                                        <span className="badge-claude">🔵</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Reasoning for sub-entry */}
                            {(subEntry.reasoning?.openai || subEntry.reasoning?.claude) && (
                              <div className="sub-entry-reasoning">
                                {subEntry.reasoning.openai && (
                                  <p className="reasoning-text">🟢 {subEntry.reasoning.openai}</p>
                                )}
                                {subEntry.reasoning.claude && (
                                  <p className="reasoning-text">🔵 {subEntry.reasoning.claude}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Overall reasoning for this entry */}
                    {(exp.reasoning?.openai || exp.reasoning?.claude) && (
                      <div className="work-reasoning">
                        <p className="reasoning-title"><strong>Why This Experience Matters:</strong></p>
                        {exp.reasoning.openai && (
                          <p className="reasoning-openai">🟢 <strong>OpenAI:</strong> {exp.reasoning.openai}</p>
                        )}
                        {exp.reasoning.claude && (
                          <p className="reasoning-claude">🔵 <strong>Claude:</strong> {exp.reasoning.claude}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Skills Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.skills && tailoringRecs.enriched_recommendations.skills.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">🛠️ Skills ({tailoringRecs.enriched_recommendations.skills.length} categories)</h3>
                <p className="section-subtitle">Most relevant skills for this role</p>

                {tailoringRecs.enriched_recommendations.skills.map((skillCategory, idx) => (
                  <div key={idx} className="skill-category">
                    <h4 className="skill-category-title">{skillCategory.title}</h4>
                    {skillCategory.items && skillCategory.items.length > 0 && (
                      <div className="skill-items">
                        {skillCategory.items.map((item, i) => (
                          <span key={i} className={`skill-tag ${item.recommended_by && item.recommended_by.length === 2 ? 'recommended-by-both' : ''}`}>
                            {item.content}
                            {item.recommended_by && (
                              <span className="tag-badge-inline">
                                {item.recommended_by.includes('openai') && <span className="tag-badge">🟢</span>}
                                {item.recommended_by.includes('claude') && <span className="tag-badge">🔵</span>}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {(skillCategory.reasoning?.openai || skillCategory.reasoning?.claude) && (
                      <div className="skill-reasoning">
                        {skillCategory.reasoning.openai && (
                          <p className="reasoning-text">🟢 {skillCategory.reasoning.openai}</p>
                        )}
                        {skillCategory.reasoning.claude && (
                          <p className="reasoning-text">🔵 {skillCategory.reasoning.claude}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Education Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.education && tailoringRecs.enriched_recommendations.education.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">📚 Education ({tailoringRecs.enriched_recommendations.education.length} entries)</h3>
                {tailoringRecs.enriched_recommendations.education.map((edu, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{edu.title}</h4>
                      {edu.subtitle && <p className="entry-subtitle">{edu.subtitle}</p>}
                      {edu.date_range && <p className="entry-dates">{edu.date_range}</p>}
                    </div>
                    {edu.recommended_by && (
                      <div className="entry-badges">
                        {edu.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {edu.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                    {edu.items && edu.items.length > 0 && (
                      <div className="entry-items">
                        {edu.items.map((item, i) => (
                          <div key={i} className={`enriched-item ${item.recommended_by && item.recommended_by.length === 2 ? 'recommended-by-both' : ''}`}>
                            <div className="item-content">• {item.content}</div>
                            <div className="item-badges">
                              {item.recommended_by && item.recommended_by.includes('openai') && (
                                <span className="badge-openai">🟢</span>
                              )}
                              {item.recommended_by && item.recommended_by.includes('claude') && (
                                <span className="badge-claude">🔵</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Projects Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.projects && tailoringRecs.enriched_recommendations.projects.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">🚀 Projects ({tailoringRecs.enriched_recommendations.projects.length} recommended)</h3>
                {tailoringRecs.enriched_recommendations.projects.map((project, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{project.title}</h4>
                      {project.subtitle && <p className="entry-subtitle">{project.subtitle}</p>}
                      {project.date_range && <p className="entry-dates">{project.date_range}</p>}
                    </div>
                    {project.recommended_by && (
                      <div className="entry-badges">
                        {project.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {project.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                    {project.items && project.items.length > 0 && (
                      <div className="entry-items">
                        {project.items.map((item, i) => (
                          <div key={i} className={`enriched-item ${item.recommended_by && item.recommended_by.length === 2 ? 'recommended-by-both' : ''}`}>
                            <div className="item-content">• {item.content}</div>
                            <div className="item-badges">
                              {item.recommended_by && item.recommended_by.includes('openai') && (
                                <span className="badge-openai">🟢</span>
                              )}
                              {item.recommended_by && item.recommended_by.includes('claude') && (
                                <span className="badge-claude">🔵</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Certifications Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.certifications && tailoringRecs.enriched_recommendations.certifications.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">🏆 Certifications ({tailoringRecs.enriched_recommendations.certifications.length} relevant)</h3>
                {tailoringRecs.enriched_recommendations.certifications.map((cert, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{cert.title}</h4>
                      {cert.subtitle && <p className="entry-subtitle">{cert.subtitle}</p>}
                      {cert.date_range && <p className="entry-dates">{cert.date_range}</p>}
                    </div>
                    {cert.recommended_by && (
                      <div className="entry-badges">
                        {cert.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {cert.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Awards Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.awards && tailoringRecs.enriched_recommendations.awards.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">⭐ Awards ({tailoringRecs.enriched_recommendations.awards.length} relevant)</h3>
                {tailoringRecs.enriched_recommendations.awards.map((award, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{award.title}</h4>
                      {award.subtitle && <p className="entry-subtitle">{award.subtitle}</p>}
                      {award.date_range && <p className="entry-dates">{award.date_range}</p>}
                    </div>
                    {award.recommended_by && (
                      <div className="entry-badges">
                        {award.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {award.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Publications Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.publications && tailoringRecs.enriched_recommendations.publications.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">📄 Publications ({tailoringRecs.enriched_recommendations.publications.length} relevant)</h3>
                {tailoringRecs.enriched_recommendations.publications.map((pub, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{pub.title}</h4>
                      {pub.subtitle && <p className="entry-subtitle">{pub.subtitle}</p>}
                      {pub.date_range && <p className="entry-dates">{pub.date_range}</p>}
                    </div>
                    {pub.recommended_by && (
                      <div className="entry-badges">
                        {pub.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {pub.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Languages Section */}
            {tailoringRecs.enriched_recommendations && tailoringRecs.enriched_recommendations.languages && tailoringRecs.enriched_recommendations.languages.length > 0 && (
              <div className="enriched-section">
                <h3 className="section-title">🌍 Languages ({tailoringRecs.enriched_recommendations.languages.length} relevant)</h3>
                {tailoringRecs.enriched_recommendations.languages.map((lang, idx) => (
                  <div key={idx} className="enriched-entry">
                    <div className="entry-header">
                      <h4 className="entry-title">{lang.title}</h4>
                      {lang.subtitle && <p className="entry-subtitle">{lang.subtitle}</p>}
                    </div>
                    {lang.recommended_by && (
                      <div className="entry-badges">
                        {lang.recommended_by.includes('openai') && <span className="badge-openai">🟢 OpenAI</span>}
                        {lang.recommended_by.includes('claude') && <span className="badge-claude">🔵 Claude</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fallback: Show old format if enriched data not available */}
            {!tailoringRecs.enriched_recommendations && tailoringRecs.tailoring_recommendations && (
              <div className="tailoring-recommendations">
                {tailoringRecs.tailoring_recommendations.map((rec, idx) => (
                <div key={idx} className="recommendation-card">
                  <div className="recommendation-header">
                    <h3>
                      {rec.provider === 'openai' ? '🟢 OpenAI Recommendations' : '🔵 Claude Recommendations'}
                    </h3>
                    {rec.model && <span className="model-badge">{rec.model}</span>}
                  </div>

                  {rec.error ? (
                    <div className="provider-error">Error: {rec.error}</div>
                  ) : rec.recommendations && (
                    <div className="recommendation-content">
                      {/* Overall Strategy */}
                      {rec.recommendations.overall_strategy && (
                        <div className="strategy-section">
                          <h4>💡 Strategy</h4>
                          <p>{rec.recommendations.overall_strategy}</p>
                        </div>
                      )}

                      {/* Key Keywords */}
                      {rec.recommendations.key_keywords_to_include && rec.recommendations.key_keywords_to_include.length > 0 && (
                        <div className="keywords-section">
                          <h4>🔑 Key Keywords to Include</h4>
                          <div className="keywords-list">
                            {rec.recommendations.key_keywords_to_include.map((keyword, i) => (
                              <span key={i} className="keyword-badge">{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estimated Page Count */}
                      {rec.recommendations.estimated_page_count && (
                        <div className="page-count-info">
                          <strong>Estimated CV Length:</strong> {rec.recommendations.estimated_page_count} {rec.recommendations.estimated_page_count === 1 ? 'page' : 'pages'}
                        </div>
                      )}

                      {/* Summary Items */}
                      {rec.recommendations.recommended_summary_items && rec.recommendations.recommended_summary_items.length > 0 && (
                        <div className="recommendation-section">
                          <h4>📋 Recommended Summary Items</h4>
                          <p className="section-note">Recommended {rec.recommendations.recommended_summary_items.length} items for your summary section</p>
                          <div className="item-ids">
                            {rec.recommendations.recommended_summary_items.map((itemId, i) => (
                              <span key={i} className="item-id-badge">Item #{itemId}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Work Experience */}
                      {rec.recommendations.recommended_work_experience && rec.recommendations.recommended_work_experience.length > 0 && (
                        <div className="recommendation-section">
                          <h4>💼 Recommended Work Experience</h4>
                          {rec.recommendations.recommended_work_experience.map((exp, i) => (
                            <div key={i} className="work-exp-recommendation">
                              <div className="exp-header">
                                <strong>Entry #{exp.entry_id}</strong>
                                {exp.recommended_items && exp.recommended_items.length > 0 && (
                                  <span className="item-count">{exp.recommended_items.length} bullets</span>
                                )}
                              </div>
                              {exp.reasoning && (
                                <p className="reasoning">{exp.reasoning}</p>
                              )}
                              {exp.recommended_items && exp.recommended_items.length > 0 && (
                                <div className="item-ids">
                                  {exp.recommended_items.map((itemId, j) => (
                                    <span key={j} className="item-id-badge">Item #{itemId}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Skills */}
                      {rec.recommendations.recommended_skills && rec.recommendations.recommended_skills.length > 0 && (
                        <div className="recommendation-section">
                          <h4>🛠️ Recommended Skills</h4>
                          {rec.recommendations.recommended_skills.map((skill, i) => (
                            <div key={i} className="skill-recommendation">
                              <div className="skill-header">
                                <strong>Category #{skill.entry_id}</strong>
                              </div>
                              {skill.reasoning && (
                                <p className="reasoning">{skill.reasoning}</p>
                              )}
                              {skill.recommended_items && skill.recommended_items.length > 0 && (
                                <div className="item-ids">
                                  {skill.recommended_items.map((itemId, j) => (
                                    <span key={j} className="item-id-badge">Item #{itemId}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Education */}
                      {rec.recommendations.recommended_education && rec.recommendations.recommended_education.length > 0 && (
                        <div className="recommendation-section">
                          <h4>🎓 Recommended Education</h4>
                          <div className="item-ids">
                            {rec.recommendations.recommended_education.map((entryId, i) => (
                              <span key={i} className="item-id-badge">Entry #{entryId}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Projects */}
                      {rec.recommendations.recommended_projects && rec.recommendations.recommended_projects.length > 0 && (
                        <div className="recommendation-section">
                          <h4>🚀 Recommended Projects</h4>
                          <div className="item-ids">
                            {rec.recommendations.recommended_projects.map((entryId, i) => (
                              <span key={i} className="item-id-badge">Entry #{entryId}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Certifications */}
                      {rec.recommendations.recommended_certifications && rec.recommendations.recommended_certifications.length > 0 && (
                        <div className="recommendation-section">
                          <h4>📜 Recommended Certifications</h4>
                          <div className="item-ids">
                            {rec.recommendations.recommended_certifications.map((entryId, i) => (
                              <span key={i} className="item-id-badge">Entry #{entryId}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}

            <div className="tailoring-actions">
              <p className="next-step-note">
                ℹ️ Review the AI recommendations above. Items recommended by both models typically have the strongest match.
              </p>
              <button
                className="btn-close-recommendations"
                onClick={() => setTailoringRecs(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {analyzingFit && !fitAnalysis && (
          <div className="analyzing-fit">
            <span className="spinner"></span>
            Analyzing profile fit...
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get color class based on fit percentage
function getFitColorClass(percentage) {
  if (percentage >= 90) return 'fit-excellent';
  if (percentage >= 75) return 'fit-strong';
  if (percentage >= 60) return 'fit-moderate';
  if (percentage >= 40) return 'fit-weak';
  return 'fit-poor';
}

// Helper function to render compact analysis sections for side-by-side view
function renderAnalysisSectionCompact(title, content) {
  if (!content) return null;

  return (
    <div className="analysis-section-compact">
      <h4 className="section-title-compact">{title}</h4>
      <div className="section-content-compact">
        {Array.isArray(content) ? (
          <ul className="content-list-compact">
            {content.slice(0, 8).map((item, idx) => (
              <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
            ))}
            {content.length > 8 && <li className="more-items">... and {content.length - 8} more</li>}
          </ul>
        ) : typeof content === 'object' ? (
          <div className="content-object-compact">
            {Object.entries(content).slice(0, 5).map(([key, value]) => (
              <div key={key} className="object-item-compact">
                <strong>{key}:</strong> {Array.isArray(value) ? value.slice(0, 3).join(', ') : String(value)}
              </div>
            ))}
          </div>
        ) : (
          <p className="content-text-compact">{String(content)}</p>
        )}
      </div>
    </div>
  );
}

// Helper function to render analysis sections (kept for compatibility)
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

// Review & Finalize View Component - Renamed from SavedCVsView
function ReviewFinalizeView() {
  return (
    <div className="review-finalize-wrapper">
      <div className="review-header">
        <h1>💼 CV Portfolio</h1>
        <p className="review-subtitle">
          View all your saved tailored CVs. See complete job details, AI fit and ATS scores, and all AI-selected content. Toggle visibility of individual items, recalculate ATS scores based on your final selections, preview your CV in real-time, and download professional PDFs ready for applications.
        </p>
      </div>
      <TailoredCVs />
    </div>
  );
}

// Coming Soon Component
function ComingSoon({ feature }) {
  return (
    <div className="coming-soon-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      padding: '40px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '80px', marginBottom: '20px' }}>🚧</div>
      <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#333' }}>
        {feature} - Coming Soon
      </h1>
      <p style={{ fontSize: '18px', color: '#666', maxWidth: '600px' }}>
        We're building an amazing new hierarchical profile system with infinite flexibility.
        This feature will be available soon with the v3.0 release!
      </p>
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f0f8ff',
        borderRadius: '8px',
        maxWidth: '500px'
      }}>
        <p style={{ fontSize: '14px', color: '#0066cc', margin: 0 }}>
          <strong>New in v3.0:</strong> Universal hierarchical nodes, infinite nesting,
          flexible metadata, and global ID tracking for perfect CV tailoring.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
