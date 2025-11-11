import { useState, useEffect, useRef } from 'react';
import './ProfileManagement.css';
import CVPreview from './CVPreview';

const API_URL = 'http://localhost:8000';

const SECTION_TYPES = [
  { value: 'summary', label: 'Summary', icon: '📝', maxNesting: 0 },
  { value: 'work_experience', label: 'Work Experience', icon: '💼', maxNesting: 2 },
  { value: 'education', label: 'Education', icon: '🎓', maxNesting: 2 },
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
  const [backendVersion, setBackendVersion] = useState('loading...');
  const [frontendVersion, setFrontendVersion] = useState('loading...');
  const sectionRefs = useRef({});
  const sectionExpandHandlers = useRef({});

  useEffect(() => {
    fetchProfiles();
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      // Fetch backend version
      const backendResponse = await fetch(`${API_URL}/api/version`);
      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        setBackendVersion(backendData.version);
      }

      // Fetch frontend version
      const frontendResponse = await fetch('/VERSION');
      if (frontendResponse.ok) {
        const frontendText = await frontendResponse.text();
        setFrontendVersion(frontendText.trim());
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
      setBackendVersion('error');
      setFrontendVersion('error');
    }
  };

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
        <div className="header-content">
          <div>
            <h2>Profile Management</h2>
            <p className="profile-subtitle">Create and organize your professional profiles manually</p>
          </div>
          <div className="version-info">
            <span className="version-badge">Frontend: v{frontendVersion}</span>
            <span className="version-badge">Backend: v{backendVersion}</span>
          </div>
        </div>
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
                } else if (target === 'entry' && clickData.entryId) {
                  // Expand and navigate to a specific entry (job)
                  setTimeout(() => {
                    const entryCard = ref.querySelector(`[data-entry-id="${clickData.entryId}"]`);
                    if (entryCard) {
                      // Click the header to expand if not expanded
                      const header = entryCard.querySelector('.entry-header');
                      const expandArrow = header?.querySelector('.expand-arrow');
                      if (expandArrow && expandArrow.textContent.trim() === '▶') {
                        header.click();
                      }

                      setTimeout(() => {
                        entryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        entryCard.style.boxShadow = '0 0 0 3px #667eea';
                        setTimeout(() => {
                          entryCard.style.boxShadow = '';
                        }, 1000);
                      }, 200);
                    }
                  }, 200);
                  return;
                } else if (target === 'subentry' && clickData.entryId && clickData.subEntryId) {
                  // Expand and navigate to a specific sub-entry (bullet group)
                  setTimeout(() => {
                    // First expand the parent entry
                    const parentEntryCard = ref.querySelector(`[data-entry-id="${clickData.entryId}"]`);
                    if (parentEntryCard) {
                      const parentHeader = parentEntryCard.querySelector('.entry-header');
                      const parentExpandArrow = parentHeader?.querySelector('.expand-arrow');
                      if (parentExpandArrow && parentExpandArrow.textContent.trim() === '▶') {
                        parentHeader.click();
                      }

                      // Wait for parent to expand, then expand the sub-entry
                      setTimeout(() => {
                        const subEntryCard = parentEntryCard.querySelector(`[data-entry-id="${clickData.subEntryId}"]`);
                        if (subEntryCard) {
                          const subHeader = subEntryCard.querySelector('.entry-header');
                          const subExpandArrow = subHeader?.querySelector('.expand-arrow');
                          if (subExpandArrow && subExpandArrow.textContent.trim() === '▶') {
                            subHeader.click();
                          }

                          setTimeout(() => {
                            subEntryCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            subEntryCard.style.boxShadow = '0 0 0 3px #667eea';
                            setTimeout(() => {
                              subEntryCard.style.boxShadow = '';
                            }, 1000);
                          }, 200);
                        }
                      }, 200);
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
  const [draggedSectionId, setDraggedSectionId] = useState(null);

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

  const reorderSections = async (draggedId, targetId) => {
    const draggedIndex = sections.findIndex(s => s.id === draggedId);
    const targetIndex = sections.findIndex(s => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally first for immediate feedback
    const newSections = [...sections];
    const [draggedSection] = newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, draggedSection);

    // Update local state
    setSections(newSections);

    // Update order values and save to backend
    try {
      const token = localStorage.getItem('token');
      const updatePromises = newSections.map((section, index) =>
        fetch(`${API_URL}/api/sections/${section.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...section,
            order: index
          })
        })
      );

      await Promise.all(updatePromises);
      await onUpdate();
    } catch (err) {
      console.error('Error reordering sections:', err);
      // Revert on error
      setSections(sections);
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
                onDragStart={() => setDraggedSectionId(section.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedSectionId && draggedSectionId !== section.id) {
                    reorderSections(draggedSectionId, section.id);
                  }
                }}
                onDragEnd={() => setDraggedSectionId(null)}
                isDragging={draggedSectionId === section.id}
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

// Format date from YYYY-MM to MMM YYYY
function formatMonthYear(dateStr) {
  if (!dateStr) return '';
  if (dateStr.toLowerCase() === 'present') return 'Present';

  // Check if it's already formatted (e.g., "Nov 2019")
  if (dateStr.match(/^[A-Za-z]{3,}\s+\d{4}$/)) return dateStr;

  // Parse YYYY-MM format
  const [year, month] = dateStr.split('-');
  if (!year || !month) return dateStr;

  const date = new Date(parseInt(year), parseInt(month) - 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// Convert formatted date back to YYYY-MM for input
function parseFormattedDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.toLowerCase() === 'present') return '';

  // Check if it's already in YYYY-MM format
  if (dateStr.match(/^\d{4}-\d{2}$/)) return dateStr;

  // Parse "MMM YYYY" format
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dateStr.split(/\s+/);
  if (parts.length !== 2) return '';

  const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
  if (monthIndex === -1) return '';

  const month = (monthIndex + 1).toString().padStart(2, '0');
  return `${parts[1]}-${month}`;
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

function SectionCard({ section, profileId, onUpdate, sectionRef, expandHandler, onDragStart, onDragOver, onDragEnd, isDragging }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(section.content || '');
  const [contentType, setContentType] = useState(section.content_type);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showContentTypeSelector, setShowContentTypeSelector] = useState(false);
  const contentRefs = useRef({});

  const sectionConfig = SECTION_TYPES.find(s => s.value === section.section_type);
  const isSummarySection = section.section_type === 'summary';
  const isSkillsSection = section.section_type === 'skills';

  // Get layout preference from meta_info (default to 'double' for backward compatibility)
  const [skillsLayout, setSkillsLayout] = useState(
    section.meta_info?.layout || 'double'
  );

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
        body: JSON.stringify({
          ...updates,
          order: section.order  // Preserve the original order
        })
      });
      await onUpdate();
    } catch (err) {
      console.error('Error updating section:', err);
    }
  };

  const updateSkillsLayout = async (newLayout) => {
    try {
      setSkillsLayout(newLayout);
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/sections/${section.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meta_info: {
            ...(section.meta_info || {}),
            layout: newLayout
          },
          order: section.order
        })
      });
      await onUpdate();
    } catch (err) {
      console.error('Error updating skills layout:', err);
      setSkillsLayout(section.meta_info?.layout || 'double'); // Revert on error
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
      // Calculate the order for the new entry
      const maxOrder = section.entries && section.entries.length > 0
        ? Math.max(...section.entries.map(e => e.order || 0))
        : -1;

      const response = await fetch(`${API_URL}/api/sections/${section.id}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entryData,
          order: maxOrder + 1,  // Set order to be after the last entry
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

  // Calculate entry count based on section type
  const getEntryCountLabel = () => {
    if (isSummarySection) {
      if (contentType === 'bullets') {
        const bulletCount = section.entries?.[0]?.items?.length || 0;
        return `${bulletCount} bullet${bulletCount !== 1 ? 's' : ''}`;
      }
      // For paragraph type, don't show entry count
      return '';
    } else {
      // For other sections, count only parent entries (not nested ones)
      const parentEntryCount = section.entries?.filter(e => !e.parent_entry_id).length || 0;
      return `${parentEntryCount} ${parentEntryCount === 1 ? getEntriesLabel(section.section_type).slice(0, -1) : getEntriesLabel(section.section_type).toLowerCase()}`;
    }
  };

  return (
    <div
      className={`section-card ${isDragging ? 'dragging' : ''}`}
      ref={sectionRef}
      draggable="true"
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="section-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="section-info">
          <span className="drag-handle" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>⋮⋮</span>
          <span className="section-icon">{section.icon}</span>
          <span className="section-title">{section.title}</span>
          <span className="section-type-badge">{contentType}</span>
          {getEntryCountLabel() && <span className="entry-count">{getEntryCountLabel()}</span>}
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
            <>
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

              {contentType === 'paragraph' && (
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

              {contentType === 'bullets' && (
                <SummaryBulletList
                  section={section}
                  onUpdate={onUpdate}
                />
              )}
            </>
          ) : (
            <>
              {isSkillsSection && (
                <div className="content-type-tiles">
                  <h4>Layout:</h4>
                  <div className="tiles-container">
                    <button
                      className={`content-type-tile ${skillsLayout === 'single' ? 'active' : ''}`}
                      onClick={() => updateSkillsLayout('single')}
                    >
                      <span className="tile-icon">📋</span>
                      <span className="tile-label">Single Column</span>
                      <span className="tile-description">Full-width layout</span>
                    </button>
                    <button
                      className={`content-type-tile ${skillsLayout === 'double' ? 'active' : ''}`}
                      onClick={() => updateSkillsLayout('double')}
                    >
                      <span className="tile-icon">📊</span>
                      <span className="tile-label">Two Columns</span>
                      <span className="tile-description">Compact side-by-side</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="section-entries-area">
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
                        allEntries={section.entries.filter(e => !e.parent_entry_id)}
                      />
                    ))}
                </div>
              ) : (
                <p className="no-entries">No {getEntriesLabel(section.section_type).toLowerCase()} yet</p>
              )}
              </div>
            </>
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

function EntryCard({ entry, sectionId, sectionType, maxNesting, level = 0, onUpdate, allEntries = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddSubEntry, setShowAddSubEntry] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddBulletGroup, setShowAddBulletGroup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemContent, setEditingItemContent] = useState('');
  const [draggedEntryId, setDraggedEntryId] = useState(null);
  const [draggedItemId, setDraggedItemId] = useState(null);

  // For work experience and education: level 0 = job/degree, level 1 = bullet group
  const canHaveBulletGroups = (sectionType === 'work_experience' || sectionType === 'education') && level === 0;
  const isBulletGroup = level === 1 && (sectionType === 'work_experience' || sectionType === 'education');

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

  const updateEntry = async (entryData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entryData,
          order: entry.order  // Preserve the original order
        })
      });

      if (response.ok) {
        setIsEditing(false);
        await onUpdate();
      }
    } catch (err) {
      console.error('Error updating entry:', err);
      alert('Error updating entry');
    }
  };

  const addSubEntry = async (entryData) => {
    try {
      const token = localStorage.getItem('token');
      // Calculate the order for the new sub-entry
      const maxOrder = entry.sub_entries && entry.sub_entries.length > 0
        ? Math.max(...entry.sub_entries.map(e => e.order || 0))
        : -1;

      const response = await fetch(`${API_URL}/api/sections/${sectionId}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...entryData,
          parent_entry_id: entry.id,
          order: maxOrder + 1,  // Set order to be after the last sub-entry
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
      // Calculate the order for the new bullet group
      const maxOrder = entry.sub_entries && entry.sub_entries.length > 0
        ? Math.max(...entry.sub_entries.map(e => e.order || 0))
        : -1;

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
          order: maxOrder + 1,  // Set order to be after the last bullet group
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

  const updateItem = async (itemId, content) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content
        })
      });
      setEditingItemId(null);
      setEditingItemContent('');
      await onUpdate();
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  // Reorder entries (works for both top-level entries and sub-entries)
  const reorderEntries = async (draggedId, targetId, parentId = null) => {
    try {
      const token = localStorage.getItem('token');

      // Find entries to reorder based on parent
      const entriesToReorder = parentId
        ? allEntries.filter(e => e.parent_entry_id === parentId)
        : allEntries.filter(e => !e.parent_entry_id);

      const draggedIndex = entriesToReorder.findIndex(e => e.id === draggedId);
      const targetIndex = entriesToReorder.findIndex(e => e.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Reorder locally
      const newEntries = [...entriesToReorder];
      const [draggedEntry] = newEntries.splice(draggedIndex, 1);
      newEntries.splice(targetIndex, 0, draggedEntry);

      // Update order values
      const updates = newEntries.map((entry, index) => ({
        id: entry.id,
        order: index
      }));

      // Send batch update to backend
      await fetch(`${API_URL}/api/entries/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });

      await onUpdate();
    } catch (err) {
      console.error('Error reordering entries:', err);
    }
  };

  // Reorder items within an entry
  const reorderItems = async (draggedItemId, targetItemId) => {
    try {
      const token = localStorage.getItem('token');

      const items = entry.items || [];
      const draggedIndex = items.findIndex(i => i.id === draggedItemId);
      const targetIndex = items.findIndex(i => i.id === targetItemId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Reorder locally
      const newItems = [...items];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, draggedItem);

      // Update order values
      const updates = newItems.map((item, index) => ({
        id: item.id,
        order: index
      }));

      // Send batch update to backend
      await fetch(`${API_URL}/api/items/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });

      await onUpdate();
    } catch (err) {
      console.error('Error reordering items:', err);
    }
  };

  return (
    <div
      className={`entry-card level-${level} ${draggedEntryId === entry.id ? 'dragging' : ''}`}
      data-entry-id={entry.id}
      draggable="true"
      onDragStart={(e) => {
        e.stopPropagation();
        setDraggedEntryId(entry.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedEntryId && draggedEntryId !== entry.id) {
          reorderEntries(draggedEntryId, entry.id, entry.parent_entry_id);
        }
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        setDraggedEntryId(null);
      }}
    >
      <div className="entry-header" onClick={() => setExpanded(!expanded)}>
        <div className="entry-info">
          <span className="drag-handle" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>⋮⋮</span>
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
        <div className="entry-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setExpanded(true); }}>
            ✏️
          </button>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteEntry(); }}>
            🗑️
          </button>
        </div>
      </div>

      {expanded && (
        <div className="entry-body">
          {isEditing ? (
            <EntryForm
              sectionType={sectionType}
              isSubEntry={level > 0}
              isBulletGroup={isBulletGroup}
              initialData={entry}
              onSave={updateEntry}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              {entry.description && <p className="entry-description">{entry.description}</p>}

              {/* Only show direct bullet points for non-work-experience OR sub-entries (level > 0) */}
          {(!canHaveBulletGroups || level > 0) && entry.items && entry.items.length > 0 && (
            <ul className="items-list">
              {entry.items.map(item => (
                <li
                  key={item.id}
                  className={`item ${draggedItemId === item.id ? 'dragging' : ''}`}
                  data-item-id={item.id}
                  draggable="true"
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedItemId(item.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedItemId && draggedItemId !== item.id) {
                      reorderItems(draggedItemId, item.id);
                    }
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    setDraggedItemId(null);
                  }}
                >
                  <span className="drag-handle-item" title="Drag to reorder">⋮</span>
                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      className="edit-item-input"
                      value={editingItemContent}
                      autoFocus
                      onChange={(e) => setEditingItemContent(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && editingItemContent.trim()) {
                          updateItem(item.id, editingItemContent);
                        }
                      }}
                      onBlur={() => {
                        if (editingItemContent.trim() && editingItemContent !== item.content) {
                          updateItem(item.id, editingItemContent);
                        } else {
                          setEditingItemId(null);
                          setEditingItemContent('');
                        }
                      }}
                    />
                  ) : (
                    <span className="item-content">{item.content}</span>
                  )}
                  <div className="item-actions">
                    <button
                      className="btn-edit-tiny"
                      onClick={() => {
                        setEditingItemId(item.id);
                        setEditingItemContent(item.content);
                      }}
                    >
                      ✏️
                    </button>
                    <button className="btn-delete-tiny" onClick={() => deleteItem(item.id)}>×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Only show Add Bullet Point button for non-work-experience OR sub-entries (level > 0) */}
          {(!canHaveBulletGroups || level > 0) && (
            showAddItem ? (
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
            )
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
                  allEntries={entry.sub_entries}
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
                    placeholder={
                      sectionType === 'education'
                        ? "Group title (e.g., 'Coursework', 'Research')..."
                        : "Group title (e.g., 'Technical Leadership')..."
                    }
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
                  {sectionType === 'work_experience'
                    ? '+ Add Bullet Group (Required)'
                    : '+ Add Bullet Group (Optional)'}
                </button>
              )}
              <p className="help-text">
                💡 {
                  sectionType === 'education'
                    ? 'Tip: Add bullet groups to organize details by category (e.g., "Coursework", "Research", "Honors")'
                    : sectionType === 'work_experience'
                    ? 'Required: Organize your achievements into categories (e.g., "Technical Leadership", "Delivery Management"). Bullet points must be added under these groups.'
                    : 'Tip: Add bullet groups to organize achievements by category'
                }
              </p>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EntryForm({ sectionType, isSubEntry, isBulletGroup, onSave, onCancel, initialData = null }) {
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        start_date: parseFormattedDate(initialData.start_date || ''),
        end_date: initialData.end_date?.toLowerCase() === 'present' ? '' : parseFormattedDate(initialData.end_date || '')
      };
    }
    return {
      title: '',
      subtitle: '',
      start_date: '',
      end_date: '',
      location: '',
      description: '',
      content_type: 'bullets'
    };
  });
  const [isPresent, setIsPresent] = useState(initialData?.end_date?.toLowerCase() === 'present');

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation for work experience
    if (sectionType === 'work_experience' && !isBulletGroup) {
      if (!formData.title.trim()) {
        alert('Job Title is required');
        return;
      }
      if (!formData.subtitle.trim()) {
        alert('Company is required');
        return;
      }
      if (!formData.start_date.trim()) {
        alert('Start Date is required');
        return;
      }
      if (!isPresent && !formData.end_date.trim()) {
        alert('End Date is required (or check "Present")');
        return;
      }
      if (!formData.location.trim()) {
        alert('Location is required');
        return;
      }
    }
    // Validation for education
    else if (sectionType === 'education' && !isBulletGroup) {
      if (!formData.title.trim()) {
        alert('Degree is required');
        return;
      }
      if (!formData.subtitle.trim()) {
        alert('University is required');
        return;
      }
      if (!formData.start_date.trim()) {
        alert('Start Date is required');
        return;
      }
      if (!formData.end_date.trim()) {
        alert('End Date is required');
        return;
      }
      if (!formData.location.trim()) {
        alert('Location is required');
        return;
      }
    }
    else if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    // Format dates before saving
    const dataToSave = {
      ...formData,
      start_date: formData.start_date ? formatMonthYear(formData.start_date) : '',
      end_date: isPresent ? 'Present' : (formData.end_date ? formatMonthYear(formData.end_date) : '')
    };

    onSave(dataToSave);
  };

  const getFormTitle = () => {
    const isEditing = !!initialData;
    if (sectionType === 'work_experience') {
      if (isBulletGroup) return isEditing ? 'Edit Bullet Group' : 'Add Bullet Group';
      if (isSubEntry) return isEditing ? 'Edit Role' : 'Add Role';
      return isEditing ? 'Edit Job' : 'Add Job';
    } else if (sectionType === 'education') {
      return isEditing ? 'Edit Degree' : 'Add Degree';
    } else if (sectionType === 'skills') {
      return isEditing ? 'Edit Skill Category' : 'Add Skill Category';
    }
    return isEditing ? 'Edit Entry' : 'Add Entry';
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
              placeholder={getPlaceholder('subtitle') + ((sectionType === 'work_experience' || sectionType === 'education') ? ' *' : '')}
              value={formData.subtitle}
              onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
              required={sectionType === 'work_experience' || sectionType === 'education'}
            />
            <div className="form-row">
              <input
                type="month"
                className="input-field"
                placeholder="Start Date *"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                required={sectionType === 'work_experience' || sectionType === 'education'}
              />
              <input
                type="month"
                className="input-field"
                placeholder="End Date *"
                value={isPresent ? '' : formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                required={(sectionType === 'work_experience' && !isPresent) || sectionType === 'education'}
                disabled={isPresent}
              />
            </div>
            {sectionType === 'work_experience' && (
              <div className="form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={isPresent}
                    onChange={(e) => {
                      setIsPresent(e.target.checked);
                      if (e.target.checked) {
                        setFormData({...formData, end_date: ''});
                      }
                    }}
                  />
                  <span>Currently working here (Present)</span>
                </label>
              </div>
            )}
            <input
              type="text"
              className="input-field"
              placeholder={"Location (e.g., Stockholm, Sweden)" + ((sectionType === 'work_experience' || sectionType === 'education') ? ' *' : '')}
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required={sectionType === 'work_experience' || sectionType === 'education'}
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
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemContent, setEditingItemContent] = useState('');
  const [draggedItemId, setDraggedItemId] = useState(null);

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

  const updateBullet = async (itemId, content) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content
        })
      });
      setEditingItemId(null);
      setEditingItemContent('');
      await onUpdate();
    } catch (err) {
      console.error('Error updating bullet:', err);
    }
  };

  const reorderItems = async (draggedItemId, targetItemId) => {
    try {
      const token = localStorage.getItem('token');

      const items = summaryEntry?.items || [];
      const draggedIndex = items.findIndex(i => i.id === draggedItemId);
      const targetIndex = items.findIndex(i => i.id === targetItemId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Reorder locally
      const newItems = [...items];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, draggedItem);

      // Update order values
      const updates = newItems.map((item, index) => ({
        id: item.id,
        order: index
      }));

      // Send batch update to backend
      await fetch(`${API_URL}/api/items/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });

      await onUpdate();
    } catch (err) {
      console.error('Error reordering items:', err);
    }
  };

  return (
    <div className="summary-bullet-list">
      <h4>Summary Bullets</h4>

      {summaryEntry?.items && summaryEntry.items.length > 0 && (
        <ul className="summary-bullets">
          {summaryEntry.items.map(item => (
            <li
              key={item.id}
              className={`summary-bullet-item ${draggedItemId === item.id ? 'dragging' : ''}`}
              data-item-id={item.id}
              draggable="true"
              onDragStart={(e) => {
                e.stopPropagation();
                setDraggedItemId(item.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedItemId && draggedItemId !== item.id) {
                  reorderItems(draggedItemId, item.id);
                }
              }}
              onDragEnd={(e) => {
                e.stopPropagation();
                setDraggedItemId(null);
              }}
            >
              <span className="drag-handle-item" title="Drag to reorder">⋮</span>
              {editingItemId === item.id ? (
                <input
                  type="text"
                  className="edit-item-input"
                  value={editingItemContent}
                  autoFocus
                  onChange={(e) => setEditingItemContent(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && editingItemContent.trim()) {
                      updateBullet(item.id, editingItemContent);
                    }
                  }}
                  onBlur={() => {
                    if (editingItemContent.trim() && editingItemContent !== item.content) {
                      updateBullet(item.id, editingItemContent);
                    } else {
                      setEditingItemId(null);
                      setEditingItemContent('');
                    }
                  }}
                />
              ) : (
                <span className="bullet-content">{item.content}</span>
              )}
              <div className="item-actions">
                <button
                  className="btn-edit-tiny"
                  onClick={() => {
                    setEditingItemId(item.id);
                    setEditingItemContent(item.content);
                  }}
                >
                  ✏️
                </button>
                <button className="btn-delete-tiny" onClick={() => deleteBullet(item.id)}>×</button>
              </div>
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
