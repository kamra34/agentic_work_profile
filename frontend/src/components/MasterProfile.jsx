import { useState, useEffect } from 'react';
import './MasterProfile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function MasterProfile() {
  const [profile, setProfile] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profiles = await response.json();

      if (profiles && profiles.length > 0) {
        const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
        setProfile(defaultProfile);
        setNodes(defaultProfile.nodes || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNode = (parentId = null) => {
    setAddParentId(parentId);
    setShowAddModal(true);
  };

  const handleSaveNode = async (nodeData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles/${profile.id}/nodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...nodeData, parent_id: addParentId })
      });

      if (response.ok) {
        await fetchProfile();
        setShowAddModal(false);
        setAddParentId(null);
      }
    } catch (error) {
      console.error('Error saving node:', error);
    }
  };

  const handleUpdateNode = async (nodeId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchProfile();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating node:', error);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!confirm('Delete this item and all its children?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchProfile();
      setSelectedNode(null);
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  };

  if (loading) {
    return <div className="master-profile-loading">Loading profile...</div>;
  }

  return (
    <div className="master-profile">
      <div className="master-profile-header">
        <h1>Master Profile</h1>
        <p>Build your comprehensive professional profile with unlimited flexibility</p>
      </div>

      <div className="master-profile-content">
        {/* Left Panel - Editor */}
        <div className="editor-panel">
          <div className="editor-header">
            <h2>Profile Structure</h2>
            <button
              className="btn-primary"
              onClick={() => handleAddNode(null)}
            >
              + Add Section
            </button>
          </div>

          <div className="tree-view">
            {nodes.length === 0 ? (
              <div className="empty-state">
                <p>No content yet. Start by adding a section!</p>
                <button
                  className="btn-primary"
                  onClick={() => handleAddNode(null)}
                >
                  + Add First Section
                </button>
              </div>
            ) : (
              nodes.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  selectedNode={selectedNode}
                  onSelect={setSelectedNode}
                  onAdd={handleAddNode}
                  onUpdate={handleUpdateNode}
                  onDelete={handleDeleteNode}
                  level={0}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="preview-panel">
          <div className="preview-header">
            <h2>Live Preview</h2>
            <span className="preview-label">How it looks in your CV</span>
          </div>

          <div className="cv-preview">
            <CVPreviewContent nodes={nodes} profile={profile} />
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <NodeModal
          onSave={handleSaveNode}
          onCancel={() => {
            setShowAddModal(false);
            setAddParentId(null);
          }}
          isChild={addParentId !== null}
        />
      )}
    </div>
  );
}

