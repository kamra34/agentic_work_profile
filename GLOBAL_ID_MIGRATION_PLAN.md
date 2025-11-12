# Global ID Migration Plan

## Problem Statement

Currently, database IDs (integers) are not globally unique:
- Entry ID 30 exists in both Summary and Skills sections
- Item ID 30 conflicts with Entry ID 30
- This causes cascading bugs, filtering issues, and preview problems

## Solution: Hierarchical Global IDs

Implement UUID-based global identifiers that guarantee uniqueness across all entities.

---

## ID Format Design

### Format Specification
```
{section_uuid}:{entry_uuid}:{subentry_uuid}:{item_uuid}

Components:
- section_uuid: sec_{8-char-uuid}
- entry_uuid: ent_{8-char-uuid}
- subentry_uuid: sub_{8-char-uuid}
- item_uuid: itm_{8-char-uuid}
```

### Examples
```
Summary Section:
  - Section: "sec_a1b2c3d4"
  - Entry: "sec_a1b2c3d4:ent_e5f6g7h8"
  - Item (no subentry): "sec_a1b2c3d4:ent_e5f6g7h8::itm_i9j0k1l2"

Work Experience:
  - Section: "sec_b2c3d4e5"
  - Entry (Job): "sec_b2c3d4e5:ent_f6g7h8i9"
  - Sub-Entry (Role Group): "sec_b2c3d4e5:ent_f6g7h8i9:sub_j0k1l2m3"
  - Item (Bullet): "sec_b2c3d4e5:ent_f6g7h8i9:sub_j0k1l2m3:itm_n4o5p6q7"

Skills:
  - Section: "sec_c3d4e5f6"
  - Entry (Technical Skills): "sec_c3d4e5f6:ent_g8h9i0j1"
  - Item: "sec_c3d4e5f6:ent_g8h9i0j1::itm_k2l3m4n5"
```

---

## Implementation Phases

### Phase 1: Database Migration ✓ READY

**File**: `migrate_to_global_ids.py`

**Actions**:
1. Add `global_id VARCHAR(255) UNIQUE` to tables:
   - `profile_sections`
   - `profile_entries` (handles both entries and sub-entries)
   - `profile_items`

2. Generate global IDs for all existing records:
   - Traverse user profiles hierarchically
   - Generate UUIDs maintaining parent-child relationships
   - Update all records with global_ids

3. Validation:
   - Ensure all global_ids are unique
   - Verify hierarchical structure is maintained

**Run**: `python backend/migrate_to_global_ids.py`

---

### Phase 2: Backend API Updates

#### 2.1 Update Models (`backend/models.py`)

Add global_id fields and update serialization:

```python
class ProfileSection(Base):
    __tablename__ = "profile_sections"
    id = Column(Integer, primary_key=True)
    global_id = Column(String(255), unique=True, nullable=False)  # NEW
    # ... rest of fields

class ProfileEntry(Base):
    __tablename__ = "profile_entries"
    id = Column(Integer, primary_key=True)
    global_id = Column(String(255), unique=True, nullable=False)  # NEW
    # ... rest of fields

class ProfileItem(Base):
    __tablename__ = "profile_items"
    id = Column(Integer, primary_key=True)
    global_id = Column(String(255), unique=True, nullable=False)  # NEW
    # ... rest of fields
```

#### 2.2 Update Profile Retrieval (`backend/main.py`)

Modify GET `/api/cv/profile` to return global_ids:

```python
def serialize_entry(entry):
    return {
        "id": entry.id,  # Keep for backward compatibility
        "global_id": entry.global_id,  # NEW - primary identifier
        "title": entry.title,
        # ... rest
    }
```

#### 2.3 Update Filtering Logic

Update all endpoints that filter by IDs:
- `/api/cv/tailored-versions/{version_id}/pdf-download`
- `/api/cv/tailored-versions/{version_id}/preview-ai-input`
- `/api/cv/tailored-versions/{version_id}/recalculate-ats`

