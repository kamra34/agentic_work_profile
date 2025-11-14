import { useState, useEffect } from 'react';
import './AIEditor.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AIEditor({ entry, onClose, onApply }) {
  const [modelType, setModelType] = useState(null); // 'openai' or 'claude'
  const [loading, setLoading] = useState(false);
  const [critique, setCritique] = useState(null);
  const [acceptedBullets, setAcceptedBullets] = useState([]);

  // Reset all state when modal opens - ensures fresh AI context every time
  useEffect(() => {
    setModelType(null);
    setCritique(null);
    setAcceptedBullets([]);
  }, []); // Empty deps = run only on mount

  const handleModelSelect = async (type) => {
    setModelType(type);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Use different endpoints for sections vs entries
      const endpoint = entry.isSection
        ? `${API_URL}/api/sections/${entry.id}/ai-edit`
        : `${API_URL}/api/entries/${entry.id}/ai-edit`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [entry.isSection ? 'section_id' : 'entry_id']: entry.id,
          model_type: type
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCritique(data);
      } else {
        throw new Error('Failed to get AI critique');
      }
    } catch (err) {
      console.error(err);
      alert('Error getting AI critique: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMore = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Use different endpoints for sections vs entries
      const endpoint = entry.isSection
        ? `${API_URL}/api/sections/${entry.id}/ai-chat`
        : `${API_URL}/api/entries/${entry.id}/ai-chat`;

      // Send message to add more content
      const message = entry.isSection
        ? 'Extend this paragraph with 2-3 more relevant sentences that flow naturally'
        : 'Add 2-3 more bullet points covering additional relevant achievements or responsibilities';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [entry.isSection ? 'section_id' : 'entry_id']: entry.id,
          messages: [{ role: 'user', content: message }],
          model_type: modelType
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Update critique with new suggestions
        if (data.humanized_rewrites) {
          setCritique(data);
          setAcceptedBullets([]); // Reset selections
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error('Failed to add more content');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBullet = (idx) => {
    setAcceptedBullets(prev =>
      prev.includes(idx)
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleApplySelected = () => {
    if (acceptedBullets.length === 0) {
      alert('Please select at least one bullet to apply');
      return;
    }

    // Build final bullet list by applying only selected changes
    const finalBullets = critique.humanized_rewrites.map((rewrite, idx) => {
      // If this suggestion is selected, apply the change
      if (acceptedBullets.includes(idx)) {
        if (rewrite.action === 'delete') {
          return null; // Mark for deletion
        }
        return rewrite.text; // Use new text
      }
      // Otherwise, keep original
      return rewrite.original || rewrite.text;
    }).filter(bullet => bullet !== null && bullet !== ''); // Remove deleted bullets

    onApply(finalBullets);
    onClose();
  };

  const handleApplyAll = () => {
    // Apply all changes (edits, additions, deletions, keeps)
    const allBullets = critique.humanized_rewrites
      .filter(rewrite => rewrite.action !== 'delete') // Remove deleted bullets
      .map(rewrite => rewrite.text);
    onApply(allBullets);
    onClose();
  };

  return (
    <div className="ai-editor-overlay">
      <div className="ai-editor-modal">
        <div className="ai-editor-header">
          <h3>✨ AI CV Editor</h3>
          <button onClick={onClose} className="btn-close-ai">×</button>
        </div>

        {!modelType ? (
          <div className="model-selection">
            <p className="model-prompt">Choose AI model to analyze this entry:</p>
            <div className="model-buttons">
              <button
                onClick={() => handleModelSelect('openai')}
                className="model-btn openai-btn"
                disabled={loading}
              >
                <span className="model-icon">🤖</span>
                <span className="model-name">OpenAI GPT-4</span>
                <span className="model-desc">Latest GPT-5 model</span>
              </button>
              <button
                onClick={() => handleModelSelect('claude')}
                className="model-btn claude-btn"
                disabled={loading}
              >
                <span className="model-icon">🧠</span>
                <span className="model-name">Claude 3.5 Sonnet</span>
                <span className="model-desc">Anthropic's latest</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="ai-editor-content">
            <div className="model-badge">
              {modelType === 'openai' ? '🤖 GPT-4' : '🧠 Claude'} | {entry.title}
            </div>

            {loading && !critique && (
              <div className="ai-loading">
                <div className="spinner"></div>
                <p>AI is analyzing your entry...</p>
              </div>
            )}

            {critique && (
              <div className="critique-results">
                <div className="verdict-box" data-verdict={critique.verdict.toLowerCase()}>
                  <strong>Verdict:</strong> {critique.verdict}
                </div>

                <div className="critique-section">
                  <h4>💬 Hard Critique</h4>
                  <ul className="critique-list">
                    {critique.hard_critique.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="critique-section rewrite-section">
                  <h4>✍️ Humanized Rewrites</h4>
                  <p className="rewrite-instruction">
                    Select individual bullets to accept, or apply all at once. Each bullet below addresses specific critique points and includes relevant ATS keywords.
                  </p>
                  <div className="rewrite-bullets">
                    {critique.humanized_rewrites.map((rewrite, idx) => (
                      <div key={idx} className={`rewrite-bullet ${acceptedBullets.includes(idx) ? 'accepted' : ''} ${rewrite.action === 'add' ? 'new-bullet' : ''} ${rewrite.action === 'keep' ? 'keep-bullet' : ''} ${rewrite.action === 'delete' ? 'delete-bullet' : ''}`}>
                        <input
                          type="checkbox"
                          checked={acceptedBullets.includes(idx)}
                          onChange={() => toggleBullet(idx)}
                          className="bullet-checkbox"
                        />
                        <div className="bullet-content">
                          <span className="bullet-num">
                            {rewrite.action === 'add' ? '🆕' :
                             rewrite.action === 'keep' ? '✓' :
                             rewrite.action === 'delete' ? '🗑️' : idx + 1}
                          </span>
                          <div className="bullet-text-container">
                            {rewrite.original && (
                              <div className="original-text">
                                <strong>Original:</strong> {rewrite.original}
                              </div>
                            )}
                            <span className="bullet-text">{rewrite.text || '(Delete this bullet)'}</span>
                            <div className="bullet-meta">
                              {rewrite.action === 'add' && (
                                <span className="bullet-meta-tag new-tag">
                                  ✨ NEW SUGGESTION
                                </span>
                              )}
                              {rewrite.action === 'keep' && (
                                <span className="bullet-meta-tag keep-tag">
                                  ✓ KEEP AS IS
                                </span>
                              )}
                              {rewrite.action === 'delete' && (
                                <span className="bullet-meta-tag delete-tag">
                                  🗑️ DELETE
                                </span>
                              )}
                              {rewrite.action === 'edit' && (
                                <span className="bullet-meta-tag edit-tag">
                                  ✏️ EDIT
                                </span>
                              )}
                              {rewrite.reason && (
                                <span className="bullet-meta-tag reason-tag">
                                  💡 Why: {rewrite.reason}
                                </span>
                              )}
                              {critique.ats_keywords && critique.ats_keywords.slice(idx * 2, idx * 2 + 2).length > 0 && (
                                <span className="bullet-meta-tag">
                                  🔑 Keywords: {critique.ats_keywords.slice(idx * 2, idx * 2 + 2).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rewrite-actions">
                    <button
                      onClick={handleApplySelected}
                      className="btn-apply-selected"
                      disabled={acceptedBullets.length === 0}
                    >
                      Apply Selected ({acceptedBullets.length})
                    </button>
                    <button
                      onClick={handleApplyAll}
                      className="btn-apply-all"
                    >
                      Apply All {critique.humanized_rewrites.length} Bullets
                    </button>
                  </div>
                </div>

                <div className="critique-section">
                  <h4>❓ Missing Evidence</h4>
                  <ul className="question-list">
                    {critique.missing_evidence.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="critique-section">
                  <h4>🔑 ATS Keywords</h4>
                  <div className="keywords-tags">
                    {critique.ats_keywords && critique.ats_keywords.map((kw, idx) => (
                      <span key={idx} className="keyword-tag">{kw}</span>
                    ))}
                  </div>
                </div>

                {critique.risk_flags && critique.risk_flags.length > 0 && (
                  <div className="critique-section risk-section">
                    <h4>⚠️ Risk Flags</h4>
                    <ul className="risk-list">
                      {critique.risk_flags.map((risk, idx) => (
                        <li key={idx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="critique-section">
                  <h4>✅ Style Check</h4>
                  <p className="style-check">{critique.style_check}</p>
                </div>

                <button
                  onClick={handleAddMore}
                  className="btn-add-more"
                  disabled={loading}
                >
                  {loading ? '⏳ Adding...' : '➕ Add More Content'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIEditor;