// Tree Node Component - Recursive
function TreeNode({ node, selectedNode, onSelect, onAdd, onUpdate, onDelete, level }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedNode?.id === node.id;

  return (
    <div className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
      <div
        className={`node-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(node)}
      >
        {node.children && node.children.length > 0 && (
          <button
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        <div className="node-content">
          <span className="node-type-badge">{node.node_type}</span>
          <span className="node-title">{node.title || 'Untitled'}</span>
          {node.subtitle && <span className="node-subtitle">• {node.subtitle}</span>}
        </div>

        <div className="node-actions">
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(node.id);
            }}
            title="Add child"
          >
            +
          </button>
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div className="node-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              onSelect={onSelect}
              onAdd={onAdd}
              onUpdate={onUpdate}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// CV Preview Component
function CVPreviewContent({ nodes, profile }) {
  const renderNode = (node, level = 0) => {
    if (!node.is_visible) return null;

    // Section level
    if (node.node_type === 'section' && level === 0) {
      return (
        <div key={node.id} className="cv-section">
          <h2 className="cv-section-title">
            {node.icon && <span className="section-icon">{node.icon}</span>}
            {node.title}
          </h2>
          {node.content && <p className="section-content">{node.content}</p>}
          {node.children && node.children.map(child => renderNode(child, level + 1))}
        </div>
      );
    }

    // Entry level (job, education, etc.)
    if (node.node_type === 'entry') {
      return (
        <div key={node.id} className="cv-entry">
          <div className="entry-header">
            <div className="entry-main">
              <h3 className="entry-title">{node.title}</h3>
              {node.subtitle && <div className="entry-subtitle">{node.subtitle}</div>}
            </div>
            {(node.start_date || node.end_date || node.location) && (
              <div className="entry-meta">
                {node.start_date && (
                  <span className="entry-date">
                    {node.start_date} {node.end_date && `- ${node.end_date}`}
                  </span>
                )}
                {node.location && <span className="entry-location"> | {node.location}</span>}
              </div>
            )}
          </div>
          {node.content && <p className="entry-description">{node.content}</p>}
          {node.children && node.children.length > 0 && (
            <ul className="entry-items">
              {node.children.map(child => renderNode(child, level + 1))}
            </ul>
          )}
        </div>
      );
    }

    // Item/bullet level
    if (node.node_type === 'item' || node.node_type === 'bullet') {
      // If it has content (text), show it as a bullet
      if (node.content) {
        return (
          <li key={node.id} className="cv-item">
            {node.title && <strong>{node.title}: </strong>}
            {node.content}
            {/* If bullet has children, nest them */}
            {node.children && node.children.length > 0 && (
              <ul className="nested-items">
                {node.children.map(child => renderNode(child, level + 1))}
              </ul>
            )}
          </li>
        );
      }
      // If it only has title, show title as bullet
      if (node.title) {
        return (
          <li key={node.id} className="cv-item">
            {node.title}
          </li>
        );
      }
      return null;
    }

    // Default rendering
    return (
      <div key={node.id} className={`cv-node cv-node-${node.node_type}`}>
        {node.title && <strong>{node.title}</strong>}
        {node.content && <span>{node.content}</span>}
        {node.children && node.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="cv-document">
      {/* Contact Info */}
      {profile?.contact_info && (
        <div className="cv-header">
          <h1>{profile.contact_info.name || 'Your Name'}</h1>
          <div className="cv-contact">
            {profile.contact_info.email && <span>{profile.contact_info.email}</span>}
            {profile.contact_info.phone && <span> | {profile.contact_info.phone}</span>}
            {profile.contact_info.location && <span> | {profile.contact_info.location}</span>}
          </div>
        </div>
      )}

      {/* Sections */}
      {nodes.map(node => renderNode(node, 0))}
    </div>
  );
}

// Node Modal Component
function NodeModal({ onSave, onCancel, isChild }) {
  const [formData, setFormData] = useState({
    node_type: isChild ? 'entry' : 'section',
    title: '',
    subtitle: '',
    content: '',
    content_type: 'text',
    start_date: '',
    end_date: '',
    location: '',
    icon: '',
    order: 0,
    is_visible: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add {isChild ? 'Item' : 'Section'}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Type</label>
            <select
              value={formData.node_type}
              onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
            >
              <option value="section">Section - Top level (e.g., Work Experience, Education)</option>
              <option value="entry">Entry - Main item (e.g., Job position, Degree)</option>
              <option value="item">Item - Bullet point or achievement</option>
              <option value="bullet">Bullet - Same as Item (alternative name)</option>
            </select>
          </div>
          <div className="form-help">
            <small>
              <strong>Section:</strong> Top-level like "Work Experience" •
              <strong>Entry:</strong> Job/degree with dates •
              <strong>Item/Bullet:</strong> Achievement points
            </small>
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Work Experience, Senior Engineer"
              required
            />
          </div>

          <div className="form-group">
            <label>Subtitle</label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="e.g., Company name"
            />
          </div>

          <div className="form-group">
            <label>Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Description or bullet point text"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="text"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                placeholder="Jan 2020"
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="text"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                placeholder="Present"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="San Francisco, CA"
            />
          </div>

          {formData.node_type === 'section' && (
            <div className="form-group">
              <label>Icon (emoji)</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="💼"
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MasterProfile;
