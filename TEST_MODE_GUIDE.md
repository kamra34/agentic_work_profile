# Test Mode Guide - CV Tailoring Feature

## Overview
Test mode allows you to quickly test the CV tailoring feature without running actual AI analysis. This speeds up development and debugging.

## How to Use Test Mode

### 1. Activate Test Mode
In the "Tailor CV" section of the dashboard, click the **"🧪 Load Test Data"** button.

This will:
- Load mock job analysis data
- Load mock fit analysis data (78% OpenAI, 72% Claude)
- Display ATS scores
- Show the "Tailor My CV" button
- Display a test mode banner

### 2. Test the CV Tailoring Flow
Once test data is loaded, you can:
1. Review the mock fit analysis with strengths and gaps
2. Review the ATS compatibility scores
3. Click the "📝 Tailor My CV for This Role" button
4. View AI recommendations for CV tailoring

### 3. Clear Test Data
Click the **"Clear"** button to reset and exit test mode.

## Mock Data Contents

The test data includes:

### Job Analysis
- **Position**: Senior Leadership Role - Head of Data & AI
- **Level**: Senior/Executive
- **Key Skills**: AI/ML Strategy, Data Architecture, Microsoft Azure, Databricks
- **Experience**: 7-10+ years of leadership in AI/ML

### Fit Analysis - OpenAI (78% Match)
**Strengths:**
- PhD in Electrical Engineering with AI focus
- Extensive leadership experience in AI and data science
- Strong AI/ML model development skills
- Strategic leadership track record

**Gaps:**
- Lacks Microsoft Azure and Databricks experience
- Limited regulated industries experience
- No data lake/lakehouse platform expertise

**ATS Score**: 76/100

### Fit Analysis - Claude (72% Match)
**Strengths:**
- 5+ years AI/ML leadership
- Strong GenAI and LLM experience
- Production AI model operationalization
- PhD in relevant field

**Gaps:**
- No Azure experience (has AWS instead)
- No Databricks experience
- Missing 7-10+ years requirement
- No financial services experience

**ATS Score**: 67/100

## Development Workflow

### Current Workflow (Without Test Mode)
1. Paste job description
2. Click "Analyze with AI" (wait 30-60 seconds)
3. Review analysis
4. Test CV tailoring features
5. Make code changes
6. Repeat from step 1 ❌ (time consuming)

### New Workflow (With Test Mode)
1. Click "Load Test Data" (instant)
2. Test CV tailoring features
3. Make code changes
4. Click "Clear" and repeat ✅ (fast iteration)

## When to Switch Back to Real Analysis

Before final testing or deployment:
1. Clear test mode
2. Paste a real job description
3. Run actual AI analysis
4. Verify everything works with real API calls
5. Test the full end-to-end flow

## Mock Data Location

The mock data structure is embedded in the `loadMockData()` function in [Dashboard.jsx](frontend/src/components/Dashboard.jsx:321-418).

To modify test data, edit the `mockData` object in that function.

## Visual Indicators

When test mode is active:
- Yellow warning banner: "⚠️ Test Mode Active - Using mock data for development"
- Banner pulses between orange borders
- All displayed data is from the mock dataset

## Next Steps

Once you're done testing with mock data:
1. The "Tailor My CV" button will call the real API endpoint
2. Backend will analyze your actual profile
3. AI models will provide real recommendations
4. You can save tailored versions to the database

## Benefits

✅ **Fast Iteration**: No waiting for AI API calls
✅ **Cost Savings**: No API usage during development
✅ **Consistent Testing**: Same data every time
✅ **Offline Development**: Work without internet
✅ **Easy Debugging**: Predictable test scenarios
