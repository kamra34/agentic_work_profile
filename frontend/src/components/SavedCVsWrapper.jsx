import { useState } from 'react';
import SavedCVs from './SavedCVs';
import SavedCVDetail from './SavedCVDetail';

/**
 * Wrapper component to handle navigation between SavedCVs list and detail views
 * without React Router (for simple tab-based navigation in Dashboard)
 */
function SavedCVsWrapper() {
  const [selectedCvId, setSelectedCvId] = useState(null);

  // Custom navigate function that mimics React Router's useNavigate
  const navigate = (path) => {
    if (path === '/saved-cvs' || !path) {
      setSelectedCvId(null);
    } else if (path.startsWith('/saved-cvs/')) {
      const cvId = path.split('/').pop();
      setSelectedCvId(cvId);
    }
  };

  // If a CV is selected, show detail view
  if (selectedCvId) {
    return <SavedCVDetail cvId={selectedCvId} onBack={() => setSelectedCvId(null)} />;
  }

  // Otherwise show list view
  return <SavedCVs onSelectCV={(cvId) => setSelectedCvId(cvId)} />;
}

export default SavedCVsWrapper;
