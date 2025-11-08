import { useState } from 'react';
import './ManualEntry.css';

const API_URL = 'http://localhost:8000';

const SECTION_TYPES = [
  { value: 'summary', label: 'Summary' },
  { value: 'experience', label: 'Work Experience' },
  { value: 'education', label: 'Education' },
  { value: 'skills', label: 'Skills' },
  { value: 'certifications', label: 'Certifications' },
  { value: 'projects', label: 'Projects' },
  { value: 'awards', label: 'Awards' },
  { value: 'other', label: 'Other' }
];

function ManualEntry({ profile, onSuccess }) {
  const [activeTab, setActiveTab] = useState('section');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Section form
  const [sectionForm, setSectionForm] = useState({
    title: '',
    section_type: 'summary',
    content: ''
  });

  // Entry form
  const [entryForm, setEntryForm] = useState({
    section_id: '',
    title: '',
    subtitle: '',
    start_date: '',
    end_date: '',
    location: '',
    description: ''
  });

  // Item form
  const [itemForm, setItemForm] = useState({
    section_id: '',
    entry_id: '',
    content: ''
  });

  const handleAddSection = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profile/sections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: sectionForm.title,
          section_type: sectionForm.section_type,
          content: sectionForm.content || null,
          order: 999
        })
      });

      if (response.ok) {
        setSuccess('Section added successfully!');
        setSectionForm({ title: '', section_type: 'summary', content: '' });
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add section');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sections/${entryForm.section_id}/entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: entryForm.title,
          subtitle: entryForm.subtitle || null,
          start_date: entryForm.start_date || null,
          end_date: entryForm.end_date || null,
          location: entryForm.location || null,
          description: entryForm.description || null,
          order: 999
        })
      });

      if (response.ok) {
        setSuccess('Entry added successfully!');
        setEntryForm({
          section_id: entryForm.section_id,
          title: '',
          subtitle: '',
          start_date: '',
          end_date: '',
          location: '',
          description: ''
        });
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add entry');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/entries/${itemForm.entry_id}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: itemForm.content,
          order: 999
        })
      });

      if (response.ok) {
        setSuccess('Item added successfully!');
        setItemForm({
          section_id: itemForm.section_id,
          entry_id: itemForm.entry_id,
          content: ''
        });
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add item');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEntriesForSection = (sectionId) => {
    if (!profile || !profile.sections) return [];
    const section = profile.sections.find(s => s.id === parseInt(sectionId));
    return section ? section.entries : [];
  };

  return (
    <div className="manual-entry-container">
      <div className="manual-entry-header">
        <h2>Add Manual Entry</h2>
        <p className="manual-entry-subtitle">
          Manually add sections, entries, or items to your profile
        </p>
      </div>

      <div className="manual-entry-tabs">
        <button
          className={`tab-button ${activeTab === 'section' ? 'active' : ''}`}
          onClick={() => setActiveTab('section')}
        >
          Add Section
        </button>
        <button
          className={`tab-button ${activeTab === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveTab('entry')}
        >
          Add Entry
        </button>
        <button
          className={`tab-button ${activeTab === 'item' ? 'active' : ''}`}
          onClick={() => setActiveTab('item')}
        >
          Add Item
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {activeTab === 'section' && (
        <form onSubmit={handleAddSection} className="manual-entry-form">
          <div className="form-group">
            <label htmlFor="section-title">Section Title *</label>
            <input
              id="section-title"
              type="text"
              value={sectionForm.title}
              onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
              placeholder="e.g., Summary of Qualifications"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="section-type">Section Type *</label>
            <select
              id="section-type"
              value={sectionForm.section_type}
              onChange={(e) => setSectionForm({ ...sectionForm, section_type: e.target.value })}
              required
            >
              {SECTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="section-content">Content (Optional)</label>
            <textarea
              id="section-content"
              value={sectionForm.content}
              onChange={(e) => setSectionForm({ ...sectionForm, content: e.target.value })}
              placeholder="Enter section content (for sections like Summary)"
              rows={4}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Adding...' : 'Add Section'}
          </button>
        </form>
      )}

      {activeTab === 'entry' && (
        <form onSubmit={handleAddEntry} className="manual-entry-form">
          <div className="form-group">
            <label htmlFor="entry-section">Select Section *</label>
            <select
              id="entry-section"
              value={entryForm.section_id}
              onChange={(e) => setEntryForm({ ...entryForm, section_id: e.target.value })}
              required
            >
              <option value="">-- Choose a section --</option>
              {profile?.sections?.map(section => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="entry-title">Title *</label>
            <input
              id="entry-title"
              type="text"
              value={entryForm.title}
              onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="entry-subtitle">Subtitle (Optional)</label>
            <input
              id="entry-subtitle"
              type="text"
              value={entryForm.subtitle}
              onChange={(e) => setEntryForm({ ...entryForm, subtitle: e.target.value })}
              placeholder="e.g., Company Name"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="entry-start-date">Start Date (Optional)</label>
              <input
                id="entry-start-date"
                type="text"
                value={entryForm.start_date}
                onChange={(e) => setEntryForm({ ...entryForm, start_date: e.target.value })}
                placeholder="MM/YYYY"
              />
            </div>

            <div className="form-group">
              <label htmlFor="entry-end-date">End Date (Optional)</label>
              <input
                id="entry-end-date"
                type="text"
                value={entryForm.end_date}
                onChange={(e) => setEntryForm({ ...entryForm, end_date: e.target.value })}
                placeholder="MM/YYYY or Present"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="entry-location">Location (Optional)</label>
            <input
              id="entry-location"
              type="text"
              value={entryForm.location}
              onChange={(e) => setEntryForm({ ...entryForm, location: e.target.value })}
              placeholder="e.g., San Francisco, CA"
            />
          </div>

          <div className="form-group">
            <label htmlFor="entry-description">Description (Optional)</label>
            <textarea
              id="entry-description"
              value={entryForm.description}
              onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
              placeholder="Describe this experience or entry"
              rows={3}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !entryForm.section_id}>
            {loading ? 'Adding...' : 'Add Entry'}
          </button>
        </form>
      )}

      {activeTab === 'item' && (
        <form onSubmit={handleAddItem} className="manual-entry-form">
          <div className="form-group">
            <label htmlFor="item-section">Select Section *</label>
            <select
              id="item-section"
              value={itemForm.section_id}
              onChange={(e) => setItemForm({ ...itemForm, section_id: e.target.value, entry_id: '' })}
              required
            >
              <option value="">-- Choose a section --</option>
              {profile?.sections?.map(section => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="item-entry">Select Entry *</label>
            <select
              id="item-entry"
              value={itemForm.entry_id}
              onChange={(e) => setItemForm({ ...itemForm, entry_id: e.target.value })}
              required
              disabled={!itemForm.section_id}
            >
              <option value="">-- Choose an entry --</option>
              {getEntriesForSection(itemForm.section_id).map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="item-content">Item Content *</label>
            <textarea
              id="item-content"
              value={itemForm.content}
              onChange={(e) => setItemForm({ ...itemForm, content: e.target.value })}
              placeholder="Enter bullet point or item content"
              rows={3}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !itemForm.entry_id}>
            {loading ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}
    </div>
  );
}

export default ManualEntry;
