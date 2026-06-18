import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './JobAnalysisView.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function JobAnalysisView() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('description'); // 'description' | 'openai' | 'claude'

  useEffect(() => {
    fetchApplicationData();
  }, [applicationId]);

  const fetchApplicationData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/applications/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch application data');
      }

      const data = await response.json();
      setApplication(data);
    } catch (err) {
      console.error('Error fetching application:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAverageScore = (scores, type) => {
    if (!scores) return null;

    // Extract the nested scores object from each provider
    const openaiScore = scores.openai?.scores?.[type] || scores.openai?.[type];
    const claudeScore = scores.claude?.scores?.[type] || scores.claude?.[type];

    if (openaiScore !== undefined && claudeScore !== undefined) {
      return ((openaiScore + claudeScore) / 2).toFixed(1);
    }
    return openaiScore || claudeScore || null;
  };

  if (loading) {
    return (
      <div className="job-analysis-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading job analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="job-analysis-view">
        <div className="error-state">
          <h2>Error Loading Job Analysis</h2>
          <p>{error || 'Application not found'}</p>
          <button onClick={() => navigate('/dashboard/applications')} className="btn-back">
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  const avgFitScore = getAverageScore(application.final_fit_scores || application.initial_fit_scores, 'fit_score');
  const avgAtsScore = getAverageScore(application.final_fit_scores || application.initial_fit_scores, 'ats_score');

  return (
    <div className="job-analysis-view">
      {/* Header */}
      <div className="job-analysis-header">
        <button onClick={() => navigate('/dashboard/applications')} className="btn-back-header">
          ← Back to Applications
        </button>
        <div className="job-header-content">
          <h1>{application.job_title}</h1>
          <h2>{application.company_name || 'N/A'}</h2>
          {application.location && <p className="job-location">📍 {application.location}</p>}
        </div>
        <div className="job-scores-summary">
          {avgFitScore && (
            <div className="score-badge">
              <span className="score-label">Fit Score</span>
              <span className="score-value">{avgFitScore}%</span>
            </div>
          )}
          {avgAtsScore && (
            <div className="score-badge">
              <span className="score-label">ATS Score</span>
              <span className="score-value">{avgAtsScore}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="job-analysis-tabs">
        <button
          className={`tab-button ${activeTab === 'description' ? 'active' : ''}`}
          onClick={() => setActiveTab('description')}
        >
          📄 Job Description
        </button>
        <button
          className={`tab-button ${activeTab === 'openai' ? 'active' : ''}`}
          onClick={() => setActiveTab('openai')}
          disabled={!application.initial_fit_scores?.openai && !application.final_fit_scores?.openai}
        >
          🤖 OpenAI Analysis
        </button>
        <button
          className={`tab-button ${activeTab === 'claude' ? 'active' : ''}`}
          onClick={() => setActiveTab('claude')}
          disabled={!application.initial_fit_scores?.claude && !application.final_fit_scores?.claude}
        >
          🧠 Claude Analysis
        </button>
      </div>

      {/* Tab Content */}
      <div className="job-analysis-content">
        {activeTab === 'description' && (
          <JobDescriptionTab application={application} />
        )}
        {activeTab === 'openai' && (
          <AIAnalysisTab
            application={application}
            provider="openai"
            modelName="OpenAI"
            modelIcon="🤖"
          />
        )}
        {activeTab === 'claude' && (
          <AIAnalysisTab
            application={application}
            provider="claude"
            modelName="Claude"
            modelIcon="🧠"
          />
        )}
      </div>
    </div>
  );
}

// Job Description Tab Component
function JobDescriptionTab({ application }) {
  return (
    <div className="job-description-tab">
      <div className="description-section">
        <h3>Job Description</h3>
        {application.job_description ? (
          <div className="description-content">
            {application.job_description.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="no-data">No job description available</p>
        )}
      </div>

      {application.job_url && (
        <div className="job-url-section">
          <h3>Job Posting URL</h3>
          <a href={application.job_url} target="_blank" rel="noopener noreferrer" className="job-url-link">
            {application.job_url}
          </a>
        </div>
      )}
    </div>
  );
}

// AI Analysis Tab Component
function AIAnalysisTab({ application, provider, modelName, modelIcon }) {
  const fitScores = application.final_fit_scores || application.initial_fit_scores;
  const atsScores = application.final_ats_scores || application.initial_ats_scores;

  // Extract the nested 'scores' object from the provider's data
  const providerFitData = fitScores?.[provider];
  const providerAtsData = atsScores?.[provider];

  const analysis = providerFitData?.scores || providerFitData;
  const atsAnalysis = providerAtsData?.scores || providerAtsData;

  if (!analysis && !atsAnalysis) {
    return (
      <div className="no-analysis">
        <p>No {modelName} analysis available for this application.</p>
      </div>
    );
  }

  return (
    <div className="ai-analysis-tab">
      {/* Scores Section */}
      <div className="scores-section">
        <h3>{modelIcon} {modelName} Scores</h3>
        <div className="scores-grid">
          {analysis?.fit_score !== undefined && (
            <div className="score-card">
              <span className="score-label">Fit Score</span>
              <span className="score-value-large">{analysis.fit_score}</span>
            </div>
          )}
          {analysis?.ats_score !== undefined && (
            <div className="score-card">
              <span className="score-label">ATS Score</span>
              <span className="score-value-large">{analysis.ats_score}</span>
            </div>
          )}
          {analysis?.verdict && (
            <div className="score-card verdict-card">
              <span className="score-label">Verdict</span>
              <span className="verdict-value">{analysis.verdict.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fit Reasoning */}
      {analysis?.fit_reasoning && (
        <div className="reasoning-section">
          <h3>📊 Fit Score Reasoning</h3>
          <div className="reasoning-content">
            <p>{analysis.fit_reasoning}</p>
          </div>
        </div>
      )}

      {/* ATS Reasoning */}
      {analysis?.ats_reasoning && (
        <div className="reasoning-section">
          <h3>🤖 ATS Score Reasoning</h3>
          <div className="reasoning-content">
            <p>{analysis.ats_reasoning}</p>
          </div>
        </div>
      )}

      {/* Verdict Reasoning */}
      {analysis?.verdict_reasoning && (
        <div className="reasoning-section verdict-reasoning">
          <h3>⚖️ Verdict Reasoning</h3>
          <div className="reasoning-content">
            <p>{analysis.verdict_reasoning}</p>
          </div>
        </div>
      )}

      {/* Strengths */}
      {analysis?.strengths && analysis.strengths.length > 0 && (
        <div className="strengths-section">
          <h3>✅ Strengths</h3>
          <ul className="strengths-list">
            {analysis.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Skills */}
      {analysis?.missing_skills && analysis.missing_skills.length > 0 && (
        <div className="gaps-section">
          <h3>⚠️ Missing Skills</h3>
          <ul className="gaps-list">
            {analysis.missing_skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical Gaps */}
      {analysis?.critical_gaps && analysis.critical_gaps.length > 0 && (
        <div className="gaps-section critical-gaps">
          <h3>🚨 Critical Gaps</h3>
          <ul className="gaps-list">
            {analysis.critical_gaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Matching Skills */}
      {analysis?.matching_skills && analysis.matching_skills.length > 0 && (
        <div className="strengths-section">
          <h3>✅ Matching Skills</h3>
          <ul className="strengths-list">
            {analysis.matching_skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {analysis?.recommendations && analysis.recommendations.length > 0 && (
        <div className="recommendations-section">
          <h3>💡 Recommendations</h3>
          <ul className="recommendations-list">
            {analysis.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

export default JobAnalysisView;
