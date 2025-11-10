from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class ContentType(str, enum.Enum):
    """Type of content stored in a section or entry"""
    PARAGRAPH = "paragraph"  # Flowing text with multiple sentences
    BULLETS = "bullets"  # List of bullet points only
    TEXT_AND_BULLETS = "text_and_bullets"  # Description text followed by bullet points
    EMPTY = "empty"  # No content, just metadata (title, dates, etc.)


class SectionType(str, enum.Enum):
    """Predefined section types for consistent structure"""
    SUMMARY = "summary"
    WORK_EXPERIENCE = "work_experience"
    EDUCATION = "education"
    SKILLS = "skills"
    PROJECTS = "projects"
    CERTIFICATIONS = "certifications"
    AWARDS = "awards"
    PUBLICATIONS = "publications"
    LANGUAGES = "languages"
    VOLUNTEER = "volunteer"
    CUSTOM = "custom"  # User-defined section type


class User(Base):
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
    """
    User's professional profile - can have multiple versions (e.g., for different roles)
    """
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="My Profile")  # e.g., "Software Engineer Profile", "Data Scientist Profile"
    is_default = Column(Boolean, default=True)  # User's primary profile

    # Basic contact info (stored at profile level)
    contact_info = Column(JSON, nullable=True)  # {"phone": "...", "email": "...", "location": "...", "linkedin": "...", "github": "..."}

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)  # User's private notes about this profile

    # Relationships
    user = relationship("User", back_populates="profiles")
    sections = relationship("Section", back_populates="profile", cascade="all, delete-orphan", order_by="Section.order")


class Section(Base):
    """
    Top-level sections of a profile (Summary, Work Experience, Education, etc.)
    Can contain either:
    1. Direct content (for simple sections like Summary)
    2. Multiple entries (for complex sections like Work Experience)
    """
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)

    # Section identification
    title = Column(String, nullable=False)  # Display name: "Professional Summary", "Work Experience", etc.
    section_type = Column(SQLEnum(SectionType, values_callable=lambda obj: [e.value for e in obj]), nullable=False)  # Standardized type for programmatic access
    icon = Column(String, nullable=True)  # Icon name for UI (e.g., "briefcase", "graduation-cap")

    # Content configuration
    content_type = Column(SQLEnum(ContentType, values_callable=lambda obj: [e.value for e in obj]), nullable=False, default=ContentType.EMPTY)
    content = Column(Text, nullable=True)  # Direct content for paragraph-based sections (e.g., Summary)

    # Organization
    order = Column(Integer, default=0)  # Display order
    is_visible = Column(Boolean, default=True)  # Show/hide in generated outputs

    # Metadata for AI and tracking
    meta_info = Column(JSON, nullable=True)  # Flexible field for: {"source": "manual", "last_ai_reviewed": "2024-01-15", "keywords": [...]}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("Profile", back_populates="sections")
    entries = relationship("SectionEntry", back_populates="section", cascade="all, delete-orphan", order_by="SectionEntry.order")


class SectionEntry(Base):
    """
    Individual entries within a section (e.g., a specific job, degree, project)
    Supports hierarchical structure:
    - Work Experience: Company (parent) → Role (child) → bullet points
    - Education: Degree (parent) → bullet points (no child entries needed)
    - Summary: Direct section content (no entries needed)

    Can contain:
    1. Just metadata (title, dates, location)
    2. Text description
    3. Bullet points (via SectionItem)
    4. Both text description AND bullet points
    5. Sub-entries (child entries for nested structure)
    """
    __tablename__ = "section_entries"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    parent_entry_id = Column(Integer, ForeignKey("section_entries.id", ondelete="CASCADE"), nullable=True)  # For nested entries (e.g., roles within a company)

    # Entry identification
    title = Column(String, nullable=False)  # Job title, degree name, project name, company name, etc.
    subtitle = Column(String, nullable=True)  # Company (for top-level roles), university, organization, department, etc.

    # Time and location
    start_date = Column(String, nullable=True)  # Flexible format: "Jan 2020", "2020-01", etc.
    end_date = Column(String, nullable=True)  # "Present", "Dec 2022", etc.
    location = Column(String, nullable=True)  # "San Francisco, CA", "Remote", etc.

    # Content configuration
    content_type = Column(SQLEnum(ContentType, values_callable=lambda obj: [e.value for e in obj]), nullable=False, default=ContentType.BULLETS)
    description = Column(Text, nullable=True)  # Text description/paragraph (for TEXT_AND_BULLETS or PARAGRAPH types)

    # Organization
    order = Column(Integer, default=0)
    is_visible = Column(Boolean, default=True)

    # Flexible additional data
    extra_data = Column(JSON, nullable=True)  # {"company_size": "5000+", "industry": "Tech", "degree_type": "Bachelor's", "gpa": "3.8", etc.}

    # Metadata for AI and tracking
    meta_info = Column(JSON, nullable=True)  # {"source": "manual", "ai_enhanced": false, "keywords": [...], "last_edited": "2024-01-15"}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    section = relationship("Section", back_populates="entries")
    items = relationship("SectionItem", back_populates="entry", cascade="all, delete-orphan", order_by="SectionItem.order")

    # Self-referential relationship for hierarchical structure
    parent_entry = relationship("SectionEntry", remote_side=[id], back_populates="sub_entries")
    sub_entries = relationship("SectionEntry", back_populates="parent_entry", cascade="all, delete-orphan", order_by="SectionEntry.order")


class SectionItem(Base):
    """
    Individual bullet points or list items within an entry
    Each item represents one achievement, responsibility, skill, etc.
    """
    __tablename__ = "section_items"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("section_entries.id", ondelete="CASCADE"), nullable=False)

    # Content
    content = Column(Text, nullable=False)  # The actual bullet point text

    # Organization
    order = Column(Integer, default=0)
    is_visible = Column(Boolean, default=True)

    # Metadata for AI and tracking
    meta_info = Column(JSON, nullable=True)  # {"source": "manual", "ai_suggested": false, "keywords": [...], "impact_score": 8}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entry = relationship("SectionEntry", back_populates="items")


class TailoredCVVersion(Base):
    """
    Saved tailored CV versions for specific job applications
    Stores which items were selected from the master profile for each application
    """
    __tablename__ = "tailored_cv_versions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)

    # Job information
    job_title = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)  # Original job description

    # AI Analysis scores
    openai_fit_score = Column(Integer, nullable=True)  # 0-100
    claude_fit_score = Column(Integer, nullable=True)  # 0-100
    openai_ats_score = Column(Integer, nullable=True)  # 0-100
    claude_ats_score = Column(Integer, nullable=True)  # 0-100

    # Selected content (stored as JSON with item IDs)
    selected_content = Column(JSON, nullable=False)
    # Structure:
    # {
    #   "summary_items": [item_id1, item_id2, ...],
    #   "work_experience": [{
    #     "entry_id": entry_id,
    #     "items": [item_id1, item_id2, ...]
    #   }],
    #   "skills": [{
    #     "entry_id": entry_id,
    #     "items": [item_id1, item_id2, ...]
    #   }],
    #   "education_entries": [entry_id1, entry_id2, ...],
    #   "project_entries": [entry_id1, entry_id2, ...],
    #   "certification_entries": [entry_id1, entry_id2, ...]
    # }

    # AI recommendations (for reference)
    openai_recommendations = Column(JSON, nullable=True)
    claude_recommendations = Column(JSON, nullable=True)

    # Metadata
    notes = Column(Text, nullable=True)  # User's notes about this application
    status = Column(String, default="draft")  # draft, applied, interview, rejected, offer
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    profile = relationship("Profile")
