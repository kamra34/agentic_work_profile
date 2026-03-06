import { useEffect, useMemo, useState } from 'react';
import './AdminPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PERSONAL_INFO_LABELS = {
  phone_number: 'Phone',
  country: 'Country',
  city: 'City',
  professional_title: 'Professional Title',
  years_of_experience: 'Years of Experience',
  bio: 'Bio',
  availability: 'Availability',
  preferred_work_mode: 'Preferred Work Mode'
};

const ONLINE_LABELS = {
  linkedin_url: 'LinkedIn',
  github_url: 'GitHub',
  portfolio_url: 'Portfolio'
};

function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

function renderCountMap(mapValue, emptyLabel = 'No data yet') {
  const entries = Object.entries(mapValue || {}).filter(([, count]) => Number(count) > 0);
  if (!entries.length) {
    return <div className="admin-empty-line">{emptyLabel}</div>;
  }
  return (
    <div className="admin-tag-grid">
      {entries.map(([label, count]) => (
        <div key={label} className="admin-tag-item">
          <span>{label}</span>
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  );
}

function renderInfoMap(mapValue, labels) {
  const entries = Object.entries(mapValue || {});
  if (!entries.length) {
    return <div className="admin-empty-line">No additional values.</div>;
  }
  return (
    <div className="admin-info-grid">
      {entries.map(([key, value]) => (
        <div className="admin-info-item" key={key}>
          <div className="admin-info-label">{labels[key] || key}</div>
          <div className="admin-info-value">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function renderLinksMap(mapValue) {
  const entries = Object.entries(mapValue || {});
  if (!entries.length) {
    return <div className="admin-empty-line">No online links added.</div>;
  }
  return (
    <div className="admin-info-grid">
      {entries.map(([key, value]) => (
        <div className="admin-info-item" key={key}>
          <div className="admin-info-label">{ONLINE_LABELS[key] || key}</div>
          <a className="admin-info-link" href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        </div>
      ))}
    </div>
  );
}

function AdminPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState(null);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const token = localStorage.getItem('token');
  const adminCount = useMemo(() => users.filter((item) => item.is_admin).length, [users]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load users');
      }

      const usersData = Array.isArray(data) ? data : [];
      setUsers(usersData);
      if (!usersData.length) {
        setSelectedUserId(null);
        setSelectedUserDetail(null);
        return;
      }

      const preferredUser = selectedUserId
        ? usersData.find((item) => item.id === selectedUserId)
        : usersData.find((item) => item.id === currentUser?.id) || usersData[0];
      if (preferredUser) {
        setSelectedUserId(preferredUser.id);
      }
    } catch (error) {
      setUsersError(error.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchUserDetail = async (userId) => {
    if (!userId) return;
    setLoadingDetail(true);
    setDetailError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load user details');
      }
      setSelectedUserDetail(data);
    } catch (error) {
      setDetailError(error.message || 'Failed to load user details');
      setSelectedUserDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.is_admin) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.is_admin]);

  useEffect(() => {
    if (!currentUser?.is_admin || !selectedUserId) return;
    fetchUserDetail(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.is_admin, selectedUserId]);

  const updateAdminRole = async (targetUser, nextValue) => {
    if (!targetUser) return;
    setUpdatingRoleUserId(targetUser.id);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${targetUser.id}/admin`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_admin: nextValue })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update admin role');
      }

      setUsers((prev) => prev.map((item) => (item.id === data.id ? { ...item, is_admin: data.is_admin } : item)));
      if (selectedUserDetail?.id === data.id) {
        setSelectedUserDetail((prev) => (prev ? { ...prev, is_admin: data.is_admin } : prev));
      }
    } catch (error) {
      alert(error.message || 'Failed to update admin role');
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleAdminPasswordReset = async (targetUser) => {
    if (!targetUser) return;
    const password = window.prompt(`Set a temporary password for ${targetUser.email}:`);
    if (password === null) return;
    const trimmed = password.trim();
    if (trimmed.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setResettingPasswordUserId(targetUser.id);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${targetUser.id}/reset-password`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_password: trimmed })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      alert('Password reset completed. Share the temporary password securely with the user.');
    } catch (error) {
      alert(error.message || 'Failed to reset password');
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!targetUser) return;
    if (targetUser.id === currentUser.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (targetUser.is_admin) {
      alert('Admin users cannot be deleted from Admin Console.');
      return;
    }

    const confirmed = window.confirm(
      `Delete user "${targetUser.full_name}" (${targetUser.email})?\n\nThis will remove their profile and related records permanently.`
    );
    if (!confirmed) return;

    setDeletingUserId(targetUser.id);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete user');
      }

      const remaining = users.filter((item) => item.id !== targetUser.id);
      setUsers(remaining);
      if (selectedUserId === targetUser.id) {
        const nextUser = remaining[0] || null;
        setSelectedUserId(nextUser ? nextUser.id : null);
        setSelectedUserDetail(null);
      }
    } catch (error) {
      alert(error.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!currentUser?.is_admin) {
    return (
      <div className="admin-page">
        <div className="admin-unauthorized">
          <h2>Admin Access Required</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-hero">
        <div className="admin-hero-text">
          <h1>Admin Console</h1>
          <p>User management, activity insights, and secure account operations.</p>
        </div>
        <div className="admin-hero-stats">
          <div className="admin-stat-pill">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>
          <div className="admin-stat-pill">
            <span>Admins</span>
            <strong>{adminCount}</strong>
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <section className="admin-users">
          <div className="admin-section-head">
            <h3>Registered Users</h3>
            <button type="button" className="admin-refresh-btn" onClick={fetchUsers} disabled={loadingUsers}>
              {loadingUsers ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {usersError && <div className="admin-error">{usersError}</div>}
          {loadingUsers ? (
            <div className="admin-loading">Loading users...</div>
          ) : (
            <div className="admin-user-list">
              {users.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`admin-user-card ${selectedUserId === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUserId(item.id)}
                >
                  <div className="admin-user-card-top">
                    <strong>{item.full_name}</strong>
                    <span className={`admin-role-badge ${item.is_admin ? 'admin' : 'user'}`}>
                      {item.is_admin ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <div className="admin-user-email">{item.email}</div>
                  <div className="admin-user-quick-stats">
                    <span>P:{item.profiles_count}</span>
                    <span>N:{item.nodes_count}</span>
                    <span>CV:{item.tailored_cvs_count}</span>
                    <span>App:{item.applications_count}</span>
                  </div>
                  <div className="admin-user-meta">Last activity: {formatDate(item.last_activity_at)}</div>
                </button>
              ))}
              {!users.length && <div className="admin-empty-line">No users found.</div>}
            </div>
          )}
        </section>

        <section className="admin-detail">
          <div className="admin-section-head">
            <h3>User Details</h3>
          </div>
          {loadingDetail && <div className="admin-loading">Loading user details...</div>}
          {detailError && <div className="admin-error">{detailError}</div>}

          {!loadingDetail && !detailError && selectedUserDetail && (
            <div className="admin-detail-content">
              <div className="admin-detail-top">
                <div>
                  <h2>{selectedUserDetail.full_name}</h2>
                  <p>{selectedUserDetail.email}</p>
                </div>
                <div className="admin-role-actions">
                  <button
                    type="button"
                    className="admin-action-btn grant"
                    onClick={() => updateAdminRole(selectedUserDetail, true)}
                    disabled={updatingRoleUserId === selectedUserDetail.id || selectedUserDetail.is_admin}
                  >
                    Make Admin
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn revoke"
                    onClick={() => updateAdminRole(selectedUserDetail, false)}
                    disabled={
                      updatingRoleUserId === selectedUserDetail.id ||
                      !selectedUserDetail.is_admin ||
                      selectedUserDetail.id === currentUser.id
                    }
                  >
                    Revoke Admin
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn reset"
                    onClick={() => handleAdminPasswordReset(selectedUserDetail)}
                    disabled={resettingPasswordUserId === selectedUserDetail.id || selectedUserDetail.id === currentUser.id}
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn delete"
                    onClick={() => handleDeleteUser(selectedUserDetail)}
                    disabled={
                      deletingUserId === selectedUserDetail.id ||
                      selectedUserDetail.id === currentUser.id ||
                      selectedUserDetail.is_admin
                    }
                  >
                    {deletingUserId === selectedUserDetail.id ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>

              <div className="admin-kpi-grid">
                <div className="admin-kpi-card"><span>Profiles</span><strong>{selectedUserDetail.profiles_count}</strong></div>
                <div className="admin-kpi-card"><span>Nodes</span><strong>{selectedUserDetail.nodes_count}</strong></div>
                <div className="admin-kpi-card"><span>Tailored CVs</span><strong>{selectedUserDetail.tailored_cvs_count}</strong></div>
                <div className="admin-kpi-card"><span>Applications</span><strong>{selectedUserDetail.applications_count}</strong></div>
                <div className="admin-kpi-card"><span>Jobs Analyzed</span><strong>{selectedUserDetail.jobs_analyzed_count}</strong></div>
                <div className="admin-kpi-card"><span>Score Recalcs</span><strong>{selectedUserDetail.score_recalculation_runs}</strong></div>
              </div>

              <div className="admin-box">
                <h4>Personal Information</h4>
                {renderInfoMap(selectedUserDetail.personal_info, PERSONAL_INFO_LABELS)}
              </div>

              <div className="admin-box">
                <h4>Online Presence</h4>
                {renderLinksMap(selectedUserDetail.online_presence)}
              </div>

              <div className="admin-dual-grid">
                <div className="admin-box">
                  <h4>Tailored CV Status</h4>
                  {renderCountMap(selectedUserDetail.tailored_cv_status_counts)}
                </div>
                <div className="admin-box">
                  <h4>Application Status</h4>
                  {renderCountMap(selectedUserDetail.application_status_counts)}
                </div>
              </div>

              <div className="admin-box">
                <h4>CV Templates Used</h4>
                {renderCountMap(selectedUserDetail.cv_format_counts)}
              </div>

              <div className="admin-box">
                <h4>Recent Roles</h4>
                {!selectedUserDetail.recent_roles?.length ? (
                  <div className="admin-empty-line">No tailored CV activity yet.</div>
                ) : (
                  <div className="admin-recent-list">
                    {selectedUserDetail.recent_roles.map((role) => (
                      <div key={role.tailored_cv_id} className="admin-recent-item">
                        <div>
                          <strong>{role.job_title || 'Untitled role'}</strong>
                          <p>{role.company_name || 'Unknown company'}</p>
                        </div>
                        <div>
                          <span className="admin-status-chip">{role.status || 'draft'}</span>
                          <p className="admin-status-source">
                            {role.status_source === 'application' ? 'From application' : 'From tailored CV'}
                          </p>
                          <p>{formatDate(role.updated_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loadingDetail && !detailError && !selectedUserDetail && (
            <div className="admin-empty-line">Select a user to view detailed stats.</div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminPage;
