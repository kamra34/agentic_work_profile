import { useState, useEffect } from 'react';
import './ApplicationTracker.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_CONFIG = {
  preparing: { label: 'Preparing', icon: '📋', color: 'var(--status-preparing)', stage: 1 },
  ready_to_apply: { label: 'Ready', icon: '🎯', color: 'var(--status-ready)', stage: 2 },
  applied: { label: 'Applied', icon: '📤', color: 'var(--status-applied)', stage: 3 },
  phone_screen: { label: 'Phone Screen', icon: '📞', color: 'var(--status-phone)', stage: 4 },
  interview: { label: 'Interview', icon: '💼', color: 'var(--status-interview)', stage: 5 },
  offer_received: { label: 'Offer', icon: '🎁', color: 'var(--status-offer)', stage: 6 },
  accepted: { label: 'Accepted', icon: '🎉', color: 'var(--status-accepted)', stage: 7 },
  rejected: { label: 'Rejected', icon: '❌', color: 'var(--status-rejected)', stage: -1 },
  withdrawn: { label: 'Withdrawn', icon: '🚫', color: 'var(--status-withdrawn)', stage: -2 }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', icon: '⬇️', color: '#94a3b8' },
  medium: { label: 'Medium', icon: '➡️', color: '#60a5fa' },
  high: { label: 'High', icon: '⬆️', color: '#f59e0b' },
  urgent: { label: 'Urgent', icon: '🔥', color: '#ef4444' }
};

const VIEW_MODES = {
  KANBAN: 'kanban',
  TABLE: 'table',
  CALENDAR: 'calendar',
  ANALYTICS: 'analytics'
};

