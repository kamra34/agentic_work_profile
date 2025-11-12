import { useState, useEffect } from 'react';
import './TailorCV.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 🧪 TEST MODE: Set to true to use mock data instead of real AI calls
const USE_MOCK_DATA = false;

const STEPS = [
  { id: 1, name: 'Job Details', icon: '📋' },
  { id: 2, name: 'AI Analysis', icon: '🤖' },
  { id: 3, name: 'Smart Selection', icon: '✨' },
  { id: 4, name: 'Save & Preview', icon: '💾' }
];

// Mock data from your actual test run
const MOCK_ANALYSIS_DATA = {
  openai: {
    success: true,
    model: "openai-gpt-4o",
    analysis: {
      job_metadata: {
        title: null,
        company: null,
        seniority_level: "Lead",
        location: null,
        job_type: null
      },
      requirements: {
        technical_skills: ["Python", "R", "MATLAB", "SQL", "AWS", "Bedrock", "SageMaker", "Lambda", "Step Functions", "vector indexes", "chunking", "metadata", "MLOps", "containers", "CI/CD", "experiment tracking", "model monitoring", "rollback strategies"],
        soft_skills: ["strong communication", "clear writing", "evidence-based decision making"],
        experience_years: "6-10+",
        education: ["Advanced degree in a quantitative field"],
        certifications: [],
        responsibilities: [],
        key_keywords: []
      },
      must_haves: ["Advanced degree in a quantitative field", "6–10+ years experience in DS/ML/AI", "2+ years leading teams or programs", "Hands-on experience with Python", "Experience with AWS or equivalent clouds", "Production experience with retrieval systems", "Fluency in MLOps"],
      nice_to_haves: ["Familiarity with R/MATLAB"],
      role_summary: "Senior data science role requiring advanced degree and extensive experience",
      company_culture: null
    }
  },
  claude: {
    success: true,
    model: "claude-sonnet-4.5",
    analysis: {
      job_metadata: {
        title: null,
        company: null,
        seniority_level: "Senior",
        location: null,
        job_type: null
      },
      requirements: {
        technical_skills: ["Python", "SQL", "R", "MATLAB", "AWS Bedrock", "AWS SageMaker", "AWS Lambda", "AWS Step Functions", "Vector indexes", "Retrieval systems", "MLOps", "Containers", "CI/CD", "Experiment tracking", "Model monitoring", "Rollback strategies", "Data Science", "Machine Learning", "Artificial Intelligence", "Modern data tooling", "Chunking", "Metadata management", "Evaluation systems"],
        soft_skills: ["Leadership", "Team management", "Program management", "Clear communication", "Technical writing", "Evidence-based decision making", "Ability to avoid jargon", "Ability to defend decisions"],
        experience_years: "6-10+",
        education: ["Advanced degree in quantitative field (PhD/MS in EE, CS, Statistics, or related)"],
        certifications: [],
        responsibilities: [],
        key_keywords: []
      },
      must_haves: ["Advanced degree in quantitative field (PhD/MS in EE, CS, Statistics, or related)", "6-10+ years experience in DS/ML/AI", "2+ years leading teams or programs", "Hands-on Python expertise", "SQL proficiency", "AWS experience (Bedrock, SageMaker, Lambda, Step Functions)", "Production experience with retrieval systems", "MLOps fluency including containers, CI/CD, experiment tracking, model monitoring", "Strong communication and technical writing skills"],
      nice_to_haves: ["R programming language familiarity", "MATLAB familiarity", "Experience with equivalent cloud platforms (non-AWS)"],
      role_summary: "Senior-level data scientist position requiring advanced quantitative degree and extensive experience",
      company_culture: null
    }
  }
};

