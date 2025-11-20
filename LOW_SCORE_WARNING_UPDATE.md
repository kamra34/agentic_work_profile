# Low Score Warning - Update

## Added "Discard Analysis" Button to Step 2

### What Changed

When low scores are detected (<75), the "Discard Analysis" button now appears in Step 2's action buttons, making it easy to skip the job without having to proceed to Step 3.

### Button Layout (Step 2 - When Low Scores Detected)

```
[← Back]  [🗑️ Discard Analysis]  [Continue to Selection →]
```

- **← Back** - Return to Step 1 (Job Details)
- **🗑️ Discard Analysis** - Only visible when low scores detected; discards analysis and resets workflow
- **Continue to Selection →** - Proceed to Step 3 anyway (if user wants to continue despite low scores)

### Implementation

**1. Added `onDiscard` prop to Step2AIAnalysis** ([TailorCV.jsx:994](frontend/src/components/TailorCV.jsx#L994))

```jsx
<Step2AIAnalysis
  // ... other props
  onDiscard={handleDiscardAnalysis}
/>
```

**2. Updated function signature** ([TailorCV.jsx:1309](frontend/src/components/TailorCV.jsx#L1309))

```jsx
function Step2AIAnalysis({
  // ... other params
  onDiscard
}) {
```

**3. Added conditional Discard button** ([TailorCV.jsx:1824-1850](frontend/src/components/TailorCV.jsx#L1824-L1850))

```jsx
{/* Show Discard button if there are low scores */}
{scores && !recommendations && (() => {
  const openaiScores = scores.openai?.scores;
  const claudeScores = scores.claude?.scores;
  const allScores = [
    { value: openaiScores?.fit_score },
    { value: openaiScores?.ats_score },
    { value: claudeScores?.fit_score },
    { value: claudeScores?.ats_score }
  ].filter(s => s.value !== undefined && s.value !== null);

  const hasLowScores = allScores.some(s => s.value < 75);

  if (hasLowScores) {
    return (
      <button
        className="btn-discard-analysis"
        onClick={onDiscard}
        title="Discard this analysis and start over"
      >
        <span className="btn-icon">🗑️</span>
        <span className="btn-text">Discard Analysis</span>
      </button>
    );
  }
  return null;
})()}
```

### User Experience

**High Scores (All ≥75):**
- Action buttons: `[← Back] [Continue to Selection →]`
- No Discard button (not needed, good match)

**Low Scores (Any <75):**
- Action buttons: `[← Back] [🗑️ Discard Analysis] [Continue to Selection →]`
- Discard button appears between Back and Continue
- User can easily skip the job without proceeding to Step 3

### What Happens When User Clicks "Discard Analysis"

1. **Confirmation dialog appears:**
   ```
   🗑️ Discard Analysis?

   This will clear all AI recommendations and reset the workflow.
   You will need to start over from Step 1.

   Are you sure you want to discard this analysis?
   ```

2. **If user confirms:**
   - All analysis data is cleared
   - Workflow resets to Step 1
   - Status bar is cleared
   - User can paste a new job description

3. **If user cancels:**
   - Nothing happens
   - User remains on Step 2

### Benefits

✅ **Easier to skip** - No need to proceed to Step 3 just to discard
✅ **Clear option** - Button is visible right when low scores are detected
✅ **Saves time** - Can abandon immediately if scores are too low
✅ **Better UX** - User has full control at the point of decision

### Testing

**To test low score discard:**

1. Use a job description poorly matched to your profile
2. Wait for Step 2 to complete scoring
3. Warning banner appears with low scores
4. Check bottom of page - should see three buttons:
   - ← Back
   - 🗑️ Discard Analysis (NEW!)
   - Continue to Selection →
5. Click "Discard Analysis"
6. Confirm dialog
7. Should reset to Step 1

**To test high score flow (no discard button):**

1. Use a well-matched job description
2. Wait for Step 2 to complete
3. Should auto-advance to Step 3 (no stopping)
4. If you go back to Step 2, should see only two buttons:
   - ← Back
   - Continue to Selection →
5. No Discard button (not needed for good matches)

## Summary

The "Discard Analysis" button now appears in Step 2 when low scores are detected, making it easy for users to abandon poor-match jobs without having to proceed to Step 3. This improves the user experience by providing the exit option right at the point where the decision is made.
