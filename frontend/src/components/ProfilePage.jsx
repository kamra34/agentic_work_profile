import { useState, useEffect } from 'react';
import './ProfilePage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    country: '',
    city: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    professional_title: '',
    years_of_experience: '',
    bio: '',
    availability: 'available',
    preferred_work_mode: 'hybrid'
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/profile-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfileData(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/profile-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        setIsEditing(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCancel = () => {
    fetchProfileData();
    setIsEditing(false);
  };

  return (
    <div className="profile-page">
      {/* Animated Background */}
      <div className="profile-bg-animation">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="success-toast">
          <span className="success-icon">✓</span>
          Profile saved successfully!
        </div>
      )}

      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-header-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              <div className="avatar-inner">
                {profileData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
              </div>
              <div className="avatar-ring"></div>
            </div>
            <div className="profile-header-info">
              <h1 className="profile-name">
                {profileData.full_name || 'Your Name'}
              </h1>
              <p className="profile-title">
                {profileData.professional_title || 'Professional Title'}
              </p>
              <div className="profile-status-badges">
                <span className={`status-badge ${profileData.availability}`}>
                  <span className="status-dot"></span>
                  {profileData.availability === 'available' ? 'Available' :
                   profileData.availability === 'busy' ? 'Busy' : 'Not Looking'}
                </span>
                <span className="experience-badge">
                  {profileData.years_of_experience ? `${profileData.years_of_experience} years exp` : 'Add experience'}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-header-actions">
            {!isEditing ? (
              <button className="btn-edit-profile" onClick={() => setIsEditing(true)}>
                <span className="btn-icon">✏️</span>
                Edit Profile
              </button>
            ) : (
              <div className="edit-actions">
                <button className="btn-cancel" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <span className="spinner-small"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">💾</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="profile-content">
        {/* Quick Links Section */}
        {!isEditing && (
          <div className="profile-quick-links">
            {profileData.linkedin_url && (
              <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer" className="quick-link linkedin">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn
              </a>
            )}
            {profileData.github_url && (
              <a href={profileData.github_url} target="_blank" rel="noopener noreferrer" className="quick-link github">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            )}
            {profileData.portfolio_url && (
              <a href={profileData.portfolio_url} target="_blank" rel="noopener noreferrer" className="quick-link portfolio">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                </svg>
                Portfolio
              </a>
            )}
          </div>
        )}

        {/* Bio Section */}
        {(!isEditing && profileData.bio) && (
          <div className="profile-card profile-bio-card">
            <div className="card-header">
              <h3 className="card-title">About Me</h3>
            </div>
            <div className="card-content">
              <p className="bio-text">{profileData.bio}</p>
            </div>
          </div>
        )}

        {/* Personal Information Card */}
        <div className="profile-card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="card-icon">👤</span>
              Personal Information
            </h3>
          </div>
          <div className="card-content">
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Full Name *</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="field-input"
                    value={profileData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="John Doe"
                  />
                ) : (
                  <div className="field-value">{profileData.full_name || 'Not provided'}</div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">Email *</label>
                {isEditing ? (
                  <input
                    type="email"
                    className="field-input"
                    value={profileData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                ) : (
                  <div className="field-value">{profileData.email || 'Not provided'}</div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    className="field-input"
                    value={profileData.phone_number}
                    onChange={(e) => handleChange('phone_number', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                ) : (
                  <div className="field-value">{profileData.phone_number || 'Not provided'}</div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">Professional Title</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="field-input"
                    value={profileData.professional_title}
                    onChange={(e) => handleChange('professional_title', e.target.value)}
                    placeholder="Senior Software Engineer"
                  />
                ) : (
                  <div className="field-value">{profileData.professional_title || 'Not provided'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="profile-card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="card-icon">📍</span>
              Location
            </h3>
          </div>
          <div className="card-content">
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Country</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="field-input"
                    value={profileData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder="United States"
                  />
                ) : (
                  <div className="field-value">{profileData.country || 'Not provided'}</div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="field-input"
                    value={profileData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="San Francisco"
                  />
                ) : (
                  <div className="field-value">{profileData.city || 'Not provided'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Online Presence Card */}
        <div className="profile-card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="card-icon">🔗</span>
              Online Presence
            </h3>
          </div>
          <div className="card-content">
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">
                  <svg className="label-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  LinkedIn URL
                </label>
                {isEditing ? (
                  <input
                    type="url"
                    className="field-input"
                    value={profileData.linkedin_url}
                    onChange={(e) => handleChange('linkedin_url', e.target.value)}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                ) : (
                  <div className="field-value field-value-link">
                    {profileData.linkedin_url ? (
                      <a href={profileData.linkedin_url} target="_blank" rel="noopener noreferrer">
                        {profileData.linkedin_url}
                      </a>
                    ) : 'Not provided'}
                  </div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">
                  <svg className="label-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub URL
                </label>
                {isEditing ? (
                  <input
                    type="url"
                    className="field-input"
                    value={profileData.github_url}
                    onChange={(e) => handleChange('github_url', e.target.value)}
                    placeholder="https://github.com/yourusername"
                  />
                ) : (
                  <div className="field-value field-value-link">
                    {profileData.github_url ? (
                      <a href={profileData.github_url} target="_blank" rel="noopener noreferrer">
                        {profileData.github_url}
                      </a>
                    ) : 'Not provided'}
                  </div>
                )}
              </div>

              <div className="form-field full-width">
                <label className="field-label">
                  <svg className="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                  </svg>
                  Portfolio URL
                </label>
                {isEditing ? (
                  <input
                    type="url"
                    className="field-input"
                    value={profileData.portfolio_url}
                    onChange={(e) => handleChange('portfolio_url', e.target.value)}
                    placeholder="https://yourportfolio.com"
                  />
                ) : (
                  <div className="field-value field-value-link">
                    {profileData.portfolio_url ? (
                      <a href={profileData.portfolio_url} target="_blank" rel="noopener noreferrer">
                        {profileData.portfolio_url}
                      </a>
                    ) : 'Not provided'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Career Information Card */}
        <div className="profile-card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="card-icon">💼</span>
              Career Information
            </h3>
          </div>
          <div className="card-content">
            <div className="form-grid">
              <div className="form-field">
                <label className="field-label">Years of Experience</label>
                {isEditing ? (
                  <input
                    type="number"
                    className="field-input"
                    value={profileData.years_of_experience}
                    onChange={(e) => handleChange('years_of_experience', e.target.value)}
                    placeholder="5"
                    min="0"
                  />
                ) : (
                  <div className="field-value">
                    {profileData.years_of_experience ? `${profileData.years_of_experience} years` : 'Not provided'}
                  </div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">Availability Status</label>
                {isEditing ? (
                  <select
                    className="field-input field-select"
                    value={profileData.availability}
                    onChange={(e) => handleChange('availability', e.target.value)}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="not_looking">Not Looking</option>
                  </select>
                ) : (
                  <div className="field-value">
                    <span className={`inline-status-badge ${profileData.availability}`}>
                      {profileData.availability === 'available' ? '✓ Available' :
                       profileData.availability === 'busy' ? '⏰ Busy' : '✗ Not Looking'}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-field">
                <label className="field-label">Preferred Work Mode</label>
                {isEditing ? (
                  <select
                    className="field-input field-select"
                    value={profileData.preferred_work_mode}
                    onChange={(e) => handleChange('preferred_work_mode', e.target.value)}
                  >
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                ) : (
                  <div className="field-value">
                    {profileData.preferred_work_mode === 'remote' ? '🏠 Remote' :
                     profileData.preferred_work_mode === 'onsite' ? '🏢 On-site' :
                     '🔀 Hybrid'}
                  </div>
                )}
              </div>

              <div className="form-field full-width">
                <label className="field-label">Bio / Professional Summary</label>
                {isEditing ? (
                  <textarea
                    className="field-input field-textarea"
                    value={profileData.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    placeholder="Write a brief summary about yourself, your expertise, and career goals..."
                    rows="4"
                  />
                ) : (
                  <div className="field-value">
                    {profileData.bio || 'Not provided'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
