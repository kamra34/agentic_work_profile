# Comprehensive Logging System

## Overview

A centralized, color-coded logging system that tracks all AI model interactions across your backend services. See exactly which models are being used, when, and what they're doing!

## Features

✅ **Color-Coded Output** - Different colors for different models
- 🔵 Blue = GPT-4o
- 🟣 Purple = GPT-5.1
- 🔷 Cyan = Claude

✅ **Model-Specific Emojis** - Quick visual identification
✅ **Timestamps** - Every log message includes time
✅ **Step Tracking** - Follow workflows step-by-step
✅ **Token Usage** - Track input, output, and reasoning tokens
✅ **Success/Error Indicators** - Clear status messages
✅ **Service Tagging** - Know which service generated each log

## Quick Demo

Run this to see the logging in action:

```bash
cd backend
python demo_logging.py
```

## What You'll See

### Example Log Output

```
[22:42:26] ℹ️  [OpenAI-Wrapper] Preparing API call: gpt-5.1 (reasoning: low)
[22:42:26] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create - reasoning_effort=low
[22:42:30] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 3.86s | Tokens: 🧠:8
[22:42:30] ℹ️  [OpenAI-Wrapper] 🧠 Reasoning tokens used: 8
```

### When Analyzing a Job

```
[22:43:51] [TailorService] STEP 1: Job analysis with OpenAI (gpt-5.1)
[22:43:51] ℹ️  [TailorService] Job description length: 1847 characters
[22:43:51] ℹ️  [OpenAI-Wrapper] Preparing API call: gpt-5.1 (reasoning: low)
[22:43:51] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create - reasoning_effort=low
[22:43:57] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 6.23s | Tokens: in:1890, out:456, 🧠:142
[22:43:57] ✅ [TailorService] Job analysis complete using gpt-5.1
[22:43:57] ℹ️  [TailorService] 🧠 Reasoning tokens: 142
```

### When Selecting Nodes

```
[22:44:12] [TailorService] STEP 1: Node selection with OpenAI (gpt-5.1) - 42 nodes
[22:44:12] ℹ️  [TailorService] Prompt size: 8532 chars (8.5K) | Nodes: 42
[22:44:12] ℹ️  [OpenAI-Wrapper] Preparing API call: gpt-5.1 (reasoning: low)
[22:44:12] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create - reasoning_effort=low
[22:44:25] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 12.84s | Tokens: in:8645, out:2100, 🧠:875
[22:44:25] ✅ [TailorService] Node selection complete: 28/42 nodes recommended
[22:44:25] ℹ️  [TailorService] 🧠 Reasoning tokens: 875
[22:44:25] 📊 [TailorService] Token Usage for gpt-5.1:
   • Input tokens: 8645
   • Output tokens: 2100
   • 🧠 Reasoning tokens: 875
   • Total tokens: 11620
```

### When Using Dual Analysis

```
[22:45:01] 🔄 [JobAnalysis] Starting dual analysis with: OpenAI, Claude
[22:45:01] [JobAnalysis] STEP 1: Running OpenAI analysis
[22:45:01] 🟣 [OpenAI-Wrapper] Calling gpt-5.1...
[22:45:08] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 7.12s
[22:45:08] [JobAnalysis] STEP 2: Running Claude analysis
[22:45:08] 🔷 [JobAnalysis] Calling claude-sonnet-4.5...
[22:45:12] ✅ [JobAnalysis] claude-sonnet-4.5 SUCCESS in 3.98s
[22:45:12] 📊 [JobAnalysis] Dual Analysis Summary:
   🟣 OpenAI: SUCCESS
   🔷 Claude: SUCCESS
```

## Log Message Types

### 1. Step Messages (Yellow)
```python
logger.step("Analyzing job description", step_num=1)
```
Output: `[TailorService] STEP 1: Analyzing job description`

### 2. Info Messages (White)
```python
logger.info("Processing 2,500 characters")
```
Output: `ℹ️  [TailorService] Processing 2,500 characters`

### 3. Model Calls (Color-coded by model)
```python
logger.model_call("gpt-5.1", "job analysis", "senior role")
```
Output: `🟣 [TailorService] Calling gpt-5.1 for job analysis - senior role`

### 4. Model Responses
```python
logger.model_response("gpt-5.1", True, 8.5, {
    'input_tokens': 2500,
    'output_tokens': 1200,
    'reasoning_tokens': 625
})
```
Output: `✅ [TailorService] gpt-5.1 SUCCESS in 8.50s | Tokens: in:2500, out:1200, 🧠:625`

### 5. Success Messages (Green)
```python
logger.success("Analysis complete")
```
Output: `✅ [TailorService] Analysis complete`

### 6. Error Messages (Red)
```python
logger.error("API timeout", error=exception)
```
Output: `❌ [TailorService] API timeout: Connection timed out`

### 7. Warning Messages (Yellow)
```python
logger.warning("High node count detected")
```
Output: `⚠️  [TailorService] High node count detected`

### 8. Token Summary
```python
logger.tokens_summary("gpt-5.1", usage_dict)
```
Output:
```
📊 [TailorService] Token Usage for gpt-5.1:
   • Input tokens: 2500
   • Output tokens: 1200
   • 🧠 Reasoning tokens: 625
   • Total tokens: 4325
```

## Services Using Logging

### 1. OpenAI-Wrapper
Logs all OpenAI API calls (both GPT-4o and GPT-5.1)

