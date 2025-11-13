import { useState, useEffect } from 'react';
import { useAIAnalysis } from '../context/AIAnalysisContext';
import './GlobalAIStatusBar.css';

function GlobalAIStatusBar() {
  const {
    isAnalyzing,
    analysisStep,
    analysisProgress,
    analysisError,
    getElapsedTime,
    jobTitle,
    jobDescription,
  } = useAIAnalysis();

  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second when analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(getElapsedTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnalyzing, getElapsedTime]);

  // Don't show if not analyzing (but show complete state briefly)
  if (!isAnalyzing && !analysisError && analysisStep !== 'complete') {
    return null;
  }

  const getStepNumber = () => {
    switch (analysisStep) {
      case 'job-analysis':
        return { current: 1, total: 3 };
      case 'scoring':
        return { current: 2, total: 3 };
      case 'recommendations':
        return { current: 3, total: 3 };
      case 'complete':
        return { current: 3, total: 3, complete: true };
      default:
        return { current: 1, total: 3 };
    }
  };

  const getStepLabel = () => {
    switch (analysisStep) {
      case 'job-analysis':
        return 'Analyzing Job Requirements';
      case 'scoring':
        return 'Scoring Profile Fit';
      case 'recommendations':
        return 'Generating Smart Recommendations';
      case 'complete':
        return 'Analysis Complete';
      default:
        return 'Processing';
    }
  };

  const getJobDisplayName = () => {
    if (jobTitle) return jobTitle;
    if (jobDescription) {
      // Extract first line or first 50 chars
      const firstLine = jobDescription.split('\n')[0];
      return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }
    return 'Current Job';
  };

  const stepInfo = getStepNumber();
  const isComplete = analysisStep === 'complete';

  return (
    <div className={`global-ai-status-bar ${analysisError ? 'error' : ''} ${isComplete ? 'complete' : ''}`}>
      <div className="status-bar-content">
        <div className="status-left">
          {isAnalyzing && !analysisError && (
            <>
              <div className="status-spinner"></div>
              <div className="step-indicator">
                <div className="step-circle">
                  {stepInfo.current}/{stepInfo.total}
                </div>
              </div>
              <div className="status-text">
                <div className="status-label">🤖 AI Analysis Running</div>
                <div className="status-detail">
                  {getStepLabel()} • {getJobDisplayName()}
                </div>
              </div>
            </>
          )}
          {isComplete && !analysisError && (
            <>
              <div className="status-complete-icon">✓</div>
              <div className="step-indicator">
                <div className="step-circle complete">
                  {stepInfo.current}/{stepInfo.total}
                </div>
              </div>
              <div className="status-text">
                <div className="status-label">✅ Analysis Complete!</div>
                <div className="status-detail">
                  Remember to go to Smart Selection and save your tailored CV
                </div>
              </div>
            </>
          )}
          {analysisError && (
            <>
              <div className="status-error-icon">⚠️</div>
              <div className="status-text">
                <div className="status-label">Analysis Error</div>
                <div className="status-detail">{analysisError}</div>
              </div>
            </>
          )}
        </div>

        <div className="status-right">
          {isAnalyzing && (
            <div className="status-timer">
              {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
            </div>
          )}
          {analysisProgress && !isComplete && (
            <div className="status-progress-text">{analysisProgress}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalAIStatusBar;
