import { useState, useEffect, useRef } from 'react';
import './ProfilePage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const AI_SETTINGS_AUTOSAVE_DELAY_MS = 900;

const buildAISettingsPayload = (settings, openaiKey, anthropicKey, clearFlags) => {
  const payload = {
    openai_model: settings.openai_model,
    openai_reasoning_effort: settings.openai_reasoning_effort,
    claude_model: settings.claude_model,
    humanity_deep_mode_enabled: settings.humanity_deep_mode_enabled,
    humanity_llm_model: settings.humanity_llm_model,
    humanity_llm_reasoning_effort: settings.humanity_llm_reasoning_effort
  };

  if ((openaiKey || '').trim()) {
    payload.openai_api_key = openaiKey.trim();
  }
  if ((anthropicKey || '').trim()) {
    payload.anthropic_api_key = anthropicKey.trim();
  }
  if (clearFlags?.openai) {
    payload.clear_openai_api_key = true;
  }
  if (clearFlags?.anthropic) {
    payload.clear_anthropic_api_key = true;
  }

  return payload;
};

function ProfilePage() {
  const defaultAISettings = {
    openai_model: 'gpt-4o',
    openai_reasoning_effort: 'medium',
    claude_model: 'claude-sonnet-4-20250514',
    openai_api_key_configured: false,
    anthropic_api_key_configured: false,
    humanity_deep_mode_enabled: true,
    humanity_llm_model: 'gpt-4o',
    humanity_llm_reasoning_effort: 'low'
  };
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [clearKeyFlags, setClearKeyFlags] = useState({
    openai: false,
    anthropic: false
  });
  const [aiAutoSaveStatus, setAiAutoSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [aiAutoSaveError, setAiAutoSaveError] = useState('');
  const aiSettingsReadyRef = useRef(false);
  const lastSavedAISignatureRef = useRef('');
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
  const [aiSettings, setAiSettings] = useState(defaultAISettings);

  useEffect(() => {
    fetchProfileData();
    fetchAISettings();
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

  const fetchAISettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user/ai-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAiSettings(prev => ({
          ...prev,
          ...data
        }));
        setOpenaiKeyInput('');
        setAnthropicKeyInput('');
        setClearKeyFlags({ openai: false, anthropic: false });
        const baselinePayload = buildAISettingsPayload(data, '', '', { openai: false, anthropic: false });
        lastSavedAISignatureRef.current = JSON.stringify(baselinePayload);
        aiSettingsReadyRef.current = true;
        setAiAutoSaveStatus('saved');
        setAiAutoSaveError('');
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
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

  const handleSaveAISettings = async ({ auto = false, payloadOverride = null } = {}) => {
    if (isSavingAISettings) {
      return;
    }
    setIsSavingAISettings(true);
    setAiAutoSaveStatus('saving');
    setAiAutoSaveError('');
    try {
      const token = localStorage.getItem('token');
      const payload = payloadOverride || buildAISettingsPayload(aiSettings, openaiKeyInput, anthropicKeyInput, clearKeyFlags);

      const response = await fetch(`${API_URL}/api/user/ai-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Failed to save AI settings');
      }

      const saved = await response.json();
      setAiSettings(saved);
      setOpenaiKeyInput('');
      setAnthropicKeyInput('');
      setClearKeyFlags({ openai: false, anthropic: false });
      const baselinePayload = buildAISettingsPayload(saved, '', '', { openai: false, anthropic: false });
      lastSavedAISignatureRef.current = JSON.stringify(baselinePayload);
      aiSettingsReadyRef.current = true;
      setAiAutoSaveStatus('saved');
      if (!auto) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setAiAutoSaveStatus('error');
      setAiAutoSaveError(error.message || 'Failed to save AI settings.');
      if (!auto) {
        alert(error.message || 'Failed to save AI settings. Please try again.');
      }
    } finally {
      setIsSavingAISettings(false);
    }
  };

  const handleChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAISettingChange = (field, value) => {
    setAiSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProviderKeyInput = (provider, value) => {
    if (provider === 'openai') {
      setOpenaiKeyInput(value);
      if (value.trim()) {
        setClearKeyFlags(prev => ({ ...prev, openai: false }));
      }
      return;
    }
    setAnthropicKeyInput(value);
    if (value.trim()) {
      setClearKeyFlags(prev => ({ ...prev, anthropic: false }));
    }
  };

  const handleClearProviderKey = (provider) => {
    if (provider === 'openai') {
      setOpenaiKeyInput('');
      setClearKeyFlags(prev => ({ ...prev, openai: true }));
      return;
    }
    setAnthropicKeyInput('');
    setClearKeyFlags(prev => ({ ...prev, anthropic: true }));
  };

  const handleProviderKeyBlur = () => {
    if (!aiSettingsReadyRef.current || isSavingAISettings) {
      return;
    }
    if (!openaiKeyInput.trim() && !anthropicKeyInput.trim()) {
      return;
    }
    handleSaveAISettings({ auto: true });
  };

  useEffect(() => {
    if (!aiSettingsReadyRef.current || isSavingAISettings) {
      return;
    }
    if (openaiKeyInput.trim() || anthropicKeyInput.trim()) {
      return;
    }

    const payload = buildAISettingsPayload(aiSettings, openaiKeyInput, anthropicKeyInput, clearKeyFlags);
    const signature = JSON.stringify(payload);
    if (signature === lastSavedAISignatureRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      handleSaveAISettings({ auto: true, payloadOverride: payload });
    }, AI_SETTINGS_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [aiSettings, openaiKeyInput, anthropicKeyInput, clearKeyFlags, isSavingAISettings]);

  const handleCancel = () => {
    fetchProfileData();
    fetchAISettings();
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
          Saved successfully!
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


        <div className="profile-card ai-settings-card">
          <div className="card-header ai-settings-header">
            <div className="ai-settings-title-wrap">
              <h3 className="card-title ai-settings-title">
                <span className="card-icon ai-card-icon">⚙</span>
                AI Settings
              </h3>
              <p className="ai-settings-subtitle">
                Configure the runtime models used by Tailor CV and Humanity Guard.
              </p>
            </div>
          </div>
          <div className="card-content ai-settings-content">
            <div className="ai-setting-group">
              <h4 className="ai-group-title">Provider API Keys (Required)</h4>
              <p className="ai-keys-note">
                Server keys are disabled. Every AI request uses only your own provider keys.
              </p>
              <div className="ai-settings-grid">
                <div className="ai-setting-field">
                  <label className="ai-setting-label">OpenAI API Key</label>
                  <p className="ai-setting-help">Used for OpenAI analysis, scoring, refinement, and humanity deep check.</p>
                  <div className="ai-key-status-row">
                    <span className={`ai-key-badge ${(aiSettings.openai_api_key_configured && !clearKeyFlags.openai) ? 'configured' : 'missing'}`}>
                      {(aiSettings.openai_api_key_configured && !clearKeyFlags.openai) ? 'Configured' : 'Not configured'}
                    </span>
                    {(aiSettings.openai_api_key_configured && !clearKeyFlags.openai) && (
                      <button
                        type="button"
                        className="ai-key-clear-btn"
                        onClick={() => handleClearProviderKey('openai')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    className="field-input ai-key-input"
                    value={openaiKeyInput}
                    onChange={(e) => handleProviderKeyInput('openai', e.target.value)}
                    onBlur={handleProviderKeyBlur}
                    placeholder={aiSettings.openai_api_key_configured && !clearKeyFlags.openai ? 'Enter new key to rotate' : 'sk-...'}
                    autoComplete="off"
                  />
                </div>

                <div className="ai-setting-field">
                  <label className="ai-setting-label">Claude API Key</label>
                  <p className="ai-setting-help">Used for Claude analysis, scoring, and node recommendations.</p>
                  <div className="ai-key-status-row">
                    <span className={`ai-key-badge ${(aiSettings.anthropic_api_key_configured && !clearKeyFlags.anthropic) ? 'configured' : 'missing'}`}>
                      {(aiSettings.anthropic_api_key_configured && !clearKeyFlags.anthropic) ? 'Configured' : 'Not configured'}
                    </span>
                    {(aiSettings.anthropic_api_key_configured && !clearKeyFlags.anthropic) && (
                      <button
                        type="button"
                        className="ai-key-clear-btn"
                        onClick={() => handleClearProviderKey('anthropic')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    className="field-input ai-key-input"
                    value={anthropicKeyInput}
                    onChange={(e) => handleProviderKeyInput('anthropic', e.target.value)}
                    onBlur={handleProviderKeyBlur}
                    placeholder={aiSettings.anthropic_api_key_configured && !clearKeyFlags.anthropic ? 'Enter new key to rotate' : 'sk-ant-...'}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="ai-setting-group">
              <h4 className="ai-group-title">Tailor CV Runtime</h4>
              <div className="ai-settings-grid">
                <div className="ai-setting-field">
                  <label className="ai-setting-label">OpenAI Model</label>
                  <p className="ai-setting-help">Used for OpenAI job analysis, scoring, and node selection.</p>
                  <select
                    className="field-input field-select ai-setting-select"
                    value={aiSettings.openai_model}
                    onChange={(e) => handleAISettingChange('openai_model', e.target.value)}
                  >
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-5.1">gpt-5.1</option>
                  </select>
                </div>

                <div className="ai-setting-field">
                  <label className="ai-setting-label">OpenAI Reasoning Effort</label>
                  <p className="ai-setting-help">Only applied when OpenAI model is set to gpt-5.1.</p>
                  <select
                    className="field-input field-select ai-setting-select"
                    value={aiSettings.openai_reasoning_effort}
                    onChange={(e) => handleAISettingChange('openai_reasoning_effort', e.target.value)}
                    disabled={aiSettings.openai_model !== 'gpt-5.1'}
                  >
                    <option value="none">none</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>

                <div className="ai-setting-field ai-setting-field-wide">
                  <label className="ai-setting-label">Claude Model</label>
                  <p className="ai-setting-help">Used for parallel Claude analysis, scoring, and node recommendations.</p>
                  <select
                    className="field-input field-select ai-setting-select"
                    value={aiSettings.claude_model}
                    onChange={(e) => handleAISettingChange('claude_model', e.target.value)}
                  >
                    <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
                    {aiSettings.claude_model !== 'claude-sonnet-4-20250514' && (
                      <option value={aiSettings.claude_model}>{aiSettings.claude_model}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="ai-setting-group">
              <h4 className="ai-group-title">Humanity Guard Runtime</h4>
              <div className="ai-settings-grid">
                <div className="ai-setting-field ai-setting-field-wide">
                  <label className="ai-setting-label">Humanity Deep Mode</label>
                  <p className="ai-setting-help">Enable/disable LLM critic layer in deep humanity checks and export guard.</p>
                  <div className="ai-segmented">
                    <button
                      type="button"
                      className={`ai-segment-btn ${aiSettings.humanity_deep_mode_enabled ? 'active' : ''}`}
                      onClick={() => handleAISettingChange('humanity_deep_mode_enabled', true)}
                    >
                      Enabled
                    </button>
                    <button
                      type="button"
                      className={`ai-segment-btn ${!aiSettings.humanity_deep_mode_enabled ? 'active' : ''}`}
                      onClick={() => handleAISettingChange('humanity_deep_mode_enabled', false)}
                    >
                      Disabled
                    </button>
                  </div>
                </div>

                <div className="ai-setting-field">
                  <label className="ai-setting-label">Humanity LLM Model</label>
                  <p className="ai-setting-help">Model used by Humanity Guard when deep mode is enabled.</p>
                  <select
                    className="field-input field-select ai-setting-select"
                    value={aiSettings.humanity_llm_model}
                    onChange={(e) => handleAISettingChange('humanity_llm_model', e.target.value)}
                    disabled={!aiSettings.humanity_deep_mode_enabled}
                  >
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-5.1">gpt-5.1</option>
                  </select>
                </div>

                <div className="ai-setting-field">
                  <label className="ai-setting-label">Humanity LLM Reasoning</label>
                  <p className="ai-setting-help">Reasoning effort for the deep-mode LLM critic (gpt-5.1 only).</p>
                  <select
                    className="field-input field-select ai-setting-select"
                    value={aiSettings.humanity_llm_reasoning_effort}
                    onChange={(e) => handleAISettingChange('humanity_llm_reasoning_effort', e.target.value)}
                    disabled={!aiSettings.humanity_deep_mode_enabled || aiSettings.humanity_llm_model !== 'gpt-5.1'}
                  >
                    <option value="none">none</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="ai-save-row">
              <button
                className="btn-save ai-settings-save"
                onClick={() => handleSaveAISettings({ auto: false })}
                disabled={isSavingAISettings}
              >
                {isSavingAISettings ? 'Saving...' : 'Save Now'}
              </button>
              <div className={`ai-autosave-status ${aiAutoSaveStatus}`}>
                {aiAutoSaveStatus === 'saving' && 'Auto-saving changes...'}
                {aiAutoSaveStatus === 'saved' && 'All AI settings changes are saved automatically.'}
                {aiAutoSaveStatus === 'error' && (aiAutoSaveError || 'Auto-save failed. Please retry.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
