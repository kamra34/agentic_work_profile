import React, { useState, useEffect } from 'react';
import CVPreview from './CVPreview';
import './TailoredCVs.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#6c757d' },
  { value: 'in_progress', label: 'In Progress', color: '#0dcaf0' },
  { value: 'ready', label: 'Ready to Apply', color: '#198754' },
  { value: 'applied', label: 'Applied', color: '#0d6efd' },
  { value: 'interview', label: 'Interview', color: '#fd7e14' },
  { value: 'offer', label: 'Offer Received', color: '#20c997' },
  { value: 'rejected', label: 'Rejected', color: '#dc3545' },
  { value: 'accepted', label: 'Accepted', color: '#198754' },
  { value: 'archived', label: 'Archived', color: '#6c757d' }
];

function TailoredCVs() {
  const [cvVersions, setCvVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCV, setSelectedCV] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc'); // created_at_desc, created_at_asc, job_title, company

  useEffect(() => {
    fetchCVVersions();
  }, []);

  const fetchCVVersions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/cv/tailored-versions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tailored CVs');
      }

      const data = await response.json();
      setCvVersions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCV = async (cvId) => {
    if (!confirm('Are you sure you want to delete this tailored CV?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${cvId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete CV');
      }

      await fetchCVVersions();
      alert('✅ Tailored CV deleted successfully');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const updateStatus = async (cvId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const cv = cvVersions.find(c => c.id === cvId);

      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${cvId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...cv,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchCVVersions();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const viewCVDetail = (cv) => {
    setSelectedCV(cv);
    setViewMode('detail');
  };

  const getStatusColor = (status) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? statusOption.color : '#6c757d';
  };

  const getStatusLabel = (status) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? statusOption.label : status;
  };

  const getFilteredAndSortedCVs = () => {
    let filtered = cvVersions;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(cv => cv.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cv =>
        cv.job_title.toLowerCase().includes(query) ||
        (cv.company_name && cv.company_name.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'created_at_asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'job_title':
          return a.job_title.localeCompare(b.job_title);
        case 'company':
          return (a.company_name || '').localeCompare(b.company_name || '');
        default:
          return 0;
      }
    });

    return sorted;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="tailored-cvs-container">
        <div className="loading-message">Loading tailored CVs...</div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedCV) {
    return <CVDetailView cv={selectedCV} onBack={() => setViewMode('list')} onUpdate={fetchCVVersions} />;
  }

  const filteredCVs = getFilteredAndSortedCVs();

  return (
    <div className="tailored-cvs-container">
      <div className="page-header">
        <h1>📋 My Tailored CVs</h1>
        <p className="page-subtitle">
          Manage your saved tailored CVs for different job applications
        </p>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by job title or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="job_title">Job Title (A-Z)</option>
            <option value="company">Company (A-Z)</option>
          </select>
        </div>
      </div>

      {/* CV List */}
      {filteredCVs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">📄</p>
          <p className="empty-text">
            {searchQuery || statusFilter !== 'all'
              ? 'No tailored CVs match your filters'
              : 'No tailored CVs saved yet'}
          </p>
          <p className="empty-subtext">
            Tailor your CV for specific jobs and save them here for easy access
          </p>
        </div>
      ) : (
        <div className="cvs-grid">
          {filteredCVs.map(cv => (
            <div key={cv.id} className="cv-card">
              <div className="cv-card-header">
                <div className="cv-title-section">
                  <h3 className="cv-job-title">{cv.job_title}</h3>
                  {cv.company_name && (
                    <p className="cv-company">{cv.company_name}</p>
                  )}
                </div>
                <select
                  value={cv.status || 'draft'}
                  onChange={(e) => updateStatus(cv.id, e.target.value)}
                  className="status-select"
                  style={{
                    backgroundColor: getStatusColor(cv.status || 'draft'),
                    color: 'white'
                  }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="cv-card-body">
                <div className="cv-date">
                  📅 Created: {formatDate(cv.created_at)}
                </div>

                {/* AI Scores */}
                <div className="cv-scores">
                  <div className="score-row">
                    <span className="score-label">Profile Fit:</span>
                    <div className="score-badges">
                      {cv.openai_fit_score ? (
                        <span className="score-badge openai">
                          🟢 {cv.openai_fit_score}%
                        </span>
                      ) : (
                        <span className="score-badge-na">🟢 N/A</span>
                      )}
                      {cv.claude_fit_score ? (
                        <span className="score-badge claude">
                          🔵 {cv.claude_fit_score}%
                        </span>
                      ) : (
                        <span className="score-badge-na">🔵 N/A</span>
                      )}
                    </div>
                  </div>
                  <div className="score-row">
                    <span className="score-label">ATS Score:</span>
                    <div className="score-badges">
                      {cv.openai_ats_score ? (
                        <span className="score-badge openai">
                          🟢 {cv.openai_ats_score}%
                        </span>
                      ) : (
                        <span className="score-badge-na">🟢 N/A</span>
                      )}
                      {cv.claude_ats_score ? (
                        <span className="score-badge claude">
                          🔵 {cv.claude_ats_score}%
                        </span>
                      ) : (
                        <span className="score-badge-na">🔵 N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                {cv.notes && (
                  <div className="cv-notes">
                    <p className="notes-label">📝 Notes:</p>
                    <p className="notes-text">{cv.notes}</p>
                  </div>
                )}
              </div>

              <div className="cv-card-actions">
                <button
                  className="btn-view"
                  onClick={() => viewCVDetail(cv)}
                >
                  👁️ View
                </button>
                <button
                  className="btn-delete"
                  onClick={() => deleteCV(cv.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredCVs.length > 0 && (
        <div className="results-count">
          Showing {filteredCVs.length} of {cvVersions.length} tailored CV{cvVersions.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function CVDetailView({ cv, onBack, onUpdate }) {
  const [fullCVData, setFullCVData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedEntries, setExpandedEntries] = useState({});
  const [previewMode, setPreviewMode] = useState('cv'); // 'cv', 'openai', 'claude'
  const [hiddenItems, setHiddenItems] = useState({}); // Track hidden items by ID

  useEffect(() => {
    fetchFullCVData();
  }, [cv.id]);

  const fetchFullCVData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${cv.id}/full`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch full CV data');
      }

      const data = await response.json();
      setFullCVData(data);
      setError(null);

      // Auto-expand all sections for viewing
      if (data && data.profile && data.profile.sections) {
        const expandedSecs = {};
        const expandedEnts = {};
        data.profile.sections.forEach(section => {
          expandedSecs[section.id] = true;
          section.entries.forEach(entry => {
            expandedEnts[entry.id] = true;
            if (entry.sub_entries) {
              entry.sub_entries.forEach(sub => {
                expandedEnts[sub.id] = true;
              });
            }
          });
        });
        setExpandedSections(expandedSecs);
        setExpandedEntries(expandedEnts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleEntry = (entryId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const toggleItemVisibility = (itemId) => {
    setHiddenItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const downloadPDF = async () => {
    try {
      const token = localStorage.getItem('token');

      // Get list of hidden item IDs
      const hiddenItemIds = Object.keys(hiddenItems)
        .filter(id => hiddenItems[id])
        .map(id => parseInt(id));

      const response = await fetch(
        `${API_URL}/api/cv/tailored-versions/${cv.id}/download-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            hidden_items: hiddenItemIds,
            template_name: 'modern'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${cv.job_title.replace(/\s+/g, '_')}_${cv.company_name?.replace(/\s+/g, '_') || 'Company'}.pdf`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const getSectionIcon = (sectionType) => {
    const icons = {
      'summary': '📝',
      'work_experience': '💼',
      'education': '🎓',
      'skills': '⚡',
      'projects': '🚀',
      'certifications': '📜',
      'awards': '🏆',
      'publications': '📚',
      'languages': '🌍',
      'volunteer': '🤝'
    };
    return icons[sectionType] || '📋';
  };

  const countSectionItems = (section) => {
    let totalItems = 0;

    if (section.entries) {
      section.entries.forEach(entry => {
        // Count items in main entry
        if (entry.items) {
          totalItems += entry.items.length;
        }

        // Count items in sub-entries (for hierarchical work experience)
        if (entry.sub_entries) {
          entry.sub_entries.forEach(subEntry => {
            if (subEntry.items) {
              totalItems += subEntry.items.length;
            }
          });
        }
      });
    }

    return totalItems;
  };

  const renderAIBadge = (recommendedBy) => {
    if (!recommendedBy || recommendedBy.length === 0) {
      return null;
    }

    const hasOpenAI = recommendedBy.includes('openai');
    const hasClaude = recommendedBy.includes('claude');

    if (hasOpenAI && hasClaude) {
      return (
        <span className="ai-badge ai-badge-both" title="Recommended by both AI models">
          🟢 GPT-4o + 🔵 Claude
        </span>
      );
    } else if (hasOpenAI) {
      return (
        <span className="ai-badge ai-badge-openai" title="Recommended by GPT-4o">
          🟢 GPT-4o
        </span>
      );
    } else if (hasClaude) {
      return (
        <span className="ai-badge ai-badge-claude" title="Recommended by Claude Sonnet">
          🔵 Claude
        </span>
      );
    }

    return null;
  };

  const renderAnalysisSection = (title, content) => {
    if (!content) return null;

    if (Array.isArray(content)) {
      return (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#2d3748' }}>{title}:</strong>
          <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#4a5568' }}>
            {content.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>{item}</li>
            ))}
          </ul>
        </div>
      );
    } else if (typeof content === 'object') {
      return (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#2d3748' }}>{title}:</strong>
          <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#4a5568' }}>
            {Object.entries(content).map(([key, value]) => (
              <li key={key} style={{ marginBottom: '0.25rem' }}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      );
    } else {
      return (
        <div style={{ marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#2d3748' }}>{title}:</strong>
          <p style={{ margin: '0', color: '#4a5568', lineHeight: '1.6' }}>{content}</p>
        </div>
      );
    }
  };

  const renderSection = (section) => {
    const isExpanded = expandedSections[section.id];
    const icon = getSectionIcon(section.section_type);
    const itemCount = countSectionItems(section);

    return (
      <div key={section.id} className="section-card">
        <div className="section-header" onClick={() => toggleSection(section.id)}>
          <div className="section-header-left">
            <span className="section-icon">{icon}</span>
            <h3 className="section-title">{section.title}</h3>
            {itemCount > 0 && (
              <span className="item-count-badge">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="section-header-right">
            <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="section-content">
            {section.content && (
              <div className="section-text-content">
                <p>{section.content}</p>
              </div>
            )}

            {section.entries && section.entries.length > 0 && (
              <div className="section-entries">
                {section.entries.map(entry => renderEntry(entry, section.section_type))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEntry = (entry, sectionType) => {
    const isExpanded = expandedEntries[entry.id];
    const hasItems = entry.items && entry.items.length > 0;
    const hasSubEntries = entry.sub_entries && entry.sub_entries.length > 0;
    const hasContent = hasItems || hasSubEntries || entry.description;

    return (
      <div key={entry.id} className="entry-card" data-entry-id={entry.id}>
        <div className="entry-header" onClick={() => hasContent && toggleEntry(entry.id)}>
          <div className="entry-header-content">
            <div className="entry-title-row">
              <strong className="entry-title">{entry.title}</strong>
              {entry.subtitle && <span className="entry-subtitle"> - {entry.subtitle}</span>}
              {entry.reasoning && (
                <span className="entry-ai-badge-inline">
                  {renderAIBadge(
                    [
                      entry.reasoning.openai ? 'openai' : null,
                      entry.reasoning.claude ? 'claude' : null
                    ].filter(Boolean)
                  )}
                </span>
              )}
            </div>
            {(entry.start_date || entry.end_date || entry.location) && (
              <div className="entry-meta">
                {entry.start_date && <span>{entry.start_date}</span>}
                {entry.end_date && <span> - {entry.end_date}</span>}
                {entry.location && <span> | {entry.location}</span>}
              </div>
            )}
          </div>
          {hasContent && (
            <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
          )}
        </div>

        {isExpanded && hasContent && (
          <div className="entry-content">
            {entry.description && (
              <p className="entry-description">{entry.description}</p>
            )}

            {entry.reasoning && (entry.reasoning.openai || entry.reasoning.claude) && (
              <div className="ai-reasoning-section">
                {entry.reasoning.openai && (
                  <div className="ai-reasoning-item">
                    <strong>🟢 GPT-4o:</strong> {entry.reasoning.openai}
                  </div>
                )}
                {entry.reasoning.claude && (
                  <div className="ai-reasoning-item">
                    <strong>🔵 Claude:</strong> {entry.reasoning.claude}
                  </div>
                )}
              </div>
            )}

            {hasItems && (
              <ul className="entry-items-list">
                {entry.items.map(item => (
                  <li key={item.id} className="entry-item" data-item-id={item.id}>
                    <div className="item-content-row">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItemVisibility(item.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0 0.5rem 0 0',
                          color: hiddenItems[item.id] ? '#cbd5e0' : '#2d3748',
                          fontWeight: hiddenItems[item.id] ? 'normal' : 'bold',
                          transition: 'all 0.2s',
                          lineHeight: 1
                        }}
                        title={hiddenItems[item.id] ? 'Show in CV preview' : 'Hide from CV preview'}
                      >
                        👁
                      </button>
                      <span className="item-text">{item.content}</span>
                      {item.recommended_by && renderAIBadge(item.recommended_by)}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {hasSubEntries && (
              <div className="sub-entries">
                {entry.sub_entries.map(subEntry => renderEntry(subEntry, sectionType))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cv-detail-container">
        <div className="loading-message">Loading CV details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cv-detail-container">
        <button className="btn-back" onClick={onBack}>← Back to List</button>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  if (!fullCVData || !fullCVData.profile) {
    return (
      <div className="cv-detail-container">
        <button className="btn-back" onClick={onBack}>← Back to List</button>
        <div className="empty-message">No CV data available</div>
      </div>
    );
  }

  const profile = fullCVData.profile;

  return (
    <div className="cv-detail-view">
      {/* Header with Title and Back Button */}
      <div className="cv-detail-header">
        <button className="btn-back-minimal" onClick={onBack} title="Back to CV List">
          ← Back
        </button>
        <div className="cv-detail-title-section">
          <h1>{cv.job_title}</h1>
          {cv.company_name && <h2 className="cv-company-name">{cv.company_name}</h2>}
        </div>
      </div>

      {/* AI Scores and Actions Bar */}
      <div className="ai-scores-bar">
        {/* Initial Evaluation Scores */}
        <div className="scores-section">
          <h3 className="scores-section-title">Initial Evaluation</h3>
          <div className="scores-row">
            <div className="score-group">
              <span className="score-label">Profile Fit:</span>
              <span className="score-value">
                {cv.openai_fit_score ? `🟢 ${cv.openai_fit_score}%` : '🟢 N/A'}
                {' | '}
                {cv.claude_fit_score ? `🔵 ${cv.claude_fit_score}%` : '🔵 N/A'}
              </span>
            </div>
            <div className="score-group">
              <span className="score-label">ATS Score:</span>
              <span className="score-value">
                {cv.openai_ats_score ? `🟢 ${cv.openai_ats_score}%` : '🟢 N/A'}
                {' | '}
                {cv.claude_ats_score ? `🔵 ${cv.claude_ats_score}%` : '🔵 N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Re-evaluated Scores Placeholder */}
        <div className="scores-section">
          <h3 className="scores-section-title">Re-evaluated (Current CV)</h3>
          <div className="scores-row">
            <div className="score-group">
              <span className="score-label">ATS Score:</span>
              <span className="score-value score-pending">Not calculated yet</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="scores-actions">
          <button className="btn-recalculate" onClick={() => alert('Re-calculate ATS functionality coming soon!')} title="Re-calculate ATS score based on visible items">
            🔄 Re-calculate ATS
          </button>
          <button className="btn-download-pdf-bar" onClick={downloadPDF} title="Download CV as PDF">
            📄 Download PDF
          </button>
        </div>
      </div>

      {/* Master Profile-Style Split View */}
      <div className="profile-split-view">
        {/* Left Panel - Selected Content with Collapsible Sections */}
        <div className="profile-editor-panel">
          <div className="selected-content-header">
            <h3>Selected Content for This CV</h3>
            <p className="content-subtitle">Only showing AI-recommended items for this job</p>
            <div className="ai-legend">
              <span className="legend-compact">🟢 GPT-4o</span>
              <span className="legend-compact">🔵 Claude</span>
              <span className="legend-compact">🟢🔵 Both agree</span>
            </div>
          </div>

          <div className="profile-sections">
            {profile.sections && profile.sections.length > 0 ? (
              profile.sections.map(section => renderSection(section))
            ) : (
              <div className="empty-state">No content selected</div>
            )}
          </div>
        </div>

        {/* Right Panel - CV Preview / Job Analysis */}
        <div className="profile-preview-panel">
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            padding: '0.5rem',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
            <button
              onClick={() => setPreviewMode('cv')}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: previewMode === 'cv' ? '2px solid #667eea' : '2px solid #e2e8f0',
                background: previewMode === 'cv' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                color: previewMode === 'cv' ? 'white' : '#718096',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              📄 CV Preview
            </button>
            <button
              onClick={() => setPreviewMode('openai')}
              disabled={!cv.job_analysis || cv.job_analysis.length === 0}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: previewMode === 'openai' ? '2px solid #059669' : '2px solid #e2e8f0',
                background: previewMode === 'openai' ? '#059669' : 'white',
                color: previewMode === 'openai' ? 'white' : '#718096',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: (!cv.job_analysis || cv.job_analysis.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!cv.job_analysis || cv.job_analysis.length === 0) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              🟢 GPT-4o Analysis
            </button>
            <button
              onClick={() => setPreviewMode('claude')}
              disabled={!cv.job_analysis || cv.job_analysis.length === 0}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: previewMode === 'claude' ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                background: previewMode === 'claude' ? '#4f46e5' : 'white',
                color: previewMode === 'claude' ? 'white' : '#718096',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: (!cv.job_analysis || cv.job_analysis.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!cv.job_analysis || cv.job_analysis.length === 0) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              🔵 Claude Analysis
            </button>
          </div>

          {/* Conditional Content */}
          {previewMode === 'cv' && <CVPreview profile={profile} hiddenItems={hiddenItems} />}

          {previewMode === 'openai' && cv.job_analysis && cv.job_analysis.length > 0 && (
            <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
              {(() => {
                const openaiAnalysis = cv.job_analysis.find(a => a.provider === 'openai');
                if (!openaiAnalysis) {
                  return <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>No OpenAI analysis available</div>;
                }
                if (openaiAnalysis.error) {
                  return (
                    <div style={{ color: '#dc3545', padding: '1rem', background: '#fff5f5', borderRadius: '6px', border: '1px solid #feb2b2' }}>
                      ⚠️ Error: {openaiAnalysis.error}
                    </div>
                  );
                }
                return (
                  <div>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      🟢 OpenAI GPT-4o Job Requirements Analysis
                    </h3>
                    {renderAnalysisSection('Job Category & Level',
                      `${openaiAnalysis.analysis.job_category || openaiAnalysis.analysis['Job Category'] || 'N/A'} - ${openaiAnalysis.analysis.job_level || openaiAnalysis.analysis['Job Level'] || 'N/A'}`
                    )}
                    {renderAnalysisSection('Technical Skills', openaiAnalysis.analysis.technical_skills || openaiAnalysis.analysis['Technical Skills'])}
                    {renderAnalysisSection('Soft Skills', openaiAnalysis.analysis.soft_skills || openaiAnalysis.analysis['Soft Skills'])}
                    {renderAnalysisSection('Required Experience', openaiAnalysis.analysis.required_experience || openaiAnalysis.analysis['Required Experience'])}
                    {renderAnalysisSection('Experience Requirements', openaiAnalysis.analysis.experience_requirements || openaiAnalysis.analysis['Experience Requirements'])}
                    {renderAnalysisSection('Education Requirements', openaiAnalysis.analysis.education_requirements || openaiAnalysis.analysis['Education Requirements'])}
                    {renderAnalysisSection('Nice to Have', openaiAnalysis.analysis.nice_to_have || openaiAnalysis.analysis['Nice to Have'])}
                    {renderAnalysisSection('Preferred Qualifications', openaiAnalysis.analysis.preferred_qualifications || openaiAnalysis.analysis['Preferred Qualifications'])}
                    {renderAnalysisSection('Key Responsibilities', openaiAnalysis.analysis.key_responsibilities || openaiAnalysis.analysis['Key Responsibilities'])}
                    {renderAnalysisSection('Responsibilities', openaiAnalysis.analysis.responsibilities || openaiAnalysis.analysis['Responsibilities'])}
                    {renderAnalysisSection('Domain/Industry', openaiAnalysis.analysis.domain_industry || openaiAnalysis.analysis['Domain/Industry'])}
                  </div>
                );
              })()}
            </div>
          )}

          {previewMode === 'claude' && cv.job_analysis && cv.job_analysis.length > 0 && (
            <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
              {(() => {
                const claudeAnalysis = cv.job_analysis.find(a => a.provider === 'anthropic');
                if (!claudeAnalysis) {
                  return <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>No Claude analysis available</div>;
                }
                if (claudeAnalysis.error) {
                  return (
                    <div style={{ color: '#dc3545', padding: '1rem', background: '#fff5f5', borderRadius: '6px', border: '1px solid #feb2b2' }}>
                      ⚠️ Error: {claudeAnalysis.error}
                    </div>
                  );
                }
                return (
                  <div>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      🔵 Anthropic Claude Sonnet 4.5 Job Requirements Analysis
                    </h3>
                    {renderAnalysisSection('Job Category & Level',
                      `${claudeAnalysis.analysis.job_category || claudeAnalysis.analysis['Job Category'] || 'N/A'} - ${claudeAnalysis.analysis.job_level || claudeAnalysis.analysis['Job Level'] || 'N/A'}`
                    )}
                    {renderAnalysisSection('Technical Skills', claudeAnalysis.analysis.technical_skills || claudeAnalysis.analysis['Technical Skills'])}
                    {renderAnalysisSection('Soft Skills', claudeAnalysis.analysis.soft_skills || claudeAnalysis.analysis['Soft Skills'])}
                    {renderAnalysisSection('Required Experience', claudeAnalysis.analysis.required_experience || claudeAnalysis.analysis['Required Experience'])}
                    {renderAnalysisSection('Experience Requirements', claudeAnalysis.analysis.experience_requirements || claudeAnalysis.analysis['Experience Requirements'])}
                    {renderAnalysisSection('Education Requirements', claudeAnalysis.analysis.education_requirements || claudeAnalysis.analysis['Education Requirements'])}
                    {renderAnalysisSection('Nice to Have', claudeAnalysis.analysis.nice_to_have || claudeAnalysis.analysis['Nice to Have'])}
                    {renderAnalysisSection('Preferred Qualifications', claudeAnalysis.analysis.preferred_qualifications || claudeAnalysis.analysis['Preferred Qualifications'])}
                    {renderAnalysisSection('Key Responsibilities', claudeAnalysis.analysis.key_responsibilities || claudeAnalysis.analysis['Key Responsibilities'])}
                    {renderAnalysisSection('Responsibilities', claudeAnalysis.analysis.responsibilities || claudeAnalysis.analysis['Responsibilities'])}
                    {renderAnalysisSection('Domain/Industry', claudeAnalysis.analysis.domain_industry || claudeAnalysis.analysis['Domain/Industry'])}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TailoredCVs;
