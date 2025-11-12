# Hierarchical Profile Structure Redesign Plan

## Executive Summary
Redesigning the profile structure from a 3-level hardcoded hierarchy (Section → Entry → Item) to a **truly generic, infinitely nestable tree structure** with global IDs for perfect downstream tracking.

---

## Part 1: New Database Schema Design

### 1.1 Core Concept: Single Unified Node Table

Replace the current 3-table structure (Section, SectionEntry, SectionItem) with a **single `ProfileNode` table** that represents every element in the profile hierarchy.

### 1.2 ProfileNode Table Schema

```python
class ProfileNode(Base):
    """
    Universal hierarchical node for all profile content.
    Can represent: sections, subsections, entries, sub-entries, items, bullets, etc.
    Infinitely nestable via parent_id self-reference.
    """
    __tablename__ = "profile_nodes"

    # === IDENTITY ===
    id = Column(Integer, primary_key=True, index=True)
    global_id = Column(String, unique=True, nullable=False, index=True)  # UUID for global tracking
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("profile_nodes.id", ondelete="CASCADE"), nullable=True)

    # === NODE TYPE ===
    node_type = Column(String, nullable=False)  # "section", "entry", "item", "bullet", "custom", etc.

    # === CONTENT ===
    title = Column(String, nullable=True)  # Main heading/title
    subtitle = Column(String, nullable=True)  # Secondary text (company name, etc.)
    content = Column(Text, nullable=True)  # Main text content (paragraph, description, bullet text)
    content_type = Column(String, nullable=False, default="text")  # "text", "bullets", "paragraph", "mixed", "empty"

    # === METADATA (Optional - only for nodes that need it) ===
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    location = Column(String, nullable=True)

    # === DISPLAY & ORGANIZATION ===
    order = Column(Integer, default=0)  # Order among siblings
    is_visible = Column(Boolean, default=True)
    icon = Column(String, nullable=True)  # For top-level sections or custom nodes

    # === FLEXIBLE EXTENSIONS ===
    attributes = Column(JSON, nullable=True)  # User-defined attributes: {"gpa": "3.8", "company_size": "5000+", etc.}
    meta_info = Column(JSON, nullable=True)  # System metadata: {"source": "manual", "ai_enhanced": false, etc.}

    # === TRACKING ===
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # === RELATIONSHIPS ===
    profile = relationship("Profile", back_populates="nodes")

    # Self-referential for tree structure
    parent = relationship("ProfileNode", remote_side=[id], back_populates="children")
    children = relationship(
        "ProfileNode",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="ProfileNode.order"
    )
```

### 1.3 Updated Profile Table

```python
class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="My Profile")
    is_default = Column(Boolean, default=True)
    contact_info = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="profiles")
    nodes = relationship("ProfileNode", back_populates="profile", cascade="all, delete-orphan")

    # Convenience property to get root nodes (sections)
    @property
    def root_nodes(self):
        return [node for node in self.nodes if node.parent_id is None]
```

### 1.4 TailoredCVVersion Changes

**CRITICAL:** Update `selected_content` JSON structure to use `global_id` for tracking:

```python
class TailoredCVVersion(Base):
    __tablename__ = "tailored_cv_versions"

    # ... (existing fields remain the same)

    # NEW: Track which nodes were selected/modified by global_id
    selected_node_ids = Column(JSON, nullable=False)  # ["global_id_1", "global_id_2", ...]

    # NEW: Snapshot of actual content at time of tailoring
    content_snapshot = Column(JSON, nullable=False)
    # Structure:
    # {
    #   "nodes": {
    #     "global_id_1": {
    #       "global_id": "uuid-...",
    #       "node_type": "section",
    #       "title": "Work Experience",
    #       "path": [],  # Path from root (for hierarchy reconstruction)
    #       "content": {...},
    #       "children_ids": ["global_id_2", "global_id_3"]
    #     },
    #     "global_id_2": { ... }
    #   },
    #   "root_node_ids": ["global_id_1", "global_id_4"],
    #   "contact_info": {...}
    # }
```