function ApplicationTracker() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [viewMode, setViewMode] = useState(VIEW_MODES.KANBAN);
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

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

      // Fetch both tailored CVs (preparing status) and job applications
      const [tailoredResponse, applicationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/tailor/list?status=draft`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/applications/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const combinedData = [];

      // Add tailored CVs with "draft" status (preparing - not yet finalized)
      if (tailoredResponse.ok) {
        const tailoredCVs = await tailoredResponse.json();
        // Map tailored CVs to match job application structure
        const preparingCVs = tailoredCVs.map(cv => ({
          ...cv,
          status: 'preparing', // Map draft status to preparing for kanban display
          priority: cv.priority || 'medium',
          // Keep fit_scores and ats_scores as-is from tailored_cvs table
          // fit_scores and ats_scores are already present in cv object
          isPreparing: true // Flag to identify these are from tailored_cvs
          // Note: No application_date for preparing CVs - they haven't been applied yet
        }));
        combinedData.push(...preparingCVs);
      }

      // Add confirmed job applications
      if (applicationsResponse.ok) {
        const applications = await applicationsResponse.json();
        combinedData.push(...applications);
      }

      setApplications(combinedData);
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
    const offers = byStatus.offer_received || 0;
    const accepted = byStatus.accepted || 0;
    const rejected = byStatus.rejected || 0;

    // Calculate success metrics
    const appliedCount = Object.entries(byStatus)
      .filter(([status]) => !['preparing', 'ready_to_apply'].includes(status))
      .reduce((sum, [, count]) => sum + count, 0);

    const interviewRate = appliedCount > 0 ? ((interviews / appliedCount) * 100).toFixed(1) : 0;
    const offerRate = appliedCount > 0 ? ((offers / appliedCount) * 100).toFixed(1) : 0;
    const responseRate = appliedCount > 0 ? (((interviews + rejected) / appliedCount) * 100).toFixed(1) : 0;

    // Average scores - include both preparing CVs and job applications
    const appsWithScores = applications.filter(app => {
      // For preparing CVs, check fit_scores and ats_scores
      if (app.isPreparing) {
        return app.fit_scores && app.ats_scores;
      }
      // For job applications, check initial/final scores
      return (app.final_fit_scores || app.initial_fit_scores) &&
             (app.final_ats_scores || app.initial_ats_scores);
    });

    const getScoreValue = (app, scoreType, provider) => {
      // Get the appropriate scores object
      let scores;
      if (app.isPreparing) {
        scores = scoreType === 'fit' ? app.fit_scores : app.ats_scores;
      } else {
        scores = app[`final_${scoreType}_scores`] || app[`initial_${scoreType}_scores`];
      }

      if (!scores) return 0;

      const providerData = scores[provider];
      if (!providerData) return 0;

      // Handle nested structure: {openai: {scores: {fit_score: 85, ats_score: 75}}}
      if (providerData.scores) {
        const scoreField = scoreType === 'fit' ? 'fit_score' : 'ats_score';
        return providerData.scores[scoreField] || 0;
      }

      // Legacy flat structure {openai: {score: 85}} or {openai: 85}
      if (providerData.score !== undefined) return providerData.score;
      if (typeof providerData === 'number') return providerData;

      return 0;
    };

    const avgFitScore = appsWithScores.length > 0
      ? Math.round(appsWithScores.reduce((sum, app) => {
          const openai = getScoreValue(app, 'fit', 'openai');
          const claude = getScoreValue(app, 'fit', 'claude');
          return sum + (openai + claude) / 2;
        }, 0) / appsWithScores.length)
      : 0;

    const avgAtsScore = appsWithScores.length > 0
      ? Math.round(appsWithScores.reduce((sum, app) => {
          const openai = getScoreValue(app, 'ats', 'openai');
          const claude = getScoreValue(app, 'ats', 'claude');
          return sum + (openai + claude) / 2;
        }, 0) / appsWithScores.length)
      : 0;

    setStats({
      total,
      active,
      interviews,
      offers,
      accepted,
      rejected,
      byStatus,
      interviewRate,
      offerRate,
      responseRate,
      avgFitScore,
      avgAtsScore
    });
  };

  const updateApplicationStatus = async (appId, newStatus, additionalData = {}) => {
    try {
      const token = localStorage.getItem('token');

      const updateData = {
        status: newStatus,
        ...additionalData
      };

      const response = await fetch(`${API_URL}/api/applications/${appId}`, {
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

  const deleteApplication = async (appId, isPreparing = false) => {
    // Confirm before deleting
    if (!window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // Delete from appropriate endpoint based on whether it's a preparing CV or job application
      const endpoint = isPreparing
        ? `${API_URL}/api/tailor/${appId}`
        : `${API_URL}/api/applications/${appId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Close modal if it's open for this app
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp(null);
        }
        // Refresh the list
        await fetchApplications();
      } else {
        const error = await response.json();
        alert(`Failed to delete application: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting application:', error);
      alert('An error occurred while deleting the application. Please try again.');
    }
  };

  const getFilteredAndSortedApplications = () => {
    let filtered = applications;

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(app => app.priority === filterPriority);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.job_title?.toLowerCase().includes(query) ||
        app.company_name?.toLowerCase().includes(query) ||
        app.notes?.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(app => {
        const appDate = new Date(app.application_date || app.created_at);
        if (dateRange.start && appDate < new Date(dateRange.start)) return false;
        if (dateRange.end && appDate > new Date(dateRange.end)) return false;
        return true;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'created_at_asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'company':
          return (a.company_name || '').localeCompare(b.company_name || '');
        case 'fit_score':
          const getAvgFit = (app) => {
            // Get the appropriate scores object
            let scores;
            if (app.isPreparing) {
              scores = app.fit_scores;
            } else {
              scores = app.final_fit_scores || app.initial_fit_scores;
            }
            if (!scores) return 0;

            // Extract scores from nested structure
            const getScoreFromProvider = (provider) => {
              const providerData = scores[provider];
              if (!providerData) return 0;
              if (providerData.scores?.fit_score) return providerData.scores.fit_score;
              if (providerData.score !== undefined) return providerData.score;
              if (typeof providerData === 'number') return providerData;
              return 0;
            };

            const openai = getScoreFromProvider('openai');
            const claude = getScoreFromProvider('claude');
            return (openai + claude) / 2;
          };
          const aFit = getAvgFit(a);
          const bFit = getAvgFit(b);
          return bFit - aFit;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        default:
          return 0;
      }
    });

    return sorted;
  };

  const getAverageScore = (app, scoreType) => {
    // For preparing CVs (from tailored_cvs table), use fit_scores/ats_scores directly
    // For job applications, use final scores if available, otherwise fall back to initial scores
    let scores;
    if (app.isPreparing) {
      scores = scoreType === 'fit' ? app.fit_scores : app.ats_scores;
    } else {
      scores = app[`final_${scoreType}_scores`] || app[`initial_${scoreType}_scores`];
    }

    if (!scores) return 0;

    // Handle nested structure used by both tailored_cvs and job_applications:
    // {openai: {scores: {fit_score: 85, ats_score: 75}}, claude: {scores: {fit_score: 90, ats_score: 80}}}
    const getScore = (provider) => {
      const providerData = scores[provider];
      if (!providerData) return 0;

      // Nested structure: provider.scores.fit_score or provider.scores.ats_score
      if (providerData.scores) {
        const scoreField = scoreType === 'fit' ? 'fit_score' : 'ats_score';
        return providerData.scores[scoreField] || 0;
      }

      // Legacy flat structure {openai: {score: 85}} or {openai: 85}
      if (providerData.score !== undefined) return providerData.score;
      if (typeof providerData === 'number') return providerData;

      return 0;
    };

    const openai = getScore('openai');
    const claude = getScore('claude');

    return openai && claude ? Math.round((openai + claude) / 2) : (openai || claude || 0);
  };

  const downloadPDF = async (appId) => {
    // TODO: Implement PDF download endpoint for job applications
    alert('PDF download feature coming soon! You can view the application details in the modal.');
    console.log('Download PDF for application:', appId);
  };

  const groupByStatus = () => {
    const groups = {};
    Object.keys(STATUS_CONFIG).forEach(status => {
      groups[status] = getFilteredAndSortedApplications().filter(app => app.status === status);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="application-tracker">
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="application-tracker modern">
      {/* Header */}
      <div className="tracker-header-modern">
        <div className="header-top">
          <div className="header-title-section">
            <h1 className="gradient-text">📈 Application Tracker</h1>
            <p className="tracker-subtitle-modern">
              Your intelligent job search command center
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-refresh" onClick={fetchApplications}>
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Stats Dashboard */}
      {stats && (
        <div className="stats-dashboard-modern">
          <div className="stats-row-primary">
            <div className="stat-card-modern stat-gradient-blue">
              <div className="stat-icon-modern">📊</div>
              <div className="stat-content-modern">
                <div className="stat-value-modern">{stats.total}</div>
                <div className="stat-label-modern">Total Applications</div>
              </div>
            </div>
            <div className="stat-card-modern stat-gradient-green">
              <div className="stat-icon-modern">⚡</div>
              <div className="stat-content-modern">
                <div className="stat-value-modern">{stats.active}</div>
                <div className="stat-label-modern">Active Pipeline</div>
              </div>
            </div>
            <div className="stat-card-modern stat-gradient-orange">
              <div className="stat-icon-modern">💼</div>
              <div className="stat-content-modern">
                <div className="stat-value-modern">{stats.interviews}</div>
                <div className="stat-label-modern">Interviews</div>
              </div>
            </div>
            <div className="stat-card-modern stat-gradient-purple">
              <div className="stat-icon-modern">🎁</div>
              <div className="stat-content-modern">
                <div className="stat-value-modern">{stats.offers}</div>
                <div className="stat-label-modern">Offers Received</div>
              </div>
            </div>
          </div>

          <div className="stats-row-secondary">
            <div className="stat-card-small">
              <div className="stat-small-label">Interview Rate</div>
              <div className="stat-small-value">{stats.interviewRate}%</div>
              <div className="stat-small-bar">
                <div className="stat-small-fill" style={{ width: `${stats.interviewRate}%` }}></div>
              </div>
            </div>
            <div className="stat-card-small">
              <div className="stat-small-label">Offer Rate</div>
              <div className="stat-small-value">{stats.offerRate}%</div>
              <div className="stat-small-bar">
                <div className="stat-small-fill" style={{ width: `${stats.offerRate}%` }}></div>
              </div>
            </div>
            <div className="stat-card-small">
              <div className="stat-small-label">Response Rate</div>
              <div className="stat-small-value">{stats.responseRate}%</div>
              <div className="stat-small-bar">
                <div className="stat-small-fill" style={{ width: `${stats.responseRate}%` }}></div>
              </div>
            </div>
            <div className="stat-card-small">
              <div className="stat-small-label">Avg Fit Score</div>
              <div className="stat-small-value">{stats.avgFitScore}%</div>
              <div className="stat-small-bar">
                <div className="stat-small-fill" style={{ width: `${stats.avgFitScore}%` }}></div>
              </div>
            </div>
            <div className="stat-card-small">
              <div className="stat-small-label">Avg ATS Score</div>
              <div className="stat-small-value">{stats.avgAtsScore}%</div>
              <div className="stat-small-bar">
                <div className="stat-small-fill" style={{ width: `${stats.avgAtsScore}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Selector */}
      <div className="view-mode-selector">
        <div className="view-mode-tabs">
          <button
            className={`view-mode-tab ${viewMode === VIEW_MODES.KANBAN ? 'active' : ''}`}
            onClick={() => setViewMode(VIEW_MODES.KANBAN)}
          >
            📋 Kanban Board
          </button>
          <button
            className={`view-mode-tab ${viewMode === VIEW_MODES.TABLE ? 'active' : ''}`}
            onClick={() => setViewMode(VIEW_MODES.TABLE)}
          >
            📊 Table View
          </button>
          <button
            className={`view-mode-tab ${viewMode === VIEW_MODES.ANALYTICS ? 'active' : ''}`}
            onClick={() => setViewMode(VIEW_MODES.ANALYTICS)}
          >
            📈 Analytics
          </button>
        </div>

        <button
          className="btn-toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '✕ Hide' : '🔍 Show'} Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>🔍 Search</label>
            <input
              type="text"
              placeholder="Search by company, job title, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>📊 Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🎯 Priority</label>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="filter-select">
              <option value="all">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🔄 Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="company">Company Name</option>
              <option value="fit_score">Fit Score (High to Low)</option>
              <option value="priority">Priority (High to Low)</option>
            </select>
          </div>

          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('all');
              setFilterPriority('all');
              setDateRange({ start: null, end: null });
              setSortBy('created_at_desc');
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Content Views */}
      {applications.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-illustration">📭</div>
          <h3>No Applications Yet</h3>
          <p>Start by creating a tailored CV for a job you're interested in.</p>
          <p>Once you save it, it will appear here for tracking.</p>
        </div>
      ) : (
        <>
          {viewMode === VIEW_MODES.KANBAN && (
            <KanbanView
              groups={groupByStatus()}
              onSelectApp={setSelectedApp}
              onUpdateStatus={updateApplicationStatus}
              onDeleteApp={deleteApplication}
              onRefresh={fetchApplications}
              getAverageScore={getAverageScore}
            />
          )}

          {viewMode === VIEW_MODES.TABLE && (
            <TableView
              applications={getFilteredAndSortedApplications()}
              onSelectApp={setSelectedApp}
              onDownloadPDF={downloadPDF}
              onDeleteApp={deleteApplication}
              getAverageScore={getAverageScore}
            />
          )}

          {viewMode === VIEW_MODES.ANALYTICS && (
            <AnalyticsView
              applications={applications}
              stats={stats}
            />
          )}
        </>
      )}

      {/* Application Detail Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdateStatus={updateApplicationStatus}
          onDeleteApp={deleteApplication}
          onRefresh={fetchApplications}
        />
      )}
    </div>
  );
}

// Kanban View Component
function KanbanView({ groups, onSelectApp, onUpdateStatus, onDeleteApp, onRefresh, getAverageScore }) {
  const [draggedApp, setDraggedApp] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Include rejected in the kanban board, but exclude withdrawn
  const activeStatuses = Object.keys(STATUS_CONFIG).filter(
    status => status !== 'withdrawn'
  );

  const handleDragStart = (app) => {
    setDraggedApp(app);
  };

  const handleDragEnd = () => {
    setDraggedApp(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault(); // Required to allow drop
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // Helper function to determine which dates to clear when moving backward
  const getDatesToClear = (currentStatus, targetStatus) => {
    // Define the status order (stage numbers from STATUS_CONFIG)
    const statusOrder = {
      preparing: 1,
      ready_to_apply: 2,
      applied: 3,
      phone_screen: 4,
      interview: 5,
      offer_received: 6,
      accepted: 7,
      rejected: 8,  // Terminal state, but needs to be cleared if moving back
      withdrawn: 9  // Terminal state, but needs to be cleared if moving back
    };

    const currentStage = statusOrder[currentStatus] || 0;
    const targetStage = statusOrder[targetStatus] || 0;

    // Map status to date field
    const statusDateMap = {
      ready_to_apply: 'ready_date',
      applied: 'applied_date',
      phone_screen: 'phone_screen_date',
      interview: 'interview_date',
      offer_received: 'offer_date',
      accepted: 'accepted_date',
      rejected: 'rejected_date',
      withdrawn: 'withdrawn_date'
    };

    // If moving backward (lower stage number) OR from terminal states, clear dates for all statuses ahead of target
    if (targetStage < currentStage && targetStage > 0) {
      const datesToClear = [];

      // Clear all dates for statuses ahead of the target (including terminal states)
      for (const [status, stage] of Object.entries(statusOrder)) {
        if (stage > targetStage && statusDateMap[status]) {
          datesToClear.push(statusDateMap[status]);
        }
      }

      return datesToClear;
    }

    // If moving from terminal state (rejected/withdrawn) back to any regular state
    if ((currentStatus === 'rejected' || currentStatus === 'withdrawn') && targetStage > 0) {
      const datesToClear = [];

      // Clear terminal state dates
      if (currentStatus === 'rejected') {
        datesToClear.push('rejected_date');
      }
      if (currentStatus === 'withdrawn') {
        datesToClear.push('withdrawn_date');
      }

      // Also clear all dates ahead of the target
      for (const [status, stage] of Object.entries(statusOrder)) {
        if (stage > targetStage && status !== 'rejected' && status !== 'withdrawn' && statusDateMap[status]) {
          datesToClear.push(statusDateMap[status]);
        }
      }

      return datesToClear;
    }

    return [];
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();

    if (!draggedApp) return;

    // Prevent dragging "preparing" items to other columns
    if (draggedApp.isPreparing) {
      alert('Cannot move "Preparing" items to other statuses. Please finalize the CV first by saving it to the Application Tracker from the CV detail page.');
      setDraggedApp(null);
      setDragOverColumn(null);
      return;
    }

    // Handle moving back to "preparing" status
    if (targetStatus === 'preparing') {
      const confirmed = window.confirm(
        'Are you sure you want to move this application back to "Preparing"?\n\n' +
        'This will:\n' +
        '• Change the tailored CV status back to "draft"\n' +
        '• Remove it from the Application Tracker\n' +
        '• Make it editable again in Saved CVs'
      );

      if (!confirmed) {
        setDraggedApp(null);
        setDragOverColumn(null);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/applications/${draggedApp.id}/move-to-preparing`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          // Refresh the applications list to show updated state
          await onRefresh();
        } else {
          const error = await response.json();
          alert(`Failed to move application: ${error.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error moving application to preparing:', error);
        alert('An error occurred while moving the application. Please try again.');
      }

      setDraggedApp(null);
      setDragOverColumn(null);
      return;
    }

    // Only update if status actually changed
    if (draggedApp.status !== targetStatus) {
      // Calculate dates to clear when moving backward
      const datesToClear = getDatesToClear(draggedApp.status, targetStatus);

      // Pass dates to clear along with the status update
      onUpdateStatus(draggedApp.id, targetStatus, { clear_dates: datesToClear });
    }

    setDraggedApp(null);
    setDragOverColumn(null);
  };

  return (
    <div className="kanban-board">
      {activeStatuses.map(status => (
        <div
          key={status}
          className={`kanban-column ${dragOverColumn === status ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="kanban-column-header" style={{ borderTopColor: STATUS_CONFIG[status].color }}>
            <div className="column-title">
              <span className="column-icon">{STATUS_CONFIG[status].icon}</span>
              <span className="column-label">{STATUS_CONFIG[status].label}</span>
            </div>
            <span className="column-count">{groups[status]?.length || 0}</span>
          </div>
          <div className="kanban-column-content">
            {groups[status]?.map(app => (
              <KanbanCard
                key={app.id}
                app={app}
                onSelect={onSelectApp}
                onUpdateStatus={onUpdateStatus}
                onDeleteApp={onDeleteApp}
                getAverageScore={getAverageScore}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={draggedApp?.id === app.id}
              />
            ))}
            {(!groups[status] || groups[status].length === 0) && (
              <div className="kanban-empty">No applications</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Kanban Card Component
function KanbanCard({ app, onSelect, onUpdateStatus, onDeleteApp, getAverageScore, onDragStart, onDragEnd, isDragging }) {
  const fitScore = getAverageScore(app, 'fit');
  const atsScore = getAverageScore(app, 'ats');
  const priorityConfig = PRIORITY_CONFIG[app.priority || 'medium'];

  // Format labels for CV template
  const formatLabels = {
    professional: 'Professional',
    modern: 'Modern',
    compact: 'Compact',
    creative: 'Creative'
  };

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent card click event
    onDeleteApp(app.id, app.isPreparing);
  };

  const handleDragStart = (e) => {
    onDragStart(app);
  };

  const handleDragEnd = (e) => {
    onDragEnd();
  };

  return (
    <div
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(app)}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="card-header">
        <h4 className="card-job-title">{app.job_title}</h4>
        <span className="card-company">{app.company_name || 'N/A'}</span>
      </div>

      <div className="card-scores">
        <div className="card-score-item">
          <span className="score-label-small">Fit</span>
          <div className="score-badge" style={{ backgroundColor: fitScore >= 75 ? 'var(--success-color)' : fitScore >= 50 ? 'var(--warning-color)' : 'var(--danger-color)' }}>
            {fitScore}%
          </div>
        </div>
        <div className="card-score-item">
          <span className="score-label-small">ATS</span>
          <div className="score-badge" style={{ backgroundColor: atsScore >= 75 ? 'var(--success-color)' : atsScore >= 50 ? 'var(--warning-color)' : 'var(--danger-color)' }}>
            {atsScore}%
          </div>
        </div>
      </div>

      <div className="card-metadata">
        {/* CV Format */}
        {app.cv_format && (
          <div className="card-meta-item" title="CV Template Format">
            📄 {formatLabels[app.cv_format] || app.cv_format}
          </div>
        )}

        {/* Priority */}
        <div className="card-meta-item card-priority" style={{ color: priorityConfig.color }}>
          {priorityConfig.icon} {priorityConfig.label}
        </div>
      </div>

      <div className="card-footer">
        <span className="card-date">
          {app.isPreparing ? '📝' : '📅'} {new Date(app.application_date || app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <div className="card-actions">
          {app.notes && (
            <span className="card-has-notes" title="Has notes">📝</span>
          )}
          <button
            className="btn-delete-card"
            onClick={handleDelete}
            title="Delete application"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// Table View Component
function TableView({ applications, onSelectApp, onDownloadPDF, onDeleteApp, getAverageScore }) {
  const formatLabels = {
    professional: 'Professional',
    modern: 'Modern',
    compact: 'Compact',
    creative: 'Creative'
  };

  return (
    <div className="table-view-modern">
      <table className="applications-table-modern">
        <thead>
          <tr>
            <th>Priority</th>
            <th>Company</th>
            <th>Job Title</th>
            <th>CV Format</th>
            <th>Status</th>
            <th>Fit Score</th>
            <th>ATS Score</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map(app => {
            const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.preparing;
            const priorityConfig = PRIORITY_CONFIG[app.priority || 'medium'];
            const fitScore = getAverageScore(app, 'fit');
            const atsScore = getAverageScore(app, 'ats');

            return (
              <tr key={app.id} onClick={() => onSelectApp(app)} className="app-row-modern">
                <td>
                  <div className="priority-cell" style={{ color: priorityConfig.color }} title={priorityConfig.label}>
                    {priorityConfig.icon}
                  </div>
                </td>
                <td>
                  <strong>{app.company_name || 'N/A'}</strong>
                </td>
                <td className="job-title-cell">{app.job_title}</td>
                <td>
                  <span className="cv-format-badge">
                    📄 {app.cv_format ? formatLabels[app.cv_format] || app.cv_format : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="status-badge-modern" style={{ backgroundColor: statusConfig.color }}>
                    {statusConfig.icon} {statusConfig.label}
                  </span>
                </td>
                <td>
                  <div className="score-cell-modern">
                    <div className="score-bar-modern">
                      <div
                        className="score-fill-modern"
                        style={{
                          width: `${fitScore}%`,
                          backgroundColor: fitScore >= 75 ? 'var(--success-color)' : fitScore >= 50 ? 'var(--warning-color)' : 'var(--danger-color)'
                        }}
                      ></div>
                    </div>
                    <span className="score-value-modern">{fitScore}%</span>
                  </div>
                </td>
                <td>
                  <div className="score-cell-modern">
                    <div className="score-bar-modern">
                      <div
                        className="score-fill-modern"
                        style={{
                          width: `${atsScore}%`,
                          backgroundColor: atsScore >= 75 ? 'var(--success-color)' : atsScore >= 50 ? 'var(--warning-color)' : 'var(--danger-color)'
                        }}
                      ></div>
                    </div>
                    <span className="score-value-modern">{atsScore}%</span>
                  </div>
                </td>
                <td>
                  {app.application_date
                    ? new Date(app.application_date).toLocaleDateString()
                    : new Date(app.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div className="action-buttons-group">
                    <button
                      className="btn-icon-modern"
                      onClick={(e) => { e.stopPropagation(); onSelectApp(app); }}
                      title="View Details"
                    >
                      🔍
                    </button>
                    <button
                      className="btn-icon-modern"
                      onClick={(e) => { e.stopPropagation(); onDownloadPDF(app.id); }}
                      title="Download PDF"
                    >
                      📥
                    </button>
                    <button
                      className="btn-icon-modern btn-delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteApp(app.id, app.isPreparing); }}
                      title="Delete Application"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Analytics View Component
function AnalyticsView({ applications, stats }) {
  const statusDistribution = Object.entries(stats.byStatus).map(([status, count]) => ({
    status,
    count,
    label: STATUS_CONFIG[status]?.label || status,
    color: STATUS_CONFIG[status]?.color || '#ccc'
  }));

  // Timeline data - applications over time
  const timelineData = applications.reduce((acc, app) => {
    const date = new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="analytics-view">
      <div className="analytics-grid">
        {/* Status Distribution Chart */}
        <div className="analytics-card">
          <h3>📊 Status Distribution</h3>
          <div className="chart-container">
            {statusDistribution.map(({ status, count, label, color }) => (
              <div key={status} className="chart-bar-item">
                <div className="chart-bar-label">{label}</div>
                <div className="chart-bar-wrapper">
                  <div
                    className="chart-bar-fill"
                    style={{
                      width: `${(count / stats.total) * 100}%`,
                      backgroundColor: color
                    }}
                  >
                    <span className="chart-bar-count">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Success Metrics */}
        <div className="analytics-card">
          <h3>🎯 Success Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-icon">💼</div>
              <div className="metric-data">
                <div className="metric-value">{stats.interviewRate}%</div>
                <div className="metric-label">Interview Rate</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-icon">🎁</div>
              <div className="metric-data">
                <div className="metric-value">{stats.offerRate}%</div>
                <div className="metric-label">Offer Rate</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-icon">📬</div>
              <div className="metric-data">
                <div className="metric-value">{stats.responseRate}%</div>
                <div className="metric-label">Response Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Application Timeline */}
        <div className="analytics-card analytics-card-wide">
          <h3>📈 Application Timeline</h3>
          <div className="timeline-chart">
            {Object.entries(timelineData).map(([date, count]) => (
              <div key={date} className="timeline-item">
                <div className="timeline-date">{date}</div>
                <div className="timeline-bar-wrapper">
                  <div
                    className="timeline-bar"
                    style={{
                      height: `${(count / Math.max(...Object.values(timelineData))) * 100}%`
                    }}
                  >
                    <span className="timeline-count">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score Analysis */}
        <div className="analytics-card">
          <h3>⭐ Score Analysis</h3>
          <div className="score-analysis">
            <div className="score-analysis-item">
              <div className="score-analysis-label">Average Fit Score</div>
              <div className="score-analysis-bar">
                <div className="score-analysis-fill" style={{ width: `${stats.avgFitScore}%` }}></div>
              </div>
              <div className="score-analysis-value">{stats.avgFitScore}%</div>
            </div>
            <div className="score-analysis-item">
              <div className="score-analysis-label">Average ATS Score</div>
              <div className="score-analysis-bar">
                <div className="score-analysis-fill" style={{ width: `${stats.avgAtsScore}%` }}></div>
              </div>
              <div className="score-analysis-value">{stats.avgAtsScore}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Application Detail Modal Component
function ApplicationDetailModal({ app, onClose, onUpdateStatus, onDeleteApp, onRefresh }) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(app.status);
  const [statusNotes, setStatusNotes] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(app.cv_format || 'professional');
  const [isExporting, setIsExporting] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    // Prevent scrolling on mount
    document.body.style.overflow = 'hidden';

    // Cleanup: restore scrolling when modal closes
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Get scores from app (handles both preparing CVs and job applications)
  const getScoreFromApp = (scoreType, provider) => {
    // Get the appropriate scores object
    let scores;
    if (app.isPreparing) {
      scores = scoreType === 'fit' ? app.fit_scores : app.ats_scores;
    } else {
      // For job applications, use final scores
      const scoreColumn = scoreType === 'fit' ? 'final_fit_scores' : 'final_ats_scores';
      scores = app[scoreColumn];
    }

    if (!scores || !scores[provider]) return 0;

    const providerData = scores[provider];

    // Nested structure: {openai: {scores: {fit_score: 85, ats_score: 75}}}
    if (providerData.scores) {
      const scoreField = scoreType === 'fit' ? 'fit_score' : 'ats_score';
      return providerData.scores[scoreField] || 0;
    }

    // Legacy flat structure fallback
    if (providerData.score !== undefined) return providerData.score;
    if (typeof providerData === 'number') return providerData;

    return 0;
  };

  const fitScoreOpenAI = getScoreFromApp('fit', 'openai');
  const fitScoreClaude = getScoreFromApp('fit', 'claude');
  const atsScoreOpenAI = getScoreFromApp('ats', 'openai');
  const atsScoreClaude = getScoreFromApp('ats', 'claude');

  const fitScore = (fitScoreOpenAI + fitScoreClaude) / 2;
  const atsScore = (atsScoreOpenAI + atsScoreClaude) / 2;

  const handleStatusUpdate = () => {
    onUpdateStatus(app.id, newStatus, { notes: statusNotes });
    setIsEditingStatus(false);
    setStatusNotes('');
  };

  const handleExportCV = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');

      // Get the tailored_cv_id to export
      const cvId = app.isPreparing ? app.id : app.tailored_cv_id;

      if (!cvId) {
        alert('No CV associated with this application');
        return;
      }

      const response = await fetch(`${API_URL}/api/cv/${cvId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          format: selectedTemplate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.job_title || 'CV'}_${selectedTemplate}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportOptions(false);
    } catch (error) {
      console.error('Error exporting CV:', error);
      alert('Failed to export CV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay-modern" onClick={onClose}>
      <div className="modal-content-modern" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-modern">
          <div>
            <h2 className="modal-title">{app.job_title}</h2>
            <p className="modal-company">{app.company_name || 'N/A'}</p>
          </div>
          <button className="btn-close-modern" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body-modern">
          {/* Status, Priority & CV Format */}
          <div className="detail-section-modern">
            <h3>📊 Application Details</h3>
            <div className="status-priority-grid">
              <div>
                <label>Current Status:</label>
                <span
                  className="status-badge-large"
                  style={{ backgroundColor: STATUS_CONFIG[app.status]?.color }}
                >
                  {STATUS_CONFIG[app.status]?.icon} {STATUS_CONFIG[app.status]?.label}
                </span>
              </div>
              <div>
                <label>Priority:</label>
                <span
                  className="priority-badge-large"
                  style={{ backgroundColor: PRIORITY_CONFIG[app.priority || 'medium']?.color }}
                >
                  {PRIORITY_CONFIG[app.priority || 'medium']?.icon} {PRIORITY_CONFIG[app.priority || 'medium']?.label}
                </span>
              </div>
              {app.cv_format && (
                <div>
                  <label>CV Template Format:</label>
                  <span className="cv-format-badge-large">
                    📄 {app.cv_format.charAt(0).toUpperCase() + app.cv_format.slice(1)}
                  </span>
                </div>
              )}
            </div>

            {!isEditingStatus ? (
              <button className="btn-update-status-modern" onClick={() => setIsEditingStatus(true)}>
                Update Status
              </button>
            ) : (
              <div className="status-update-form-modern">
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.icon} {config.label}</option>
                  ))}
                </select>
                <textarea
                  placeholder="Add notes (optional)"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                />
                <div className="status-update-actions-modern">
                  <button className="btn-save-modern" onClick={handleStatusUpdate}>Save</button>
                  <button className="btn-cancel-modern" onClick={() => setIsEditingStatus(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* AI Scores */}
          <div className="detail-section-modern">
            <h3>🎯 AI Analysis Scores</h3>
            <div className="scores-grid-modern">
              <div className="score-card-detail">
                <div className="score-card-detail-header">Profile Fit</div>
                <div className="score-card-detail-body">
                  <div className="score-comparison-modern">
                    <div className="score-item-modern">
                      <span>🟢 OpenAI:</span>
                      <strong>{fitScoreOpenAI}%</strong>
                    </div>
                    <div className="score-item-modern">
                      <span>🔵 Claude:</span>
                      <strong>{fitScoreClaude}%</strong>
                    </div>
                  </div>
                  <div className="score-average-modern">Average: {Math.round(fitScore)}%</div>
                </div>
              </div>
              <div className="score-card-detail">
                <div className="score-card-detail-header">ATS Compatibility</div>
                <div className="score-card-detail-body">
                  <div className="score-comparison-modern">
                    <div className="score-item-modern">
                      <span>🟢 OpenAI:</span>
                      <strong>{atsScoreOpenAI}%</strong>
                    </div>
                    <div className="score-item-modern">
                      <span>🔵 Claude:</span>
                      <strong>{atsScoreClaude}%</strong>
                    </div>
                  </div>
                  <div className="score-average-modern">Average: {Math.round(atsScore)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div className="detail-section-modern">
            <h3>📅 Timeline</h3>
            <div className="timeline-grid">
              {/* Always show Created */}
              <div className="timeline-item-detail">
                <span className="timeline-label">📋 Created</span>
                <span className="timeline-value">{new Date(app.created_at).toLocaleDateString()}</span>
              </div>

              {/* Show all non-null dates in order */}
              {app.ready_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">🎯 Ready to Apply</span>
                  <span className="timeline-value">{new Date(app.ready_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.applied_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">📤 Applied</span>
                  <span className="timeline-value">{new Date(app.applied_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.phone_screen_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">📞 Phone Screen</span>
                  <span className="timeline-value">{new Date(app.phone_screen_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.interview_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">💼 Interview</span>
                  <span className="timeline-value">{new Date(app.interview_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.offer_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">🎁 Offer Received</span>
                  <span className="timeline-value">{new Date(app.offer_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.accepted_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">🎉 Accepted</span>
                  <span className="timeline-value">{new Date(app.accepted_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.rejected_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">❌ Rejected</span>
                  <span className="timeline-value">{new Date(app.rejected_date).toLocaleDateString()}</span>
                </div>
              )}

              {app.withdrawn_date && (
                <div className="timeline-item-detail">
                  <span className="timeline-label">🚫 Withdrawn</span>
                  <span className="timeline-value">{new Date(app.withdrawn_date).toLocaleDateString()}</span>
                </div>
              )}

              {/* Always show Last Updated at the end */}
              <div className="timeline-item-detail">
                <span className="timeline-label">🔄 Last Updated</span>
                <span className="timeline-value">{new Date(app.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {app.notes && (
            <div className="detail-section-modern">
              <h3>📝 Notes</h3>
              <div className="notes-content-modern">{app.notes}</div>
            </div>
          )}

          {/* Actions */}
          <div className="detail-actions-modern">
            {/* Export CV Section */}
            <div className="export-cv-section">
              <button
                className="btn-primary-modern"
                onClick={() => setShowExportOptions(!showExportOptions)}
              >
                📥 Export CV
              </button>

              {showExportOptions && (
                <div className="export-options-panel">
                  <div className="export-template-info">
                    <span className="template-label">Current Template:</span>
                    <span className="template-name">{app.cv_format || 'professional'}</span>
                  </div>
                  <div className="export-template-selector">
                    <label htmlFor="template-select">Select Template:</label>
                    <select
                      id="template-select"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="template-dropdown"
                    >
                      <option value="professional">Professional</option>
                      <option value="modern">Modern</option>
                      <option value="compact">Compact</option>
                      <option value="creative">Creative</option>
                    </select>
                  </div>
                  <button
                    className="btn-export"
                    onClick={handleExportCV}
                    disabled={isExporting}
                  >
                    {isExporting ? '⏳ Exporting...' : '📄 Export PDF'}
                  </button>
                </div>
              )}
            </div>

            <button
              className="btn-danger-modern"
              onClick={() => {
                onDeleteApp(app.id, app.isPreparing);
                onClose();
              }}
            >
              🗑️ Delete Application
            </button>
            <button className="btn-secondary-modern" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationTracker;
