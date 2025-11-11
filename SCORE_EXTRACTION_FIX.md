# Score Extraction Fix - v1.5.2

## Issue
AI scores were still showing as "N/A" even after running "Analyze with AI" and the fit analysis completing successfully. Console logs showed:
```
[WARNING] No AI scores found. Did you run "Analyze with AI" first?
```

## Root Cause
The score extraction code in [Dashboard.jsx](frontend/src/components/Dashboard.jsx:437-445) was using the **wrong API response structure**.

### What We Were Using (WRONG):
```javascript
const openai_fit_score = fitAnalysis?.analyses?.find(...)?.analysis?.profile_fit_score;
const claude_fit_score = fitAnalysis?.analyses?.find(...)?.analysis?.profile_fit_score;
const openai_ats_score = fitAnalysis?.analyses?.find(...)?.analysis?.ats_compatibility_score;
const claude_ats_score = fitAnalysis?.analyses?.find(...)?.analysis?.ats_compatibility_score;
```

**Problems**:
1. Looking for `analyses` but API returns `fit_analyses`
2. Looking for `analysis` but API returns `fit_analysis`
3. Looking for `profile_fit_score` but API returns `fit_percentage`
4. Looking for `ats_compatibility_score` but API returns `ats_compatibility.overall_ats_score`

### Actual API Response Structure

From [schemas.py](backend/schemas.py:261-265):
```python
class ProfileFitResponse(BaseModel):
    job_analysis: Dict[str, Any]
    user_profile_summary: Optional[Dict[str, Any]]
    input_data: Dict[str, Any]
    fit_analyses: List[ProfileFitResult]  # ← fit_analyses (plural)

class ProfileFitResult(BaseModel):
    provider: str  # "openai" or "anthropic"
    model: Optional[str]
    fit_analysis: Optional[Dict[str, Any]]  # ← fit_analysis (singular)
    error: Optional[str]
```

From [profile_fit_service.py](backend/profile_fit_service.py:82-100):
```python
{
  "fit_percentage": <number 0-100>,  # ← Profile fit score
  "fit_summary": "<honest assessment>",
  "strengths": [...],
  "critical_gaps": [...],
  "experience_match": "<assessment>",
  "technical_skills_match": <percentage 0-100>,
  "ats_compatibility": {
    "keyword_match": <number 0-100>,
    "skills_coverage": <number 0-100>,
    "has_metrics": <boolean>,
    "action_verbs_score": <number 0-100>,
    "overall_ats_score": <number 0-100>,  # ← ATS score
    "ats_notes": "<brief explanation>"
  },
  "recommendation": {
    "should_apply": <true/false>,
    "reasoning": "<clear explanation>"
  }
}
```

## Fix Applied

### [Dashboard.jsx](frontend/src/components/Dashboard.jsx:437-445)

**New Code**:
```javascript
// Extract scores from fitAnalysis
// Note: The API returns fit_analyses (not analyses) with fit_analysis (not analysis) inside
const openai_fit_result = fitAnalysis?.fit_analyses?.find(a => a.provider === 'openai')?.fit_analysis;
const claude_fit_result = fitAnalysis?.fit_analyses?.find(a => a.provider === 'anthropic')?.fit_analysis;

const openai_fit_score = openai_fit_result?.fit_percentage;
const claude_fit_score = claude_fit_result?.fit_percentage;
const openai_ats_score = openai_fit_result?.ats_compatibility?.overall_ats_score;
const claude_ats_score = claude_fit_result?.ats_compatibility?.overall_ats_score;
```

### Added Debug Logging

Also added detailed logging in [Dashboard.jsx](frontend/src/components/Dashboard.jsx:287-293):
```javascript
console.log('[DEBUG] Fit Analysis Response Keys:', Object.keys(fitData));
console.log('[DEBUG] Full fitData structure:', JSON.stringify(fitData, null, 2));
console.log('[DEBUG] Has analyses?', 'analyses' in fitData);
if (fitData.analyses) {
  console.log('[DEBUG] Analyses:', fitData.analyses);
}
```

This helps developers see the actual response structure when debugging.

## Testing

1. Go to "Tailor CV" page
2. Paste a job description
3. Click "Analyze with AI"
4. Wait for Profile Fit Analysis to complete
5. Check browser console - should see full fitData structure logged
6. Click "Tailor My CV"
7. Click "💾 Save This Tailored CV"
8. Enter job title and company
9. Check console - should now show scores being saved:
   ```
   [DEBUG] Saving CV with scores: {
     openai_fit_score: 85,
     claude_fit_score: 88,
     openai_ats_score: 92,
     claude_ats_score: 90,
     ...
   }
   ```
10. Go to "Saved CVs" page
11. Should see actual scores displayed instead of N/A

## Expected Result

**Before Fix**:
```
Profile Fit: 🟢 N/A  🔵 N/A
ATS Score:   🟢 N/A  🔵 N/A
```

**After Fix**:
```
Profile Fit: 🟢 85%  🔵 88%
ATS Score:   🟢 92%  🔵 90%
```

## Version
Backend: **v1.5.2** (version bump for tracking)
Frontend: Updated

## Related Files

- [Dashboard.jsx](frontend/src/components/Dashboard.jsx:437-445) - Score extraction fix
- [Dashboard.jsx](frontend/src/components/Dashboard.jsx:287-293) - Debug logging
- [schemas.py](backend/schemas.py:261-265) - API response structure
- [profile_fit_service.py](backend/profile_fit_service.py:82-100) - Score field names
- [TailoredCVs.jsx](frontend/src/components/TailoredCVs.jsx:280-320) - Display logic (already fixed)
- [VERSION](backend/VERSION) - Updated to 1.5.2