### 1.5 Key Schema Benefits

✅ **Infinite Nesting:** Any node can have children, which can have children, etc.
✅ **Flexible Metadata:** Only nodes that need dates/location have them
✅ **Global Tracking:** Every node has a UUID for perfect downstream tracking
✅ **Content Flexibility:** Each node can be text, bullets, mixed, or empty
✅ **Type Freedom:** `node_type` is a string - users can create custom types
✅ **Simple Queries:** All hierarchy operations use the same table
✅ **Perfect Tailoring:** Track exactly which nodes were used via `global_id`

---

## Part 2: Migration Strategy

### 2.1 Migration Approach: Dual-Write Period

**Strategy:** Implement migration as a multi-step process with backward compatibility.

#### Step 1: Add New Schema (Keep Old Tables)
```python
# In migration file: versions/001_add_profile_nodes.py
def upgrade():
    # Create new profile_nodes table
    op.create_table('profile_nodes', ...)

    # Add global_id to existing tables for mapping
    op.add_column('sections', sa.Column('global_id', sa.String(), nullable=True))
    op.add_column('section_entries', sa.Column('global_id', sa.String(), nullable=True))
    op.add_column('section_items', sa.Column('global_id', sa.String(), nullable=True))
```

#### Step 2: Data Migration Script
```python
# File: backend/migrate_to_hierarchical.py

import uuid
from sqlalchemy.orm import Session
from models import Section, SectionEntry, SectionItem, ProfileNode, Profile

def migrate_profile(db: Session, profile_id: int):
    """Migrate one profile from old structure to new hierarchical structure"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()

    for section in profile.sections:
        # Create section node
        section_node = ProfileNode(
            global_id=str(uuid.uuid4()),
            profile_id=profile_id,
            parent_id=None,  # Root level
            node_type="section",
            title=section.title,
            content=section.content,
            content_type=section.content_type.value,
            order=section.order,
            is_visible=section.is_visible,
            icon=section.icon,
            meta_info={
                "migrated_from": "sections",
                "old_id": section.id,
                "section_type": section.section_type.value
            }
        )
        db.add(section_node)
        db.flush()  # Get the ID

        # Update old table with global_id for reference
        section.global_id = section_node.global_id

        # Migrate entries recursively
        migrate_entries(db, section.entries, section_node.id, profile_id)

    db.commit()

def migrate_entries(db: Session, entries: List[SectionEntry], parent_node_id: int, profile_id: int):
    """Recursively migrate entries and their sub-entries"""
    for entry in entries:
        # Create entry node
        entry_node = ProfileNode(
            global_id=str(uuid.uuid4()),
            profile_id=profile_id,
            parent_id=parent_node_id,
            node_type="entry",
            title=entry.title,
            subtitle=entry.subtitle,
            content=entry.description,
            content_type=entry.content_type.value,
            start_date=entry.start_date,
            end_date=entry.end_date,
            location=entry.location,
            order=entry.order,
            is_visible=entry.is_visible,
            attributes=entry.extra_data,
            meta_info={
                "migrated_from": "section_entries",
                "old_id": entry.id
            }
        )
        db.add(entry_node)
        db.flush()

        entry.global_id = entry_node.global_id

        # Migrate items
        for item in entry.items:
            item_node = ProfileNode(
                global_id=str(uuid.uuid4()),
                profile_id=profile_id,
                parent_id=entry_node.id,
                node_type="item",
                content=item.content,
                order=item.order,
                is_visible=item.is_visible,
                meta_info={
                    "migrated_from": "section_items",
                    "old_id": item.id
                }
            )
            db.add(item_node)
            db.flush()

            item.global_id = item_node.global_id

        # Recursively migrate sub-entries
        if entry.sub_entries:
            migrate_entries(db, entry.sub_entries, entry_node.id, profile_id)

def migrate_all_profiles(db: Session):
    """Migrate all profiles"""
    profiles = db.query(Profile).all()
    for profile in profiles:
        print(f"Migrating profile {profile.id}: {profile.title}")
        migrate_profile(db, profile.id)
        print(f"✓ Profile {profile.id} migrated successfully")
```

