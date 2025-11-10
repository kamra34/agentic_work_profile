import { useState, useEffect, useRef } from 'react';
import './ProfileManagement.css';
import CVPreview from './CVPreview';

const API_URL = 'http://localhost:8000';

const SECTION_TYPES = [
  { value: 'summary', label: 'Summary', icon: '📝', maxNesting: 0 },
  { value: 'work_experience', label: 'Work Experience', icon: '💼', maxNesting: 2 },
  { value: 'education', label: 'Education', icon: '🎓', maxNesting: 1 },
  { value: 'skills', label: 'Skills', icon: '⚡', maxNesting: 1 },
  { value: 'projects', label: 'Projects', icon: '🚀', maxNesting: 1 },
  { value: 'certifications', label: 'Certifications', icon: '📜', maxNesting: 1 },
  { value: 'awards', label: 'Awards', icon: '🏆', maxNesting: 1 },
  { value: 'publications', label: 'Publications', icon: '📚', maxNesting: 1 },
  { value: 'languages', label: 'Languages', icon: '🌍', maxNesting: 1 },
  { value: 'volunteer', label: 'Volunteer', icon: '🤝', maxNesting: 1 },
  { value: 'custom', label: 'Custom Section', icon: '➕', maxNesting: 1 }
];

const CONTENT_TYPES = [
  { value: 'paragraph', label: 'Paragraph', description: 'Flowing text with multiple sentences' },
  { value: 'bullets', label: 'Bullet Points', description: 'List of bullet points only' },
  { value: 'text_and_bullets', label: 'Text + Bullets', description: 'Description followed by bullets' },
  { value: 'empty', label: 'Empty', description: 'Just metadata (title, dates, etc.)' }
];

