# Implementation Summary: Hierarchical Profile Structure

## What's Been Implemented

### 1. Database Schema Changes

#### Added `parent_entry_id` Column
- **Table**: `section_entries`
- **Type**: `INTEGER REFERENCES section_entries(id) ON DELETE CASCADE`
- **Purpose**: Enables self-referential relationship for nested entries
- **Status**: ✅ Migrated

### 2. Model Updates

#### `SectionEntry` Model ([models.py:106-158](backend/models.py#L106-L158))
- Added `parent_entry_id` column for hierarchical structure
- Added self-referential relationships:
  - `parent_entry` - references parent entry
  - `sub_entries` - collection of child entries
- Updated docstring to explain hierarchical use cases

### 3. Schema Updates

#### Pydantic Schemas ([schemas.py](backend/schemas.py))
- **`SectionEntryCreate`**: Added `parent_entry_id` and `sub_entries` fields
- **`SectionEntryResponse`**: Added `parent_entry_id` and `sub_entries` for recursive response
- Added `model_rebuild()` calls to enable forward references for recursive models

### 4. API Endpoint Updates

#### Create Entry Endpoint ([main.py:339-420](backend/main.py#L339-L420))
- Supports creating entries with nested sub-entries in a single request
- Recursive function `create_sub_entries()` handles nested structure
- Properly sets `parent_entry_id` for child entries
- Maintains source tracking in `meta_info` field

### 5. Documentation

#### Files Created
1. **`HIERARCHICAL_STRUCTURE.md`** - Comprehensive guide covering:
   - Structure by section type (Summary, Education, Work Experience, Skills, Custom)
   - API usage examples
   - Response format
   - Frontend integration guidance
   - Database schema reference

2. **`test_hierarchical_structure.py`** - Test script demonstrating:
   - Summary section creation (direct content)
   - Education section (one-level entries)
   - Work experience (nested creation)
   - Work experience (incremental creation)
   - Skills section (categorized)

3. **`add_hierarchical_support.py`** - Migration script to add `parent_entry_id` column

## Structure by Section Type

### Summary Section
```
Section → content (text/bullets)
```
- No entries needed
- Direct content at section level

### Education Section
```
Section → Entry → Items (bullet points)
```
- One level: Degree → Bullet points
- Example: PhD → Thesis details, GPA, Publications

### Work Experience Section
```
Section → Entry (Company) → Sub-Entry (Role) → Items (bullet points)
```
- Two levels: Company → Role → Achievements
- Example: Ericsson → Line Manager → Team leadership achievements

### Skills Section
```
Section → Entry (Category) → Items (skills list)
```
- Flexible: Can be categorized or flat
- Example: Programming Languages → Python, JavaScript, Java

### Custom Sections
```
Section → Entry → Items (bullet points)
```
- Up to one level of nesting
- Example: Publications → Paper title → Details

## API Examples

### Create Summary (Direct Content)
```http
POST /api/profiles/1/sections
{
  "title": "Professional Summary",
  "section_type": "summary",
  "content_type": "paragraph",
  "content": "Experienced software engineer..."
}
```

### Create Education Entry
```http
POST /api/sections/{section_id}/entries
{
  "title": "PhD in Computer Science",
  "subtitle": "MIT",
  "start_date": "2015",
  "end_date": "2019",
  "items": [
    {"content": "Thesis: Machine Learning"}
  ]
}
```

### Create Work Experience (Nested)
```http
POST /api/sections/{section_id}/entries
{
  "title": "Ericsson",
  "subtitle": "Telecommunications",
  "start_date": "2019",
  "end_date": "Present",
  "sub_entries": [
    {
      "title": "Line Manager",
      "start_date": "2020",
      "end_date": "Present",
      "items": [
        {"content": "Led team of 10 engineers"}
      ]
    }
  ]
}
```

### Create Work Experience (Incremental)
```http
# Step 1: Create company
POST /api/sections/{section_id}/entries
{
  "title": "Google",
  "start_date": "2016",
  "end_date": "2019"
}
# Returns: {"id": 123}

# Step 2: Add role
POST /api/sections/{section_id}/entries
{
  "parent_entry_id": 123,
  "title": "Software Engineer",
  "items": [...]
}
```

## Data Tracking

All entries and items include `meta_info` for tracking:
```json
{
  "source": "manual",           // "manual" | "ai_generated" | "linkedin" | "cv_import"
  "ai_enhanced": false,
  "last_edited": "2024-01-15",
  "keywords": ["leadership", "ml"],
  "confidence_score": 0.95
}
```

## Response Format

When fetching a profile with `GET /api/profiles/{id}`, the response includes the full hierarchy:

```json
{
  "id": 1,
  "title": "Software Engineer Profile",
  "sections": [
    {
      "id": 2,
      "title": "Work Experience",
      "entries": [
        {
          "id": 10,
          "title": "Ericsson",
          "parent_entry_id": null,
          "sub_entries": [
            {
              "id": 11,
              "title": "Line Manager",
              "parent_entry_id": 10,
              "items": [
                {"id": 20, "content": "Led team of 10 engineers"}
              ],
              "sub_entries": []
            }
          ]
        }
      ]
    }
  ]
}
```

## Frontend Integration Guidance

### Rendering Logic
```javascript
function renderSection(section) {
  if (section.content) {
    // Summary: Direct content
    return <ContentDisplay content={section.content} />
  }

  if (section.section_type === 'work_experience') {
    // Two-level: Company → Roles
    return section.entries.map(company => (
      <Company>
        <Header>{company.title}</Header>
        {company.sub_entries.map(role => (
          <Role>
            <Header>{role.title}</Header>
            <Items>{role.items}</Items>
          </Role>
        ))}
      </Company>
    ))
  } else {
    // One-level: Education, Skills, etc.
    return section.entries.map(entry => (
      <Entry>
        <Header>{entry.title}</Header>
        <Items>{entry.items}</Items>
      </Entry>
    ))
  }
}
```

### UI Rules
```javascript
function getMaxNestingLevel(sectionType) {
  switch(sectionType) {
    case 'summary': return 0;           // No entries
    case 'work_experience': return 2;    // Company → Role
    case 'education':
    case 'skills':
    case 'projects': return 1;           // Degree/Category only
    default: return 1;                   // Custom sections
  }
}
```

## Testing

1. **Run Migration**:
   ```bash
   cd backend
   python add_hierarchical_support.py
   ```

2. **Restart Backend**:
   ```bash
   uvicorn main:app --reload
   ```

3. **Test API** (optional):
   - Update `TOKEN` in `test_hierarchical_structure.py`
   - Run: `python test_hierarchical_structure.py`

## Next Steps

### Backend
- ✅ Database schema updated
- ✅ Models updated with relationships
- ✅ Schemas support recursive structure
- ✅ API endpoints handle nested creation
- ⏳ Update existing endpoints if needed (update, delete already cascade)

### Frontend
- ⏳ Update UI to support hierarchical structure
- ⏳ Add "Add Role" button for work experience entries
- ⏳ Implement drag-and-drop for reordering nested entries
- ⏳ Update forms to handle nested entry creation
- ⏳ Add validation for max nesting levels per section type

### Future Enhancements
- Add bulk operations for entries
- Add templates for common structures
- Implement entry cloning
- Add entry type inference from content
- Implement smart reordering suggestions
