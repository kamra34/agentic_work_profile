import { useState, useEffect, useMemo } from 'react';
import './SavedCVs.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function SavedCVs({ onSelectCV }) {
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Advanced Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const statusFilter = 'draft'; // Always filter to draft only
  const [versionFilter, setVersionFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    fetchSavedCVs();
  }, []);

  const fetchSavedCVs = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch saved CVs');
      }

      const data = await response.json();
      setCvs(data);
    } catch (err) {
      console.error('Error fetching CVs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cvId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete CV');
      }

      // Remove from list
      setCvs(cvs.filter(cv => cv.id !== cvId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting CV:', err);
      alert('Failed to delete CV: ' + err.message);
    }
  };

  // Helper function to calculate average score
  const getAverageScore = (cv) => {
    const scores = [];

    if (cv.fit_scores?.openai?.scores?.fit_score !== null && cv.fit_scores?.openai?.scores?.fit_score !== undefined) {
      scores.push(cv.fit_scores.openai.scores.fit_score);
    }
    if (cv.fit_scores?.claude?.scores?.fit_score !== null && cv.fit_scores?.claude?.scores?.fit_score !== undefined) {
      scores.push(cv.fit_scores.claude.scores.fit_score);
    }
    if (cv.ats_scores?.openai?.scores?.ats_score !== null && cv.ats_scores?.openai?.scores?.ats_score !== undefined) {
      scores.push(cv.ats_scores.openai.scores.ats_score);
    }
    if (cv.ats_scores?.claude?.scores?.ats_score !== null && cv.ats_scores?.claude?.scores?.ats_score !== undefined) {
      scores.push(cv.ats_scores.claude.scores.ats_score);
    }

    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  // Advanced filtering and sorting logic
  const filteredAndSortedCVs = useMemo(() => {
    let filtered = [...cvs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cv =>
        cv.job_title?.toLowerCase().includes(query) ||
        cv.company_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(cv => cv.status === statusFilter);
    }

    // Version filter
    if (versionFilter === 'latest') {
      filtered = filtered.filter(cv => cv.is_latest);
    } else if (versionFilter === 'older') {
      filtered = filtered.filter(cv => !cv.is_latest);
    }

    // Score filter
    if (scoreFilter !== 'all') {
      filtered = filtered.filter(cv => {
        const avgScore = getAverageScore(cv);
        if (!avgScore) return false;

        switch(scoreFilter) {
          case 'excellent': return avgScore >= 85;
          case 'good': return avgScore >= 70 && avgScore < 85;
          case 'fair': return avgScore >= 50 && avgScore < 70;
          case 'poor': return avgScore < 50;
          default: return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'updated':
          return new Date(b.updated_at) - new Date(a.updated_at);
        case 'job-title': {
          const titleA = (a.job_title || '').toLowerCase().trim();
          const titleB = (b.job_title || '').toLowerCase().trim();
          return titleA.localeCompare(titleB);
        }
        case 'company': {
          const companyA = (a.company_name || '').toLowerCase().trim();
          const companyB = (b.company_name || '').toLowerCase().trim();
          return companyA.localeCompare(companyB);
        }
        case 'score-high':
          return (getAverageScore(b) || 0) - (getAverageScore(a) || 0);
        case 'score-low':
          return (getAverageScore(a) || 0) - (getAverageScore(b) || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [cvs, searchQuery, statusFilter, versionFilter, scoreFilter, sortBy]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'draft': { label: 'Draft', icon: '📝', className: 'status-draft' },
      'ready_to_apply': { label: 'Ready to Apply', icon: '✅', className: 'status-ready' },
      'applied': { label: 'Applied', icon: '📤', className: 'status-applied' },
      'interview': { label: 'Interview', icon: '🎤', className: 'status-interview' },
      'offer': { label: 'Offer', icon: '🎉', className: 'status-offer' },
      'rejected': { label: 'Rejected', icon: '❌', className: 'status-rejected' }
    };

    const config = statusConfig[status] || statusConfig['draft'];
    return (
      <span className={`status-badge ${config.className}`}>
        <span className="status-icon">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (!score) return 'score-none';
    if (score >= 85) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-fair';
    return 'score-poor';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Statistics calculation
  const statistics = useMemo(() => {
    const stats = {
      total: cvs.length,
      draft: cvs.filter(cv => cv.status === 'draft').length,
      ready_to_apply: cvs.filter(cv => cv.status === 'ready_to_apply').length,
      applied: cvs.filter(cv => cv.status === 'applied').length,
      interview: cvs.filter(cv => cv.status === 'interview').length,
      offer: cvs.filter(cv => cv.status === 'offer').length,
      rejected: cvs.filter(cv => cv.status === 'rejected').length,
      latest: cvs.filter(cv => cv.is_latest).length,
      avgScore: 0
    };

    const scoresArray = cvs.map(cv => getAverageScore(cv)).filter(s => s !== null);
    if (scoresArray.length > 0) {
      stats.avgScore = (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(1);
    }

    return stats;
  }, [cvs]);

  if (loading) {
    return (
      <div className="saved-cvs-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your saved CVs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saved-cvs-container">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <h3>Error Loading CVs</h3>
          <p>{error}</p>
          <button onClick={fetchSavedCVs} className="btn-retry">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-cvs-container">
      {/* Modern Compact Header */}
      <div className="saved-cvs-header">
        <div className="header-top">
          <div className="title-section">
            <h1>CV Portfolio</h1>
            <p className="subtitle">Manage and track your AI-optimized CVs</p>
          </div>

          {/* Compact KPI Pills */}
          <div className="kpi-pills">
            <div className="kpi-pill kpi-total">
              <span className="kpi-value">{statistics.total}</span>
              <span className="kpi-label">Total</span>
            </div>
            <div className="kpi-pill kpi-score">
              <span className="kpi-value">{statistics.avgScore || 'N/A'}</span>
              <span className="kpi-label">Avg Score</span>
            </div>
            <div className="kpi-pill kpi-ready">
              <span className="kpi-value">{statistics.ready_to_apply}</span>
              <span className="kpi-label">Ready</span>
            </div>
            <div className="kpi-pill kpi-draft">
              <span className="kpi-value">{statistics.draft}</span>
              <span className="kpi-label">Draft</span>
            </div>
          </div>

          <button onClick={fetchSavedCVs} className="btn-refresh-compact" title="Refresh">
            🔄
          </button>
        </div>

        {/* Compact Search & Filter Bar */}
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by job title or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
          >
            <option value="all">All Versions</option>
            <option value="latest">Latest</option>
            <option value="older">Older</option>
          </select>

          <select
            className="filter-select"
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
          >
            <option value="all">All Scores</option>
            <option value="excellent">85+</option>
            <option value="good">70-84</option>
            <option value="fair">50-69</option>
            <option value="poor">&lt;50</option>
          </select>

          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="updated">Updated</option>
            <option value="job-title">Job Title</option>
            <option value="company">Company</option>
            <option value="score-high">Score ↓</option>
            <option value="score-low">Score ↑</option>
          </select>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {(searchQuery || versionFilter !== 'all' || scoreFilter !== 'all') && (
        <div className="results-summary">
          <span className="results-count">
            {filteredAndSortedCVs.length} of {cvs.length} CVs
          </span>
          {(searchQuery || versionFilter !== 'all' || scoreFilter !== 'all') && (
            <button
              className="clear-filters"
              onClick={() => {
                setSearchQuery('');
                setVersionFilter('all');
                setScoreFilter('all');
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* CVs Display */}
      {cvs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No Saved CVs Yet</h3>
          <p>Create your first AI-tailored CV to get started</p>
          <div className="empty-features">
            <div className="feature-item">
              <span className="feature-icon">🤖</span>
              <span>AI-Powered Optimization</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>ATS Score Analysis</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✨</span>
              <span>Smart Content Selection</span>
            </div>
          </div>
        </div>
      ) : filteredAndSortedCVs.length === 0 ? (
        <div className="no-results-state">
          <div className="no-results-icon">🔍</div>
          <h3>No CVs Match Your Filters</h3>
          <p>Try adjusting your search or filter criteria</p>
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchQuery('');
              setVersionFilter('all');
              setScoreFilter('all');
            }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className={`cvs-container ${viewMode === 'list' ? 'list-view' : 'grid-view'}`}>
          {filteredAndSortedCVs.map(cv => {
            const avgScore = getAverageScore(cv);

            return (
              <div key={cv.id} className={`cv-card ${viewMode === 'list' ? 'list-card' : ''}`}>
                <div className="cv-card-header">
                  <div className="cv-title-section">
                    <h3 className="cv-job-title">{cv.job_title}</h3>
                    {cv.company_name && (
                      <p className="cv-company">{cv.company_name}</p>
                    )}
                  </div>

                  <div className="cv-badges">
                    {getStatusBadge(cv.status)}

                    {cv.total_versions > 1 && (
                      <span className={`version-badge ${cv.is_latest ? 'latest' : 'older'}`}>
                        v{cv.version}/{cv.total_versions}
                        {cv.is_latest && <span className="latest-indicator">●</span>}
                      </span>
                    )}
                  </div>
                </div>

                <div className="cv-card-body">
                  {/* Overall Score Indicator */}
                  {avgScore !== null && (
                    <div className={`score-indicator ${getScoreColor(avgScore)}`}>
                      <div className="score-circle">
                        <span className="score-number">{avgScore.toFixed(0)}</span>
                      </div>
                      <span className="score-label-text">Overall Score</span>
                    </div>
                  )}

                  {/* Detailed Scores */}
                  <div className="cv-scores">
                    <div className="score-row">
                      <span className="score-row-label">Profile Fit</span>
                      <div className="score-values">
                        {cv.fit_scores?.openai?.scores?.fit_score !== null && cv.fit_scores?.openai?.scores?.fit_score !== undefined ? (
                          <span className="score openai-score" title="GPT-5.1">
                            {cv.fit_scores.openai.scores.fit_score}
                          </span>
                        ) : (
                          <span className="score score-na">-</span>
                        )}
                        {cv.fit_scores?.claude?.scores?.fit_score !== null && cv.fit_scores?.claude?.scores?.fit_score !== undefined ? (
                          <span className="score claude-score" title="Claude">
                            {cv.fit_scores.claude.scores.fit_score}
                          </span>
                        ) : (
                          <span className="score score-na">-</span>
                        )}
                      </div>
                    </div>

                    <div className="score-row">
                      <span className="score-row-label">ATS Score</span>
                      <div className="score-values">
                        {cv.ats_scores?.openai?.scores?.ats_score !== null && cv.ats_scores?.openai?.scores?.ats_score !== undefined ? (
                          <span className="score openai-score" title="GPT-5.1">
                            {cv.ats_scores.openai.scores.ats_score}
                          </span>
                        ) : (
                          <span className="score score-na">-</span>
                        )}
                        {cv.ats_scores?.claude?.scores?.ats_score !== null && cv.ats_scores?.claude?.scores?.ats_score !== undefined ? (
                          <span className="score claude-score" title="Claude">
                            {cv.ats_scores.claude.scores.ats_score}
                          </span>
                        ) : (
                          <span className="score score-na">-</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meta Information */}
                  <div className="cv-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      <span className="meta-text" title={`Created: ${formatDateTime(cv.created_at)}`}>
                        {formatDate(cv.created_at)}
                      </span>
                    </div>
                    {cv.updated_at !== cv.created_at && (
                      <div className="meta-item">
                        <span className="meta-icon">✏️</span>
                        <span className="meta-text" title={`Updated: ${formatDateTime(cv.updated_at)}`}>
                          Edited {formatDate(cv.updated_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cv-card-actions">
                  <button
                    onClick={() => onSelectCV && onSelectCV(cv.id)}
                    className="btn-view"
                  >
                    <span className="btn-icon">👁️</span>
                    View & Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cv.id)}
                    className="btn-delete"
                    title="Delete CV"
                  >
                    🗑️
                  </button>
                </div>

                {deleteConfirm === cv.id && (
                  <div className="delete-confirm-overlay">
                    <div className="delete-confirm">
                      <span className="confirm-icon">⚠️</span>
                      <p>Delete this CV permanently?</p>
                      <div className="confirm-actions">
                        <button
                          onClick={() => handleDelete(cv.id)}
                          className="btn-confirm-delete"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SavedCVs;
