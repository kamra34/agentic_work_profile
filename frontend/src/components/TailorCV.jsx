import { useState, useEffect } from 'react';
import './TailorCV.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEPS = [
  { id: 1, name: 'Job Details', icon: '📋' },
  { id: 2, name: 'AI Analysis', icon: '🤖' },
  { id: 3, name: 'Smart Selection', icon: '✨' },
  { id: 4, name: 'Save & Preview', icon: '💾' }
];

function TailorCV() {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Job Details
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Step 2: AI Analysis Results
  const [analyzing, setAnalyzing] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [openaiAnalysis, setOpenaiAnalysis] = useState(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState(null);

  // Step 3: Scoring and Selection
  const [scoring, setScoring] = useState(false);
  const [scores, setScores] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedModel, setSelectedModel] = useState('openai'); // Which model's recommendations to use

  // Step 4: Save
  const [saving, setSaving] = useState(false);
  const [cvStatus, setCvStatus] = useState('draft');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profiles = await response.json();

      if (profiles && profiles.length > 0) {
        const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
        setProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeJob = async () => {
    if (!jobDescription || jobDescription.length < 50) {
      alert('Please enter a job description (minimum 50 characters)');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/analyze-job`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ job_description: jobDescription })
      });

      const data = await response.json();
      setJobAnalysis(data);
      setOpenaiAnalysis(data.openai);
      setClaudeAnalysis(data.claude);

      // Auto-advance to step 2
      setCurrentStep(2);

      // Auto-start scoring
      await handleScoreProfile(data.openai.analysis || data.claude.analysis);
    } catch (error) {
      console.error('Error analyzing job:', error);
      alert('Failed to analyze job description. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScoreProfile = async (jobRequirements) => {
    if (!profile || !jobRequirements) return;

    setScoring(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/score-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_requirements: jobRequirements,
          profile_id: profile.id
        })
      });

      const data = await response.json();
      setScores(data);

      // Auto-start node recommendations
      await handleGetRecommendations(jobRequirements);
    } catch (error) {
      console.error('Error scoring profile:', error);
    } finally {
      setScoring(false);
    }
  };

  const handleGetRecommendations = async (jobRequirements) => {
    if (!profile || !jobRequirements) return;

    setRecommendationsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/recommend-nodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_requirements: jobRequirements,
          profile_id: profile.id
        })
      });

      const data = await response.json();
      setRecommendations(data);

      // Auto-select nodes based on the selected model's recommendations
      const modelRecs = data[selectedModel];
      if (modelRecs && modelRecs.success && modelRecs.recommendations.selected_nodes) {
        const autoSelected = new Set();
        modelRecs.recommendations.selected_nodes.forEach(node => {
          if (node.include) {
            autoSelected.add(node.global_id || node.node_id);
          }
        });
        setSelectedNodes(autoSelected);
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleSaveTailoredCV = async () => {
    if (!jobTitle) {
      alert('Please enter a job title');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile_id: profile.id,
          job_title: jobTitle,
          company_name: companyName,
          job_description: jobDescription,
          selected_node_ids: Array.from(selectedNodes),
          fit_scores: scores,
          ats_scores: scores,
          recommendations: recommendations,
          job_analysis: jobAnalysis,
          status: cvStatus
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Tailored CV saved successfully!');
        // Could navigate to the tailored CVs list page
      }
    } catch (error) {
      console.error('Error saving tailored CV:', error);
      alert('Failed to save tailored CV. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNodeSelection = (globalId) => {
    const newSelected = new Set(selectedNodes);
    if (newSelected.has(globalId)) {
      newSelected.delete(globalId);
    } else {
      newSelected.add(globalId);
    }
    setSelectedNodes(newSelected);
  };

  const applyModelRecommendations = (model) => {
    setSelectedModel(model);
    const modelRecs = recommendations?.[model];
    if (modelRecs && modelRecs.success && modelRecs.recommendations.selected_nodes) {
      const autoSelected = new Set();
      modelRecs.recommendations.selected_nodes.forEach(node => {
        if (node.include) {
          autoSelected.add(node.global_id || node.node_id);
        }
      });
      setSelectedNodes(autoSelected);
    }
  };

  if (loading) {
    return <div className="tailor-cv-loading">Loading...</div>;
  }

  if (!profile) {
    return <div className="tailor-cv-error">No profile found. Please create a master profile first.</div>;
  }

  return (
    <div className="tailor-cv">
      {/* Progress Bar */}
      <div className="wizard-header">
        <h1>Create Tailored CV</h1>
        <div className="wizard-progress">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
            >
              <div className="step-number">
                {currentStep > step.id ? '✓' : step.icon}
              </div>
              <div className="step-name">{step.name}</div>
              {index < STEPS.length - 1 && <div className="step-connector" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {currentStep === 1 && (
          <Step1JobDetails
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            companyName={companyName}
            setCompanyName={setCompanyName}
            onNext={handleAnalyzeJob}
            analyzing={analyzing}
          />
        )}

        {currentStep === 2 && (
          <Step2AIAnalysis
            openaiAnalysis={openaiAnalysis}
            claudeAnalysis={claudeAnalysis}
            scores={scores}
            scoring={scoring}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3NodeSelection
            profile={profile}
            recommendations={recommendations}
            selectedNodes={selectedNodes}
            toggleNodeSelection={toggleNodeSelection}
            selectedModel={selectedModel}
            applyModelRecommendations={applyModelRecommendations}
            loading={recommendationsLoading}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4SavePreview
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            companyName={companyName}
            setCompanyName={setCompanyName}
            cvStatus={cvStatus}
            setCvStatus={setCvStatus}
            profile={profile}
            selectedNodes={selectedNodes}
            scores={scores}
            onSave={handleSaveTailoredCV}
            saving={saving}
            onBack={() => setCurrentStep(3)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step 1: Job Details
// ============================================================================

function Step1JobDetails({ jobDescription, setJobDescription, jobTitle, setJobTitle, companyName, setCompanyName, onNext, analyzing }) {
  return (
    <div className="wizard-step step-1">
      <div className="step-header">
        <h2>📋 Paste Job Description</h2>
        <p>Enter the job details and description to get AI-powered CV tailoring</p>
      </div>

      <div className="step-body">
        <div className="form-group">
          <label>Job Title *</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g., Senior Data Scientist"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g., Google"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Job Description *</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            className="form-textarea"
            rows={15}
          />
          <div className="char-count">
            {jobDescription.length} characters
            {jobDescription.length < 50 && <span className="warning"> (minimum 50 required)</span>}
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button
          className="btn-primary btn-large"
          onClick={onNext}
          disabled={analyzing || !jobDescription || jobDescription.length < 50 || !jobTitle}
        >
          {analyzing ? 'Analyzing with AI...' : 'Analyze Job →'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: AI Analysis
// ============================================================================

function Step2AIAnalysis({ openaiAnalysis, claudeAnalysis, scores, scoring, onNext, onBack }) {
  const [selectedTab, setSelectedTab] = useState('openai');

  const currentAnalysis = selectedTab === 'openai' ? openaiAnalysis : claudeAnalysis;
  const currentScores = scores?.[selectedTab];

  return (
    <div className="wizard-step step-2">
      <div className="step-header">
        <h2>🤖 AI Analysis Results</h2>
        <p>Compare insights from both AI models</p>
      </div>

      <div className="step-body">
        {/* Model Tabs */}
        <div className="model-tabs">
          <button
            className={`model-tab ${selectedTab === 'openai' ? 'active' : ''}`}
            onClick={() => setSelectedTab('openai')}
          >
            <strong>OpenAI GPT-4</strong>
            {scores?.openai?.scores && (
              <div className="tab-scores">
                <span className="score">Fit: {scores.openai.scores.fit_score}</span>
                <span className="score">ATS: {scores.openai.scores.ats_score}</span>
              </div>
            )}
          </button>
          <button
            className={`model-tab ${selectedTab === 'claude' ? 'active' : ''}`}
            onClick={() => setSelectedTab('claude')}
          >
            <strong>Claude 3.5 Sonnet</strong>
            {scores?.claude?.scores && (
              <div className="tab-scores">
                <span className="score">Fit: {scores.claude.scores.fit_score}</span>
                <span className="score">ATS: {scores.claude.scores.ats_score}</span>
              </div>
            )}
          </button>
        </div>

        {/* Analysis Content */}
        {scoring ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Analyzing job requirements and scoring your profile...</p>
          </div>
        ) : (
          <div className="analysis-content">
            {/* Scores */}
            {currentScores?.scores && (
              <div className="scores-panel">
                <div className="score-card fit-score">
                  <div className="score-value">{currentScores.scores.fit_score}</div>
                  <div className="score-label">Profile Fit</div>
                  <div className="score-reasoning">{currentScores.scores.fit_reasoning}</div>
                </div>
                <div className="score-card ats-score">
                  <div className="score-value">{currentScores.scores.ats_score}</div>
                  <div className="score-label">ATS Score</div>
                  <div className="score-reasoning">{currentScores.scores.ats_reasoning}</div>
                </div>
              </div>
            )}

            {/* Job Requirements */}
            {currentAnalysis?.success && currentAnalysis.analysis && (
              <div className="requirements-panel">
                <h3>Extracted Requirements</h3>
                <div className="requirements-grid">
                  {currentAnalysis.analysis.requirements?.technical_skills?.length > 0 && (
                    <div className="requirement-section">
                      <h4>Technical Skills</h4>
                      <ul>
                        {currentAnalysis.analysis.requirements.technical_skills.map((skill, i) => (
                          <li key={i}>{skill}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentAnalysis.analysis.requirements?.soft_skills?.length > 0 && (
                    <div className="requirement-section">
                      <h4>Soft Skills</h4>
                      <ul>
                        {currentAnalysis.analysis.requirements.soft_skills.map((skill, i) => (
                          <li key={i}>{skill}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentAnalysis.analysis.must_haves?.length > 0 && (
                    <div className="requirement-section">
                      <h4>Must Haves</h4>
                      <ul>
                        {currentAnalysis.analysis.must_haves.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentAnalysis.analysis.nice_to_haves?.length > 0 && (
                    <div className="requirement-section">
                      <h4>Nice to Haves</h4>
                      <ul>
                        {currentAnalysis.analysis.nice_to_haves.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {currentScores?.scores?.strengths?.length > 0 && (
                  <div className="insights-section strengths">
                    <h4>✓ Your Strengths</h4>
                    <ul>
                      {currentScores.scores.strengths.map((strength, i) => (
                        <li key={i}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentScores?.scores?.gaps?.length > 0 && (
                  <div className="insights-section gaps">
                    <h4>⚠ Gaps to Address</h4>
                    <ul>
                      {currentScores.scores.gaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn-primary btn-large"
          onClick={onNext}
          disabled={scoring || !scores}
        >
          Continue to Selection →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: Node Selection
// ============================================================================

function Step3NodeSelection({ profile, recommendations, selectedNodes, toggleNodeSelection, selectedModel, applyModelRecommendations, loading, onNext, onBack }) {
  const flattenNodes = (nodes, result = []) => {
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        flattenNodes(node.children, result);
      }
    });
    return result;
  };

  const allNodes = profile?.nodes ? flattenNodes(profile.nodes) : [];
  const selectedCount = selectedNodes.size;
  const totalCount = allNodes.length;

  return (
    <div className="wizard-step step-3">
      <div className="step-header">
        <h2>✨ Smart Node Selection</h2>
        <p>AI has recommended which items to include. You can adjust selections below.</p>
      </div>

      <div className="step-body">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Getting AI recommendations...</p>
          </div>
        ) : (
          <>
            {/* Model Selection */}
            <div className="recommendation-controls">
              <div className="model-selector">
                <label>Apply recommendations from:</label>
                <div className="model-buttons">
                  <button
                    className={`model-btn ${selectedModel === 'openai' ? 'active' : ''}`}
                    onClick={() => applyModelRecommendations('openai')}
                  >
                    OpenAI
                  </button>
                  <button
                    className={`model-btn ${selectedModel === 'claude' ? 'active' : ''}`}
                    onClick={() => applyModelRecommendations('claude')}
                  >
                    Claude
                  </button>
                </div>
              </div>

              <div className="selection-summary">
                <strong>{selectedCount}</strong> of <strong>{totalCount}</strong> items selected
              </div>
            </div>

            {/* Node List */}
            <div className="nodes-list">
              {allNodes.map(node => {
                const isSelected = selectedNodes.has(node.global_id);
                const modelRec = recommendations?.[selectedModel]?.recommendations?.selected_nodes?.find(
                  rec => rec.global_id === node.global_id || rec.node_id === node.id
                );

                return (
                  <div
                    key={node.global_id || node.id}
                    className={`node-item ${isSelected ? 'selected' : ''} ${modelRec?.include ? 'recommended' : ''}`}
                    onClick={() => toggleNodeSelection(node.global_id)}
                  >
                    <div className="node-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleNodeSelection(node.global_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="node-content">
                      <div className="node-header">
                        <span className="node-type-badge">{node.node_type}</span>
                        <span className="node-title">
                          {node.node_type === 'bullet' || node.node_type === 'paragraph'
                            ? (node.content || 'Empty')
                            : (node.title || 'Untitled')}
                        </span>
                      </div>
                      {node.subtitle && <div className="node-subtitle">{node.subtitle}</div>}
                      {modelRec?.reason && (
                        <div className="ai-recommendation">
                          <strong>AI:</strong> {modelRec.reason}
                          {modelRec.confidence && <span className="confidence"> ({Math.round(modelRec.confidence * 100)}% confidence)</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary btn-large" onClick={onNext}>
          Continue to Save →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Save & Preview
// ============================================================================

function Step4SavePreview({ jobTitle, setJobTitle, companyName, setCompanyName, cvStatus, setCvStatus, profile, selectedNodes, scores, onSave, saving, onBack }) {
  const selectedCount = selectedNodes.size;

  return (
    <div className="wizard-step step-4">
      <div className="step-header">
        <h2>💾 Save Tailored CV</h2>
        <p>Review and save your tailored CV</p>
      </div>

      <div className="step-body">
        <div className="save-form">
          <div className="form-group">
            <label>Job Title *</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Data Scientist"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Google"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select value={cvStatus} onChange={(e) => setCvStatus(e.target.value)} className="form-select">
              <option value="draft">Draft</option>
              <option value="ready">Ready to Apply</option>
              <option value="applied">Applied</option>
            </select>
          </div>

          <div className="summary-panel">
            <h3>Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Selected Items:</span>
                <span className="summary-value">{selectedCount}</span>
              </div>
              {scores?.openai?.scores && (
                <>
                  <div className="summary-item">
                    <span className="summary-label">OpenAI Fit Score:</span>
                    <span className="summary-value">{scores.openai.scores.fit_score}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">OpenAI ATS Score:</span>
                    <span className="summary-value">{scores.openai.scores.ats_score}</span>
                  </div>
                </>
              )}
              {scores?.claude?.scores && (
                <>
                  <div className="summary-item">
                    <span className="summary-label">Claude Fit Score:</span>
                    <span className="summary-value">{scores.claude.scores.fit_score}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Claude ATS Score:</span>
                    <span className="summary-value">{scores.claude.scores.ats_score}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn-primary btn-large"
          onClick={onSave}
          disabled={saving || !jobTitle}
        >
          {saving ? 'Saving...' : 'Save Tailored CV'}
        </button>
      </div>
    </div>
  );
}

export default TailorCV;
