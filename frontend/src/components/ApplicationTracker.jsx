import { useState, useEffect } from 'react';
import './ApplicationTracker.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: '📝', color: '#6c757d' },
  applied: { label: 'Applied', icon: '📤', color: '#007bff' },
  under_review: { label: 'Under Review', icon: '🔎', color: '#17a2b8' },
  phone_screen: { label: 'Phone Screen', icon: '📞', color: '#ffc107' },
  interview: { label: 'Interview', icon: '💼', color: '#fd7e14' },
  offer: { label: 'Offer', icon: '✅', color: '#28a745' },
  accepted: { label: 'Accepted', icon: '🎉', color: '#20c997' },
  rejected: { label: 'Rejected', icon: '❌', color: '#dc3545' },
  withdrawn: { label: 'Withdrawn', icon: '🚫', color: '#6c757d' }
};

function ApplicationTracker() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (applications.length > 0) {
      calculateStats();
    }
  }, [applications]);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/cv/tailored-versions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = applications.length;
    const byStatus = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});

    const active = applications.filter(app =>
      !['rejected', 'withdrawn', 'accepted'].includes(app.status)
    ).length;

    const interviews = (byStatus.phone_screen || 0) + (byStatus.interview || 0);
    const offers = byStatus.offer || 0;
    const accepted = byStatus.accepted || 0;

    setStats({ total, active, interviews, offers, accepted, byStatus });
  };

  const updateApplicationStatus = async (appId, newStatus, additionalData = {}) => {
    try {
      const token = localStorage.getItem('token');

      // Add status history entry
      const app = applications.find(a => a.id === appId);
      const statusHistory = app.status_history || [];
      statusHistory.push({
        status: newStatus,
        date: new Date().toISOString(),
        notes: additionalData.notes || ''
      });

      const updateData = {
        status: newStatus,
        status_history: statusHistory,
        ...additionalData
      };

      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        await fetchApplications();
        if (selectedApp && selectedApp.id === appId) {
          const updatedApp = await response.json();
          setSelectedApp(updatedApp);
        }
      }
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };

  const getFilteredAndSortedApplications = () => {
    let filtered = applications;

    if (filterStatus !== 'all') {
      filtered = applications.filter(app => app.status === filterStatus);
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'created_at_asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'company':
          return (a.company_name || '').localeCompare(b.company_name || '');
        case 'fit_score':
          const aFit = ((a.openai_fit_score || 0) + (a.claude_fit_score || 0)) / 2;
          const bFit = ((b.openai_fit_score || 0) + (b.claude_fit_score || 0)) / 2;
          return bFit - aFit;
        default:
          return 0;
      }
    });

    return sorted;
  };

  const getAverageScore = (app, scoreType) => {
    const openai = app[`openai_${scoreType}_score`] || 0;
    const claude = app[`claude_${scoreType}_score`] || 0;
    return openai && claude ? Math.round((openai + claude) / 2) : (openai || claude || 0);
  };

  const downloadPDF = async (appId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/cv/tailored-versions/${appId}/download-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hidden_items: [], template_name: 'modern' })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CV_${appId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="application-tracker">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="application-tracker">
      <div className="tracker-header">
        <h1>📈 Application Tracker</h1>
        <p className="tracker-subtitle">
          Track all your job applications in one place. Monitor status, view analytics, and manage your job search pipeline.
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card stat-total">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Applications</div>
            </div>
          </div>
          <div className="stat-card stat-active">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
          </div>
          <div className="stat-card stat-interviews">
            <div className="stat-icon">💼</div>
            <div className="stat-content">
              <div className="stat-value">{stats.interviews}</div>
              <div className="stat-label">Interviews</div>
            </div>
          </div>
          <div className="stat-card stat-offers">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.offers}</div>
              <div className="stat-label">Offers</div>
            </div>
          </div>
        </div>
      )}

      {/* Status Pipeline Visualization */}
      <div className="status-pipeline">
        <h3>Application Pipeline</h3>
        <div className="pipeline-stages">
          {Object.entries(STATUS_CONFIG).filter(([key]) =>
            !['draft', 'withdrawn'].includes(key)
          ).map(([status, config]) => (
            <div
              key={status}
              className="pipeline-stage"
              style={{ borderColor: config.color }}
            >
              <div className="stage-icon">{config.icon}</div>
              <div className="stage-label">{config.label}</div>
              <div className="stage-count" style={{ backgroundColor: config.color }}>
                {stats?.byStatus[status] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="tracker-controls">
        <div className="filter-section">
          <label>Filter by Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
        <div className="sort-section">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at_desc">Newest First</option>
            <option value="created_at_asc">Oldest First</option>
            <option value="company">Company Name</option>
            <option value="fit_score">Fit Score (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Applications Yet</h3>
          <p>Start by creating a tailored CV for a job you're interested in.</p>
          <p>Once you save it, it will appear here for tracking.</p>
        </div>
      ) : (
        <div className="applications-table">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Job Title</th>
                <th>Status</th>
                <th>Fit Score</th>
                <th>ATS Score</th>
                <th>Applied Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredAndSortedApplications().map((app) => {
                const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;
                const fitScore = getAverageScore(app, 'fit');
                const atsScore = getAverageScore(app, 'ats');

                return (
                  <tr key={app.id} onClick={() => setSelectedApp(app)} className="app-row">
                    <td>
                      <strong>{app.company_name || 'N/A'}</strong>
                    </td>
                    <td>{app.job_title}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: statusConfig.color }}
                      >
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </td>
                    <td>
                      <div className="score-cell">
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{ width: `${fitScore}%`, backgroundColor: fitScore >= 75 ? '#28a745' : fitScore >= 50 ? '#ffc107' : '#dc3545' }}
                          ></div>
                        </div>
                        <span className="score-value">{fitScore}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="score-cell">
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{ width: `${atsScore}%`, backgroundColor: atsScore >= 75 ? '#28a745' : atsScore >= 50 ? '#ffc107' : '#dc3545' }}
                          ></div>
                        </div>
                        <span className="score-value">{atsScore}%</span>
                      </div>
                    </td>
                    <td>
                      {app.application_date
                        ? new Date(app.application_date).toLocaleDateString()
                        : new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                        title="View Details"
                      >
                        🔍
                      </button>
                      <button
                        className="btn-icon"
                        onClick={(e) => { e.stopPropagation(); downloadPDF(app.id); }}
                        title="Download PDF"
                      >
                        📥
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Application Detail Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdateStatus={updateApplicationStatus}
          onDownloadPDF={downloadPDF}
          onRefresh={fetchApplications}
        />
      )}
    </div>
  );
}

function ApplicationDetailModal({ app, onClose, onUpdateStatus, onDownloadPDF, onRefresh }) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(app.status);
  const [statusNotes, setStatusNotes] = useState('');

  const fitScore = ((app.openai_fit_score || 0) + (app.claude_fit_score || 0)) / 2;
  const atsScore = ((app.openai_ats_score || 0) + (app.claude_ats_score || 0)) / 2;

  const handleStatusUpdate = () => {
    onUpdateStatus(app.id, newStatus, { notes: statusNotes });
    setIsEditingStatus(false);
    setStatusNotes('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content application-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{app.job_title}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Company Info */}
          <div className="detail-section">
            <h3>📍 Company Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Company:</label>
                <span>{app.company_name || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Location:</label>
                <span>{app.job_location || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Salary Range:</label>
                <span>{app.salary_range || 'N/A'}</span>
              </div>
              {app.application_url && (
                <div className="detail-item detail-item-full">
                  <label>Job Posting:</label>
                  <a href={app.application_url} target="_blank" rel="noopener noreferrer">
                    View Original Posting →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Status Management */}
          <div className="detail-section">
            <h3>📊 Application Status</h3>
            <div className="status-management">
              <div className="current-status">
                <label>Current Status:</label>
                <span
                  className="status-badge-large"
                  style={{ backgroundColor: STATUS_CONFIG[app.status]?.color }}
                >
                  {STATUS_CONFIG[app.status]?.icon} {STATUS_CONFIG[app.status]?.label}
                </span>
              </div>

              {!isEditingStatus ? (
                <button className="btn-update-status" onClick={() => setIsEditingStatus(true)}>
                  Update Status
                </button>
              ) : (
                <div className="status-update-form">
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Add notes (optional)"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={3}
                  />
                  <div className="status-update-actions">
                    <button className="btn-save" onClick={handleStatusUpdate}>Save</button>
                    <button className="btn-cancel" onClick={() => setIsEditingStatus(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Status History */}
            {app.status_history && app.status_history.length > 0 && (
              <div className="status-history">
                <h4>Status History</h4>
                <div className="history-timeline">
                  {app.status_history.map((entry, idx) => (
                    <div key={idx} className="history-entry">
                      <div className="history-date">
                        {new Date(entry.date).toLocaleDateString()}
                      </div>
                      <div className="history-status">
                        {STATUS_CONFIG[entry.status]?.icon} {STATUS_CONFIG[entry.status]?.label}
                      </div>
                      {entry.notes && <div className="history-notes">{entry.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Scores */}
          <div className="detail-section">
            <h3>🎯 AI Analysis Scores</h3>
            <div className="scores-grid">
              <div className="score-card">
                <div className="score-card-header">Profile Fit</div>
                <div className="score-card-body">
                  <div className="score-comparison">
                    <div className="score-item">
                      <span className="score-label">🟢 OpenAI:</span>
                      <span className="score-value">{app.openai_fit_score || 0}%</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">🔵 Claude:</span>
                      <span className="score-value">{app.claude_fit_score || 0}%</span>
                    </div>
                  </div>
                  <div className="score-average">Average: {Math.round(fitScore)}%</div>
                </div>
              </div>
              <div className="score-card">
                <div className="score-card-header">ATS Compatibility</div>
                <div className="score-card-body">
                  <div className="score-comparison">
                    <div className="score-item">
                      <span className="score-label">🟢 OpenAI:</span>
                      <span className="score-value">{app.openai_ats_score || 0}%</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">🔵 Claude:</span>
                      <span className="score-value">{app.claude_ats_score || 0}%</span>
                    </div>
                  </div>
                  <div className="score-average">Average: {Math.round(atsScore)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="detail-section">
            <h3>📅 Important Dates</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Created:</label>
                <span>{new Date(app.created_at).toLocaleDateString()}</span>
              </div>
              <div className="detail-item">
                <label>Last Updated:</label>
                <span>{new Date(app.updated_at).toLocaleDateString()}</span>
              </div>
              {app.application_date && (
                <div className="detail-item">
                  <label>Applied:</label>
                  <span>{new Date(app.application_date).toLocaleDateString()}</span>
                </div>
              )}
              {app.follow_up_date && (
                <div className="detail-item">
                  <label>Follow-up:</label>
                  <span>{new Date(app.follow_up_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {app.notes && (
            <div className="detail-section">
              <h3>📝 Notes</h3>
              <div className="notes-content">{app.notes}</div>
            </div>
          )}

          {/* Actions */}
          <div className="detail-actions">
            <button className="btn-primary" onClick={() => onDownloadPDF(app.id)}>
              📥 Download CV PDF
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationTracker;
