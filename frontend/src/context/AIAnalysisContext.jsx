import { createContext, useContext, useState, useRef } from 'react';

const AIAnalysisContext = createContext(null);

export function AIAnalysisProvider({ children }) {
  // Job details
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Analysis results
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [openaiAnalysis, setOpenaiAnalysis] = useState(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState(null);
  const [scores, setScores] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(null); // 'job-analysis' | 'scoring' | 'recommendations' | 'complete'
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisError, setAnalysisError] = useState(null);

  // Keep track of current step in TailorCV workflow
  const [currentStep, setCurrentStep] = useState(1);

  // Track selected nodes
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  // Track which model is selected
  const [selectedModel, setSelectedModel] = useState('both');

  // Track analysis start time
  const analysisStartTime = useRef(null);

  // Reset all analysis data
  const resetAnalysis = () => {
    setJobAnalysis(null);
    setOpenaiAnalysis(null);
    setClaudeAnalysis(null);
    setScores(null);
    setRecommendations(null);
    setIsAnalyzing(false);
    setAnalysisStep(null);
    setAnalysisProgress('');
    setAnalysisError(null);
    setCurrentStep(1);
    setSelectedNodes(new Set());
    setSelectedModel('both');
    analysisStartTime.current = null;
  };

  // Reset only job details (keep analysis if running)
  const resetJobDetails = () => {
    if (!isAnalyzing) {
      setJobDescription('');
      setJobTitle('');
      resetAnalysis();
    }
  };

  // Get elapsed time for analysis
  const getElapsedTime = () => {
    if (!analysisStartTime.current) return 0;
    return Math.floor((Date.now() - analysisStartTime.current) / 1000);
  };

  // Check if analysis is in progress
  const hasActiveAnalysis = () => {
    return isAnalyzing || analysisStep !== null;
  };

  // Check if analysis is complete
  const isAnalysisComplete = () => {
    return analysisStep === 'complete' && recommendations !== null;
  };

  const value = {
    // Job details
    jobDescription,
    setJobDescription,
    jobTitle,
    setJobTitle,
    companyName,
    setCompanyName,

    // Analysis results
    jobAnalysis,
    setJobAnalysis,
    openaiAnalysis,
    setOpenaiAnalysis,
    claudeAnalysis,
    setClaudeAnalysis,
    scores,
    setScores,
    recommendations,
    setRecommendations,

    // Analysis state
    isAnalyzing,
    setIsAnalyzing,
    analysisStep,
    setAnalysisStep,
    analysisProgress,
    setAnalysisProgress,
    analysisError,
    setAnalysisError,

    // Workflow state
    currentStep,
    setCurrentStep,
    selectedNodes,
    setSelectedNodes,
    selectedModel,
    setSelectedModel,

    // Helper functions
    resetAnalysis,
    resetJobDetails,
    getElapsedTime,
    hasActiveAnalysis,
    isAnalysisComplete,
    analysisStartTime,
  };

  return (
    <AIAnalysisContext.Provider value={value}>
      {children}
    </AIAnalysisContext.Provider>
  );
}

export function useAIAnalysis() {
  const context = useContext(AIAnalysisContext);
  if (!context) {
    throw new Error('useAIAnalysis must be used within AIAnalysisProvider');
  }
  return context;
}