#### Step 3: Migrate Tailored CVs
```python
# File: backend/migrate_tailored_cvs.py

def migrate_tailored_cv(db: Session, cv_id: int):
    """Convert old selected_content format to new global_id-based format"""
    cv = db.query(TailoredCVVersion).filter(TailoredCVVersion.id == cv_id).first()

    old_content = cv.selected_content
    new_snapshot = {
        "nodes": {},
        "root_node_ids": [],
        "contact_info": old_content.get("contact_info", {})
    }
    selected_ids = []

    # Convert sections
    for section_data in old_content.get("sections", []):
        # Look up global_id from old section
        old_section = db.query(Section).filter(
            Section.id == section_data.get("_source_id")
        ).first()

        if old_section and old_section.global_id:
            global_id = old_section.global_id
            selected_ids.append(global_id)
            new_snapshot["root_node_ids"].append(global_id)

            # Build node snapshot
            new_snapshot["nodes"][global_id] = {
                "global_id": global_id,
                "node_type": "section",
                "title": section_data["title"],
                "content": section_data.get("content"),
                "content_type": section_data.get("content_type"),
                "order": section_data.get("order", 0),
                "children_ids": []
            }

            # Recursively convert entries...
            # (similar logic for entries and items)

    cv.selected_node_ids = selected_ids
    cv.content_snapshot = new_snapshot
    db.commit()
```

### 2.2 Migration Execution Plan

```bash
# 1. Backup database
cp app.db app.db.backup

# 2. Run schema migration
alembic upgrade head

# 3. Migrate profile data
python backend/migrate_to_hierarchical.py

# 4. Migrate tailored CVs
python backend/migrate_tailored_cvs.py

# 5. Verify data integrity
python backend/verify_migration.py

# 6. (Optional) Drop old tables after verification period
# alembic revision -m "drop_old_tables"
# In migration: op.drop_table('section_items'), etc.
```

### 2.3 Rollback Strategy

- Keep old tables for 2-4 weeks
- If issues arise, add flag to use old tables
- Revert code to pre-migration version
- Drop new tables if necessary

---

## Part 3: Backend Changes

### 3.1 New Pydantic Schemas

```python
# File: backend/schemas.py (REPLACE old schemas)

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ProfileNodeBase(BaseModel):
    """Base schema for all profile nodes"""
    node_type: str = "entry"  # section, entry, item, bullet, custom
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    content_type: str = "text"  # text, bullets, paragraph, mixed, empty

    # Optional metadata
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None

    # Display
    order: int = 0
    is_visible: bool = True
    icon: Optional[str] = None

    # Flexible extensions
    attributes: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None

class ProfileNodeCreate(ProfileNodeBase):
    """Create a new node"""
    parent_id: Optional[int] = None  # None = root level
    children: Optional[List['ProfileNodeCreate']] = []

class ProfileNodeUpdate(BaseModel):
    """Update existing node (all fields optional)"""
    node_type: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    order: Optional[int] = None
    is_visible: Optional[bool] = None
    icon: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None
    parent_id: Optional[int] = None  # Allow moving nodes

class ProfileNodeResponse(ProfileNodeBase):
    """Full node with computed fields"""
    id: int
    global_id: str
    profile_id: int
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    children: List['ProfileNodeResponse'] = []

    # Computed fields
    depth: Optional[int] = None  # How many levels deep (0 = root)
    path: Optional[List[int]] = None  # [root_id, parent_id, ..., this_id]

    class Config:
        from_attributes = True

# Enable forward references
ProfileNodeCreate.model_rebuild()
ProfileNodeResponse.model_rebuild()

class ProfileResponse(BaseModel):
    """Profile with hierarchical nodes"""
    id: int
    user_id: int
    title: str
    is_default: bool
    contact_info: Optional[Dict[str, str]]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Only root nodes (parent_id = None)
    nodes: List[ProfileNodeResponse] = []

    class Config:
        from_attributes = True
```