const MOCK_SCORES_DATA = {
  openai: {
    success: true,
    model: "openai-gpt-4o",
    scores: {
      fit_score: 85,
      fit_reasoning: "The candidate has a strong alignment with the job requirements, particularly in technical skills and leadership experience. They have extensive experience with Python, AWS, and MLOps, which are critical for the role. Their background in leading AI and ML projects, as well as their academic credentials, align well with the seniority and educational requirements. However, there is a slight gap in direct mention of experience with some specific AWS services like Step Functions and Lambda, although their experience with AWS in general is robust.",
      ats_score: 78,
      ats_reasoning: "The candidate's profile includes many of the key keywords such as 'Python', 'AWS', 'MLOps', and 'AI'. However, the profile could benefit from explicitly mentioning 'retrieval systems' and 'production experience' more prominently. The format is well-structured, but the narrative style might obscure some keywords for automated parsing systems.",
      verdict: "SHOULD_APPLY",
      verdict_reasoning: "The candidate should apply as they meet most of the critical requirements and have a strong background in the necessary technical and leadership areas. The minor gaps identified are unlikely to be deal-breakers given their overall strong fit.",
      strengths: ["Extensive experience with Python and AWS", "Proven leadership in AI/ML project delivery", "PhD in a relevant field", "Experience with MLOps and CI/CD"],
      missing_skills: ["Explicit mention of Step Functions and Lambda"],
      critical_gaps: [],
      matching_skills: ["Python", "AWS", "MLOps", "Containers", "CI/CD", "Experiment tracking", "Model monitoring", "Rollback strategies"],
      recommendations: ["Highlight specific experience with AWS Step Functions and Lambda in the resume.", "Ensure keywords like 'retrieval systems' and 'production experience' are explicitly mentioned.", "Consider restructuring the profile to emphasize key skills and experiences more clearly for ATS parsing."]
    }
  },
  claude: {
    success: true,
    model: "claude-sonnet-4.5",
    scores: {
      fit_score: 92,
      fit_reasoning: "This candidate is exceptionally well-aligned with the role requirements. They have 10+ years of ML/DS experience (exceeds 6-10+ requirement), PhD in EE (matches education requirement), 5+ years leading teams at Ericsson (exceeds 2+ leadership requirement), and hands-on production experience with nearly every technical requirement: Python, AWS Bedrock/SageMaker/Lambda/Step Functions, RAG systems, MLOps, containers, CI/CD. The specific mention of 'contract analysis AI system processing 10K+ documents monthly' and 'vector search implementation' demonstrates exactly the production retrieval systems experience required. Only minor gaps are explicit R/MATLAB usage and some specific MLOps tools.",
      ats_score: 88,
      ats_reasoning: "Strong keyword density with exact matches for critical terms: Python, AWS, Bedrock, SageMaker, Lambda, Step Functions, MLOps, containers, CI/CD, vector indexes, RAG, production experience, PhD, team leadership. The profile uses industry-standard terminology and includes specific metrics (10K+ documents, 94% accuracy). Minor ATS concerns: some skills mentioned in summary but not detailed in experience section, and the garbled text at the end could cause parsing issues.",
      verdict: "SHOULD_APPLY",
      verdict_reasoning: "This is an excellent match with 90%+ alignment on must-haves. The candidate exceeds experience requirements, has the exact educational background, demonstrates proven leadership at a major tech company, and shows hands-on experience with the specific AWS services and ML production systems mentioned in the job. The detailed, results-oriented descriptions suggest they can articulate their experience well in interviews. This is worth the time investment - high probability of passing initial screening and strong interview potential.",
      strengths: ["PhD in Electrical Engineering from reputable university - exactly matches education requirement", "10+ years ML/DS experience significantly exceeds 6-10+ requirement", "5+ years leading cross-functional ML teams at Ericsson - well above 2+ leadership requirement", "Direct production experience with AWS Bedrock, SageMaker, Lambda, Step Functions - exact tech stack match", "Proven RAG and vector search implementation experience with measurable results (10K+ documents, 94% accuracy)", "Strong MLOps background with containers, CI/CD, monitoring, and rollback strategies", "Published research in IEEE Transactions demonstrates technical depth and communication skills", "Enterprise-scale production experience with real business impact and stakeholder management"],
      missing_skills: ["No explicit mention of R or MATLAB usage (though listed in skills section)", "Specific experiment tracking tools not mentioned", "Model monitoring specifics could be more detailed"],
      critical_gaps: [],
      matching_skills: ["Python (extensively mentioned)", "SQL (listed in skills)", "AWS Bedrock, SageMaker, Lambda, Step Functions (detailed experience)", "Vector indexes and chunking strategies (specific production experience)", "MLOps, containers, CI/CD (hands-on experience)", "Team leadership (5+ years at Ericsson)", "Production retrieval systems (contract analysis AI system)", "PhD in Electrical Engineering", "Strong communication and writing (evidenced by publications and stakeholder management)"],
      recommendations: ["Apply immediately - this is an exceptional fit with minimal gaps", "Emphasize the specific AWS services experience and production scale metrics in your application", "Prepare detailed examples of your MLOps practices and model monitoring approaches for interviews", "Highlight the business impact of your AI systems (10K+ documents processed, multiple awards)", "Be ready to discuss specific technical challenges you've solved in production RAG systems", "Clean up the garbled text at the end of your skills section before submitting"]
    }
  }
};

// Mock recommendations data for Step 3 testing
const MOCK_RECOMMENDATIONS_DATA = {
  openai: {
    success: true,
    model: "openai-gpt-4o",
    recommendations: {
      selection_summary: {
        total_nodes: 70,
        recommended_include: 51,
        recommended_exclude: 19
      },
      tailoring_strategy: "Focus on highlighting AWS experience, leadership in cross-functional teams, hands-on Python and ML expertise, MLOps practices, and RAG/retrieval systems. De-emphasize older roles and non-technical management activities that don't directly demonstrate the required technical depth."
    }
  },
  claude: {
    success: true,
    model: "claude-sonnet-4.5",
    recommendations: {
      selection_summary: {
        total_nodes: 70,
        recommended_include: 51,
        recommended_exclude: 19
      },
      tailoring_strategy: "Focus on highlighting AWS experience, leadership in cross-functional teams, hands-on Python and ML expertise, MLOps practices, and RAG/retrieval systems. De-emphasize older roles and non-technical management activities that don't directly demonstrate the required technical depth."
    }
  },
  total_nodes: 70
};