function ProfileManagement() {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfileTitle, setNewProfileTitle] = useState('');
  const sectionRefs = useRef({});
  const sectionExpandHandlers = useRef({});

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfiles(data);

        // Update selected profile with fresh data
        if (selectedProfile) {
          const updatedSelected = data.find(p => p.id === selectedProfile.id);
          if (updatedSelected) {
            setSelectedProfile(updatedSelected);
          }
        } else if (data.length > 0) {
          setSelectedProfile(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!newProfileTitle.trim()) {
      alert('Please enter a profile title');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newProfileTitle,
          is_default: profiles.length === 0
        })
      });

      if (response.ok) {
        const newProfile = await response.json();
        setProfiles([...profiles, newProfile]);
        setSelectedProfile(newProfile);
        setShowCreateProfile(false);
        setNewProfileTitle('');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      alert('Error creating profile');
    }
  };

  const deleteProfile = async (profileId) => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const updatedProfiles = profiles.filter(p => p.id !== profileId);
        setProfiles(updatedProfiles);

        // Select another profile if the deleted one was selected
        if (selectedProfile?.id === profileId) {
          setSelectedProfile(updatedProfiles[0] || null);
        }
      } else {
        alert('Error deleting profile');
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
      alert('Error deleting profile');
    }
  };

  if (loading) {
    return (
      <div className="profile-management">
        <div className="loading">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="profile-management">
      <div className="profile-header">
        <h2>Profile Management</h2>
        <p className="profile-subtitle">Create and organize your professional profiles manually</p>
      </div>

      <div className="profile-selector">
        <div className="profile-tabs">
          {profiles.map(profile => (
            <div key={profile.id} className="profile-tab-wrapper">
              <button
                className={`profile-tab ${selectedProfile?.id === profile.id ? 'active' : ''}`}
                onClick={() => setSelectedProfile(profile)}
              >
                {profile.title}
                {profile.is_default && <span className="default-badge">Default</span>}
              </button>
              <button
                className="btn-delete-profile"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProfile(profile.id);
                }}
                title="Delete profile"
              >
                ×
              </button>
            </div>
          ))}
          <button className="profile-tab new-profile-tab" onClick={() => setShowCreateProfile(true)}>
            + New Profile
          </button>
        </div>
      </div>

      {showCreateProfile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Profile</h3>
            <input
              type="text"
              className="input-field"
              placeholder="Profile title (e.g., 'Software Engineer Profile')"
              value={newProfileTitle}
              onChange={(e) => setNewProfileTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createProfile()}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => {
                setShowCreateProfile(false);
                setNewProfileTitle('');
              }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={createProfile}>
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProfile ? (
        <div className="profile-split-view">
          <div className="profile-editor-panel">
            <ProfileEditor
              profile={selectedProfile}
              onUpdate={fetchProfiles}
              sectionRefs={sectionRefs}
              sectionExpandHandlers={sectionExpandHandlers}
            />
          </div>
          <div className="profile-preview-panel">
            <CVPreview profile={selectedProfile} onSectionClick={async (clickData) => {
              // Handle both old format (section object) and new format (object with section and target)
              const section = clickData.section || clickData;
              const target = clickData.target;
              const itemId = clickData.itemId;

              const ref = sectionRefs.current[section.id];
              const expandHandler = sectionExpandHandlers.current[section.id];

              if (ref) {
                // First, expand the section if it has an expand handler
                if (expandHandler) {
                  await expandHandler();
                  // Wait a bit for the expansion animation
                  await new Promise(resolve => setTimeout(resolve, 100));
                }

                ref.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // If we have a specific target, try to focus on it
                if (target === 'content') {
                  // Focus on textarea if exists
                  const textarea = ref.querySelector('textarea');
                  if (textarea) {
                    setTimeout(() => textarea.focus(), 200);
                  }
                } else if (target === 'item' && itemId) {
                  // Wait a bit more for content to render after expansion
                  setTimeout(() => {
                    // Find and highlight the specific item
                    const itemElement = ref.querySelector(`[data-item-id="${itemId}"]`);
                    if (itemElement) {
                      itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      itemElement.style.boxShadow = '0 0 0 3px #667eea';
                      setTimeout(() => {
                        itemElement.style.boxShadow = '';
                      }, 1000);
                      return;
                    }
                  }, 200);
                  return;
                }

                // Default: Flash highlight on the section
                ref.style.boxShadow = '0 0 0 3px #667eea';
                setTimeout(() => {
                  ref.style.boxShadow = '';
                }, 1000);
              }
            }} />
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No Profiles Yet</h3>
          <p>Create your first profile to get started</p>
          <button className="btn-primary" onClick={() => setShowCreateProfile(true)}>
            Create Profile
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ profile, onUpdate, sectionRefs, sectionExpandHandlers }) {
  const [sections, setSections] = useState([]);
  const [contactInfo, setContactInfo] = useState(profile.contact_info || {});
  const [notes, setNotes] = useState(profile.notes || '');
  const [showAddSection, setShowAddSection] = useState(false);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [tempContactInfo, setTempContactInfo] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactInfoExpanded, setContactInfoExpanded] = useState(false);

  useEffect(() => {
    if (profile) {
      setSections(profile.sections || []);
      setContactInfo(profile.contact_info || {});
      setNotes(profile.notes || '');
    }
  }, [profile, refreshKey]);

  const saveContactInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contact_info: tempContactInfo })
      });
      setContactInfo(tempContactInfo);
      setShowContactEdit(false);
      await onUpdate();
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error updating contact info:', err);
      alert('Error updating contact information');
    }
  };

  const openContactEdit = () => {
    setTempContactInfo({ ...contactInfo });
    setShowContactEdit(true);
  };

  const addSection = async (sectionType) => {
    const sectionConfig = SECTION_TYPES.find(s => s.value === sectionType);

    // Determine default content type based on section type
    let defaultContentType = 'empty';
    if (sectionType === 'summary') {
      defaultContentType = 'paragraph';
    } else if (sectionType === 'skills' || sectionType === 'languages') {
      defaultContentType = 'bullets';
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profiles/${profile.id}/sections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: sectionConfig.label,
          section_type: sectionType,
          icon: sectionConfig.icon,
          content_type: defaultContentType,
          order: sections.length,
          meta_info: { source: 'manual' }
        })
      });

      if (response.ok) {
        const newSection = await response.json();
        setSections([...sections, newSection]);
        setShowAddSection(false);
        await onUpdate();
        setRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error adding section:', err);
      alert('Error adding section');
    }
  };

  return (
    <div className="profile-editor">
      <div className="contact-info-section">
        <div className="contact-info-header" onClick={() => setContactInfoExpanded(!contactInfoExpanded)}>
          <h3>
            <span className="expand-icon">{contactInfoExpanded ? '▼' : '▶'}</span>
            General Information
          </h3>
          <button className="btn-edit-contact" onClick={(e) => { e.stopPropagation(); openContactEdit(); }}>
            ✏️ Edit
          </button>
        </div>

        {contactInfoExpanded && (
          Object.keys(contactInfo).length > 0 ? (
            <div className="contact-display">
              {contactInfo.job_title && <div className="contact-item">💼 {contactInfo.job_title}</div>}
              {contactInfo.email && <div className="contact-item">📧 {contactInfo.email}</div>}
              {contactInfo.phone && <div className="contact-item">📱 {contactInfo.phone}</div>}
              {contactInfo.location && <div className="contact-item">📍 {contactInfo.location}</div>}
              {contactInfo.linkedin && <div className="contact-item">💼 <a href={contactInfo.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></div>}
              {contactInfo.github && <div className="contact-item">💻 <a href={contactInfo.github} target="_blank" rel="noopener noreferrer">GitHub</a></div>}
            </div>
          ) : (
            <p className="no-contact-info">No general information added yet</p>
          )
        )}
      </div>

      {showContactEdit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit General Information</h3>
            <div className="contact-edit-grid">
              <input
                type="text"
                className="input-field"
                placeholder="Job Title (e.g., Lead Data Scientist & AI Delivery Lead)"
                value={tempContactInfo.job_title || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, job_title: e.target.value})}
              />
              <input
                type="email"
                className="input-field"
                placeholder="Email"
                value={tempContactInfo.email || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, email: e.target.value})}
              />
              <input
                type="tel"
                className="input-field"
                placeholder="Phone (e.g., (+46) 76-5843-803)"
                value={tempContactInfo.phone || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, phone: e.target.value})}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Location (e.g., Stockholm, Sweden)"
                value={tempContactInfo.location || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, location: e.target.value})}
              />
              <input
                type="text"
                className="input-field"
                placeholder="LinkedIn (URL or username)"
                value={tempContactInfo.linkedin || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, linkedin: e.target.value})}
              />
              <input
                type="text"
                className="input-field"
                placeholder="GitHub (URL or username)"
                value={tempContactInfo.github || ''}
                onChange={(e) => setTempContactInfo({...tempContactInfo, github: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowContactEdit(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveContactInfo}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sections-area">
        <div className="sections-header">
          <h3>Profile Sections</h3>
          <button className="btn-add-section" onClick={() => setShowAddSection(true)}>
            + Add Section
          </button>
        </div>

        {sections.length === 0 ? (
          <div className="empty-sections">
            <p>No sections yet. Add your first section to start building your profile.</p>
          </div>
        ) : (
          <div className="sections-list">
            {sections.map(section => (
              <SectionCard
                key={section.id}
                section={section}
                profileId={profile.id}
                onUpdate={onUpdate}
                sectionRef={(el) => { if (sectionRefs) sectionRefs.current[section.id] = el; }}
                expandHandler={(handler) => { if (sectionExpandHandlers) sectionExpandHandlers.current[section.id] = handler; }}
              />
            ))}
          </div>
        )}
      </div>

      {showAddSection && (
        <div className="modal-overlay">
          <div className="modal-content section-selector-modal">
            <h3>Add Section</h3>
            <p className="modal-subtitle">Choose the type of section to add</p>
            <div className="section-type-grid">
              {SECTION_TYPES.map(type => (
                <button
                  key={type.value}
                  className="section-type-card"
                  onClick={() => addSection(type.value)}
                >
                  <span className="section-type-icon">{type.icon}</span>
                  <span className="section-type-label">{type.label}</span>
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setShowAddSection(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for dynamic labels
function getEntriesLabel(sectionType) {
  const labels = {
    'work_experience': 'Jobs',
    'education': 'Degrees',
    'skills': 'Skill Categories',
    'projects': 'Projects',
    'certifications': 'Certifications',
    'awards': 'Awards',
    'publications': 'Publications',
    'languages': 'Languages',
    'volunteer': 'Activities',
    'custom': 'Entries'
  };
  return labels[sectionType] || 'Entries';
}

function getAddButtonLabel(sectionType) {
  const labels = {
    'work_experience': 'Add Job',
    'education': 'Add Degree',
    'skills': 'Add Category',
    'projects': 'Add Project',
    'certifications': 'Add Certification',
    'awards': 'Add Award',
    'publications': 'Add Publication',
    'languages': 'Add Language',
    'volunteer': 'Add Activity',
    'custom': 'Add Entry'
  };
  return labels[sectionType] || 'Add Entry';
}

function SectionCard({ section, profileId, onUpdate, sectionRef, expandHandler }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(section.content || '');
  const [contentType, setContentType] = useState(section.content_type);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showContentTypeSelector, setShowContentTypeSelector] = useState(false);
  const contentRefs = useRef({});

  const sectionConfig = SECTION_TYPES.find(s => s.value === section.section_type);
  const isSummarySection = section.section_type === 'summary';

  // Register the expand handler for this section
  useEffect(() => {
    if (expandHandler) {
      expandHandler(() => setExpanded(true));
    }
  }, [expandHandler]);

  // Sync content state when section data changes
  useEffect(() => {
    setContent(section.content || '');
    setContentType(section.content_type);
  }, [section.content, section.content_type]);

  const updateSection = async (updates) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/sections/${section.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      await onUpdate();
    } catch (err) {
      console.error('Error updating section:', err);
    }
  };

  const deleteSection = async () => {
    if (!confirm(`Delete "${section.title}" section?`)) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/sections/${section.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      await onUpdate();
    } catch (err) {
      console.error('Error deleting section:', err);
    }
  };

  const addEntry = async (entryData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${section.id}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entryData,
          meta_info: { source: 'manual' }
        })
      });

      if (response.ok) {
        setShowAddEntry(false);
        await onUpdate();
      }
    } catch (err) {
      console.error('Error adding entry:', err);
      alert('Error adding entry');
    }
  };

  const convertContentType = async (newType) => {
    const oldType = contentType;

    // Don't convert if already the same type
    if (oldType === newType) return;

    // Convert bullets to text
    if (oldType === 'bullets' && newType === 'paragraph') {
      const entry = section.entries?.[0];
      if (entry && entry.items && entry.items.length > 0) {
        const textContent = entry.items.map(item => item.content).join('. ') + '.';
        setContent(textContent); // Update local state
        await updateSection({ content_type: newType, content: textContent });
        // Delete the entry with bullets
        try {
          const token = localStorage.getItem('token');
          await fetch(`${API_URL}/api/entries/${entry.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (err) {
          console.error('Error deleting old entry:', err);
        }
      } else {
        await updateSection({ content_type: newType });
      }
    }
    // Convert text to bullets
    else if (oldType === 'paragraph' && newType === 'bullets') {
      if (content && content.trim()) {
        // Split by periods and create bullets
        const bullets = content
          .split('.')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        setContent(''); // Clear content state
        await updateSection({ content_type: newType, content: '' });

        // Create entry and items for bullets
        if (bullets.length > 0) {
          try {
            const token = localStorage.getItem('token');
            const entryResponse = await fetch(`${API_URL}/api/sections/${section.id}/entries`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                title: 'Summary',
                content_type: 'bullets',
                meta_info: { source: 'manual' }
              })
            });

            if (entryResponse.ok) {
              const entry = await entryResponse.json();

              // Add each bullet as an item
              for (let i = 0; i < bullets.length; i++) {
                await fetch(`${API_URL}/api/entries/${entry.id}/items`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    content: bullets[i],
                    order: i,
                    meta_info: { source: 'manual' }
                  })
                });
              }
            }
          } catch (err) {
            console.error('Error creating bullets:', err);
          }
        }
      } else {
        await updateSection({ content_type: newType });
      }
    } else {
      await updateSection({ content_type: newType });
    }

    setContentType(newType);
    await onUpdate();
  };

  return (
    <div className="section-card" ref={sectionRef}>
      <div className="section-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="section-info">
          <span className="section-icon">{section.icon}</span>
          <span className="section-title">{section.title}</span>
          <span className="section-type-badge">{contentType}</span>
          <span className="entry-count">{section.entries?.length || 0} entries</span>
        </div>
        <div className="section-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteSection(); }}>
            🗑️
          </button>
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="section-card-body">
          {isSummarySection ? (
            <div className="content-type-tiles">
              <h4>Choose format:</h4>
              <div className="tiles-container">
                <button
                  className={`content-type-tile ${contentType === 'paragraph' ? 'active' : ''}`}
                  onClick={() => convertContentType('paragraph')}
                >
                  <span className="tile-icon">📝</span>
                  <span className="tile-label">Text Only</span>
                  <span className="tile-description">Write a paragraph summary</span>
                </button>
                <button
                  className={`content-type-tile ${contentType === 'bullets' ? 'active' : ''}`}
                  onClick={() => convertContentType('bullets')}
                >
                  <span className="tile-icon">•</span>
                  <span className="tile-label">Bullet Points</span>
                  <span className="tile-description">Add bullet-point highlights</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Content Type</label>
              <select
                className="select-field"
                value={contentType}
                onChange={(e) => {
                  setContentType(e.target.value);
                  updateSection({ content_type: e.target.value });
                }}
              >
                {CONTENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(contentType === 'paragraph' || contentType === 'text_and_bullets') && (
            <div className="form-group">
              <label>Content</label>
              <textarea
                className="textarea-field"
                placeholder="Enter text content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => updateSection({ content })}
                rows={6}
              />
            </div>
          )}

          {contentType !== 'paragraph' && (
            <div className="section-entries-area">
              {isSummarySection ? (
                <SummaryBulletList
                  section={section}
                  onUpdate={onUpdate}
                />
              ) : (
                <>
                  <div className="entries-header">
                    <h4>{getEntriesLabel(section.section_type)}</h4>
                    <button className="btn-add-entry" onClick={() => setShowAddEntry(true)}>
                      + {getAddButtonLabel(section.section_type)}
                    </button>
                  </div>

                  {section.entries && section.entries.length > 0 ? (
                    <div className="entries-list">
                      {section.entries
                        .filter(entry => !entry.parent_entry_id)
                        .map(entry => (
                          <EntryCard
                            key={entry.id}
                            entry={entry}
                            sectionId={section.id}
                            sectionType={section.section_type}
                            maxNesting={sectionConfig?.maxNesting || 1}
                            onUpdate={onUpdate}
                          />
                        ))}
                    </div>
                  ) : (
                    <p className="no-entries">No {getEntriesLabel(section.section_type).toLowerCase()} yet</p>
                  )}
                </>
              )}
            </div>
          )}

          {showAddEntry && (
            <EntryForm
              sectionType={section.section_type}
              onSave={addEntry}
              onCancel={() => setShowAddEntry(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry, sectionId, sectionType, maxNesting, level = 0, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddSubEntry, setShowAddSubEntry] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddBulletGroup, setShowAddBulletGroup] = useState(false);

  // For work experience: level 0 = job, level 1 = bullet group
  const canHaveBulletGroups = sectionType === 'work_experience' && level === 0;
  const isBulletGroup = level === 1 && sectionType === 'work_experience';

  const deleteEntry = async () => {
    if (!confirm('Delete this entry?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/entries/${entry.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      await onUpdate();
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const addSubEntry = async (entryData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entryData,
          parent_entry_id: entry.id,
          meta_info: { source: 'manual' }
        })
      });

      if (response.ok) {
        setShowAddSubEntry(false);
        setShowAddBulletGroup(false);
        await onUpdate();
      }
    } catch (err) {
      console.error('Error adding sub-entry:', err);
      alert('Error adding sub-entry');
    }
  };

  const addBulletGroup = async (groupTitle) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: groupTitle,
          parent_entry_id: entry.id,
          content_type: 'bullets',
          meta_info: { source: 'manual', is_bullet_group: true }
        })
      });

      if (response.ok) {
        setShowAddBulletGroup(false);
        await onUpdate();
      }
    } catch (err) {
      console.error('Error adding bullet group:', err);
      alert('Error adding bullet group');
    }
  };

  const addItem = async (content) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/entries/${entry.id}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          order: entry.items?.length || 0,
          meta_info: { source: 'manual' }
        })
      });
      setShowAddItem(false);
      await onUpdate();
    } catch (err) {
      console.error('Error adding item:', err);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      await onUpdate();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  return (
    <div className={`entry-card level-${level}`}>
      <div className="entry-header" onClick={() => setExpanded(!expanded)}>
        <div className="entry-info">
          <span className="expand-arrow">{expanded ? '▼' : '▶'}</span>
          <div>
            <div className="entry-title">{entry.title}</div>
            {entry.subtitle && <div className="entry-subtitle">{entry.subtitle}</div>}
            {entry.start_date && (
              <div className="entry-dates">
                {entry.start_date} - {entry.end_date || 'Present'}
              </div>
            )}
          </div>
        </div>
        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteEntry(); }}>
          🗑️
        </button>
      </div>

      {expanded && (
        <div className="entry-body">
          {entry.description && <p className="entry-description">{entry.description}</p>}

          {entry.items && entry.items.length > 0 && (
            <ul className="items-list">
              {entry.items.map(item => (
                <li key={item.id} className="item" data-item-id={item.id}>
                  <span>{item.content}</span>
                  <button className="btn-delete-tiny" onClick={() => deleteItem(item.id)}>×</button>
                </li>
              ))}
            </ul>
          )}

          {showAddItem ? (
            <div className="add-item-form">
              <input
                type="text"
                placeholder="Enter bullet point..."
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    addItem(e.target.value);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    addItem(e.target.value);
                  } else {
                    setShowAddItem(false);
                  }
                }}
              />
            </div>
          ) : (
            <button className="btn-add-item" onClick={() => setShowAddItem(true)}>
              + Add Bullet Point
            </button>
          )}

          {entry.sub_entries && entry.sub_entries.length > 0 && (
            <div className="sub-entries">
              <h5 className="sub-entries-title">
                {isBulletGroup ? 'Bullet Points' : 'Organized Bullets'}
              </h5>
              {entry.sub_entries.map(subEntry => (
                <EntryCard
                  key={subEntry.id}
                  entry={subEntry}
                  sectionId={sectionId}
                  sectionType={sectionType}
                  maxNesting={maxNesting}
                  level={level + 1}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          )}

          {canHaveBulletGroups && (
            <div className="job-actions">
              {showAddBulletGroup ? (
                <div className="add-bullet-group-form">
                  <input
                    type="text"
                    placeholder="Group title (e.g., 'Technical Leadership')..."
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        addBulletGroup(e.target.value);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        addBulletGroup(e.target.value);
                      } else {
                        setShowAddBulletGroup(false);
                      }
                    }}
                  />
                </div>
              ) : (
                <button className="btn-add-bullet-group" onClick={() => setShowAddBulletGroup(true)}>
                  + Add Bullet Group (Optional)
                </button>
              )}
              <p className="help-text">
                💡 Tip: Add bullet groups to organize achievements by category (e.g., "Technical Leadership", "Delivery Management")
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryForm({ sectionType, isSubEntry, isBulletGroup, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    start_date: '',
    end_date: '',
    location: '',
    description: '',
    content_type: 'bullets'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    onSave(formData);
  };

  const getFormTitle = () => {
    if (sectionType === 'work_experience') {
      if (isBulletGroup) return 'Add Bullet Group';
      if (isSubEntry) return 'Add Role';
      return 'Add Job';
    } else if (sectionType === 'education') {
      return 'Add Degree';
    } else if (sectionType === 'skills') {
      return 'Add Skill Category';
    }
    return 'Add Entry';
  };

  const getPlaceholder = (field) => {
    if (sectionType === 'work_experience') {
      if (isBulletGroup) {
        return {
          title: 'Group Title (e.g., "Technical Leadership")',
          subtitle: ''
        }[field];
      } else {
        return {
          title: 'Job Title (e.g., "Lead Data Scientist")',
          subtitle: 'Company'
        }[field];
      }
    } else if (sectionType === 'education') {
      return {
        title: 'Degree (e.g., PhD in Computer Science)',
        subtitle: 'University'
      }[field];
    }
    return {
      title: 'Title',
      subtitle: 'Subtitle'
    }[field];
  };

  return (
    <div className="entry-form">
      <h4 className="form-title">{getFormTitle()}</h4>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="input-field"
          placeholder={getPlaceholder('title') + ' *'}
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
        />
        {!isBulletGroup && (
          <>
            <input
              type="text"
              className="input-field"
              placeholder={getPlaceholder('subtitle')}
              value={formData.subtitle}
              onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
            />
            <div className="form-row">
              <input
                type="text"
                className="input-field"
                placeholder="Start Date (e.g., Nov. 2019)"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
              />
              <input
                type="text"
                className="input-field"
                placeholder="End Date (e.g., Present)"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              />
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="Location (e.g., Stockholm, Sweden)"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
            <textarea
              className="textarea-field"
              placeholder="Description (optional intro paragraph)"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {isBulletGroup ? 'Add Group' : `Save ${getFormTitle().replace('Add ', '')}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function SummaryBulletList({ section, onUpdate }) {
  const [showAddBullet, setShowAddBullet] = useState(false);
  const [newBullet, setNewBullet] = useState('');

  // Get or create the summary entry
  const summaryEntry = section.entries?.[0];

  const addBullet = async () => {
    if (!newBullet.trim()) return;

    try {
      const token = localStorage.getItem('token');

      // If no entry exists, create one first
      let entryId = summaryEntry?.id;
      if (!entryId) {
        const entryResponse = await fetch(`${API_URL}/api/sections/${section.id}/entries`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Summary',
            content_type: 'bullets',
            meta_info: { source: 'manual' }
          })
        });

        if (entryResponse.ok) {
          const entry = await entryResponse.json();
          entryId = entry.id;
        } else {
          alert('Error creating entry');
          return;
        }
      }

      // Add the bullet item
      const response = await fetch(`${API_URL}/api/entries/${entryId}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newBullet,
          order: summaryEntry?.items?.length || 0,
          meta_info: { source: 'manual' }
        })
      });

      if (response.ok) {
        setNewBullet('');
        setShowAddBullet(false);
        await onUpdate();
      }
    } catch (err) {
      console.error('Error adding bullet:', err);
      alert('Error adding bullet point');
    }
  };

  const deleteBullet = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await onUpdate();
    } catch (err) {
      console.error('Error deleting bullet:', err);
    }
  };

  return (
    <div className="summary-bullet-list">
      <h4>Summary Bullets</h4>

      {summaryEntry?.items && summaryEntry.items.length > 0 && (
        <ul className="summary-bullets">
          {summaryEntry.items.map(item => (
            <li key={item.id} className="summary-bullet-item" data-item-id={item.id}>
              <span className="bullet-content">{item.content}</span>
              <button className="btn-delete-tiny" onClick={() => deleteBullet(item.id)}>×</button>
            </li>
          ))}
        </ul>
      )}

      {showAddBullet ? (
        <div className="add-bullet-form">
          <input
            type="text"
            className="input-field"
            placeholder="Enter bullet point..."
            value={newBullet}
            onChange={(e) => setNewBullet(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addBullet();
              }
            }}
            autoFocus
          />
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => { setShowAddBullet(false); setNewBullet(''); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={addBullet}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-add-bullet" onClick={() => setShowAddBullet(true)}>
          + Add Bullet Point
        </button>
      )}
    </div>
  );
}

export default ProfileManagement;
