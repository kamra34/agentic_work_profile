from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Path to stored CV file
    file_type = Column(String, nullable=False)  # pdf or docx
    openai_model = Column(String, default="gpt-4o")  # Model used for extraction
    linkedin_url = Column(String, nullable=True)  # LinkedIn profile URL
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="profile")
    sections = relationship("Section", back_populates="profile", cascade="all, delete-orphan")


class Section(Base):
    """
    Level 1: Top-level sections like Summary, Work Experience, Education, Skills
    """
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)  # e.g., "Summary", "Work Experience"
    section_type = Column(String, nullable=False)  # summary, work_experience, education, skills, etc.
    content = Column(Text, nullable=True)  # For simple sections like Summary (no entries needed)
    order = Column(Integer, default=0)  # For ordering sections
    source = Column(String, nullable=True)  # e.g., "source: CV-resume.pdf" or "source: LinkedIn"
    page_reference = Column(JSON, nullable=True)  # {"page": 1, "coordinates": {...}} for PDF highlighting
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    profile = relationship("Profile", back_populates="sections")
    entries = relationship("SectionEntry", back_populates="section", cascade="all, delete-orphan")


class SectionEntry(Base):
    """
    Level 2: Individual entries within a section
    e.g., a specific job in Work Experience, a degree in Education
    """
    __tablename__ = "section_entries"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)  # e.g., "Software Engineer at Google"
    subtitle = Column(String, nullable=True)  # e.g., Company name or degree name
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)  # "Present" for current positions
    location = Column(String, nullable=True)
    description = Column(Text, nullable=True)  # Brief description
    order = Column(Integer, default=0)
    source = Column(String, nullable=True)  # e.g., "CV: resume.pdf" or "LinkedIn"
    page_reference = Column(JSON, nullable=True)
    extra_data = Column(JSON, nullable=True)  # Extra fields like company, degree_type, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    section = relationship("Section", back_populates="entries")
    items = relationship("SectionItem", back_populates="entry", cascade="all, delete-orphan")


class SectionItem(Base):
    """
    Level 3: Individual bullet points/items within an entry
    e.g., specific achievements, responsibilities, skills
    """
    __tablename__ = "section_items"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("section_entries.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    order = Column(Integer, default=0)
    source = Column(String, nullable=True)  # e.g., "CV: resume.pdf" or "LinkedIn"
    page_reference = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entry = relationship("SectionEntry", back_populates="items")
