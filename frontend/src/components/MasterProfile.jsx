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
  const [addParentLevel, setAddParentLevel] = useState(0);

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

  const handleAddNode = (parentId = null, parentLevel = 0) => {
    setAddParentId(parentId);
    setAddParentLevel(parentLevel);
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
            setAddParentLevel(0);
          }}
          isChild={addParentId !== null}
          parentLevel={addParentLevel}
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
          <span className="node-title">
            {node.node_type === 'bullet' || node.node_type === 'paragraph'
              ? (node.content || 'Empty')
              : (node.title || 'Untitled')}
          </span>
          {node.subtitle && <span className="node-subtitle">• {node.subtitle}</span>}
        </div>

        <div className="node-actions">
          <button
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(node.id, level);
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
  // Helper function to render children
  const renderChildren = (children, level) => {
    if (!children || children.length === 0) return null;
    return children.map(child => renderNode(child, level));
  };

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
          {renderChildren(node.children, level + 1)}
        </div>
      );
    }

    // Entry level (job, education, etc.) with indentation for nested entries
    if (node.node_type === 'entry') {
      // Level 1 entries use two-column layout with dates/location on right
      if (level === 1) {
        return (
          <div key={node.id} className={`cv-entry level-${level}`}>
            <div className="entry-header">
              <div className="entry-main">
                <div className="entry-title">{node.title}</div>
                {node.subtitle && <div className="entry-subtitle">{node.subtitle}</div>}
              </div>
              {(node.start_date || node.end_date || node.location) && (
                <div className="entry-meta">
                  {node.start_date && <>{node.start_date}{node.end_date && ` - ${node.end_date}`}</>}
                  {node.location && (
                    <>
                      <br />
                      {node.location}
                    </>
                  )}
                </div>
              )}
            </div>
            {node.content && <div className="entry-description">{node.content}</div>}
            {renderChildren(node.children, level + 1)}
          </div>
        );
      }

      // Level 2+ entries use simplified single-column layout with tight spacing
      return (
        <div key={node.id} className={`cv-entry level-${level}`}>
          <div className="entry-title">{node.title}</div>
          {node.subtitle && <div className="entry-subtitle">{node.subtitle}</div>}
          {(node.start_date || node.end_date || node.location) && (
            <div className="entry-meta">
              {node.start_date && <>{node.start_date}{node.end_date && ` - ${node.end_date}`}</>}
              {node.location && ` | ${node.location}`}
            </div>
          )}
          {node.content && <div className="entry-description">{node.content}</div>}
          {renderChildren(node.children, level + 1)}
        </div>
      );
    }

    // Bullet level - shown as divs with bullet character
    if (node.node_type === 'bullet' || node.node_type === 'item') {
      // If it has content (text), show it as a bullet
      if (node.content) {
        return (
          <div key={node.id} className={`cv-bullet level-${level}`}>
            <span className="bullet-icon">•</span>
            <span className="bullet-content">
              {node.title && <strong>{node.title}: </strong>}
              {node.content}
            </span>
            {/* If bullet has children, nest them */}
            {node.children && node.children.length > 0 && (
              <div className="bullet-children">
                {renderChildren(node.children, level + 1)}
              </div>
            )}
          </div>
        );
      }
      // If it only has title, show title as bullet
      if (node.title) {
        return (
          <div key={node.id} className={`cv-bullet level-${level}`}>
            <span className="bullet-icon">•</span>
            <span className="bullet-content">{node.title}</span>
          </div>
        );
      }
      return null;
    }

    // Paragraph level - shown as text blocks with indentation
    if (node.node_type === 'paragraph') {
      return (
        <div key={node.id} className={`cv-paragraph level-${level}`}>
          {node.title && <h4 className="paragraph-title">{node.title}</h4>}
          {node.content && <p className="paragraph-content">{node.content}</p>}
          {node.children && node.children.length > 0 && (
            <div className="paragraph-children">
              {renderChildren(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    }

    // Default rendering for any other types
    return (
      <div key={node.id} className={`cv-node cv-node-${node.node_type}`}>
        {node.title && <strong>{node.title}</strong>}
        {node.content && <span> {node.content}</span>}
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
function NodeModal({ onSave, onCancel, isChild, parentLevel = 0 }) {
  // Level 2+ can only add bullets/paragraphs, not entries
  const canAddEntry = parentLevel < 2;
  const defaultType = isChild ? (canAddEntry ? 'entry' : 'bullet') : 'section';

  const [formData, setFormData] = useState({
    node_type: defaultType,
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
          <h2>{isChild ? 'Add Content' : 'Add Section'}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Only show type selector for child items, not for root sections */}
          {isChild && (
            <>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={formData.node_type}
                  onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
                >
                  {canAddEntry && <option value="entry">Entry - Main item (e.g., Job position, Degree)</option>}
                  <option value="bullet">Bullet - Single point or achievement (shown as • item)</option>
                  <option value="paragraph">Paragraph - Text block or description</option>
                </select>
              </div>
              <div className="form-help">
                <small>
                  {canAddEntry && <><strong>Entry:</strong> Job/degree with dates • </>}
                  <strong>Bullet:</strong> Achievement points (• bullets) •
                  <strong>Paragraph:</strong> Text blocks
                </small>
              </div>
            </>
          )}

          {/* For bullets and paragraphs, only show content field */}
          {(formData.node_type === 'bullet' || formData.node_type === 'paragraph') ? (
            <div className="form-group">
              <label>{formData.node_type === 'bullet' ? 'Bullet Point' : 'Paragraph Text'} *</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder={
                  formData.node_type === 'bullet'
                    ? 'Enter your achievement or responsibility'
                    : 'Enter your paragraph text'
                }
                rows={formData.node_type === 'paragraph' ? 5 : 3}
                required
              />
            </div>
          ) : (
            <>
              {/* Title and subtitle for sections and entries */}
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
                  placeholder={formData.node_type === 'section' ? 'Optional subtitle' : 'e.g., Company name'}
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Description"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Dates and Location - only for entries */}
          {formData.node_type === 'entry' && (
            <>
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
            </>
          )}

          {/* Icon - only for sections */}
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