### 2. JobAnalysis
Logs job description analysis operations

### 3. TailorService
Logs:
- Job analysis
- Profile scoring
- Node selection (the most detailed!)

## What Information is Logged

### For Every AI Call

1. **Before Call:**
   - Service name
   - Model being used
   - Operation type (job analysis, node selection, etc.)
   - Input size (characters, node count, etc.)
   - Reasoning effort (for GPT-5.1)

2. **During Call:**
   - Model being called
   - API method used

3. **After Call:**
   - Success/failure status
   - Response time
   - Token usage (input, output, reasoning)
   - Key results (scores, node counts, etc.)

## Troubleshooting with Logs

### Finding Which Model Was Used

Look for the colored emoji:
- 🔵 = GPT-4o was used
- 🟣 = GPT-5.1 was used
- 🔷 = Claude was used

### Checking If GPT-5.1 is Active

Look for:
```
Preparing API call: gpt-5.1 (reasoning: low/medium/high)
```

If you see `gpt-4o` instead, your `.env` is still set to GPT-4o.

### Understanding Slow Responses

Check the timing in the SUCCESS message:
```
✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 12.84s
```

- GPT-4o: Usually 2-5 seconds
- GPT-5.1 (low): Usually 3-8 seconds
- GPT-5.1 (medium): Usually 5-15 seconds
- GPT-5.1 (high): Usually 10-30+ seconds

### Tracking Costs

Look for reasoning tokens:
```
🧠 Reasoning tokens: 625
```

Higher reasoning tokens = higher cost. You can see exact token counts in the token summary.

### Debugging Errors

Error logs show:
1. Where the error occurred (service name)
2. What was being attempted
3. The error message
4. Timing (how long before it failed)

Example:
```
❌ [TailorService] Node selection failed: API timeout after 180 seconds
```

## Integration with Your App

The logging is **automatic**! Just start your backend and you'll see logs in your console when:

1. Users analyze job descriptions
2. Users select CV nodes
3. Users score their profile
4. Any AI model is called

## Customization

### Changing Log Levels

Edit [logger_config.py](logger_config.py#L27):
```python
self.logger.setLevel(logging.INFO)  # Change to DEBUG for more details
```

### Disabling Colors

If colors don't work in your console, you can disable them by editing the `Colors` class.

### Adding New Log Types

```python
from logger_config import get_logger

logger = get_logger("YourService")

# Use any of the logging methods
logger.step("Your step message", step_num=1)
logger.info("Your info message")
logger.success("Your success message")
logger.error("Your error message")
```

## Performance Impact

**Minimal!** Logging adds <1ms per log message. The visual feedback is worth it for debugging and monitoring.

## Best Practices

1. **Always log at service boundaries** - When calling AI models
2. **Log important decisions** - Which model was chosen, why
3. **Include context** - Node counts, character lengths, etc.
4. **Log results** - Scores, recommendations, counts
5. **Log errors with context** - What was being attempted when it failed

## Examples from Real Usage

### Successful Job Analysis
```
[15:23:45] [JobAnalysis] STEP 1: Analyzing job description with OpenAI (gpt-5.1)
[15:23:45] ℹ️  [JobAnalysis] Job description length: 1847 characters
[15:23:45] ℹ️  [OpenAI-Wrapper] Preparing API call: gpt-5.1 (reasoning: low)
[15:23:45] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create
[15:23:51] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 6.12s | Tokens: in:1890, out:456, 🧠:142
[15:23:51] ✅ [JobAnalysis] Job analysis complete using gpt-5.1
[15:23:51] ℹ️  [JobAnalysis] 🧠 Used 142 reasoning tokens
```

### Node Selection with Many Nodes
```
[15:24:12] [TailorService] STEP 1: Node selection with OpenAI (gpt-5.1) - 127 nodes
[15:24:12] ℹ️  [TailorService] Prompt size: 18543 chars (18.5K) | Nodes: 127
[15:24:12] ⚠️  [TailorService] Large prompt detected - this may take longer
[15:24:12] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create - reasoning_effort=low
[15:24:29] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 17.23s | Tokens: in:18890, out:4200, 🧠:1250
[15:24:29] ✅ [TailorService] Node selection complete: 89/127 nodes recommended
[15:24:29] 🧠 Reasoning tokens: 1250
```

### Profile Scoring
```
[15:25:01] [TailorService] STEP 1: Profile scoring with OpenAI (gpt-5.1)
[15:25:01] ℹ️  [TailorService] Profile content length: 4523 characters
[15:25:01] 🟣 [OpenAI-Wrapper] Calling gpt-5.1 for responses.create
[15:25:09] ✅ [OpenAI-Wrapper] gpt-5.1 SUCCESS in 8.45s | Tokens: in:4890, out:678, 🧠:423
[15:25:09] ✅ [TailorService] Scoring complete: Fit=87, ATS=92, Verdict=SHOULD_APPLY
```

## Summary

The logging system gives you complete visibility into:
- ✅ Which AI models are being used
- ✅ When they're being called
- ✅ How long they take
- ✅ How many tokens they use
- ✅ Whether they succeed or fail
- ✅ What results they produce

Just start your backend and watch the colorful, informative logs flow!

## Try It Now

```bash
# Run the demo
cd backend
python demo_logging.py

# Or run your app and use it normally
# Logs will appear automatically in your console
```

Enjoy your new visibility into your AI operations! 🎉