### 3.2 New API Endpoints

```python
# File: backend/main.py

# === NODE CRUD OPERATIONS ===

@app.post("/profiles/{profile_id}/nodes", response_model=ProfileNodeResponse)
def create_node(
    profile_id: int,
    node: ProfileNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new node (section, entry, item, etc.) anywhere in the hierarchy"""
    # Verify profile ownership
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Create node
    db_node = ProfileNode(
        global_id=str(uuid.uuid4()),
        profile_id=profile_id,
        parent_id=node.parent_id,
        **node.dict(exclude={"parent_id", "children"})
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)

    # Recursively create children if provided
    if node.children:
        create_children_recursive(db, db_node.id, profile_id, node.children)

    return db_node

@app.get("/profiles/{profile_id}/nodes", response_model=List[ProfileNodeResponse])
def get_profile_nodes(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    parent_id: Optional[int] = None,  # Filter by parent (None = root nodes)
    node_type: Optional[str] = None,  # Filter by type
    flat: bool = False  # True = flat list, False = nested tree
):
    """Get nodes for a profile"""
    profile = db.query(Profile).filter(Profile.id == profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    query = db.query(ProfileNode).filter(ProfileNode.profile_id == profile_id)

    if parent_id is not None:
        query = query.filter(ProfileNode.parent_id == parent_id)
    elif not flat:
        # Return only root nodes (they'll include children via relationship)
        query = query.filter(ProfileNode.parent_id == None)

    if node_type:
        query = query.filter(ProfileNode.node_type == node_type)

    nodes = query.order_by(ProfileNode.order).all()
    return nodes

@app.get("/nodes/{node_id}", response_model=ProfileNodeResponse)
def get_node(
    node_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific node by ID"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(Profile.id == node.profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    return node

@app.put("/nodes/{node_id}", response_model=ProfileNodeResponse)
def update_node(
    node_id: int,
    node_update: ProfileNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update any node"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(Profile.id == node.profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    update_data = node_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(node, field, value)

    db.commit()
    db.refresh(node)
    return node

@app.delete("/nodes/{node_id}")
def delete_node(
    node_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a node and all its children (cascade)"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(Profile.id == node.profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(node)  # Cascade will handle children
    db.commit()
    return {"message": "Node deleted successfully"}

@app.post("/nodes/{node_id}/move")
def move_node(
    node_id: int,
    new_parent_id: Optional[int] = None,
    new_order: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move a node to a different parent or reorder within siblings"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(Profile.id == node.profile_id, Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    # Prevent circular references
    if new_parent_id:
        if is_descendant(db, new_parent_id, node_id):
            raise HTTPException(status_code=400, detail="Cannot move node to its own descendant")

    if new_parent_id is not None:
        node.parent_id = new_parent_id
    if new_order is not None:
        node.order = new_order

    db.commit()
    db.refresh(node)
    return node
```

### 3.3 Helper Functions

```python
# File: backend/utils/hierarchy_helpers.py

def is_descendant(db: Session, potential_descendant_id: int, ancestor_id: int) -> bool:
    """Check if a node is a descendant of another (prevent circular references)"""
    node = db.query(ProfileNode).filter(ProfileNode.id == potential_descendant_id).first()
    while node:
        if node.id == ancestor_id:
            return True
        if node.parent_id is None:
            return False
        node = node.parent
    return False

def get_node_path(db: Session, node_id: int) -> List[int]:
    """Get the full path from root to this node"""
    path = []
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    while node:
        path.insert(0, node.id)
        node = node.parent if node.parent_id else None
    return path

def get_node_depth(db: Session, node_id: int) -> int:
    """Get depth of node in tree (0 = root)"""
    depth = 0
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    while node and node.parent_id:
        depth += 1
        node = node.parent
    return depth

def flatten_tree(node: ProfileNode) -> List[ProfileNode]:
    """Convert hierarchical tree to flat list (DFS)"""
    result = [node]
    for child in node.children:
        result.extend(flatten_tree(child))
    return result

def create_children_recursive(db: Session, parent_id: int, profile_id: int, children: List[ProfileNodeCreate]):
    """Helper to recursively create child nodes"""
    for child_data in children:
        child_node = ProfileNode(
            global_id=str(uuid.uuid4()),
            profile_id=profile_id,
            parent_id=parent_id,
            **child_data.dict(exclude={"parent_id", "children"})
        )
        db.add(child_node)
        db.commit()
        db.refresh(child_node)

        if child_data.children:
            create_children_recursive(db, child_node.id, profile_id, child_data.children)
```

