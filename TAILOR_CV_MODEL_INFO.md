# Tailor CV - Model Info Display Enhancement

## Summary

Add visual indicators in the Tailor CV workflow showing which AI models are being used and their configuration (like GPT-5.1 with reasoning effort).

## Current State

**Backend:** Already returns model info in responses ✅
- Job analysis returns: `{"model": "gpt-5.1", ...}`
- Scoring returns: `{"model": "openai-gpt-5.1", ...}`
- Recommendations return: `{"model": "openai-gpt-5.1", ...}`

**Frontend:** Hardcoded model names ❌
- Shows "OpenAI GPT-5.1" regardless of actual model
- Doesn't show reasoning effort
- No indication of which model version is actually running

## What Needs to Change

### Frontend Updates (TailorCV.jsx)

#### 1. Model Cards (Line ~1503-1521)

**Current:**
```jsx
<strong>OpenAI GPT-5.1</strong>
<span className="model-provider">OpenAI</span>
```

**Should Be:**
```jsx
<strong>{getModelDisplayName(scores?.openai)}</strong>
<span className="model-provider">OpenAI{scores?.openai?.reasoning_tokens ? ` • ${getReasoningEffort()}` : ''}</span>
```

#### 2. Add Helper Functions

Add these helper functions at the top of Step2AIAnalysis component:

```javascript
// Helper to get model display name from response
const getModelDisplayName = (analysisOrScore) => {
  if (!analysisOrScore) return 'Loading...';

  const model = analysisOrScore.model || '';

  // Parse model string
  if (model.includes('gpt-5.1')) return 'GPT-5.1 Thinking';
  if (model.includes('gpt-4o')) return 'GPT-4o';
  if (model.includes('claude')) return 'Claude Sonnet 4.5';

  return model || 'AI Model';
};

// Helper to get reasoning effort level
const getReasoningEffort = () => {
  // Get from localStorage (set during refinement) or default
  return localStorage.getItem('reasoning_effort') || 'Medium';
};

// Helper to check if model used reasoning
const hasReasoningTokens = (analysisOrScore) => {
  return analysisOrScore?.reasoning_tokens && analysisOrScore.reasoning_tokens > 0;
};
```

#### 3. Enhanced Model Cards with Badges

Replace the model cards section (lines 1495-1531) with:

```jsx
{/* Model Selection Cards */}
<div className="model-selection-cards">
  <button
    className={`model-card ${selectedTab === 'openai' ? 'active' : ''} ${scores?.openai?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' : 'verdict-negative'}`}
    onClick={() => setSelectedTab('openai')}
  >
    <div className="model-card-header">
      <div className="model-indicator openai-indicator"></div>
      <div className="model-name">
        <strong>{getModelDisplayName(scores?.openai)}</strong>
        <span className="model-provider">
          OpenAI
          {hasReasoningTokens(scores?.openai) && (
            <span className="reasoning-badge" title={`Used ${scores.openai.reasoning_tokens} reasoning tokens`}>
              🧠 {getReasoningEffort()}
            </span>
          )}
        </span>
      </div>
    </div>
    {scores?.openai?.scores && (
      <div className="model-card-verdict">
        {scores.openai.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' : '✗ Skip'}
      </div>
    )}
  </button>

  <button
    className={`model-card ${selectedTab === 'claude' ? 'active' : ''} ${scores?.claude?.scores?.verdict === 'SHOULD_APPLY' ? 'verdict-positive' : 'verdict-negative'}`}
    onClick={() => setSelectedTab('claude')}
  >
    <div className="model-card-header">
      <div className="model-indicator claude-indicator"></div>
      <div className="model-name">
        <strong>{getModelDisplayName(scores?.claude)}</strong>
        <span className="model-provider">Anthropic</span>
      </div>
    </div>
    {scores?.claude?.scores && (
      <div className="model-card-verdict">
        {scores.claude.scores.verdict === 'SHOULD_APPLY' ? '✓ Apply' : '✗ Skip'}
      </div>
    )}
  </button>
</div>
```

#### 4. Add Model Info Section After Scores

Add this right after the score display (around line 1600+):

```jsx
{/* AI Model Info - Show reasoning details */}
{currentScores?.reasoning_tokens && (
  <div className="ai-model-details">
    <div className="detail-row">
      <span className="detail-label">Model:</span>
      <span className="detail-value">{getModelDisplayName(currentScores)}</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">Reasoning Effort:</span>
      <span className="detail-value">{getReasoningEffort()}</span>
    </div>
    <div className="detail-row">
      <span className="detail-label">🧠 Thinking Tokens:</span>
      <span className="detail-value">{currentScores.reasoning_tokens.toLocaleString()}</span>
    </div>
  </div>
)}
```

### CSS Additions (TailorCV.css)

Add these styles:

```css
/* Reasoning Badge on Model Cards */
.reasoning-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  vertical-align: middle;
}

/* AI Model Details Section */
.ai-model-details {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-left: 4px solid #667eea;
  padding: 16px;
  margin: 16px 0;
  border-radius: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 600;
  color: #667eea;
  font-size: 14px;
}

.detail-value {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .detail-value {
    color: #e0e0e0;
  }

  .ai-model-details {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
  }
}
```

## Expected Result

### Before
```
┌─────────────────────────┐
│ OpenAI GPT-5.1          │
│ OpenAI                  │
│                  ✓ Apply │
└─────────────────────────┘
```

### After
```
┌─────────────────────────────────┐
│ GPT-5.1 Thinking                │
│ OpenAI  [🧠 Medium]              │
│                      ✓ Apply     │
└─────────────────────────────────┘

Model: GPT-5.1 Thinking
Reasoning Effort: Medium
🧠 Thinking Tokens: 625
```

## Benefits

1. **Transparency** - Users see actual model being used
2. **Configuration Visibility** - Shows reasoning effort level
3. **Cost Awareness** - Displays thinking tokens
4. **Debugging** - Easy to identify which model ran
5. **Professional** - Shows AI sophistication

## Testing

1. Set in `.env`:
   ```bash
   OPENAI_MODEL_VERSION=gpt-5.1
   OPENAI_REASONING_EFFORT=medium
   ```

2. Run Tailor CV workflow
3. Check Step 2 (AI Analysis)
4. Look for:
   - Model cards showing "GPT-5.1 Thinking"
   - Badge showing "🧠 Medium"
   - Details section with reasoning tokens

## Alternative: Simpler Approach

If you want just a quick indicator without all the details, simply update line 1504:

**From:**
```jsx
<strong>OpenAI GPT-5.1</strong>
```

**To:**
```jsx
<strong>{scores?.openai?.model === 'openai-gpt-5.1' ? 'GPT-5.1 Thinking' : 'GPT-4o'}</strong>
```

And add a small indicator:
```jsx
<span className="model-provider">
  OpenAI
  {scores?.openai?.reasoning_tokens > 0 && ` 🧠 ${scores.openai.reasoning_tokens}`}
</span>
```

This gives you immediate visibility with minimal code changes!

## Summary

**Quick Win (5 minutes):**
- Update model display names dynamically
- Show reasoning tokens inline

**Full Implementation (30 minutes):**
- Helper functions
- Enhanced model cards
- Detailed info section
- Custom styling

Both approaches work! The quick win gives you immediate transparency, while the full implementation provides a polished, professional UI.

Choose based on your time and needs! 🚀
