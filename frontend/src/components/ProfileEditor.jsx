import { useState, useEffect } from 'react';
import './ProfileEditor.css';

const API_URL = 'http://localhost:8000';

function ProfileEditor({ profile: initialProfile, onProfileUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedEntries, setExpandedEntries] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [addingSection, setAddingSection] = useState(false);
  const [addingEntry, setAddingEntry] = useState(null);
  const [addingItem, setAddingItem] = useState(null);

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

  const toggleEntry = (entryId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const updateSection = async (sectionId, data) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${sectionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        fetchProfile();
        setEditingSection(null);
      } else {
        throw new Error('Failed to update section');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const updateEntry = async (entryId, data) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/entries/${entryId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        fetchProfile();
        setEditingEntry(null);
      } else {
        throw new Error('Failed to update entry');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const updateItem = async (itemId, content) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (response.ok) {
        fetchProfile();
        setEditingItem(null);
      } else {
        throw new Error('Failed to update item');
      }
    } catch (err) {
      setError(err.message);
    }
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

  const createSection = async (sectionData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profile/sections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sectionData)
      });

      if (response.ok) {
        fetchProfile();
        setAddingSection(false);
      } else {
        throw new Error('Failed to create section');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const createEntry = async (sectionId, entryData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entryData)
      });

      if (response.ok) {
        fetchProfile();
        setAddingEntry(null);
      } else {
        throw new Error('Failed to create entry');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const createItem = async (entryId, itemData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/entries/${entryId}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        fetchProfile();
        setAddingItem(null);
      } else {
        throw new Error('Failed to create item');
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
    <div className="editor-layout">
      <div className="editor-container">
        <div className="editor-header">
          <div>
            <h2>Edit Your Profile</h2>
            <p className="editor-subtitle">
              File: {profile.original_filename} • Model: {profile.openai_model}
            </p>
          </div>
          <div className="header-actions">
            <button onClick={() => setAddingSection(true)} className="btn-add-section">
              ➕ Add Section
            </button>
            <button onClick={fetchProfile} className="btn-refresh">
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {addingSection && (
          <div className="add-form-card">
            <div className="add-form-header">
              <h3>Add New Section</h3>
              <button onClick={() => setAddingSection(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createSection({
                title: formData.get('title'),
                section_type: formData.get('section_type'),
                content: formData.get('content') || null,
                order: 999
              });
            }}>
              <div className="form-group">
                <label>Section Title *</label>
                <input name="title" type="text" placeholder="e.g., Summary of Qualifications" required />
              </div>
              <div className="form-group">
                <label>Section Type *</label>
                <select name="section_type" required>
                  <option value="summary">Summary</option>
                  <option value="experience">Work Experience</option>
                  <option value="education">Education</option>
                  <option value="skills">Skills</option>
                  <option value="certifications">Certifications</option>
                  <option value="projects">Projects</option>
                  <option value="awards">Awards</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Content (Optional)</label>
                <textarea name="content" placeholder="For sections like Summary" rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setAddingSection(false)} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-save">Save Section</button>
              </div>
            </form>
          </div>
        )}

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
                      {editingSection === section.id ? (
                        <input
                          type="text"
                          defaultValue={section.title}
                          className="inline-edit-input"
                          onBlur={(e) => updateSection(section.id, { title: e.target.value })}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              updateSection(section.id, { title: e.target.value });
                            }
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 onClick={(e) => {
                          e.stopPropagation();
                          setEditingSection(section.id);
                        }}>
                          {section.title}
                        </h3>
                      )}
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
                        {editingSection === `${section.id}-content` ? (
                          <textarea
                            defaultValue={section.content}
                            className="inline-edit-textarea"
                            onBlur={(e) => updateSection(section.id, { content: e.target.value })}
                            autoFocus
                            rows={4}
                          />
                        ) : (
                          <>
                            <p
                              onDoubleClick={() => setEditingSection(`${section.id}-content`)}
                            >
                              {section.content}
                            </p>
                            {section.source && (
                              <span className="section-source">
                                [{section.source}]
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {section.entries && section.entries.length > 0 && (
                      <div className="entries-container">
                        {section.entries.map((entry) => (
                          <div key={entry.id} className="entry-card">
                            <div className="entry-header">
                              <button
                                onClick={() => toggleEntry(entry.id)}
                                className="entry-toggle"
                              >
                                <span className={`arrow ${expandedEntries[entry.id] ? 'expanded' : ''}`}>
                                  ▶
                                </span>
                              </button>
                              <div className="entry-title-group">
                                {editingEntry === `${entry.id}-title` ? (
                                  <input
                                    type="text"
                                    defaultValue={entry.title}
                                    className="inline-edit-input"
                                    onBlur={(e) => updateEntry(entry.id, { title: e.target.value })}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        updateEntry(entry.id, { title: e.target.value });
                                      }
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <h4 onClick={() => setEditingEntry(`${entry.id}-title`)}>
                                    {entry.title}
                                  </h4>
                                )}
                                {entry.subtitle && (
                                  editingEntry === `${entry.id}-subtitle` ? (
                                    <input
                                      type="text"
                                      defaultValue={entry.subtitle}
                                      className="inline-edit-input inline-edit-small"
                                      onBlur={(e) => updateEntry(entry.id, { subtitle: e.target.value })}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          updateEntry(entry.id, { subtitle: e.target.value });
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="entry-subtitle"
                                      onClick={() => setEditingEntry(`${entry.id}-subtitle`)}
                                    >
                                      {entry.subtitle}
                                    </span>
                                  )
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

                            {expandedEntries[entry.id] && (
                              <div className="entry-details">
                                <div className="entry-meta">
                                  {entry.start_date && (
                                    <span>
                                      {entry.start_date} - {entry.end_date || 'Present'}
                                    </span>
                                  )}
                                  {entry.location && <span>📍 {entry.location}</span>}
                                  {entry.source && (
                                    <span className="entry-source">
                                      [{entry.source}]
                                    </span>
                                  )}
                                </div>

                                {entry.description && (
                                  editingEntry === `${entry.id}-description` ? (
                                    <textarea
                                      defaultValue={entry.description}
                                      className="inline-edit-textarea"
                                      onBlur={(e) => updateEntry(entry.id, { description: e.target.value })}
                                      autoFocus
                                      rows={3}
                                    />
                                  ) : (
                                    <p
                                      className="entry-description"
                                      onDoubleClick={() => setEditingEntry(`${entry.id}-description`)}
                                    >
                                      {entry.description}
                                    </p>
                                  )
                                )}

                                {entry.items && entry.items.length > 0 && (
                              <ul className="items-list">
                                {entry.items.map((item) => (
                                  <li key={item.id} className="item">
                                    {editingItem === item.id ? (
                                      <input
                                        type="text"
                                        defaultValue={item.content}
                                        className="inline-edit-input item-edit"
                                        onBlur={(e) => updateItem(item.id, e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            updateItem(item.id, e.target.value);
                                          }
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <>
                                        <span
                                          className="item-content editable"
                                          onDoubleClick={() => {
                                            setEditingItem(item.id);
                                          }}
                                        >
                                          {item.content}
                                        </span>
                                        {item.source && (
                                          <span className="item-source">
                                            [{item.source}]
                                          </span>
                                        )}
                                      </>
                                    )}
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

                            {addingItem === entry.id ? (
                              <div className="add-item-form">
                                <input
                                  type="text"
                                  placeholder="Enter new item content..."
                                  autoFocus
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      createItem(entry.id, { content: e.target.value, order: 999 });
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value.trim()) {
                                      createItem(entry.id, { content: e.target.value, order: 999 });
                                    } else {
                                      setAddingItem(null);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingItem(entry.id)}
                                className="btn-add-item"
                              >
                                ➕ Add Item
                              </button>
                            )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {addingEntry === section.id ? (
                      <div className="add-entry-form">
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          createEntry(section.id, {
                            title: formData.get('title'),
                            subtitle: formData.get('subtitle') || null,
                            start_date: formData.get('start_date') || null,
                            end_date: formData.get('end_date') || null,
                            location: formData.get('location') || null,
                            description: formData.get('description') || null,
                            order: 999
                          });
                        }}>
                          <div className="form-row">
                            <input name="title" placeholder="Title *" required />
                            <input name="subtitle" placeholder="Subtitle (Optional)" />
                          </div>
                          <div className="form-row">
                            <input name="start_date" placeholder="Start Date (MM/YYYY)" />
                            <input name="end_date" placeholder="End Date (MM/YYYY)" />
                          </div>
                          <input name="location" placeholder="Location (Optional)" />
                          <textarea name="description" placeholder="Description (Optional)" rows="2" />
                          <div className="form-actions">
                            <button type="button" onClick={() => setAddingEntry(null)} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save">Save Entry</button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEntry(section.id)}
                        className="btn-add-entry"
                      >
                        ➕ Add Entry
                      </button>
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
    </div>
  );
}

export default ProfileEditor;
