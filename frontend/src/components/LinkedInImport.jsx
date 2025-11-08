import { useState } from 'react';
import './LinkedInImport.css';

const API_URL = 'http://localhost:8000';

function LinkedInImport({ onImportSuccess }) {
  const [linkedinText, setLinkedinText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!linkedinText.trim()) {
      setError('Please paste your LinkedIn profile content');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/profile/linkedin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          linkedin_url: linkedinText
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully imported! Added ${data.sections_added} sections and ${data.items_added} items from LinkedIn.`);
        setLinkedinText('');
        setTimeout(() => {
          if (onImportSuccess) onImportSuccess();
        }, 2000);
      } else {
        throw new Error(data.detail || 'Failed to import LinkedIn data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="linkedin-import">
      <div className="upload-header">
        <h2>Import from LinkedIn</h2>
        <p className="upload-subtitle">
          Add information from your LinkedIn profile to your CV
        </p>
      </div>

      <div className="linkedin-instructions">
        <h3>How to import your LinkedIn profile:</h3>
        <ol>
          <li>Go to your LinkedIn profile page</li>
          <li>Copy ALL the content (About, Experience, Education, Skills, etc.)</li>
          <li>Paste it in the text area below</li>
          <li>Click "Import from LinkedIn"</li>
        </ol>
        <p className="note">
          Note: You must have uploaded your CV first. The AI will intelligently merge
          LinkedIn data with your existing profile, avoiding duplicates.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="linkedin-form">
        <div className="form-group">
          <label htmlFor="linkedin-content">LinkedIn Profile Content</label>
          <textarea
            id="linkedin-content"
            value={linkedinText}
            onChange={(e) => setLinkedinText(e.target.value)}
            placeholder="Paste your entire LinkedIn profile content here...

Example:
About
Experienced Software Engineer with 5+ years...

Experience
Senior Software Engineer
Company Name · Full-time
Jan 2020 - Present · 2 yrs
Location
• Led development of...
• Implemented..."
            rows={15}
            className="linkedin-textarea"
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <button
          type="submit"
          disabled={loading || !linkedinText.trim()}
          className="btn-import"
        >
          {loading ? 'Importing...' : 'Import from LinkedIn'}
        </button>
      </form>
    </div>
  );
}

export default LinkedInImport;
