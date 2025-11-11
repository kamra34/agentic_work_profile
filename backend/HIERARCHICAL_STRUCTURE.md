# Hierarchical Structure Guide

## Overview

The profile system now supports flexible hierarchical structures for different section types:

1. **Section** - Top level (e.g., "Work Experience", "Education", "Summary")
2. **SectionEntry** - Middle level (e.g., "Ericsson", "PhD at MIT")
3. **SectionItem** - Leaf level (bullet points)

## Structure by Section Type

### 1. Summary Section
Direct content at the section level - no entries needed.

**Example Structure:**
```
Section: Professional Summary
├─ content_type: PARAGRAPH | BULLETS | TEXT_AND_BULLETS
└─ content: "Experienced software engineer with 10+ years..."
```

**API Usage:**
```json
POST /api/profiles/1/sections
{
  "title": "Professional Summary",
  "section_type": "summary",
  "content_type": "paragraph",
  "content": "Experienced software engineer...",
  "icon": "👤"
}
```

### 2. Education Section
One level of entries (degrees) with bullet points.

**Example Structure:**
```
Section: Education
├─ Entry: PhD in Computer Science
│  ├─ subtitle: "MIT"
│  ├─ start_date: "2015"
│  ├─ end_date: "2019"
│  ├─ Item: "Thesis: Machine Learning for Code Generation"
│  └─ Item: "GPA: 4.0/4.0"
└─ Entry: MSc in Software Engineering
   ├─ subtitle: "Stanford University"
   ├─ start_date: "2013"
   ├─ end_date: "2015"
   └─ Item: "Focus on distributed systems"
```

**API Usage:**
```json
POST /api/sections/1/entries
{
  "title": "PhD in Computer Science",
  "subtitle": "MIT",
  "start_date": "2015",
  "end_date": "2019",
  "location": "Cambridge, MA",
  "content_type": "bullets",
  "items": [
    {"content": "Thesis: Machine Learning for Code Generation"},
    {"content": "GPA: 4.0/4.0"}
  ]
}
```

### 3. Work Experience Section
Two levels of entries (company → roles) with bullet points.

**Example Structure:**
```
Section: Work Experience
├─ Entry: Ericsson (Company)
│  ├─ start_date: "2019"
│  ├─ end_date: "Present"
│  ├─ Sub-Entry: Line Manager
│  │  ├─ start_date: "2020"
│  │  ├─ end_date: "Present"
│  │  ├─ Item: "Led team of 10 engineers"
│  │  └─ Item: "Improved deployment pipeline efficiency by 40%"
│  └─ Sub-Entry: Senior Data Scientist
│     ├─ start_date: "2019"
│     ├─ end_date: "2020"
│     ├─ Item: "Developed ML models for network optimization"
│     └─ Item: "Reduced model latency by 60%"
└─ Entry: Google (Company)
   └─ Sub-Entry: Software Engineer
      └─ Item: "Built large-scale distributed systems"
```

**API Usage (Nested Creation):**
```json
POST /api/sections/2/entries
{
  "title": "Ericsson",
  "subtitle": "Telecommunications",
  "start_date": "2019",
  "end_date": "Present",
  "location": "Stockholm, Sweden",
  "content_type": "empty",
  "sub_entries": [
    {
      "title": "Line Manager",
      "start_date": "2020",
      "end_date": "Present",
      "content_type": "bullets",
      "items": [
        {"content": "Led team of 10 engineers"},
        {"content": "Improved deployment pipeline efficiency by 40%"}
      ]
    },
    {
      "title": "Senior Data Scientist",
      "start_date": "2019",
      "end_date": "2020",
      "content_type": "bullets",
      "items": [
        {"content": "Developed ML models for network optimization"},
        {"content": "Reduced model latency by 60%"}
      ]
    }
  ]
}
```

**API Usage (Incremental Creation):**
```json
# Step 1: Create company entry
POST /api/sections/2/entries
{
  "title": "Ericsson",
  "subtitle": "Telecommunications",
  "start_date": "2019",
  "end_date": "Present",
  "location": "Stockholm, Sweden",
  "content_type": "empty"
}
# Returns: {"id": 123, ...}

# Step 2: Add role under company
POST /api/sections/2/entries
{
  "parent_entry_id": 123,  # Links to Ericsson
  "title": "Line Manager",
  "start_date": "2020",
  "end_date": "Present",
  "content_type": "bullets",
  "items": [
    {"content": "Led team of 10 engineers"}
  ]
}
```

### 4. Skills Section
Flexible structure - can use section-level bullets or entry-level grouping.

