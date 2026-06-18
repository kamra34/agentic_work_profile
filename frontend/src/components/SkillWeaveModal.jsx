import { useState } from 'react';
import './SkillWeaveModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEPS = ['Model', 'Describe', 'Review'];
const STEP_INDEX = { model: 0, input: 1, clarify: 1, review: 2 };

// Profile Pool "Add Skill (AI)": pick a model, describe a skill in your own
// words, answer any clarifying questions, then review/edit and confirm how the
// skill gets woven across your summary, experiences, and core skills.
function SkillWeaveModal({ profileId, onClose, onApplied }) {
  const [stage, setStage] = useState('model'); // model | input | clarify | review
  const [provider, setProvider] = useState(null);
  const [skills, setSkills] = useState([{ name: '', context: '' }]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]); // accumulated [{question, answer}]
  const [answerInputs, setAnswerInputs] = useState([]);
  const [injections, setInjections] = useState([]); // each + {include, proposed_text}
  const [runtimeModel, setRuntimeModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeStep = STEP_INDEX[stage];

  const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const callPropose = async (allAnswers) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/profile/${profileId}/skill-weave/propose`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          provider,
          skills: skills.filter((s) => s.name.trim()),
          answers: allAnswers || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate suggestions');
      setRuntimeModel(data?.runtime?.resolved_model || data?.model || '');
      if (data.needs_clarification) {
        setQuestions(data.clarifying_questions || []);
        setAnswerInputs((data.clarifying_questions || []).map(() => ''));
        setStage('clarify');
      } else {
        setInjections((data.injections || []).map((inj) => ({ ...inj, include: true })));
        setStage('review');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = () => {
    const newAnswers = questions.map((q, i) => ({ question: q, answer: answerInputs[i] || '' }));
    const all = [...answers, ...newAnswers];
    setAnswers(all);
    callPropose(all);
  };

  const applyChanges = async () => {
    const chosen = injections.filter((inj) => inj.include && inj.proposed_text.trim());
    if (chosen.length === 0) { setError('Select at least one change to apply.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/profile/${profileId}/skill-weave/apply`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          injections: chosen.map((inj) => ({
            action: inj.action,
            node_id: inj.node_id,
            parent_node_id: inj.parent_node_id,
            new_node_type: inj.new_node_type,
            proposed_text: inj.proposed_text,
            model: runtimeModel,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to apply changes');
      onApplied?.(data.count || chosen.length);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const kindLabel = (k) => ({
    summary: 'Professional Summary', work_experience: 'Work Experience',
    core_skills: 'Core Skills', other: 'Other',
  }[k] || 'Other');

  const includedCount = injections.filter((i) => i.include).length;

  return (
    <div className="sw-overlay" onClick={onClose}>
      <div className="sw-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sw-header">
          <div className="sw-chip">✨</div>
          <div>
            <h2 className="sw-title">Add Skill with AI</h2>
            <p className="sw-subtitle">Weave a new skill across your whole profile, in your own voice.</p>
          </div>
          <button className="sw-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Stepper */}
        <div className="sw-stepper">
          {STEPS.map((label, i) => (
            <Step key={label} label={label} index={i} active={activeStep} last={i === STEPS.length - 1} />
          ))}
        </div>

        {error && <div className="sw-error">⚠️ {error}</div>}

        {/* Stage 1: model */}
        {stage === 'model' && (
          <>
            <div className="sw-body">
              <p className="sw-lead">Which model should weave this skill into your profile?</p>
              <div className="sw-models">
                <button className="sw-model openai" onClick={() => { setProvider('openai'); setStage('input'); }}>
                  <div className="sw-model__icon">🤖</div>
                  <span className="sw-model__name">OpenAI</span>
                  <span className="sw-model__desc">Your OpenAI model</span>
                </button>
                <button className="sw-model claude" onClick={() => { setProvider('claude'); setStage('input'); }}>
                  <div className="sw-model__icon">🧠</div>
                  <span className="sw-model__name">Claude</span>
                  <span className="sw-model__desc">Your Claude model</span>
                </button>
              </div>
            </div>
            <div className="sw-footer">
              <span />
              <button className="sw-btn sw-btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* Stage 2: describe */}
        {stage === 'input' && (
          <>
            <div className="sw-body">
              <p className="sw-lead">
                Add a skill and, in your own words, when and how you got or used it.
                Keep it real — <strong>the AI only uses what you write here.</strong>
              </p>
              {skills.map((s, i) => (
                <div key={i} className="sw-skill">
                  {skills.length > 1 && (
                    <button className="sw-skill__remove" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>Remove</button>
                  )}
                  <input className="sw-input" placeholder="Skill (e.g. Databricks)" value={s.name}
                    onChange={(e) => setSkills(skills.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <textarea className="sw-textarea"
                    placeholder="In your own words: when, where, and what you did with it…" value={s.context}
                    onChange={(e) => setSkills(skills.map((x, j) => j === i ? { ...x, context: e.target.value } : x))} />
                </div>
              ))}
              <button className="sw-add-more" onClick={() => setSkills([...skills, { name: '', context: '' }])}>
                + Add another skill
              </button>
            </div>
            <div className="sw-footer">
              <button className="sw-btn sw-btn--ghost" onClick={() => setStage('model')}>← Back</button>
              <button className="sw-btn sw-btn--primary" disabled={loading || !skills.some((s) => s.name.trim())}
                onClick={() => callPropose(answers)}>
                {loading ? <><span className="sw-spin" />Thinking…</> : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* Stage 3: clarify */}
        {stage === 'clarify' && (
          <>
            <div className="sw-body">
              <p className="sw-lead">A few quick questions so the wording stays honest and specific:</p>
              {questions.map((q, i) => (
                <div key={i} className="sw-q">
                  <div className="sw-q__label"><span className="sw-q__num">{i + 1}</span>{q}</div>
                  <textarea className="sw-textarea" style={{ minHeight: 54 }} value={answerInputs[i] || ''}
                    onChange={(e) => setAnswerInputs(answerInputs.map((a, j) => j === i ? e.target.value : a))} />
                </div>
              ))}
            </div>
            <div className="sw-footer">
              <button className="sw-btn sw-btn--ghost" onClick={() => setStage('input')}>← Back</button>
              <button className="sw-btn sw-btn--primary" disabled={loading} onClick={submitAnswers}>
                {loading ? <><span className="sw-spin" />Thinking…</> : 'Submit answers →'}
              </button>
            </div>
          </>
        )}

        {/* Stage 4: review */}
        {stage === 'review' && (
          <>
            <div className="sw-body">
              <p className="sw-lead">
                Review each change. Edit the wording freely; switch off anything you don't want.
                {runtimeModel ? <> <strong>via {runtimeModel}</strong></> : null}
              </p>
              {injections.length === 0 && <div className="sw-empty">No changes were proposed.</div>}
              {injections.map((inj, i) => {
                const risk = inj.humanity?.risk_level;
                const invented = inj.integrity?.invented_numbers || [];
                return (
                  <div key={i} className={`sw-review-card ${inj.include ? 'is-on' : 'is-off'}`}>
                    <div className="sw-review-head">
                      <div className="sw-review-meta">
                        <span className="sw-kind">{kindLabel(inj.target_kind)}</span>
                        <span className={`sw-action-tag ${inj.action}`}>{inj.action === 'edit' ? 'edit' : 'add'}</span>
                        {risk && risk !== 'low' && <span className="sw-badge warn">⚠ {risk} AI-voice</span>}
                        {invented.length > 0 && <span className="sw-badge danger">⚠ unverified number</span>}
                      </div>
                      <label className="sw-toggle">
                        <input type="checkbox" checked={inj.include}
                          onChange={(e) => setInjections(injections.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} />
                        <span className="sw-toggle__track" />
                      </label>
                    </div>
                    {inj.action === 'edit' && inj.original_text && (
                      <div className="sw-orig"><b>now</b>{inj.original_text}</div>
                    )}
                    <textarea className="sw-textarea" style={{ minHeight: 56 }} value={inj.proposed_text}
                      onChange={(e) => setInjections(injections.map((x, j) => j === i ? { ...x, proposed_text: e.target.value } : x))} />
                    {inj.rationale && <div className="sw-rationale">{inj.rationale}</div>}
                  </div>
                );
              })}
            </div>
            <div className="sw-footer">
              <button className="sw-btn sw-btn--ghost" onClick={() => setStage('input')}>← Start over</button>
              <button className="sw-btn sw-btn--primary" disabled={loading || includedCount === 0} onClick={applyChanges}>
                {loading ? <><span className="sw-spin" />Applying…</> : `Apply ${includedCount} change${includedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ label, index, active, last }) {
  const cls = index < active ? 'is-done' : index === active ? 'is-active' : '';
  return (
    <>
      <div className={`sw-step ${cls}`}>
        <span className="sw-step__dot">{index < active ? '✓' : index + 1}</span>
        <span className="sw-step__label">{label}</span>
      </div>
      {!last && <span className={`sw-step__line ${index < active ? 'is-filled' : ''}`} />}
    </>
  );
}

export default SkillWeaveModal;
