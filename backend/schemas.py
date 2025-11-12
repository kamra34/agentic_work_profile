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
    recommendations: Optional[Dict[str, Any]]
    job_analysis: Optional[Dict[str, Any]]
    notes: Optional[str]
    status: str
    application_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
