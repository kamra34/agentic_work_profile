import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 720, width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={S.header}>
          <h2 style={{ margin: 0 }}>✨ Add Skill (AI)</h2>
          <button className="modal-close" onClick={onClose} style={S.close}>×</button>
        </div>

        {error && <div style={S.error}>{error}</div>}

        {/* Stage 1: pick a model */}
        {stage === 'model' && (
          <div style={{ padding: '0.5rem 0' }}>
            <p style={S.prompt}>Which model should weave this skill into your profile?</p>
            <div style={S.modelGrid}>
              <button style={{ ...S.modelBtn, borderColor: '#10a37f' }}
                onClick={() => { setProvider('openai'); setStage('input'); }}>
                <div style={{ fontSize: 28 }}>🤖</div><strong>OpenAI</strong>
                <span style={S.modelDesc}>Your OpenAI model</span>
              </button>
              <button style={{ ...S.modelBtn, borderColor: '#d97757' }}
                onClick={() => { setProvider('claude'); setStage('input'); }}>
                <div style={{ fontSize: 28 }}>🧠</div><strong>Claude</strong>
                <span style={S.modelDesc}>Your Claude model</span>
              </button>
            </div>
          </div>
        )}

        {/* Stage 2: describe the skill(s) */}
        {stage === 'input' && (
          <div style={{ padding: '0.5rem 0' }}>
            <p style={S.prompt}>
              Add a skill and, in your own words, when and how you got or used it.
              Keep it real — the AI only uses what you write here.
            </p>
            {skills.map((s, i) => (
              <div key={i} style={S.skillRow}>
                <input style={S.input} placeholder="Skill (e.g. Databricks)" value={s.name}
                  onChange={(e) => setSkills(skills.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }}
                  placeholder="In your own words: when, where, what you did with it…" value={s.context}
                  onChange={(e) => setSkills(skills.map((x, j) => j === i ? { ...x, context: e.target.value } : x))} />
                {skills.length > 1 && (
                  <button style={S.linkBtn} onClick={() => setSkills(skills.filter((_, j) => j !== i))}>Remove</button>
                )}
              </div>
            ))}
            <button style={S.linkBtn} onClick={() => setSkills([...skills, { name: '', context: '' }])}>+ Add another skill</button>
            <div style={S.actions}>
              <button style={S.secondary} onClick={() => setStage('model')}>← Back</button>
              <button style={S.primary} disabled={loading || !skills.some((s) => s.name.trim())}
                onClick={() => callPropose(answers)}>
                {loading ? 'Thinking…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* Stage 3: clarifying questions */}
        {stage === 'clarify' && (
          <div style={{ padding: '0.5rem 0' }}>
            <p style={S.prompt}>A few quick questions so the wording stays honest and specific:</p>
            {questions.map((q, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <label style={S.qLabel}>{q}</label>
                <textarea style={{ ...S.input, minHeight: 52 }} value={answerInputs[i] || ''}
                  onChange={(e) => setAnswerInputs(answerInputs.map((a, j) => j === i ? e.target.value : a))} />
              </div>
            ))}
            <div style={S.actions}>
              <button style={S.secondary} onClick={() => setStage('input')}>← Back</button>
              <button style={S.primary} disabled={loading} onClick={submitAnswers}>
                {loading ? 'Thinking…' : 'Submit answers →'}
              </button>
            </div>
          </div>
        )}

        {/* Stage 4: review proposals */}
        {stage === 'review' && (
          <div style={{ padding: '0.5rem 0' }}>
            <p style={S.prompt}>
              Review each change. Edit the wording freely; untick anything you don't want.
              {runtimeModel ? ` (via ${runtimeModel})` : ''}
            </p>
            {injections.length === 0 && <p>No changes were proposed.</p>}
            {injections.map((inj, i) => {
              const risk = inj.humanity?.risk_level;
              const invented = inj.integrity?.invented_numbers || [];
              return (
                <div key={i} style={{ ...S.card, opacity: inj.include ? 1 : 0.55 }}>
                  <div style={S.cardHead}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                      <input type="checkbox" checked={inj.include}
                        onChange={(e) => setInjections(injections.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} />
                      {kindLabel(inj.target_kind)} · {inj.action === 'edit' ? 'edit existing' : 'add new'}
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {risk && risk !== 'low' && <span style={{ ...S.badge, background: '#fef3c7', color: '#92400e' }}>⚠ {risk} AI-voice</span>}
                      {invented.length > 0 && <span style={{ ...S.badge, background: '#fee2e2', color: '#991b1b' }}>⚠ unverified number</span>}
                    </div>
                  </div>
                  {inj.action === 'edit' && inj.original_text && (
                    <div style={S.original}><span style={S.origLabel}>now:</span> {inj.original_text}</div>
                  )}
                  <textarea style={{ ...S.input, minHeight: 56 }} value={inj.proposed_text}
                    onChange={(e) => setInjections(injections.map((x, j) => j === i ? { ...x, proposed_text: e.target.value } : x))} />
                  {inj.rationale && <div style={S.rationale}>{inj.rationale}</div>}
                </div>
              );
            })}
            <div style={S.actions}>
              <button style={S.secondary} onClick={() => setStage('input')}>← Start over</button>
              <button style={S.primary} disabled={loading || injections.every((i) => !i.include)} onClick={applyChanges}>
                {loading ? 'Applying…' : `Apply ${injections.filter((i) => i.include).length} change(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  close: { background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', lineHeight: 1 },
  prompt: { color: '#475569', fontSize: 14, marginTop: 0 },
  error: { background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 13 },
  modelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  modelBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '1.5rem', border: '2px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer' },
  modelDesc: { fontSize: 12, color: '#64748b' },
  skillRow: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eef2f7' },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  qLabel: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#334155' },
  actions: { display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  primary: { padding: '9px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  secondary: { padding: '9px 16px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 6, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 13, padding: 0 },
  card: { border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  original: { fontSize: 13, color: '#64748b', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, marginBottom: 6 },
  origLabel: { fontWeight: 700, color: '#94a3b8', marginRight: 4 },
  rationale: { fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' },
};

export default SkillWeaveModal;