Change from:
```python
hidden_items_set = set(request.hidden_items)  # integers
if entry.get('id') in hidden_items_set:
```

To:
```python
hidden_items_set = set(request.hidden_items)  # global_ids (strings)
if entry.get('global_id') in hidden_items_set:
```

#### 2.4 Update Schemas (`backend/schemas.py`)

```python
class ProfileEntry(BaseModel):
    id: int  # Keep for compatibility
    global_id: str  # NEW - primary identifier
    title: Optional[str]
    # ... rest

class PDFDownloadRequest(BaseModel):
    hidden_items: List[str] = []  # Changed from int to str (global_ids)
```

---

### Phase 3: Frontend Updates

#### 3.1 Update ID Utilities (`TailoredCVs.jsx`)

Replace current namespace system with global ID system:

```javascript
// OLD SYSTEM - Remove these
const makeId = (type, id) => `${type}_${id}`;
const parseId = (namespacedId) => { /* ... */ };

// NEW SYSTEM - Global IDs come directly from backend
// No transformation needed!
// Backend returns: "sec_a1b2c3d4:ent_e5f6g7h8::itm_i9j0k1l2"
// We use it directly as the key
```

#### 3.2 Update State Management

```javascript
// Hidden items state - now uses global_ids
const [hiddenItems, setHiddenItems] = useState({});

// Example state:
{
  "sec_a1b2c3d4:ent_e5f6g7h8": true,  // Hide this entry
  "sec_b2c3d4e5:ent_f6g7h8i9:sub_j0k1l2m3:itm_n4o5p6q7": true,  // Hide this item
}
```

#### 3.3 Update Rendering

```javascript
// Use global_id as key everywhere
{entry.items.map(item => (
  <li key={item.global_id}>  {/* Changed from item.id */}
    <input
      type="checkbox"
      checked={!hiddenItems[item.global_id]}  {/* Changed */}
      onChange={() => toggleItemVisibility(item.global_id)}
    />
    {item.content}
  </li>
))}
```

#### 3.4 Update Cascading Logic

```javascript
const toggleItemVisibility = (global_id) => {
  const newHiddenState = !hiddenItems[global_id];

  setHiddenItems(prev => {
    const updated = { ...prev, [global_id]: newHiddenState };

    // Cascade to children - use hierarchical structure
    if (isEntry(global_id)) {
      const childIds = findAllChildGlobalIds(global_id);
      childIds.forEach(childId => {
        updated[childId] = newHiddenState;
      });
    }

    return updated;
  });
};

// Helper: Check if global_id is an entry
const isEntry = (gid) => {
  const parts = gid.split(':');
  return parts.length === 2;  // sec:ent
};

// Helper: Find all children of a global_id
const findAllChildGlobalIds = (parentGid) => {
  const children = [];

  // Search through fullCVData and find all global_ids that start with parentGid
  if (fullCVData?.profile?.sections) {
    for (const section of fullCVData.profile.sections) {
      for (const entry of section.entries || []) {
        if (entry.global_id.startsWith(parentGid)) {
          // Found a child entry or item
          if (entry.global_id !== parentGid) {
            children.push(entry.global_id);
          }

          // Check sub-entries
          for (const subEntry of entry.sub_entries || []) {
            if (subEntry.global_id.startsWith(parentGid)) {
              children.push(subEntry.global_id);

              // Check items in sub-entry
              for (const item of subEntry.items || []) {
                if (item.global_id.startsWith(parentGid)) {
                  children.push(item.global_id);
                }
              }
            }
          }

          // Check direct items
          for (const item of entry.items || []) {
            if (item.global_id.startsWith(parentGid)) {
              children.push(item.global_id);
            }
          }
        }
      }
    }
  }

  return children;
};
```

#### 3.5 Update CVPreview.jsx

Replace all filtering operations:

```javascript
// OLD
.filter(e => !e.parent_entry_id && !hiddenItems[makeId('entry', e.id)])

// NEW
.filter(e => !e.parent_entry_id && !hiddenItems[e.global_id])
```

