# GPT-4o to GPT-5.1 Migration Guide

## Quick Start

**TL;DR:** Just change one line in your `.env` file to switch models:

```bash
# In .env file
OPENAI_MODEL_VERSION=gpt-5.1  # Change from gpt-4o to gpt-5.1
OPENAI_REASONING_EFFORT=medium
```

That's it! No code changes needed.

## What Changed

### ✅ What You Can Do Now

1. **Switch models instantly** via environment variable
2. **Test both models** side-by-side
3. **Override model per request** in code
4. **Track reasoning tokens** for GPT-5.1
5. **Roll back easily** if issues arise

### 📦 Files Added

- `backend/openai_wrapper.py` - New unified wrapper
- `backend/test_openai_wrapper.py` - Test suite
- `backend/OPENAI_WRAPPER_README.md` - Full documentation
- `MIGRATION_GUIDE.md` - This file

### 🔧 Files Modified

- `backend/job_analysis_service.py` - Now uses wrapper
- `backend/ai_tailor_service.py` - Now uses wrapper (3 functions)
- `.env` - Added model configuration

### ❌ No Breaking Changes

- All existing API endpoints work the same
- Frontend code unchanged
- Response format unchanged
- Backward compatible with GPT-4o

## Step-by-Step Migration

### Option 1: Gradual Migration (Recommended)

Test GPT-5.1 on specific features before full rollout.

**Step 1: Test locally**
```bash
cd backend
python test_openai_wrapper.py --model gpt-5.1
```

**Step 2: Try one feature with GPT-5.1**

In your code, override the model for a specific call:
```python
# Test job analysis with GPT-5.1
result = analyze_job_with_openai(
    job_description=job_text,
    model="gpt-5.1"  # Override to test
)
```

**Step 3: Monitor results**
- Check response quality
- Monitor response time (GPT-5.1 is slower)
- Check reasoning tokens in logs

**Step 4: If satisfied, update `.env`**
```bash
OPENAI_MODEL_VERSION=gpt-5.1
```

**Step 5: Deploy and monitor**
- Deploy to production
- Watch error logs
- Monitor API costs (GPT-5.1 costs ~4x more)

### Option 2: Immediate Switch

If you're confident:

**Step 1: Update `.env`**
```bash
OPENAI_MODEL_VERSION=gpt-5.1
OPENAI_REASONING_EFFORT=medium
```

**Step 2: Restart backend**
```bash
# Stop backend
# Start backend again
```

**Step 3: Monitor**
- Check logs for errors
- Verify API calls succeed
- Monitor costs

## Verification Tests

### Test 1: Basic Functionality

```bash
cd backend
python test_openai_wrapper.py --model gpt-5.1
```

Expected output:
```
🎉 ALL TESTS PASSED!
```

### Test 2: Job Analysis

Analyze a real job description through your app:
1. Go to "Tailor CV" page
2. Paste a job description
3. Click "Analyze Job"
4. Check response quality

Look for in logs:
```
📤 [OpenAI-Recommend] Sending request to gpt-5.1...
🧠 [OpenAI-Recommend] Used XXX reasoning tokens
✅ [OpenAI-Recommend] Success!
```

### Test 3: Node Selection

Select nodes for a CV:
1. Continue from job analysis
2. Click "Select Nodes" or equivalent
3. Verify nodes are selected properly

### Test 4: Profile Scoring

Score your profile against a job:
1. Use the scoring feature
2. Verify fit_score and ats_score are returned
3. Check reasoning quality

## Rollback Plan

If issues occur, rolling back is simple:

**Step 1: Update `.env`**
```bash
OPENAI_MODEL_VERSION=gpt-4o  # Change back
```

**Step 2: Restart backend**

**Step 3: Verify**
```bash
python test_openai_wrapper.py --model gpt-4o
```

That's it! No code changes needed.

## Performance Comparison

Based on test results:

### GPT-4o
- **Speed**: ~2 seconds per request
- **Cost**: ~$0.005 per job analysis
- **Consistency**: Very high (forced JSON mode)
- **Quality**: Good

### GPT-5.1
- **Speed**: ~5-10 seconds per request (2-5x slower)
- **Cost**: ~$0.022 per job analysis (4x more expensive)
- **Consistency**: High (with proper prompting)
- **Quality**: Better reasoning, more thoughtful

**Example from tests:**

| Model | Test | Tokens Used | Reasoning Tokens | Time |
|-------|------|-------------|------------------|------|
| GPT-4o | Simple JSON | 125 | 0 | ~2s |
| GPT-5.1 | Simple JSON | 153 | 19 | ~4s |
| GPT-4o | Job Analysis | ~175 | 0 | ~2s |
| GPT-5.1 | Job Analysis | ~254 | 101 | ~7s |

## Cost Estimation

For 1000 job analyses per month:

### GPT-4o
- Input: ~500 tokens × $2.50/1M = $0.00125
- Output: ~400 tokens × $10.00/1M = $0.004
- **Total: ~$5.25/month**

