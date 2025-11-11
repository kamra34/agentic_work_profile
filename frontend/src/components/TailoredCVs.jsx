import React, { useState, useEffect } from 'react';
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
  const [notes, setNotes] = useState(cv.notes || '');
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${cv.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...cv,
          notes: notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      alert('✅ Notes saved successfully');
      onUpdate();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cv-detail-container">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to List
        </button>
        <h1>{cv.job_title}</h1>
        {cv.company_name && <h2>{cv.company_name}</h2>}
      </div>

      <div className="detail-metadata">
        <div className="metadata-item">
          <span className="metadata-label">Created:</span>
          <span className="metadata-value">{new Date(cv.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="metadata-item">
          <span className="metadata-label">Status:</span>
          <span className="metadata-value">{cv.status || 'draft'}</span>
        </div>
      </div>

      {/* AI Scores */}
      <div className="detail-scores">
        <h3>📊 AI Analysis Scores</h3>
        <div className="scores-grid">
          <div className="score-card">
            <h4>Profile Fit Score</h4>
            <div className="score-values">
              {cv.openai_fit_score && <div className="score-value openai">🟢 OpenAI: {cv.openai_fit_score}%</div>}
              {cv.claude_fit_score && <div className="score-value claude">🔵 Claude: {cv.claude_fit_score}%</div>}
            </div>
          </div>
          <div className="score-card">
            <h4>ATS Compatibility Score</h4>
            <div className="score-values">
              {cv.openai_ats_score && <div className="score-value openai">🟢 OpenAI: {cv.openai_ats_score}%</div>}
              {cv.claude_ats_score && <div className="score-value claude">🔵 Claude: {cv.claude_ats_score}%</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Content Summary */}
      <div className="detail-content-summary">
        <h3>📝 Selected Content</h3>
        {cv.selected_content && (
          <div className="content-stats">
            {cv.selected_content.summary_items && cv.selected_content.summary_items.length > 0 && (
              <div className="stat-item">
                <span className="stat-icon">📋</span>
                <span className="stat-text">{cv.selected_content.summary_items.length} Summary Items</span>
              </div>
            )}
            {cv.selected_content.work_experience && cv.selected_content.work_experience.length > 0 && (
              <div className="stat-item">
                <span className="stat-icon">💼</span>
                <span className="stat-text">{cv.selected_content.work_experience.length} Work Experience Entries</span>
              </div>
            )}
            {cv.selected_content.skills && cv.selected_content.skills.length > 0 && (
              <div className="stat-item">
                <span className="stat-icon">⚡</span>
                <span className="stat-text">{cv.selected_content.skills.length} Skills Sections</span>
              </div>
            )}
            {cv.selected_content.education_entries && cv.selected_content.education_entries.length > 0 && (
              <div className="stat-item">
                <span className="stat-icon">🎓</span>
                <span className="stat-text">{cv.selected_content.education_entries.length} Education Entries</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="detail-notes">
        <h3>📝 Notes</h3>
        <textarea
          className="notes-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this application (interview prep, follow-up tasks, feedback, etc.)..."
          rows={6}
        />
        <button
          className="btn-save-notes"
          onClick={saveNotes}
          disabled={saving}
        >
          {saving ? '💾 Saving...' : '💾 Save Notes'}
        </button>
      </div>

      {/* Job Description */}
      {cv.job_description && (
        <div className="detail-job-description">
          <h3>📄 Job Description</h3>
          <pre className="job-description-text">{cv.job_description}</pre>
        </div>
      )}
    </div>
  );
}

export default TailoredCVs;
