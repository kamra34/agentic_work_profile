import { useState, useEffect, useCallback, useRef } from 'react';
import './PDFTemplateSelector.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Template thumbnail SVG components
const TemplateThumbnail = ({ template }) => {
  const thumbnails = {
    professional: (
      <svg viewBox="0 0 200 260" className="template-thumbnail-svg">
        <rect width="200" height="260" fill="#f8f9fa"/>
        {/* Header - Centered */}
        <rect x="50" y="20" width="100" height="8" fill="#1a202c" rx="2"/>
        <rect x="60" y="32" width="80" height="4" fill="#64748b" rx="1"/>
        <rect x="40" y="40" width="120" height="2" fill="#94a3b8" rx="1"/>
        {/* Line separator */}
        <rect x="20" y="50" width="160" height="2" fill="#2563eb" rx="1"/>
        {/* Section 1 */}
        <rect x="20" y="65" width="80" height="6" fill="#1a202c" rx="1"/>
        <rect x="20" y="73" width="160" height="1" fill="#cbd5e0" rx="0.5"/>
        <rect x="20" y="80" width="140" height="3" fill="#4a5568" rx="1"/>
        <rect x="25" y="88" width="130" height="2" fill="#718096" rx="1"/>
        <rect x="25" y="93" width="125" height="2" fill="#718096" rx="1"/>
        {/* Section 2 */}
        <rect x="20" y="110" width="80" height="6" fill="#1a202c" rx="1"/>
        <rect x="20" y="118" width="160" height="1" fill="#cbd5e0" rx="0.5"/>
        <rect x="20" y="125" width="135" height="3" fill="#4a5568" rx="1"/>
        <rect x="25" y="133" width="128" height="2" fill="#718096" rx="1"/>
      </svg>
    ),
    modern: (
      <svg viewBox="0 0 200 260" className="template-thumbnail-svg">
        <rect width="200" height="260" fill="#f8f9fa"/>
        {/* Header - Large Centered */}
        <rect x="40" y="20" width="120" height="12" fill="#0f172a" rx="2"/>
        <rect x="55" y="36" width="90" height="5" fill="#475569" rx="1"/>
        <rect x="35" y="45" width="130" height="2" fill="#94a3b8" rx="1"/>
        {/* Thin line separator */}
        <rect x="20" y="55" width="160" height="1" fill="#cbd5e0" rx="0.5"/>
        {/* Section 1 - Bold line accent */}
        <rect x="20" y="70" width="85" height="7" fill="#0f172a" rx="1"/>
        <rect x="20" y="80" width="50" height="3" fill="#0ea5e9" rx="1.5"/>
        <rect x="20" y="92" width="145" height="3" fill="#475569" rx="1"/>
        <rect x="25" y="101" width="135" height="2" fill="#64748b" rx="1"/>
        <rect x="25" y="107" width="132" height="2" fill="#64748b" rx="1"/>
        <rect x="25" y="113" width="128" height="2" fill="#64748b" rx="1"/>
        {/* Section 2 */}
        <rect x="20" y="135" width="85" height="7" fill="#0f172a" rx="1"/>
        <rect x="20" y="145" width="50" height="3" fill="#0ea5e9" rx="1.5"/>
      </svg>
    ),
    compact: (
      <svg viewBox="0 0 200 260" className="template-thumbnail-svg">
        <rect width="200" height="260" fill="#f8f9fa"/>
        {/* Header - Left aligned, compact */}
        <rect x="15" y="15" width="90" height="7" fill="#000000" rx="1"/>
        <rect x="15" y="25" width="70" height="3" fill="#374151" rx="1"/>
        <rect x="15" y="31" width="110" height="2" fill="#6b7280" rx="1"/>
        {/* Thin green line */}
        <rect x="15" y="38" width="170" height="1.5" fill="#059669" rx="0.75"/>
        {/* Section 1 - Minimal spacing */}
        <rect x="15" y="48" width="70" height="5" fill="#000000" rx="1"/>
        <rect x="15" y="58" width="120" height="3" fill="#374151" rx="1"/>
        <rect x="18" y="64" width="115" height="2" fill="#4b5563" rx="1"/>
        <rect x="18" y="68" width="118" height="2" fill="#4b5563" rx="1"/>
        <rect x="18" y="72" width="112" height="2" fill="#4b5563" rx="1"/>
        {/* Section 2 - tight spacing */}
        <rect x="15" y="82" width="70" height="5" fill="#000000" rx="1"/>
        <rect x="15" y="92" width="125" height="3" fill="#374151" rx="1"/>
        <rect x="18" y="98" width="120" height="2" fill="#4b5563" rx="1"/>
        <rect x="18" y="102" width="118" height="2" fill="#4b5563" rx="1"/>
        {/* Section 3 */}
        <rect x="15" y="112" width="70" height="5" fill="#000000" rx="1"/>
        <rect x="15" y="122" width="122" height="3" fill="#374151" rx="1"/>
      </svg>
    ),
    creative: (
      <svg viewBox="0 0 200 260" className="template-thumbnail-svg">
        <rect width="200" height="260" fill="#faf5ff"/>
        {/* Header - Bold Centered with colored accent */}
        <rect x="35" y="20" width="130" height="14" fill="#7c3aed" rx="3"/>
        <rect x="50" y="38" width="100" height="6" fill="#4c1d95" rx="2"/>
        <rect x="40" y="48" width="120" height="2" fill="#a855f7" rx="1"/>
        {/* Decorative thick line - centered */}
        <rect x="60" y="58" width="80" height="4" fill="#c026d3" rx="2"/>
        {/* Section 1 - Thick colored lines */}
        <rect x="20" y="75" width="90" height="8" fill="#7c3aed" rx="2"/>
        <rect x="20" y="87" width="160" height="4" fill="#c026d3" rx="2"/>
        <rect x="20" y="100" width="148" height="4" fill="#6b21a8" rx="1"/>
        <rect x="25" y="110" width="138" height="3" fill="#7e22ce" rx="1"/>
        <rect x="25" y="117" width="142" height="3" fill="#7e22ce" rx="1"/>
        <rect x="25" y="124" width="135" height="3" fill="#7e22ce" rx="1"/>
        {/* Section 2 */}
        <rect x="20" y="145" width="90" height="8" fill="#7c3aed" rx="2"/>
        <rect x="20" y="157" width="160" height="4" fill="#c026d3" rx="2"/>
      </svg>
    ),
    ats_optimized: (
      <svg viewBox="0 0 200 260" className="template-thumbnail-svg">
        <rect width="200" height="260" fill="#ffffff"/>
        {/* Header - Simple left aligned, plain text */}
        <rect x="15" y="15" width="85" height="7" fill="#000000" rx="1"/>
        <rect x="15" y="25" width="65" height="3" fill="#000000" rx="0.5"/>
        <rect x="15" y="31" width="80" height="2" fill="#000000" rx="0.5"/>
        <rect x="15" y="35" width="70" height="2" fill="#000000" rx="0.5"/>
        <rect x="15" y="39" width="75" height="2" fill="#000000" rx="0.5"/>
        <rect x="15" y="43" width="85" height="2" fill="#000000" rx="0.5"/>
        {/* Simple black line */}
        <rect x="15" y="50" width="170" height="1" fill="#000000" rx="0"/>
        {/* Section 1 - Plain, no color */}
        <rect x="15" y="60" width="100" height="5" fill="#000000" rx="0.5"/>
        <rect x="15" y="67" width="170" height="1" fill="#000000" rx="0"/>
        <rect x="15" y="75" width="115" height="3" fill="#000000" rx="0.5"/>
        <rect x="15" y="81" width="90" height="2" fill="#000000" rx="0.5"/>
        <rect x="18" y="86" width="145" height="2" fill="#000000" rx="0.5"/>
        <rect x="18" y="90" width="148" height="2" fill="#000000" rx="0.5"/>
        <rect x="18" y="94" width="142" height="2" fill="#000000" rx="0.5"/>
        {/* Section 2 */}
        <rect x="15" y="108" width="100" height="5" fill="#000000" rx="0.5"/>
        <rect x="15" y="115" width="170" height="1" fill="#000000" rx="0"/>
      </svg>
    )
  };

  return thumbnails[template.id] || null;
};

const TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Classic and elegant design perfect for corporate roles',
    features: ['Centered header', 'Clean layout', 'Professional blue accents', 'Traditional spacing'],
    bestFor: 'Corporate, Finance, Legal',
    preview: '👔',
    colorScheme: '#2563eb'
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with bold typography and sky blue accents',
    features: ['Large name heading', 'Bold section lines', 'Relaxed spacing', 'Modern aesthetics'],
    bestFor: 'Tech, Startups, Creative Industries',
    preview: '✨',
    colorScheme: '#0ea5e9'
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Maximizes content with efficient use of space',
    features: ['Left-aligned header', 'Minimal spacing', 'Small fonts', 'More content per page'],
    bestFor: 'Experienced Professionals, Academia',
    preview: '📋',
    colorScheme: '#059669'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Eye-catching design with vibrant colors and unique styling',
    features: ['Large bold name', 'Colorful accents', 'Thick decorative lines', 'Generous spacing'],
    bestFor: 'Design, Marketing, Arts',
    preview: '🎨',
    colorScheme: '#7c3aed'
  },
  {
    id: 'ats_optimized',
    name: 'ATS-Optimized',
    description: 'Designed for maximum compatibility with Applicant Tracking Systems',
    features: ['Simple formatting', 'Black & white only', 'Standard fonts', 'Machine-readable'],
    bestFor: 'Online Applications, Large Corporations',
    preview: '🤖',
    colorScheme: '#000000',
    recommended: true
  }
];

