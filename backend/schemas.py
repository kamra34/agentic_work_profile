"""
Universal Pydantic schemas for API validation.
All profile content uses ProfileNode schemas - no section-specific schemas needed.
"""

from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional, Dict, Any
from datetime import datetime


# ============================================================================
# User Schemas
# ============================================================================

class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Password is too long (max 72 bytes)')
        return v

    @validator('full_name')
    def validate_full_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Full name must be at least 2 characters long')
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    is_admin: bool

    class Config:
        from_attributes = True


class UserProfileInfo(BaseModel):
    """User profile information for personal details page"""
    full_name: str
    email: str
    phone_number: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    professional_title: Optional[str] = None
    years_of_experience: Optional[int] = None
    bio: Optional[str] = None
    availability: str = 'available'
    preferred_work_mode: str = 'hybrid'

    class Config:
        from_attributes = True


class UserProfileInfoUpdate(BaseModel):
    """Update user profile information"""
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    professional_title: Optional[str] = None
    years_of_experience: Optional[int] = None
    bio: Optional[str] = None
    availability: Optional[str] = None
    preferred_work_mode: Optional[str] = None


class UserAISettings(BaseModel):
    """User-level AI model settings used by Tailor CV pipeline"""
    openai_model: str = "gpt-4o"
    openai_reasoning_effort: str = "medium"
    claude_model: str = "claude-sonnet-4-20250514"
    openai_api_key_configured: bool = False
    anthropic_api_key_configured: bool = False
    humanity_deep_mode_enabled: bool = True
    humanity_llm_model: str = "gpt-4o"
    humanity_llm_reasoning_effort: str = "low"
    refinement_instruction_templates: List[Dict[str, str]] = []


class UserAISettingsUpdate(BaseModel):
    """Update user-level AI model settings"""
    openai_model: Optional[str] = None
    openai_reasoning_effort: Optional[str] = None
    claude_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    clear_openai_api_key: Optional[bool] = None
    clear_anthropic_api_key: Optional[bool] = None
    humanity_deep_mode_enabled: Optional[bool] = None
    humanity_llm_model: Optional[str] = None
    humanity_llm_reasoning_effort: Optional[str] = None
    refinement_instruction_templates: Optional[List[Dict[str, str]]] = None


# ============================================================================
# ProfileNode Schemas (Universal - handles ALL content types)
# ============================================================================

class ProfileNodeBase(BaseModel):
    """Base schema for all profile nodes"""
    node_type: str = "entry"
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    content_type: str = "text"

    # Optional metadata
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None

    # Display
    order: int = 0
    is_visible: bool = True
    icon: Optional[str] = None

    # Hierarchy tracking (auto-computed, but can be set manually)
    level: int = 0
    root_id: Optional[int] = None

    # Extensions
    attributes: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None


class ProfileNodeCreate(ProfileNodeBase):
    """Create a new node - can include nested children"""
    parent_id: Optional[int] = None
    children: Optional[List['ProfileNodeCreate']] = []


class ProfileNodeUpdate(BaseModel):
    """Update existing node - all fields optional"""
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
    level: Optional[int] = None
    root_id: Optional[int] = None
    attributes: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None
    parent_id: Optional[int] = None


class ProfileNodeResponse(ProfileNodeBase):
    """Full node with children"""
    id: int
    global_id: str
    profile_id: int
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    children: List['ProfileNodeResponse'] = []

    class Config:
        from_attributes = True


# Enable forward references for recursive models
ProfileNodeCreate.model_rebuild()
ProfileNodeResponse.model_rebuild()


# ============================================================================
# Profile Schemas
# ============================================================================

class ProfileBase(BaseModel):
    title: str = "My Profile"
    is_default: Optional[bool] = True
    contact_info: Optional[Dict[str, str]] = None
    notes: Optional[str] = None


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    title: Optional[str] = None
    is_default: Optional[bool] = None
    contact_info: Optional[Dict[str, str]] = None
    notes: Optional[str] = None


