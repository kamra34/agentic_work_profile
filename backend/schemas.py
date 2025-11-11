from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# Enum types matching database
class ContentType(str, Enum):
    PARAGRAPH = "paragraph"
    BULLETS = "bullets"
    TEXT_AND_BULLETS = "text_and_bullets"
    EMPTY = "empty"

class SectionType(str, Enum):
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
    CUSTOM = "custom"

# User schemas
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

# Profile schemas
class SectionItemBase(BaseModel):
    content: str
    order: Optional[int] = 0
    is_visible: Optional[bool] = True
    meta_info: Optional[Dict[str, Any]] = None

class SectionItemCreate(SectionItemBase):
    pass

class SectionItemUpdate(BaseModel):
    content: Optional[str] = None
    order: Optional[int] = None
    is_visible: Optional[bool] = None
    meta_info: Optional[Dict[str, Any]] = None

class SectionItemResponse(SectionItemBase):
    id: int
    entry_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SectionEntryBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    content_type: ContentType = ContentType.BULLETS
    order: Optional[int] = 0
    is_visible: Optional[bool] = True
    extra_data: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None

class SectionEntryCreate(SectionEntryBase):
    parent_entry_id: Optional[int] = None  # For nested entries (e.g., roles within a company)
    items: Optional[List[SectionItemCreate]] = []
    sub_entries: Optional[List['SectionEntryCreate']] = []  # For hierarchical structure

class SectionEntryUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    order: Optional[int] = None
    is_visible: Optional[bool] = None
    extra_data: Optional[Dict[str, Any]] = None
    meta_info: Optional[Dict[str, Any]] = None

class SectionEntryResponse(SectionEntryBase):
    id: int
    section_id: int
    parent_entry_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: List[SectionItemResponse] = []
    sub_entries: List['SectionEntryResponse'] = []  # For hierarchical structure

    class Config:
        from_attributes = True

# Enable forward references for recursive models
SectionEntryCreate.model_rebuild()
SectionEntryResponse.model_rebuild()

class SectionBase(BaseModel):
    title: str
    section_type: SectionType
    icon: Optional[str] = None
    content: Optional[str] = None
    content_type: ContentType = ContentType.EMPTY
    order: Optional[int] = 0
    is_visible: Optional[bool] = True
    meta_info: Optional[Dict[str, Any]] = None

class SectionCreate(SectionBase):
    entries: Optional[List[SectionEntryCreate]] = []

class SectionUpdate(BaseModel):
    title: Optional[str] = None
    section_type: Optional[SectionType] = None
    icon: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[ContentType] = None
    order: Optional[int] = None
    is_visible: Optional[bool] = None
    meta_info: Optional[Dict[str, Any]] = None

class SectionResponse(SectionBase):
    id: int
    profile_id: int
    created_at: datetime
    updated_at: datetime
    entries: List[SectionEntryResponse] = []

    class Config:
        from_attributes = True

class ProfileBase(BaseModel):
    title: str = "My Profile"
    is_default: Optional[bool] = True
    contact_info: Optional[Dict[str, str]] = None  # {"phone": "...", "email": "...", "location": "...", "linkedin": "...", "github": "..."}
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
    sections: List[SectionResponse] = []

    class Config:
        from_attributes = True

# AI Editor schemas
class AIEditRequest(BaseModel):
    entry_id: Optional[int] = None
    section_id: Optional[int] = None
    model_type: str  # "openai" or "claude"
    model: Optional[str] = None  # specific model name

class HumanizedRewrite(BaseModel):
    text: str
    original: Optional[str] = None
    action: str  # "edit", "keep", "delete", or "add"
    reason: Optional[str] = None

class AIEditResponse(BaseModel):
    verdict: str
    hard_critique: List[str]
    humanized_rewrites: List[HumanizedRewrite]
    missing_evidence: List[str]
    ats_keywords: List[str]
    risk_flags: Optional[List[str]] = None
    style_check: str

class AIChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class AIChatRequest(BaseModel):
    entry_id: Optional[int] = None
    section_id: Optional[int] = None
    messages: List[AIChatMessage]
    model_type: str  # "openai" or "claude"
    model: Optional[str] = None

class AIChatResponse(BaseModel):
    response: Optional[str] = None
    # When structured response (user asks for suggestions)
    verdict: Optional[str] = None
    hard_critique: Optional[List[str]] = None
    humanized_rewrites: Optional[List[HumanizedRewrite]] = None
    missing_evidence: Optional[List[str]] = None
    ats_keywords: Optional[List[str]] = None
    risk_flags: Optional[List[str]] = None
    style_check: Optional[str] = None

# Job Analysis schemas
class JobAnalysisRequest(BaseModel):
    job_description: str

class JobAnalysisResult(BaseModel):
    provider: str  # "openai" or "anthropic"
    model: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class JobAnalysisResponse(BaseModel):
    job_description: str
    analyses: List[JobAnalysisResult]

# Profile Fit Analysis schemas
class ProfileFitRequest(BaseModel):
    job_analysis: Dict[str, Any]  # The job analysis result from job_analysis_service

class ProfileFitResult(BaseModel):
    provider: str  # "openai" or "anthropic"
    model: Optional[str] = None
    fit_analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ProfileFitResponse(BaseModel):
    job_analysis: Dict[str, Any]
    user_profile_summary: Optional[Dict[str, Any]] = None  # Optional since we include formatted_profile in input_data
    input_data: Dict[str, Any]
    fit_analyses: List[ProfileFitResult]

# CV Tailoring schemas
class CVTailoringRequest(BaseModel):
    job_analysis: Dict[str, Any]

class CVTailoringRecommendation(BaseModel):
    provider: str  # "openai" or "anthropic"
    model: Optional[str] = None
    recommendations: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class CVTailoringResponse(BaseModel):
    job_analysis: Dict[str, Any]
    input_data: Dict[str, Any]
    tailoring_recommendations: List[CVTailoringRecommendation]
    enriched_recommendations: Optional[Dict[str, Any]] = None

# Tailored CV Version schemas
class TailoredCVCreate(BaseModel):
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    selected_content: Dict[str, Any]
    openai_fit_score: Optional[int] = None
    claude_fit_score: Optional[int] = None
    openai_ats_score: Optional[int] = None
    claude_ats_score: Optional[int] = None
    openai_recommendations: Optional[Dict[str, Any]] = None
    claude_recommendations: Optional[Dict[str, Any]] = None
    job_analysis: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None

class TailoredCVUpdate(BaseModel):
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    selected_content: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class PDFDownloadRequest(BaseModel):
    hidden_items: List[int] = []
    template_name: str = "modern"

class TailoredCVResponse(BaseModel):
    id: int
    user_id: int
    profile_id: int
    job_title: str
    company_name: Optional[str]
    job_description: Optional[str]
    openai_fit_score: Optional[int]
    claude_fit_score: Optional[int]
    openai_ats_score: Optional[int]
    claude_ats_score: Optional[int]
    selected_content: Dict[str, Any]
    openai_recommendations: Optional[Dict[str, Any]]
    claude_recommendations: Optional[Dict[str, Any]]
    job_analysis: Optional[List[Dict[str, Any]]]
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