---

## Part 4: Frontend Changes

### 4.1 New React Component Architecture

```javascript
// File: frontend/src/components/ProfileNodeEditor.jsx

/**
 * Universal component for editing ANY node in the hierarchy
 * Replaces section-specific editors
 */
const ProfileNodeEditor = ({ node, onUpdate, onDelete, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="node-container" style={{ marginLeft: `${level * 20}px` }}>
      {/* Node header with type indicator */}
      <div className="node-header">
        <span className="node-type-badge">{node.node_type}</span>
        {node.title && <h3>{node.title}</h3>}
        {node.subtitle && <span className="subtitle">{node.subtitle}</span>}

        {/* Metadata (dates, location) - only show if present */}
        {(node.start_date || node.end_date || node.location) && (
          <div className="node-metadata">
            {node.start_date && <span>{node.start_date}</span>}
            {node.end_date && <span> - {node.end_date}</span>}
            {node.location && <span> | {node.location}</span>}
          </div>
        )}

        <div className="node-actions">
          <button onClick={() => setIsEditing(!isEditing)}>Edit</button>
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={onDelete}>Delete</button>
        </div>
      </div>

      {/* Node content */}
      {node.content && (
        <div className="node-content">{node.content}</div>
      )}

      {/* Edit form */}
      {isEditing && (
        <ProfileNodeForm
          node={node}
          onSave={(updated) => {
            onUpdate(node.id, updated);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {/* Recursively render children */}
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="node-children">
          {node.children.map((child) => (
            <ProfileNodeEditor
              key={child.id}
              node={child}
              onUpdate={onUpdate}
              onDelete={() => deleteNode(child.id)}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {/* Add child button */}
      <button onClick={() => addChildNode(node.id)}>
        + Add Child to {node.title || 'Node'}
      </button>
    </div>
  );
};
```

```javascript
// File: frontend/src/components/ProfileNodeForm.jsx

/**
 * Universal form for creating/editing nodes
 * Shows/hides fields based on node_type and user preference
 */
const ProfileNodeForm = ({ node = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    node_type: node?.node_type || 'entry',
    title: node?.title || '',
    subtitle: node?.subtitle || '',
    content: node?.content || '',
    content_type: node?.content_type || 'text',
    start_date: node?.start_date || '',
    end_date: node?.end_date || '',
    location: node?.location || '',
    icon: node?.icon || '',
    attributes: node?.attributes || {},
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
      {/* Node Type */}
      <div className="form-group">
        <label>Type</label>
        <select
          value={formData.node_type}
          onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
        >
          <option value="section">Section</option>
          <option value="entry">Entry</option>
          <option value="item">Item</option>
          <option value="bullet">Bullet</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Title */}
      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      {/* Subtitle (optional) */}
      <div className="form-group">
        <label>Subtitle (optional)</label>
        <input
          type="text"
          value={formData.subtitle}
          onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
          placeholder="Company, organization, etc."
        />
      </div>

      {/* Content */}
      <div className="form-group">
        <label>Content</label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={4}
        />
      </div>

      {/* Content Type */}
      <div className="form-group">
        <label>Content Type</label>
        <select
          value={formData.content_type}
          onChange={(e) => setFormData({ ...formData, content_type: e.target.value })}
        >
          <option value="text">Text</option>
          <option value="paragraph">Paragraph</option>
          <option value="bullets">Bullets</option>
          <option value="mixed">Mixed (Text + Bullets)</option>
          <option value="empty">Empty (Metadata Only)</option>
        </select>
      </div>

      {/* Toggle advanced fields */}
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Hide' : 'Show'} Advanced Fields
      </button>

      {showAdvanced && (
        <>
          {/* Dates */}
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="text"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                placeholder="Jan 2020"
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="text"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                placeholder="Present"
              />
            </div>
          </div>

          {/* Location */}
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="San Francisco, CA"
            />
          </div>

          {/* Icon (for sections) */}
          <div className="form-group">
            <label>Icon</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="briefcase, graduation-cap, etc."
            />
          </div>

          {/* Custom attributes (JSON editor) */}
          <div className="form-group">
            <label>Custom Attributes (JSON)</label>
            <textarea
              value={JSON.stringify(formData.attributes, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData({ ...formData, attributes: parsed });
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              rows={4}
              placeholder='{"custom_field": "value"}'
            />
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
```