Apply this pattern to all 25+ filter operations in CVPreview.jsx.

---

### Phase 4: Testing Strategy

#### 4.1 Unit Tests
- Test global_id generation uniqueness
- Test hierarchical ID parsing
- Test cascading with global IDs

#### 4.2 Integration Tests
- Create new profile → verify global_ids generated
- Hide/show items → verify correct filtering
- Generate PDF → verify correct content
- Recalculate ATS → verify correct scoring

#### 4.3 Migration Tests
- Run migration on test database
- Verify all records have global_ids
- Verify no duplicate global_ids
- Verify hierarchical structure preserved

#### 4.4 UI Tests
- Test cascading checkboxes (all levels)
- Test PDF preview matches checkbox state
- Test AI input matches checkbox state
- Test across all section types (Summary, Work Exp, Skills, etc.)

---

### Phase 5: Deployment

#### 5.1 Pre-Deployment
1. Backup production database
2. Test migration on staging environment
3. Verify all functionality works with global IDs

#### 5.2 Deployment Steps
1. Put application in maintenance mode
2. Run database migration: `python migrate_to_global_ids.py`
3. Deploy backend changes
4. Deploy frontend changes
5. Smoke test critical paths
6. Remove maintenance mode

#### 5.3 Post-Deployment
1. Monitor error logs
2. Verify no ID collision errors
3. User acceptance testing
4. Document any issues

---

## Benefits of This Approach

### 1. Global Uniqueness
- No more ID collisions between sections
- No more type-level collisions (entry vs item)
- Guaranteed uniqueness across entire database

### 2. Hierarchical Clarity
- IDs encode parent-child relationships
- Easy to identify entity type from ID
- Simplified debugging and logging

### 3. Future-Proof
- Adding new sections won't cause collisions
- System scales to any number of entities
- No need for namespace workarounds

### 4. Simplified Logic
- No more makeId/parseId transformations
- No more findEntryOrSubEntry searches
- Direct ID comparisons everywhere

### 5. Better Performance
- No need to search for entities
- Direct lookup by global_id
- Reduced computational overhead

---

## Rollback Plan

If migration fails or issues arise:

1. **Database Rollback**:
   ```sql
   ALTER TABLE profile_sections DROP COLUMN global_id;
   ALTER TABLE profile_entries DROP COLUMN global_id;
   ALTER TABLE profile_items DROP COLUMN global_id;
   ```

2. **Code Rollback**:
   - Revert to previous git commit
   - Redeploy previous version

3. **Data Recovery**:
   - Restore from pre-migration backup
   - Verify data integrity

---

## Timeline Estimate

- **Phase 1** (Database Migration): 30 minutes
- **Phase 2** (Backend Updates): 2-3 hours
- **Phase 3** (Frontend Updates): 3-4 hours
- **Phase 4** (Testing): 2-3 hours
- **Phase 5** (Deployment): 1 hour

**Total**: 8-11 hours of development + testing

---

## Success Criteria

- ✅ All entities have unique global_ids
- ✅ No ID collisions in any scenario
- ✅ Cascading works correctly at all levels
- ✅ PDF preview matches checkbox state
- ✅ AI input matches checkbox state
- ✅ ATS scoring uses correct filtered content
- ✅ Works for all section types (current and future)
- ✅ No regression in existing functionality

---

## Questions to Answer Before Starting

1. **When should we run this migration?** (Maintenance window?)
2. **Should we keep old `id` fields for backward compatibility?** (Recommended: Yes, during transition period)
3. **How should we handle existing tailored CVs?** (Options: regenerate vs update in place)
4. **What's the rollback trigger?** (Define acceptable failure threshold)

---

## Next Steps

**Ready to proceed?**

1. Review this plan and approve
2. Schedule maintenance window
3. Run Phase 1 migration script
4. I'll implement Phases 2-3 systematically
5. Conduct thorough testing (Phase 4)
6. Deploy to production (Phase 5)

**Estimated completion**: 1-2 days (depending on testing thoroughness)
