import { useState, useEffect } from 'react';
import './MasterProfile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function MasterProfile() {
  const [profile, setProfile] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState(null);
  const [addParentLevel, setAddParentLevel] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async (preserveState = false) => {
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

        // Only reset expanded nodes on initial load, preserve them on updates
        if (!preserveState) {
          setExpandedNodes(new Set());
        }
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

  const handleEditNode = (node) => {
    setEditingNode(node);
    setShowEditModal(true);
  };

  // Find all ancestor IDs for a given node
  const findNodePath = (nodes, targetId, path = []) => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...path, node.id];
      }
      if (node.children && node.children.length > 0) {
        const found = findNodePath(node.children, targetId, [...path, node.id]);
        if (found) return found;
      }
    }
    return null;
  };

  // Handle clicking a node in the preview - expand path and scroll to it
  const handlePreviewNodeClick = (nodeId) => {
    const path = findNodePath(nodes, nodeId);
    if (path) {
      // Expand all parent nodes (all except the last one which is the target)
      const newExpandedNodes = new Set(expandedNodes);
      path.slice(0, -1).forEach(id => newExpandedNodes.add(id));
      setExpandedNodes(newExpandedNodes);

      // Find and select the node
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const targetNode = findNode(nodes, nodeId);
      if (targetNode) {
        setSelectedNode(targetNode);

        // Scroll to the node after a short delay to allow expansion animation
        setTimeout(() => {
          const element = document.querySelector(`[data-node-id="${nodeId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  };

  const handleSaveNode = async (nodeData) => {
    try {
      // Save current scroll position
      const editorPanel = document.querySelector('.editor-panel');
      const currentScroll = editorPanel?.scrollTop || 0;

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
        await fetchProfile(true); // Preserve state
        setShowAddModal(false);
        setAddParentId(null);

        // Restore scroll position after DOM updates
        setTimeout(() => {
          if (editorPanel) {
            editorPanel.scrollTop = currentScroll;
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error saving node:', error);
    }
  };

  const handleSaveEditNode = async (nodeData) => {
    try {
      await handleUpdateNode(editingNode.id, nodeData);
      setShowEditModal(false);
      setEditingNode(null);
    } catch (error) {
      console.error('Error updating node:', error);
    }
  };

  const handleUpdateNode = async (nodeId, updates) => {
    try {
      // Save current scroll position
      const editorPanel = document.querySelector('.editor-panel');
      const currentScroll = editorPanel?.scrollTop || 0;

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
        await fetchProfile(true); // Preserve state

        // Restore scroll position after DOM updates
        setTimeout(() => {
          if (editorPanel) {
            editorPanel.scrollTop = currentScroll;
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error updating node:', error);
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!confirm('Delete this item and all its children?')) return;

    try {
      // Save current scroll position
      const editorPanel = document.querySelector('.editor-panel');
      const currentScroll = editorPanel?.scrollTop || 0;

      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchProfile(true); // Preserve state
      setSelectedNode(null);

      // Restore scroll position after DOM updates
      setTimeout(() => {
        if (editorPanel) {
          editorPanel.scrollTop = currentScroll;
        }
      }, 50);
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  };

  const handleReorderNode = async (draggedNodeId, targetNodeId, position) => {
    try {
      const token = localStorage.getItem('token');

      // Find the dragged and target nodes to get their parent context
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const findParent = (nodes, childId) => {
        for (const node of nodes) {
          if (node.children && node.children.find(c => c.id === childId)) {
            return node;
          }
          if (node.children) {
            const found = findParent(node.children, childId);
            if (found) return found;
          }
        }
        return null;
      };

      const draggedNode = findNode(nodes, draggedNodeId);
      const targetNode = findNode(nodes, targetNodeId);
      const targetParent = findParent(nodes, targetNodeId);

      if (!draggedNode || !targetNode) {
        return;
      }

      // Determine new parent - same as target's parent
      let newParentId = targetParent ? targetParent.id : null;

      // Calculate new order based on position
      let newOrder;
      if (position === 'before') {
        newOrder = targetNode.order - 0.5; // Place between previous and target
      } else {
        newOrder = targetNode.order + 0.5; // Place between target and next
      }

      // Move the node
      const response = await fetch(`${API_URL}/nodes/${draggedNodeId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_parent_id: newParentId,
          new_order: newOrder
        })
      });

      if (!response.ok) {
        throw new Error('Failed to move node');
      }

      const result = await response.json();

      // Save current scroll position
      const editorPanel = document.querySelector('.editor-panel');
      const currentScroll = editorPanel?.scrollTop || 0;

      // Refresh the profile to get updated order
      await fetchProfile(true); // Preserve state

      // Restore scroll position after DOM updates
      setTimeout(() => {
        if (editorPanel) {
          editorPanel.scrollTop = currentScroll;
        }
      }, 50);
    } catch (error) {
      console.error('❌ Error reordering node:', error);
    }
  };

  const handleDownloadProfileCV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles/download-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download profile CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Profile_Pool_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading profile CV:', error);
      alert('Failed to download profile CV. Please try again.');
    }
  };

  const handleViewProfileInNewTab = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles/download-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to view profile CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up the URL after a delay to ensure the new tab has loaded
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Error viewing profile CV:', error);
      alert('Failed to view profile CV. Please try again.');
    }
  };

  // Calculate node statistics
  const calculateNodeStats = (nodes) => {
    const stats = {
      total: 0,
      sections: 0,
      entries: 0,
      bullets: 0,
      paragraphs: 0,
      sectionBreakdown: {}
    };

    const traverse = (nodeList, currentSection = null) => {
      nodeList.forEach(node => {
        stats.total++;

        if (node.node_type === 'section') {
          stats.sections++;
          currentSection = node.title || 'Untitled Section';
          stats.sectionBreakdown[currentSection] = {
            entries: 0,
            bullets: 0,
            paragraphs: 0
          };
        } else if (node.node_type === 'entry') {
          stats.entries++;
          if (currentSection && stats.sectionBreakdown[currentSection]) {
            stats.sectionBreakdown[currentSection].entries++;
          }
        } else if (node.node_type === 'bullet') {
          stats.bullets++;
          if (currentSection && stats.sectionBreakdown[currentSection]) {
            stats.sectionBreakdown[currentSection].bullets++;
          }
        } else if (node.node_type === 'paragraph') {
          stats.paragraphs++;
          if (currentSection && stats.sectionBreakdown[currentSection]) {
            stats.sectionBreakdown[currentSection].paragraphs++;
          }
        }

        if (node.children && node.children.length > 0) {
          traverse(node.children, currentSection);
        }
      });
    };

    traverse(nodes);
    return stats;
  };

  const nodeStats = calculateNodeStats(nodes);

  // Calculate actual prompt sizes based on real profile data (in tokens)
  const calculatePromptSizes = (profileNodes) => {
    // Base prompt overhead (in characters)
    const scoringBasePromptChars = 2500; // SCORING_PROMPT template
    const nodeSelectionBasePromptChars = 5000; // NODE_SELECTION_PROMPT template
    const jobRequirementsChars = 2000; // Estimated job analysis JSON (this varies per job)

    // Calculate actual profile text size for SCORING
    // For scoring, we send full text representation of the profile
    let profileTextSize = 0;
    const extractText = (nodeList) => {
      nodeList.forEach(node => {
        // Add title/role if present
        if (node.title) profileTextSize += node.title.length;
        if (node.role) profileTextSize += node.role.length;
        if (node.company) profileTextSize += node.company.length;
        if (node.location) profileTextSize += node.location.length;
        if (node.dates) profileTextSize += node.dates.length;
        // Add content
        if (node.content) profileTextSize += node.content.length;
        // Add some overhead for formatting (newlines, labels, etc.)
        profileTextSize += 50;

        // Recurse to children
        if (node.children && node.children.length > 0) {
          extractText(node.children);
        }
      });
    };
    extractText(profileNodes);

    // Calculate actual nodes JSON size for NODE SELECTION
    // For node selection, we send the full nodes structure as JSON
    const nodesJsonString = JSON.stringify(profileNodes);
    const nodesJsonSize = nodesJsonString.length;

    // Convert all to tokens (~4 chars per token)
    const scoringTotal = Math.ceil((scoringBasePromptChars + jobRequirementsChars + profileTextSize) / 4);
    const nodeSelectionTotal = Math.ceil((nodeSelectionBasePromptChars + jobRequirementsChars + nodesJsonSize) / 4);

    return {
      scoring: {
        tokens: scoringTotal,
        formatted: scoringTotal >= 1000 ? `${(scoringTotal / 1000).toFixed(1)}K` : scoringTotal.toString()
      },
      nodeSelection: {
        tokens: nodeSelectionTotal,
        formatted: nodeSelectionTotal >= 1000 ? `${(nodeSelectionTotal / 1000).toFixed(1)}K` : nodeSelectionTotal.toString()
      }
    };
  };

  const promptEstimates = calculatePromptSizes(nodes);

  // Calculate risk level for a given token count
  const getRiskLevel = (tokens, taskName) => {
    if (tokens < 8000) {
      return {
        level: 'low',
        label: 'Optimal',
        color: '#10b981',
        emoji: '🟢',
        risks: [],
        description: `${taskName}: Perfect size for fast, accurate analysis with minimal cost`
      };
    }
    if (tokens < 15000) {
      return {
        level: 'medium',
        label: 'Good',
        color: '#f59e0b',
        emoji: '🟡',
        risks: [`${taskName}: Slightly higher API costs`],
        description: `${taskName}: Good size - AI models handle this well`
      };
    }
    if (tokens < 25000) {
      return {
        level: 'high',
        label: 'Large',
        color: '#f97316',
        emoji: '🟠',
        risks: [
          `${taskName}: Significantly higher API costs (~2-3x)`,
          `${taskName}: Slower AI response times`,
          `${taskName}: Risk of reduced accuracy`
        ],
        description: `${taskName}: Large prompt - AI may struggle with all details`
      };
    }
    return {
      level: 'critical',
      label: 'Very Large',
      color: '#ef4444',
      emoji: '🔴',
      risks: [
        `${taskName}: Very high API costs (~3-5x)`,
        `${taskName}: Much slower response times`,
        `${taskName}: High risk of reduced accuracy`,
        `${taskName}: AI may miss important details`,
        `${taskName}: May exceed context limits (failures)`
      ],
      description: `${taskName}: Critical size - Consider reducing profile complexity`
    };
  };

  // Get risk levels for both tasks
  const scoringRisk = getRiskLevel(promptEstimates.scoring.tokens, 'Scoring');
  const nodeSelectionRisk = getRiskLevel(promptEstimates.nodeSelection.tokens, 'Node Selection');

  // Overall risk is the worse of the two
  const overallRisk = nodeSelectionRisk.level === 'critical' || scoringRisk.level === 'critical'
    ? (nodeSelectionRisk.level === 'critical' ? nodeSelectionRisk : scoringRisk)
    : nodeSelectionRisk.level === 'high' || scoringRisk.level === 'high'
    ? (nodeSelectionRisk.level === 'high' ? nodeSelectionRisk : scoringRisk)
    : nodeSelectionRisk.level === 'medium' || scoringRisk.level === 'medium'
    ? (nodeSelectionRisk.level === 'medium' ? nodeSelectionRisk : scoringRisk)
    : scoringRisk;

  if (loading) {
    return <div className="master-profile-loading">Loading profile...</div>;
  }

  return (
    <div className="master-profile">
      <div className="master-profile-header">
        <h1>Master Profile</h1>
        <p>Build your comprehensive professional profile with unlimited flexibility</p>
      </div>

      {/* Ultra-Modern Node Statistics Dashboard */}
      <div className="node-stats-dashboard">
        {/* Hero Stats Section - Total Nodes */}
        <div className="stats-hero">
          <div className="hero-count">
            <span className="hero-number">{nodeStats.total}</span>
            <span className="hero-label">Total Content Nodes</span>
          </div>
        </div>

        {/* Two Column Layout: Stats Cards + Risk Info */}
        <div className="stats-two-column">
          {/* Left Column: Modern Grid Stats */}
          <div className="stats-modern-grid">
          {/* Sections Card */}
          <div className="modern-card card-sections">
            <div className="card-header">
              <span className="card-icon-large">📑</span>
              <span className="card-type">Sections</span>
            </div>
            <div className="card-value">{nodeStats.sections}</div>
            <div className="card-bar">
              <div
                className="card-bar-fill fill-sections"
                style={{width: `${nodeStats.total > 0 ? (nodeStats.sections / nodeStats.total * 100) : 0}%`}}
              ></div>
            </div>
            <div className="card-percent">
              {nodeStats.total > 0 ? ((nodeStats.sections / nodeStats.total * 100).toFixed(1)) : 0}% of total
            </div>
          </div>

          {/* Entries Card */}
          <div className="modern-card card-entries">
            <div className="card-header">
              <span className="card-icon-large">💼</span>
              <span className="card-type">Entries</span>
            </div>
            <div className="card-value">{nodeStats.entries}</div>
            <div className="card-bar">
              <div
                className="card-bar-fill fill-entries"
                style={{width: `${nodeStats.total > 0 ? (nodeStats.entries / nodeStats.total * 100) : 0}%`}}
              ></div>
            </div>
            <div className="card-percent">
              {nodeStats.total > 0 ? ((nodeStats.entries / nodeStats.total * 100).toFixed(1)) : 0}% of total
            </div>
          </div>

          {/* Bullets Card */}
          <div className="modern-card card-bullets">
            <div className="card-header">
              <span className="card-icon-large">✦</span>
              <span className="card-type">Bullets</span>
            </div>
            <div className="card-value">{nodeStats.bullets}</div>
            <div className="card-bar">
              <div
                className="card-bar-fill fill-bullets"
                style={{width: `${nodeStats.total > 0 ? (nodeStats.bullets / nodeStats.total * 100) : 0}%`}}
              ></div>
            </div>
            <div className="card-percent">
              {nodeStats.total > 0 ? ((nodeStats.bullets / nodeStats.total * 100).toFixed(1)) : 0}% of total
            </div>
          </div>

          {/* Paragraphs Card */}
          <div className="modern-card card-paragraphs">
            <div className="card-header">
              <span className="card-icon-large">¶</span>
              <span className="card-type">Paragraphs</span>
            </div>
            <div className="card-value">{nodeStats.paragraphs}</div>
            <div className="card-bar">
              <div
                className="card-bar-fill fill-paragraphs"
                style={{width: `${nodeStats.total > 0 ? (nodeStats.paragraphs / nodeStats.total * 100) : 0}%`}}
              ></div>
            </div>
            <div className="card-percent">
              {nodeStats.total > 0 ? ((nodeStats.paragraphs / nodeStats.total * 100).toFixed(1)) : 0}% of total
            </div>
          </div>
        </div>

          {/* Right Column: Risk Info */}
          <div className="stats-risk-panel">
            <div className="risk-panel-header">
              <h4>AI Prompt Analysis</h4>
            </div>
            <div className="risk-estimates-panel">
              <div className="estimate-item">
                <span className="estimate-label">Scoring:</span>
                <span className="estimate-value">{promptEstimates.scoring.formatted} tokens</span>
                <span className="estimate-verdict" style={{backgroundColor: scoringRisk.color}}>
                  {scoringRisk.emoji} {scoringRisk.label}
                </span>
              </div>
              <div className="estimate-item">
                <span className="estimate-label">Node Selection:</span>
                <span className="estimate-value">{promptEstimates.nodeSelection.formatted} tokens</span>
                <span className="estimate-verdict" style={{backgroundColor: nodeSelectionRisk.color}}>
                  {nodeSelectionRisk.emoji} {nodeSelectionRisk.label}
                </span>
              </div>
            </div>
            {/* Show risks from both tasks */}
            {(scoringRisk.risks.length > 0 || nodeSelectionRisk.risks.length > 0) && (
              <div className="risk-warnings">
                <div className="risk-warnings-title">⚠️ Potential Issues:</div>
                <ul className="risk-list">
                  {scoringRisk.risks.map((risk, idx) => (
                    <li key={`scoring-${idx}`}>{risk}</li>
                  ))}
                  {nodeSelectionRisk.risks.map((risk, idx) => (
                    <li key={`node-${idx}`}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Section Breakdown - Redesigned */}
        {Object.keys(nodeStats.sectionBreakdown).length > 0 && (
          <div className="section-breakdown-modern">
            <div className="breakdown-header">
              <h4>📂 Section Breakdown</h4>
              <span className="breakdown-count">{Object.keys(nodeStats.sectionBreakdown).length} sections</span>
            </div>
            <div className="breakdown-cards">
              {Object.entries(nodeStats.sectionBreakdown).map(([sectionName, counts]) => {
                const totalInSection = counts.entries + counts.bullets + counts.paragraphs;
                return (
                  <div key={sectionName} className="breakdown-card">
                    <div className="breakdown-card-title">{sectionName}</div>
                    <div className="breakdown-card-total">{totalInSection} nodes</div>
                    <div className="breakdown-card-details">
                      {counts.entries > 0 && (
                        <div className="detail-chip chip-entries">
                          <span className="chip-icon">💼</span>
                          <span className="chip-count">{counts.entries}</span>
                        </div>
                      )}
                      {counts.bullets > 0 && (
                        <div className="detail-chip chip-bullets">
                          <span className="chip-icon">✦</span>
                          <span className="chip-count">{counts.bullets}</span>
                        </div>
                      )}
                      {counts.paragraphs > 0 && (
                        <div className="detail-chip chip-paragraphs">
                          <span className="chip-icon">¶</span>
                          <span className="chip-count">{counts.paragraphs}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                  onEdit={handleEditNode}
                  onUpdate={handleUpdateNode}
                  onDelete={handleDeleteNode}
                  onReorder={handleReorderNode}
                  draggedNode={draggedNode}
                  setDraggedNode={setDraggedNode}
                  expandedNodes={expandedNodes}
                  setExpandedNodes={setExpandedNodes}
                  level={0}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="preview-panel">
          <div className="preview-header">
            <div className="preview-header-left">
              <h2>Live Preview</h2>
              <span className="preview-label">How it looks in your CV</span>
            </div>
            <div className="preview-header-actions">
              <button
                className="btn-view-cv"
                onClick={handleViewProfileInNewTab}
                title="View full profile CV in new tab"
              >
                👁️ View in New Tab
              </button>
              <button
                className="btn-download-cv"
                onClick={handleDownloadProfileCV}
                title="Download full profile CV as PDF"
              >
                📥 Download CV
              </button>
            </div>
          </div>

          <div className="cv-preview">
            <CVPreviewContent
              nodes={nodes}
              profile={profile}
              onNodeClick={handlePreviewNodeClick}
            />
          </div>
        </div>
      </div>

      {/* Add Modal */}
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

      {/* Edit Modal */}
      {showEditModal && editingNode && (
        <NodeModal
          onSave={handleSaveEditNode}
          onCancel={() => {
            setShowEditModal(false);
            setEditingNode(null);
          }}
          isChild={editingNode.parent_id !== null}
          parentLevel={editingNode.level}
          editMode={true}
          existingData={editingNode}
        />
      )}
    </div>
  );
}

// Tree Node Component - Recursive
function TreeNode({ node, selectedNode, onSelect, onAdd, onEdit, onUpdate, onDelete, onReorder, draggedNode, setDraggedNode, expandedNodes, setExpandedNodes, level }) {
  const [dragOver, setDragOver] = useState(null); // 'before', 'after', or null
  const isSelected = selectedNode?.id === node.id;
  const isDragging = draggedNode?.id === node.id;
  const isExpanded = expandedNodes.has(node.id) || !node.children || node.children.length === 0;

  const toggleExpanded = () => {
    const newExpandedNodes = new Set(expandedNodes);
    if (expandedNodes.has(node.id)) {
      newExpandedNodes.delete(node.id);
    } else {
      newExpandedNodes.add(node.id);
    }
    setExpandedNodes(newExpandedNodes);
  };

  const handleDragStart = (e) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || draggedNode.id === node.id) return;

    // RULE 1: Only allow dragging nodes of the same type
    if (draggedNode.node_type !== node.node_type) {
      e.dataTransfer.dropEffect = 'none';
      return; // Can't drag section to entry, entry to bullet, etc.
    }

    // RULE 2: Only allow dragging within the same parent context
    // Both nodes must have the same parent_id
    if (draggedNode.parent_id !== node.parent_id) {
      e.dataTransfer.dropEffect = 'none';
      return; // Can't drag across different parents
    }

    // Valid drop target
    e.dataTransfer.dropEffect = 'move';

    // Determine if we're hovering over top or bottom half
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';

    setDragOver(position);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || draggedNode.id === node.id) {
      setDragOver(null);
      return;
    }

    // Apply same validation rules as dragOver
    if (draggedNode.node_type !== node.node_type || draggedNode.parent_id !== node.parent_id) {
      setDragOver(null);
      return;
    }

    onReorder(draggedNode.id, node.id, dragOver);
    setDragOver(null);
    setDraggedNode(null);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
    setDragOver(null);
  };

  return (
    <div className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
      <div
        className={`node-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${dragOver ? `drag-${dragOver}` : ''}`}
        onClick={() => onSelect(node)}
        draggable="true"
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        data-node-id={node.id}
      >
        {node.children && node.children.length > 0 && (
          <button
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        <div className="node-content">
          <span className={`node-type-badge node-type-${node.node_type}`}>{node.node_type}</span>
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
              onEdit(node);
            }}
            title="Edit"
          >
            ✎
          </button>
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
              onEdit={onEdit}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onReorder={onReorder}
              draggedNode={draggedNode}
              setDraggedNode={setDraggedNode}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// CV Preview Component
function CVPreviewContent({ nodes, profile, onNodeClick }) {
  // Helper function to render children
  const renderChildren = (children, level) => {
    if (!children || children.length === 0) return null;
    return children.map(child => renderNode(child, level));
  };

  const renderNode = (node, level = 0) => {
    if (!node.is_visible) return null;

    // Common click handler
    const handleClick = (e) => {
      e.stopPropagation();
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    };

    // Section level
    if (node.node_type === 'section' && level === 0) {
      return (
        <div
          key={node.id}
          className="cv-section clickable-preview-item"
          onClick={handleClick}
        >
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
          <div
            key={node.id}
            className={`cv-entry level-${level} clickable-preview-item`}
            onClick={handleClick}
          >
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
        <div
          key={node.id}
          className={`cv-entry level-${level} clickable-preview-item`}
          onClick={handleClick}
        >
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
          <div
            key={node.id}
            className={`cv-bullet level-${level} clickable-preview-item`}
            onClick={handleClick}
          >
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
          <div
            key={node.id}
            className={`cv-bullet level-${level} clickable-preview-item`}
            onClick={handleClick}
          >
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
        <div
          key={node.id}
          className={`cv-paragraph level-${level} clickable-preview-item`}
          onClick={handleClick}
        >
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
      <div
        key={node.id}
        className={`cv-node cv-node-${node.node_type} clickable-preview-item`}
        onClick={handleClick}
      >
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
function NodeModal({ onSave, onCancel, isChild, parentLevel = 0, editMode = false, existingData = null }) {
  // Level 2+ can only add bullets/paragraphs, not entries
  const canAddEntry = parentLevel < 2;
  const defaultType = isChild ? (canAddEntry ? 'entry' : 'bullet') : 'section';

  const [formData, setFormData] = useState(
    editMode && existingData
      ? {
          node_type: existingData.node_type || defaultType,
          title: existingData.title || '',
          subtitle: existingData.subtitle || '',
          content: existingData.content || '',
          content_type: existingData.content_type || 'text',
          start_date: existingData.start_date || '',
          end_date: existingData.end_date || '',
          location: existingData.location || '',
          icon: existingData.icon || '',
          order: existingData.order || 0,
          is_visible: existingData.is_visible !== undefined ? existingData.is_visible : true
        }
      : {
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
        }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editMode ? 'Edit Item' : (isChild ? 'Add Content' : 'Add Section')}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Only show type selector for child items in add mode, not for root sections or edit mode */}
          {isChild && !editMode && (
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

          {/* Show read-only type in edit mode */}
          {editMode && (
            <div className="form-group">
              <label>Type</label>
              <input
                type="text"
                value={formData.node_type}
                disabled
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>
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
