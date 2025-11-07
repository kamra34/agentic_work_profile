import { useState, useEffect } from 'react';
import './ProfileEditor.css';

const API_URL = 'http://localhost:8000';

function ProfileEditor({ profile: initialProfile, onProfileUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    } else {
      fetchProfile();
    }
  }, [initialProfile]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        if (onProfileUpdate) onProfileUpdate(data);
      } else if (response.status === 404) {
        setError('No profile found. Please upload your CV first.');
      } else {
        throw new Error('Failed to load profile');
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

  const deleteSection = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${sectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchProfile();
      } else {
        throw new Error('Failed to delete section');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchProfile();
      } else {
        throw new Error('Failed to delete entry');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchProfile();
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="editor-empty">
        <div className="empty-icon">📄</div>
        <h3>No Profile Found</h3>
        <p>{error}</p>
        <p>Upload your CV to get started!</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div>
          <h2>Edit Your Profile</h2>
          <p className="editor-subtitle">
            File: {profile.original_filename} • Model: {profile.openai_model}
          </p>
        </div>
        <button onClick={fetchProfile} className="btn-refresh">
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="sections-container">
        {profile.sections && profile.sections.length > 0 ? (
          profile.sections.map((section) => (
            <div key={section.id} className="section-card">
              <div className="section-header">
                <div className="section-title-row">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="section-toggle"
                  >
                    <span className={`arrow ${expandedSections[section.id] ? 'expanded' : ''}`}>
                      ▶
                    </span>
                    <h3>{section.title}</h3>
                    <span className="section-type">{section.section_type}</span>
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="btn-delete-small"
                    title="Delete section"
                  >
                    ×
                  </button>
                </div>
              </div>

              {expandedSections[section.id] && (
                <div className="section-content">
                  {section.content && (
                    <div className="section-text">
                      <p>{section.content}</p>
                    </div>
                  )}

                  {section.entries && section.entries.length > 0 && (
                    <div className="entries-container">
                      {section.entries.map((entry) => (
                        <div key={entry.id} className="entry-card">
                          <div className="entry-header">
                            <div className="entry-title-group">
                              <h4>{entry.title}</h4>
                              {entry.subtitle && (
                                <span className="entry-subtitle">{entry.subtitle}</span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="btn-delete-small"
                              title="Delete entry"
                            >
                              ×
                            </button>
                          </div>

                          <div className="entry-meta">
                            {entry.start_date && (
                              <span>
                                {entry.start_date} - {entry.end_date || 'Present'}
                              </span>
                            )}
                            {entry.location && <span>📍 {entry.location}</span>}
                          </div>

                          {entry.description && (
                            <p className="entry-description">{entry.description}</p>
                          )}

                          {entry.items && entry.items.length > 0 && (
                            <ul className="items-list">
                              {entry.items.map((item) => (
                                <li key={item.id} className="item">
                                  <span className="item-content">{item.content}</span>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    className="btn-delete-tiny"
                                    title="Delete item"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="editor-empty">
            <p>No sections found in your profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileEditor;