### GPT-5.1
- Input: ~500 tokens × $5.00/1M = $0.0025
- Output: ~400 tokens × $20.00/1M = $0.008
- Reasoning: ~600 tokens × $20.00/1M = $0.012
- **Total: ~$22.50/month** (4.3x increase)

**For 10,000 analyses/month:** GPT-4o = $52, GPT-5.1 = $225

## Troubleshooting

### Issue: "Invalid model" error

Check `.env` file:
```bash
# Must be exactly one of these
OPENAI_MODEL_VERSION=gpt-4o
# or
OPENAI_MODEL_VERSION=gpt-5.1
```

### Issue: Slow responses

GPT-5.1 is slower due to reasoning. Options:
1. Lower reasoning effort: `OPENAI_REASONING_EFFORT=low`
2. Use GPT-5.1 selectively (only for complex tasks)
3. Stick with GPT-4o for speed-critical features

### Issue: Higher costs than expected

GPT-5.1 has reasoning tokens. To reduce costs:
1. Use `reasoning_effort=low`
2. Use GPT-5.1 only for critical features
3. Use GPT-4o for simple tasks

### Issue: JSON parsing errors

This should be rare with the wrapper's automatic JSON prompting.

If it happens:
1. Check the raw response in error logs
2. Ensure prompts are clear
3. Try GPT-4o as fallback

## Best Practices

### When to Use GPT-5.1

✅ **Use GPT-5.1 for:**
- Job description analysis (complex reasoning)
- Profile scoring (needs careful evaluation)
- Node selection (requires judgment)

### When to Use GPT-4o

✅ **Use GPT-4o for:**
- Quick CV parsing
- Simple text extraction
- High-volume operations
- Time-sensitive requests

### Hybrid Approach (Advanced)

Use different models for different tasks:

```python
# In your route handlers

# Job analysis - use GPT-5.1 for quality
job_analysis = analyze_job_with_openai(
    job_description=job_text,
    model="gpt-5.1"
)

# Node selection - use GPT-5.1 for careful selection
node_recommendations = recommend_nodes_with_openai(
    job_requirements=job_analysis,
    profile_nodes=nodes,
    model="gpt-5.1"
)

# Simple parsing - use GPT-4o for speed
cv_parsed = parse_cv_with_openai(
    cv_text=cv_text,
    model="gpt-4o"
)
```

## Monitoring

### Key Metrics to Track

1. **Response Time**
   - GPT-4o: Should be < 5 seconds
   - GPT-5.1: Should be < 15 seconds

2. **Error Rate**
   - Both: Should be < 1%

3. **Reasoning Tokens (GPT-5.1)**
   - Low effort: 50-200 tokens
   - Medium effort: 200-800 tokens
   - High effort: 800-2000 tokens

4. **API Costs**
   - Monitor daily spend
   - Set up alerts for unusual spikes

### Logging

The wrapper automatically logs useful information:

```
📤 [OpenAI-Recommend] Sending request to gpt-5.1...
📏 [OpenAI-Recommend] Prompt length: 2.5K characters
📥 [OpenAI-Recommend] Response received in 8.45s
🧠 [OpenAI-Recommend] Used 625 reasoning tokens
✅ [OpenAI-Recommend] Success! Parsed 42 node recommendations
```

## FAQ

**Q: Can I mix both models in the same application?**
A: Yes! Override the model parameter per function call.

**Q: Will my frontend need changes?**
A: No, the API response format is identical.

**Q: What happens if OpenAI deprecates GPT-4o?**
A: The wrapper makes it easy to switch. Just update the model name.

**Q: Can I use different reasoning efforts for different tasks?**
A: Yes, pass `reasoning_effort` parameter to each call.

**Q: How do I know which model was used for a request?**
A: Check the response: `result["model"]` will be "gpt-4o" or "gpt-5.1".

**Q: Can I A/B test both models?**
A: Yes! Call the same function twice with different models and compare.

## Success Criteria

You'll know the migration is successful when:

✅ All tests pass with GPT-5.1
✅ Job analysis works in production
✅ Node selection works properly
✅ Profile scoring is accurate
✅ No increase in error rates
✅ Response quality meets expectations
✅ Costs are within budget

## Next Steps

After successful migration:

1. **Optimize reasoning effort** based on quality vs. cost
2. **Implement hybrid approach** (different models for different tasks)
3. **Set up cost alerts** to monitor spending
4. **Collect quality metrics** to validate improvement
5. **Consider caching** common requests

## Support

If you encounter issues:

1. Check logs for error messages
2. Run `test_openai_wrapper.py`
3. Review `backend/OPENAI_WRAPPER_README.md`
4. Try rolling back to GPT-4o
5. Check OpenAI API status: https://status.openai.com/

## Summary

The migration to GPT-5.1 is:
- ✅ **Simple** - One line in `.env`
- ✅ **Safe** - Easy rollback
- ✅ **Flexible** - Use both models
- ✅ **Tested** - Full test suite passing
- ✅ **Documented** - Complete guides available

You're ready to migrate! 🚀
