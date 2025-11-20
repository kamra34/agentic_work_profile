# Low Score Warning Feature

## Overview

The Tailor CV workflow now automatically stops the auto-advance flow when **any score (Fit or ATS) from either model (OpenAI or Claude) is below 75**. This gives users a chance to review low-scoring job matches before wasting time on CV customization.

## How It Works

### Automatic Flow (Before)
```
Step 1: Job Details
  ↓ (auto-advance)
Step 2: AI Analysis → Job Analysis → Scoring → Node Recommendations
  ↓ (auto-advance)
Step 3: Smart Selection
```

### New Behavior (After)

#### High Scores (All ≥75)
```
Step 1: Job Details
  ↓ (auto-advance)
Step 2: AI Analysis → Job Analysis → Scoring ✅ → Node Recommendations
  ↓ (auto-advance)
Step 3: Smart Selection
```

#### Low Scores (Any <75)
```
Step 1: Job Details
  ↓ (auto-advance)
Step 2: AI Analysis → Job Analysis → Scoring ⚠️ → STOP
  ↑
  User stays here with warning banner
  User must manually click "Continue to Selection" or "Discard Analysis"
```

## Scores Checked

The system checks **4 scores total**:

1. **OpenAI Fit Score** (0-100)
2. **OpenAI ATS Score** (0-100)
3. **Claude Fit Score** (0-100)
4. **Claude ATS Score** (0-100)

If **ANY** of these 4 scores is **below 75**, the auto-advance stops.

## User Experience

### When Scores Are High (≥75)

✅ **No interruption** - workflow continues automatically
✅ **Background recommendations** - node selection happens in parallel
✅ **Smooth experience** - user can proceed immediately to Step 3

### When Scores Are Low (<75)

⚠️ **Warning Banner Appears:**

```
┌──────────────────────────────────────────────────┐
│ ⚠️  Low Match Scores Detected                     │
│                                                   │
│ Some scores are below 75, indicating a weaker    │
│ match for this role:                             │
│                                                   │
│ • OpenAI Fit Score: 68/100                       │
│ • Claude ATS Score: 72/100                       │
│                                                   │
│ Options:                                         │
│ • Review the analysis below and decide if you    │
│   still want to apply                            │
│ • Click "Continue to Selection" to proceed       │
│   anyway and customize your CV                   │
│ • Click "Discard Analysis" to skip this job      │
└──────────────────────────────────────────────────┘
```

⚠️ **Auto-advance STOPS** - no automatic move to Step 3
⚠️ **User must decide** - review scores and choose to continue or discard

## Backend Console Log

When low scores are detected:

```
Scoring result: {openai: {...}, claude: {...}}
⚠️ Low scores detected, stopping auto-advance: [
  { model: 'OpenAI', type: 'fit', value: 68 },
  { model: 'Claude', type: 'ATS', value: 72 }
]
Low scores: OpenAI fit: 68, Claude ATS: 72
```

## Frontend Implementation

### 1. Score Check Logic ([TailorCV.jsx:389-413](frontend/src/components/TailorCV.jsx#L389-L413))

After scoring completes:

```javascript
// Check if any score is below 75
const openaiScores = data.openai?.scores;
const claudeScores = data.claude?.scores;

const scores = [
  { model: 'OpenAI', type: 'fit', value: openaiScores?.fit_score },
  { model: 'OpenAI', type: 'ATS', value: openaiScores?.ats_score },
  { model: 'Claude', type: 'fit', value: claudeScores?.fit_score },
  { model: 'Claude', type: 'ATS', value: claudeScores?.ats_score }
].filter(s => s.value !== undefined && s.value !== null);

const lowScores = scores.filter(s => s.value < 75);

if (lowScores.length > 0) {
  // Stop auto-advance
  console.log('⚠️ Low scores detected, stopping auto-advance:', lowScores);
  setAnalysisStep('scoring');
  setAnalysisProgress(`⚠️ Low match scores detected. Review results before continuing.`);
  setIsAnalyzing(false);
  return; // Don't proceed to recommendations
}

// Continue with auto-advance
console.log('✅ Scoring complete, all scores ≥75, auto-triggering recommendations...');
// ... continue to recommendations
```

### 2. Warning Banner ([TailorCV.jsx:1482-1517](frontend/src/components/TailorCV.jsx#L1482-L1517))

Displays prominent warning in Step 2:

