"""
Generalized hierarchical data models for work profile management.
All profile content uses a single ProfileNode model for infinite flexibility.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


class User(Base):
    """User account"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    """User's professional profile"""
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="My Profile")
    is_default = Column(Boolean, default=True)
    contact_info = Column(JSON, nullable=True)  # {"phone": "...", "email": "...", "location": "..."}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="profiles")
    nodes = relationship("ProfileNode", back_populates="profile", cascade="all, delete-orphan", order_by="ProfileNode.order")


class ProfileNode(Base):
    """
    Universal hierarchical node for ALL profile content.
    Can represent: sections, entries, sub-entries, items, bullets - anything.
    Infinitely nestable via parent_id self-reference.
    """
    __tablename__ = "profile_nodes"

    # Identity
    id = Column(Integer, primary_key=True, index=True)
    global_id = Column(String, unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("profile_nodes.id", ondelete="CASCADE"), nullable=True)

    # Hierarchy tracking (for performance)
    level = Column(Integer, default=0, nullable=False, index=True)  # 0=root, 1=child, 2=grandchild, etc.
    root_id = Column(Integer, ForeignKey("profile_nodes.id"), nullable=True, index=True)  # Top-level section ID

    # Node type (flexible string - not enum)
    node_type = Column(String, nullable=False, default="entry")  # "section", "entry", "item", "bullet", "custom"

    # Content
    title = Column(String, nullable=True)
    subtitle = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    content_type = Column(String, nullable=False, default="text")  # "text", "bullets", "paragraph", "mixed", "empty"

    # Optional metadata (only use when needed)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    location = Column(String, nullable=True)

    # Display and organization
    order = Column(Integer, default=0)
    is_visible = Column(Boolean, default=True)
    icon = Column(String, nullable=True)

    # Flexible extensions
    attributes = Column(JSON, nullable=True)  # User-defined fields: {"gpa": "3.8", "company_size": "5000+"}
    meta_info = Column(JSON, nullable=True)  # System metadata: {"source": "manual", "ai_enhanced": false}

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("Profile", back_populates="nodes")
    parent = relationship(
        "ProfileNode",
        remote_side=[id],
        foreign_keys=[parent_id],
        back_populates="children"
    )
    children = relationship(
        "ProfileNode",
        foreign_keys="ProfileNode.parent_id",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="ProfileNode.order"
    )


class TailoredCV(Base):
    """Saved tailored CV for specific job applications"""
    __tablename__ = "tailored_cvs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)

    # Job information
    job_title = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)

    # AI scores
    fit_scores = Column(JSON, nullable=True)  # {"openai": 85, "claude": 90, "gemini": 88}
    ats_scores = Column(JSON, nullable=True)  # {"openai": 75, "claude": 80}

    # Selected nodes (track by global_id)
    selected_node_ids = Column(JSON, nullable=False)  # ["uuid-1", "uuid-2", ...]

    # Content snapshot at time of tailoring
    content_snapshot = Column(JSON, nullable=False)
    # {
    #   "nodes": {"uuid-1": {...node_data...}, "uuid-2": {...}},
    #   "root_node_ids": ["uuid-1", "uuid-4"],
    #   "contact_info": {...}
    # }

    # AI recommendations and analysis
    recommendations = Column(JSON, nullable=True)  # {"openai": {...}, "claude": {...}}
    job_analysis = Column(JSON, nullable=True)

    # Application tracking
    status = Column(String, default="draft")  # draft, applied, interview, offer, rejected, etc.
    application_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    profile = relationship("Profile")
