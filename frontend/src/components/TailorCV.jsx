import { useState, useEffect, useRef } from 'react';
import './TailorCV.css';
import { MOCK_RECOMMENDATIONS_STEP3 } from './mockRecommendations';
import { useAIAnalysis } from '../context/AIAnalysisContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 🧪 TEST MODE: Set to true to use mock data instead of real AI calls
const USE_MOCK_DATA = false;

const STEPS = [
  { id: 1, name: 'Job Details', icon: '📋' },
  { id: 2, name: 'AI Analysis', icon: '🤖' },
  { id: 3, name: 'Smart Selection', icon: '✨' }
];

// Mock data from your actual test run
const MOCK_ANALYSIS_DATA = {
  openai: {
    success: true,
    model: "openai-gpt-5.1",
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
    model: "openai-gpt-5.1",
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

// Mock recommendations data imported from mockRecommendations.js
// This contains actual AI responses captured from production API calls
// Use this for Step 3 UI testing without calling AI APIs

function TailorCV() {
  // Use global AI analysis context
  const {
    currentStep, setCurrentStep,
    jobDescription, setJobDescription,
    jobTitle, setJobTitle,
    companyName, setCompanyName,
    jobAnalysis, setJobAnalysis,
    openaiAnalysis, setOpenaiAnalysis,
    claudeAnalysis, setClaudeAnalysis,
    scores, setScores,
    recommendations, setRecommendations,
    selectedNodes, setSelectedNodes,
    selectedModel, setSelectedModel,
    isAnalyzing, setIsAnalyzing,
    analysisStep, setAnalysisStep,
    analysisProgress, setAnalysisProgress,
    analysisError, setAnalysisError,
    analysisStartTime,
    resetAnalysis,
  } = useAIAnalysis();

  // Local state (not shared globally)
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(USE_MOCK_DATA);
  const [isPreFetching, setIsPreFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvStatus, setCvStatus] = useState('draft');
  const [recommendationsAutoApplied, setRecommendationsAutoApplied] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-trigger scoring when job analysis completes (only once)
  useEffect(() => {
    console.log('[Auto-trigger] Check conditions:', {
      currentStep,
      hasJobAnalysis: !!jobAnalysis,
      hasScores: !!scores,
      analysisStep,
      hasProfile: !!profile
    });

    if (currentStep === 2 && jobAnalysis && !scores && analysisStep !== 'scoring' && profile) {
      const jobReqs = jobAnalysis.openai?.success ? jobAnalysis.openai.analysis : jobAnalysis.claude?.analysis;
      if (jobReqs) {
        console.log('🎯 Auto-triggering score profile');
        handleScoreProfile(jobReqs);
      }
    }
  }, [currentStep, jobAnalysis, scores, analysisStep, profile]);

  // Auto-apply recommendations when they load OR when model changes
  useEffect(() => {
    if (recommendations && profile) {
      console.log('[Auto-apply] Applying recommendations for model:', selectedModel);

      const autoSelected = new Set();

      // Build a map from node id to global_id for quick lookup
      const flattenNodesForMap = (nodes, map = new Map()) => {
        nodes.forEach(node => {
          if (node.id) {
            map.set(node.id, node.global_id);
          }
          if (node.children && node.children.length > 0) {
            flattenNodesForMap(node.children, map);
          }
        });
        return map;
      };
      const idToGlobalIdMap = flattenNodesForMap(profile.nodes || []);

      // Helper function to apply recommendations from a single model
      const applyModelRecs = (modelName, modelRecs) => {
        if (modelRecs && modelRecs.success && modelRecs.recommendations?.selected_nodes) {
          let count = 0;
          modelRecs.recommendations.selected_nodes.forEach(rec => {
            if (rec.include) {
              let globalId = null;
              if (rec.id && idToGlobalIdMap.has(rec.id)) {
                globalId = idToGlobalIdMap.get(rec.id);
              } else if (rec.node_id && idToGlobalIdMap.has(rec.node_id)) {
                globalId = idToGlobalIdMap.get(rec.node_id);
              } else if (rec.global_id) {
                globalId = rec.global_id;
              }

              if (globalId) {
                autoSelected.add(globalId);
                count++;
              }
            }
          });
          console.log(`   ${modelName}: added ${count} nodes`);
          return true;
        }
        return false;
      };

      // Apply recommendations based on selectedModel
      if (selectedModel === 'both') {
        // Combine recommendations from BOTH models (union)
        console.log('[Auto-apply] Combining recommendations from both models...');
        const openaiApplied = applyModelRecs('OpenAI', recommendations.openai);
        const claudeApplied = applyModelRecs('Claude', recommendations.claude);

        if (!openaiApplied && !claudeApplied) {
          console.warn('[Auto-apply] No valid recommendations found from either model');
        }
      } else {
        // Apply recommendations from specific model
        const modelRecs = recommendations[selectedModel];
        const applied = applyModelRecs(selectedModel, modelRecs);

        if (!applied) {
          console.warn(`[Auto-apply] No valid recommendations found for ${selectedModel}`, modelRecs);
        }
      }

      console.log(`[Auto-apply] Selected ${autoSelected.size} nodes total (selectedModel: ${selectedModel})`);
      setSelectedNodes(autoSelected);
    }
  }, [recommendations, profile, selectedModel]);

  const fetchProfile = async () => {
    try {
      console.log('[fetchProfile] Starting profile fetch...');
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profiles = await response.json();

      if (profiles && profiles.length > 0) {
        const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
        console.log('[fetchProfile] Setting profile:', defaultProfile.id);
        setProfile(defaultProfile);
      } else {
        console.warn('[fetchProfile] No profiles found');
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

    // ✅ CACHE CHECK: If we already have analysis, just move to step 2
    if (jobAnalysis) {
      console.log('✅ Using cached job analysis - skipping API call');
      setCurrentStep(2);
      return;
    }

    // Move to Step 2 immediately to show loading state
    setCurrentStep(2);

    // Set global analyzing state for status bar
    setIsAnalyzing(true);
    setAnalysisStep('job-analysis');
    setAnalysisProgress('Analyzing job requirements with OpenAI and Claude...');
    setAnalysisError(null);
    analysisStartTime.current = Date.now();

    // 🧪 TEST MODE: Use mock data instead of API call
    if (useMockData) {
      console.log('🧪 TEST MODE: Using mock analysis data');
      setTimeout(() => {
        setJobAnalysis({ openai: MOCK_ANALYSIS_DATA.openai, claude: MOCK_ANALYSIS_DATA.claude });
        setOpenaiAnalysis(MOCK_ANALYSIS_DATA.openai);
        setClaudeAnalysis(MOCK_ANALYSIS_DATA.claude);

        // Update to scoring step
        setAnalysisStep('scoring');
        setAnalysisProgress('Scoring profile fit...');

        // Auto-trigger scoring with mock data
        setTimeout(() => {
          setScores(MOCK_SCORES_DATA);
          setAnalysisStep('complete');
          setAnalysisProgress('Ready to save! Go to Smart Selection and save your tailored CV.');
          setIsAnalyzing(false);  // Stop the analyzing animation, but keep the complete status
        }, 1000);
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

      // Always show results from both models, even if one failed
      // Only show error if BOTH models failed, but still stay on Step 2
      if (!data.openai?.success && !data.claude?.success) {
        setAnalysisError('Both AI models failed to analyze the job');
        setAnalysisStep('scoring'); // Stay on Step 2 to show error
        setAnalysisProgress('⚠️ Both AI models failed. Review the error and try again.');
        setIsAnalyzing(false);
        // Don't go back to Step 1 - stay on Step 2 to show what happened
      } else {
        // At least one model succeeded - continue with scoring
        console.log('✅ Job analysis complete, waiting for profile to trigger scoring...');
      }
    } catch (error) {
      console.error('Error analyzing job:', error);
      setAnalysisError(error.message);
      // Stay on Step 2 to show error - don't force user back to Step 1
      setAnalysisStep('job-analysis');
      setAnalysisProgress(`⚠️ Error: ${error.message}`);
      setIsAnalyzing(false);
    }
  };

  const handleScoreProfile = async (jobRequirements) => {
    if (!profile || !jobRequirements) {
      console.error('Missing profile or job requirements:', { profile, jobRequirements });
      return;
    }

    // Update global state for status bar
    setAnalysisStep('scoring');
    setAnalysisProgress('Scoring profile fit with AI models...');

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

      // Check if any score is below 75 - if so, stop auto-advance
      const openaiScores = data.openai?.scores;
      const claudeScores = data.claude?.scores;

      const scores = [
        { model: 'OpenAI', type: 'fit', value: openaiScores?.fit_score },
        { model: 'OpenAI', type: 'ATS', value: openaiScores?.ats_score },
        { model: 'Claude', type: 'fit', value: claudeScores?.fit_score },
        { model: 'Claude', type: 'ATS', value: claudeScores?.ats_score }
      ].filter(s => s.value !== undefined && s.value !== null);

      const lowScores = scores.filter(s => s.value < 75);

      if (lowScores.length > 0) {
        // Low scores detected - stop auto-advance and notify user
        console.log('⚠️ Low scores detected, stopping auto-advance:', lowScores);
        setAnalysisStep('complete'); // Changed from 'scoring' to 'complete' so the results are visible
        setAnalysisProgress(`⚠️ Low match scores detected. Review results before continuing.`);
        setIsAnalyzing(false);

        // Format low scores message
        const lowScoreDetails = lowScores.map(s => `${s.model} ${s.type}: ${s.value}`).join(', ');
        console.log(`Low scores: ${lowScoreDetails}`);
        return; // Stop here - don't auto-advance to recommendations
      }

      // All scores are 75 or above - continue with auto-advance
      console.log('✅ Scoring complete, all scores ≥75, auto-triggering recommendations in background...');
      const jobReqs = jobAnalysis.openai?.success ? jobAnalysis.openai.analysis : jobAnalysis.claude?.analysis;
      if (jobReqs && !recommendations) {
        // Start recommendations in background
        handleGetRecommendations(jobReqs, true); // true = background mode
      } else {
        // If recommendations already exist or no job requirements, just end analysis
        setAnalysisStep('complete');
        setAnalysisProgress('Ready to save! Go to Smart Selection and save your tailored CV.');
        setIsAnalyzing(false);  // Stop the analyzing animation, but keep the complete status
      }
    } catch (error) {
      console.error('Error scoring profile:', error);
      setAnalysisError(error.message);
      alert(`Failed to score profile: ${error.message}`);
      setIsAnalyzing(false);
      setAnalysisStep(null);
    }
  };

  const handleGetRecommendations = async (jobRequirements, isBackground = false) => {
    if (!profile || !jobRequirements) {
      console.error('❌ Missing profile or job requirements for recommendations', { profile, jobRequirements });
      return;
    }

    // ✅ CACHE CHECK: If we already have recommendations, skip API call
    if (recommendations) {
      console.log('✅ Using cached recommendations - skipping API call');
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
    }

    // Update global state for status bar
    setAnalysisStep('recommendations');
    setAnalysisProgress('Generating smart recommendations from AI models...');

    // 🧪 Use mock data if test mode is enabled
    if (useMockData) {
      console.log('🧪 TEST MODE: Generating dynamic mock recommendations based on actual profile');
      setTimeout(() => {
        // Generate recommendations for ALL nodes in the current profile
        const allNodes = [];
        const flattenNodes = (nodes) => {
          nodes.forEach(node => {
            allNodes.push(node);
            if (node.children && node.children.length > 0) {
              flattenNodes(node.children);
            }
          });
        };
        flattenNodes(profile?.nodes || []);

        console.log(`📊 Found ${allNodes.length} nodes in profile, generating recommendations...`);

        // Create mock recommendations for each node (80% include, 20% exclude)
        const generateNodeRecommendations = () => {
          return allNodes.map((node, index) => {
            const shouldInclude = Math.random() > 0.2; // 80% chance to include
            const confidence = shouldInclude
              ? 0.75 + (Math.random() * 0.25)  // 75-100% for included
              : 0.5 + (Math.random() * 0.25);   // 50-75% for excluded

            return {
              id: node.id,  // Use actual node ID from profile
              include: shouldInclude,
              confidence: confidence,
              reason: shouldInclude
                ? `This ${node.node_type} is relevant to the job requirements and strengthens the candidate's profile.`
                : `This ${node.node_type} is less critical for this specific role.`,
              relevance_tags: shouldInclude ? ["relevant", node.node_type] : ["optional"]
            };
          });
        };

        const mockRecommendations = {
          openai: {
            success: true,
            model: "openai-gpt-5.1",
            recommendations: {
              selected_nodes: generateNodeRecommendations(),
              selection_summary: {
                total_nodes: allNodes.length,
                recommended_include: Math.floor(allNodes.length * 0.8),
                recommended_exclude: Math.ceil(allNodes.length * 0.2)
              },
              tailoring_strategy: "Mock strategy: Focus on relevant experience and skills for this role."
            }
          },
          claude: {
            success: true,
            model: "claude-sonnet-4.5",
            recommendations: {
              selected_nodes: generateNodeRecommendations(),
              selection_summary: {
                total_nodes: allNodes.length,
                recommended_include: Math.floor(allNodes.length * 0.75),
                recommended_exclude: Math.ceil(allNodes.length * 0.25)
              },
              tailoring_strategy: "Mock strategy: Emphasize technical depth and leadership experience."
            }
          },
          total_nodes: allNodes.length
        };

        console.log('✅ Mock recommendations generated:', {
          total_nodes: allNodes.length,
          openai_included: mockRecommendations.openai.recommendations.selection_summary.recommended_include,
          claude_included: mockRecommendations.claude.recommendations.selection_summary.recommended_include
        });

        setRecommendations(mockRecommendations);

        if (isBackground) {
          console.log('🏁 Background pre-fetch finished - ready for Step 3!');
          setIsPreFetching(false);
        } else {
          console.log('🏁 Recommendations loading finished');
        }

        // Mark analysis as complete for mock data
        setAnalysisStep('complete');
        setAnalysisProgress('Ready to save! Go to Smart Selection and save your tailored CV.');
        setIsAnalyzing(false);  // Stop the analyzing animation, but keep the complete status
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

      const autoSelected = new Set();

      if (selectedModel === 'both') {
        // Combine recommendations from BOTH models (union)
        console.log('   Combining recommendations from both OpenAI and Claude...');

        // Apply OpenAI recommendations
        if (data.openai?.success && data.openai.recommendations?.selected_nodes) {
          let openaiCount = 0;
          data.openai.recommendations.selected_nodes.forEach(node => {
            if (node.include) {
              autoSelected.add(node.global_id || node.node_id);
              openaiCount++;
            }
          });
          console.log(`   OpenAI: added ${openaiCount} nodes`);
        }

        // Apply Claude recommendations
        if (data.claude?.success && data.claude.recommendations?.selected_nodes) {
          let claudeCount = 0;
          data.claude.recommendations.selected_nodes.forEach(node => {
            if (node.include) {
              autoSelected.add(node.global_id || node.node_id);
              claudeCount++;
            }
          });
          console.log(`   Claude: added ${claudeCount} nodes`);
        }

        console.log(`✅ Auto-selected ${autoSelected.size} nodes total (union of both models)`);
      } else {
        // Apply recommendations from specific model only
        const modelRecs = data[selectedModel];
        if (modelRecs && modelRecs.success && modelRecs.recommendations?.selected_nodes) {
          modelRecs.recommendations.selected_nodes.forEach(node => {
            if (node.include) {
              autoSelected.add(node.global_id || node.node_id);
            }
          });
          console.log(`✅ Auto-selected ${autoSelected.size} nodes from ${selectedModel}`);
        } else {
          console.warn(`⚠️ No recommendations found for auto-selection (model: ${selectedModel})`);
        }
      }

      setSelectedNodes(autoSelected);
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
      }

      // Mark analysis as complete - keep status visible until CV is saved
      setAnalysisStep('complete');
      setAnalysisProgress('Ready to save! Go to Smart Selection and save your tailored CV.');
      setIsAnalyzing(false);  // Stop the analyzing animation, but keep the complete status
    }
  };

  // Pre-fetch function - start recommendations in background while user reads Step 2
  const handlePreFetchRecommendations = () => {
    const jobReqs = openaiAnalysis?.success ? openaiAnalysis.analysis : claudeAnalysis?.analysis;
    if (jobReqs && !recommendations && !isPreFetching) {
      handleGetRecommendations(jobReqs, true); // true = background mode
    }
  };

  const handleResetWorkflow = () => {
    if (!confirm('Are you sure you want to start over? All progress will be lost.')) {
      return;
    }

    console.log('🔄 Resetting workflow - clearing all cached data');

    // Reset all state
    setCurrentStep(1);
    setJobAnalysis(null);
    setOpenaiAnalysis(null);
    setClaudeAnalysis(null);
    setScores(null);
    setRecommendations(null);
    setSelectedNodes(new Set());

    // Keep job description, title, and company name for convenience
    // User can edit them if needed

    console.log('✅ Workflow reset complete - back to Step 1');
  };

  const handleSaveTailoredCV = async () => {
    if (!jobTitle) {
      alert('Please enter a job title');
      return;
    }

    if (selectedNodes.size === 0) {
      alert('Please select at least one item to include in your tailored CV');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      console.log('💾 [SAVE] Saving tailored CV with:', {
        job_title: jobTitle,
        company_name: companyName,
        selected_nodes: selectedNodes.size,
        selected_model: selectedModel
      });

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
          selected_node_ids: Array.from(selectedNodes),  // Global IDs of selected nodes
          fit_scores: scores,
          ats_scores: scores,
          recommendations: recommendations,  // Complete AI recommendations
          job_analysis: jobAnalysis,  // Job requirements from both models
          selected_model: selectedModel,  // Which AI model was used for selection
          status: cvStatus
        })
      });

      const data = await response.json();
      if (data.success) {
        const summary = data.summary || {};

        // Store values before reset for the success message
        const savedJobTitle = jobTitle;
        const savedCompanyName = companyName;

        // Clear the green analysis complete status after successful save
        // Use resetAnalysis to properly clear the global status bar
        resetAnalysis();

        // Reset local state
        setCvStatus('draft');
        setRecommendationsAutoApplied(false); // Reset auto-apply flag for next session

        alert(
          `✅ Tailored CV saved successfully!\n\n` +
          `📊 Summary:\n` +
          `• Selected nodes: ${summary.selected_nodes || selectedNodes.size}\n` +
          `• Root sections: ${summary.root_sections || 'N/A'}\n` +
          `• AI model: ${summary.ai_model || selectedModel}\n` +
          `• Job: ${savedJobTitle}${savedCompanyName ? ` at ${savedCompanyName}` : ''}`
        );
        // Could navigate to the tailored CVs list page
      } else {
        throw new Error(data.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving tailored CV:', error);
      alert(`❌ Failed to save tailored CV\n\n${error.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardAnalysis = async () => {
    // Confirm with user before discarding
    const confirmed = window.confirm(
      '🗑️ Discard Analysis?\n\n' +
      'This will clear all AI recommendations and reset the workflow.\n' +
      'You will need to start over from Step 1.\n\n' +
      'Are you sure you want to discard this analysis?'
    );

    if (!confirmed) {
      return;
    }

    console.log('🗑️ [DISCARD] Discarding analysis and resetting workflow');

    // Use the global context reset function to clear everything including the status bar
    resetAnalysis();

    // Reset local state
    setCvStatus('draft');
    setRecommendationsAutoApplied(false); // Reset auto-apply flag for next session

    console.log('✅ Analysis discarded - workflow reset complete');

    alert('✅ Analysis has been discarded.\n\nYou can now start a new CV tailoring session.');
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
    console.log(`[Apply Recommendations] Model: ${model}`);
    setSelectedModel(model);
    const modelRecs = recommendations?.[model];

    if (modelRecs && modelRecs.success && modelRecs.recommendations.selected_nodes) {
      const autoSelected = new Set();

      // Build a map from node id to global_id for quick lookup
      const flattenNodesForMap = (nodes, map = new Map()) => {
        nodes.forEach(node => {
          if (node.id) {
            map.set(node.id, node.global_id);
          }
          if (node.children && node.children.length > 0) {
            flattenNodesForMap(node.children, map);
          }
        });
        return map;
      };
      const idToGlobalIdMap = flattenNodesForMap(profile?.nodes || []);
      console.log(`[Apply Recommendations] Built map with ${idToGlobalIdMap.size} nodes`);

      // Apply recommendations
      let includedCount = 0;
      let matchedCount = 0;
      modelRecs.recommendations.selected_nodes.forEach(rec => {
        if (rec.include) {
          includedCount++;
          // Try to match by: id (new format), node_id (old format), or global_id (fallback)
          let globalId = null;
          if (rec.id && idToGlobalIdMap.has(rec.id)) {
            globalId = idToGlobalIdMap.get(rec.id);
            matchedCount++;
          } else if (rec.node_id && idToGlobalIdMap.has(rec.node_id)) {
            globalId = idToGlobalIdMap.get(rec.node_id);
            matchedCount++;
          } else if (rec.global_id) {
            globalId = rec.global_id;
            matchedCount++;
          }

          if (globalId) {
            autoSelected.add(globalId);
          } else {
            console.warn(`[Apply Recommendations] Could not match rec:`, rec);
          }
        }
      });

      console.log(`[Apply Recommendations] Included: ${includedCount}, Matched: ${matchedCount}, Selected: ${autoSelected.size}`);
      setSelectedNodes(autoSelected);
    } else {
      console.warn('[Apply Recommendations] No valid recommendations found for model:', model);
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
      {/* Floating Step Indicator - Now moved to global status bar */}

      {/* Progress Bar */}
      <div className="wizard-header">
        <div className="header-top">
          <h1>Create Tailored CV</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Reset Button - only show if not on step 1 */}
            {currentStep > 1 && (
              <button
                onClick={handleResetWorkflow}
                className="btn-reset-workflow"
                title="Start over with a new job"
              >
                🔄 Start Over
              </button>
            )}
            {/* Test Mode Toggle */}
            <label className="mock-data-toggle">
              <input
                type="checkbox"
                checked={useMockData}
                onChange={(e) => setUseMockData(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                🧪 Test Mode
              </span>
            </label>
          </div>
        </div>
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
            analyzing={isAnalyzing}
            useMockData={useMockData}
          />
        )}

        {currentStep === 2 && (
          <Step2AIAnalysis
            jobDescription={jobDescription}
            openaiAnalysis={openaiAnalysis}
            claudeAnalysis={claudeAnalysis}
            scores={scores}
            scoring={analysisStep === 'scoring'}
            profile={profile}
            recommendations={recommendations}
            isPreFetching={isPreFetching}
            onPreFetch={handlePreFetchRecommendations}
            onNext={async () => {
              // Move to step 3 and trigger recommendations if not already loaded
              setCurrentStep(3);
              if (!recommendations && analysisStep !== 'recommendations') {
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
            jobTitle={jobTitle}
            companyName={companyName}
            jobDescription={jobDescription}
            profile={profile}
            scores={scores}
            jobAnalysis={jobAnalysis}
            recommendations={recommendations}
            selectedNodes={selectedNodes}
            toggleNodeSelection={toggleNodeSelection}
            selectedModel={selectedModel}
            applyModelRecommendations={applyModelRecommendations}
            loading={analysisStep === 'recommendations'}
            onSave={handleSaveTailoredCV}
            onDiscard={handleDiscardAnalysis}
            saving={saving}
            onBack={() => setCurrentStep(2)}
            recommendationsAutoApplied={recommendationsAutoApplied}
            setRecommendationsAutoApplied={setRecommendationsAutoApplied}
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

function Step1JobDetails({ jobDescription, setJobDescription, jobTitle, setJobTitle, companyName, setCompanyName, onNext, analyzing, useMockData }) {
  const [inputMethod, setInputMethod] = useState('paste'); // 'paste' or 'url'
  const [jobUrl, setJobUrl] = useState('');
  const [hasFilledTestData, setHasFilledTestData] = useState(false);

  const wordCount = jobDescription.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isValidLength = jobDescription.length >= 50;
  const hasRequiredFields = jobTitle.trim().length > 0 && isValidLength;

  // Auto-fill test data when test mode is enabled
  useEffect(() => {
    if (useMockData && !hasFilledTestData) {
      setJobTitle('Lead Data Scientist - AI/ML Platform');
      setCompanyName('Tech Company');
      setJobDescription(`Lead Data Scientist - AI/ML Platform

We are seeking an experienced Lead Data Scientist to join our AI/ML Platform team. You will lead the development of production-scale machine learning systems and mentor a team of data scientists and ML engineers.

Key Responsibilities:
• Lead development and deployment of production ML systems at scale
• Mentor and manage a team of data scientists and ML engineers
• Design and implement MLOps infrastructure and best practices
• Collaborate with cross-functional stakeholders to drive technical strategy
• Build and optimize retrieval systems for large-scale document processing
• Establish experiment tracking, model monitoring, and rollback strategies

Must-Have Requirements:
• Advanced degree in quantitative field (PhD/MS in Computer Science, Statistics, or related)
• 6-10+ years experience in Data Science/ML/AI
• 2+ years leading teams or programs
• Hands-on expertise with Python and SQL
• Production experience with AWS (Bedrock, SageMaker, Lambda, Step Functions)
• Deep experience with retrieval systems, vector indexes, and chunking strategies
• MLOps fluency: containers, CI/CD, experiment tracking, model monitoring
• Strong communication and technical writing skills
• Evidence-based decision making and ability to defend technical choices

Nice-to-Have:
• Experience with R or MATLAB
• Familiarity with other cloud platforms (Azure, GCP)
• Published research in ML/AI

We offer competitive compensation, remote flexibility, and the opportunity to work on cutting-edge AI solutions with real business impact.`);
      setHasFilledTestData(true);
      console.log('🧪 Test data auto-filled');
    } else if (!useMockData && hasFilledTestData) {
      // Clear data when test mode is disabled
      setJobTitle('');
      setCompanyName('');
      setJobDescription('');
      setHasFilledTestData(false);
      console.log('🧪 Test data cleared');
    }
  }, [useMockData, hasFilledTestData, setJobTitle, setCompanyName, setJobDescription]);

  return (
    <div className="wizard-step step-1-modern">
      <div className="step-1-container">
        {/* Left Panel - Visual Info */}
        <div className="info-panel">
          <div className="info-content">
            <div className="info-icon">🎯</div>
            <h2>AI-Powered CV Tailoring</h2>
            <p className="info-subtitle">Get your CV optimized for this specific role</p>

            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <div className="feature-text">
                  <strong>Dual AI Analysis</strong>
                  <span>OpenAI & Claude working in parallel</span>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✨</span>
                <div className="feature-text">
                  <strong>Smart Selection</strong>
                  <span>AI recommends what to include/exclude</span>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <div className="feature-text">
                  <strong>ATS Optimization</strong>
                  <span>Maximize your compatibility score</span>
                </div>
              </div>
            </div>

            <div className="stats-box">
              <div className="stat-item">
                <div className="stat-value">2x</div>
                <div className="stat-label">Faster with AI</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">95%</div>
                <div className="stat-label">Match Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="form-panel">
          <div className="form-panel-header">
            <h3>Job Details</h3>
            <p>Tell us about the position you're applying for</p>
          </div>

          <div className="form-panel-body">
            {/* Job Title */}
            <div className="modern-form-group">
              <label className="modern-label">
                <span className="label-text">Job Title</span>
                <span className="label-required">*</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Senior Data Scientist"
                className="modern-input"
              />
            </div>

            {/* Company Name */}
            <div className="modern-form-group">
              <label className="modern-label">
                <span className="label-text">Company Name</span>
                <span className="label-optional">(optional)</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Amazon, Google, Microsoft..."
                className="modern-input"
              />
            </div>

            {/* Input Method Toggle */}
            <div className="modern-form-group">
              <label className="modern-label">
                <span className="label-text">Job Description</span>
                <span className="label-required">*</span>
              </label>

              <div className="input-method-toggle">
                <button
                  className={`toggle-btn ${inputMethod === 'paste' ? 'active' : ''}`}
                  onClick={() => setInputMethod('paste')}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Paste Text
                </button>
                <button
                  className={`toggle-btn ${inputMethod === 'url' ? 'active' : ''}`}
                  onClick={() => setInputMethod('url')}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  From URL
                </button>
              </div>

              {inputMethod === 'paste' ? (
                <>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the complete job description here...&#10;&#10;Include responsibilities, requirements, qualifications, and any other relevant details."
                    className="modern-textarea"
                    rows={12}
                  />
                  <div className="input-meta">
                    <div className="meta-info">
                      <span className="meta-item">
                        {jobDescription.length} characters
                      </span>
                      <span className="meta-separator">•</span>
                      <span className="meta-item">
                        ~{wordCount} words
                      </span>
                    </div>
                    {!isValidLength && jobDescription.length > 0 && (
                      <span className="meta-warning">
                        Minimum 50 characters required
                      </span>
                    )}
                    {isValidLength && (
                      <span className="meta-success">
                        ✓ Ready to analyze
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="url-input-wrapper">
                    <span className="url-icon">🔗</span>
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://careers.company.com/job/12345"
                      className="modern-input url-input"
                      disabled
                    />
                  </div>
                  <div className="coming-soon-badge">
                    🚧 Coming Soon - URL import will be available in next update
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="form-panel-footer">
            <button
              className="btn-analyze-modern"
              onClick={onNext}
              disabled={analyzing || !hasRequiredFields || inputMethod === 'url'}
            >
              {analyzing ? (
                <>
                  <span className="btn-spinner">⏳</span>
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <span>Start AI Analysis</span>
                  <span className="btn-arrow">→</span>
                </>
              )}
            </button>
            {!hasRequiredFields && (
              <p className="validation-hint">
                Please fill in job title and description to continue
              </p>
            )}
          </div>
        </div>
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

  // Debug logging
  console.log('Step2AIAnalysis Debug:', {
    selectedTab,
    currentAnalysis: currentAnalysis ? {
      success: currentAnalysis.success,
      hasAnalysis: !!currentAnalysis.analysis,
      analysisKeys: currentAnalysis.analysis ? Object.keys(currentAnalysis.analysis) : null,
      model: currentAnalysis.model
    } : null,
    currentScores: currentScores ? {
      success: currentScores.success,
      hasScores: !!currentScores.scores,
      scoresKeys: currentScores.scores ? Object.keys(currentScores.scores) : null,
      verdict: currentScores.scores?.verdict,
      model: currentScores.model
    } : null,
    renderCondition: !!(currentAnalysis?.success && currentAnalysis.analysis)
  });

  // Log the full objects for deeper inspection
  if (currentAnalysis) {
    console.log('Full currentAnalysis:', currentAnalysis);
  }
  if (currentScores) {
    console.log('Full currentScores:', currentScores);
  }

  // Helper functions for model info display
  const getModelDisplayName = (analysisOrScore) => {
    if (!analysisOrScore) return 'Loading...';
    const model = analysisOrScore.model || '';

    if (model.includes('gpt-5.1') || model.includes('gpt5.1')) return 'GPT-5.1 Thinking';
    if (model.includes('gpt-4o')) return 'GPT-4o';
    if (model.includes('claude')) return 'Claude Sonnet 4.5';

    return model || 'AI Model';
  };

  const hasReasoningTokens = (analysisOrScore) => {
    return analysisOrScore?.reasoning_tokens && analysisOrScore.reasoning_tokens > 0;
  };

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

        {/* Low Score Warning - if any score is below 75 */}
        {scores && !recommendations && (() => {
          const openaiScores = scores.openai?.scores;
          const claudeScores = scores.claude?.scores;
          const allScores = [
            { model: 'OpenAI', type: 'Fit', value: openaiScores?.fit_score },
            { model: 'OpenAI', type: 'ATS', value: openaiScores?.ats_score },
            { model: 'Claude', type: 'Fit', value: claudeScores?.fit_score },
            { model: 'Claude', type: 'ATS', value: claudeScores?.ats_score }
          ].filter(s => s.value !== undefined && s.value !== null);

          const lowScores = allScores.filter(s => s.value < 75);

          if (lowScores.length === 0) return null;

          return (
            <div className="low-score-warning">
              <span className="low-score-icon">⚠️</span>
              <div className="low-score-text">
                <strong>Low Match Scores Detected</strong>
                <p>Some scores are below 75, indicating a weaker match for this role:</p>
                <ul className="low-score-list">
                  {lowScores.map((s, i) => (
                    <li key={i}>{s.model} {s.type} Score: {s.value}/100</li>
                  ))}
                </ul>
                <p><strong>Options:</strong></p>
                <ul>
                  <li>Review the analysis below and decide if you still want to apply</li>
                  <li>Click "Continue to Selection" to proceed anyway and customize your CV</li>
                  <li>Click "Start Over" to skip and run a new job</li>
                </ul>
              </div>
            </div>
          );
        })()}

        {/* AI Input Display - Job Analysis */}
        <AIInputDisplay
          title="🔍 Step 1: Job Analysis Input (Sent to AI)"
          content={currentAnalysis?.prompt_sent || 'Analyzing...'}
          defaultExpanded={false}
        />

        {/* AI Input Display - Scoring (only show after scoring starts) */}
        {(scoring || scores) && (
          <AIInputDisplay
            title="📊 Step 2: Profile Scoring Input (Sent to AI)"
            content={scores?.openai?.prompt_sent || scores?.claude?.prompt_sent || 'Analyzing...'}
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
            className={`model-card ${selectedTab === 'openai' ? 'active' : ''} ${
              scores?.openai?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' :
              scores?.openai?.scores?.verdict === 'CONSIDER_APPLYING' ? 'verdict-neutral' :
              'verdict-negative'
            }`}
            onClick={() => setSelectedTab('openai')}
          >
            <div className="model-card-header">
              <div className="model-indicator openai-indicator"></div>
              <div className="model-name">
                <strong>{getModelDisplayName(scores?.openai || openaiAnalysis)}</strong>
                <span className="model-provider">
                  OpenAI
                  {hasReasoningTokens(scores?.openai || openaiAnalysis) && (
                    <span className="reasoning-badge" title={`Used ${(scores?.openai || openaiAnalysis)?.reasoning_tokens} reasoning tokens`}>
                      🧠 {(scores?.openai || openaiAnalysis)?.reasoning_tokens}
                    </span>
                  )}
                </span>
              </div>
            </div>
            {scores?.openai?.scores && (
              <div className="model-card-verdict">
                {scores.openai.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' :
                 scores.openai.scores.verdict === 'CONSIDER_APPLYING' ? '⚠ Consider' :
                 '✗ Skip'}
              </div>
            )}
          </button>
          <button
            className={`model-card ${selectedTab === 'claude' ? 'active' : ''} ${
              scores?.claude?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' :
              scores?.claude?.scores?.verdict === 'CONSIDER_APPLYING' ? 'verdict-neutral' :
              'verdict-negative'
            }`}
            onClick={() => setSelectedTab('claude')}
          >
            <div className="model-card-header">
              <div className="model-indicator claude-indicator"></div>
              <div className="model-name">
                <strong>{getModelDisplayName(scores?.claude || claudeAnalysis)}</strong>
                <span className="model-provider">Anthropic</span>
              </div>
            </div>
            {scores?.claude?.scores && (
              <div className="model-card-verdict">
                {scores.claude.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' :
                 scores.claude.scores.verdict === 'CONSIDER_APPLYING' ? '⚠ Consider' :
                 '✗ Skip'}
              </div>
            )}
          </button>
        </div>

        {/* Analysis Content */}
        {console.log('🔍 Analysis Content Conditional:', { scoring, hasScores: !!scores, scoresKeys: scores ? Object.keys(scores) : null })}
        {scoring ? (
          <div className="loading-state">
            <div className="model-activity-logs">
              <div className="activity-log-card openai-activity">
                <div className="activity-header">
                  <span className="activity-icon">🔵</span>
                  <strong>{getModelDisplayName(openaiAnalysis) || 'OpenAI'}</strong>
                </div>
                <div className="activity-status">
                  <div className="spinner-small" />
                  <span>Analyzing job requirements and scoring profile...</span>
                </div>
                <div className="activity-detail">⏱️ Typically takes 5-10 seconds</div>
              </div>
              <div className="activity-log-card claude-activity">
                <div className="activity-header">
                  <span className="activity-icon">🔷</span>
                  <strong>Claude Sonnet 4.5</strong>
                </div>
                <div className="activity-status">
                  <div className="spinner-small" />
                  <span>Analyzing job requirements and scoring profile...</span>
                </div>
                <div className="activity-detail">⏱️ Typically takes 3-7 seconds</div>
              </div>
            </div>
          </div>
        ) : !scores ? (
          <div className="loading-state">
            <div className="model-activity-logs">
              <div className="activity-log-card openai-activity">
                <div className="activity-header">
                  <span className="activity-icon">🔵</span>
                  <strong>{getModelDisplayName(openaiAnalysis) || 'OpenAI'}</strong>
                </div>
                <div className="activity-status">
                  <div className="spinner-small" />
                  <span>Preparing analysis...</span>
                </div>
              </div>
              <div className="activity-log-card claude-activity">
                <div className="activity-header">
                  <span className="activity-icon">🔷</span>
                  <strong>Claude Sonnet 4.5</strong>
                </div>
                <div className="activity-status">
                  <div className="spinner-small" />
                  <span>Preparing analysis...</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="analysis-content">
            {/* Verdict Banner */}
            {currentScores?.scores?.verdict && (
              <div className={`verdict-banner ${
                currentScores.scores.verdict === 'SHOULD_APPLY' ? 'positive' :
                currentScores.scores.verdict === 'CONSIDER_APPLYING' ? 'neutral' :
                'negative'
              }`}>
                <div className="verdict-icon">
                  {currentScores.scores.verdict === 'SHOULD_APPLY' ? '✓' :
                   currentScores.scores.verdict === 'CONSIDER_APPLYING' ? '⚠' :
                   '✗'}
                </div>
                <div className="verdict-content">
                  <div className="verdict-title">
                    {currentScores.scores.verdict === 'SHOULD_APPLY' ? 'Recommended: Apply' :
                     currentScores.scores.verdict === 'CONSIDER_APPLYING' ? 'Mixed: Consider Applying' :
                     'Not Recommended: Skip This One'}
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
            {console.log('Requirements panel check:', {
              hasCurrentAnalysis: !!currentAnalysis,
              analysisSuccess: currentAnalysis?.success,
              hasAnalysisData: !!currentAnalysis?.analysis,
              conditionMet: !!(currentAnalysis?.success && currentAnalysis.analysis)
            })}
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
                  {console.log('Rendering skills grid:', {
                    hasMatching: currentScores?.scores?.matching_skills?.length,
                    hasStrengths: currentScores?.scores?.strengths?.length,
                    hasMissing: currentScores?.scores?.missing_skills?.length,
                    hasCritical: currentScores?.scores?.critical_gaps?.length,
                    hasRec: currentScores?.scores?.recommendations?.length
                  })}
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

function Step3NodeSelection({ jobTitle, companyName, jobDescription, profile, scores, jobAnalysis, recommendations, selectedNodes, toggleNodeSelection, selectedModel, applyModelRecommendations, loading, onSave, onDiscard, saving, onBack, recommendationsAutoApplied, setRecommendationsAutoApplied }) {
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

  // Auto-apply recommendations when component first loads with valid recommendations
  useEffect(() => {
    // Only auto-apply if:
    // 1. We have recommendations available
    // 2. Recommendations haven't been auto-applied yet
    // 3. We're not currently loading
    if (recommendations && !recommendationsAutoApplied && !loading) {
      console.log('[Step3 Auto-Apply] Auto-applying recommendations on load');
      console.log('[Step3 Auto-Apply] Selected model:', selectedModel);

      // Determine which model to auto-apply based on availability
      let modelToApply = selectedModel;

      // If selectedModel is 'both' or invalid, default to first available model
      if (selectedModel === 'both' || !recommendations[selectedModel]?.success) {
        if (recommendations.openai?.success) {
          modelToApply = 'openai';
          console.log('[Step3 Auto-Apply] Defaulting to OpenAI (first available)');
        } else if (recommendations.claude?.success) {
          modelToApply = 'claude';
          console.log('[Step3 Auto-Apply] Defaulting to Claude (OpenAI not available)');
        }
      }

      // Apply recommendations from the determined model
      if (recommendations[modelToApply]?.success) {
        console.log(`[Step3 Auto-Apply] Applying ${modelToApply} recommendations automatically`);
        applyModelRecommendations(modelToApply);
        setRecommendationsAutoApplied(true); // Mark as auto-applied
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations, loading, recommendationsAutoApplied]); // Run when recommendations, loading, or auto-applied state changes

  // Download recommendations as JSON for mock data
  const downloadRecommendations = () => {
    if (!recommendations) {
      console.warn('No recommendations to download');
      return;
    }

    const dataStr = JSON.stringify(recommendations, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `step3_recommendations_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('✅ Recommendations downloaded successfully');
  };

  // Save tailored CV to database
  const handleSave = () => {
    if (!profile || !jobTitle || !recommendations) {
      alert('Missing required data. Please complete all steps.');
      return;
    }

    if (selectedNodes.size === 0) {
      alert('Please select at least one item to include in your tailored CV.');
      return;
    }

    onSave();
  };

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

  // Convert nodes to minimal format for AI (reduce token usage by ~30-40%)
  // Only send: id (primary key) + content fields
  // Remove: global_id, node_type, level, context_path, is_visible
  const nodesToAIFormat = (nodes) => {
    if (!nodes || nodes.length === 0) return [];

    const flattenForAI = (nodeList) => {
      const result = [];
      nodeList.forEach(node => {
        const nodeData = {
          id: node.id,           // Primary key - absolutely unique identifier
          title: node.title,
          subtitle: node.subtitle,
          content: node.content,
          start_date: node.start_date,
          end_date: node.end_date,
          location: node.location
        };

        // Clean the node data (remove null/empty values)
        const cleanedNode = cleanDict(nodeData);
        result.push(cleanedNode);

        if (node.children && node.children.length > 0) {
          result.push(...flattenForAI(node.children));
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

Profile Nodes:
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
      "id": 123,
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

IMPORTANT:
- Use the "id" field from each node (not node_id or global_id)
- Return recommendations for ALL nodes provided
- The "id" is the database primary key - use it exactly as provided`;

  // Get the exact prompt that was sent to the AI from the backend response
  const aiInputContent = recommendations?.openai?.prompt_sent || recommendations?.claude?.prompt_sent || 'Loading recommendations...';

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

              {/* Action buttons */}
              {recommendations && (
                <div className="action-buttons">
                  <button
                    className="btn-download-recommendations"
                    onClick={downloadRecommendations}
                    title="Download AI recommendations as JSON for debugging"
                  >
                    <span className="btn-icon">📥</span>
                    <span className="btn-text">Download Data</span>
                  </button>
                  <button
                    className="btn-discard-analysis"
                    onClick={onDiscard}
                    disabled={saving}
                    title="Discard this analysis and start over"
                  >
                    <span className="btn-icon">🗑️</span>
                    <span className="btn-text">Discard Analysis</span>
                  </button>
                  <button
                    className="btn-save-tailored-cv"
                    onClick={handleSave}
                    disabled={saving || selectedNodes.size === 0}
                    title="Save this tailored CV to your account"
                  >
                    <span className="btn-icon">{saving ? '⏳' : '💾'}</span>
                    <span className="btn-text">{saving ? 'Saving...' : 'Save Tailored CV'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Node List - Two Column Layout */}
            <div className="nodes-list-two-column">
              {allNodes.map(node => {
                const isSelected = selectedNodes.has(node.global_id);
                // Find AI recommendation for this node
                // Match by database id (primary key) first, then try other formats for backward compatibility
                const modelRec = recommendations?.[selectedModel]?.recommendations?.selected_nodes?.find(
                  rec => {
                    // Primary match: database id (number)
                    if (rec.id === node.id) return true;
                    // Fallback for old format: node_id or global_id
                    if (rec.node_id === node.id || rec.global_id === node.global_id) return true;
                    return false;
                  }
                );

                return (
                  <div
                    key={node.global_id || node.id}
                    className={`node-item-row ${isSelected ? 'selected' : ''} ${modelRec?.include ? 'recommended' : ''}`}
                  >
                    {/* Left Column: Node Content */}
                    <div className="node-content-column" onClick={() => toggleNodeSelection(node.global_id)}>
                      <div className="node-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleNodeSelection(node.global_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="node-info">
                        <div className="node-header">
                          <span className="node-type-badge">{node.node_type}</span>
                          <span className="node-title">
                            {node.node_type === 'bullet' || node.node_type === 'paragraph'
                              ? (node.content || 'Empty')
                              : (node.title || 'Untitled')}
                          </span>
                        </div>
                        {node.subtitle && <div className="node-subtitle">{node.subtitle}</div>}
                      </div>
                    </div>

                    {/* Right Column: AI Recommendation */}
                    <div className="node-ai-column">
                      {modelRec ? (
                        <div className={`ai-recommendation ${modelRec.include ? 'recommend-include' : 'recommend-exclude'}`}>
                          <div className="ai-rec-header">
                            <strong>{modelRec.include ? '✓ Include' : '✗ Exclude'}</strong>
                            {modelRec.confidence && (
                              <span className="confidence">{Math.round(modelRec.confidence * 100)}%</span>
                            )}
                          </div>
                          {modelRec.reason && (
                            <div className="ai-rec-reason">{modelRec.reason}</div>
                          )}
                          {modelRec.relevance_tags && modelRec.relevance_tags.length > 0 && (
                            <div className="ai-rec-tags">
                              {modelRec.relevance_tags.map((tag, idx) => (
                                <span key={idx} className="tag">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="ai-no-recommendation">No AI recommendation</div>
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
          ← Back to Analysis
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
  const aiSummary = `Analysis Results:\n- OpenAI GPT-5.1: Fit ${scores?.openai?.scores?.fit_score || 'N/A'}, ATS ${scores?.openai?.scores?.ats_score || 'N/A'}\n- Claude Sonnet 4.5: Fit ${scores?.claude?.scores?.fit_score || 'N/A'}, ATS ${scores?.claude?.scores?.ats_score || 'N/A'}\n\nSelected ${selectedCount} profile items optimized for this role.`;

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
