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

    # Profile information fields
    phone_number = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    professional_title = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    availability = Column(String, default='available')  # available, busy, not_looking
    preferred_work_mode = Column(String, default='hybrid')  # remote, onsite, hybrid

    # Per-user AI runtime settings
    openai_model = Column(String, default='gpt-4o')
    openai_reasoning_effort = Column(String, default='medium')  # none, low, medium, high
    claude_model = Column(String, default='claude-sonnet-4-20250514')
    humanity_deep_mode_enabled = Column(Boolean, default=True)
    humanity_llm_model = Column(String, default='gpt-4o')
    humanity_llm_reasoning_effort = Column(String, default='low')  # none, low, medium, high
    refinement_instruction_templates = Column(JSON, nullable=True, default=list)

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

    # AI scores (from Step 2 - both models) - ORIGINAL scores from initial tailoring
    fit_scores = Column(JSON, nullable=True)  # {"openai": 85, "claude": 90}
    ats_scores = Column(JSON, nullable=True)  # {"openai": 75, "claude": 80}

    # Recalculated scores history (after user edits CV content)
    # Array of recalculation objects with timestamp, scores, and prompts
    recalculated_scores = Column(JSON, nullable=True, default=[])
    latest_humanity_report = Column(JSON, nullable=True)

    # Selected nodes - store BOTH id (for exact table reference) and global_id (for flexibility)
    selected_node_ids = Column(JSON, nullable=False)
    # [
    #   {"id": 123, "global_id": "uuid-1"},
    #   {"id": 124, "global_id": "uuid-2"}
    # ]

    # Content snapshot at time of tailoring (denormalized for historical accuracy)
    content_snapshot = Column(JSON, nullable=False)
    # {
    #   "nodes": {"uuid-1": {...complete_node_data_with_id...}, "uuid-2": {...}},
    #   "root_node_ids": ["uuid-1", "uuid-4"],
    #   "contact_info": {...}
    # }

    # Original snapshot - pristine copy saved when first created (never modified by refinements)
    # Used for "restore to original" functionality
    original_snapshot = Column(JSON, nullable=True)

    # AI recommendations and analysis (complete data from Step 3)
    recommendations = Column(JSON, nullable=True)
    # {
    #   "openai": {
    #     "success": true,
    #     "model": "openai-gpt-4o",
    #     "recommendations": {
    #       "selected_nodes": [
    #         {"node_id": 123, "global_id": "uuid", "include": true, "confidence": 0.9, "reason": "...", "relevance_tags": [...]}
    #       ],
    #       "selection_summary": {"total_nodes": 70, "recommended_include": 42, "recommended_exclude": 20},
    #       "tailoring_strategy": "..."
    #     }
    #   },
    #   "claude": {...same structure...}
    # }
    job_analysis = Column(JSON, nullable=True)  # Complete job requirements from both models

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
    applications = relationship("JobApplication", back_populates="tailored_cv", cascade="all, delete-orphan")


class JobApplication(Base):
    """Finalized job applications ready for submission - tracked in Application Tracker"""
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tailored_cv_id = Column(Integer, ForeignKey("tailored_cvs.id", ondelete="CASCADE"), nullable=False)

    # Job Information (denormalized for easy access)
    job_title = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    job_url = Column(String, nullable=True)
    location = Column(String, nullable=True)

    # Finalized CV Content (snapshot at time of application submission)
    final_content_snapshot = Column(JSON, nullable=False)
    # Same structure as TailoredCV.content_snapshot but represents the FINAL version
    # after all user edits

    # CV Format/Template Selection
    cv_format = Column(String, default="professional")  # professional, modern, compact, creative, etc.
    pdf_customizations = Column(JSON, nullable=True)  # Stores fontSize, spacing, colorIntensity, sectionOrder

    # All AI Scores (initial + latest recalculated)
    initial_fit_scores = Column(JSON, nullable=True)  # {"openai": 85, "claude": 90}
    initial_ats_scores = Column(JSON, nullable=True)  # {"openai": 75, "claude": 80}
    final_fit_scores = Column(JSON, nullable=True)  # Latest recalculated scores
    final_ats_scores = Column(JSON, nullable=True)  # Latest recalculated scores

    # Complete score history for tracking improvements
    score_history = Column(JSON, nullable=True)
    # [
    #   {"timestamp": "2025-01-15T10:30:00", "fit_scores": {...}, "ats_scores": {...}},
    #   ...
    # ]

    # Application Tracking
    status = Column(String, default="preparing")
    # preparing -> ready_to_apply -> applied -> phone_screen -> interview ->
    # offer_received -> accepted -> rejected -> withdrawn

    # Status timestamps - track when each status was first entered
    ready_date = Column(DateTime, nullable=True)  # When moved to ready_to_apply
    applied_date = Column(DateTime, nullable=True)  # When moved to applied
    phone_screen_date = Column(DateTime, nullable=True)  # When moved to phone_screen
    interview_date = Column(DateTime, nullable=True)  # When moved to interview
    offer_date = Column(DateTime, nullable=True)  # When moved to offer_received
    accepted_date = Column(DateTime, nullable=True)  # When moved to accepted
    rejected_date = Column(DateTime, nullable=True)  # When moved to rejected
    withdrawn_date = Column(DateTime, nullable=True)  # When moved to withdrawn

    application_date = Column(DateTime, nullable=True)  # When user actually applied (legacy - now using applied_date)
    submission_method = Column(String, nullable=True)  # email, linkedin, company_portal, etc.

    # Follow-up and Interview Tracking
    follow_up_date = Column(DateTime, nullable=True)
    interview_dates = Column(JSON, nullable=True)  # [{"date": "2025-01-20", "type": "phone", "interviewer": "..."}]

    # Response Tracking
    response_date = Column(DateTime, nullable=True)
    response_type = Column(String, nullable=True)  # positive, negative, request_interview, etc.

    # User Notes
    notes = Column(Text, nullable=True)
    cover_letter = Column(Text, nullable=True)

    # Priority and Reminders
    priority = Column(String, default="medium")  # low, medium, high, urgent
    reminder_date = Column(DateTime, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    finalized_at = Column(DateTime, nullable=True)  # When user marked as "ready to apply"

    # Relationships
    user = relationship("User")
    tailored_cv = relationship("TailoredCV", back_populates="applications")
