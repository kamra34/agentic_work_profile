# AI Scores Display Fix - v1.5.1

## Issue
AI scores (Profile Fit and ATS) were not displaying in the "My Tailored CVs" page cards, showing empty badges instead.

## Root Causes

### 1. Missing Scores in Database
When investigating saved CVs, found that scores were `None` in the database:
```
OpenAI Fit Score: None
Claude Fit Score: None
OpenAI ATS Score: None
Claude ATS Score: None
```

**Why**: The scores come from the "Profile Fit Analysis" step, which requires clicking "Analyze with AI". If users skip this step and go directly to "Tailor My CV", the `fitAnalysis` state is `null`, so scores aren't saved.

### 2. Incomplete API Response Schema
The `TailoredCVResponse` schema in [schemas.py](backend/schemas.py) was missing several fields that the frontend expected:
- `job_description`
- `selected_content`
- `openai_recommendations`
- `claude_recommendations`
- `notes`
- `user_id`
- `profile_id`

Without these fields in the schema, Pydantic was stripping them from the API response even if they existed in the database.

### 3. Frontend Display Logic
The component was checking `if (cv.openai_fit_score)` which evaluates to `false` for `null` values, but wasn't rendering anything when scores were missing - just empty space.

## Fixes Applied

### Backend: [schemas.py](backend/schemas.py) - Lines 304-324

**Before**:
```python
class TailoredCVResponse(BaseModel):
    id: int
    job_title: str
    company_name: Optional[str]
    openai_fit_score: Optional[int]
    claude_fit_score: Optional[int]
    openai_ats_score: Optional[int]
    claude_ats_score: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
```

**After**:
```python
class TailoredCVResponse(BaseModel):
    id: int
    user_id: int
    profile_id: int
    job_title: str
    company_name: Optional[str]
    job_description: Optional[str]
    openai_fit_score: Optional[int]
    claude_fit_score: Optional[int]
    openai_ats_score: Optional[int]
    claude_ats_score: Optional[int]
    selected_content: Dict[str, Any]
    openai_recommendations: Optional[Dict[str, Any]]
    claude_recommendations: Optional[Dict[str, Any]]
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
```

### Frontend: [TailoredCVs.jsx](frontend/src/components/TailoredCVs.jsx) - Lines 280-320

**Before**:
```jsx
{cv.openai_fit_score && (
  <span className="score-badge openai">
    🟢 {cv.openai_fit_score}%
  </span>
)}
```

**After**:
```jsx
{cv.openai_fit_score ? (
  <span className="score-badge openai">
    🟢 {cv.openai_fit_score}%
  </span>
) : (
  <span className="score-badge-na">🟢 N/A</span>
)}
```

### Frontend: [TailoredCVs.css](frontend/src/components/TailoredCVs.css) - Lines 232-239

Added styling for N/A badges:
```css
.score-badge-na {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  background: #e2e8f0;
  color: #718096;
}
```

### Frontend: [Dashboard.jsx](frontend/src/components/Dashboard.jsx) - Lines 442-454

Added debug logging to help diagnose score issues:
```javascript
// Debug logging
console.log('[DEBUG] Saving CV with scores:', {
  openai_fit_score,
  claude_fit_score,
  openai_ats_score,
  claude_ats_score,
  fitAnalysis: fitAnalysis
});

// Warn if scores are missing
if (!openai_fit_score && !claude_fit_score && !openai_ats_score && !claude_ats_score) {
  console.warn('[WARNING] No AI scores found. Did you run "Analyze with AI" first?');
}
```

## User Experience After Fix

### Before
```
Profile Fit:
ATS Score:
```
(Empty - nothing displayed)

### After
```
Profile Fit: 🟢 N/A  🔵 N/A
ATS Score:   🟢 N/A  🔵 N/A
```
(Shows N/A badges when scores are missing)

### With Scores
```
Profile Fit: 🟢 85%  🔵 88%
ATS Score:   🟢 92%  🔵 90%
```
(Shows actual scores when available)

## How to Get Scores

For scores to be saved with a tailored CV, users must:

1. **Go to "Tailor CV" page**
2. **Paste job description**
3. **Click "Analyze with AI"** ← This generates the scores
   - Wait for Step 1: Job Analysis ✓
   - Wait for Step 2: Profile Fit Analysis ✓ (scores generated here)
   - Scores displayed in cards
4. **Click "Tailor My CV"**
5. **Review tailored recommendations**
6. **Click "💾 Save This Tailored CV"**

**Important**: If users skip step 3 (Analyze with AI) and go directly to "Tailor My CV" using the "Load Mock Data" or skip analysis, scores will be `null`.

## Testing

Created diagnostic script: [check_tailored_cv.py](backend/check_tailored_cv.py)
- Run: `python backend/check_tailored_cv.py`
- Shows all saved CVs with their scores
- Helps verify scores are being saved correctly

## Version
Backend: **v1.5.1**
Frontend: Updated

## Future Improvements

1. **Require "Analyze with AI"**: Disable "Tailor My CV" button until analysis is complete
2. **Better User Feedback**: Show message "Run 'Analyze with AI' first to get scores" if missing
3. **Retroactive Scoring**: Allow re-analyzing old saved CVs to add scores
4. **Score Indicators**: Visual indicator in list view showing which CVs have/don't have scores
