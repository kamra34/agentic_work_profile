from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

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

class SectionItemCreate(SectionItemBase):
    pass

class SectionItemUpdate(BaseModel):
    content: Optional[str] = None
    order: Optional[int] = None

class SectionItemResponse(SectionItemBase):
    id: int
    entry_id: int
    page_reference: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SectionEntryBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = 0
    extra_data: Optional[Dict[str, Any]] = None

class SectionEntryCreate(SectionEntryBase):
    items: Optional[List[SectionItemCreate]] = []

class SectionEntryUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class SectionEntryResponse(SectionEntryBase):
    id: int
    section_id: int
    page_reference: Optional[Dict[str, Any]] = None
    created_at: datetime
    items: List[SectionItemResponse] = []

    class Config:
        from_attributes = True

class SectionBase(BaseModel):
    title: str
    section_type: str
    content: Optional[str] = None
    order: Optional[int] = 0

class SectionCreate(SectionBase):
    entries: Optional[List[SectionEntryCreate]] = []

class SectionUpdate(BaseModel):
    title: Optional[str] = None
    section_type: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None

class SectionResponse(SectionBase):
    id: int
    profile_id: int
    page_reference: Optional[Dict[str, Any]] = None
    created_at: datetime
    entries: List[SectionEntryResponse] = []

    class Config:
        from_attributes = True

class ProfileBase(BaseModel):
    original_filename: str
    openai_model: Optional[str] = "gpt-4o"

class ProfileCreate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: int
    user_id: int
    file_path: str
    file_type: str
    created_at: datetime
    updated_at: datetime
    sections: List[SectionResponse] = []

    class Config:
        from_attributes = True

class ProfileUploadResponse(BaseModel):
    profile: ProfileResponse
    message: str
