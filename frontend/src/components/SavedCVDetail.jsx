import { useState, useEffect, useMemo, useRef } from 'react';
import ContactInfoSection from './ContactInfoSection';
import PDFTemplateSelector from './PDFTemplateSelector';
import './SavedCVDetail.css';
import './SavedCVDetail_AutoRefine.css';
import './refinement-status.css';

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
  const [addNodeModal, setAddNodeModal] = useState({
    isOpen: false,
    parentNode: null,
    parentLevel: 0
  });
  const [newNodeForm, setNewNodeForm] = useState({
    node_type: 'entry',
    title: '',
    subtitle: '',
    content: '',
    start_date: '',
    end_date: '',
    location: ''
  });
  const [recalculating, setRecalculating] = useState(false);
  const [showPromptSection, setShowPromptSection] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
    sectionId: null,
    nodeType: null  // Track whether refining a section or entry
  });
  const [userInstructions, setUserInstructions] = useState('');
  const [refining, setRefining] = useState(false);
  const [refinementResult, setRefinementResult] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState('low'); // none, low, medium, high (default: low)
  const [refineProvider, setRefineProvider] = useState('openai'); // openai | claude (single-section refine)
  const [rewriteMode, setRewriteMode] = useState('minimal'); // minimal | standard
  const [humanStrictMode, setHumanStrictMode] = useState(true);
  const [targetPages, setTargetPages] = useState('auto'); // auto | 1 | 2
  const [userInstructionTemplates, setUserInstructionTemplates] = useState([]);
  const [newInstructionTemplateLabel, setNewInstructionTemplateLabel] = useState('');
  const [newInstructionTemplate, setNewInstructionTemplate] = useState('');
  const [savingInstructionTemplate, setSavingInstructionTemplate] = useState(false);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
  const [editingTemplateLabel, setEditingTemplateLabel] = useState('');
  const [editingTemplateInstruction, setEditingTemplateInstruction] = useState('');
  const [isTemplateEditorExpanded, setIsTemplateEditorExpanded] = useState(false);

  // Auto-refine all sections state
  const [autoRefining, setAutoRefining] = useState(false);
  const [autoRefineProgress, setAutoRefineProgress] = useState({ current: 0, total: 0, currentSection: '' });
  const [autoRefineLog, setAutoRefineLog] = useState([]);
  const [autoRefineReasoningEffort, setAutoRefineReasoningEffort] = useState('low'); // none, low, medium, high (default: low for auto-refine)
  const [autoRefineRewriteMode, setAutoRefineRewriteMode] = useState('minimal');
  const [autoRefineHumanStrict, setAutoRefineHumanStrict] = useState(true);
  const [autoRefineTargetPages, setAutoRefineTargetPages] = useState('auto');
  const [showAutoRefineModal, setShowAutoRefineModal] = useState(false); // Modal for auto-refine settings
  const [autoRefineInstructions, setAutoRefineInstructions] = useState(''); // Optional instructions for auto-refine
  const [autoRefineProvider, setAutoRefineProvider] = useState('openai'); // openai | claude
  const [refineProposal, setRefineProposal] = useState(null); // holistic refine proposal (review-then-apply)
  const [showRefineReview, setShowRefineReview] = useState(false);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineApplying, setRefineApplying] = useState(false);
  const [humanityReport, setHumanityReport] = useState(null);
  const [checkingHumanity, setCheckingHumanity] = useState(false);
  const [showHumanityDetails, setShowHumanityDetails] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({
    mode: 'idle', // idle | running | success | error
    title: '',
    steps: [],
    error: ''
  });

  const resetUpdateStatus = () => {
    setUpdateStatus({
      mode: 'idle',
      title: '',
      steps: [],
      error: ''
    });
  };

  useEffect(() => {
    if (updateStatus.mode !== 'success') return;
    const timer = setTimeout(() => {
      resetUpdateStatus();
    }, 2800);
    return () => clearTimeout(timer);
  }, [updateStatus.mode]);

  // Live Preview PDF Customization State
  const [livePreviewTemplate, setLivePreviewTemplate] = useState('ats_optimized');
  const [livePreviewCustomizations, setLivePreviewCustomizations] = useState({
    fontSize: 'normal',
    spacing: 'tight',
    colorIntensity: 'normal'
  });
  const [livePreviewMetadata, setLivePreviewMetadata] = useState(null);
  const [loadingPreviewMetadata, setLoadingPreviewMetadata] = useState(false);
  const [previewMetadataTimer, setPreviewMetadataTimer] = useState(null);
  const skipAutoHumanityCheckRef = useRef(true);
  const nextTempNodeIdRef = useRef(-1);

  const baseInstructionTemplates = [
    {
      label: 'STRICT ROLE MATCH',
      instruction: 'Tailor this section strictly to the job requirements and critical must-haves. Keep only the most relevant points from the currently selected content. If a point is not selected or not relevant, do not use it.'
    },
    {
      label: 'HUMAN WRITING',
      instruction: 'Write in a natural human style. Avoid generic AI buzzwords, fluffy claims, and robotic phrasing. Keep language clear, specific, and credible.'
    },
    {
      label: 'CRISP & CONCISE',
      instruction: 'Tighten this section aggressively: remove repetition, merge overlapping points, and keep concise high-impact statements. Prefer shorter sentences with strong action verbs.'
    },
    {
      label: 'KEYWORD ALIGNMENT',
      instruction: 'Align wording to the job description and ATS keywords only where truthful from selected content. Use exact terms from the role when supported by existing selected evidence.'
    },
    {
      label: 'NO NEW CONTENT',
      instruction: 'Do not invent or add any new achievements, tools, responsibilities, metrics, or scope. Use only what exists in the selected content of this section/subsection.'
    },
    {
      label: 'LEADERSHIP FOCUS',
      instruction: 'Emphasize leadership, ownership, cross-functional collaboration, and business impact from the selected content. Keep claims factual and evidence-based.'
    },
    {
      label: 'TECHNICAL DEPTH',
      instruction: 'Prioritize technical depth and implementation detail from selected content: architecture choices, tools, methods, constraints, and measurable outcomes.'
    }
  ];

  const normalizeInstructionTemplates = (templates) => {
    if (!Array.isArray(templates)) return [];

    const normalized = [];
    templates.forEach((item, idx) => {
      if (typeof item === 'string') {
        const instruction = item.trim();
        if (!instruction) return;
        normalized.push({
          label: `My Template ${idx + 1}`,
          instruction
        });
        return;
      }

      if (!item || typeof item !== 'object') return;
      const instruction = String(item.instruction || '').trim();
      if (!instruction) return;
      const label = String(item.label || `My Template ${idx + 1}`).trim();
      normalized.push({
        label: label || `My Template ${idx + 1}`,
        instruction
      });
    });

    return normalized.slice(0, 12);
  };

  const sanitizeFilenamePart = (value, fallback) => {
    const text = String(value || '').trim() || fallback;
    return text
      .replace(/[–—]/g, '-')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .trim()
      .replace(/\.+$/g, '') || fallback;
  };

  const buildDefaultCvFilename = () => {
    const job = sanitizeFilenamePart(cvData?.job_title, 'Job');
    const company = sanitizeFilenamePart(cvData?.company_name, 'Company');
    const fullName = sanitizeFilenamePart(cvData?.content_snapshot?.contact_info?.full_name, 'User');
    return `CV_${job}_${company}_${fullName}.pdf`;
  };

  useEffect(() => {
    fetchCVData();
  }, [cvId]);

  useEffect(() => {
    fetchUserInstructionTemplates();
  }, []);

  useEffect(() => {
    if (!cvData?.content_snapshot?.nodes) return;
    if (skipAutoHumanityCheckRef.current) {
      skipAutoHumanityCheckRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const snapshot = buildCurrentSnapshot();
      if (snapshot) {
        runHumanityCheck(snapshot);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [nodeSelections]);

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
      setHumanityReport(data.humanity || null);

      // Initialize node selections from snapshot
      initializeNodeSelections(data.content_snapshot);

      // Start with all nodes collapsed by default
      setExpandedNodes(new Set());

      if (!data.humanity) {
        await runHumanityCheck(data.content_snapshot);
      }
    } catch (err) {
      console.error('Error fetching CV:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeNodeSelections = (snapshot) => {
    if (!snapshot || !snapshot.nodes) return;
    skipAutoHumanityCheckRef.current = true;

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

  // Fetch live preview metadata (page count, word count, etc.)
  const fetchLivePreviewMetadata = async () => {
    if (!cvData) return;

    setLoadingPreviewMetadata(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/preview-metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cv_format: livePreviewTemplate,
          customizations: livePreviewCustomizations
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preview metadata');
      }

      const metadata = await response.json();
      setLivePreviewMetadata(metadata);
    } catch (err) {
      console.error('Error fetching preview metadata:', err);
      setLivePreviewMetadata(null);
    } finally {
      setLoadingPreviewMetadata(false);
    }
  };

  // Fetch preview metadata when template, customizations, or node selections change
  useEffect(() => {
    if (cvData && previewTab === 'preview') {
      // Clear existing timer
      if (previewMetadataTimer) {
        clearTimeout(previewMetadataTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        fetchLivePreviewMetadata();
      }, 800); // 800ms debounce

      setPreviewMetadataTimer(timer);

      // Cleanup timer on unmount or when dependencies change
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
      };
    }
  }, [cvId, livePreviewTemplate, livePreviewCustomizations, nodeSelections, cvData, previewTab]);

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

  const getAllowedChildTypes = (parentLevel) => {
    if (parentLevel < 2) return ['entry', 'bullet', 'paragraph'];
    return ['bullet', 'paragraph'];
  };

  const openAddNodeModal = (parentNode, parentLevel) => {
    const allowedTypes = getAllowedChildTypes(parentLevel);
    const defaultType = allowedTypes.includes('entry') ? 'entry' : allowedTypes[0];

    setAddNodeModal({
      isOpen: true,
      parentNode,
      parentLevel
    });
    setNewNodeForm({
      node_type: defaultType,
      title: '',
      subtitle: '',
      content: '',
      start_date: '',
      end_date: '',
      location: ''
    });
  };

  const closeAddNodeModal = () => {
    setAddNodeModal({
      isOpen: false,
      parentNode: null,
      parentLevel: 0
    });
  };

  const createNodeFromForm = () => {
    const nodeType = newNodeForm.node_type;
    const parentNode = addNodeModal.parentNode;
    const parentLevel = addNodeModal.parentLevel;
    const allowedTypes = getAllowedChildTypes(parentLevel);

    if (!parentNode) {
      throw new Error('Parent node is missing');
    }
    if (!allowedTypes.includes(nodeType)) {
      throw new Error('This item type is not allowed at this level');
    }
    if ((nodeType === 'bullet' || nodeType === 'paragraph') && !newNodeForm.content.trim()) {
      throw new Error(`${nodeType === 'bullet' ? 'Bullet' : 'Paragraph'} content is required`);
    }
    if (nodeType === 'entry' && !newNodeForm.title.trim()) {
      throw new Error('Entry title is required');
    }

    const newId = nextTempNodeIdRef.current--;
    const newGlobalId = `manual-added-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const computedLevel = typeof parentNode.level === 'number' ? parentNode.level + 1 : parentLevel + 1;
    const inferredRootId =
      parentNode.root_id != null
        ? parentNode.root_id
        : (parentNode.node_type === 'section' ? parentNode.id : null);

    return {
      id: newId,
      global_id: newGlobalId,
      profile_id: cvData?.profile_id,
      parent_id: parentNode.id,
      root_id: inferredRootId,
      level: computedLevel,
      node_type: nodeType,
      title: nodeType === 'entry' ? newNodeForm.title.trim() : '',
      subtitle: nodeType === 'entry' ? (newNodeForm.subtitle || '').trim() : '',
      content: (newNodeForm.content || '').trim(),
      content_type: 'text',
      start_date: nodeType === 'entry' ? (newNodeForm.start_date || '').trim() : '',
      end_date: nodeType === 'entry' ? (newNodeForm.end_date || '').trim() : '',
      location: nodeType === 'entry' ? (newNodeForm.location || '').trim() : '',
      order: (parentNode.children || []).length,
      is_visible: true,
      is_selected: true,
      ai_refined: false,
      children: []
    };
  };

  const handleAddNodeToSnapshot = async () => {
    if (!cvData?.content_snapshot?.nodes) return;

    try {
      const parentNode = addNodeModal.parentNode;
      const newNode = createNodeFromForm();

      const addToTree = (nodes) => {
        return nodes.map(node => {
          if (node.global_id === parentNode.global_id) {
            return {
              ...node,
              children: [...(node.children || []), newNode]
            };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: addToTree(node.children) };
          }
          return node;
        });
      };

      const updatedNodes = normalizeNodeOrderRecursive(addToTree(cvData.content_snapshot.nodes));
      const updatedSnapshot = {
        ...cvData.content_snapshot,
        nodes: updatedNodes
      };

      const updatedSelections = {
        ...nodeSelections,
        [newNode.global_id]: true
      };

      setCvData(prev => ({
        ...prev,
        content_snapshot: updatedSnapshot
      }));
      setNodeSelections(updatedSelections);
      setExpandedNodes(prev => {
        const next = new Set(prev);
        next.add(parentNode.id);
        return next;
      });
      setSelectedNode(newNode);
      closeAddNodeModal();

      setAutoSaveStatus('saving');
      const snapshotForSave = {
        ...updatedSnapshot,
        nodes: updateNodesWithSelectionsRecursive(updatedSnapshot.nodes, updatedSelections)
      };
      await saveSnapshotToBackend(snapshotForSave);
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Error adding node:', err);
      alert(err.message || 'Failed to add item');
      setAutoSaveStatus('error');
    }
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
      // If node is in selections, use that value; otherwise preserve existing is_selected
      is_selected: node.global_id && selections.hasOwnProperty(node.global_id)
        ? selections[node.global_id]
        : (node.is_selected !== false), // Preserve existing is_selected if not in selections
      children: node.children ? updateNodesWithSelectionsRecursive(node.children, selections) : []
    }));
  };

  // Keep node.order aligned with the visual array order at every tree level.
  const normalizeNodeOrderRecursive = (nodes) => {
    return (nodes || []).map((node, index) => ({
      ...node,
      order: index,
      children: node.children ? normalizeNodeOrderRecursive(node.children) : []
    }));
  };

  // Helper to save snapshot to backend
  const saveSnapshotToBackend = async (snapshot) => {
    const normalizedSnapshot = {
      ...snapshot,
      nodes: normalizeNodeOrderRecursive(snapshot.nodes || [])
    };

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
    collectSelectedIds(normalizedSnapshot.nodes);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/tailor/${cvId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content_snapshot: normalizedSnapshot,
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

      const reorderedNodes = normalizeNodeOrderRecursive(reorderNodes(cvData.content_snapshot.nodes));

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
  const handleRefineSection = (node) => {
    setRefinementModal({
      isOpen: true,
      section: node,
      sectionId: node.id,
      nodeType: node.node_type  // Track the node type
    });
    setUserInstructions('');
    setRefinementResult(null);
    setShowPrompt(false);
    setIsTemplateEditorExpanded(false);
  };

  const closeRefinementModal = () => {
    setRefinementModal({
      isOpen: false,
      section: null,
      sectionId: null,
      nodeType: null
    });
    setUserInstructions('');
    setRefinementResult(null);
    setShowPrompt(false);
    setIsTemplateEditorExpanded(false);
  };

  const handleAddInstructionTemplate = async () => {
    const instruction = newInstructionTemplate.trim();
    if (!instruction) return;

    const label = newInstructionTemplateLabel.trim() || `My Template ${userInstructionTemplates.length + 1}`;
    const updated = [
      ...userInstructionTemplates,
      {
        label: label.slice(0, 40),
        instruction: instruction.slice(0, 400)
      }
    ].slice(0, 12);
    setSavingInstructionTemplate(true);
    try {
      const success = await saveUserInstructionTemplates(updated);
      if (success) {
        setNewInstructionTemplateLabel('');
        setNewInstructionTemplate('');
        setEditingTemplateIndex(null);
      } else {
        alert('Failed to save personal instruction template.');
      }
    } catch (error) {
      console.error('Error saving personal instruction template:', error);
      alert('Failed to save personal instruction template.');
    } finally {
      setSavingInstructionTemplate(false);
    }
  };

  const startEditInstructionTemplate = (indexToEdit) => {
    const current = userInstructionTemplates[indexToEdit];
    if (!current) return;
    setIsTemplateEditorExpanded(true);
    setEditingTemplateIndex(indexToEdit);
    setEditingTemplateLabel(current.label || `My Template ${indexToEdit + 1}`);
    setEditingTemplateInstruction(current.instruction || '');
  };

  const cancelEditInstructionTemplate = () => {
    setEditingTemplateIndex(null);
    setEditingTemplateLabel('');
    setEditingTemplateInstruction('');
  };

  const handleSaveEditedInstructionTemplate = async () => {
    if (editingTemplateIndex === null) return;

    const cleanedInstruction = editingTemplateInstruction.trim();
    if (!cleanedInstruction) {
      alert('Instruction cannot be empty.');
      return;
    }

    const cleanedLabel = editingTemplateLabel.trim() || `My Template ${editingTemplateIndex + 1}`;
    const updated = userInstructionTemplates.map((template, idx) => {
      if (idx !== editingTemplateIndex) return template;
      return {
        label: cleanedLabel.slice(0, 40),
        instruction: cleanedInstruction.slice(0, 400)
      };
    });

    setSavingInstructionTemplate(true);
    try {
      const success = await saveUserInstructionTemplates(updated);
      if (!success) {
        alert('Failed to edit personal instruction template.');
        return;
      }
      cancelEditInstructionTemplate();
    } catch (error) {
      console.error('Error editing personal instruction template:', error);
      alert('Failed to edit personal instruction template.');
    } finally {
      setSavingInstructionTemplate(false);
    }
  };

  const handleRemoveInstructionTemplate = async (indexToRemove) => {
    const updated = userInstructionTemplates.filter((_, idx) => idx !== indexToRemove);
    if (editingTemplateIndex === indexToRemove) {
      cancelEditInstructionTemplate();
    }
    setSavingInstructionTemplate(true);
    try {
      const success = await saveUserInstructionTemplates(updated);
      if (!success) {
        alert('Failed to remove personal instruction template.');
      }
    } catch (error) {
      console.error('Error removing personal instruction template:', error);
      alert('Failed to remove personal instruction template.');
    } finally {
      setSavingInstructionTemplate(false);
    }
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
          node_id: refinementModal.sectionId,
          node_type: refinementModal.nodeType,
          user_instructions: userInstructions || null,
          provider: refineProvider,
          reasoning_effort: reasoningEffort,  // Send "none", "low", "medium", or "high" directly
          rewrite_mode: rewriteMode,
          human_strict: humanStrictMode,
          target_pages: targetPages === 'auto' ? null : Number(targetPages)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to refine ${refinementModal.nodeType}`);
      }

      const data = await response.json();

      // Store reasoning effort info for display
      if (data.ai_info) {
        localStorage.setItem('reasoning_effort', data.ai_info.reasoning_effort);
      }

      setRefinementResult(data);
    } catch (error) {
      console.error(`Error refining ${refinementModal.nodeType}:`, error);
      alert(`Failed to refine ${refinementModal.nodeType}: ${error.message}`);
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

  // Convert refined markdown to ProfileNode structure with proper BULLET/PARAGRAPH distinction
  const convertMarkdownToNodes = (markdownText, baseNodeType) => {
    const lines = markdownText.split('\n');
    const nodes = [];
    let currentLevel1Entry = null;  // ### entry (h3)
    let currentLevel2Entry = null;  // #### nested entry (h4)
    let currentLevel3Entry = null;  // ##### deeply nested entry (h5)
    let nextId = Date.now(); // Temporary IDs for new nodes

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Section header (##) - ALWAYS SKIP (section cannot contain section)
      if (trimmed.startsWith('## ')) {
        // For section-level refinement: AI returns section header, but we skip it
        //   (we're adding children TO the section, not creating a new section)
        // For entry-level refinement: Also skip (entry cannot contain section)
        return; // Skip this line
      }
      // Deeply nested entry header (##### - h5)
      else if (trimmed.startsWith('##### ')) {
        const title = trimmed.substring(6).trim();
        currentLevel3Entry = {
          id: nextId++,
          global_id: `ai-refined-entry-${nextId}`,
          node_type: 'entry',
          title: title,
          children: [],
          is_selected: true,
          ai_refined: true,
          level: baseNodeType === 'entry' ? 4 : 3
        };

        // Add as child of current level2 entry if exists, otherwise level1, otherwise root
        if (currentLevel2Entry) {
          currentLevel2Entry.children.push(currentLevel3Entry);
        } else if (currentLevel1Entry) {
          currentLevel1Entry.children.push(currentLevel3Entry);
        } else {
          nodes.push(currentLevel3Entry);
        }
      }
      // Nested Entry header (#### - h4)
      else if (trimmed.startsWith('#### ')) {
        const title = trimmed.substring(5).trim();
        currentLevel2Entry = {
          id: nextId++,
          global_id: `ai-refined-entry-${nextId}`,
          node_type: 'entry',
          title: title,
          children: [],
          is_selected: true,
          ai_refined: true,
          level: baseNodeType === 'entry' ? 3 : 2
        };

        // Add as child of current level1 entry if exists, otherwise add to nodes
        if (currentLevel1Entry) {
          currentLevel1Entry.children.push(currentLevel2Entry);
        } else {
          nodes.push(currentLevel2Entry);
        }
        currentLevel3Entry = null; // Reset deeper level when new level2 entry starts
      }
      // Top-level Entry header (### - h3)
      else if (trimmed.startsWith('### ')) {
        const title = trimmed.substring(4).trim();

        // For entry-level refinement: Create nested entries (level 1)
        // For section-level refinement: Create top-level entries
        currentLevel1Entry = {
          id: nextId++,
          global_id: `ai-refined-entry-${nextId}`,
          node_type: 'entry',
          title: title,
          children: [],
          is_selected: true,
          ai_refined: true,
          level: baseNodeType === 'entry' ? 2 : 1  // Nested if parent is entry
        };

        nodes.push(currentLevel1Entry);
        currentLevel2Entry = null; // Reset nested entry when new level1 entry starts
        currentLevel3Entry = null; // Reset deeper level
      }
      // Subtitle (italic text like *Company Name*)
      else if (trimmed.match(/^\*[^*]+\*$/)) {
        const subtitle = trimmed.replace(/\*/g, '').trim();
        // Apply subtitle to the most recent entry (level3 > level2 > level1)
        const targetEntry = currentLevel3Entry || currentLevel2Entry || currentLevel1Entry;
        if (targetEntry) {
          targetEntry.subtitle = subtitle;
        }
      }
      // Metadata line (location | dates)
      else if (trimmed.includes(' | ')) {
        const parts = trimmed.split(' | ');
        // Apply metadata to the most recent entry (level3 > level2 > level1)
        const targetEntry = currentLevel3Entry || currentLevel2Entry || currentLevel1Entry;
        if (targetEntry) {
          if (parts[0]) targetEntry.location = parts[0].trim();
          if (parts[1]) {
            const dates = parts[1].trim();
            if (dates.includes(' - ')) {
              const [start, end] = dates.split(' - ');
              targetEntry.start_date = start.trim();
              targetEntry.end_date = end.trim() === 'Present' ? null : end.trim();
            }
          }
        }
      }
      // BULLET point (starts with -)
      else if (trimmed.startsWith('- ')) {
        const content = trimmed.substring(2).trim();
        const bulletNode = {
          id: nextId++,
          global_id: `ai-refined-bullet-${nextId}`,
          node_type: 'bullet',
          content: content,
          is_selected: true,
          ai_refined: true,
          children: []
        };

        // Smart placement: level3 > level2 > level1 > root
        if (currentLevel3Entry) {
          currentLevel3Entry.children.push(bulletNode);
        } else if (currentLevel2Entry) {
          currentLevel2Entry.children.push(bulletNode);
        } else if (currentLevel1Entry) {
          currentLevel1Entry.children.push(bulletNode);
        } else {
          // No entry context, add directly (for section with bullets, or entry refinement)
          nodes.push(bulletNode);
        }
      }
      // PARAGRAPH text (doesn't start with -, not metadata, not header)
      else {
        const paragraphNode = {
          id: nextId++,
          global_id: `ai-refined-paragraph-${nextId}`,
          node_type: 'paragraph',
          content: trimmed,
          is_selected: true,
          ai_refined: true,
          children: []
        };

        // Smart placement: level3 > level2 > level1 > root
        if (currentLevel3Entry) {
          currentLevel3Entry.children.push(paragraphNode);
        } else if (currentLevel2Entry) {
          currentLevel2Entry.children.push(paragraphNode);
        } else if (currentLevel1Entry) {
          currentLevel1Entry.children.push(paragraphNode);
        } else {
          // No entry context, add directly (for section with paragraphs, or entry refinement)
          nodes.push(paragraphNode);
        }
      }
    });

    return nodes;
  };

  // Handle including refined content into the tree (silent, immediate update)
  const handleIncludeRefinedContent = async () => {
    if (!refinementResult || !refinementResult.refined_content) {
      return;
    }

    if (refinementResult?.humanity?.requires_confirmation) {
      const proceed = window.confirm(
        `Humanity Guard Warning (score: ${refinementResult.humanity.score}).\n\n` +
        `This refinement may sound AI-generated or include risky phrasing.\n` +
        `Do you still want to include it?`
      );
      if (!proceed) return;
    }

    try {
      // Convert markdown to node structure with AI-refined markers
      const refinedNodes = convertMarkdownToNodes(
        refinementResult.refined_content,
        refinementModal.nodeType
      );

      if (refinedNodes.length === 0) {
        return;
      }

      // Update the cvData state immediately (optimistic update)
      const updatedCvData = { ...cvData };
      const content_snapshot = { ...updatedCvData.content_snapshot };

      // Recursively merge refined nodes with existing nodes, preserving unselected children at ALL levels
      const mergeRefinedNodes = (refinedNodes, existingSelectedChildren) => {
        return refinedNodes.map(refinedNode => {
          if (refinedNode.node_type === 'entry') {
            // Find matching existing entry by title (only among selected children)
            const matchingExisting = existingSelectedChildren.find(
              child => child.node_type === 'entry' &&
                       child.title === refinedNode.title
            );

            if (matchingExisting) {
              const existingChildrenOfEntry = matchingExisting.children || [];

              // Separate entry's children into unselected (keep) vs selected (replace with refined)
              const unselectedEntryChildren = [];
              const selectedEntryChildren = [];

              existingChildrenOfEntry.forEach(child => {
                const isUnselected = child.is_selected === false ||
                                   (child.global_id && nodeSelections[child.global_id] === false);
                if (isUnselected) {
                  unselectedEntryChildren.push(child);
                } else {
                  selectedEntryChildren.push(child);
                }
              });

              // Recursively merge refined children with selected children of this entry
              const mergedChildren = mergeRefinedNodes(
                refinedNode.children || [],
                selectedEntryChildren
              );

              // PRESERVE ORIGINAL METADATA: Use the original entry's properties but update children
              // This maintains the hierarchy structure (id, global_id, level, etc.)
              return {
                ...matchingExisting,  // Preserve original entry metadata
                children: [...unselectedEntryChildren, ...mergedChildren],
                ai_refined: true,  // Mark as AI-refined
                // Update title/subtitle/dates if AI changed them
                title: refinedNode.title || matchingExisting.title,
                subtitle: refinedNode.subtitle !== undefined ? refinedNode.subtitle : matchingExisting.subtitle,
                location: refinedNode.location !== undefined ? refinedNode.location : matchingExisting.location,
                start_date: refinedNode.start_date !== undefined ? refinedNode.start_date : matchingExisting.start_date,
                end_date: refinedNode.end_date !== undefined ? refinedNode.end_date : matchingExisting.end_date,
                content: refinedNode.content !== undefined ? refinedNode.content : matchingExisting.content
              };
            }
          }
          // For non-entry nodes or non-matching entries, return as-is
          return refinedNode;
        });
      };

      // Find and update the target node's children
      const updateNodeChildren = (nodes, targetId) => {
        for (let node of nodes) {
          if (node.id === targetId) {
            const existingChildren = node.children || [];

            // Separate children into: unselected (keep as-is) vs selected (will be replaced by refined)
            const unselectedChildren = [];
            const selectedChildren = [];

            existingChildren.forEach(child => {
              // Check if this child was unselected (is_selected === false OR nodeSelections === false)
              const isUnselected = child.is_selected === false ||
                                 (child.global_id && nodeSelections[child.global_id] === false);

              if (isUnselected) {
                unselectedChildren.push(child);
              } else {
                selectedChildren.push(child);
              }
            });

            // Merge refined nodes with the SELECTED children only (preserving unselected nested children within entries)
            const mergedRefinedNodes = mergeRefinedNodes(refinedNodes, selectedChildren);

            // Final children = unselected (untouched) + refined (replacing selected)
            node.children = [...unselectedChildren, ...mergedRefinedNodes];
            return true;
          }
          if (node.children && node.children.length > 0) {
            if (updateNodeChildren(node.children, targetId)) {
              return true;
            }
          }
        }
        return false;
      };

      updateNodeChildren(content_snapshot.nodes, refinementModal.sectionId);
      updatedCvData.content_snapshot = content_snapshot;

      // Update state immediately - this makes nodes appear in left panel
      setCvData(updatedCvData);

      // Auto-select all refined nodes by updating nodeSelections
      const newSelections = { ...nodeSelections };
      const markNodesAsSelected = (nodes) => {
        nodes.forEach(node => {
          if (node.global_id) {
            newSelections[node.global_id] = true;
          }
          if (node.children && node.children.length > 0) {
            markNodesAsSelected(node.children);
          }
        });
      };
      markNodesAsSelected(refinedNodes);
      setNodeSelections(newSelections);

      // Trigger autosave with the new selections to persist them
      triggerAutoSave(newSelections, true);
      await runHumanityCheck(content_snapshot);

      // Expand the parent node to show refined children
      setExpandedNodes(prev => {
        const newExpanded = new Set(prev);
        newExpanded.add(refinementModal.section?.global_id);
        return newExpanded;
      });

      // Send to backend to persist the node structure
      const updatePayload = {
        node_id: refinementModal.sectionId,
        node_type: refinementModal.nodeType,
        refined_nodes: refinedNodes,
        operation: 'merge_children',  // Changed from 'replace_children' to preserve unselected
        node_selections: newSelections  // Send NEW selections so backend knows what to keep
      };

      const token = localStorage.getItem('token');
      fetch(`${API_URL}/api/tailor/${cvId}/apply-refinement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      }).catch(err => {
        console.error('Failed to persist refinement:', err);
      });

      // Close modal silently - no alert
      closeRefinementModal();

    } catch (error) {
      console.error('Error including refined content:', error);
    }
  };

  // Open auto-refine settings modal
  const openAutoRefineModal = () => {
    setShowAutoRefineModal(true);
  };

  const findNodeById = (nodes, id) => {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNodeById(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Holistic Auto-Refine: ONE pass over the whole selected CV (dedup across
  // sections, merge, unify the summary, tailor, human voice). Returns a proposal
  // the user reviews/edits before applying.
  const handleHolisticRefine = async () => {
    if (!cvData?.content_snapshot?.nodes) return;
    setShowAutoRefineModal(false);
    setRefineLoading(true);
    try {
      await autoSave({ ...nodeSelections }); // refine exactly what's currently selected
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/tailor/${cvId}/refine-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: autoRefineProvider,
          reasoning_effort: autoRefineReasoningEffort,
          human_strict: autoRefineHumanStrict,
          target_pages: autoRefineTargetPages === 'auto' ? null : Number(autoRefineTargetPages),
          instructions: autoRefineInstructions || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auto-refine failed');
      setRefineProposal(data);
      setShowRefineReview(true);
    } catch (e) {
      alert(`Auto-refine failed: ${e.message}`);
    } finally {
      setRefineLoading(false);
    }
  };

  const updateProposalSection = (idx, value) => {
    setRefineProposal((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === idx ? { ...s, refined_markdown: value } : s)),
    }));
  };

  const handleApplyHolistic = async () => {
    if (!refineProposal?.sections?.length) return;
    setRefineApplying(true);
    try {
      let accumulatedSelections = { ...nodeSelections };
      await autoSave(accumulatedSelections);
      // Apply each section through the existing merge path (mutates the shared
      // content_snapshot.nodes, so sequential applies accumulate).
      for (const sec of refineProposal.sections) {
        const node = findNodeById(cvData.content_snapshot.nodes, sec.node_id);
        if (!node || !(sec.refined_markdown || '').trim()) continue;
        accumulatedSelections = await autoIncludeRefinedContent(node, sec.refined_markdown, accumulatedSelections);
      }
      // Optional headline/title edit.
      if (refineProposal.profile_title && refineProposal.profile_title.trim() && cvData.content_snapshot) {
        cvData.content_snapshot.profile_title = refineProposal.profile_title.trim();
      }
      setNodeSelections(accumulatedSelections);
      triggerAutoSave(accumulatedSelections, true);
      await autoSave(accumulatedSelections);
      setShowRefineReview(false);
      setRefineProposal(null);
      await recalculateScores('all'); // re-score the polished CV
    } catch (e) {
      alert(`Apply failed: ${e.message}`);
    } finally {
      setRefineApplying(false);
    }
  };

  // AUTO-REFINE ALL SECTIONS - Automated workflow
  const handleAutoRefineAllSections = async () => {
    // Close the modal
    setShowAutoRefineModal(false);
    if (!cvData?.content_snapshot?.nodes) return;

    // Find all SELECTED section nodes (respect user's selection state)
    const findSelectedSections = (nodes) => {
      const sections = [];
      nodes.forEach(node => {
        if (node.node_type === 'section') {
          // Check if section is selected (not explicitly unselected)
          const isSelected = node.is_selected !== false &&
                           (!node.global_id || nodeSelections[node.global_id] !== false);

          if (isSelected) {
            sections.push(node);
          }
        }
        // Check children for nested sections
        if (node.children) {
          sections.push(...findSelectedSections(node.children));
        }
      });
      return sections;
    };

    const selectedSections = findSelectedSections(cvData.content_snapshot.nodes);

    if (selectedSections.length === 0) {
      alert('No selected sections found to refine.\n\nPlease select at least one section to refine.');
      return;
    }

    setAutoRefining(true);
    setAutoRefineProgress({ current: 0, total: selectedSections.length, currentSection: '' });
    setAutoRefineLog([]);

    const log = [];
    let successCount = 0;
    let errorCount = 0;

    // CRITICAL: Maintain accumulated selections across all sections
    // React state updates are async, so we need to track selections manually
    let accumulatedSelections = { ...nodeSelections };

    try {
      // IMPORTANT: Ensure any pending autosave from manual selections completes FIRST
      // Wait for any ongoing autosave to finish
      if (autoSaveStatus === 'saving') {
        log.push({ status: 'processing', message: 'Waiting for pending save to complete...' });
        setAutoRefineLog([...log]);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Sync current selections to backend BEFORE starting refinement loop
      log.push({ status: 'processing', message: 'Syncing current selections to backend...' });
      setAutoRefineLog([...log]);
      await autoSave(accumulatedSelections);


      for (let i = 0; i < selectedSections.length; i++) {
        const section = selectedSections[i];
        const sectionTitle = section.title || `Section ${i + 1}`;

        setAutoRefineProgress({
          current: i + 1,
          total: selectedSections.length,
          currentSection: sectionTitle
        });

        log.push({ status: 'processing', message: `Refining: ${sectionTitle}...` });
        setAutoRefineLog([...log]);

        try {
          // Step 0: Ensure selections are synced to backend before refining
          // This is critical so the backend knows which children are selected/unselected
          await autoSave(accumulatedSelections);

          // Step 1: Call refinement API (reuse existing endpoint)
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/api/tailor/${cvId}/refine-section`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              node_id: section.id,
              node_type: 'section',
              user_instructions: autoRefineInstructions || null,
              reasoning_effort: autoRefineReasoningEffort,  // Use auto-refine reasoning effort
              rewrite_mode: autoRefineRewriteMode,
              human_strict: autoRefineHumanStrict,
              target_pages: autoRefineTargetPages === 'auto' ? null : Number(autoRefineTargetPages)
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to refine section: ${sectionTitle}`);
          }

          const refinementData = await response.json();

          if (autoRefineHumanStrict && refinementData?.humanity?.requires_confirmation) {
            log.push({
              status: 'error',
              message: `✗ ${sectionTitle}: skipped by Humanity Guard (score ${refinementData.humanity.score})`
            });
            errorCount++;
            setAutoRefineLog([...log]);
            continue;
          }

          // Step 2: Auto-include refined content (mimic handleIncludeRefinedContent)
          if (refinementData?.refined_content) {
            // Pass accumulated selections and get updated selections back
            accumulatedSelections = await autoIncludeRefinedContent(
              section,
              refinementData.refined_content,
              accumulatedSelections
            );

            log.push({ status: 'success', message: `✓ ${sectionTitle} refined successfully` });
            successCount++;

            // Step 3: CRITICAL - Save state and reload from backend
            // This ensures the next section starts with actual persisted state
            log.push({ status: 'processing', message: `Saving state for ${sectionTitle}...` });
            setAutoRefineLog([...log]);

            // Save to backend
            await autoSave(accumulatedSelections);

            // Reload fresh data from backend (without triggering full UI refresh)
            log.push({ status: 'processing', message: `Reloading fresh state...` });
            setAutoRefineLog([...log]);

            // Fetch fresh data directly without calling fetchCVData() to avoid page refresh
            const freshData = await fetch(`${API_URL}/api/tailor/${cvId}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            const freshCvData = await freshData.json();

            // Extract selections from fresh data
            const extractSelections = (nodes) => {
              const selections = {};
              const traverse = (nodeList) => {
                nodeList.forEach(node => {
                  if (node.global_id) {
                    selections[node.global_id] = node.is_selected !== false;
                  }
                  if (node.children) {
                    traverse(node.children);
                  }
                });
              };
              traverse(nodes);
              return selections;
            };

            accumulatedSelections = extractSelections(freshCvData.content_snapshot?.nodes || []);

            log.push({ status: 'success', message: `State synchronized for ${sectionTitle}` });
          } else {
            throw new Error('No refined content returned');
          }

        } catch (error) {
          console.error(`Error refining section ${sectionTitle}:`, error);
          log.push({ status: 'error', message: `✗ ${sectionTitle}: ${error.message}` });
          errorCount++;
        }

        setAutoRefineLog([...log]);

        // Small delay between sections to avoid overwhelming the API
        if (i < selectedSections.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // After all sections, apply the final accumulated selections
      setNodeSelections(accumulatedSelections);
      triggerAutoSave(accumulatedSelections, true);
      await runHumanityCheck({
        ...(cvData?.content_snapshot || {}),
        nodes: updateNodesWithSelections(cvData?.content_snapshot?.nodes || [], accumulatedSelections)
      });

      // Final summary
      log.push({
        status: 'complete',
        message: `\n✓ Completed: ${successCount} succeeded, ${errorCount} failed out of ${selectedSections.length} sections`
      });
      setAutoRefineLog([...log]);

    } catch (error) {
      console.error('Auto-refine error:', error);
      alert(`Auto-refine stopped: ${error.message}`);
    } finally {
      setAutoRefining(false);
      setAutoRefineProgress({ current: 0, total: 0, currentSection: '' });

      // Note: We don't need to fetchCVData() here because:
      // 1. Each autoIncludeRefinedContent() already updates cvData state
      // 2. Each autoIncludeRefinedContent() persists to backend
      // 3. Each autoIncludeRefinedContent() updates nodeSelections
      // 4. Calling fetchCVData() would reset selections from backend snapshot
    }
  };

  // Helper function to auto-include refined content (reuses logic from handleIncludeRefinedContent)
  // NOW ACCEPTS accumulated selections and RETURNS updated selections
  const autoIncludeRefinedContent = async (section, refinedContentMarkdown, currentSelections) => {
    // Convert markdown to nodes
    const refinedNodes = convertMarkdownToNodes(refinedContentMarkdown, 'section');

    if (refinedNodes.length === 0) return currentSelections;

    // Update cvData state
    const updatedCvData = { ...cvData };
    const content_snapshot = { ...updatedCvData.content_snapshot };

    // Reuse the same merge logic
    const mergeRefinedNodes = (refinedNodes, existingSelectedChildren) => {
      return refinedNodes.map(refinedNode => {
        if (refinedNode.node_type === 'entry') {
          const matchingExisting = existingSelectedChildren.find(
            child => child.node_type === 'entry' && child.title === refinedNode.title
          );

          if (matchingExisting) {
            const existingChildrenOfEntry = matchingExisting.children || [];
            const unselectedEntryChildren = [];
            const selectedEntryChildren = [];

            existingChildrenOfEntry.forEach(child => {
              // CRITICAL: Use currentSelections (accumulated/persisted state), not nodeSelections (in-memory state)
              const isUnselected = child.is_selected === false ||
                                 (child.global_id && currentSelections[child.global_id] === false);
              if (isUnselected) {
                unselectedEntryChildren.push(child);
              } else {
                selectedEntryChildren.push(child);
              }
            });

            const mergedChildren = mergeRefinedNodes(
              refinedNode.children || [],
              selectedEntryChildren
            );

            return {
              ...matchingExisting,
              children: [...unselectedEntryChildren, ...mergedChildren],
              ai_refined: true,
              title: refinedNode.title || matchingExisting.title,
              subtitle: refinedNode.subtitle !== undefined ? refinedNode.subtitle : matchingExisting.subtitle,
              location: refinedNode.location !== undefined ? refinedNode.location : matchingExisting.location,
              start_date: refinedNode.start_date !== undefined ? refinedNode.start_date : matchingExisting.start_date,
              end_date: refinedNode.end_date !== undefined ? refinedNode.end_date : matchingExisting.end_date,
              content: refinedNode.content !== undefined ? refinedNode.content : matchingExisting.content
            };
          }
        }
        return refinedNode;
      });
    };

    const updateNodeChildren = (nodes, targetId) => {
      for (let node of nodes) {
        if (node.id === targetId) {
          const existingChildren = node.children || [];
          const unselectedChildren = [];
          const selectedChildren = [];

          existingChildren.forEach(child => {
            // CRITICAL: Use currentSelections (accumulated/persisted state), not nodeSelections (in-memory state)
            const isUnselected = child.is_selected === false ||
                               (child.global_id && currentSelections[child.global_id] === false);
            if (isUnselected) {
              unselectedChildren.push(child);
            } else {
              selectedChildren.push(child);
            }
          });

          const mergedRefinedNodes = mergeRefinedNodes(refinedNodes, selectedChildren);
          node.children = [...unselectedChildren, ...mergedRefinedNodes];
          return true;
        }
        if (node.children && node.children.length > 0) {
          if (updateNodeChildren(node.children, targetId)) {
            return true;
          }
        }
      }
      return false;
    };

    updateNodeChildren(content_snapshot.nodes, section.id);
    updatedCvData.content_snapshot = content_snapshot;
    setCvData(updatedCvData);

    // Sync selections from node tree to selection state
    // CRITICAL: Do NOT force all nodes to selected=true!
    // Instead, preserve each node's is_selected property
    // Only newly refined nodes (with is_selected=true from convertMarkdownToNodes) should be selected
    const newSelections = { ...currentSelections };

    // Find the updated section and sync its descendants' is_selected to newSelections
    const findAndSyncSection = (nodes) => {
      for (const node of nodes) {
        if (node.id === section.id) {
          // Found the section - now sync all children's is_selected to newSelections
          const syncDescendantSelections = (n) => {
            if (n.global_id) {
              // CRITICAL: Use the node's is_selected property, don't force to true
              // Unselected nodes should stay unselected, refined nodes have is_selected=true
              newSelections[n.global_id] = n.is_selected !== false;
            }
            if (n.children && n.children.length > 0) {
              n.children.forEach(child => syncDescendantSelections(child));
            }
          };

          // Sync the section itself
          if (node.global_id) {
            newSelections[node.global_id] = node.is_selected !== false;
          }
          // Sync all children
          if (node.children && node.children.length > 0) {
            node.children.forEach(child => syncDescendantSelections(child));
          }
          return true;
        }

        // Recursively search children
        if (node.children && node.children.length > 0) {
          if (findAndSyncSection(node.children)) {
            return true;
          }
        }
      }
      return false;
    };

    findAndSyncSection(content_snapshot.nodes);

    // Update React state for UI (but this is async, so we also return the selections)
    setNodeSelections(newSelections);

    // Trigger autosave with the updated selections
    triggerAutoSave(newSelections, true);

    // CRITICAL: Return the updated selections so the next section can build on them
    return newSelections;
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
      // If node is in selections, use that value; otherwise default to true (selected)
      is_selected: node.global_id && selections.hasOwnProperty(node.global_id)
        ? selections[node.global_id]
        : (node.is_selected !== false), // Preserve existing is_selected if not in selections
      children: node.children ? updateNodesWithSelections(node.children, selections) : []
    }));
  };

  const buildCurrentSnapshot = () => {
    if (!cvData?.content_snapshot) return null;
    return {
      ...cvData.content_snapshot,
      nodes: updateNodesWithSelections(cvData.content_snapshot.nodes || [], nodeSelections)
    };
  };

  const startUpdateStatus = (title, steps) => {
    setUpdateStatus({
      mode: 'running',
      title,
      steps,
      error: ''
    });
  };

  const setUpdateStepStatus = (stepId, status, detail = null) => {
    setUpdateStatus(prev => ({
      ...prev,
      steps: prev.steps.map(step => (
        step.id === stepId
          ? {
              ...step,
              status,
              detail: detail !== null ? detail : step.detail
            }
          : step
      ))
    }));
  };

  const completeUpdateStatus = (success, errorMessage = '') => {
    setUpdateStatus(prev => ({
      ...prev,
      mode: success ? 'success' : 'error',
      error: errorMessage
    }));
  };

  const waitForAutoSaveIfNeeded = async () => {
    if (autoSaveStatus !== 'saving') return;
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const runHumanityCheck = async (snapshotOverride = null, mode = 'quick') => {
    if (!cvId) return null;
    setCheckingHumanity(true);
    try {
      const token = localStorage.getItem('token');
      const payload = snapshotOverride ? { content_snapshot: snapshotOverride, mode } : { mode };
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/humanity-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to run humanity check');
      }

      const data = await response.json();
      setHumanityReport(data.humanity || null);
      return data.humanity || null;
    } catch (error) {
      console.error('Humanity check failed:', error);
      return null;
    } finally {
      setCheckingHumanity(false);
    }
  };

  const buildScoreStatusDetail = (recalculation) => {
    const openai = recalculation?.fit_scores?.openai;
    const claude = recalculation?.fit_scores?.claude;
    const openaiModel = normalizeModelId(openai, 'openai');
    const claudeModel = normalizeModelId(claude, 'claude');
    const openaiFit = openai?.scores?.fit_score ?? '-';
    const openaiAts = openai?.scores?.ats_score ?? '-';
    const claudeFit = claude?.scores?.fit_score ?? '-';
    const claudeAts = claude?.scores?.ats_score ?? '-';
    return `OpenAI (${openaiModel}) Fit ${openaiFit} / ATS ${openaiAts} • Claude (${claudeModel}) Fit ${claudeFit} / ATS ${claudeAts}`;
  };

  const recalculateScores = async (mode = 'all') => {
    const includeHumanity = mode === 'all';
    const actionLabel = includeHumanity ? 'Updating all AI scores' : 'Updating ATS + Profile Fit scores';

    setRecalculating(true);
    startUpdateStatus(actionLabel, [
      {
        id: 'sync',
        label: 'Sync selected content',
        detail: 'Making sure latest node selections are saved.',
        status: 'running'
      },
      {
        id: 'scores',
        label: 'ATS + Profile Fit',
        detail: 'Running OpenAI and Claude scoring in parallel.',
        status: 'pending'
      },
      ...(includeHumanity ? [{
        id: 'humanity',
        label: 'Humanity Guard',
        detail: 'Running deep humanity evaluation.',
        status: 'pending'
      }] : []),
      {
        id: 'done',
        label: 'Finalize',
        detail: 'Preparing updated dashboard values.',
        status: 'pending'
      }
    ]);

    try {
      await waitForAutoSaveIfNeeded();
      setUpdateStepStatus('sync', 'done', 'Selections synced.');
      setUpdateStepStatus('scores', 'running');

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
          content_snapshot: updatedSnapshot,
          include_humanity: includeHumanity
        })
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate scores');
      }

      const result = await response.json();

      setCvData(prev => ({
        ...prev,
        recalculated_scores: [
          ...(prev.recalculated_scores || []),
          result.recalculation
        ]
      }));
      setUpdateStepStatus('scores', 'done', buildScoreStatusDetail(result.recalculation));

      if (includeHumanity) {
        setUpdateStepStatus('humanity', 'running');
        if (result.humanity) {
          setHumanityReport(result.humanity);
          const llmModel = result.humanity?.llm_review?.model
            ? ` • LLM ${result.humanity.llm_review.model}`
            : '';
          setUpdateStepStatus(
            'humanity',
            'done',
            `Score ${result.humanity?.score ?? '-'} (${result.humanity?.risk_level || 'unknown'})${llmModel}`
          );
        } else {
          const fallbackHumanity = await runHumanityCheck(updatedSnapshot, 'deep');
          if (!fallbackHumanity) {
            throw new Error('Humanity check failed after score update');
          }
          setUpdateStepStatus(
            'humanity',
            'done',
            `Score ${fallbackHumanity.score ?? '-'} (${fallbackHumanity.risk_level || 'unknown'})`
          );
        }
      }

      setUpdateStepStatus('done', 'done', 'All requested updates completed.');
      completeUpdateStatus(true);
    } catch (err) {
      console.error('Error recalculating scores:', err);
      setUpdateStatus(prev => ({
        ...prev,
        steps: prev.steps.map(step => (
          step.status === 'running'
            ? { ...step, status: 'error', detail: err.message || 'Failed' }
            : step
        ))
      }));
      completeUpdateStatus(false, err.message || 'Update failed');
      alert('Failed to recalculate scores: ' + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const refreshHumanityOnly = async () => {
    startUpdateStatus('Updating Humanity Guard only', [
      {
        id: 'sync',
        label: 'Sync selected content',
        detail: 'Making sure latest node selections are saved.',
        status: 'running'
      },
      {
        id: 'humanity',
        label: 'Humanity Guard',
        detail: 'Running deep humanity evaluation.',
        status: 'pending'
      },
      {
        id: 'done',
        label: 'Finalize',
        detail: 'Refreshing humanity card.',
        status: 'pending'
      }
    ]);

    try {
      await waitForAutoSaveIfNeeded();
      setUpdateStepStatus('sync', 'done', 'Selections synced.');
      setUpdateStepStatus('humanity', 'running');

      const snapshot = buildCurrentSnapshot();
      const humanity = await runHumanityCheck(snapshot, 'deep');
      if (!humanity) {
        throw new Error('Failed to update humanity guard');
      }

      const llmModel = humanity?.llm_review?.model ? ` • LLM ${humanity.llm_review.model}` : '';
      setUpdateStepStatus(
        'humanity',
        'done',
        `Score ${humanity.score ?? '-'} (${humanity.risk_level || 'unknown'})${llmModel}`
      );
      setUpdateStepStatus('done', 'done', 'Humanity guard updated.');
      completeUpdateStatus(true);
    } catch (err) {
      console.error('Error updating humanity guard:', err);
      setUpdateStatus(prev => ({
        ...prev,
        steps: prev.steps.map(step => (
          step.status === 'running'
            ? { ...step, status: 'error', detail: err.message || 'Failed' }
            : step
        ))
      }));
      completeUpdateStatus(false, err.message || 'Humanity update failed');
      alert('Failed to update humanity guard: ' + err.message);
    }
  };

  // Restore CV to original state (before any refinements or edits)
  const restoreOriginal = async () => {
    const confirmed = window.confirm(
      '⚠️ Restore to Original?\n\n' +
      'This will remove ALL refinements and edits, returning this CV to its original state when first saved.\n\n' +
      'This action cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    setRestoring(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/tailor/${cvId}/restore-original`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to restore original');
      }

      const result = await response.json();

      // Update local state with restored data
      setCvData(prev => ({
        ...prev,
        content_snapshot: result.content_snapshot,
        selected_node_ids: result.selected_node_ids,
        updated_at: result.updated_at
      }));

      // Rebuild nodeSelections from restored snapshot
      const restoredSelections = {};
      const buildSelections = (nodes) => {
        nodes.forEach(node => {
          if (node.global_id) {
            restoredSelections[node.global_id] = node.is_selected || false;
          }
          if (node.children) {
            buildSelections(node.children);
          }
        });
      };
      buildSelections(result.content_snapshot.nodes);
      setNodeSelections(restoredSelections);
      await runHumanityCheck(result.content_snapshot);

      alert('✅ CV restored to original state successfully!');
    } catch (err) {
      console.error('Error restoring original:', err);
      alert('Failed to restore original: ' + err.message);
    } finally {
      setRestoring(false);
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
          customizations: customizations,
          force_export: true
        })
      });

      if (!response.ok) {
        let detail = 'Failed to generate PDF preview';
        try {
          const errorData = await response.json();
          const guardDetail = errorData?.detail;
          if (guardDetail?.humanity?.requires_confirmation) {
            detail = 'Export blocked by Humanity Guard. Confirm override and try again.';
          }
          if (typeof guardDetail === 'string') {
            detail = guardDetail;
          } else {
            detail = guardDetail?.message || detail;
          }
        } catch {
          // keep fallback
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Prefer backend-provided filename from Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = buildDefaultCvFilename();
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
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
        },
        body: JSON.stringify({
          force_export: true
        })
      });

      if (!response.ok) {
        let detail = 'Failed to export PDF';
        try {
          const error = await response.json();
          const guardDetail = error?.detail;
          if (guardDetail?.humanity?.requires_confirmation) {
            detail = 'Export blocked by Humanity Guard. Confirm override and try again.';
          }
          if (typeof guardDetail === 'string') {
            detail = guardDetail;
          } else {
            detail = guardDetail?.message || detail;
          }
        } catch {
          // keep default detail
        }
        throw new Error(detail);
      }

      // Download the PDF file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = buildDefaultCvFilename();
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
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
    const allowedChildTypes = getAllowedChildTypes(level);
    const canAddChild =
      ['section', 'entry', 'bullet'].includes(node.node_type) &&
      allowedChildTypes.length > 0;
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

          {/* AI-Refined Indicator */}
          {node.ai_refined && (
            <span className="ai-refined-badge" title="AI-refined content">
              ✨
            </span>
          )}

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
                      title={`OpenAI: ${(aiRecs.openai.confidence * 100).toFixed(0)}% - ${aiRecs.openai.reason}`}
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

              {/* Add Child Button */}
              {canAddChild && (
                <button
                  className="add-node-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddNodeModal(node, level);
                  }}
                  title={`Add ${allowedChildTypes.join(' / ')} under this item`}
                >
                  +
                </button>
              )}

              {/* Refine Button - Distinctive icons for sections vs entries */}
              {node.node_type === 'section' && (
                <button
                  className="refine-section-btn refine-section-level"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefineSection(node);
                  }}
                  title="OpenAI Thinking Mode: Comprehensively refine this entire section by merging redundant items, tightening wording, and optimizing for the job description"
                  data-refine-label="OpenAI SECTION"
                >
                  <svg className="ai-icon-section" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                    <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
                    <path d="M12 7V9M12 15V17M7 12H9M15 12H17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              {node.node_type === 'entry' && (
                <button
                  className="refine-section-btn refine-entry-level"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefineSection(node);
                  }}
                  title="OpenAI Thinking Mode: Precisely refine this entry by tightening wording and optimizing for the job description"
                  data-refine-label="OpenAI ENTRY"
                >
                  <svg className="ai-icon-entry" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L13.5 7.5L19 9L13.5 10.5L12 16L10.5 10.5L5 9L10.5 7.5L12 2Z" fill="currentColor"/>
                    <path d="M18 14L19 17L22 18L19 19L18 22L17 19L14 18L17 17L18 14Z" fill="currentColor" opacity="0.7"/>
                    <path d="M6 14L7 17L10 18L7 19L6 22L5 19L2 18L5 17L6 14Z" fill="currentColor" opacity="0.7"/>
                  </svg>
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
          <p>No job analysis available from {modelName === 'openai' ? 'OpenAI' : 'Claude'}</p>
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
            {(modelName === 'openai' ? '🤖 ' : '🧠 ') + normalizeModelId(modelData, modelName)}
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

  const latestRecalculation =
    cvData.recalculated_scores && cvData.recalculated_scores.length > 0
      ? cvData.recalculated_scores[cvData.recalculated_scores.length - 1]
      : null;

  const normalizeModelId = (payload, provider) => {
    const rawModel =
      payload?.runtime?.resolved_model ||
      payload?.runtime?.requested_model ||
      payload?.model ||
      '';
    if (!rawModel) return provider === 'openai' ? 'OpenAI' : 'Claude';
    return String(rawModel).replace(/^openai-/, '').replace(/^anthropic-/, '');
  };

  async function fetchUserInstructionTemplates() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/user/ai-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return;
      const data = await response.json();
      setUserInstructionTemplates(normalizeInstructionTemplates(data.refinement_instruction_templates));
    } catch (error) {
      console.error('Error fetching instruction templates:', error);
    }
  }

  async function saveUserInstructionTemplates(templates) {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const response = await fetch(`${API_URL}/api/user/ai-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refinement_instruction_templates: templates
      })
    });

    if (!response.ok) return false;
    const data = await response.json();
    setUserInstructionTemplates(normalizeInstructionTemplates(data.refinement_instruction_templates || templates));
    return true;
  }

  const getModelLabel = (payload, provider) => {
    // Show the actual model id that ran (no hardcoded brand names).
    return normalizeModelId(payload, provider);
  };

  const initialOpenAIModelLabel = getModelLabel(cvData.fit_scores?.openai, 'openai');
  const initialClaudeModelLabel = getModelLabel(cvData.fit_scores?.claude, 'claude');
  const recalcOpenAIModelLabel = getModelLabel(latestRecalculation?.fit_scores?.openai, 'openai');
  const recalcClaudeModelLabel = getModelLabel(latestRecalculation?.fit_scores?.claude, 'claude');
  const scoreUpdateOpenAIModelLabel = latestRecalculation ? recalcOpenAIModelLabel : initialOpenAIModelLabel;
  const scoreUpdateClaudeModelLabel = latestRecalculation ? recalcClaudeModelLabel : initialClaudeModelLabel;
  const humanityScore = humanityReport?.score;
  const humanityRisk = humanityReport?.risk_level || 'unknown';
  const humanityNeedsConfirm = Boolean(humanityReport?.requires_confirmation);
  const humanityHasLLM = humanityReport?.components?.llm_score !== null && humanityReport?.components?.llm_score !== undefined;
  const humanityTopIssues = Array.isArray(humanityReport?.violations) ? humanityReport.violations.slice(0, 5) : [];
  const humanitySeverityCounts = (Array.isArray(humanityReport?.violations) ? humanityReport.violations : []).reduce((acc, issue) => {
    const severity = String(issue?.severity || 'medium').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(acc, severity)) {
      acc[severity] += 1;
    }
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
  const humanityScoreFormula = humanityHasLLM
    ? 'Score = 45% heuristic + 20% stylometric + 35% LLM critic'
    : 'Score = 70% heuristic + 30% stylometric';
  const getIssueWhereList = (issue) => {
    if (!issue) return [];
    const raw = issue.where;
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const line = item.line ? `Line ${item.line}: ` : '';
            const text = String(item.text || '').trim();
            return `${line}${text}`.trim();
          }
          return '';
        })
        .filter(Boolean)
        .slice(0, 3);
    }
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  };
  const getIssueFixList = (issue) => {
    if (!issue) return [];
    const raw = issue.how_to_fix;
    if (Array.isArray(raw)) {
      return raw
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  };
  const addNodeAllowedTypes = getAllowedChildTypes(addNodeModal.parentLevel);

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

          {/* Auto-Refine All Sections Button */}
          <button
            onClick={openAutoRefineModal}
            className="btn-auto-refine-modern"
            disabled={autoRefining || autoSaveStatus === 'saving'}
            title="Automatically refine all sections using OpenAI Thinking Mode"
          >
            {autoRefining ? (
              <>
                <div className="btn-spinner"></div>
                <span>Auto-Refining...</span>
              </>
            ) : (
              <>
                <svg className="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                  <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
                </svg>
                <span>Auto-Refine All</span>
              </>
            )}
          </button>

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

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-title">Humanity Guard</div>
              <span className="metric-icon">🧠</span>
            </div>
            <div className="metric-body">
              <div className={`metric-score-badge ${
                humanityScore >= 85 ? 'excellent' :
                humanityScore >= 70 ? 'good' :
                humanityScore >= 50 ? 'fair' : 'poor'
              }`}>
                {checkingHumanity ? '...' : (humanityScore !== undefined && humanityScore !== null ? `${humanityScore}%` : '-')}
              </div>
              <div className="metric-label">
                {humanityRisk === 'low' ? 'Low risk' :
                 humanityRisk === 'medium' ? 'Medium risk' :
                 humanityRisk === 'high' ? 'High risk' : 'Awaiting check'}
              </div>
            </div>
            <div className="metric-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Violations</span>
                <span className="breakdown-value">{humanityReport?.total_violations ?? '-'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Critical</span>
                <span className="breakdown-value">{humanityReport?.critical_violations ?? '-'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Mode</span>
                <span className="breakdown-value">{humanityReport?.mode || '-'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Heuristic</span>
                <span className="breakdown-value">{humanityReport?.components?.heuristic_score ?? '-'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Style</span>
                <span className="breakdown-value">{humanityReport?.components?.stylometric_score ?? '-'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">LLM</span>
                <span className="breakdown-value">{humanityReport?.components?.llm_score ?? '-'}</span>
              </div>
            </div>
            <button
              type="button"
              className="humanity-toggle-btn"
              onClick={() => setShowHumanityDetails(prev => !prev)}
            >
              {showHumanityDetails ? 'Hide score details' : 'Show score details'}
            </button>
            {showHumanityDetails && (
              <div className="humanity-details">
                <div className="humanity-meta-row">
                  <span className="humanity-meta-label">How calculated</span>
                  <span className="humanity-meta-value">{humanityScoreFormula}</span>
                </div>
                <div className="humanity-meta-row">
                  <span className="humanity-meta-label">Runtime</span>
                  <span className="humanity-meta-value">
                    Mode: {humanityReport?.mode || '-'} | Threshold: {humanityReport?.threshold ?? '-'} | Chars: {humanityReport?.character_count ?? '-'}
                  </span>
                </div>
                <div className="humanity-meta-row">
                  <span className="humanity-meta-label">Severities</span>
                  <span className="humanity-meta-value">
                    Critical: {humanitySeverityCounts.critical} | High: {humanitySeverityCounts.high} | Medium: {humanitySeverityCounts.medium} | Low: {humanitySeverityCounts.low}
                  </span>
                </div>
                {humanityReport?.llm_review?.model && (
                  <div className="humanity-meta-row">
                    <span className="humanity-meta-label">LLM critic</span>
                    <span className="humanity-meta-value">{humanityReport.llm_review.model}</span>
                  </div>
                )}
                <div className="humanity-issues">
                  <div className="humanity-issues-title">Top reasons</div>
                  {humanityTopIssues.length > 0 ? (
                    humanityTopIssues.map((issue, idx) => {
                      const whereList = getIssueWhereList(issue);
                      const fixList = getIssueFixList(issue);
                      return (
                        <div className="humanity-issue-item" key={`humanity-issue-${idx}`}>
                          <div className="humanity-issue-header">
                            <span className={`humanity-issue-severity ${String(issue?.severity || 'medium').toLowerCase()}`}>
                              {String(issue?.severity || 'medium').toUpperCase()}
                            </span>
                            {issue?.type && (
                              <span className="humanity-issue-type">{String(issue.type)}</span>
                            )}
                          </div>
                          <div className="humanity-issue-message">{issue.message}</div>
                          {whereList.length > 0 && (
                            <div className="humanity-issue-subblock">
                              <div className="humanity-issue-subtitle">Where found</div>
                              {whereList.map((item, whereIdx) => (
                                <div className="humanity-issue-subitem" key={`where-${idx}-${whereIdx}`}>• {item}</div>
                              ))}
                            </div>
                          )}
                          {fixList.length > 0 && (
                            <div className="humanity-issue-subblock">
                              <div className="humanity-issue-subtitle">How to fix</div>
                              {fixList.map((item, fixIdx) => (
                                <div className="humanity-issue-subitem" key={`fix-${idx}-${fixIdx}`}>• {item}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="humanity-issue-item muted">No major flags detected.</div>
                  )}
                </div>
              </div>
            )}
            <div className="metric-subtitle">
              {humanityNeedsConfirm
                ? 'Export requires confirmation due to high-risk wording.'
                : 'Human-written tone check passed or low risk.'}
            </div>
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
                    <div className="ai-model-label openai">🤖 {initialOpenAIModelLabel}</div>
                    <div className="ai-score-value">{cvData.fit_scores.openai.scores.fit_score}</div>
                  </div>
                )}
                {cvData.fit_scores?.claude?.scores?.fit_score !== null && cvData.fit_scores?.claude?.scores?.fit_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label claude">🧠 {initialClaudeModelLabel}</div>
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
                      <div className="ai-model-label openai">🤖 {recalcOpenAIModelLabel}</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores.openai.scores.fit_score}</div>
                    </div>
                  )}
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].fit_scores?.claude?.scores?.fit_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label claude">🧠 {recalcClaudeModelLabel}</div>
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
                    <div className="ai-model-label openai">🤖 {initialOpenAIModelLabel}</div>
                    <div className="ai-score-value">{cvData.ats_scores.openai.scores.ats_score}</div>
                  </div>
                )}
                {cvData.ats_scores?.claude?.scores?.ats_score !== null && cvData.ats_scores?.claude?.scores?.ats_score !== undefined && (
                  <div className="ai-score-item">
                    <div className="ai-model-label claude">🧠 {initialClaudeModelLabel}</div>
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
                      <div className="ai-model-label openai">🤖 {recalcOpenAIModelLabel}</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores.openai.scores.ats_score}</div>
                    </div>
                  )}
                  {cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores?.claude?.scores?.ats_score !== null && (
                    <div className="ai-score-item">
                      <div className="ai-model-label claude">🧠 {recalcClaudeModelLabel}</div>
                      <div className="ai-score-value">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].ats_scores.claude.scores.ats_score}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="metric-subtitle">Applicant Tracking System readiness</div>
          </div>

          {/* Update AI Scores & Restore Card */}
          <div className="metric-card reevaluate-card">
            <div className="metric-header">
              <div className="metric-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '0.5rem' }}>
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Update AI Scores & Restore
              </div>
            </div>
            <div className="metric-body">
              <p className="reevaluate-description">
                Re-run all scores, just ATS/Profile Fit, or Humanity Guard only.
              </p>
              <div className="reevaluate-actions-grid">
                <button
                  onClick={() => recalculateScores('all')}
                  className="btn-reevaluate-full"
                  disabled={recalculating || checkingHumanity || restoring}
                >
                  {recalculating ? (
                    <>
                      <span className="spinner-medium"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                      Update All Scores
                    </>
                  )}
                </button>

                <button
                  onClick={() => recalculateScores('scores')}
                  className="btn-reevaluate-secondary"
                  disabled={recalculating || checkingHumanity || restoring}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="10"></line>
                    <line x1="18" y1="20" x2="18" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="16"></line>
                  </svg>
                  Update ATS + Fit
                </button>

                <button
                  onClick={refreshHumanityOnly}
                  className="btn-reevaluate-secondary"
                  disabled={recalculating || checkingHumanity || restoring}
                >
                  {checkingHumanity ? <span className="spinner-medium"></span> : <span>🧠</span>}
                  Update Humanity Guard
                </button>

                {cvData.original_snapshot && (
                  <button
                    onClick={restoreOriginal}
                    className="btn-restore-original"
                    disabled={restoring || recalculating || checkingHumanity}
                  >
                    {restoring ? (
                      <>
                        <span className="spinner-medium"></span>
                        Restoring...
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        Restore Original
                      </>
                    )}
                  </button>
                )}
              </div>

              {updateStatus.mode !== 'idle' && (
                <div className={`update-status-card ${updateStatus.mode}`}>
                  <div className="update-status-header">
                    <span className="update-status-title">{updateStatus.title}</span>
                    <span className={`update-status-pill ${updateStatus.mode}`}>
                      {updateStatus.mode === 'running' ? 'Running' : updateStatus.mode === 'success' ? 'Completed' : 'Failed'}
                    </span>
                  </div>
                  <div className="update-status-steps">
                    {updateStatus.steps.map((step) => (
                      <div key={step.id} className={`update-step ${step.status}`}>
                        <span className="update-step-icon">
                          {step.status === 'done' && '✓'}
                          {step.status === 'running' && <span className="status-spinner"></span>}
                          {step.status === 'error' && '!'}
                          {step.status === 'pending' && '•'}
                        </span>
                        <div className="update-step-content">
                          <div className="update-step-label">{step.label}</div>
                          {step.detail && <div className="update-step-detail">{step.detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {updateStatus.mode === 'error' && updateStatus.error && (
                    <div className="update-status-error">{updateStatus.error}</div>
                  )}
                </div>
              )}

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
                        <strong>🤖 OpenAI ({recalcOpenAIModelLabel}) Prompt:</strong>
                        <pre className="prompt-code-compact">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].prompts.openai.user_prompt}</pre>
                      </div>
                      <div className="prompt-compact-item">
                        <strong>🧠 Claude ({recalcClaudeModelLabel}) Prompt:</strong>
                        <pre className="prompt-code-compact">{cvData.recalculated_scores[cvData.recalculated_scores.length - 1].prompts.claude.user_prompt}</pre>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="metric-subtitle">⏱️ Score updates use {scoreUpdateOpenAIModelLabel} + {scoreUpdateClaudeModelLabel}. Humanity uses your AI Settings runtime.</div>
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
                  <span className="model-name">OpenAI</span>
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
                OpenAI Analysis
              </button>
              <button
                className={`preview-tab ${previewTab === 'claude' ? 'active' : ''}`}
                onClick={() => setPreviewTab('claude')}
              >
                <span className="tab-icon">🧠</span>
                Claude Analysis
              </button>

              {/* Page Count Badge in Tabs */}
              {livePreviewMetadata && !loadingPreviewMetadata && (
                <div
                  className="page-count-badge-tab"
                  title={`📄 ${livePreviewMetadata.page_count} ${livePreviewMetadata.page_count === 1 ? 'page' : 'pages'}
📝 ${livePreviewMetadata.word_count} words
📊 ${livePreviewMetadata.section_count} sections

🎨 Template: ${livePreviewTemplate === 'ats_optimized' ? 'ATS Optimized' : livePreviewTemplate.charAt(0).toUpperCase() + livePreviewTemplate.slice(1)}
🔤 Font: ${livePreviewCustomizations.fontSize.charAt(0).toUpperCase() + livePreviewCustomizations.fontSize.slice(1)}
📏 Spacing: ${livePreviewCustomizations.spacing.charAt(0).toUpperCase() + livePreviewCustomizations.spacing.slice(1)}`}
                >
                  📄 <strong>{livePreviewMetadata.page_count}</strong> {livePreviewMetadata.page_count === 1 ? 'pg' : 'pages'}
                </div>
              )}
              {loadingPreviewMetadata && (
                <div className="page-count-badge-tab loading">
                  <div className="spinner-tiny"></div>
                </div>
              )}
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
              <h2>✨ AI Refinement: {refinementModal.section?.title || (refinementModal.nodeType === 'entry' ? 'Entry' : 'Section')}</h2>
              <div className="gpt-badge">
                <span className="gpt-icon">{refineProvider === 'claude' ? '🧠' : '🤖'}</span>
                <span className="gpt-text">{refineProvider === 'claude' ? 'Claude' : 'OpenAI'}</span>
              </div>
            </div>
            <button className="sidepanel-close" onClick={closeRefinementModal}>×</button>
          </div>

          <div className="sidepanel-body">
              {/* Model picker */}
              <div className="reasoning-effort-selector">
                <label><strong>Model</strong></label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button type="button" disabled={refining} onClick={() => setRefineProvider('openai')}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: refineProvider === 'openai' ? '2px solid #10a37f' : '1px solid #d1d5db',
                      background: refineProvider === 'openai' ? '#ecfdf5' : '#fff' }}>🤖 OpenAI</button>
                  <button type="button" disabled={refining} onClick={() => setRefineProvider('claude')}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: refineProvider === 'claude' ? '2px solid #d97757' : '1px solid #d1d5db',
                      background: refineProvider === 'claude' ? '#fff3ed' : '#fff' }}>🧠 Claude</button>
                </div>
              </div>

              {/* Reasoning Effort Selector (OpenAI only) */}
              <div className="reasoning-effort-selector">
                <label htmlFor="reasoning-effort">
                  <span className="reasoning-label-icon">🧠</span>
                  <strong>AI Reasoning Mode</strong>
                </label>
                <div className="reasoning-help-text">
                  {refineProvider === 'claude'
                    ? 'Not used for Claude (Claude does not take a reasoning-effort setting).'
                    : 'Control how deeply OpenAI thinks before responding'}
                </div>
                <select
                  id="reasoning-effort"
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value)}
                  disabled={refining || refineProvider === 'claude'}
                  className="reasoning-effort-dropdown"
                >
                  <option value="none">⚡ None - Fastest (No reasoning)</option>
                  <option value="low">🔸 Low - Quick reasoning</option>
                  <option value="medium">⭐ Medium - Balanced (Recommended)</option>
                  <option value="high">💎 High - Deep thinking</option>
                </select>
              </div>

              <div className="reasoning-effort-selector">
                <label htmlFor="rewrite-mode">
                  <strong>Rewrite Mode</strong>
                </label>
                <div className="reasoning-help-text">
                  Minimal keeps original voice and tightens wording; Standard allows broader rewrites.
                </div>
                <select
                  id="rewrite-mode"
                  value={rewriteMode}
                  onChange={(e) => setRewriteMode(e.target.value)}
                  disabled={refining}
                  className="reasoning-effort-dropdown"
                >
                  <option value="minimal">Minimal (Recommended)</option>
                  <option value="standard">Standard</option>
                </select>
              </div>

              <div className="reasoning-effort-selector">
                <label htmlFor="target-pages">
                  <strong>Target CV Length</strong>
                </label>
                <select
                  id="target-pages"
                  value={targetPages}
                  onChange={(e) => setTargetPages(e.target.value)}
                  disabled={refining}
                  className="reasoning-effort-dropdown"
                >
                  <option value="auto">Auto</option>
                  <option value="1">1 Page</option>
                  <option value="2">2 Pages</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={humanStrictMode}
                    onChange={(e) => setHumanStrictMode(e.target.checked)}
                    disabled={refining}
                  />
                  <span>Strict Human-Written Guard</span>
                </label>
              </div>

              {/* Instructions Input */}
              <div className="refinement-instructions">
                <label htmlFor="user-instructions">
                  Additional Instructions (Optional)
                </label>

                {/* Quick Suggestion Chips - Targeted Instructions */}
                <div className="template-library">
                  <div className="template-library-header">
                    <h5>Quick Templates</h5>
                    <span>Click to append</span>
                  </div>
                  <div className="instruction-chips template-chip-grid">
                    {baseInstructionTemplates.map((chip, idx) => (
                      <button
                        key={`base-${idx}`}
                        className="instruction-chip"
                        onClick={() => setUserInstructions(prev => prev ? `${prev}\n\n${chip.instruction}` : chip.instruction)}
                        disabled={refining}
                        title={chip.instruction}
                      >
                        + {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="template-library">
                  <div className="template-library-header">
                    <h5>My Templates</h5>
                    <span>{userInstructionTemplates.length}/12</span>
                  </div>

                  {userInstructionTemplates.length === 0 ? (
                    <div className="template-empty-state">
                      No personal templates yet. Add one below to reuse your style quickly.
                    </div>
                  ) : (
                    <div className="template-card-list">
                      {userInstructionTemplates.map((template, idx) => (
                        <div key={`user-${idx}`} className="template-card">
                          <div className="template-card-header">
                            <button
                              className="template-card-label"
                              onClick={() =>
                                setUserInstructions((prev) =>
                                  prev ? `${prev}\n\n${template.instruction}` : template.instruction
                                )
                              }
                              disabled={refining}
                              title={template.instruction}
                            >
                              + {template.label}
                            </button>
                            <div className="template-card-actions">
                              <button
                                className="template-icon-btn"
                                onClick={() => startEditInstructionTemplate(idx)}
                                disabled={refining || savingInstructionTemplate}
                                title={`Edit: ${template.label}`}
                                aria-label={`Edit ${template.label}`}
                              >
                                ✎
                              </button>
                              <button
                                className="template-icon-btn danger"
                                onClick={() => handleRemoveInstructionTemplate(idx)}
                                disabled={refining || savingInstructionTemplate}
                                title={`Delete: ${template.label}`}
                                aria-label={`Delete ${template.label}`}
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          <p className="template-card-text">{template.instruction}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="template-editor">
                  <button
                    type="button"
                    className="template-editor-toggle"
                    onClick={() => {
                      if (isTemplateEditorExpanded && editingTemplateIndex !== null) {
                        cancelEditInstructionTemplate();
                      }
                      setIsTemplateEditorExpanded((prev) => !prev);
                    }}
                  >
                    <span>{isTemplateEditorExpanded ? 'Hide Personal Template Editor' : 'Add Personal Template'}</span>
                    <span>{isTemplateEditorExpanded ? '▴' : '▾'}</span>
                  </button>

                  {isTemplateEditorExpanded && (
                    <>
                      <div className="template-library-header">
                        <h5>{editingTemplateIndex === null ? 'Add Personal Template' : 'Edit Personal Template'}</h5>
                        <span>Stored in your account</span>
                      </div>

                      <input
                        type="text"
                        className="template-editor-input"
                        placeholder="Template label (e.g., Leadership Heavy)"
                        value={editingTemplateIndex === null ? newInstructionTemplateLabel : editingTemplateLabel}
                        onChange={(e) =>
                          editingTemplateIndex === null
                            ? setNewInstructionTemplateLabel(e.target.value)
                            : setEditingTemplateLabel(e.target.value)
                        }
                        disabled={refining || savingInstructionTemplate}
                        maxLength={40}
                      />

                      <textarea
                        className="template-editor-textarea"
                        placeholder="Write your reusable instruction template..."
                        value={editingTemplateIndex === null ? newInstructionTemplate : editingTemplateInstruction}
                        onChange={(e) =>
                          editingTemplateIndex === null
                            ? setNewInstructionTemplate(e.target.value)
                            : setEditingTemplateInstruction(e.target.value)
                        }
                        disabled={refining || savingInstructionTemplate}
                        maxLength={400}
                        rows={4}
                      />

                      <div className="template-editor-actions">
                        {editingTemplateIndex !== null && (
                          <button
                            type="button"
                            className="template-secondary-btn"
                            onClick={cancelEditInstructionTemplate}
                            disabled={refining || savingInstructionTemplate}
                          >
                            Cancel Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="template-primary-btn"
                          onClick={editingTemplateIndex === null ? handleAddInstructionTemplate : handleSaveEditedInstructionTemplate}
                          disabled={
                            refining ||
                            savingInstructionTemplate ||
                            (
                              editingTemplateIndex === null
                                ? !newInstructionTemplate.trim()
                                : !editingTemplateInstruction.trim()
                            )
                          }
                        >
                          {savingInstructionTemplate
                            ? 'Saving...'
                            : editingTemplateIndex === null
                              ? 'Save Template'
                              : 'Save Changes'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <textarea
                  id="user-instructions"
                  placeholder="E.g., 'Strictly match critical requirements, use only selected content, make it concise and human-written.'"
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
                  {refining ? (
                    <span className="refining-status">
                      <span className="refining-spinner"></span>
                      <span className="refining-text">
                        OpenAI {reasoningEffort === 'none' ? '' : 'Thinking'}<br/>
                        <small style={{fontSize: '0.85em', opacity: 0.9}}>
                          Reasoning: {reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1)}
                        </small>
                      </span>
                    </span>
                  ) : '✨ Refine with AI'}
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

                  {/* AI Model Info */}
                  {refinementResult.ai_info && (
                    <div className="ai-model-info">
                      <div className="ai-info-badge">
                        <svg className="ai-badge-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                        </svg>
                        <span className="ai-model-name">{refinementResult.ai_info.model}</span>
                      </div>
                      <div className="ai-info-details">
                        <span className="ai-detail">
                          <strong>Reasoning:</strong> {refinementResult.ai_info.reasoning_effort}
                        </span>
                        {refinementResult.ai_info.reasoning_tokens > 0 && (
                          <span className="ai-detail">
                            <strong>🧠 Thinking Tokens:</strong> {refinementResult.ai_info.reasoning_tokens.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {refinementResult.humanity && (
                    <div className="ai-model-info" style={{ borderColor: refinementResult.humanity.requires_confirmation ? '#f59e0b' : '#22c55e' }}>
                      <div className="ai-info-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span className="ai-detail">
                          <strong>Humanity Score:</strong> {refinementResult.humanity.score}/{refinementResult.humanity.threshold}
                        </span>
                        <span className="ai-detail">
                          <strong>Risk:</strong> {refinementResult.humanity.risk_level}
                          {refinementResult.humanity.requires_confirmation ? ' (confirmation required to include)' : ''}
                        </span>
                        {refinementResult.humanity.violations?.slice(0, 2).map((v, idx) => (
                          <span key={idx} className="ai-detail">• {v.message}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refined Content Display with Individual Copy Buttons */}
                  <div className="refined-content-display">
                    <div className="refined-header">
                      <h4>✨ Refined Content</h4>
                      <div className="refined-actions">
                        <button
                          onClick={handleIncludeRefinedContent}
                          className="btn-include"
                          title="Include this refined content in your CV tree"
                        >
                          ✓ Include
                        </button>
                        <button
                          onClick={(e) => copyToClipboard(refinementResult.refined_content, e)}
                          className="btn-copy-all"
                        >
                          📋 Copy All
                        </button>
                      </div>
                    </div>

                    <div className="refined-items">
                      {(() => {
                        // Parse markdown into hierarchical structure
                        const parseMarkdownToTree = (markdownText) => {
                          const lines = markdownText.split('\n');
                          const root = { type: 'root', children: [], level: -1 };
                          const stack = [root];

                          lines.forEach((line) => {
                            const trimmed = line.trim();
                            if (!trimmed) return;

                            let itemType = null;
                            let content = trimmed;
                            let level = 0;

                            // Detect type and level
                            if (trimmed.startsWith('## ')) {
                              itemType = 'section';
                              content = trimmed.substring(3);
                              level = 0;
                            } else if (trimmed.startsWith('### ')) {
                              itemType = 'entry';
                              content = trimmed.substring(4);
                              level = 1;
                            } else if (trimmed.match(/^\*[^*]+\*$/)) {
                              // Italic text (subtitle)
                              itemType = 'subtitle';
                              content = trimmed.replace(/\*/g, '');
                              level = 2;
                            } else if (trimmed.match(/^- /)) {
                              // Bullet - detect indentation level
                              const match = line.match(/^(\s*)-\s/);
                              const indent = match ? match[1].length : 0;
                              level = 2 + Math.floor(indent / 2); // Base level 2, +1 for every 2 spaces
                              itemType = 'bullet';
                              content = trimmed.substring(2);
                            } else if (trimmed.includes(' | ')) {
                              // Metadata line (location | dates)
                              itemType = 'metadata';
                              content = trimmed;
                              level = 2;
                            } else {
                              // Regular text/paragraph
                              itemType = 'text';
                              content = trimmed;
                              level = 2;
                            }

                            const item = { type: itemType, content, level, children: [] };

                            // Find the correct parent in the stack
                            while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                              stack.pop();
                            }

                            // Add to parent's children
                            const parent = stack[stack.length - 1];
                            parent.children.push(item);

                            // Add to stack if it can have children
                            if (['section', 'entry', 'bullet'].includes(itemType)) {
                              stack.push(item);
                            }
                          });

                          return root.children;
                        };

                        // Render tree with proper indentation
                        const renderItem = (item, depth = 0) => {
                          const indentLevel = depth;

                          return (
                            <div key={`${item.type}-${depth}-${item.content.substring(0, 20)}`}>
                              <div
                                className={`refined-item refined-item-${item.type}`}
                                style={{ marginLeft: `${indentLevel * 1.5}rem` }}
                              >
                                <div className="item-content">
                                  {item.type === 'section' && (
                                    <strong className="section-text">{item.content}</strong>
                                  )}
                                  {item.type === 'entry' && (
                                    <strong className="entry-text">{item.content}</strong>
                                  )}
                                  {item.type === 'subtitle' && (
                                    <em className="subtitle-text">{item.content}</em>
                                  )}
                                  {item.type === 'metadata' && (
                                    <span className="metadata-text">{item.content}</span>
                                  )}
                                  {item.type === 'bullet' && (
                                    <span className="bullet-text">
                                      <span className="bullet-icon">•</span> {item.content}
                                    </span>
                                  )}
                                  {item.type === 'text' && (
                                    <span className="text-content">{item.content}</span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => copyToClipboard(item.content, e)}
                                  className="btn-copy-item"
                                  title="Copy this item"
                                >
                                  📋
                                </button>
                              </div>

                              {/* Render children recursively */}
                              {item.children && item.children.length > 0 && (
                                <div className="item-children">
                                  {item.children.map((child, idx) => renderItem(child, depth + 1))}
                                </div>
                              )}
                            </div>
                          );
                        };

                        const tree = parseMarkdownToTree(refinementResult.refined_content);
                        return tree.map((item, idx) => renderItem(item, 0));
                      })()}
                    </div>

                    {/* Original Content - Collapsible */}
                    <details className="original-content-details">
                      <summary>📄 View Original Content</summary>
                      <div className="original-content-preview">
                        <pre>{refinementResult.original_content}</pre>
                      </div>
                    </details>
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

      {addNodeModal.isOpen && (
        <div className="modal-overlay add-node-modal-overlay" onClick={closeAddNodeModal}>
          <div className="modal add-node-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Item</h2>
              <button
                onClick={closeAddNodeModal}
                className="modal-close-btn"
                title="Close"
              >
                âœ•
              </button>
            </div>

            <div className="modal-body add-node-modal-body">
              <p className="add-node-parent-path">
                Parent: <strong>{addNodeModal.parentNode?.title || addNodeModal.parentNode?.content || 'Selected node'}</strong>
              </p>

              <div className="add-node-field">
                <label htmlFor="add-node-type">Type</label>
                <select
                  id="add-node-type"
                  className="reasoning-effort-dropdown"
                  value={newNodeForm.node_type}
                  onChange={(e) => setNewNodeForm((prev) => ({ ...prev, node_type: e.target.value }))}
                >
                  {addNodeAllowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {newNodeForm.node_type === 'entry' && (
                <>
                  <div className="add-node-field">
                    <label htmlFor="add-node-title">Title *</label>
                    <input
                      id="add-node-title"
                      type="text"
                      value={newNodeForm.title}
                      onChange={(e) => setNewNodeForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Example: Senior Data Scientist"
                    />
                  </div>
                  <div className="add-node-field">
                    <label htmlFor="add-node-subtitle">Subtitle</label>
                    <input
                      id="add-node-subtitle"
                      type="text"
                      value={newNodeForm.subtitle}
                      onChange={(e) => setNewNodeForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Example: Company Name"
                    />
                  </div>
                  <div className="add-node-row">
                    <div className="add-node-field">
                      <label htmlFor="add-node-start-date">Start Date</label>
                      <input
                        id="add-node-start-date"
                        type="text"
                        value={newNodeForm.start_date}
                        onChange={(e) => setNewNodeForm((prev) => ({ ...prev, start_date: e.target.value }))}
                        placeholder="MMM YYYY"
                      />
                    </div>
                    <div className="add-node-field">
                      <label htmlFor="add-node-end-date">End Date</label>
                      <input
                        id="add-node-end-date"
                        type="text"
                        value={newNodeForm.end_date}
                        onChange={(e) => setNewNodeForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        placeholder="Present"
                      />
                    </div>
                  </div>
                  <div className="add-node-field">
                    <label htmlFor="add-node-location">Location</label>
                    <input
                      id="add-node-location"
                      type="text"
                      value={newNodeForm.location}
                      onChange={(e) => setNewNodeForm((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="City, Country"
                    />
                  </div>
                </>
              )}

              <div className="add-node-field">
                <label htmlFor="add-node-content">
                  {newNodeForm.node_type === 'entry' ? 'Description' : 'Content *'}
                </label>
                <textarea
                  id="add-node-content"
                  value={newNodeForm.content}
                  onChange={(e) => setNewNodeForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder={
                    newNodeForm.node_type === 'paragraph'
                      ? 'Write paragraph text...'
                      : newNodeForm.node_type === 'bullet'
                        ? 'Write bullet text...'
                        : 'Optional entry description'
                  }
                  rows={newNodeForm.node_type === 'paragraph' ? 5 : 4}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={closeAddNodeModal}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNodeToSnapshot}
                className="btn-start-refine add-node-submit"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Refine Progress Modal - Modern Visual */}
      {/* Auto-Refine Settings Modal */}
      {showAutoRefineModal && (
        <div className="modal-overlay">
          <div className="modal auto-refine-settings-modal">
            <div className="modal-header">
              <h2>🤖 Auto-Refine All Sections</h2>
              <button
                onClick={() => setShowAutoRefineModal(false)}
                className="modal-close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Polish your whole CV in one pass: dedup across sections, merge, unify the summary,
                tailor to the role, and tighten to length, in a human voice using only your facts.
                You review and edit before anything changes.
              </p>

              {/* Model picker */}
              <div className="reasoning-effort-selector">
                <label><strong>Model</strong></label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setAutoRefineProvider('openai')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: autoRefineProvider === 'openai' ? '2px solid #10a37f' : '1px solid #d1d5db',
                      background: autoRefineProvider === 'openai' ? '#ecfdf5' : '#fff',
                    }}
                  >🤖 OpenAI</button>
                  <button
                    type="button"
                    onClick={() => setAutoRefineProvider('claude')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: autoRefineProvider === 'claude' ? '2px solid #d97757' : '1px solid #d1d5db',
                      background: autoRefineProvider === 'claude' ? '#fff3ed' : '#fff',
                    }}
                  >🧠 Claude</button>
                </div>
              </div>

              {/* Reasoning Effort Selector */}
              <div className="reasoning-effort-selector">
                <label htmlFor="auto-refine-reasoning-effort">
                  <span className="reasoning-label-icon">🧠</span>
                  <strong>AI Reasoning Mode</strong>
                </label>
                <div className="reasoning-help-text">
                  Control how deeply OpenAI thinks before responding
                </div>
                <select
                  id="auto-refine-reasoning-effort"
                  value={autoRefineReasoningEffort}
                  onChange={(e) => setAutoRefineReasoningEffort(e.target.value)}
                  className="reasoning-effort-dropdown"
                >
                  <option value="none">⚡ None - Fastest (No reasoning)</option>
                  <option value="low">🔸 Low - Quick reasoning (Recommended for batch)</option>
                  <option value="medium">⭐ Medium - Balanced</option>
                  <option value="high">💎 High - Deep thinking (Slower)</option>
                </select>
              </div>

              <div className="reasoning-effort-selector">
                <label htmlFor="auto-refine-rewrite-mode">
                  <strong>Rewrite Mode</strong>
                </label>
                <select
                  id="auto-refine-rewrite-mode"
                  value={autoRefineRewriteMode}
                  onChange={(e) => setAutoRefineRewriteMode(e.target.value)}
                  className="reasoning-effort-dropdown"
                >
                  <option value="minimal">Minimal (Recommended)</option>
                  <option value="standard">Standard</option>
                </select>
              </div>

              <div className="reasoning-effort-selector">
                <label htmlFor="auto-refine-target-pages">
                  <strong>Target CV Length</strong>
                </label>
                <select
                  id="auto-refine-target-pages"
                  value={autoRefineTargetPages}
                  onChange={(e) => setAutoRefineTargetPages(e.target.value)}
                  className="reasoning-effort-dropdown"
                >
                  <option value="auto">Auto</option>
                  <option value="1">1 Page</option>
                  <option value="2">2 Pages</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={autoRefineHumanStrict}
                    onChange={(e) => setAutoRefineHumanStrict(e.target.checked)}
                  />
                  <span>Strict Human-Written Guard (skip risky refinements)</span>
                </label>
              </div>

              {/* Additional Instructions */}
              <div className="refinement-instructions">
                <label htmlFor="auto-refine-instructions">
                  <strong>Additional Instructions (Optional)</strong>
                </label>
                <div className="instructions-help-text">
                  Provide custom guidance that will be applied to all sections
                </div>
                <textarea
                  id="auto-refine-instructions"
                  value={autoRefineInstructions}
                  onChange={(e) => setAutoRefineInstructions(e.target.value)}
                  placeholder="Example: Make the tone more technical, emphasize leadership experience, reduce bullet points per section..."
                  rows="4"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowAutoRefineModal(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleHolisticRefine}
                className="btn-start-refine"
              >
                <span className="btn-icon">✨</span>
                <span>Start Auto-Refine</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holistic Auto-Refine: loading overlay (generate / apply) */}
      {(refineLoading || refineApplying) && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal" style={{ maxWidth: 420, textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ margin: '0 0 0.4rem' }}>
              {refineApplying ? 'Applying polished CV…' : 'Polishing your whole CV…'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              {refineApplying
                ? 'Writing the changes and recalculating your scores.'
                : `Reading the whole CV and the role with ${autoRefineProvider === 'claude' ? 'Claude' : 'OpenAI'}. This can take a moment.`}
            </p>
          </div>
        </div>
      )}

      {/* Holistic Auto-Refine: review-then-apply */}
      {showRefineReview && refineProposal && (
        <div className="modal-overlay" onClick={() => setShowRefineReview(false)}>
          <div className="modal" style={{ maxWidth: 760, width: '94%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>✨ Review polished CV</h2>
              <button className="modal-close" onClick={() => setShowRefineReview(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '0.5rem 0' }}>
              <p style={{ color: '#475569', fontSize: 14, marginTop: 0 }}>
                Edit anything below, untick nothing is removed unintentionally, then apply. Your
                original is kept so you can always restore it.
                {refineProposal?.runtime?.resolved_model ? ` (via ${refineProposal.runtime.resolved_model})` : ''}
              </p>

              {refineProposal.changes_summary && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#334155', marginBottom: 12 }}>
                  {refineProposal.changes_summary}
                </div>
              )}

              {(refineProposal.removed_or_merged || []).length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#0e7490' }}>
                    Merged / removed ({refineProposal.removed_or_merged.length})
                  </summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: '#475569' }}>
                    {refineProposal.removed_or_merged.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </details>
              )}

              {refineProposal.humanity && refineProposal.humanity.risk_level && refineProposal.humanity.risk_level !== 'low' && (
                <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                  ⚠ This reads a little AI-ish (humanity {refineProposal.humanity.score}). Tweak any line that feels off.
                </div>
              )}

              {refineProposal.profile_title && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Profile title</label>
                  <input value={refineProposal.profile_title}
                    onChange={(e) => setRefineProposal((p) => ({ ...p, profile_title: e.target.value }))}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              )}

              {refineProposal.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#0f172a' }}>{s.heading}</label>
                  <textarea value={s.refined_markdown}
                    onChange={(e) => updateProposalSection(i, e.target.value)}
                    style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-cancel" onClick={() => setShowRefineReview(false)}>Cancel</button>
              <button className="btn-start-refine" onClick={handleApplyHolistic} disabled={refineApplying}>
                <span className="btn-icon">✓</span>
                <span>Apply polished CV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Refine Progress Modal */}
      {autoRefining && (
        <div className="modal-overlay auto-refine-overlay">
          <div className="modal auto-refine-modal">
            <div className="auto-refine-header">
              <h2>🤖 Auto-Refining All Sections</h2>
              <p className="auto-refine-subtitle">AI is intelligently refining each section of your CV</p>
            </div>

            {/* Progress Bar */}
            <div className="auto-refine-progress-container">
              <div className="progress-bar-wrapper">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(autoRefineProgress.current / autoRefineProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="progress-text">
                <span className="progress-count">{autoRefineProgress.current} / {autoRefineProgress.total}</span>
                <span className="progress-percent">{Math.round((autoRefineProgress.current / autoRefineProgress.total) * 100)}%</span>
              </div>
            </div>

            {/* Current Section */}
            {autoRefineProgress.currentSection && (
              <div className="current-section-indicator">
                <div className="spinner-animation"></div>
                <span>Currently refining: <strong>{autoRefineProgress.currentSection}</strong></span>
              </div>
            )}

            {/* Activity Log */}
            <div className="auto-refine-log">
              <h3>Activity Log</h3>
              <div className="log-entries">
                {autoRefineLog.map((entry, idx) => (
                  <div key={idx} className={`log-entry log-${entry.status}`}>
                    <span className="log-message">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="auto-refine-note">
              💡 This may take a few minutes depending on the number of sections. Please don't close this window.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SavedCVDetail;