function TailorCV() {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🧪 Mock data mode state (UI toggle)
  const [useMockData, setUseMockData] = useState(USE_MOCK_DATA);

  // Step 1: Job Details
  const [jobDescription, setJobDescription] = useState(`• Advanced degree in a quantitative field (e.g., PhD/MS in EE, CS, Statistics, or related).
• 6–10+ years across DS/ML/AI with 2+ years leading teams or programs (people and delivery).
• Hands-on depth with Python (and familiarity with R/MATLAB a plus), SQL, and modern data tooling.
• Demonstrated experience on AWS (Bedrock, SageMaker, Lambda, Step Functions) or equivalent clouds.
• Production experience with retrieval systems (vector indexes, chunking, metadata, eval).
• Fluency in MLOps: containers, CI/CD, experiment tracking, model monitoring, rollback strategies.
• Strong communicator who writes clearly, avoids jargon, and can defend decisions with evidence.`);
  const [jobTitle, setJobTitle] = useState('Senior Data Scientist');
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
  const [isPreFetching, setIsPreFetching] = useState(false); // Background pre-fetch state

  // Step 4: Save
  const [saving, setSaving] = useState(false);
  const [cvStatus, setCvStatus] = useState('draft');

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-trigger scoring when job analysis completes
  useEffect(() => {
    if (currentStep === 2 && jobAnalysis && !scores && !scoring) {
      const jobReqs = jobAnalysis.openai?.success ? jobAnalysis.openai.analysis : jobAnalysis.claude?.analysis;
      if (jobReqs) {
        handleScoreProfile(jobReqs);
      }
    }
  }, [currentStep, jobAnalysis, scores, scoring]);

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

    // Move to Step 2 immediately to show loading state
    setCurrentStep(2);
    setAnalyzing(true);

    // 🧪 TEST MODE: Use mock data instead of API call
    if (useMockData) {
      console.log('🧪 TEST MODE: Using mock analysis data');
      setTimeout(() => {
        setJobAnalysis({ openai: MOCK_ANALYSIS_DATA.openai, claude: MOCK_ANALYSIS_DATA.claude });
        setOpenaiAnalysis(MOCK_ANALYSIS_DATA.openai);
        setClaudeAnalysis(MOCK_ANALYSIS_DATA.claude);
        setAnalyzing(false);
        // Auto-trigger scoring with mock data
        setTimeout(() => {
          setScoring(true);
          setTimeout(() => {
            setScores(MOCK_SCORES_DATA);
            setScoring(false);
          }, 1000);
        }, 500);
      }, 1000);
      return;
    }

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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to analyze job');
      }

      const data = await response.json();
      console.log('Job analysis result:', data);

      setJobAnalysis(data);
      setOpenaiAnalysis(data.openai);
      setClaudeAnalysis(data.claude);

      // Check if at least one model succeeded
      if (!data.openai?.success && !data.claude?.success) {
        alert('Both AI models failed to analyze the job. Please try again.');
        setCurrentStep(1);
      }
      // If successful, scoring will be triggered when component mounts or user reviews
    } catch (error) {
      console.error('Error analyzing job:', error);
      alert(`Failed to analyze job description: ${error.message}`);
      // Go back to Step 1 on error
      setCurrentStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScoreProfile = async (jobRequirements) => {
    if (!profile || !jobRequirements) {
      console.error('Missing profile or job requirements:', { profile, jobRequirements });
      return;
    }

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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to score profile');
      }

      const data = await response.json();
      console.log('Scoring result:', data);
      setScores(data);

      // Scoring complete - user can now review results and proceed to Step 3 manually
    } catch (error) {
      console.error('Error scoring profile:', error);
      alert(`Failed to score profile: ${error.message}`);
    } finally {
      setScoring(false);
    }
  };

  const handleGetRecommendations = async (jobRequirements, isBackground = false) => {
    if (!profile || !jobRequirements) {
      console.error('❌ Missing profile or job requirements for recommendations', { profile, jobRequirements });
      return;
    }

    const mode = isBackground ? '🔄 BACKGROUND' : '🚀';
    console.log(`${mode} handleGetRecommendations called with profile:`, profile.id);
    console.log('📋 Job requirements:', JSON.stringify(jobRequirements).substring(0, 200) + '...');

    if (isBackground) {
      console.log('🔄 Running in BACKGROUND mode - you can continue reading Step 2');
      console.log('⚡ Both AI models will run IN PARALLEL - expect ~2-3 minutes (not 4-6!)');
      console.log('⏰ This will run silently and be ready when you proceed to Step 3');
      setIsPreFetching(true);
    } else {
      console.log('⚡ Both AI models will run IN PARALLEL');
      console.log('⏰ Expected time: ~2-3 minutes (instead of 4-6 minutes sequential)');
      console.log('⏰ With large profiles (70+ nodes), wait time is much shorter now!');
      setRecommendationsLoading(true);
    }

    // 🧪 Use mock data if test mode is enabled
    if (useMockData) {
      console.log('🧪 TEST MODE: Using mock recommendations data');
      setTimeout(() => {
        console.log('✅ Mock recommendations loaded');
        setRecommendations(MOCK_RECOMMENDATIONS_DATA);

        // Auto-select nodes based on the selected model's recommendations
        console.log(`🎯 Auto-selecting nodes from ${selectedModel} model...`);
        // Since mock data doesn't have per-node recommendations with global_ids,
        // we'll just select all nodes for testing purposes
        if (profile?.nodes) {
          const allNodeIds = new Set();
          const collectIds = (nodes) => {
            nodes.forEach(node => {
              if (node.global_id) allNodeIds.add(node.global_id);
              if (node.children) collectIds(node.children);
            });
          };
          collectIds(profile.nodes);
          console.log(`✅ Auto-selected ${allNodeIds.size} nodes (mock mode - all nodes)`);
          setSelectedNodes(allNodeIds);
        }

        if (isBackground) {
          console.log('🏁 Background pre-fetch finished - ready for Step 3!');
          setIsPreFetching(false);
        } else {
          console.log('🏁 Recommendations loading finished');
          setRecommendationsLoading(false);
        }
      }, 1000); // 1 second delay to simulate loading
      return;
    }

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Request timeout after 6 minutes');
      controller.abort();
    }, 360000); // 360 second timeout (6 minutes) - Both AI models need time

    try {
      const token = localStorage.getItem('token');
      console.log('📡 Fetching recommendations from API...');
      console.log('🔗 API URL:', `${API_URL}/api/tailor/recommend-nodes`);

      const startTime = Date.now();

      const response = await fetch(`${API_URL}/api/tailor/recommend-nodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_requirements: jobRequirements,
          profile_id: profile.id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ API response received in ${duration}s, status: ${response.status}`);

      if (!response.ok) {
        let errorDetail = 'Failed to get recommendations';
        try {
          const error = await response.json();
          console.error('❌ Recommendations API error:', error);
          errorDetail = error.detail || errorDetail;
        } catch (e) {
          console.error('❌ Could not parse error response:', e);
          errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      console.log('📥 Parsing response JSON...');
      const data = await response.json();
      console.log('✅ Recommendations received:', {
        hasOpenAI: !!data.openai,
        hasClaude: !!data.claude,
        totalNodes: data.total_nodes,
        openaiSuccess: data.openai?.success,
        claudeSuccess: data.claude?.success
      });

      setRecommendations(data);

      // Auto-select nodes based on the selected model's recommendations
      console.log(`🎯 Auto-selecting nodes from ${selectedModel} model...`);
      const modelRecs = data[selectedModel];
      if (modelRecs && modelRecs.success && modelRecs.recommendations?.selected_nodes) {
        const autoSelected = new Set();
        modelRecs.recommendations.selected_nodes.forEach(node => {
          if (node.include) {
            autoSelected.add(node.global_id || node.node_id);
          }
        });
        console.log(`✅ Auto-selected ${autoSelected.size} nodes`);
        setSelectedNodes(autoSelected);
      } else {
        console.warn('⚠️ No recommendations found for auto-selection');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('💥 Error getting recommendations:', error);

      let errorMessage = 'Failed to get AI recommendations';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out after 6 minutes. AI is taking longer than expected. Please try again or continue manually.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(`❌ ${errorMessage}\n\nYou can continue to Step 3 manually or try again.`);

      // Set empty recommendations to allow user to continue
      setRecommendations({
        openai: { success: false, error: errorMessage },
        claude: { success: false, error: errorMessage },
        total_nodes: 0
      });
    } finally {
      if (isBackground) {
        console.log('🏁 Background pre-fetch finished - ready for Step 3!');
        setIsPreFetching(false);
      } else {
        console.log('🏁 Recommendations loading finished');
        setRecommendationsLoading(false);
      }
    }
  };

  // Pre-fetch function - start recommendations in background while user reads Step 2
  const handlePreFetchRecommendations = () => {
    const jobReqs = openaiAnalysis?.success ? openaiAnalysis.analysis : claudeAnalysis?.analysis;
    if (jobReqs && !recommendations && !isPreFetching) {
      handleGetRecommendations(jobReqs, true); // true = background mode
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
      {/* Mock Data Toggle */}
      <div className="dev-tools-toggle">
        <label className="mock-data-toggle">
          <input
            type="checkbox"
            checked={useMockData}
            onChange={(e) => setUseMockData(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">
            🧪 Test Mode {useMockData ? '(Mock Data)' : '(Real AI)'}
          </span>
        </label>
      </div>

      {/* Floating Step Indicator */}
      {(analyzing || scoring || recommendationsLoading || saving) && (
        <div className="step-indicator">
          <div className="step-indicator-icon">{STEPS[currentStep - 1].icon}</div>
          <div className="step-indicator-text">Step {currentStep}/4</div>
        </div>
      )}

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
            jobDescription={jobDescription}
            openaiAnalysis={openaiAnalysis}
            claudeAnalysis={claudeAnalysis}
            scores={scores}
            scoring={scoring}
            profile={profile}
            recommendations={recommendations}
            isPreFetching={isPreFetching}
            onPreFetch={handlePreFetchRecommendations}
            onNext={async () => {
              // Move to step 3 and trigger recommendations if not already loaded
              setCurrentStep(3);
              if (!recommendations && !recommendationsLoading) {
                const jobReqs = openaiAnalysis?.success ? openaiAnalysis.analysis : claudeAnalysis?.analysis;
                if (jobReqs) {
                  await handleGetRecommendations(jobReqs);
                }
              }
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3NodeSelection
            jobDescription={jobDescription}
            profile={profile}
            jobAnalysis={jobAnalysis}
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
            jobAnalysis={jobAnalysis}
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

function Step2AIAnalysis({ jobDescription, openaiAnalysis, claudeAnalysis, scores, scoring, profile, recommendations, isPreFetching, onPreFetch, onNext, onBack }) {
  const [selectedTab, setSelectedTab] = useState('openai');

  const currentAnalysis = selectedTab === 'openai' ? openaiAnalysis : claudeAnalysis;
  const currentScores = scores?.[selectedTab];

  // Convert profile nodes to readable text (same as backend does)
  const profileToText = (nodes) => {
    if (!nodes || nodes.length === 0) return 'No profile data';

    let text = '';
    const processNode = (node) => {
      if (node.node_type === 'section') {
        text += `\n## ${node.title || 'Section'}\n`;
      } else if (node.node_type === 'entry') {
        const title = node.title || '';
        const subtitle = node.subtitle || '';
        const dates = node.start_date ? `${node.start_date} - ${node.end_date || 'Present'}` : '';
        const location = node.location || '';

        text += `**${title}**`;
        if (subtitle) text += ` | ${subtitle}`;
        if (dates) text += ` | ${dates}`;
        if (location) text += ` | ${location}`;
        text += '\n';

        if (node.content) text += `${node.content}\n`;
      } else if (node.node_type === 'bullet' || node.node_type === 'item') {
        text += `• ${node.content || node.title || ''}\n`;
      } else if (node.node_type === 'paragraph') {
        text += `${node.content || ''}\n`;
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach(processNode);
      }
    };

    nodes.forEach(processNode);
    return text;
  };

  const fullProfileText = profile?.nodes ? profileToText(profile.nodes) : 'Loading profile...';

  // Exact prompts used by AI
  const JOB_ANALYSIS_PROMPT = `Analyze this job description and extract key information with critical precision.

Job Description:
{job_description}

Return a JSON object with:
{
  "job_metadata": {
    "title": "extracted job title",
    "company": "company name if mentioned, otherwise null",
    "seniority_level": "Entry/Mid/Senior/Lead/Principal/Executive or null",
    "location": "location if mentioned, otherwise null",
    "job_type": "Full-time/Part-time/Contract/etc or null"
  },
  "requirements": {
    "technical_skills": ["skill1", "skill2", ...],
    "soft_skills": ["skill1", "skill2", ...],
    "experience_years": "X-Y years or null",
    "education": ["requirement1", ...],
    "certifications": ["cert1", ...],
    "responsibilities": ["resp1", "resp2", ...],
    "key_keywords": ["keyword1", "keyword2", ...]
  },
  "role_summary": "brief summary of the role",
  "company_culture": "description of company culture hints or null",
  "must_haves": ["critical requirement 1", ...],
  "nice_to_haves": ["optional requirement 1", ...]
}

Be thorough and extract all relevant requirements.`;

  const SCORING_PROMPT = `You are a brutally honest technical recruiter and career advisor. Analyze this candidate profile against the job requirements with critical precision. Your goal is to save the candidate's time by being factual, direct, and realistic about their chances.

Job Requirements:
{job_requirements}

Candidate Profile:
{profile_content}

Provide a critical, fact-based analysis:

Return JSON:
{
  "fit_score": 85,
  "fit_reasoning": "Factual explanation of why this score. Be specific about what matches and what doesn't. No sugar-coating.",
  "ats_score": 78,
  "ats_reasoning": "Specific explanation of ATS compatibility. Mention keyword matches/misses, format issues.",
  "verdict": "SHOULD_APPLY or SHOULD_NOT_APPLY",
  "verdict_reasoning": "Clear, direct explanation of why the candidate should or should not apply. Focus on realistic chances and time investment value.",
  "strengths": ["Specific strength with evidence from profile", ...],
  "missing_skills": ["Skill required by job but absent from profile", ...],
  "critical_gaps": ["Deal-breaker gaps that significantly hurt chances", ...],
  "matching_skills": ["Skills the candidate has that match job requirements", ...],
  "recommendations": ["Actionable recommendation 1", ...]
}

Be honest and critical. If the fit is poor, say so directly. If it's excellent, explain why with facts. Focus on:
- Exact skill matches vs. missing requirements
- Experience level alignment
- Technical depth in required areas
- Red flags or deal-breakers
- Realistic probability of getting past screening`;

  return (
    <div className="wizard-step step-2">
      <div className="step-header">
        <h2>🤖 AI Analysis Results</h2>
        <p>Compare insights from both AI models</p>
      </div>

      <div className="step-body">
        {/* Pre-fetch recommendation button - TOP POSITION */}
        {scores && !recommendations && !isPreFetching && (
          <div className="prefetch-section">
            <div className="prefetch-info">
              <span className="prefetch-icon">⚡</span>
              <div className="prefetch-text">
                <strong>Want to save time?</strong>
                <p>Start optimizing your CV in the background while you review these results.</p>
              </div>
            </div>
            <button
              className="btn-prefetch"
              onClick={onPreFetch}
            >
              <span className="prefetch-btn-icon">🚀</span>
              Optimize While I Read
            </button>
          </div>
        )}

        {/* Pre-fetching status - TOP POSITION */}
        {isPreFetching && (
          <div className="prefetch-status">
            <div className="prefetch-spinner"></div>
            <div className="prefetch-status-text">
              <strong>🔄 Optimizing in background...</strong>
              <p>AI is analyzing which items to include in your tailored CV. You can continue reading - it'll be ready when you proceed!</p>
            </div>
          </div>
        )}

        {/* Pre-fetch complete status - TOP POSITION */}
        {recommendations && !isPreFetching && (
          <div className="prefetch-complete">
            <span className="prefetch-complete-icon">✅</span>
            <div className="prefetch-complete-text">
              <strong>CV optimization complete!</strong>
              <p>Your personalized recommendations are ready. Click "Continue" to review and adjust.</p>
            </div>
          </div>
        )}

        {/* AI Input Display - Job Analysis */}
        <AIInputDisplay
          title="🔍 Step 1: Job Analysis Input (Sent to AI)"
          content={`=== JOB DESCRIPTION ===\n${jobDescription}\n\n=== EXACT PROMPT USED ===\n${JOB_ANALYSIS_PROMPT.replace('{job_description}', jobDescription)}`}
          defaultExpanded={false}
        />

        {/* AI Input Display - Scoring (only show after scoring starts) */}
        {(scoring || scores) && (
          <AIInputDisplay
            title="📊 Step 2: Profile Scoring Input (Sent to AI)"
            content={`=== JOB REQUIREMENTS ===\n${currentAnalysis?.analysis ? JSON.stringify(currentAnalysis.analysis.requirements, null, 2) : 'Analyzing...'}\n\n=== YOUR FULL PROFILE ===\n${fullProfileText}\n\n=== EXACT PROMPT USED ===\n${SCORING_PROMPT.replace('{job_requirements}', JSON.stringify(currentAnalysis?.analysis?.requirements || {}, null, 2)).replace('{profile_content}', fullProfileText)}`}
            defaultExpanded={false}
          />
        )}

        {/* Job Metadata Display */}
        {currentAnalysis?.success && currentAnalysis.analysis?.job_metadata && (
          <div className="job-metadata-panel">
            <h3>📋 Job Overview</h3>
            <div className="metadata-grid">
              {currentAnalysis.analysis.job_metadata.title && (
                <div className="metadata-item">
                  <span className="metadata-label">Title:</span>
                  <span className="metadata-value">{currentAnalysis.analysis.job_metadata.title}</span>
                </div>
              )}
              {currentAnalysis.analysis.job_metadata.company && (
                <div className="metadata-item">
                  <span className="metadata-label">Company:</span>
                  <span className="metadata-value">{currentAnalysis.analysis.job_metadata.company}</span>
                </div>
              )}
              {currentAnalysis.analysis.job_metadata.seniority_level && (
                <div className="metadata-item">
                  <span className="metadata-label">Seniority:</span>
                  <span className="metadata-value">{currentAnalysis.analysis.job_metadata.seniority_level}</span>
                </div>
              )}
              {currentAnalysis.analysis.job_metadata.location && (
                <div className="metadata-item">
                  <span className="metadata-label">Location:</span>
                  <span className="metadata-value">{currentAnalysis.analysis.job_metadata.location}</span>
                </div>
              )}
              {currentAnalysis.analysis.job_metadata.job_type && (
                <div className="metadata-item">
                  <span className="metadata-label">Type:</span>
                  <span className="metadata-value">{currentAnalysis.analysis.job_metadata.job_type}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model Selection Cards */}
        <div className="model-selection-cards">
          <button
            className={`model-card ${selectedTab === 'openai' ? 'active' : ''} ${scores?.openai?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' : 'verdict-negative'}`}
            onClick={() => setSelectedTab('openai')}
          >
            <div className="model-card-header">
              <div className="model-indicator openai-indicator"></div>
              <div className="model-name">
                <strong>GPT-4o</strong>
                <span className="model-provider">OpenAI</span>
              </div>
            </div>
            {scores?.openai?.scores && (
              <div className="model-card-verdict">
                {scores.openai.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' : '✗ Skip'}
              </div>
            )}
          </button>
          <button
            className={`model-card ${selectedTab === 'claude' ? 'active' : ''} ${scores?.claude?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' : 'verdict-negative'}`}
            onClick={() => setSelectedTab('claude')}
          >
            <div className="model-card-header">
              <div className="model-indicator claude-indicator"></div>
              <div className="model-name">
                <strong>Claude Sonnet 4.5</strong>
                <span className="model-provider">Anthropic</span>
              </div>
            </div>
            {scores?.claude?.scores && (
              <div className="model-card-verdict">
                {scores.claude.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' : '✗ Skip'}
              </div>
            )}
          </button>
        </div>

        {/* Analysis Content */}
        {scoring ? (
          <div className="loading-state">
            <div className="spinner-container">
              <div className="spinner" />
              <div className="spinner-text">Analyzing job requirements and scoring your profile...</div>
              <div className="spinner-subtext">Using {selectedTab === 'openai' ? 'GPT-4o' : 'Claude Sonnet 4.5'}</div>
            </div>
          </div>
        ) : !scores ? (
          <div className="loading-state">
            <div className="spinner-container">
              <div className="spinner" />
              <div className="spinner-text">Preparing analysis...</div>
              <div className="spinner-subtext">This may take a few moments</div>
            </div>
          </div>
        ) : (
          <div className="analysis-content">
            {/* Verdict Banner */}
            {currentScores?.scores?.verdict && (
              <div className={`verdict-banner ${currentScores.scores.verdict === 'SHOULD_APPLY' ? 'positive' : 'negative'}`}>
                <div className="verdict-icon">
                  {currentScores.scores.verdict === 'SHOULD_APPLY' ? '✓' : '✗'}
                </div>
                <div className="verdict-content">
                  <div className="verdict-title">
                    {currentScores.scores.verdict === 'SHOULD_APPLY' ? 'Recommended: Apply' : 'Not Recommended: Skip This One'}
                  </div>
                  <div className="verdict-reasoning">{currentScores.scores.verdict_reasoning}</div>
                </div>
              </div>
            )}

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

                {/* Skills Analysis Grid */}
                <div className="skills-analysis-grid">
                  {currentScores?.scores?.matching_skills?.length > 0 && (
                    <div className="insights-section matching-skills">
                      <h4>✓ Matching Skills</h4>
                      <ul>
                        {currentScores.scores.matching_skills.map((skill, i) => (
                          <li key={i}>{skill}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentScores?.scores?.strengths?.length > 0 && (
                    <div className="insights-section strengths">
                      <h4>💪 Your Strengths</h4>
                      <ul>
                        {currentScores.scores.strengths.map((strength, i) => (
                          <li key={i}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentScores?.scores?.missing_skills?.length > 0 && (
                    <div className="insights-section missing-skills">
                      <h4>⚠️ Missing Skills</h4>
                      <ul>
                        {currentScores.scores.missing_skills.map((skill, i) => (
                          <li key={i}>{skill}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentScores?.scores?.critical_gaps?.length > 0 && (
                    <div className="insights-section critical-gaps">
                      <h4>🚫 Critical Gaps</h4>
                      <ul>
                        {currentScores.scores.critical_gaps.map((gap, i) => (
                          <li key={i}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {currentScores?.scores?.recommendations?.length > 0 && (
                  <div className="insights-section recommendations">
                    <h4>💡 Recommendations</h4>
                    <ul>
                      {currentScores.scores.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
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

function Step3NodeSelection({ jobDescription, profile, jobAnalysis, recommendations, selectedNodes, toggleNodeSelection, selectedModel, applyModelRecommendations, loading, onNext, onBack }) {
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

  // Clean dict - remove null, empty strings, empty arrays (same as backend)
  const cleanDict = (d) => {
    if (!d || typeof d !== 'object') return d;
    if (Array.isArray(d)) return d;

    const cleaned = {};
    for (const [key, value] of Object.entries(d)) {
      // Skip null, empty strings, and empty arrays
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        continue;
      }

      // Recursively clean nested objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedValue = cleanDict(value);
        if (Object.keys(cleanedValue).length > 0) {
          cleaned[key] = cleanedValue;
        }
      }
      // Clean arrays of objects
      else if (Array.isArray(value)) {
        if (value.every(item => typeof item === 'object' && !Array.isArray(item))) {
          const cleanedList = value.map(item => cleanDict(item)).filter(item => Object.keys(item).length > 0);
          if (cleanedList.length > 0) {
            cleaned[key] = cleanedList;
          }
        } else {
          cleaned[key] = value;
        }
      }
      else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  // Convert nodes to the format sent to AI (same as backend does)
  const nodesToAIFormat = (nodes) => {
    if (!nodes || nodes.length === 0) return [];

    const flattenForAI = (nodeList, parentContext = '') => {
      const result = [];
      nodeList.forEach(node => {
        const context = parentContext ? `${parentContext} > ${node.title || 'Untitled'}` : (node.title || 'Untitled');

        const nodeData = {
          id: node.id,
          global_id: node.global_id,
          node_type: node.node_type,
          title: node.title,
          subtitle: node.subtitle,
          content: node.content,
          start_date: node.start_date,
          end_date: node.end_date,
          location: node.location,
          level: node.level || 0,
          context_path: context,
          is_visible: node.is_visible !== false
        };

        // Clean the node data
        const cleanedNode = cleanDict(nodeData);
        result.push(cleanedNode);

        if (node.children && node.children.length > 0) {
          result.push(...flattenForAI(node.children, context));
        }
      });
      return result;
    };

    return flattenForAI(nodes);
  };

  const nodesForAI = nodesToAIFormat(profile?.nodes || []);

  // Get job requirements from analysis and clean it
  const jobRequirements = cleanDict(jobAnalysis?.[selectedModel]?.analysis || {});

  // Exact prompt used by AI
  const NODE_SELECTION_PROMPT = `Given this job description and the candidate's profile nodes, recommend which nodes should be INCLUDED in the tailored CV.

Job Requirements:
{job_requirements}

Profile Nodes (hierarchical structure):
{profile_nodes}

For each node, decide if it should be INCLUDED (visible) or EXCLUDED (hidden) in the tailored CV.
Consider:
- Relevance to the job requirements
- Impact on ATS score
- Demonstrates key skills/experience for this role
- Strengthens the candidate's story for this position

Return JSON with node IDs and selection status:
{
  "selected_nodes": [
    {
      "node_id": "uuid-or-id",
      "global_id": "global-uuid",
      "include": true,
      "confidence": 0.95,
      "reason": "Why this should be included/excluded",
      "relevance_tags": ["tag1", "tag2"]
    },
    ...
  ],
  "selection_summary": {
    "total_nodes": 50,
    "recommended_include": 35,
    "recommended_exclude": 15
  },
  "tailoring_strategy": "Brief explanation of the overall tailoring approach"
}

IMPORTANT: Return recommendations for ALL nodes provided.`;

  // Complete AI input content
  const aiInputContent = `=== JOB REQUIREMENTS (EXTRACTED FROM JOB ANALYSIS) ===
${JSON.stringify(jobRequirements, null, 2)}

=== ALL PROFILE NODES (${nodesForAI.length} nodes) ===
${JSON.stringify(nodesForAI, null, 2)}

=== EXACT PROMPT USED ===
${NODE_SELECTION_PROMPT.replace('{job_requirements}', JSON.stringify(jobRequirements, null, 2)).replace('{profile_nodes}', JSON.stringify(nodesForAI, null, 2))}`;

  return (
    <div className="wizard-step step-3">
      <div className="step-header">
        <h2>✨ Smart Node Selection</h2>
        <p>AI has recommended which items to include. You can adjust selections below.</p>
      </div>

      <div className="step-body">
        {/* AI Input Display */}
        <AIInputDisplay
          title="🔍 Step 3: Node Selection Input (Sent to AI)"
          content={aiInputContent}
          defaultExpanded={false}
        />

        {loading ? (
          <div className="loading-state">
            <div className="spinner-container">
              <div className="spinner" />
              <div className="spinner-text">Getting AI recommendations...</div>
              <div className="spinner-subtext">Analyzing {totalCount} profile nodes</div>
            </div>
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

function Step4SavePreview({ jobTitle, setJobTitle, companyName, setCompanyName, cvStatus, setCvStatus, profile, selectedNodes, scores, jobAnalysis, onSave, saving, onBack }) {
  const selectedCount = selectedNodes.size;

  // AI Summary for display
  const aiSummary = `Analysis Results:\n- OpenAI GPT-4o: Fit ${scores?.openai?.scores?.fit_score || 'N/A'}, ATS ${scores?.openai?.scores?.ats_score || 'N/A'}\n- Claude Sonnet 4.5: Fit ${scores?.claude?.scores?.fit_score || 'N/A'}, ATS ${scores?.claude?.scores?.ats_score || 'N/A'}\n\nSelected ${selectedCount} profile items optimized for this role.`;

  return (
    <div className="wizard-step step-4">
      <div className="step-header">
        <h2>💾 Save Tailored CV</h2>
        <p>Review and save your tailored CV</p>
      </div>

      <div className="step-body">
        {/* AI Analysis Summary */}
        <AIInputDisplay
          title="AI Analysis Summary"
          content={aiSummary}
          defaultExpanded={false}
        />

        {saving && (
          <div className="loading-state">
            <div className="spinner-container">
              <div className="spinner" />
              <div className="spinner-text">Saving your tailored CV...</div>
              <div className="spinner-subtext">Storing analysis and selections</div>
            </div>
          </div>
        )}

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

// ============================================================================
// Reusable AI Input Display Component
// ============================================================================

function AIInputDisplay({ title, content, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="ai-input-section">
      <div
        className="ai-input-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="ai-input-title">
          <span>🤖</span>
          <span>{title}</span>
        </div>
        <div className={`ai-input-toggle ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </div>
      </div>
      {isExpanded && (
        <div className="ai-input-content">
          <pre>{content}</pre>
        </div>
      )}
    </div>
  );
}

export default TailorCV;