class ProfileResponse(ProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    nodes: List[ProfileNodeResponse] = []

    class Config:
        from_attributes = True


# ============================================================================
# TailoredCV Schemas
# ============================================================================

class TailoredCVCreate(BaseModel):
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    selected_node_ids: List[str]
    content_snapshot: Dict[str, Any]
    fit_scores: Optional[Dict[str, int]] = None
    ats_scores: Optional[Dict[str, int]] = None
    recommendations: Optional[Dict[str, Any]] = None
    job_analysis: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class TailoredCVUpdate(BaseModel):
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    selected_node_ids: Optional[List[str]] = None
    content_snapshot: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    application_date: Optional[datetime] = None


class TailoredCVResponse(BaseModel):
    id: int
    user_id: int
    profile_id: int
    job_title: str
    company_name: Optional[str]
    job_description: Optional[str]
    fit_scores: Optional[Dict[str, int]]
    ats_scores: Optional[Dict[str, int]]
    selected_node_ids: List[str]
    content_snapshot: Dict[str, Any]
    original_snapshot: Optional[Dict[str, Any]]
    recommendations: Optional[Dict[str, Any]]
    job_analysis: Optional[Dict[str, Any]]
    notes: Optional[str]
    status: str
    application_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# JobApplication Schemas (Application Tracker)
# ============================================================================

class JobApplicationCreate(BaseModel):
    """Create a new job application from a tailored CV"""
    tailored_cv_id: int
    cv_format: str = "professional"  # professional, modern, compact, creative
    pdf_customizations: Optional[dict] = None  # fontSize, spacing, colorIntensity, sectionOrder
    job_url: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    cover_letter: Optional[str] = None
    priority: str = "medium"


class JobApplicationUpdate(BaseModel):
    """Update an existing job application"""
    status: Optional[str] = None
    application_date: Optional[datetime] = None
    submission_method: Optional[str] = None
    follow_up_date: Optional[datetime] = None
    interview_dates: Optional[List[Dict[str, Any]]] = None
    response_date: Optional[datetime] = None
    response_type: Optional[str] = None
    notes: Optional[str] = None
    cover_letter: Optional[str] = None
    priority: Optional[str] = None
    reminder_date: Optional[datetime] = None
    job_url: Optional[str] = None
    location: Optional[str] = None
    clear_dates: Optional[List[str]] = None  # List of date fields to clear when moving backward


class JobApplicationResponse(BaseModel):
    """Full job application details"""
    id: int
    user_id: int
    tailored_cv_id: int
    job_title: str
    company_name: Optional[str]
    job_description: Optional[str]
    job_url: Optional[str]
    location: Optional[str]
    final_content_snapshot: Dict[str, Any]
    cv_format: str
    pdf_customizations: Optional[Dict[str, Any]] = None  # PDF generation settings
    initial_fit_scores: Optional[Dict[str, Any]]  # Full response with nested structures
    initial_ats_scores: Optional[Dict[str, Any]]  # Full response with nested structures
    final_fit_scores: Optional[Dict[str, Any]]  # Full response with nested structures
    final_ats_scores: Optional[Dict[str, Any]]  # Full response with nested structures
    score_history: Optional[List[Dict[str, Any]]]
    status: str

    # Timeline dates - track when application moved to each stage
    ready_date: Optional[datetime]
    applied_date: Optional[datetime]
    phone_screen_date: Optional[datetime]
    interview_date: Optional[datetime]
    offer_date: Optional[datetime]
    accepted_date: Optional[datetime]
    rejected_date: Optional[datetime]
    withdrawn_date: Optional[datetime]

    application_date: Optional[datetime]  # Legacy field
    submission_method: Optional[str]
    follow_up_date: Optional[datetime]
    interview_dates: Optional[List[Dict[str, Any]]]
    response_date: Optional[datetime]
    response_type: Optional[str]
    notes: Optional[str]
    cover_letter: Optional[str]
    priority: str
    reminder_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    finalized_at: Optional[datetime]

    # AI Analysis from related TailoredCV
    job_analysis: Optional[Dict[str, Any]] = None  # Job analysis from both OpenAI and Claude

    class Config:
        from_attributes = True
