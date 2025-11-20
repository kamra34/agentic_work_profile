import SavedCVsWrapper from '../components/SavedCVsWrapper';

function CVPortfolioPage() {
  return (
    <div className="review-finalize-wrapper">
      <div className="review-header">
        <h1>💼 CV Portfolio</h1>
        <p className="review-subtitle">
          View all your saved tailored CVs. See complete job details, AI fit and ATS scores, and all AI-selected content. Toggle visibility of individual items, recalculate ATS scores based on your final selections, preview your CV in real-time, and download professional PDFs ready for applications.
        </p>
      </div>
      <SavedCVsWrapper />
    </div>
  );
}

export default CVPortfolioPage;
