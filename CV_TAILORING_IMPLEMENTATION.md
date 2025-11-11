# CV Tailoring Feature Implementation Plan

## ✅ Completed So Far

### 1. Backend Services
- **`cv_tailoring_service.py`** - Created with dual AI model support
  - `tailor_cv_with_openai()` - GPT-4o analyzes and recommends specific items to include
  - `tailor_cv_with_claude()` - Claude Sonnet 4.5 analyzes and recommends
  - `tailor_cv_dual()` - Gets recommendations from both models
  - Recommends specific item IDs from master profile for:
    - Summary bullets (4-7 items)
    - Work experience entries and bullets
    - Skills
    - Education
    - Projects
    - Certifications
  - Includes strategy, keywords, and estimated page count

### 2. Database Model
- **`TailoredCVVersion`** model added to `models.py`
  - Stores job information (title, company, description)
  - Stores AI scores (OpenAI & Claude fit + ATS scores)
  - Stores selected content as JSON with item IDs
  - Stores AI recommendations for reference
  - Tracks application status (draft, applied, interview, rejected, offer)
  - User notes and timestamps

## 🔄 Next Steps Required

### 3. Database Migration
```bash
# Need to run in backend directory:
cd backend
alembic revision --autogenerate -m "Add tailored CV versions table"
alembic upgrade head
```

### 4. Backend API Endpoints (in `main.py`)
```python
# Add these endpoints:
POST /api/cv/tailor - Get AI recommendations for CV tailoring
POST /api/cv/tailored-versions - Save a tailored CV version
GET /api/cv/tailored-versions - List all tailored CV versions
GET /api/cv/tailored-versions/{id} - Get specific version
PUT /api/cv/tailored-versions/{id} - Update version
DELETE /api/cv/tailored-versions/{id} - Delete version
```

### 5. Schemas (in `schemas.py`)
```python
class CVTailoringRequest(BaseModel):
    job_analysis: Dict[str, Any]

class CVTailoringRecommendation(BaseModel):
    provider: str
    model: str
    recommendations: Dict[str, Any]
    error: Optional[str] = None

class CVTailoringResponse(BaseModel):
    job_analysis: Dict[str, Any]
    tailoring_recommendations: List[CVTailoringRecommendation]

class TailoredCVCreate(BaseModel):
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    selected_content: Dict[str, Any]
    openai_fit_score: Optional[int] = None
    claude_fit_score: Optional[int] = None
    openai_ats_score: Optional[int] = None
    claude_ats_score: Optional[int] = None
    openai_recommendations: Optional[Dict] = None
    claude_recommendations: Optional[Dict] = None
    notes: Optional[str] = None

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
    # ... other fields
```

### 6. Frontend Components

#### A. Add "Tailor My CV" Button
In the fit analysis section, after user sees scores:
```jsx
<button
  className="btn-tailor-cv"
  onClick={handleTailorCV}
>
  📝 Tailor My CV for This Role
</button>
```

#### B. CV Tailoring Review Modal/Page
- **Left Panel**: Master profile (all content)
- **Right Panel**: AI recommendations (2 tabs: OpenAI vs Claude)
- **For each section**:
  - Show all items with checkboxes
  - Pre-select AI recommended items
  - User can check/uncheck items
  - Show reasoning from AI for why items are recommended
- **Bottom**: Save button to save tailored version

#### C. Tailored CV Versions Table
In a new section or tab:
```jsx
<table>
  <thead>
    <tr>
      <th>Job Title</th>
      <th>Company</th>
      <th>OpenAI Fit</th>
      <th>Claude Fit</th>
      <th>OpenAI ATS</th>
      <th>Claude ATS</th>
      <th>Status</th>
      <th>Created</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {/* List all saved versions */}
  </tbody>
</table>
```

#### D. Update Export CV Section
- Show dropdown to select a tailored CV version
- When selected, pre-populate export with only selected items
- Export to PDF with only the tailored content

### 7. UI Flow

```
1. User analyzes job → sees fit & ATS scores
2. User clicks "Tailor My CV for This Role"
3. Show progress: "Getting AI recommendations..."
4. Display side-by-side review interface:
   - Master profile on left (all content)
   - AI recommendations on right (checkboxes)
   - Tabs to switch between OpenAI and Claude recommendations
5. User reviews and adjusts selections
6. User enters job title, company (optional)
7. User clicks "Save Tailored Version"
8. Success message + redirect to versions table
9. From Export section, user can select this version
10. Export generates PDF with only selected content
```

## Implementation Priority

1. **High Priority** (Core functionality):
   - Database migration
   - API endpoints
   - Schemas
   - "Tailor My CV" button and basic flow

2. **Medium Priority** (User experience):
   - Side-by-side review UI
   - Versions table view
   - Save/edit/delete versions

3. **Low Priority** (Polish):
   - Status tracking (draft → applied → interview)
   - Application notes
   - Advanced filtering in versions table

## Estimated Effort
- Backend (migrations, endpoints, schemas): 2-3 hours
- Frontend (UI components, state management): 4-5 hours
- Testing and refinement: 2 hours
- **Total**: ~8-10 hours of development

## Current Status
- **Backend services**: ✅ Complete
- **Database model**: ✅ Complete
- **Migration needed**: ⏳ Pending
- **API endpoints**: ⏳ Pending
- **Frontend**: ⏳ Pending
