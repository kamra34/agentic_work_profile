import { useState, useEffect, useMemo } from 'react';
import ContactInfoSection from './ContactInfoSection';
import PDFTemplateSelector from './PDFTemplateSelector';
import './SavedCVDetail.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function SavedCVDetail({ cvId, onBack }) {
  const [cvData, setCvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nodeSelections, setNodeSelections] = useState({});
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [previewTab, setPreviewTab] = useState('preview'); // 'preview', 'openai', 'claude'
  const [editingNode, setEditingNode] = useState(null); // Track which node is being edited
  const [editedContent, setEditedContent] = useState({}); // Store edited content
  const [recalculating, setRecalculating] = useState(false);
  const [showPromptSection, setShowPromptSection] = useState(false);

  // Drag and drop state
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOver, setDragOver] = useState(null); // Track which node is being hovered over

  // Application Tracker Modal State
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [savingToTracker, setSavingToTracker] = useState(false);
  const [trackerFormData, setTrackerFormData] = useState({
    cv_format: 'professional',
    pdf_customizations: null,  // Store last used PDF settings
    job_url: '',
    location: '',
    priority: 'medium',
    notes: '',
    cover_letter: ''
  });

  // Autosave state
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [isSavedToTracker, setIsSavedToTracker] = useState(false); // Saved to tracker
  const [applicationId, setApplicationId] = useState(null); // Store application ID for PDF export
  const [previewingPDF, setPreviewingPDF] = useState(false); // Preview PDF state
  const [showPreviewTemplateModal, setShowPreviewTemplateModal] = useState(false); // Show template selection modal
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState('professional'); // Selected template for preview

  // Refinement modal state
  const [refinementModal, setRefinementModal] = useState({
    isOpen: false,
    section: null,
    sectionId: null
  });
  const [userInstructions, setUserInstructions] = useState('');
  const [refining, setRefining] = useState(false);
  const [refinementResult, setRefinementResult] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    fetchCVData();
  }, [cvId]);

  const fetchCVData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CV data');
      }

      const data = await response.json();
      setCvData(data);

      // Initialize node selections from snapshot
      initializeNodeSelections(data.content_snapshot);

      // Start with all nodes collapsed by default
      setExpandedNodes(new Set());
    } catch (err) {
      console.error('Error fetching CV:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeNodeSelections = (snapshot) => {
    if (!snapshot || !snapshot.nodes) return;

    const selections = {};

    const processNode = (node) => {
      // Node is selected if is_selected is true (or use is_visible as fallback)
      selections[node.global_id] = node.is_selected !== undefined ? node.is_selected : (node.is_visible || false);

      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    snapshot.nodes.forEach(processNode);

    setNodeSelections(selections);
  };

  const toggleNodeSelection = (globalId, node) => {
    setNodeSelections(prev => {
      const newValue = !prev[globalId];
      const updates = { [globalId]: newValue };

      // Recursively update all children to match parent's new state
      if (node && node.children) {
        const updateChildren = (children) => {
          children.forEach(child => {
            updates[child.global_id] = newValue;
            if (child.children) {
              updateChildren(child.children);
            }
          });
        };
        updateChildren(node.children);
      }

      const newSelections = { ...prev, ...updates };

      // Trigger autosave with debounce
      triggerAutoSave(newSelections);

      return newSelections;
    });
  };

  // Debounced autosave function
  const triggerAutoSave = (newSelections = null, immediate = false) => {
    // Clear existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set status to saving
    setAutoSaveStatus('saving');

    // Set new timer (immediate or 1.5 seconds)
    const timer = setTimeout(async () => {
      try {
        await autoSave(newSelections);
        setAutoSaveStatus('saved');
      } catch (error) {
        console.error('Autosave failed:', error);
        setAutoSaveStatus('error');
      }
    }, immediate ? 0 : 1500);

    setAutoSaveTimer(timer);
  };

  // Handlers for ContactInfoSection save callbacks
  const handleContactSaveStart = () => {
    setAutoSaveStatus('saving');
  };

  const handleContactSaveComplete = (status) => {
    setAutoSaveStatus(status === 'success' ? 'saved' : 'error');
  };

  // Autosave function
  const autoSave = async (selectionsToSave = null) => {
    try {
      const selections = selectionsToSave || nodeSelections;

      // CRITICAL: Use the current nodes from cvData (which includes edits)
      // and only update the is_selected property, preserving all other changes
      const updatedSnapshot = {
        ...cvData.content_snapshot,
        nodes: updateNodesWithSelections(cvData.content_snapshot.nodes, selections)
      };

      // Count selected nodes for verification
      const countSelected = (nodes) => {
        let count = 0;
        nodes.forEach(node => {
          if (node.is_selected) count++;
          if (node.children) count += countSelected(node.children);
        });
        return count;
      };
      const selectedCount = countSelected(updatedSnapshot.nodes);

      const selectedNodeIds = [];
      const collectSelectedIds = (nodes) => {
        nodes.forEach(node => {
          if (selections[node.global_id]) {
            selectedNodeIds.push({
              id: node.id,
              global_id: node.global_id
            });
          }
          if (node.children) {
            collectSelectedIds(node.children);
          }
        });
      };
      collectSelectedIds(cvData.content_snapshot.nodes);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content_snapshot: updatedSnapshot,
          selected_node_ids: selectedNodeIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to autosave changes');
      }

      const responseData = await response.json();

      // Update local state with the saved snapshot
      setCvData(prev => ({
        ...prev,
        content_snapshot: updatedSnapshot,
        selected_node_ids: selectedNodeIds
      }));

      return updatedSnapshot;
    } catch (err) {
      console.error('Error in autosave:', err);
      throw err;
    }
  };

  const toggleExpanded = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Find all parent node IDs for a given node
  const findParentNodes = (targetGlobalId, nodes, parents = []) => {
    for (const node of nodes) {
      if (node.global_id === targetGlobalId) {
        return parents;
      }
      if (node.children && node.children.length > 0) {
        const result = findParentNodes(targetGlobalId, node.children, [...parents, node.id]);
        if (result) return result;
      }
    }
    return null;
  };

  // Store original content for undo functionality
  const [originalContent, setOriginalContent] = useState({});

  // Start editing a node
  const startEditing = (node) => {
    setEditingNode(node.global_id);
    const nodeContent = {
      title: node.title || '',
      subtitle: node.subtitle || '',
      content: node.content || '',
      start_date: node.start_date || '',
      end_date: node.end_date || '',
      location: node.location || ''
    };
    setEditedContent(nodeContent);
    setOriginalContent(nodeContent); // Store original for undo
  };

  // Revert to original content
  const revertToOriginal = () => {
    setEditedContent({ ...originalContent });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingNode(null);
    setEditedContent({});
  };

  // Save edited content
  const saveNodeEdit = (node) => {
    // Update the node in cvData
    const updateNode = (nodes) => {
      return nodes.map(n => {
        if (n.global_id === node.global_id) {
          return {
            ...n,
            title: editedContent.title,
            subtitle: editedContent.subtitle,
            content: editedContent.content,
            start_date: editedContent.start_date,
            end_date: editedContent.end_date,
            location: editedContent.location
          };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    };

    const updatedNodes = updateNode(cvData.content_snapshot.nodes);

    // Build the complete updated snapshot with edited nodes
    const updatedSnapshot = {
      ...cvData.content_snapshot,
      nodes: updatedNodes
    };

    // Update local state
    setCvData(prev => ({
      ...prev,
      content_snapshot: updatedSnapshot
    }));

    // Trigger autosave with the updated snapshot IMMEDIATELY
    // Don't wait for state update, use the fresh snapshot directly
    setAutoSaveStatus('saving');

    setTimeout(async () => {
      try {
        // Call autoSave but pass the updated nodes to ensure it uses fresh data
        const selectionsToApply = nodeSelections;

        // Apply selections recursively to ALL nodes
        const snapshotForSave = {
          ...updatedSnapshot,
          nodes: updateNodesWithSelectionsRecursive(updatedSnapshot.nodes, selectionsToApply)
        };

        console.log('[SaveNodeEdit] Saving snapshot after edit with selections applied');
        await saveSnapshotToBackend(snapshotForSave);
        setAutoSaveStatus('saved');
      } catch (error) {
        console.error('Autosave after edit failed:', error);
        setAutoSaveStatus('error');
      }
    }, 100);

    setEditingNode(null);
    setEditedContent({});
  };

  // Helper to update selections recursively
  const updateNodesWithSelectionsRecursive = (nodes, selections) => {
    return nodes.map(node => ({
      ...node,
      is_selected: selections[node.global_id] || false,
      children: node.children ? updateNodesWithSelectionsRecursive(node.children, selections) : []
    }));
  };

  // Helper to save snapshot to backend
  const saveSnapshotToBackend = async (snapshot) => {
    const selectedNodeIds = [];
    const collectSelectedIds = (nodes) => {
      nodes.forEach(node => {
        if (node.is_selected) {
          selectedNodeIds.push({
            id: node.id,
            global_id: node.global_id
          });
        }
        if (node.children) {
          collectSelectedIds(node.children);
        }
      });
    };
    collectSelectedIds(snapshot.nodes);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/tailor/${cvId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content_snapshot: snapshot,
        selected_node_ids: selectedNodeIds
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save changes');
    }

    return response.json();
  };

  // Handle node reordering via drag and drop
  const handleReorderNode = async (draggedNodeId, targetNodeId, position) => {
    try {
      setAutoSaveStatus('saving');

      // Find the dragged and target nodes in the tree
      const findNodeById = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNodeById(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const draggedNodeObj = findNodeById(cvData.content_snapshot.nodes, draggedNodeId);
      const targetNodeObj = findNodeById(cvData.content_snapshot.nodes, targetNodeId);

      if (!draggedNodeObj || !targetNodeObj) {
        console.error('Could not find nodes for reordering');
        return;
      }

      // Reorder nodes in local state
      const reorderNodes = (nodes, parentId = null) => {
        const siblings = nodes.filter(n => (n.parent_id || null) === parentId);
        const nonSiblings = nodes.filter(n => (n.parent_id || null) !== parentId);

        // Find dragged and target in siblings
        const draggedIndex = siblings.findIndex(n => n.id === draggedNodeId);
        const targetIndex = siblings.findIndex(n => n.id === targetNodeId);

        if (draggedIndex === -1 || targetIndex === -1) {
          // Recursively process children
          return nodes.map(node => ({
            ...node,
            children: node.children ? reorderNodes(node.children, node.id) : []
          }));
        }

        // Remove dragged node
        const [draggedNode] = siblings.splice(draggedIndex, 1);

        // Calculate new position
        let newTargetIndex = siblings.findIndex(n => n.id === targetNodeId);
        if (position === 'after') {
          newTargetIndex += 1;
        }

        // Insert at new position
        siblings.splice(newTargetIndex, 0, draggedNode);

        // Combine back and recursively process children
        const reordered = [...siblings, ...nonSiblings].map(node => ({
          ...node,
          children: node.children ? reorderNodes(node.children, node.id) : []
        }));

        return reordered;
      };

      const reorderedNodes = reorderNodes(cvData.content_snapshot.nodes);

      // Update local state
      const updatedSnapshot = {
        ...cvData.content_snapshot,
        nodes: reorderedNodes
      };

      setCvData(prev => ({
        ...prev,
        content_snapshot: updatedSnapshot
      }));

      // Save to backend
      const selections = nodeSelections;
      const snapshotForSave = {
        ...updatedSnapshot,
        nodes: updateNodesWithSelectionsRecursive(updatedSnapshot.nodes, selections)
      };

      await saveSnapshotToBackend(snapshotForSave);
      setAutoSaveStatus('saved');

    } catch (error) {
      console.error('Error reordering nodes:', error);
      setAutoSaveStatus('error');
    }
  };

  // Refinement handlers
  const handleRefineSection = (section) => {
    setRefinementModal({
      isOpen: true,
      section: section,
      sectionId: section.id
    });
    setUserInstructions('');
    setRefinementResult(null);
    setShowPrompt(false);
  };

  const closeRefinementModal = () => {
    setRefinementModal({
      isOpen: false,
      section: null,
      sectionId: null
    });
    setUserInstructions('');
    setRefinementResult(null);
    setShowPrompt(false);
  };

  const handleRunRefinement = async () => {
    try {
      setRefining(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/tailor/${cvId}/refine-section`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          section_id: refinementModal.sectionId,
          user_instructions: userInstructions || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to refine section');
      }

      const data = await response.json();
      setRefinementResult(data);
    } catch (error) {
      console.error('Error refining section:', error);
      alert(`Failed to refine section: ${error.message}`);
    } finally {
      setRefining(false);
    }
  };

  const copyToClipboard = (text, event) => {
    const button = event.currentTarget;
    navigator.clipboard.writeText(text).then(() => {
      button.classList.add('copied');
      const originalHTML = button.innerHTML;
      button.innerHTML = '✓ Copied!';

      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  };

  // Navigate to a node in the left panel from preview click
  const navigateToNode = (globalId) => {
    if (!cvData?.content_snapshot?.nodes) return;

    // Find the node by global_id
    const findNode = (nodes) => {
      for (const node of nodes) {
        if (node.global_id === globalId) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = findNode(cvData.content_snapshot.nodes);
    if (!targetNode) return;

    // Find all parent node IDs
    const parentIds = findParentNodes(globalId, cvData.content_snapshot.nodes);

    // Expand all parent nodes
    if (parentIds && parentIds.length > 0) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        parentIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }

    // Select the node
    setSelectedNode(targetNode);

    // Scroll to the node after a short delay to allow expansion animation
    setTimeout(() => {
      const element = document.querySelector(`[data-node-id="${targetNode.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
        element.classList.add('highlight-flash');
        setTimeout(() => element.classList.remove('highlight-flash'), 2000);
      }
    }, 100);
  };

  // Offline Content Quality Calculator with AI-weighted scoring
  const calculateOfflineATSScore = useMemo(() => {
    if (!cvData || !cvData.content_snapshot || !cvData.job_description) {
      return {
        contentQuality: null,
        keywordCoverage: null,
        details: {}
      };
    }

    // Extract keywords from job description
    const jobDesc = (cvData.job_description || '').toLowerCase();
    const jobAnalysis = cvData.job_analysis || {};

    // Extract key terms from job analysis if available
    const requiredSkills = jobAnalysis.required_skills || [];
    const preferredSkills = jobAnalysis.preferred_skills || [];
    const keywords = jobAnalysis.keywords || [];

    // Get AI recommendations for confidence scores
    const aiRecommendations = cvData.recommendations || {};
    const openaiRecs = aiRecommendations.openai?.recommendations?.selected_nodes || [];
    const claudeRecs = aiRecommendations.claude?.recommendations?.selected_nodes || [];

    // First, build a map from node id (database primary key) to global_id
    const idToGlobalIdMap = {};
    const buildIdMap = (nodes) => {
      nodes.forEach(node => {
        if (node.id && node.global_id) {
          idToGlobalIdMap[node.id] = node.global_id;
        }
        if (node.children) {
          buildIdMap(node.children);
        }
      });
    };
    buildIdMap(cvData.content_snapshot.nodes);

    // Build confidence map: global_id -> average confidence from both models
    // Recommendations use 'id' (database pk), not 'global_id'
    const confidenceMap = {};
    openaiRecs.forEach(rec => {
      if (rec.confidence && rec.id) {
        const globalId = idToGlobalIdMap[rec.id];
        if (globalId) {
          confidenceMap[globalId] = rec.confidence;
        }
      }
    });
    claudeRecs.forEach(rec => {
      if (rec.confidence && rec.id) {
        const globalId = idToGlobalIdMap[rec.id];
        if (globalId) {
          const existing = confidenceMap[globalId];
          if (existing) {
            confidenceMap[globalId] = (existing + rec.confidence) / 2; // Average
          } else {
            confidenceMap[globalId] = rec.confidence;
          }
        }
      }
    });

    // Collect all selected content with weights
    let selectedContent = '';
    let totalWeightedScore = 0;  // Sum of all possible weighted points
    let achievedWeightedScore = 0;  // Sum of selected weighted points
    let selectedBullets = 0;
    let totalBullets = 0;
    let sectionCoverage = {};

    const collectContent = (nodes, sectionName = '') => {
      nodes.forEach(node => {
        // Calculate weight for this node based on AI confidence
        // If AI has confidence score, use it directly (0.0 to 1.0)
        // Otherwise, use a default weight of 0.5 (neutral importance)
        let weight = confidenceMap[node.global_id];

        if (weight === undefined) {
          // No AI confidence available - use heuristic
          if (node.node_type === 'bullet') {
            weight = 0.6; // Bullets are moderately important
          } else if (node.node_type === 'section') {
            weight = 0.8; // Sections are important for structure
          } else {
            weight = 0.5; // Default neutral weight
          }
        }

        // Track bullets separately for display
        if (node.node_type === 'bullet') {
          totalBullets++;
        }

        // Add to total possible score
        totalWeightedScore += weight;

        if (nodeSelections[node.global_id]) {
          // Add to achieved score based on weight
          achievedWeightedScore += weight;

          if (node.node_type === 'bullet') {
            selectedBullets++;
          }

          if (node.node_type === 'section' && node.title) {
            sectionName = node.title;
            sectionCoverage[sectionName] = (sectionCoverage[sectionName] || 0) + 1;
          }

          // Collect text content
          if (node.title) selectedContent += ' ' + node.title;
          if (node.subtitle) selectedContent += ' ' + node.subtitle;
          if (node.content) selectedContent += ' ' + node.content;

          if (node.children) {
            collectContent(node.children, sectionName);
          }
        } else if (node.children) {
          // Even if parent is not selected, check children
          collectContent(node.children, sectionName);
        }
      });
    };

    collectContent(cvData.content_snapshot.nodes);
    selectedContent = selectedContent.toLowerCase();

    // Calculate keyword matching
    let matchedKeywords = 0;
    let totalKeywords = keywords.length;

    if (totalKeywords > 0) {
      keywords.forEach(keyword => {
        if (selectedContent.includes(keyword.toLowerCase())) {
          matchedKeywords++;
        }
      });
    } else {
      // Fallback: extract common technical terms from job description
      const commonTerms = jobDesc.match(/\b[a-z]{3,}\b/g) || [];
      const uniqueTerms = [...new Set(commonTerms)].filter(term =>
        !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'will', 'have', 'are', 'was', 'were'].includes(term)
      );
      totalKeywords = Math.min(uniqueTerms.length, 20);

      uniqueTerms.slice(0, 20).forEach(term => {
        if (selectedContent.includes(term)) {
          matchedKeywords++;
        }
      });
    }

    // Calculate skills coverage
    let matchedRequired = 0;
    let matchedPreferred = 0;

    requiredSkills.forEach(skill => {
      if (selectedContent.includes(skill.toLowerCase())) {
        matchedRequired++;
      }
    });

    preferredSkills.forEach(skill => {
      if (selectedContent.includes(skill.toLowerCase())) {
        matchedPreferred++;
      }
    });

    // Calculate percentages (0-100%)
    const keywordCoverage = totalKeywords > 0 ? Math.round((matchedKeywords / totalKeywords) * 100) : 0;
    const requiredSkillsCoverage = requiredSkills.length > 0 ? Math.round((matchedRequired / requiredSkills.length) * 100) : 100;

    // Content Depth: AI-weighted score showing how much valuable content is included
    // This uses AI confidence scores - removing a 90% confidence item hurts more than 50%
    const contentDepth = totalWeightedScore > 0 ? Math.round((achievedWeightedScore / totalWeightedScore) * 100) : 0;

    // Content Quality: combination of keyword coverage and required skills
    // Focus on relevance: keywords (50%), required skills (50%)
    const contentQuality = Math.round(
      (keywordCoverage * 0.50) +
      (requiredSkillsCoverage * 0.50)
    );

    // Check for critical sections
    const expectedSections = ['experience', 'education', 'skills'];
    const hasAllCriticalSections = expectedSections.every(section =>
      Object.keys(sectionCoverage).some(key => key.toLowerCase().includes(section))
    );

    return {
      contentQuality,
      contentDepth,
      keywordCoverage,
      requiredSkillsCoverage,
      hasAllCriticalSections,
      confidenceMap, // Include for debugging
      details: {
        achievedWeightedScore,
        totalWeightedScore,
        selectedBullets,
        totalBullets,
        matchedKeywords,
        totalKeywords,
        matchedRequired,
        totalRequired: requiredSkills.length,
        matchedPreferred,
        totalPreferred: preferredSkills.length,
        confidenceCount: Object.keys(confidenceMap).length
      }
    };
  }, [cvData, nodeSelections]);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  const updateNodesWithSelections = (nodes, selections) => {
    return nodes.map(node => ({
      ...node,
      is_selected: selections[node.global_id] || false,
      children: node.children ? updateNodesWithSelections(node.children, selections) : []
    }));
  };

  const recalculateScores = async () => {
    setRecalculating(true);

    try {
      // Ensure latest autosave is complete before recalculating
      if (autoSaveStatus === 'saving') {
        // Wait for autosave to finish
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const updatedSnapshot = {
        ...cvData.content_snapshot,
        nodes: updateNodesWithSelections(cvData.content_snapshot.nodes, nodeSelections)
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/recalculate-scores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content_snapshot: updatedSnapshot
        })
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate scores');
      }

      const result = await response.json();

      // Update CV data with recalculated scores (keep original scores intact)
      setCvData(prev => ({
        ...prev,
        recalculated_scores: [
          ...(prev.recalculated_scores || []),
          result.recalculation
        ]
      }));

      // Keep prompt section collapsed by default
      // User can expand it manually if needed
    } catch (err) {
      console.error('Error recalculating scores:', err);
      alert('Failed to recalculate scores: ' + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  // Preview PDF directly from current CV (without saving to tracker)
  // Open template selection modal
  const openPreviewTemplateModal = () => {
    setShowPreviewTemplateModal(true);
  };

  // Generate PDF with selected template
  const previewPDF = async (templateName, customizations = {}) => {
    try {
      setPreviewingPDF(true);
      setShowPreviewTemplateModal(false); // Close modal

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/preview-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cv_format: templateName,
          customizations: customizations
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF preview');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_Preview_${templateName}_${cvData.job_title}_${cvData.company_name || 'Draft'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      alert('Failed to generate PDF preview: ' + err.message);
    } finally {
      setPreviewingPDF(false);
    }
  };

  const saveToApplicationTracker = async () => {
    // Force one final save before creating job application to ensure DB has latest data
    try {
      await autoSave();
      // Wait a bit more to ensure DB transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[SaveToTracker] Failed to save before creating application:', err);
      alert('Failed to save your changes. Please try again.');
      return;
    }

    // Check if we need to recalculate scores
    // We need to recalculate if:
    // 1. No recalculated scores exist, OR
    // 2. The last save was AFTER the last recalculation (user made changes since last recalc)

    const hasRecentScores = cvData.recalculated_scores && cvData.recalculated_scores.length > 0;
    let needsRecalculation = !hasRecentScores;

    if (hasRecentScores) {
      // Check if the CV was updated after the last recalculation
      const lastRecalcTimestamp = cvData.recalculated_scores[cvData.recalculated_scores.length - 1].timestamp;
      const lastUpdateTimestamp = cvData.updated_at;

      // Parse timestamps and compare
      const recalcDate = new Date(lastRecalcTimestamp);
      const updateDate = new Date(lastUpdateTimestamp);

      if (updateDate > recalcDate) {
        needsRecalculation = true;
      }
    }

    if (needsRecalculation) {
      // Ask user if they want to recalculate first
      const shouldRecalculate = window.confirm(
        hasRecentScores
          ? 'You\'ve made changes since the last score calculation.\n\n' +
            'It\'s recommended to recalculate scores before saving to ensure accurate tracking.\n\n' +
            'Would you like to recalculate scores now?'
          : 'You haven\'t recalculated scores for this CV yet.\n\n' +
            'It\'s recommended to recalculate scores before saving to ensure accurate tracking.\n\n' +
            'Would you like to recalculate scores now?'
      );

      if (shouldRecalculate) {
        try {
          await recalculateScores();
          // Wait a moment for recalculation to complete and state to update
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          alert('Recalculation failed. Please try again.');
          return;
        }
      }
    }

    setSavingToTracker(true);

    try {
      const token = localStorage.getItem('token');

      // First, check if this CV already exists in the application tracker
      const checkResponse = await fetch(`${API_URL}/api/applications/check-duplicate/${cvId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (checkResponse.ok) {
        const duplicateCheck = await checkResponse.json();
        if (duplicateCheck.exists) {
          setSavingToTracker(false);
          alert(
            `This CV has already been saved to the Application Tracker!\n\n` +
            `Status: ${duplicateCheck.status}\n` +
            `Created: ${new Date(duplicateCheck.created_at).toLocaleString()}\n\n` +
            `You can view it in the Application Tracker page.`
          );
          return;
        }
      }

      // If no duplicate, proceed with creation
      const response = await fetch(`${API_URL}/api/applications/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tailored_cv_id: cvId,
          cv_format: trackerFormData.cv_format,
          pdf_customizations: trackerFormData.pdf_customizations,
          job_url: trackerFormData.job_url,
          location: trackerFormData.location,
          notes: trackerFormData.notes,
          cover_letter: trackerFormData.cover_letter,
          priority: trackerFormData.priority
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save to Application Tracker');
      }

      const application = await response.json();

      setShowTrackerModal(false);

      // Store application ID and enable Step 3
      setApplicationId(application.id);
      setIsSavedToTracker(true);

      // Reset form
      setTrackerFormData({
        cv_format: 'professional',
        job_url: '',
        location: '',
        priority: 'medium',
        notes: '',
        cover_letter: ''
      });
    } catch (err) {
      console.error('Error saving to tracker:', err);
      alert('Failed to save to Application Tracker: ' + err.message);
    } finally {
      setSavingToTracker(false);
    }
  };

  const exportToPDF = async () => {
    if (!applicationId) {
      alert('Please save to Application Tracker first');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // Call backend endpoint to generate and download PDF
      const response = await fetch(`${API_URL}/api/applications/${applicationId}/export-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to export PDF');
      }

      // Download the PDF file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'CV_Export.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF: ' + err.message);
    }
  };

  const getAIRecommendations = (nodeId) => {
    if (!cvData || !cvData.recommendations) return { openai: null, claude: null };

    const result = { openai: null, claude: null };

    // Get OpenAI recommendation - match by id (integer), not global_id
    if (cvData.recommendations.openai?.recommendations?.selected_nodes) {
      const openaiNode = cvData.recommendations.openai.recommendations.selected_nodes.find(
        n => n.id === nodeId
      );
      if (openaiNode) {
        result.openai = {
          include: openaiNode.include,
          confidence: openaiNode.confidence,
          reason: openaiNode.reason,
          relevance_tags: openaiNode.relevance_tags || []
        };
      }
    }

    // Get Claude recommendation - match by id (integer), not global_id
    if (cvData.recommendations.claude?.recommendations?.selected_nodes) {
      const claudeNode = cvData.recommendations.claude.recommendations.selected_nodes.find(
        n => n.id === nodeId
      );
      if (claudeNode) {
        result.claude = {
          include: claudeNode.include,
          confidence: claudeNode.confidence,
          reason: claudeNode.reason,
          relevance_tags: claudeNode.relevance_tags || []
        };
      }
    }

    return result;
  };

  // Render tree node (similar to Master Profile)
  const renderTreeNode = (node, level = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const isIncluded = nodeSelections[node.global_id];
    const hasChildren = node.children && node.children.length > 0;
    const aiRecs = getAIRecommendations(node.id);
    const isDragging = draggedNode?.id === node.id;
    const isDragOver = dragOver?.nodeId === node.id;

    // Drag handlers
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
        return;
      }

      // RULE 2: Only allow dragging within the same parent context
      if (draggedNode.parent_id !== node.parent_id) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      // Valid drop target
      e.dataTransfer.dropEffect = 'move';

      // Determine if we're hovering over top or bottom half
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = e.clientY < midpoint ? 'before' : 'after';

      setDragOver({ nodeId: node.id, position });
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

      // Apply same validation rules
      if (draggedNode.node_type !== node.node_type || draggedNode.parent_id !== node.parent_id) {
        setDragOver(null);
        return;
      }

      handleReorderNode(draggedNode.id, node.id, dragOver.position);
      setDragOver(null);
      setDraggedNode(null);
    };

    const handleDragEnd = () => {
      setDraggedNode(null);
      setDragOver(null);
    };

    return (
      <div key={node.id} className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`node-item ${isSelected ? 'selected' : ''} ${!isIncluded ? 'node-excluded' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? `drag-${dragOver.position}` : ''}`}
          data-node-id={node.id}
          onClick={() => setSelectedNode(node)}
          draggable="true"
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {/* Node Type Badge - Matching MasterProfile */}
          <span className={`node-type-badge badge-${node.node_type}`}>
            {node.node_type.toUpperCase()}
          </span>

          {/* Node Content */}
          <div className="node-content-wrapper">
            {editingNode === node.global_id ? (
              // Edit Mode
              <div className="node-edit-form">
                {/* For bullets and paragraphs - only show content */}
                {(node.node_type === 'bullet' || node.node_type === 'paragraph') ? (
                  <textarea
                    className="edit-input edit-content"
                    placeholder={node.node_type === 'bullet' ? 'Bullet point content' : 'Paragraph content'}
                    value={editedContent.content || ''}
                    onChange={(e) => setEditedContent({ ...editedContent, content: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    rows={node.node_type === 'paragraph' ? 5 : 3}
                  />
                ) : (
                  <>
                    {/* Title field for sections and entries */}
                    <input
                      type="text"
                      className="edit-input edit-title"
                      placeholder="Title"
                      value={editedContent.title || ''}
                      onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Subtitle for entries */}
                    {node.node_type === 'entry' && (
                      <input
                        type="text"
                        className="edit-input edit-subtitle"
                        placeholder="Subtitle (e.g., company name)"
                        value={editedContent.subtitle || ''}
                        onChange={(e) => setEditedContent({ ...editedContent, subtitle: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    {/* Content/description */}
                    <textarea
                      className="edit-input edit-content"
                      placeholder="Description"
                      value={editedContent.content || ''}
                      onChange={(e) => setEditedContent({ ...editedContent, content: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      rows={3}
                    />

                    {/* Dates and location for entries */}
                    {node.node_type === 'entry' && (
                      <>
                        <div className="edit-dates">
                          <input
                            type="text"
                            className="edit-input edit-date"
                            placeholder="Start date"
                            value={editedContent.start_date || ''}
                            onChange={(e) => setEditedContent({ ...editedContent, start_date: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            type="text"
                            className="edit-input edit-date"
                            placeholder="End date"
                            value={editedContent.end_date || ''}
                            onChange={(e) => setEditedContent({ ...editedContent, end_date: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <input
                          type="text"
                          className="edit-input edit-location"
                          placeholder="Location"
                          value={editedContent.location || ''}
                          onChange={(e) => setEditedContent({ ...editedContent, location: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </>
                    )}
                  </>
                )}

                <div className="edit-actions">
                  <button
                    className="edit-undo-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      revertToOriginal();
                    }}
                    title="Revert to original content"
                  >
                    <span className="undo-icon">↺</span>
                    Undo
                  </button>
                  <button
                    className="edit-save-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveNodeEdit(node);
                    }}
                  >
                    <span className="save-icon">✓</span>
                    Save
                  </button>
                  <button
                    className="edit-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelEditing();
                    }}
                  >
                    <span className="cancel-icon">✕</span>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="node-title-section">
                {node.title && <span className="node-title-text">{node.title}</span>}
                {!node.title && node.content && (
                  <span className="node-title-text">{node.content.length > 100 ? node.content.substring(0, 100) + '...' : node.content}</span>
                )}
                {node.subtitle && <span className="node-subtitle-text"> • {node.subtitle}</span>}
              </div>
            )}
          </div>

          {/* AI Recommendation Badges - Innovative dual-bar design */}
          {editingNode !== node.global_id && (aiRecs.openai?.include || aiRecs.claude?.include) && (
            <div className="ai-confidence-display">
              {(aiRecs.openai?.include || aiRecs.claude?.include) && (
                <div className="confidence-bars">
                  {aiRecs.openai?.include && (
                    <div
                      className="confidence-bar openai-bar"
                      title={`OpenAI GPT-5.1: ${(aiRecs.openai.confidence * 100).toFixed(0)}% - ${aiRecs.openai.reason}`}
                    >
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${aiRecs.openai.confidence * 100}%`,
                          background: `linear-gradient(90deg,
                            ${aiRecs.openai.confidence > 0.7 ? '#10a37f' : aiRecs.openai.confidence > 0.5 ? '#f59e0b' : '#ef4444'} 0%,
                            ${aiRecs.openai.confidence > 0.7 ? '#0d8968' : aiRecs.openai.confidence > 0.5 ? '#d97706' : '#dc2626'} 100%)`
                        }}
                      >
                        <span className="confidence-label">🤖 {(aiRecs.openai.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                  {aiRecs.claude?.include && (
                    <div
                      className="confidence-bar claude-bar"
                      title={`Claude: ${(aiRecs.claude.confidence * 100).toFixed(0)}% - ${aiRecs.claude.reason}`}
                    >
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${aiRecs.claude.confidence * 100}%`,
                          background: `linear-gradient(90deg,
                            ${aiRecs.claude.confidence > 0.7 ? '#667eea' : aiRecs.claude.confidence > 0.5 ? '#f59e0b' : '#ef4444'} 0%,
                            ${aiRecs.claude.confidence > 0.7 ? '#764ba2' : aiRecs.claude.confidence > 0.5 ? '#d97706' : '#dc2626'} 100%)`
                        }}
                      >
                        <span className="confidence-label">🧠 {(aiRecs.claude.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {editingNode !== node.global_id && (
            <>
              {/* Edit Button */}
              <button
                className="edit-node-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(node);
                }}
                title="Edit this item"
              >
                ✏️
              </button>

              {/* Refine Section Button - Only for sections */}
              {node.node_type === 'section' && (
                <button
                  className="refine-section-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefineSection(node);
                  }}
                  title="GPT-5.1 Thinking Mode: Intelligently refine this section by merging redundant items, tightening wording, and optimizing for the job description"
                  data-refine-label="GPT-5.1"
                >
                  ✨
                </button>
              )}

              {/* Toggle Include/Exclude */}
              <button
                className={`toggle-visibility-btn ${isIncluded ? 'visible' : 'hidden'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeSelection(node.global_id, node);
                }}
                title={isIncluded ? 'Click to exclude from CV' : 'Click to include in CV'}
              ></button>
            </>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="node-children">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render job analysis from AI models
  const renderJobAnalysis = (modelName) => {
    if (!cvData || !cvData.job_analysis) return null;

    const modelData = cvData.job_analysis[modelName];

    if (!modelData || !modelData.success || !modelData.analysis) {
      return (
        <div className="analysis-empty">
          <p>No job analysis available from {modelName === 'openai' ? 'GPT-5.1' : 'Claude'}</p>
        </div>
      );
    }

    const analysis = modelData.analysis;
    const metadata = analysis.job_metadata || {};
    const requirements = analysis.requirements || {};
    const keywords = analysis.keywords || [];

    return (
      <div className="job-analysis-content">
        {/* Model Badge */}
        <div className="analysis-model-badge">
          <span className={`model-badge ${modelName}`}>
            {modelName === 'openai' ? '🤖 GPT-5.1' : '🧠 Claude Sonnet'}
          </span>
        </div>

        {/* Job Metadata */}
        {metadata.title && (
          <div className="analysis-section">
            <h3 className="analysis-heading">Job Title</h3>
            <p className="analysis-text-large">{metadata.title}</p>
            {metadata.seniority_level && (
              <p className="analysis-subtext">Seniority: {metadata.seniority_level}</p>
            )}
          </div>
        )}

        {/* Technical Skills */}
        {requirements.technical_skills && requirements.technical_skills.length > 0 && (
          <div className="analysis-section">
            <h3 className="analysis-heading">Technical Skills Required</h3>
            <div className="skills-grid">
              {requirements.technical_skills.map((skill, idx) => (
                <div key={idx} className="skill-tag technical">{skill}</div>
              ))}
            </div>
          </div>
        )}

        {/* Soft Skills */}
        {requirements.soft_skills && requirements.soft_skills.length > 0 && (
          <div className="analysis-section">
            <h3 className="analysis-heading">Soft Skills Required</h3>
            <div className="skills-grid">
              {requirements.soft_skills.map((skill, idx) => (
                <div key={idx} className="skill-tag soft">{skill}</div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="analysis-section">
            <h3 className="analysis-heading">Important Keywords</h3>
            <div className="skills-grid">
              {keywords.map((keyword, idx) => (
                <div key={idx} className="skill-tag keyword">{keyword}</div>
              ))}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {requirements.responsibilities && requirements.responsibilities.length > 0 && (
          <div className="analysis-section">
            <h3 className="analysis-heading">Key Responsibilities</h3>
            <ul className="analysis-list">
              {requirements.responsibilities.map((resp, idx) => (
                <li key={idx}>{resp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Experience & Education */}
        <div className="analysis-section">
          <h3 className="analysis-heading">Requirements</h3>
          <div className="requirements-grid">
            {requirements.experience_years && (
              <div className="requirement-item">
                <span className="requirement-label">Experience:</span>
                <span className="requirement-value">{requirements.experience_years} years</span>
              </div>
            )}
            {requirements.education && requirements.education.length > 0 && (
              <div className="requirement-item">
                <span className="requirement-label">Education:</span>
                <span className="requirement-value">{requirements.education.join(', ')}</span>
              </div>
            )}
            {requirements.certifications && requirements.certifications.length > 0 && (
              <div className="requirement-item">
                <span className="requirement-label">Certifications:</span>
                <span className="requirement-value">{requirements.certifications.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render CV preview (similar to Master Profile)
  const renderCVPreview = () => {
    if (!cvData || !cvData.content_snapshot) return null;

    const renderPreviewNode = (node, level = 0) => {
      const isIncluded = nodeSelections[node.global_id];

      if (!isIncluded) return null;

      return (
        <div
          key={node.global_id}
          className={`cv-node level-${level} cv-node-clickable`}
          onClick={(e) => {
            e.stopPropagation();
            navigateToNode(node.global_id);
          }}
          title="Click to locate in editor"
        >
          {/* Section (level 0) */}
          {node.node_type === 'section' && (
            <div className="cv-section">
              <h2 className="cv-section-title">
                {node.icon && <span className="section-icon">{node.icon}</span>}
                {node.title}
              </h2>
            </div>
          )}

          {/* Entry (level 1) */}
          {node.node_type === 'entry' && (
            <div className="cv-entry">
              <div className="entry-header">
                <div className="entry-main">
                  {node.title && <h3 className="entry-title">{node.title}</h3>}
                  {node.subtitle && <div className="entry-subtitle">{node.subtitle}</div>}
                </div>
                <div className="entry-meta">
                  {node.start_date && (
                    <div className="entry-dates">
                      {node.start_date} {node.end_date && `- ${node.end_date}`}
                    </div>
                  )}
                  {node.location && <div className="entry-location">{node.location}</div>}
                </div>
              </div>
              {node.content && <p className="entry-content">{node.content}</p>}
            </div>
          )}

          {/* Bullet/Paragraph (level 2+) */}
          {(node.node_type === 'bullet' || node.node_type === 'paragraph') && (
            <div className={`cv-${node.node_type}`}>
              {node.node_type === 'bullet' && <span className="bullet-point">•</span>}
              {node.content && <span>{node.content}</span>}
            </div>
          )}

          {/* Render children */}
          {node.children && node.children.length > 0 && (
            <div className="cv-children">
              {node.children.map(child => renderPreviewNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    const contactInfo = cvData.content_snapshot.contact_info;
    const activeFields = contactInfo?._active_fields || {};

    // Build contact line components (mix of text and JSX)
    const renderContactLine = () => {
      if (!contactInfo) return null;

      const elements = [];

      // Email
      if (activeFields.email && contactInfo.email) {
        elements.push(
          <span key="email">{contactInfo.email}</span>
        );
      }

      // Phone
      if (activeFields.phone_number && contactInfo.phone_number) {
        elements.push(
          <span key="phone">{contactInfo.phone_number}</span>
        );
      }

      // Location (City, Country)
      const locationParts = [];
      if (activeFields.city && contactInfo.city) {
        locationParts.push(contactInfo.city);
      }
      if (activeFields.country && contactInfo.country) {
        locationParts.push(contactInfo.country);
      }
      if (locationParts.length > 0) {
        elements.push(
          <span key="location">{locationParts.join(', ')}</span>
        );
      }

      // LinkedIn - Show icon + text link
      if (activeFields.linkedin_url && contactInfo.linkedin_url) {
        elements.push(
          <a
            key="linkedin"
            href={contactInfo.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0077b5',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </a>
        );
      }

      // GitHub - Show icon + text link
      if (activeFields.github_url && contactInfo.github_url) {
        elements.push(
          <a
            key="github"
            href={contactInfo.github_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#333',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        );
      }

      // Portfolio - Show icon + text link
      if (activeFields.portfolio_url && contactInfo.portfolio_url) {
        elements.push(
          <a
            key="portfolio"
            href={contactInfo.portfolio_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#667eea',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm1 16.947v1.053h-1v-.998c-1.035-.018-2.106-.265-3-.727l.455-1.644c.956.371 2.229.765 3.225.54 1.149-.26 1.385-1.442.114-2.011-.931-.434-3.778-.805-3.778-3.243 0-1.363 1.039-2.583 2.984-2.85v-1.067h1v1.018c.724.019 1.536.145 2.442.42l-.362 1.647c-.768-.27-1.617-.515-2.442-.465-1.489.087-1.62 1.376-.581 1.916 1.711.821 3.778 1.033 3.778 3.243 0 1.514-1.034 2.769-2.835 3.168z"/>
            </svg>
            Portfolio
          </a>
        );
      }

      // Insert separators between elements
      return elements.map((element, index) => (
        <span key={element.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {index > 0 && <span style={{ margin: '0 0.5rem', color: '#cbd5e0' }}>|</span>}
          {element}
        </span>
      ));
    };

    return (
      <div className="cv-document">
        {/* Contact Info */}
        {contactInfo && (
          <div className="cv-header">
            <h1>
              {activeFields.full_name && contactInfo.full_name
                ? contactInfo.full_name
                : 'Professional CV'}
            </h1>
            {activeFields.professional_title && contactInfo.professional_title && (
              <div style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#4a5568', marginTop: '0.5rem' }}>
                {contactInfo.professional_title}
              </div>
            )}
            <div className="cv-contact" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0' }}>
              {renderContactLine()}
            </div>
          </div>
        )}

        {/* Sections */}
        {cvData.content_snapshot.nodes.map(node => renderPreviewNode(node, 0))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="saved-cv-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading CV details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saved-cv-detail">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <h3>Error Loading CV</h3>
          <p>{error}</p>
          <button onClick={onBack} className="btn-back">
            Back to Saved CVs
          </button>
        </div>
      </div>
    );
  }

  if (!cvData) return null;

  return (
    <div className="saved-cv-detail">
      {/* Modern Top Navigation Bar */}
      <div className="detail-top-bar">
        <button onClick={onBack} className="btn-back-modern">
          <span className="back-icon">←</span>
          <span>Back</span>
        </button>
        <div className="job-info-compact">
          <h1 className="job-title-compact">{cvData.job_title}</h1>
          {cvData.company_name && <span className="company-compact">@ {cvData.company_name}</span>}
          {cvData.total_versions > 1 && (
            <span className={`version-badge-compact ${cvData.is_latest ? 'latest' : 'older'}`}>
              v{cvData.version}/{cvData.total_versions}
              {cvData.is_latest && <span className="pulse-dot"></span>}
            </span>
          )}
        </div>
        <div className="top-bar-actions">
          {/* Modern Autosave Indicator - Subtle & Elegant */}
          <div className={`autosave-indicator-modern ${autoSaveStatus}`}>
            {autoSaveStatus === 'saving' && (
              <>
                <div className="save-spinner"></div>
                <span className="save-text">Saving</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <svg className="save-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 8.5L7 10.5L11 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="save-text">Saved</span>
              </>
            )}
            {autoSaveStatus === 'error' && (
              <>
                <svg className="save-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 4V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
                </svg>
                <span className="save-text">Error</span>
              </>
            )}
          </div>

          {/* Unified Finalize Application Button */}
          <button
            onClick={openPreviewTemplateModal}
            className="btn-preview-pdf-modern"
            disabled={previewingPDF || autoSaveStatus === 'saving'}
          >
            {previewingPDF ? (
              <>
                <div className="btn-spinner"></div>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <svg className="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Finalize Application & Download CV</span>
              </>
            )}
          </button>

          {/* Note: Save to Tracker is now integrated into "Finalize Application" button above */}
          {/* The unified workflow ensures settings are always saved */}
        </div>
      </div>

      {/* GPT-5.1 AI Refinement Banner */}
      <div className="ai-refinement-banner">
        <div className="banner-content">
          <div className="banner-icon">🧠</div>
          <div className="banner-text">
            <strong>GPT-5.1 Thinking Mode</strong> available: Click the ✨ icon on any section to intelligently refine your content
          </div>
          <div className="banner-badge">
            <span className="premium-badge">POWERED BY GPT-5.1</span>
          </div>
        </div>
      </div>

      {/* Intelligent Metrics Dashboard */}
      <div className="metrics-dashboard">
        <div className="metrics-grid">
          {/* Live Content Quality - Prominent Card */}
          <div className="metric-card live-metric">
            <div className="metric-header">
              <div className="metric-title">
                <span className="live-indicator-badge">
                  <span className="live-pulse"></span>
                  LIVE
                </span>
                Content Quality
              </div>
              <span className="metric-icon">📊</span>
            </div>
            <div className="metric-body">
              <div className={`metric-score-badge ${
                calculateOfflineATSScore.contentQuality >= 85 ? 'excellent' :
                calculateOfflineATSScore.contentQuality >= 70 ? 'good' :
                calculateOfflineATSScore.contentQuality >= 50 ? 'fair' : 'poor'
              }`}>
                {calculateOfflineATSScore.contentQuality !== null ? `${calculateOfflineATSScore.contentQuality}%` : '-'}
              </div>
              <div className="metric-label">Overall Quality Score</div>
            </div>
            <div className="metric-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Keywords</span>
                <span className="breakdown-value">{calculateOfflineATSScore.keywordCoverage}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Required Skills</span>
                <span className="breakdown-value">{calculateOfflineATSScore.requiredSkillsCoverage}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Content Depth</span>
                <span className="breakdown-value">{calculateOfflineATSScore.contentDepth}%</span>
              </div>
            </div>
            <div className="metric-subtitle">Updates as you edit • AI-weighted scoring</div>
          </div>

          {/* AI Profile Fit Scores */}
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">AI Profile Fit</div>
              <span className="metric-icon">🎯</span>
            </div>
            <div className="metric-body">
              <div className="metric-label">Initial Evaluation</div>
              <div className="ai-scores-grid">
                {cvData.fit_scores?.openai?.scores?.fit_score !== null && cvData.fit_scores?.openai?.scores?.fit_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label openai">🤖 GPT-5.1</div>
                    <div className="ai-score-value">{cvData.fit_scores.openai.scores.fit_score}</div>
                  </div>
                )}
                {cvData.fit_scores?.claude?.scores?.fit_score !== null && cvData.fit_scores?.claude?.scores?.fit_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label claude">🧠 Claude</div>
                    <div className="ai-score-value">{cvData.fit_scores.claude.scores.fit_score}</div>
                  </div>
                )}
              </div>
            </div>
            {cvData.recalculated_scores && cvData.recalculated_scores.length > 0 && (
              <div className="metric-body" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div className="metric-label">After Edits</div>
                <div className="ai-scores-grid">
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores?.openai?.scores?.fit_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label openai">🤖 GPT-5.1</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores.openai.scores.fit_score}</div>
                    </div>
                  )}
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores?.claude?.scores?.fit_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label claude">🧠 Claude</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores.claude.scores.fit_score}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="metric-subtitle">AI models evaluate job-CV alignment</div>
          </div>

          {/* AI ATS Scores */}
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">AI ATS Compatibility</div>
              <span className="metric-icon">⚡</span>
            </div>
            <div className="metric-body">
              <div className="metric-label">Initial Evaluation</div>
              <div className="ai-scores-grid">
                {cvData.ats_scores?.openai?.scores?.ats_score !== null && cvData.ats_scores?.openai?.scores?.ats_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label openai">🤖 GPT-5.1</div>
                    <div className="ai-score-value">{cvData.ats_scores.openai.scores.ats_score}</div>
                  </div>
                )}
                {cvData.ats_scores?.claude?.scores?.ats_score !== null && cvData.ats_scores?.claude?.scores?.ats_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label claude">🧠 Claude</div>
                    <div className="ai-score-value">{cvData.ats_scores.claude.scores.ats_score}</div>
                  </div>
                )}
              </div>
            </div>
            {cvData.recalculated_scores && cvData.recalculated_scores.length > 0 && (
              <div className="metric-body" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div className="metric-label">After Edits</div>
                <div className="ai-scores-grid">
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores?.openai?.scores?.ats_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label openai">🤖 GPT-5.1</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores.openai.scores.ats_score}</div>
                    </div>
                  )}
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores?.claude?.scores?.ats_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label claude">🧠 Claude</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores.claude.scores.ats_score}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="metric-subtitle">Applicant Tracking System readiness</div>
          </div>

          {/* Re-evaluate Button Card */}
          <div className="metric-card reevaluate-card">
            <div className="metric-header">
              <div className="metric-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '0.5rem' }}>
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Update AI Scores
              </div>
            </div>
            <div className="metric-body">
              <p className="reevaluate-description">
                Re-run AI evaluation based on your current edits to get updated fit and ATS compatibility scores.
              </p>
              <button
                onClick={recalculateScores}
                className="btn-reevaluate-full"
                disabled={recalculating}
              >
                {recalculating ? (
                  <>
                    <span className="spinner-medium"></span>
                    Processing AI Evaluation...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Re-evaluate with AI
                  </>
                )}
              </button>

              {/* AI Input Section - Only show after recalculation */}
              {cvData.recalculated_scores && cvData.recalculated_scores.length > 0 && (
                <>
                  <button
                    className="view-prompts-btn"
                    onClick={() => setShowPromptSection(!showPromptSection)}
                  >
                    {showPromptSection ? '▼ Hide AI Input' : '▶ View AI Input'}
                  </button>
                  {showPromptSection && (
                    <div className="prompts-compact">
                      <div className="prompt-compact-item">
                        <strong>🤖 OpenAI GPT-5.1 Prompt:</strong>
                        <pre className="prompt-code-compact">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].prompts.openai.user_prompt}</pre>
                      </div>
                      <div className="prompt-compact-item">
                        <strong>🧠 Claude Prompt:</strong>
                        <pre className="prompt-code-compact">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].prompts.claude.user_prompt}</pre>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="metric-subtitle">⏱️ Takes 10-15 seconds • Uses OpenAI GPT-5.1 & Claude</div>
          </div>
        </div>
      </div>

      {/* Modern Workspace Layout */}
      <div className="workspace-container">
        {/* Left Panel - Editor */}
        <div className="editor-panel">
          <div className="editor-header">
            <h2>CV Content Structure</h2>
            <div className="ai-models-indicator">
              <span className="indicator-label">AI Models:</span>
              {cvData.recommendations?.openai?.recommendations?.selected_nodes && (
                <div className="ai-model-chip openai">
                  <span className="model-icon">🤖</span>
                  <span className="model-name">GPT-5.1</span>
                  <span className="model-color-indicator"></span>
                </div>
              )}
              {cvData.recommendations?.claude?.recommendations?.selected_nodes && (
                <div className="ai-model-chip claude">
                  <span className="model-icon">🧠</span>
                  <span className="model-name">Claude</span>
                  <span className="model-color-indicator"></span>
                </div>
              )}
            </div>
          </div>

          <div className="editor-body">
            {/* Contact Info Section */}
            <div className="contact-info-card">
              <div className="contact-info-title">
                👤 Contact Information
              </div>
              <ContactInfoSection
                cvId={cvId}
                initialContactInfo={cvData.content_snapshot?.contact_info || {}}
                onUpdate={(updatedContactInfo) => {
                  setCvData(prev => ({
                    ...prev,
                    content_snapshot: {
                      ...prev.content_snapshot,
                      contact_info: updatedContactInfo
                    }
                  }));
                }}
                onSaveStart={handleContactSaveStart}
                onSaveComplete={handleContactSaveComplete}
              />
            </div>

            {/* Tree View */}
            {cvData.content_snapshot?.nodes?.map(node => renderTreeNode(node, 0))}
          </div>
        </div>

        {/* Right Panel - Preview with Tabs */}
        <div className="preview-panel">
          <div className="preview-header">
            <div className="preview-tabs">
              <button
                className={`preview-tab ${previewTab === 'preview' ? 'active' : ''}`}
                onClick={() => setPreviewTab('preview')}
              >
                <span className="tab-icon">📄</span>
                Live Preview
              </button>
              <button
                className={`preview-tab ${previewTab === 'openai' ? 'active' : ''}`}
                onClick={() => setPreviewTab('openai')}
              >
                <span className="tab-icon">🤖</span>
                GPT-5.1 Analysis
              </button>
              <button
                className={`preview-tab ${previewTab === 'claude' ? 'active' : ''}`}
                onClick={() => setPreviewTab('claude')}
              >
                <span className="tab-icon">🧠</span>
                Claude Analysis
              </button>
            </div>
          </div>

          <div className="preview-content">
            {previewTab === 'preview' && renderCVPreview()}
            {previewTab === 'openai' && renderJobAnalysis('openai')}
            {previewTab === 'claude' && renderJobAnalysis('claude')}
          </div>
        </div>
      </div>

      {/* Application Tracker Modal - REMOVED: Now integrated into PDF Template Selector */}
      {/* The unified workflow combines PDF customization and tracker saving in one step */}

      {/* PDF Template Selector Modal */}
      {showPreviewTemplateModal && (
        <PDFTemplateSelector
          cvId={cvId}
          cvData={cvData}
          onClose={() => setShowPreviewTemplateModal(false)}
          onGenerate={async (templateName, customizations, jobFormData) => {
            try {
              const token = localStorage.getItem('token');

              // Check for duplicate first
              const checkResponse = await fetch(`${API_URL}/api/applications/check-duplicate/${cvId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (checkResponse.ok) {
                const duplicateCheck = await checkResponse.json();
                if (duplicateCheck.exists) {
                  alert(
                    `This CV has already been saved to the Application Tracker!\n\n` +
                    `Status: ${duplicateCheck.status}\n` +
                    `Created: ${new Date(duplicateCheck.created_at).toLocaleString()}\n\n` +
                    `You can view it in the Application Tracker page.`
                  );
                  return;
                }
              }

              // Create job application with all settings
              const createResponse = await fetch(`${API_URL}/api/applications/create`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  tailored_cv_id: cvId,
                  cv_format: templateName,
                  pdf_customizations: customizations,
                  job_url: jobFormData.job_url,
                  location: jobFormData.location,
                  notes: jobFormData.notes,
                  cover_letter: jobFormData.cover_letter,
                  priority: jobFormData.priority
                })
              });

              if (!createResponse.ok) {
                throw new Error('Failed to save to Application Tracker');
              }

              const application = await createResponse.json();

              // Set saved state
              setApplicationId(application.id);
              setIsSavedToTracker(true);

              // Generate and download PDF
              await previewPDF(templateName, customizations);

              // Close modal
              setShowPreviewTemplateModal(false);

              // Show success message
              alert('Success! Your application has been saved to the tracker and your CV is downloading.');
            } catch (error) {
              console.error('Error in unified workflow:', error);
              alert('Failed to finalize application: ' + error.message);
            }
          }}
        />
      )}

      {/* Refinement Side Panel */}
      {refinementModal.isOpen && (
        <div className="refinement-sidepanel">
          <div className="sidepanel-header">
            <div className="sidepanel-title-group">
              <h2>✨ AI Refinement: {refinementModal.section?.title || 'Section'}</h2>
              <div className="gpt-badge">
                <span className="gpt-icon">🧠</span>
                <span className="gpt-text">GPT-5.1 Thinking</span>
              </div>
            </div>
            <button className="sidepanel-close" onClick={closeRefinementModal}>×</button>
          </div>

          <div className="sidepanel-body">
              {/* Instructions Input */}
              <div className="refinement-instructions">
                <label htmlFor="user-instructions">
                  Additional Instructions (Optional)
                </label>

                {/* Quick Suggestion Chips */}
                <div className="instruction-chips">
                  {(() => {
                    const sectionTitle = refinementModal.section?.title?.toLowerCase() || '';
                    let suggestions = [];

                    // Context-aware suggestions based on section type
                    if (sectionTitle.includes('summary') || sectionTitle.includes('profile') || sectionTitle.includes('about')) {
                      suggestions = [
                        "Keep it to one concise paragraph with 3-4 impactful bullets",
                        "Focus on senior-level impact and leadership",
                        "Emphasize technical depth and business outcomes",
                        "Make it ATS-friendly with clear keywords"
                      ];
                    } else if (sectionTitle.includes('experience') || sectionTitle.includes('work') || sectionTitle.includes('employment')) {
                      suggestions = [
                        "Prioritize achievements over responsibilities",
                        "Quantify impact with metrics where possible",
                        "Keep 3-5 strongest bullets per role, merge similar ones",
                        "Emphasize technologies matching the job description"
                      ];
                    } else if (sectionTitle.includes('skill') || sectionTitle.includes('technical') || sectionTitle.includes('competenc')) {
                      suggestions = [
                        "Group related skills, remove redundancy",
                        "Keep it brief - one paragraph max",
                        "Prioritize skills matching job requirements",
                        "Focus on depth over breadth"
                      ];
                    } else if (sectionTitle.includes('project') || sectionTitle.includes('portfolio')) {
                      suggestions = [
                        "Focus on business impact and outcomes",
                        "Highlight technologies relevant to target role",
                        "Keep 2-3 projects maximum, most relevant ones",
                        "Emphasize your specific contributions"
                      ];
                    } else if (sectionTitle.includes('education') || sectionTitle.includes('certification')) {
                      suggestions = [
                        "Keep it concise - institution, degree, year",
                        "Highlight relevant coursework if applicable",
                        "Remove GPA unless exceptional (3.8+)",
                        "Focus on certifications matching job needs"
                      ];
                    } else {
                      // Generic suggestions
                      suggestions = [
                        "Keep content concise and impactful",
                        "Remove redundancy, merge similar items",
                        "Prioritize relevance to job description",
                        "Maintain strong ATS keyword presence"
                      ];
                    }

                    return suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="instruction-chip"
                        onClick={() => setUserInstructions(prev => prev ? `${prev}\n${suggestion}` : suggestion)}
                        disabled={refining}
                        title="Click to add this instruction"
                      >
                        + {suggestion}
                      </button>
                    ));
                  })()}
                </div>

                <textarea
                  id="user-instructions"
                  placeholder="E.g., 'Focus on leadership impact', 'Emphasize ML/AI work', 'Keep it under 200 words'"
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  rows={3}
                  disabled={refining}
                />
              </div>

              {/* Action Buttons */}
              <div className="refinement-actions">
                <button
                  onClick={handleRunRefinement}
                  disabled={refining}
                  className="btn-primary btn-refine"
                >
                  {refining ? '⏳ Refining...' : '✨ Refine with AI'}
                </button>
                {refinementResult && (
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="btn-secondary btn-toggle-prompt"
                  >
                    {showPrompt ? 'Hide Prompt' : 'View Prompt Sent to AI'}
                  </button>
                )}
              </div>

              {/* Show Prompt if toggled */}
              {showPrompt && refinementResult?.prompt_sent && (
                <div className="prompt-display">
                  <h4>Prompt Sent to AI:</h4>
                  <pre>{refinementResult.prompt_sent}</pre>
                </div>
              )}

              {/* Results */}
              {refinementResult && refinementResult.success && (
                <>
                  {/* Stats */}
                  <div className="refinement-stats">
                    <div className="stat-card">
                      <span className="stat-label">Characters</span>
                      <span className="stat-value">
                        {refinementResult.stats?.original_character_count_estimate || 0} →{' '}
                        {refinementResult.stats?.refined_character_count_estimate || 0}
                      </span>
                      <span className="stat-reduction">
                        -{refinementResult.stats?.characters_reduced_estimate || 0}{' '}
                        {refinementResult.stats?.original_character_count_estimate > 0 && (
                          <>
                            (-
                            {Math.round(
                              (refinementResult.stats.characters_reduced_estimate /
                                refinementResult.stats.original_character_count_estimate) *
                                100
                            )}
                            %)
                          </>
                        )}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Bullets</span>
                      <span className="stat-value">
                        {refinementResult.stats?.original_bullet_count_estimate || 0} →{' '}
                        {refinementResult.stats?.refined_bullet_count_estimate || 0}
                      </span>
                      <span className="stat-reduction">
                        -{refinementResult.stats?.bullets_removed_or_merged_estimate || 0}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="refinement-summary">
                    <h4>What Changed:</h4>
                    <p>{refinementResult.changes_summary}</p>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="comparison-view">
                    <div className="original-content">
                      <h4>📄 Original</h4>
                      <div className="content-preview">
                        <pre>{refinementResult.original_content}</pre>
                      </div>
                    </div>

                    <div className="refined-content">
                      <h4>✨ Refined</h4>
                      <div className="content-preview">
                        <pre>{refinementResult.refined_content}</pre>
                      </div>
                      <button
                        onClick={(e) => copyToClipboard(refinementResult.refined_content, e)}
                        className="btn-copy"
                      >
                        📋 Copy Refined Content
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {refinementResult && !refinementResult.success && (
                <div className="refinement-error">
                  <strong>Error:</strong> {refinementResult.error || 'Failed to refine section'}
                </div>
              )}
          </div>
        </div>
      )}

    </div>
  );
}

export default SavedCVDetail;
