import { useState } from 'react';
import './ProfileUpload.css';

const API_URL = 'http://localhost:8000';

function ProfileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [model, setModel] = useState('gpt-4o');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase();
      if (ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a PDF or DOCX file');
        setFile(null);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('openai_model', model);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/profile/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      setSuccess('CV uploaded and processed successfully!');
      setFile(null);
      if (onUploadSuccess) {
        onUploadSuccess(data.profile);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h2>Upload Your CV</h2>
        <p className="upload-subtitle">
          Upload your resume in PDF or DOCX format. We'll use AI to extract and structure your information.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label htmlFor="file">Select CV File</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                id="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileChange}
                className="file-input"
              />
              <label htmlFor="file" className="file-label">
                {file ? file.name : 'Choose PDF or DOCX file'}
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="model">OpenAI Model</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="select-input"
            >
              <option value="gpt-4o">GPT-4o (Recommended)</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
            <small className="helper-text">
              GPT-4o provides the best accuracy for CV parsing
            </small>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={uploading || !file}
          >
            {uploading ? 'Processing...' : 'Upload and Process'}
          </button>
        </form>

        <div className="upload-info">
          <h3>What happens after upload?</h3>
          <ul>
            <li>Your CV is securely stored</li>
            <li>AI extracts sections (Work Experience, Education, Skills, etc.)</li>
            <li>Information is structured into editable sections</li>
            <li>You can review and edit all extracted data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ProfileUpload;