const extractSelectedSectionsFromCvData = (cvData) => {
  const nodes = cvData?.content_snapshot?.nodes;
  if (!Array.isArray(nodes)) return [];

  return nodes
    .filter((node) => node?.node_type === 'section' && node?.is_selected)
    .map((node, index) => ({
      id: node.title || `section_${index}`,
      title: node.title || 'Untitled Section',
      originalIndex: index
    }));
};

function PDFTemplateSelector({ cvId, cvData, onClose, onGenerate, existingApplicationId = null }) {
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customizations, setCustomizations] = useState({
    fontSize: 'normal',      // small, normal, large
    spacing: 'normal',       // tight, normal, relaxed
    colorIntensity: 'normal' // subtle, normal, bold
  });

  // Job application form state
  const [jobFormData, setJobFormData] = useState({
    job_url: '',
    location: '',
    priority: 'medium',
    notes: '',
    cover_letter: ''
  });

  // Live preview state
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [fullSizeImageUrl, setFullSizeImageUrl] = useState(null);
  const [previewMetadata, setPreviewMetadata] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingFullSize, setIsLoadingFullSize] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [showFullSizePreview, setShowFullSizePreview] = useState(false);

  // Section ordering state
  const [sectionOrder, setSectionOrder] = useState(() => extractSelectedSectionsFromCvData(cvData));
  const [sectionsInitialized, setSectionsInitialized] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);

  // Refs to prevent duplicate API calls
  const previewRequestRef = useRef(null);
  const abortControllerRef = useRef(null);
  const initializedCvIdRef = useRef(null);

  const selectedTemplateData = TEMPLATES.find(t => t.id === selectedTemplate);

  useEffect(() => {
    initializedCvIdRef.current = null;
    setSectionsInitialized(false);
  }, [cvId]);

  // Initialize section order from already-loaded CV data (no extra API call needed)
  useEffect(() => {
    if (!cvId) return;
    if (!cvData?.content_snapshot?.nodes) return;
    if (initializedCvIdRef.current === cvId) return;

    setSectionOrder(extractSelectedSectionsFromCvData(cvData));
    setSectionsInitialized(true);
    initializedCvIdRef.current = cvId;
  }, [cvId, cvData]);

  // Fetch preview image and metadata
  const fetchPreview = useCallback(async () => {
    if (!cvId) return;

    // Create a unique request signature to detect duplicates
    const requestSignature = JSON.stringify({
      cvId,
      template: selectedTemplate,
      customizations,
      sectionOrder: sectionOrder.map(s => s.title)
    });

    // Skip if the same request is already in flight
    if (previewRequestRef.current === requestSignature) {
      console.log('[PreviewDebug] Skipping duplicate request');
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    previewRequestRef.current = requestSignature;

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const token = localStorage.getItem('token');

      // Include section order in customizations (using titles for better matching)
      const customizationsWithOrder = {
        ...customizations,
        sectionOrder: sectionOrder.map(s => s.title)
      };

      // Fetch both metadata and preview image in parallel
      const [metadataResponse, imageResponse] = await Promise.all([
        fetch(`${API_URL}/api/tailor/${cvId}/preview-metadata`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cv_format: selectedTemplate,
            customizations: customizationsWithOrder
          }),
          signal: abortController.signal
        }),
        fetch(`${API_URL}/api/tailor/${cvId}/preview-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cv_format: selectedTemplate,
            customizations: customizationsWithOrder,
            page_index: 0,
            all_pages: false  // Only fetch first page for thumbnail
          }),
          signal: abortController.signal
        })
      ]);

      if (!metadataResponse.ok || !imageResponse.ok) {
        throw new Error('Failed to generate preview');
      }

      // Parse metadata
      const metadata = await metadataResponse.json();
      setPreviewMetadata(metadata);

      // Create object URL for image
      const imageBlob = await imageResponse.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Clean up previous URL
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }

      setPreviewImageUrl(imageUrl);

    } catch (error) {
      // Ignore aborted requests
      if (error.name === 'AbortError') {
        console.log('[PreviewDebug] Request aborted');
        return;
      }
      console.error('Error fetching preview:', error);
      setPreviewError(error.message);
    } finally {
      setIsLoadingPreview(false);
      // Clear the request ref when done
      previewRequestRef.current = null;
      abortControllerRef.current = null;
    }
  }, [cvId, selectedTemplate, customizations, sectionOrder]);

  // Fetch full-size preview (all pages)
  const fetchFullSizePreview = useCallback(async () => {
    if (!cvId) return;

    setIsLoadingFullSize(true);

    try {
      const token = localStorage.getItem('token');

      // Include section order in customizations
      const customizationsWithOrder = {
        ...customizations,
        sectionOrder: sectionOrder.map(s => s.title)
      };

      const response = await fetch(`${API_URL}/api/tailor/${cvId}/preview-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cv_format: selectedTemplate,
          customizations: customizationsWithOrder,
          page_index: 0,
          all_pages: true  // Fetch all pages for full-size modal
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate full-size preview');
      }

      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Clean up previous URL
      if (fullSizeImageUrl) {
        URL.revokeObjectURL(fullSizeImageUrl);
      }

      setFullSizeImageUrl(imageUrl);

    } catch (error) {
      console.error('Error fetching full-size preview:', error);
    } finally {
      setIsLoadingFullSize(false);
    }
  }, [cvId, selectedTemplate, customizations, sectionOrder, fullSizeImageUrl]);

  // Fetch preview when template/customizations/section order changes
  // Debounced to avoid duplicate requests during rapid UI updates.
  useEffect(() => {
    if (!sectionsInitialized) return;

    const timer = setTimeout(() => {
      fetchPreview();
    }, 180);

    return () => clearTimeout(timer);
  }, [fetchPreview, sectionsInitialized]);

  // Invalidate full-size preview when settings change
  useEffect(() => {
    if (fullSizeImageUrl) {
      URL.revokeObjectURL(fullSizeImageUrl);
      setFullSizeImageUrl(null);
    }
  }, [selectedTemplate, customizations, sectionOrder]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
      if (fullSizeImageUrl) {
        URL.revokeObjectURL(fullSizeImageUrl);
      }
    };
  }, [previewImageUrl, fullSizeImageUrl]);

  // Fetch full-size preview when modal is opened
  useEffect(() => {
    if (showFullSizePreview && !fullSizeImageUrl) {
      fetchFullSizePreview();
    }
  }, [showFullSizePreview, fetchFullSizePreview, fullSizeImageUrl]);

  // Drag and drop handlers for section ordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setDraggedItem(sectionOrder[index]);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder array for visual feedback
    const newOrder = [...sectionOrder];
    const itemToMove = newOrder[draggedIndex];

    // Remove from old position
    newOrder.splice(draggedIndex, 1);
    // Insert at new position
    newOrder.splice(index, 0, itemToMove);

    setSectionOrder(newOrder);
    setDraggedIndex(index); // Update the index to track the new position
  };

  const handleDragEnd = (e) => {
    e.preventDefault();
    setDraggedIndex(null);
    setDraggedItem(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedIndex(null);
    setDraggedItem(null);
  };

  // Handle ESC key to close full-size preview
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && showFullSizePreview) {
        setShowFullSizePreview(false);
      }
    };

    if (showFullSizePreview) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [showFullSizePreview]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Include section order in customizations (using titles for better matching)
      const customizationsWithOrder = {
        ...customizations,
        sectionOrder: sectionOrder.map(s => s.title)
      };

      // Pass both PDF settings and job form data
      await onGenerate(selectedTemplate, customizationsWithOrder, jobFormData);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pdf-template-selector-overlay">
      <div className="pdf-template-selector-modal">
        {/* Header */}
        <div className="pdf-selector-header">
          <div className="pdf-selector-title-section">
            <h2>📄 Choose Your CV Template</h2>
            <p className="pdf-selector-subtitle">
              Select a professional template that matches your industry and role
            </p>
          </div>
          <button className="pdf-selector-close" onClick={onClose}>✕</button>
        </div>

        {/* Main Content */}
        <div className="pdf-selector-content">
          {/* Template Grid */}
          <div className="pdf-template-grid">
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`pdf-template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                {template.recommended && (
                  <div className="template-recommended-badge">⭐ Recommended</div>
                )}

                {/* Visual Thumbnail */}
                <div className="template-thumbnail-container">
                  <TemplateThumbnail template={template} />
                </div>

                <h3 className="template-name">
                  <span className="template-emoji">{template.preview}</span>
                  {template.name}
                </h3>
                <p className="template-description">{template.description}</p>

                <div className="template-features">
                  {template.features.map((feature, idx) => (
                    <div key={idx} className="template-feature">
                      <span className="feature-bullet">•</span>
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="template-best-for">
                  <strong>Best for:</strong> {template.bestFor}
                </div>

                {selectedTemplate === template.id && (
                  <div className="template-selected-indicator">
                    <span className="checkmark">✓</span> Selected
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Customization Panel */}
          <div className="pdf-customization-panel">
            <h3 className="customization-title">
              🎨 Customize "{selectedTemplateData?.name}"
            </h3>

            {/* Live CV Preview */}
            <div className="selected-template-preview">
              <div className="preview-label">
                <span>Your CV Preview</span>
                {isLoadingPreview && (
                  <span className="preview-loading-badge">
                    <span className="spinner-tiny"></span>
                    Updating...
                  </span>
                )}
              </div>

              <div className="live-preview-container">
                {previewError ? (
                  <div className="preview-error">
                    <span className="error-icon">⚠️</span>
                    <p>Failed to generate preview</p>
                    <p className="error-detail">{previewError}</p>
                    <button className="retry-btn" onClick={fetchPreview}>
                      Retry
                    </button>
                  </div>
                ) : previewImageUrl ? (
                  <div className="preview-image-wrapper" onClick={() => setShowFullSizePreview(true)} style={{ cursor: 'pointer' }}>
                    <img
                      src={previewImageUrl}
                      alt="CV Preview"
                      className="preview-cv-image"
                      style={{
                        opacity: isLoadingPreview ? 0.5 : 1,
                        transition: 'opacity 0.3s ease'
                      }}
                      title="Click to view full size"
                    />
                    <div className="preview-click-hint">
                      <span className="hint-icon">🔍</span>
                      <span>Click to view full size</span>
                    </div>
                    {isLoadingPreview && (
                      <div className="preview-overlay">
                        <div className="spinner-medium"></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <div className="spinner-large"></div>
                    <p>Generating preview...</p>
                  </div>
                )}
              </div>

              {/* Preview Statistics */}
              {previewMetadata && (
                <div className="preview-stats">
                  <div className="stat-item">
                    <span className="stat-icon">📄</span>
                    <div className="stat-content">
                      <span className="stat-value">{previewMetadata.page_count}</span>
                      <span className="stat-label">Page{previewMetadata.page_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <div className="stat-content">
                      <span className="stat-value">{previewMetadata.word_count.toLocaleString()}</span>
                      <span className="stat-label">Words</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">📊</span>
                    <div className="stat-content">
                      <span className="stat-value">{previewMetadata.section_count}</span>
                      <span className="stat-label">Sections</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">🔤</span>
                    <div className="stat-content">
                      <span className="stat-value">{previewMetadata.character_count.toLocaleString()}</span>
                      <span className="stat-label">Characters</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="preview-info-card" style={{ borderColor: selectedTemplateData?.colorScheme }}>
                <div className="preview-icon">{selectedTemplateData?.preview}</div>
                <div className="preview-details">
                  <h4>{selectedTemplateData?.name}</h4>
                  <p>{selectedTemplateData?.description}</p>
                </div>
              </div>
            </div>

            {/* Customization Controls */}
            <div className="customization-controls">
              <h4 className="controls-section-title">📐 Adjust Settings</h4>

              {/* Font Size */}
              <div className="control-group">
                <label className="control-label">
                  <span className="control-icon">🔤</span>
                  <span>Font Size</span>
                </label>
                <div className="control-options">
                  <button
                    className={`control-option-btn ${customizations.fontSize === 'small' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, fontSize: 'small'})}
                  >
                    <span className="option-label">Small</span>
                    <span className="option-hint">9-10pt (85-90%)</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.fontSize === 'normal' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, fontSize: 'normal'})}
                  >
                    <span className="option-label">Normal</span>
                    <span className="option-hint">10-11pt (100%)</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.fontSize === 'large' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, fontSize: 'large'})}
                  >
                    <span className="option-label">Large</span>
                    <span className="option-hint">11-12pt (110-115%)</span>
                  </button>
                </div>
              </div>

              {/* Spacing */}
              <div className="control-group">
                <label className="control-label">
                  <span className="control-icon">↕️</span>
                  <span>Spacing</span>
                </label>
                <div className="control-options">
                  <button
                    className={`control-option-btn ${customizations.spacing === 'tight' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, spacing: 'tight'})}
                  >
                    <span className="option-label">Tight</span>
                    <span className="option-hint">70% spacing</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.spacing === 'normal' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, spacing: 'normal'})}
                  >
                    <span className="option-label">Normal</span>
                    <span className="option-hint">100% spacing</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.spacing === 'relaxed' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, spacing: 'relaxed'})}
                  >
                    <span className="option-label">Relaxed</span>
                    <span className="option-hint">130% spacing</span>
                  </button>
                </div>
              </div>

              {/* Color Intensity (disabled for ATS template) */}
              <div className={`control-group ${selectedTemplate === 'ats_optimized' ? 'disabled' : ''}`}>
                <label className="control-label">
                  <span className="control-icon">🎨</span>
                  <span>Color Intensity</span>
                  {selectedTemplate === 'ats_optimized' && (
                    <span className="control-disabled-badge">N/A for ATS</span>
                  )}
                </label>
                <div className="control-options">
                  <button
                    className={`control-option-btn ${customizations.colorIntensity === 'subtle' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, colorIntensity: 'subtle'})}
                    disabled={selectedTemplate === 'ats_optimized'}
                  >
                    <span className="option-label">Subtle</span>
                    <span className="option-hint">Muted</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.colorIntensity === 'normal' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, colorIntensity: 'normal'})}
                    disabled={selectedTemplate === 'ats_optimized'}
                  >
                    <span className="option-label">Normal</span>
                    <span className="option-hint">Standard</span>
                  </button>
                  <button
                    className={`control-option-btn ${customizations.colorIntensity === 'bold' ? 'active' : ''}`}
                    onClick={() => setCustomizations({...customizations, colorIntensity: 'bold'})}
                    disabled={selectedTemplate === 'ats_optimized'}
                  >
                    <span className="option-label">Bold</span>
                    <span className="option-hint">Vibrant</span>
                  </button>
                </div>
              </div>

              {/* Section Ordering */}
              {sectionOrder.length > 0 && (
                <div className="control-group">
                  <label className="control-label">
                    <span className="control-icon">📑</span>
                    <span>Section Order</span>
                    <span className="control-hint-badge">Drag to reorder</span>
                  </label>
                  <div className="section-order-list">
                    {sectionOrder.map((section, index) => (
                      <div
                        key={section.id}
                        className={`section-order-item ${draggedIndex === index ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                      >
                        <span className="section-drag-handle">⠿</span>
                        <span className="section-order-number">{index + 1}</span>
                        <span className="section-title">{section.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Note */}
              <div className="customization-note">
                <span className="note-icon">💡</span>
                <span className="note-text">
                  Customizations will be applied to your downloaded PDF
                </span>
              </div>
            </div>

            {/* Job Application Details Form */}
            <div className="job-application-form-section">
              <h3 className="job-form-title">
                📋 Application Details
              </h3>
              <p className="job-form-subtitle">
                Add job details to save this application to your tracker
              </p>

              <div className="job-form-fields">
                {/* Job URL */}
                <div className="job-form-group">
                  <label className="job-form-label">
                    <span className="label-icon">🔗</span>
                    Job URL (Optional)
                  </label>
                  <input
                    type="url"
                    className="job-form-input"
                    placeholder="https://company.com/careers/job-posting"
                    value={jobFormData.job_url}
                    onChange={(e) => setJobFormData({ ...jobFormData, job_url: e.target.value })}
                  />
                </div>

                {/* Location */}
                <div className="job-form-group">
                  <label className="job-form-label">
                    <span className="label-icon">📍</span>
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    className="job-form-input"
                    placeholder="e.g., San Francisco, CA or Remote"
                    value={jobFormData.location}
                    onChange={(e) => setJobFormData({ ...jobFormData, location: e.target.value })}
                  />
                </div>

                {/* Priority */}
                <div className="job-form-group">
                  <label className="job-form-label">
                    <span className="label-icon">⭐</span>
                    Priority
                  </label>
                  <select
                    className="job-form-select"
                    value={jobFormData.priority}
                    onChange={(e) => setJobFormData({ ...jobFormData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="job-form-group">
                  <label className="job-form-label">
                    <span className="label-icon">📝</span>
                    Notes (Optional)
                  </label>
                  <textarea
                    className="job-form-textarea"
                    placeholder="Add any notes about this application..."
                    rows={3}
                    value={jobFormData.notes}
                    onChange={(e) => setJobFormData({ ...jobFormData, notes: e.target.value })}
                  />
                </div>

                {/* Cover Letter */}
                <div className="job-form-group">
                  <label className="job-form-label">
                    <span className="label-icon">✉️</span>
                    Cover Letter (Optional)
                  </label>
                  <textarea
                    className="job-form-textarea"
                    placeholder="Paste your cover letter here..."
                    rows={4}
                    value={jobFormData.cover_letter}
                    onChange={(e) => setJobFormData({ ...jobFormData, cover_letter: e.target.value })}
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="job-form-info-box">
                <span className="info-icon">ℹ️</span>
                <div className="info-text">
                  <strong>What happens next:</strong>
                  <ul>
                    <li>Your CV will be generated with all customizations</li>
                    <li>Application will be saved to your tracker</li>
                    <li>PDF will download immediately</li>
                    <li>You can re-download with same settings later</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pdf-selector-footer">
          <div className="footer-info">
            <div className="info-badge">💡</div>
            <span>Clicking "Finalize" will save to tracker and download your CV</span>
          </div>

          <div className="footer-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="spinner-small"></span>
                  <span>Finalizing...</span>
                </>
              ) : (
                <>
                  <span className="icon">✓</span>
                  <span>Finalize & Save to Tracker</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full-Size Preview Modal */}
      {showFullSizePreview && previewImageUrl && (
        <div className="fullsize-preview-overlay" onClick={() => setShowFullSizePreview(false)}>
          <div className="fullsize-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fullsize-preview-header">
              <div className="fullsize-preview-title">
                <span className="preview-icon-large">📄</span>
                <div>
                  <h3>Full Size Preview</h3>
                  <p className="preview-subtitle">
                    {selectedTemplateData?.name} template • {previewMetadata?.page_count} page{previewMetadata?.page_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button className="fullsize-close-btn" onClick={() => setShowFullSizePreview(false)}>
                ✕
              </button>
            </div>
            <div className="fullsize-preview-body">
              {isLoadingFullSize ? (
                <div className="fullsize-loading">
                  <div className="spinner-large"></div>
                  <p>Loading full preview...</p>
                </div>
              ) : fullSizeImageUrl ? (
                <img
                  src={fullSizeImageUrl}
                  alt="Full Size CV Preview"
                  className="fullsize-preview-image"
                />
              ) : (
                <div className="fullsize-loading">
                  <p>No preview available</p>
                </div>
              )}
            </div>
            <div className="fullsize-preview-footer">
              <div className="fullsize-stats">
                <span>📄 {previewMetadata?.page_count} page{previewMetadata?.page_count !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>📝 {previewMetadata?.word_count.toLocaleString()} words</span>
                <span>•</span>
                <span>📊 {previewMetadata?.section_count} sections</span>
              </div>
              <div className="fullsize-hint">
                Scroll to view full document • Press ESC or click outside to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFTemplateSelector;
