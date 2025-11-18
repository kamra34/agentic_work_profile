import { useState } from 'react';
import './ContactInfoSection.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ContactInfoSection({ cvId, initialContactInfo, onUpdate, onSaveStart, onSaveComplete }) {
  const [contactInfo, setContactInfo] = useState(initialContactInfo || {});
  const [activeFields, setActiveFields] = useState(() => {
    // If _active_fields exists in the data, use it
    if (initialContactInfo?._active_fields) {
      return initialContactInfo._active_fields;
    }

    // Otherwise, initialize active fields based on which ones have values
    const initial = {};
    Object.keys(initialContactInfo || {}).forEach(key => {
      if (key !== '_active_fields') {
        initial[key] = !!initialContactInfo[key];
      }
    });
    return initial;
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Define all possible contact fields
  const contactFields = [
    { key: 'full_name', label: 'Full Name', icon: '👤', required: true },
    { key: 'professional_title', label: 'Professional Title', icon: '💼', required: false },
    { key: 'email', label: 'Email', icon: '✉️', required: true },
    { key: 'phone_number', label: 'Phone', icon: '📱', required: false },
    { key: 'city', label: 'City', icon: '🏙️', required: false },
    { key: 'country', label: 'Country', icon: '🌍', required: false },
    { key: 'linkedin_url', label: 'LinkedIn', icon: '💼', required: false },
    { key: 'github_url', label: 'GitHub', icon: '💻', required: false },
    { key: 'portfolio_url', label: 'Portfolio', icon: '🌐', required: false }
  ];

  const toggleField = async (fieldKey) => {
    // Don't allow toggling off required fields
    const field = contactFields.find(f => f.key === fieldKey);
    if (field?.required && activeFields[fieldKey]) {
      alert(`${field.label} is required and cannot be removed from the CV.`);
      return;
    }

    const newActiveFields = {
      ...activeFields,
      [fieldKey]: !activeFields[fieldKey]
    };
    setActiveFields(newActiveFields);

    // Save the active fields state
    await saveActiveFields(newActiveFields);
  };

  const saveActiveFields = async (newActiveFields) => {
    setIsSaving(true);
    if (onSaveStart) onSaveStart();

    try {
      const token = localStorage.getItem('token');

      // Create a contact info object with only active fields
      const activeContactInfo = {};
      Object.keys(newActiveFields).forEach(key => {
        if (newActiveFields[key]) {
          activeContactInfo[key] = contactInfo[key] || '';
        }
      });

      const response = await fetch(`${API_URL}/api/tailor/${cvId}/contact-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...activeContactInfo,
          _active_fields: newActiveFields // Store active state
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update contact info');
      }

      const data = await response.json();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      if (onUpdate) {
        onUpdate(data.contact_info);
      }

      if (onSaveComplete) onSaveComplete('success');
    } catch (error) {
      console.error('Error updating active fields:', error);
      alert('Failed to update fields. Please try again.');
      if (onSaveComplete) onSaveComplete('error');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (fieldKey) => {
    setEditingField(fieldKey);
    setEditValue(contactInfo[fieldKey] || '');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingField(null);
    setEditValue('');
  };

  const saveFieldValue = async () => {
    if (!editingField) return;

    setIsSaving(true);
    if (onSaveStart) onSaveStart();

    try {
      const token = localStorage.getItem('token');

      const updatedContactInfo = {
        ...contactInfo,
        [editingField]: editValue
      };

      // If the field now has a value and wasn't active, activate it
      const updatedActiveFields = { ...activeFields };
      if (editValue && !activeFields[editingField]) {
        updatedActiveFields[editingField] = true;
      }

      const response = await fetch(`${API_URL}/api/tailor/${cvId}/contact-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...updatedContactInfo,
          _active_fields: updatedActiveFields
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update contact info');
      }

      const data = await response.json();
      setContactInfo(updatedContactInfo);
      setActiveFields(updatedActiveFields);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      if (onUpdate) {
        onUpdate(data.contact_info);
      }

      if (onSaveComplete) onSaveComplete('success');
      closeEditModal();
    } catch (error) {
      console.error('Error updating contact info:', error);
      alert('Failed to update contact info. Please try again.');
      if (onSaveComplete) onSaveComplete('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset contact information to your current profile defaults? This will overwrite any custom changes for this CV.')) {
      return;
    }

    setIsResetting(true);
    if (onSaveStart) onSaveStart();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/contact-info/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset contact info');
      }

      const data = await response.json();
      setContactInfo(data.contact_info);

      // Reset active fields based on which have values
      const newActiveFields = {};
      Object.keys(data.contact_info).forEach(key => {
        newActiveFields[key] = !!data.contact_info[key];
      });
      setActiveFields(newActiveFields);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      if (onUpdate) {
        onUpdate(data.contact_info);
      }

      if (onSaveComplete) onSaveComplete('success');
    } catch (error) {
      console.error('Error resetting contact info:', error);
      alert('Failed to reset contact info. Please try again.');
      if (onSaveComplete) onSaveComplete('error');
    } finally {
      setIsResetting(false);
    }
  };

  const getFieldPreview = (fieldKey) => {
    const value = contactInfo[fieldKey];
    if (!value) return <span className="no-value">Not set</span>;

    // Truncate long values
    if (value.length > 30) {
      return value.substring(0, 30) + '...';
    }
    return value;
  };

  // Handle single click - toggle active/inactive
  const handleCircleClick = (fieldKey) => {
    toggleField(fieldKey);
  };

  // Handle double click - open edit modal
  const handleCircleDoubleClick = (fieldKey) => {
    openEditModal(fieldKey);
  };

  return (
    <div className="contact-info-section-compact">
      {showSuccess && (
        <div className="contact-success-toast">
          <span className="success-icon">✓</span>
          Updated!
        </div>
      )}

      <div className="contact-compact-header">
        <div className="contact-compact-title">
          <span className="contact-icon">📇</span>
          <h3>Contact Information</h3>
          <span className="contact-subtitle">Click to toggle • Double-click to edit</span>
        </div>
        <button
          className="btn-reset-compact"
          onClick={handleReset}
          disabled={isResetting}
        >
          {isResetting ? (
            <>
              <span className="spinner-tiny"></span>
              Resetting...
            </>
          ) : (
            <>
              <span className="btn-icon">🔄</span>
              Reset
            </>
          )}
        </button>
      </div>

      <div className="contact-fields-circular">
        {contactFields.map(field => {
          const isActive = activeFields[field.key];
          const hasValue = !!contactInfo[field.key];
          const value = contactInfo[field.key];

          return (
            <div
              key={field.key}
              className={`contact-circle-item ${isActive ? 'active' : 'inactive'} ${!hasValue ? 'no-value' : ''}`}
              onClick={() => handleCircleClick(field.key)}
              onDoubleClick={() => handleCircleDoubleClick(field.key)}
            >
              <div className="circle-button">
                {field.required && <div className="circle-required-dot"></div>}
                <span className="circle-icon">{field.icon}</span>
              </div>
              <span className="circle-label">{field.label}</span>

              {/* Tooltip showing current value on hover */}
              <div className="circle-tooltip">
                {value ? (value.length > 30 ? value.substring(0, 30) + '...' : value) : 'Not set'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingField && contactFields.find(f => f.key === editingField)?.icon}
                {' '}
                Edit {editingField && contactFields.find(f => f.key === editingField)?.label}
              </h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <div className="modal-body">
              <label className="modal-label">
                {editingField && contactFields.find(f => f.key === editingField)?.label}
              </label>
              {editingField && (editingField.includes('url') || editingField === 'email') ? (
                <input
                  type={editingField === 'email' ? 'email' : 'url'}
                  className="modal-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={`Enter ${contactFields.find(f => f.key === editingField)?.label.toLowerCase()}`}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  className="modal-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={`Enter ${contactFields.find(f => f.key === editingField)?.label.toLowerCase()}`}
                  autoFocus
                />
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={closeEditModal}>
                Cancel
              </button>
              <button
                className="btn-modal-save"
                onClick={saveFieldValue}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-tiny"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactInfoSection;