```jsx
{/* Low Score Warning - if any score is below 75 */}
{scores && !recommendations && (() => {
  const openaiScores = scores.openai?.scores;
  const claudeScores = scores.claude?.scores;
  const allScores = [
    { model: 'OpenAI', type: 'Fit', value: openaiScores?.fit_score },
    { model: 'OpenAI', type: 'ATS', value: openaiScores?.ats_score },
    { model: 'Claude', type: 'Fit', value: claudeScores?.fit_score },
    { model: 'Claude', type: 'ATS', value: claudeScores?.ats_score }
  ].filter(s => s.value !== undefined && s.value !== null);

  const lowScores = allScores.filter(s => s.value < 75);

  if (lowScores.length === 0) return null;

  return (
    <div className="low-score-warning">
      <span className="low-score-icon">⚠️</span>
      <div className="low-score-text">
        <strong>Low Match Scores Detected</strong>
        <p>Some scores are below 75, indicating a weaker match for this role:</p>
        <ul className="low-score-list">
          {lowScores.map((s, i) => (
            <li key={i}>{s.model} {s.type} Score: {s.value}/100</li>
          ))}
        </ul>
        <p><strong>Options:</strong></p>
        <ul>
          <li>Review the analysis below and decide if you still want to apply</li>
          <li>Click "Continue to Selection" to proceed anyway and customize your CV</li>
          <li>Click "Discard Analysis" to skip this job</li>
        </ul>
      </div>
    </div>
  );
})()}
```

### 3. CSS Styling ([TailorCV.css:2565-2657](frontend/src/components/TailorCV.css#L2565-L2657))

Beautiful warning banner with:
- Yellow/orange gradient background
- Warning icon
- Clear messaging
- Slide-in animation
- Dark mode support

## Benefits

### Time Saving
✅ **Avoid wasting time** on low-match jobs
✅ **Quick decision** - see warning immediately after scoring
✅ **Early exit** - can discard before CV customization

### User Control
✅ **Informed decision** - see exactly which scores are low
✅ **Flexible** - can still proceed if desired
✅ **Clear options** - continue or discard

### Better UX
✅ **Automatic for good matches** - no interruption when scores are high
✅ **Manual for poor matches** - requires user review when scores are low
✅ **Transparent** - shows exact scores that triggered the warning

## Testing

### Test High Scores (No Warning)

1. **Use a well-matched job description** (similar to your profile)
2. **Run Tailor CV workflow**
3. **Expected:** Automatic flow to Step 3, no warning

**Console:**
```
✅ Scoring complete, all scores ≥75, auto-triggering recommendations in background...
```

### Test Low Scores (Warning Shown)

1. **Use a poorly-matched job description** (very different from your profile)
2. **Run Tailor CV workflow**
3. **Expected:**
   - Flow stops at Step 2
   - Yellow warning banner appears
   - Lists low scores
   - User must click "Continue" or "Discard"

**Console:**
```
⚠️ Low scores detected, stopping auto-advance: [...]
Low scores: OpenAI fit: 68, Claude ATS: 72
```

### Test Edge Cases

**Exactly 75:**
- Score of 75 is **NOT** considered low
- Auto-advance continues

**One low score:**
- Even if only 1 of 4 scores is below 75, warning appears
- Example: OpenAI Fit = 74, all others = 90 → Warning shown

**Missing scores:**
- If a model fails, only available scores are checked
- Example: OpenAI fails, only Claude scores checked

## Configuration

The threshold is currently hardcoded to **75**. To change it:

**In TailorCV.jsx (2 places):**

```javascript
// Line ~400 and ~1493
const lowScores = scores.filter(s => s.value < 75);  // Change 75 to your threshold
```

## Future Enhancements

Potential improvements:

1. **Configurable threshold** - Allow users to set their own threshold (e.g., 70, 80)
2. **Score context** - Show average scores for similar jobs
3. **Historical data** - "This is your lowest scoring job this month"
4. **Recommendation** - AI suggests whether to apply based on patterns
5. **Partial proceed** - "Scores are low but you have X matching keywords - might be worth a shot"

## Summary

**What changed:**
- Added automatic score check after scoring completes
- Stop auto-advance if any score < 75
- Show prominent warning banner with low score details
- Give user control to continue or discard

**Why it's useful:**
- Saves time on poor matches
- Gives users informed decision-making
- Maintains smooth flow for good matches
- Provides clear feedback on match quality

**User experience:**
- High scores (≥75): Seamless auto-advance ✅
- Low scores (<75): Stop and review ⚠️

Now users won't waste time tailoring CVs for jobs they're not a good match for! 🎯