**Option A: Section-level bullets**
```
Section: Skills
├─ content_type: BULLETS
└─ Entry: Technical Skills
   ├─ Item: "Python, Java, JavaScript"
   ├─ Item: "React, Node.js, FastAPI"
   └─ Item: "PostgreSQL, MongoDB"
```

**Option B: Categorized entries**
```
Section: Skills
├─ Entry: Programming Languages
│  ├─ Item: "Python (Expert)"
│  └─ Item: "JavaScript (Advanced)"
└─ Entry: Frameworks
   ├─ Item: "React"
   └─ Item: "FastAPI"
```

### 5. Custom Sections
Up to one level of nesting (like Education).

**Example Structure:**
```
Section: Publications
├─ Entry: "Machine Learning in Production"
│  ├─ subtitle: "O'Reilly Media"
│  ├─ start_date: "2023"
│  └─ Item: "Co-authored with 3 other experts"
└─ Entry: "Scaling Web Applications"
   └─ Item: "500+ citations"
```

## Content Types

Each section/entry can have different content types:

- `EMPTY`: No content, just metadata (useful for parent entries)
- `PARAGRAPH`: Flowing text with multiple sentences
- `BULLETS`: List of bullet points only
- `TEXT_AND_BULLETS`: Description text followed by bullet points

## Metadata Tracking

All entries and items have `meta_info` field for tracking:

```json
{
  "source": "manual",           // "manual", "ai_generated", "linkedin", "cv_import"
  "ai_enhanced": false,         // Whether AI has modified this
  "last_edited": "2024-01-15",
  "keywords": ["leadership", "ml"],
  "confidence_score": 0.95      // For AI-generated content
}
```

## API Endpoints

### Create Section
`POST /api/profiles/{profile_id}/sections`

### Create Entry (with optional sub-entries)
`POST /api/sections/{section_id}/entries`

### Update Entry
`PUT /api/entries/{entry_id}`

### Delete Entry (cascades to sub-entries and items)
`DELETE /api/entries/{entry_id}`

### Create Item
`POST /api/entries/{entry_id}/items`

### Update Item
`PUT /api/items/{item_id}`

### Delete Item
`DELETE /api/items/{item_id}`

## Response Format

When fetching a profile, the response includes the full hierarchy:

```json
{
  "id": 1,
  "title": "Software Engineer Profile",
  "sections": [
    {
      "id": 1,
      "title": "Work Experience",
      "section_type": "work_experience",
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
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Frontend Integration Notes

### Rendering Logic

```javascript
// Pseudo-code for rendering
function renderSection(section) {
  if (section.content) {
    // Direct section content (Summary)
    return <ContentDisplay content={section.content} />
  }

  if (section.section_type === 'work_experience') {
    // Two-level hierarchy: Company -> Roles
    return section.entries.map(company => (
      <Company>
        <CompanyHeader>{company.title}</CompanyHeader>
        {company.sub_entries.map(role => (
          <Role>
            <RoleHeader>{role.title}</RoleHeader>
            <BulletList>{role.items}</BulletList>
          </Role>
        ))}
      </Company>
    ))
  } else {
    // One-level hierarchy: Degrees, Projects, etc.
    return section.entries.map(entry => (
      <Entry>
        <EntryHeader>{entry.title}</EntryHeader>
        <BulletList>{entry.items}</BulletList>
      </Entry>
    ))
  }
}
```

### Add Entry UI Logic

```javascript
function shouldShowSubEntryOption(sectionType) {
  return sectionType === 'work_experience';
}

function getMaxNestingLevel(sectionType) {
  switch(sectionType) {
    case 'work_experience':
      return 2; // Company -> Role
    case 'education':
    case 'projects':
    case 'certifications':
      return 1; // Degree/Project/Cert only
    case 'summary':
      return 0; // No entries
    default:
      return 1; // Custom sections
  }
}
```

## Database Schema

```sql
-- Sections table
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER REFERENCES profiles(id),
  title VARCHAR NOT NULL,
  section_type sectiontype NOT NULL,
  content TEXT,
  content_type contenttype DEFAULT 'empty',
  ...
);

-- Entries table (self-referencing for hierarchy)
CREATE TABLE section_entries (
  id SERIAL PRIMARY KEY,
  section_id INTEGER REFERENCES sections(id),
  parent_entry_id INTEGER REFERENCES section_entries(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  subtitle VARCHAR,
  start_date VARCHAR,
  end_date VARCHAR,
  location VARCHAR,
  description TEXT,
  content_type contenttype DEFAULT 'bullets',
  ...
);

-- Items table (bullet points)
CREATE TABLE section_items (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES section_entries(id),
  content TEXT NOT NULL,
  ...
);
```