### 4.2 Master Profile Page Update

```javascript
// File: frontend/src/components/MasterProfile.jsx

const MasterProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [parentNodeId, setParentNodeId] = useState(null);

  useEffect(() => {
    // Fetch profile with hierarchical nodes
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const response = await fetch('/api/profiles/1');  // Or get current profile
    const data = await response.json();
    setProfile(data);
  };

  const updateNode = async (nodeId, updates) => {
    await fetch(`/api/nodes/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchProfile();  // Refresh
  };

  const deleteNode = async (nodeId) => {
    if (confirm('Delete this node and all its children?')) {
      await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
      fetchProfile();
    }
  };

  const addNode = async (nodeData) => {
    await fetch(`/api/profiles/${profile.id}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nodeData, parent_id: parentNodeId }),
    });
    setIsAddingNode(false);
    setParentNodeId(null);
    fetchProfile();
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="master-profile">
      <h1>{profile.title}</h1>

      {/* Add root section button */}
      <button onClick={() => { setParentNodeId(null); setIsAddingNode(true); }}>
        + Add New Section
      </button>

      {/* Render all root nodes */}
      {profile.nodes.map((node) => (
        <ProfileNodeEditor
          key={node.id}
          node={node}
          onUpdate={updateNode}
          onDelete={() => deleteNode(node.id)}
          level={0}
        />
      ))}

      {/* Add node modal */}
      {isAddingNode && (
        <Modal onClose={() => setIsAddingNode(false)}>
          <h2>Add New {parentNodeId ? 'Child Node' : 'Section'}</h2>
          <ProfileNodeForm
            onSave={addNode}
            onCancel={() => setIsAddingNode(false)}
          />
        </Modal>
      )}
    </div>
  );
};
```

### 4.3 CV Preview Component Update

```javascript
// File: frontend/src/components/CVPreview.jsx

const CVPreview = ({ profileData }) => {
  const renderNode = (node, level = 0) => {
    // Skip invisible nodes
    if (!node.is_visible) return null;

    // Different rendering based on node type and level
    if (node.node_type === 'section' && level === 0) {
      return (
        <div key={node.global_id} className="cv-section">
          <h2>{node.title}</h2>
          {node.content && <p>{node.content}</p>}
          {node.children && node.children.map(child => renderNode(child, level + 1))}
        </div>
      );
    }

    if (node.node_type === 'entry') {
      return (
        <div key={node.global_id} className="cv-entry">
          <div className="entry-header">
            <h3>{node.title}</h3>
            {node.subtitle && <span className="subtitle">{node.subtitle}</span>}
            {(node.start_date || node.end_date || node.location) && (
              <div className="metadata">
                {node.start_date} {node.end_date && `- ${node.end_date}`}
                {node.location && ` | ${node.location}`}
              </div>
            )}
          </div>
          {node.content && <p>{node.content}</p>}
          {node.children && (
            <ul>
              {node.children.map(child => renderNode(child, level + 1))}
            </ul>
          )}
        </div>
      );
    }

    if (node.node_type === 'item' || node.node_type === 'bullet') {
      return <li key={node.global_id}>{node.content}</li>;
    }

    // Default: render as div with children
    return (
      <div key={node.global_id} className={`cv-node cv-node-${node.node_type}`}>
        {node.title && <strong>{node.title}</strong>}
        {node.content && <span>{node.content}</span>}
        {node.children && node.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="cv-preview">
      {profileData.nodes.map(node => renderNode(node, 0))}
    </div>
  );
};
```

### 4.4 Tailoring System Update

```javascript
// File: frontend/src/components/CVTailoring.jsx

const CVTailoring = ({ jobDescription }) => {
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [profile, setProfile] = useState(null);

  const toggleNodeSelection = (globalId) => {
    const newSelection = new Set(selectedNodeIds);
    if (newSelection.has(globalId)) {
      newSelection.delete(globalId);
    } else {
      newSelection.add(globalId);
    }
    setSelectedNodeIds(newSelection);
  };

  const saveTailoredCV = async () => {
    // Build snapshot of selected nodes
    const snapshot = buildSnapshotFromSelection(profile.nodes, selectedNodeIds);

    await fetch('/api/tailored-cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_description: jobDescription,
        selected_node_ids: Array.from(selectedNodeIds),
        content_snapshot: snapshot,
        // ... scores, etc.
      }),
    });
  };

  const buildSnapshotFromSelection = (nodes, selectedIds) => {
    const snapshot = { nodes: {}, root_node_ids: [] };

    const processNode = (node, includeChildren = false) => {
      if (!selectedIds.has(node.global_id) && !includeChildren) return;

      snapshot.nodes[node.global_id] = {
        global_id: node.global_id,
        node_type: node.node_type,
        title: node.title,
        subtitle: node.subtitle,
        content: node.content,
        content_type: node.content_type,
        start_date: node.start_date,
        end_date: node.end_date,
        location: node.location,
        order: node.order,
        children_ids: node.children ? node.children.map(c => c.global_id) : []
      };

      if (!node.parent_id) {
        snapshot.root_node_ids.push(node.global_id);
      }

      // Recursively include selected children
      if (node.children) {
        node.children.forEach(child => processNode(child, false));
      }
    };

    nodes.forEach(node => processNode(node));
    return snapshot;
  };

  return (
    <div className="cv-tailoring">
      <h2>Select Content for Tailored CV</h2>

      {profile?.nodes.map(node => (
        <SelectableNode
          key={node.global_id}
          node={node}
          isSelected={selectedNodeIds.has(node.global_id)}
          onToggle={toggleNodeSelection}
        />
      ))}

      <button onClick={saveTailoredCV}>Save Tailored CV</button>
    </div>
  );
};
```

---

## Summary of Changes

### Database
- ✅ Single `ProfileNode` table replaces 3 tables
- ✅ Global IDs for perfect tracking
- ✅ Infinite nesting via `parent_id`
- ✅ Flexible metadata (only when needed)
- ✅ Content type flexibility

### Backend
- ✅ Generic CRUD APIs for any node type
- ✅ Recursive operations (create, update, delete)
- ✅ Move/reorder nodes
- ✅ Query by level, type, parent
- ✅ Flat or nested responses

### Frontend
- ✅ Single `ProfileNodeEditor` component
- ✅ Universal `ProfileNodeForm`
- ✅ Recursive rendering
- ✅ Drag & drop support (future)
- ✅ CV preview handles any structure

### Tailoring
- ✅ Track by `global_id` instead of positional IDs
- ✅ Snapshot content at tailoring time
- ✅ Works with any node type/depth
- ✅ Perfect downstream tracking

---

## Next Steps

1. **Review this plan** - Confirm approach
2. **Create migration branch** - `git checkout -b feature/hierarchical-structure`
3. **Implement schema** - Models first
4. **Write migration scripts** - Data conversion
5. **Update backend APIs** - Generic endpoints
6. **Update frontend** - Universal components
7. **Test thoroughly** - All CRUD operations
8. **Migrate production** - With backup!

This is a **complete redesign** but will make the system infinitely flexible going forward. No more hardcoded section types or rigid hierarchies!
