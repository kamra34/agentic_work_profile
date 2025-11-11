from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import List
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables FIRST before importing our modules
load_dotenv()

# Import our modules
from models import Base, User, Profile, Section, SectionEntry, SectionItem, TailoredCVVersion
from schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    ProfileResponse, ProfileCreate, ProfileUpdate,
    SectionResponse, SectionCreate, SectionUpdate,
    SectionEntryResponse, SectionEntryCreate, SectionEntryUpdate,
    SectionItemResponse, SectionItemCreate, SectionItemUpdate,
    AIEditRequest, AIEditResponse, AIChatRequest, AIChatResponse,
    JobAnalysisRequest, JobAnalysisResponse,
    ProfileFitRequest, ProfileFitResponse,
    CVTailoringRequest, CVTailoringResponse,
    TailoredCVCreate, TailoredCVUpdate, TailoredCVResponse,
    PDFDownloadRequest
)
from file_utils import extract_text_from_file
from openai_service import parse_cv_with_openai
from linkedin_service import parse_linkedin_text_with_openai
from ai_editor_service import edit_with_openai, edit_with_claude, chat_with_ai
from job_analysis_service import analyze_job_description_dual
from profile_fit_service import analyze_profile_fit_dual
from cv_tailoring_service import tailor_cv_dual
from pdf_service import generate_cv_pdf

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kami:4444@eu1.pitunnel.com:20877/work_profile")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# FastAPI app
app = FastAPI(title="Resume Builder API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Version endpoint
@app.get("/api/version")
async def get_version():
    """Get backend version"""
    try:
        with open(os.path.join(os.path.dirname(__file__), "VERSION"), "r") as f:
            version = f.read().strip()
        return {"version": version}
    except:
        return {"version": "unknown"}

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Startup event
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Resume Builder API"}

# ==================== AUTH ENDPOINTS ====================

@app.post("/api/register", response_model=UserResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        is_admin=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

@app.post("/api/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== PROFILE ENDPOINTS ====================

# REMOVED: CV upload endpoint - now using manual profile creation
# @app.post("/api/profile/upload", response_model=ProfileUploadResponse)
# async def upload_profile(...):
#     """Upload CV (PDF/DOCX) and extract profile information using OpenAI"""
#     ... (commented out - see git history for original code)

# NEW: Get all profiles for a user (supports multiple profiles)
@app.get("/api/profiles", response_model=list[ProfileResponse])
def get_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all profiles for the current user"""
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).order_by(Profile.is_default.desc(), Profile.created_at.desc()).all()
    return profiles

# NEW: Create a new profile
@app.post("/api/profiles", response_model=ProfileResponse)
def create_profile(
    profile_data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new profile"""
    db_profile = Profile(
        user_id=current_user.id,
        title=profile_data.title,
        is_default=profile_data.is_default,
        contact_info=profile_data.contact_info,
        notes=profile_data.notes
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile

# NEW: Get a specific profile by ID
@app.get("/api/profiles/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific profile by ID"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

# NEW: Update a profile
@app.put("/api/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: int,
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a profile"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = profile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile

# NEW: Delete a profile
@app.delete("/api/profiles/{profile_id}")
def delete_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a profile"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    db.delete(profile)
    db.commit()
    return {"message": "Profile deleted successfully"}

# REMOVED: Old endpoints that referenced file_path, original_filename, and LinkedIn import
# These used the old single-profile CV extraction approach
# @app.get("/api/profile/file")
# @app.post("/api/profile/linkedin") - LinkedIn import endpoint removed

# ==================== SECTION ENDPOINTS ====================

@app.post("/api/profiles/{profile_id}/sections", response_model=SectionResponse)
def create_section(
    profile_id: int,
    section_data: SectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new section in a profile"""
    # Verify profile belongs to user
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    db_section = Section(
        profile_id=profile.id,
        title=section_data.title,
        section_type=section_data.section_type,  # Pass enum member directly, SQLAlchemy will handle conversion
        icon=section_data.icon,
        content=section_data.content,
        content_type=section_data.content_type,  # Pass enum member directly, SQLAlchemy will handle conversion
        order=section_data.order,
        is_visible=section_data.is_visible,
        meta_info=section_data.meta_info
    )
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section

@app.put("/api/sections/{section_id}", response_model=SectionResponse)
def update_section(
    section_id: int,
    section_data: SectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a section"""
    section = db.query(Section).join(Profile).filter(
        Section.id == section_id,
        Profile.user_id == current_user.id
    ).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    for key, value in section_data.dict(exclude_unset=True).items():
        setattr(section, key, value)

    db.commit()
    db.refresh(section)
    return section

@app.delete("/api/sections/{section_id}")
def delete_section(
    section_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a section"""
    section = db.query(Section).join(Profile).filter(
        Section.id == section_id,
        Profile.user_id == current_user.id
    ).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    db.delete(section)
    db.commit()
    return {"message": "Section deleted successfully"}

# ==================== ENTRY ENDPOINTS ====================

@app.post("/api/sections/{section_id}/entries", response_model=SectionEntryResponse)
def create_entry(
    section_id: int,
    entry_data: SectionEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new entry in a section"""
    section = db.query(Section).join(Profile).filter(
        Section.id == section_id,
        Profile.user_id == current_user.id
    ).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Create the main entry
    db_entry = SectionEntry(
        section_id=section.id,
        parent_entry_id=entry_data.parent_entry_id,
        title=entry_data.title,
        subtitle=entry_data.subtitle,
        start_date=entry_data.start_date,
        end_date=entry_data.end_date,
        location=entry_data.location,
        description=entry_data.description,
        content_type=entry_data.content_type,
        order=entry_data.order,
        is_visible=entry_data.is_visible,
        extra_data=entry_data.extra_data,
        meta_info=entry_data.meta_info or {"source": "manual"}
    )
    db.add(db_entry)
    db.flush()

    # Add items (bullet points) if any
    for idx, item in enumerate(entry_data.items or []):
        db_item = SectionItem(
            entry_id=db_entry.id,
            content=item.content,
            order=item.order if item.order is not None else idx,
            is_visible=item.is_visible,
            meta_info=item.meta_info or {"source": "manual"}
        )
        db.add(db_item)

    # Recursively add sub-entries if any (for hierarchical structure)
    def create_sub_entries(parent_entry: SectionEntry, sub_entries_data: list, parent_order: int = 0):
        for idx, sub_entry_data in enumerate(sub_entries_data):
            db_sub_entry = SectionEntry(
                section_id=section.id,
                parent_entry_id=parent_entry.id,
                title=sub_entry_data.title,
                subtitle=sub_entry_data.subtitle,
                start_date=sub_entry_data.start_date,
                end_date=sub_entry_data.end_date,
                location=sub_entry_data.location,
                description=sub_entry_data.description,
                content_type=sub_entry_data.content_type,
                order=sub_entry_data.order if sub_entry_data.order is not None else idx,
                is_visible=sub_entry_data.is_visible,
                extra_data=sub_entry_data.extra_data,
                meta_info=sub_entry_data.meta_info or {"source": "manual"}
            )
            db.add(db_sub_entry)
            db.flush()

            # Add items for this sub-entry
            for item_idx, item_data in enumerate(sub_entry_data.items or []):
                db_item = SectionItem(
                    entry_id=db_sub_entry.id,
                    content=item_data.content,
                    order=item_data.order if item_data.order is not None else item_idx,
                    is_visible=item_data.is_visible,
                    meta_info=item_data.meta_info or {"source": "manual"}
                )
                db.add(db_item)

            # Recursively handle nested sub-entries if any
            if sub_entry_data.sub_entries:
                create_sub_entries(db_sub_entry, sub_entry_data.sub_entries, idx)

    if entry_data.sub_entries:
        create_sub_entries(db_entry, entry_data.sub_entries)

    db.commit()
    db.refresh(db_entry)
    return db_entry

@app.put("/api/entries/{entry_id}", response_model=SectionEntryResponse)
def update_entry(
    entry_id: int,
    entry_data: SectionEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an entry"""
    entry = db.query(SectionEntry).join(Section).join(Profile).filter(
        SectionEntry.id == entry_id,
        Profile.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    for key, value in entry_data.dict(exclude_unset=True).items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return entry

@app.delete("/api/entries/{entry_id}")
def delete_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an entry"""
    entry = db.query(SectionEntry).join(Section).join(Profile).filter(
        SectionEntry.id == entry_id,
        Profile.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted successfully"}

@app.post("/api/entries/reorder")
def reorder_entries(
    updates: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder entries by updating their order values"""
    try:
        for update in updates.get("updates", []):
            entry_id = update.get("id")
            new_order = update.get("order")

            # Verify the entry belongs to the current user
            entry = db.query(SectionEntry).join(Section).join(Profile).filter(
                SectionEntry.id == entry_id,
                Profile.user_id == current_user.id
            ).first()

            if entry:
                entry.order = new_order

        db.commit()
        return {"message": "Entries reordered successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ITEM ENDPOINTS ====================

@app.post("/api/entries/{entry_id}/items", response_model=SectionItemResponse)
def create_item(
    entry_id: int,
    item_data: SectionItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new item in an entry"""
    entry = db.query(SectionEntry).join(Section).join(Profile).filter(
        SectionEntry.id == entry_id,
        Profile.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db_item = SectionItem(
        entry_id=entry.id,
        content=item_data.content,
        order=item_data.order,
        is_visible=item_data.is_visible,
        meta_info=item_data.meta_info or {"source": "manual"}
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/api/items/{item_id}", response_model=SectionItemResponse)
def update_item(
    item_id: int,
    item_data: SectionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an item"""
    item = db.query(SectionItem).join(SectionEntry).join(Section).join(Profile).filter(
        SectionItem.id == item_id,
        Profile.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in item_data.dict(exclude_unset=True).items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/items/{item_id}")
def delete_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an item"""
    item = db.query(SectionItem).join(SectionEntry).join(Section).join(Profile).filter(
        SectionItem.id == item_id,
        Profile.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}

@app.post("/api/items/reorder")
def reorder_items(
    updates: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder items by updating their order values"""
    try:
        for update in updates.get("updates", []):
            item_id = update.get("id")
            new_order = update.get("order")

            # Verify the item belongs to the current user
            item = db.query(SectionItem).join(SectionEntry).join(Section).join(Profile).filter(
                SectionItem.id == item_id,
                Profile.user_id == current_user.id
            ).first()

            if item:
                item.order = new_order

        db.commit()
        return {"message": "Items reordered successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AI EDITOR ENDPOINTS ====================

@app.post("/api/entries/{entry_id}/ai-edit", response_model=AIEditResponse)
def ai_edit_entry(
    entry_id: int,
    request: AIEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI critique and suggestions for an entry"""
    # Fetch the entry with authorization check
    entry = db.query(SectionEntry).join(Section).join(Profile).filter(
        SectionEntry.id == entry_id,
        Profile.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Get the section to fetch all entries for context
    section = entry.section
    all_entries = []
    for e in section.entries:
        entry_dict = {
            "id": e.id,
            "title": e.title,
            "subtitle": e.subtitle,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "location": e.location,
            "description": e.description,
            "items": [{"content": item.content} for item in e.items]
        }
        all_entries.append(entry_dict)

    # Find the specific entry dict
    entry_dict = next((e for e in all_entries if e["id"] == entry_id), None)

    try:
        if request.model_type == "openai":
            result = edit_with_openai(entry_dict, all_entries, request.model or "gpt-4o")
        elif request.model_type == "claude":
            result = edit_with_claude(entry_dict, all_entries, request.model or "claude-3-5-sonnet-20241022")
        else:
            raise HTTPException(status_code=400, detail="Invalid model_type")

        return AIEditResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/entries/{entry_id}/ai-chat", response_model=AIChatResponse)
def ai_chat_entry(
    entry_id: int,
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Continue conversation with AI about an entry"""
    # Fetch the entry with authorization check
    entry = db.query(SectionEntry).join(Section).join(Profile).filter(
        SectionEntry.id == entry_id,
        Profile.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Build entry context
    entry_context = {
        "id": entry.id,
        "title": entry.title,
        "subtitle": entry.subtitle,
        "start_date": entry.start_date,
        "end_date": entry.end_date,
        "location": entry.location,
        "description": entry.description,
        "items": [{"content": item.content} for item in entry.items]
    }

    # Convert messages
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    try:
        result = chat_with_ai(messages, entry_context, request.model_type, request.model)
        # Result can be either {"response": "text"} or full critique object
        return AIChatResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sections/{section_id}/ai-edit", response_model=AIEditResponse)
def ai_edit_section(
    section_id: int,
    request: AIEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI critique and suggestions for a section (e.g., Summary)"""
    # Get the section and verify ownership
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    profile = db.query(Profile).filter(Profile.id == section.profile_id).first()
    if profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # For sections, we treat the content as a single piece of text to critique
    section_dict = {
        "id": section.id,
        "title": section.title,
        "content": section.content,
        "section_type": section.section_type
    }

    # Get all sections for context (not other entries, but other sections)
    all_sections = db.query(Section).filter(Section.profile_id == profile.id).all()
    all_sections_data = [{"id": s.id, "title": s.title, "section_type": s.section_type} for s in all_sections]

    try:
        if request.model_type == "openai":
            result = edit_with_openai(section_dict, all_sections_data, request.model or "gpt-4o")
        elif request.model_type == "claude":
            result = edit_with_claude(section_dict, all_sections_data, request.model or "claude-3-5-sonnet-20241022")
        else:
            raise HTTPException(status_code=400, detail="Invalid model type")

        return AIEditResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sections/{section_id}/ai-chat", response_model=AIChatResponse)
def ai_chat_section(
    section_id: int,
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Continue conversation with AI about a section"""
    # Get the section and verify ownership
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    profile = db.query(Profile).filter(Profile.id == section.profile_id).first()
    if profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    section_context = {
        "id": section.id,
        "title": section.title,
        "content": section.content,
        "section_type": section.section_type
    }

    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    try:
        result = chat_with_ai(
            messages=messages,
            entry_context=section_context,
            model_type=request.model_type,
            model=request.model
        )
        # Result can be either {"response": "text"} or full critique object
        return AIChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/job/analyze", response_model=JobAnalysisResponse)
async def analyze_job_description(
    request: JobAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze a job description using both OpenAI (GPT-4o) and Anthropic (Claude Sonnet 4.5)

    Returns structured analysis including:
    - Job category (technical, managerial, leadership, etc.)
    - Key requirements and qualifications
    - Technical and soft skills
    - Education and experience requirements
    - Responsibilities and job level
    """
    try:
        result = analyze_job_description_dual(request.job_description)
        return JobAnalysisResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_complete_user_profile_data(db: Session, user_id: int) -> dict:
    """
    Fetch complete user profile with all sections, entries, and items
    """
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return {}

    sections = db.query(Section).filter(Section.profile_id == profile.id).all()

    # Extract contact info from JSON field
    contact_info = profile.contact_info or {}

    profile_data = {
        "profile_id": profile.id,
        "profile_title": profile.title,
        "contact_info": contact_info,
        "phone": contact_info.get("phone"),
        "email": contact_info.get("email"),
        "location": contact_info.get("location"),
        "linkedin": contact_info.get("linkedin"),
        "github": contact_info.get("github"),
        "website": contact_info.get("website"),
        "sections": []
    }

    for section in sections:
        section_data = {
            "id": section.id,
            "type": section.section_type.value if section.section_type else None,
            "title": section.title,
            "content": section.content,
            "content_type": section.content_type.value if section.content_type else None,
            "entries": []
        }

        # Get all entries (including both parent and sub-entries)
        entries = db.query(SectionEntry).filter(SectionEntry.section_id == section.id).order_by(SectionEntry.order).all()

        for entry in entries:
            # Build date range from start_date and end_date
            date_range = None
            if entry.start_date or entry.end_date:
                date_range = f"{entry.start_date or ''} - {entry.end_date or 'Present'}".strip(' -')

            entry_data = {
                "id": entry.id,
                "title": entry.title,
                "subtitle": entry.subtitle,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
                "date_range": date_range,
                "location": entry.location,
                "description": entry.description,
                "content_type": entry.content_type.value if entry.content_type else None,
                "order": entry.order,
                "parent_entry_id": entry.parent_entry_id,  # Include parent relationship
                "items": []
            }

            items = db.query(SectionItem).filter(SectionItem.entry_id == entry.id).order_by(SectionItem.order).all()

            for item in items:
                entry_data["items"].append({
                    "id": item.id,
                    "content": item.content,
                    "order": item.order
                })

            section_data["entries"].append(entry_data)

        profile_data["sections"].append(section_data)

    return profile_data


@app.post("/api/job/analyze-fit", response_model=ProfileFitResponse)
async def analyze_profile_fit(
    request: ProfileFitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze how well the user's profile matches a job description

    Uses both OpenAI and Anthropic to provide unbiased, honest assessment
    of fit percentage, strengths, gaps, and recommendation
    """
    try:
        print(f"[DEBUG] Analyzing fit for user {current_user.id}")
        print(f"[DEBUG] Job analysis keys: {request.job_analysis.keys() if isinstance(request.job_analysis, dict) else 'Not a dict'}")

        # Get complete user profile data
        user_profile = get_complete_user_profile_data(db, current_user.id)

        print(f"[DEBUG] User profile fetched: {bool(user_profile)}")
        print(f"[DEBUG] Profile sections count: {len(user_profile.get('sections', []))}")

        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        # Generate formatted profile text for AI
        from format_profile_for_ai import format_profile_for_ai
        formatted_profile = format_profile_for_ai(db, current_user.id)

        # Analyze fit with both AI models using formatted profile
        result = analyze_profile_fit_dual(request.job_analysis, formatted_profile)

        print(f"[DEBUG] Fit analysis completed successfully")
        return ProfileFitResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Fit analysis failed: {error_details}")
        raise HTTPException(status_code=500, detail=f"{str(e)}\n\nTraceback: {error_details}")


@app.post("/api/cv/tailor", response_model=CVTailoringResponse)
async def get_cv_tailoring_recommendations(
    request: CVTailoringRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get AI recommendations for which content to include in a tailored CV

    Both OpenAI and Claude analyze the master profile and recommend specific items
    to include for this job application
    """
    try:
        print(f"[DEBUG] Getting CV tailoring recommendations for user {current_user.id}")

        # Get complete user profile data
        user_profile = get_complete_user_profile_data(db, current_user.id)

        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        # Generate formatted profile text for AI
        from format_profile_for_ai import format_profile_for_ai
        formatted_profile = format_profile_for_ai(db, current_user.id)

        # Get recommendations from both AI models using formatted profile
        result = tailor_cv_dual(request.job_analysis, formatted_profile, user_profile)
        print(f"[DEBUG] CV tailoring recommendations generated successfully")
        return CVTailoringResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] CV tailoring failed: {error_details}")
        raise HTTPException(status_code=500, detail=str(e))


def convert_enriched_to_snapshot(profile: Profile, enriched_data: dict) -> dict:
    """
    Convert enriched recommendation data (with recommended_by metadata) directly to snapshot
    This preserves AI model attribution for each item
    """
    snapshot = {
        "contact_info": profile.contact_info,
        "sections": []
    }

    # Map section types to enriched data keys
    section_mapping = {
        "summary": enriched_data.get("summary", []),
        "work_experience": enriched_data.get("work_experience", []),
        "skills": enriched_data.get("skills", []),
        "education": enriched_data.get("education", []),
        "projects": enriched_data.get("projects", []),
        "certifications": enriched_data.get("certifications", []),
        "awards": enriched_data.get("awards", []),
        "publications": enriched_data.get("publications", []),
        "languages": enriched_data.get("languages", []),
        "volunteer": enriched_data.get("volunteer", [])
    }

    for section in profile.sections:
        section_type = section.section_type.value
        enriched_items = section_mapping.get(section_type, [])

        if not enriched_items:
            continue

        section_snapshot = {
            "id": section.id,
            "title": section.title,
            "section_type": section_type,
            "icon": section.icon,
            "content_type": section.content_type.value,
            "order": section.order,
            "content": section.content,
            "entries": []
        }

        # Handle different content structures
        if section_type == "summary":
            # Summary items are flat
            for item in enriched_items:
                section_snapshot["entries"].append({
                    "id": item.get("id"),
                    "items": [{
                        "id": item.get("id"),
                        "content": item.get("content"),
                        "order": item.get("order", 0),
                        "recommended_by": item.get("recommended_by", [])
                    }]
                })

        elif section_type in ["work_experience", "education", "projects"]:
            # These have entries with potential sub-entries
            for entry in enriched_items:
                entry_snapshot = {
                    "id": entry.get("id"),
                    "title": entry.get("title"),
                    "subtitle": entry.get("subtitle"),
                    "start_date": entry.get("start_date"),
                    "end_date": entry.get("end_date"),
                    "location": entry.get("location"),
                    "description": entry.get("description"),
                    "content_type": entry.get("content_type", "bullets"),
                    "order": entry.get("order", 0),
                    "items": [],
                    "sub_entries": [],
                    "reasoning": entry.get("reasoning")
                }

                # Add items with recommended_by metadata
                if entry.get("items"):
                    for item in entry["items"]:
                        entry_snapshot["items"].append({
                            "id": item.get("id"),
                            "content": item.get("content"),
                            "order": item.get("order", 0),
                            "recommended_by": item.get("recommended_by", [])
                        })

                # Add sub-entries (for work experience)
                if entry.get("sub_entries"):
                    for sub in entry["sub_entries"]:
                        sub_snapshot = {
                            "id": sub.get("id"),
                            "title": sub.get("title"),
                            "subtitle": sub.get("subtitle"),
                            "content_type": sub.get("content_type", "bullets"),
                            "order": sub.get("order", 0),
                            "items": [],
                            "reasoning": sub.get("reasoning")
                        }

                        if sub.get("items"):
                            for item in sub["items"]:
                                sub_snapshot["items"].append({
                                    "id": item.get("id"),
                                    "content": item.get("content"),
                                    "order": item.get("order", 0),
                                    "recommended_by": item.get("recommended_by", [])
                                })

                        entry_snapshot["sub_entries"].append(sub_snapshot)

                section_snapshot["entries"].append(entry_snapshot)

        elif section_type == "skills":
            # Skills have categories with items
            for category in enriched_items:
                category_snapshot = {
                    "id": category.get("id"),
                    "title": category.get("title"),
                    "content_type": category.get("content_type", "inline"),
                    "order": category.get("order", 0),
                    "items": [],
                    "reasoning": category.get("reasoning")
                }

                if category.get("items"):
                    for item in category["items"]:
                        category_snapshot["items"].append({
                            "id": item.get("id"),
                            "content": item.get("content"),
                            "order": item.get("order", 0),
                            "recommended_by": item.get("recommended_by", [])
                        })

                section_snapshot["entries"].append(category_snapshot)

        snapshot["sections"].append(section_snapshot)

    return snapshot


def convert_ids_to_content_snapshot(db: Session, profile: Profile, selected_ids: dict) -> dict:
    """
    Convert ID-based selection OR enriched data into actual content snapshot
    This ensures the CV remains intact even if master profile changes later
    """
    # Check if enriched_data is provided (new format with recommended_by metadata)
    if "enriched_data" in selected_ids:
        return convert_enriched_to_snapshot(profile, selected_ids["enriched_data"])

    # Otherwise, use legacy ID-based format
    snapshot = {
        "contact_info": profile.contact_info,
        "sections": []
    }

    # Build a lookup of all sections, entries, and items by ID
    section_map = {section.id: section for section in profile.sections}

    # Process each section type based on selected IDs
    for section in profile.sections:
        section_snapshot = None

        if section.section_type.value == "summary":
            selected_items = selected_ids.get("summary_items", [])
            if selected_items:
                section_snapshot = build_section_snapshot(section, selected_items=selected_items)

        elif section.section_type.value == "work_experience":
            selected_work = selected_ids.get("work_experience", [])
            if selected_work:
                section_snapshot = build_work_experience_snapshot(section, selected_work)

        elif section.section_type.value == "skills":
            selected_skills = selected_ids.get("skills", [])
            if selected_skills:
                section_snapshot = build_skills_snapshot(section, selected_skills)

        elif section.section_type.value == "education":
            selected_education = selected_ids.get("education_entries", [])
            if selected_education:
                section_snapshot = build_education_snapshot(section, selected_education)

        elif section.section_type.value == "projects":
            selected_projects = selected_ids.get("project_entries", [])
            if selected_projects:
                section_snapshot = build_generic_entries_snapshot(section, selected_projects)

        elif section.section_type.value == "certifications":
            selected_certs = selected_ids.get("certification_entries", [])
            if selected_certs:
                section_snapshot = build_generic_entries_snapshot(section, selected_certs)

        if section_snapshot:
            snapshot["sections"].append(section_snapshot)

    return snapshot


def build_section_snapshot(section: Section, selected_items: list = None) -> dict:
    """Build a snapshot of a section with selected items"""
    section_data = {
        "id": section.id,
        "title": section.title,
        "section_type": section.section_type.value,
        "icon": section.icon,
        "content_type": section.content_type.value,
        "content": section.content,
        "order": section.order,
        "entries": []
    }

    # For summary sections
    if section.entries and selected_items:
        for entry in section.entries:
            items_snapshot = [
                {
                    "id": item.id,
                    "content": item.content,
                    "order": item.order
                }
                for item in entry.items if item.id in selected_items
            ]
            if items_snapshot:
                section_data["entries"].append({
                    "id": entry.id,
                    "title": entry.title,
                    "content_type": entry.content_type.value,
                    "items": items_snapshot
                })

    return section_data


def build_work_experience_snapshot(section: Section, selected_work: list) -> dict:
    """
    Build snapshot for work experience section
    Handles hierarchical structure: Company (parent) -> Roles (sub_entries)
    """
    section_data = {
        "id": section.id,
        "title": section.title,
        "section_type": section.section_type.value,
        "icon": section.icon,
        "content_type": section.content_type.value,
        "order": section.order,
        "entries": []
    }

    for work_item in selected_work:
        entry_id = work_item.get("entry_id")
        selected_item_ids = work_item.get("items", [])
        selected_sub_entries = work_item.get("sub_entries", [])

        entry = next((e for e in section.entries if e.id == entry_id), None)
        if entry:
            entry_data = {
                "id": entry.id,
                "title": entry.title,
                "subtitle": entry.subtitle,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
                "location": entry.location,
                "description": entry.description,
                "content_type": entry.content_type.value,
                "order": entry.order,
                "items": [
                    {
                        "id": item.id,
                        "content": item.content,
                        "order": item.order
                    }
                    for item in entry.items if item.id in selected_item_ids
                ],
                "sub_entries": []
            }

            # Handle sub-entries (roles within company) from nested structure
            for sub_work_item in selected_sub_entries:
                sub_entry_id = sub_work_item.get("entry_id")
                sub_selected_items = sub_work_item.get("items", [])

                sub_entry = next((s for s in entry.sub_entries if s.id == sub_entry_id), None)
                if sub_entry:
                    entry_data["sub_entries"].append({
                        "id": sub_entry.id,
                        "title": sub_entry.title,
                        "subtitle": sub_entry.subtitle,
                        "start_date": sub_entry.start_date,
                        "end_date": sub_entry.end_date,
                        "location": sub_entry.location,
                        "description": sub_entry.description,
                        "content_type": sub_entry.content_type.value,
                        "order": sub_entry.order,
                        "items": [
                            {
                                "id": item.id,
                                "content": item.content,
                                "order": item.order
                            }
                            for item in sub_entry.items if item.id in sub_selected_items
                        ]
                    })

            section_data["entries"].append(entry_data)

    return section_data


def build_skills_snapshot(section: Section, selected_skills: list) -> dict:
    """Build snapshot for skills section"""
    section_data = {
        "id": section.id,
        "title": section.title,
        "section_type": section.section_type.value,
        "icon": section.icon,
        "content_type": section.content_type.value,
        "order": section.order,
        "entries": []
    }

    for skill_item in selected_skills:
        entry_id = skill_item.get("entry_id")
        selected_item_ids = skill_item.get("items", [])

        entry = next((e for e in section.entries if e.id == entry_id), None)
        if entry:
            section_data["entries"].append({
                "id": entry.id,
                "title": entry.title,
                "content_type": entry.content_type.value,
                "order": entry.order,
                "items": [
                    {
                        "id": item.id,
                        "content": item.content,
                        "order": item.order
                    }
                    for item in entry.items if item.id in selected_item_ids
                ]
            })

    return section_data


def build_education_snapshot(section: Section, selected_education: list) -> dict:
    """Build snapshot for education section"""
    section_data = {
        "id": section.id,
        "title": section.title,
        "section_type": section.section_type.value,
        "icon": section.icon,
        "content_type": section.content_type.value,
        "order": section.order,
        "entries": []
    }

    for entry in section.entries:
        if entry.id in selected_education:
            section_data["entries"].append({
                "id": entry.id,
                "title": entry.title,
                "subtitle": entry.subtitle,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
                "location": entry.location,
                "description": entry.description,
                "content_type": entry.content_type.value,
                "order": entry.order,
                "items": [
                    {
                        "id": item.id,
                        "content": item.content,
                        "order": item.order
                    }
                    for item in entry.items
                ]
            })

    return section_data


def build_generic_entries_snapshot(section: Section, selected_entry_ids: list) -> dict:
    """Build snapshot for generic sections (projects, certifications, etc.)"""
    section_data = {
        "id": section.id,
        "title": section.title,
        "section_type": section.section_type.value,
        "icon": section.icon,
        "content_type": section.content_type.value,
        "order": section.order,
        "entries": []
    }

    for entry in section.entries:
        if entry.id in selected_entry_ids:
            section_data["entries"].append({
                "id": entry.id,
                "title": entry.title,
                "subtitle": entry.subtitle,
                "start_date": entry.start_date,
                "end_date": entry.end_date,
                "description": entry.description,
                "content_type": entry.content_type.value,
                "order": entry.order,
                "items": [
                    {
                        "id": item.id,
                        "content": item.content,
                        "order": item.order
                    }
                    for item in entry.items
                ]
            })

    return section_data


@app.post("/api/cv/tailored-versions", response_model=TailoredCVResponse)
async def create_tailored_cv_version(
    request: TailoredCVCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a tailored CV version for a specific job application
    IMPORTANT: This converts ID-based selections into actual content snapshots
    so the CV remains intact even if master profile is modified later
    """
    try:
        # Debug: Log received request data
        print(f"[DEBUG] Received request data:")
        print(f"  - job_title: {request.job_title}")
        print(f"  - company_name: {request.company_name}")
        print(f"  - job_description length: {len(request.job_description) if request.job_description else 0}")
        print(f"  - selected_content keys: {list(request.selected_content.keys()) if request.selected_content else None}")
        print(f"  - job_analysis provided: {request.job_analysis is not None}")
        if request.job_analysis:
            print(f"  - job_analysis length: {len(request.job_analysis) if isinstance(request.job_analysis, list) else 'not a list'}")

        # Get user's default profile with all nested data
        profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Convert ID-based selected_content to actual content snapshot
        content_snapshot = convert_ids_to_content_snapshot(db, profile, request.selected_content)

        # Create tailored CV version with content snapshot
        tailored_cv = TailoredCVVersion(
            user_id=current_user.id,
            profile_id=profile.id,
            job_title=request.job_title,
            company_name=request.company_name,
            job_description=request.job_description,
            selected_content=content_snapshot,  # Store actual content, not IDs
            openai_fit_score=request.openai_fit_score,
            claude_fit_score=request.claude_fit_score,
            openai_ats_score=request.openai_ats_score,
            claude_ats_score=request.claude_ats_score,
            openai_recommendations=request.openai_recommendations,
            claude_recommendations=request.claude_recommendations,
            job_analysis=request.job_analysis,
            notes=request.notes
        )

        db.add(tailored_cv)
        db.commit()
        db.refresh(tailored_cv)

        print(f"[DEBUG] Created tailored CV version {tailored_cv.id} with content snapshot")
        return tailored_cv

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to create tailored CV: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cv/tailored-versions", response_model=List[TailoredCVResponse])
async def list_tailored_cv_versions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all tailored CV versions for the current user
    """
    versions = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.user_id == current_user.id
    ).order_by(TailoredCVVersion.created_at.desc()).all()

    return versions


@app.get("/api/cv/tailored-versions/{version_id}", response_model=TailoredCVResponse)
async def get_tailored_cv_version(
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific tailored CV version
    """
    version = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.id == version_id,
        TailoredCVVersion.user_id == current_user.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Tailored CV version not found")

    return version


@app.put("/api/cv/tailored-versions/{version_id}", response_model=TailoredCVResponse)
async def update_tailored_cv_version(
    version_id: int,
    request: TailoredCVUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a tailored CV version
    """
    version = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.id == version_id,
        TailoredCVVersion.user_id == current_user.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Tailored CV version not found")

    # Update fields if provided
    if request.job_title is not None:
        version.job_title = request.job_title
    if request.company_name is not None:
        version.company_name = request.company_name
    if request.selected_content is not None:
        version.selected_content = request.selected_content
    if request.notes is not None:
        version.notes = request.notes
    if request.status is not None:
        version.status = request.status

    db.commit()
    db.refresh(version)

    return version


@app.get("/api/cv/tailored-versions/{version_id}/full")
async def get_tailored_cv_full_data(
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a tailored CV version with full profile data
    IMPORTANT: Now returns the stored content snapshot directly (not ID-based lookups)
    This ensures CV displays exactly as it was saved, independent of master profile changes
    """
    version = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.id == version_id,
        TailoredCVVersion.user_id == current_user.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Tailored CV version not found")

    # selected_content now contains the actual content snapshot, not IDs
    content_snapshot = version.selected_content or {}

    return {
        "cv_version": {
            "id": version.id,
            "job_title": version.job_title,
            "company_name": version.company_name,
            "job_description": version.job_description,
            "openai_fit_score": version.openai_fit_score,
            "claude_fit_score": version.claude_fit_score,
            "openai_ats_score": version.openai_ats_score,
            "claude_ats_score": version.claude_ats_score,
            "notes": version.notes,
            "status": version.status,
            "created_at": version.created_at.isoformat(),
            "updated_at": version.updated_at.isoformat()
        },
        "profile": content_snapshot  # Return the snapshot directly
    }


@app.delete("/api/cv/tailored-versions/{version_id}")
async def delete_tailored_cv_version(
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a tailored CV version
    """
    version = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.id == version_id,
        TailoredCVVersion.user_id == current_user.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Tailored CV version not found")

    db.delete(version)
    db.commit()

    return {"message": "Tailored CV version deleted successfully"}


@app.post("/api/cv/tailored-versions/{version_id}/download-pdf")
async def download_tailored_cv_pdf(
    version_id: int,
    request: PDFDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download a tailored CV as a PDF

    Args:
        version_id: ID of the tailored CV version
        request: PDF download request with hidden_items and template_name

    Returns:
        PDF file as a streaming response
    """
    # Get the tailored CV version
    version = db.query(TailoredCVVersion).filter(
        TailoredCVVersion.id == version_id,
        TailoredCVVersion.user_id == current_user.id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Tailored CV version not found")

    # Prepare CV data for PDF generation
    # Add user's full name to contact_info if not present
    selected_content = version.selected_content.copy() if version.selected_content else {}
    contact_info = selected_content.get('contact_info', {})

    # Ensure full_name is in contact_info
    if 'full_name' not in contact_info:
        contact_info['full_name'] = current_user.full_name
        selected_content['contact_info'] = contact_info

    cv_data = {
        "id": version.id,
        "job_title": version.job_title,
        "company_name": version.company_name,
        "selected_content": selected_content,
        "openai_fit_score": version.openai_fit_score,
        "claude_fit_score": version.claude_fit_score,
        "openai_ats_score": version.openai_ats_score,
        "claude_ats_score": version.claude_ats_score,
    }

    # Generate PDF
    try:
        pdf_buffer = generate_cv_pdf(cv_data, request.hidden_items, request.template_name)

        # Create filename
        job_title_safe = version.job_title.replace(" ", "_").replace("/", "-")
        company_safe = (version.company_name or "Company").replace(" ", "_").replace("/", "-")
        filename = f"CV_{job_title_safe}_{company_safe}.pdf"

        # Return PDF as streaming response
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating PDF: {str(e)}"
        )


@app.post("/api/cv/tailored-versions/{version_id}/preview-ai-input")
async def preview_ai_input_data(
    version_id: int,
    request: PDFDownloadRequest,  # Reuse same schema - it has hidden_items
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Preview the formatted data that will be sent to AI models WITHOUT calling the LLMs
    This is useful for debugging and verifying the data before spending API credits
    """
    try:
        # Get the tailored CV version
        version = db.query(TailoredCVVersion).filter(
            TailoredCVVersion.id == version_id,
            TailoredCVVersion.user_id == current_user.id
        ).first()

        if not version:
            raise HTTPException(status_code=404, detail="Tailored CV version not found")

        # Check if job_analysis exists
        if not version.job_analysis:
            return {
                "formatted_cv_content": "ERROR: No job analysis found for this CV. Job requirements are needed for ATS scoring.",
                "has_job_analysis": False,
                "cv_id": version_id
            }

        # Filter out hidden items from the selected_content (same logic as recalculate)
        filtered_content = version.selected_content.copy()
        hidden_items_set = set(request.hidden_items)

        # Filter items from sections
        if 'sections' in filtered_content:
            filtered_sections = []
            for section in filtered_content['sections']:
                filtered_section = section.copy()
                filtered_entries = []

                for entry in section.get('entries', []):
                    filtered_entry = entry.copy()

                    # Filter entry-level items
                    if 'items' in entry:
                        filtered_entry['items'] = [
                            item for item in entry['items']
                            if item['id'] not in hidden_items_set
                        ]

                    # Filter sub-entry items
                    if 'sub_entries' in entry:
                        filtered_sub_entries = []
                        for sub_entry in entry['sub_entries']:
                            filtered_sub_entry = sub_entry.copy()
                            if 'items' in sub_entry:
                                filtered_sub_entry['items'] = [
                                    item for item in sub_entry['items']
                                    if item['id'] not in hidden_items_set
                                ]
                            if filtered_sub_entry.get('items'):
                                filtered_sub_entries.append(filtered_sub_entry)
                        filtered_entry['sub_entries'] = filtered_sub_entries

                    # Only include entry if it has visible content
                    has_visible_items = (
                        filtered_entry.get('items') or
                        filtered_entry.get('sub_entries') or
                        entry.get('description') or
                        entry.get('title')
                    )
                    if has_visible_items:
                        filtered_entries.append(filtered_entry)

                filtered_section['entries'] = filtered_entries
                if filtered_entries:
                    filtered_sections.append(filtered_section)

            filtered_content['sections'] = filtered_sections

        # Create formatted profile from filtered content
        from format_profile_for_ai import format_cv_content_for_ai
        formatted_cv = format_cv_content_for_ai(filtered_content)

        # Add job analysis info to the output
        job_analysis_summary = f"\n\n{'='*80}\nJOB REQUIREMENTS ANALYSIS\n{'='*80}\n"
        if isinstance(version.job_analysis, list):
            for analysis_obj in version.job_analysis:
                provider = analysis_obj.get('provider', 'unknown')
                provider_name = 'OpenAI GPT-4o' if provider == 'openai' else 'Anthropic Claude' if provider == 'anthropic' else provider

                job_analysis_summary += f"\n{'─'*80}\n"
                job_analysis_summary += f"Provider: {provider_name}\n"
                job_analysis_summary += f"{'─'*80}\n"

                # Check if there's an actual error (not just error: None)
                if analysis_obj.get('error'):
                    job_analysis_summary += f"Error: {analysis_obj['error']}\n"
                    continue

                analysis = analysis_obj.get('analysis', {})

                # Skip if analysis is empty
                if not analysis:
                    job_analysis_summary += "No analysis data available\n"
                    continue

                # Job Category & Level
                job_category = analysis.get('job_category') or analysis.get('Job Category', '')
                job_level = analysis.get('job_level') or analysis.get('Job Level', '')
                if job_category or job_level:
                    job_analysis_summary += f"\nJob Category & Level: {job_category} - {job_level}\n"

                # Technical Skills
                tech_skills = analysis.get('technical_skills') or analysis.get('Technical Skills')
                if tech_skills:
                    job_analysis_summary += f"\nTechnical Skills:\n"
                    if isinstance(tech_skills, list):
                        for skill in tech_skills:
                            job_analysis_summary += f"  • {skill}\n"
                    else:
                        job_analysis_summary += f"  {tech_skills}\n"

                # Soft Skills
                soft_skills = analysis.get('soft_skills') or analysis.get('Soft Skills')
                if soft_skills:
                    job_analysis_summary += f"\nSoft Skills:\n"
                    if isinstance(soft_skills, list):
                        for skill in soft_skills:
                            job_analysis_summary += f"  • {skill}\n"
                    else:
                        job_analysis_summary += f"  {soft_skills}\n"

                # Required Experience
                req_exp = analysis.get('required_experience') or analysis.get('Required Experience')
                if req_exp:
                    job_analysis_summary += f"\nRequired Experience:\n"
                    if isinstance(req_exp, list):
                        for exp in req_exp:
                            job_analysis_summary += f"  • {exp}\n"
                    else:
                        job_analysis_summary += f"  {req_exp}\n"

                # Experience Requirements
                exp_req = analysis.get('experience_requirements') or analysis.get('Experience Requirements')
                if exp_req:
                    job_analysis_summary += f"\nExperience Requirements:\n"
                    if isinstance(exp_req, list):
                        for req in exp_req:
                            job_analysis_summary += f"  • {req}\n"
                    else:
                        job_analysis_summary += f"  {exp_req}\n"

                # Education Requirements
                edu_req = analysis.get('education_requirements') or analysis.get('Education Requirements')
                if edu_req:
                    job_analysis_summary += f"\nEducation Requirements:\n"
                    if isinstance(edu_req, list):
                        for req in edu_req:
                            job_analysis_summary += f"  • {req}\n"
                    else:
                        job_analysis_summary += f"  {edu_req}\n"

                # Key Responsibilities
                key_resp = analysis.get('key_responsibilities') or analysis.get('Key Responsibilities') or analysis.get('responsibilities') or analysis.get('Responsibilities')
                if key_resp:
                    job_analysis_summary += f"\nKey Responsibilities:\n"
                    if isinstance(key_resp, list):
                        for resp in key_resp:
                            job_analysis_summary += f"  • {resp}\n"
                    else:
                        job_analysis_summary += f"  {key_resp}\n"

                # Nice to Have / Preferred Qualifications
                nice_to_have = analysis.get('nice_to_have') or analysis.get('Nice to Have') or analysis.get('preferred_qualifications') or analysis.get('Preferred Qualifications')
                if nice_to_have:
                    job_analysis_summary += f"\nNice to Have / Preferred:\n"
                    if isinstance(nice_to_have, list):
                        for item in nice_to_have:
                            job_analysis_summary += f"  • {item}\n"
                    else:
                        job_analysis_summary += f"  {nice_to_have}\n"

                # Domain/Industry
                domain = analysis.get('domain_industry') or analysis.get('Domain/Industry')
                if domain:
                    job_analysis_summary += f"\nDomain/Industry: {domain}\n"

        else:
            job_analysis_summary += str(version.job_analysis)

        full_output = formatted_cv + job_analysis_summary

        return {
            "formatted_cv_content": full_output,
            "has_job_analysis": True,
            "job_analysis_count": len(version.job_analysis) if isinstance(version.job_analysis, list) else 0
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Preview AI input failed: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Error previewing AI input: {str(e)}"
        )


@app.post("/api/cv/tailored-versions/{version_id}/recalculate-ats")
async def recalculate_ats_scores(
    version_id: int,
    request: PDFDownloadRequest,  # Reuse same schema - it has hidden_items
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Re-calculate ATS scores based on currently visible items in the CV
    This allows users to see how hiding/showing items affects their ATS score
    """
    try:
        # Get the tailored CV version
        version = db.query(TailoredCVVersion).filter(
            TailoredCVVersion.id == version_id,
            TailoredCVVersion.user_id == current_user.id
        ).first()

        if not version:
            raise HTTPException(status_code=404, detail="Tailored CV version not found")

        # Check if job_analysis exists
        if not version.job_analysis:
            raise HTTPException(
                status_code=400,
                detail="No job analysis found for this CV. Job requirements are needed for ATS scoring."
            )

        # Filter out hidden items from the selected_content
        filtered_content = version.selected_content.copy()
        hidden_items_set = set(request.hidden_items)

        # Filter items from sections
        if 'sections' in filtered_content:
            filtered_sections = []
            for section in filtered_content['sections']:
                filtered_section = section.copy()
                filtered_entries = []

                for entry in section.get('entries', []):
                    filtered_entry = entry.copy()

                    # Filter entry-level items
                    if 'items' in entry:
                        filtered_entry['items'] = [
                            item for item in entry['items']
                            if item['id'] not in hidden_items_set
                        ]

                    # Filter sub-entry items
                    if 'sub_entries' in entry:
                        filtered_sub_entries = []
                        for sub_entry in entry['sub_entries']:
                            filtered_sub_entry = sub_entry.copy()
                            if 'items' in sub_entry:
                                filtered_sub_entry['items'] = [
                                    item for item in sub_entry['items']
                                    if item['id'] not in hidden_items_set
                                ]
                            # Only include sub-entry if it has visible items
                            if filtered_sub_entry.get('items'):
                                filtered_sub_entries.append(filtered_sub_entry)
                        filtered_entry['sub_entries'] = filtered_sub_entries

                    # Only include entry if it has visible content
                    has_visible_items = (
                        filtered_entry.get('items') or
                        filtered_entry.get('sub_entries') or
                        entry.get('description') or
                        entry.get('title')
                    )
                    if has_visible_items:
                        filtered_entries.append(filtered_entry)

                filtered_section['entries'] = filtered_entries
                if filtered_entries:  # Only include section if it has entries
                    filtered_sections.append(filtered_section)

            filtered_content['sections'] = filtered_sections

        # Create formatted profile from filtered content
        from format_profile_for_ai import format_cv_content_for_ai
        formatted_cv = format_cv_content_for_ai(filtered_content)

        # Re-analyze fit with both AI models using the filtered CV
        result = analyze_profile_fit_dual(version.job_analysis, formatted_cv)

        # Extract scores from fit_analyses array
        openai_ats = None
        claude_ats = None
        openai_fit = None
        claude_fit = None

        for analysis in result.get('fit_analyses', []):
            provider = analysis.get('provider')
            if provider == 'openai' and 'error' not in analysis:
                fit_data = analysis.get('fit_analysis', {})
                openai_fit = fit_data.get('fit_percentage')
                ats_compat = fit_data.get('ats_compatibility', {})
                openai_ats = ats_compat.get('overall_ats_score')
            elif provider == 'anthropic' and 'error' not in analysis:
                fit_data = analysis.get('fit_analysis', {})
                claude_fit = fit_data.get('fit_percentage')
                ats_compat = fit_data.get('ats_compatibility', {})
                claude_ats = ats_compat.get('overall_ats_score')

        # Format job analysis for debugging (same as preview endpoint)
        job_analysis_summary = f"\n\n{'='*80}\nJOB REQUIREMENTS ANALYSIS\n{'='*80}\n"
        if isinstance(version.job_analysis, list):
            for analysis_obj in version.job_analysis:
                provider = analysis_obj.get('provider', 'unknown')
                provider_name = 'OpenAI GPT-4o' if provider == 'openai' else 'Anthropic Claude' if provider == 'anthropic' else provider

                job_analysis_summary += f"\n{'─'*80}\n"
                job_analysis_summary += f"Provider: {provider_name}\n"
                job_analysis_summary += f"{'─'*80}\n"

                # Check if there's an actual error (not just error: None)
                if analysis_obj.get('error'):
                    job_analysis_summary += f"Error: {analysis_obj['error']}\n"
                    continue

                analysis = analysis_obj.get('analysis', {})

                # Skip if analysis is empty
                if not analysis:
                    job_analysis_summary += "No analysis data available\n"
                    continue

                # Job Category & Level
                job_category = analysis.get('job_category') or analysis.get('Job Category', '')
                job_level = analysis.get('job_level') or analysis.get('Job Level', '')
                if job_category or job_level:
                    job_analysis_summary += f"\nJob Category & Level: {job_category} - {job_level}\n"

                # Technical Skills
                tech_skills = analysis.get('technical_skills') or analysis.get('Technical Skills')
                if tech_skills:
                    job_analysis_summary += f"\nTechnical Skills:\n"
                    if isinstance(tech_skills, list):
                        for skill in tech_skills:
                            job_analysis_summary += f"  • {skill}\n"
                    else:
                        job_analysis_summary += f"  {tech_skills}\n"

                # Soft Skills
                soft_skills = analysis.get('soft_skills') or analysis.get('Soft Skills')
                if soft_skills:
                    job_analysis_summary += f"\nSoft Skills:\n"
                    if isinstance(soft_skills, list):
                        for skill in soft_skills:
                            job_analysis_summary += f"  • {skill}\n"
                    else:
                        job_analysis_summary += f"  {soft_skills}\n"

                # Required Experience
                req_exp = analysis.get('required_experience') or analysis.get('Required Experience')
                if req_exp:
                    job_analysis_summary += f"\nRequired Experience:\n"
                    if isinstance(req_exp, list):
                        for exp in req_exp:
                            job_analysis_summary += f"  • {exp}\n"
                    else:
                        job_analysis_summary += f"  {req_exp}\n"

                # Experience Requirements
                exp_req = analysis.get('experience_requirements') or analysis.get('Experience Requirements')
                if exp_req:
                    job_analysis_summary += f"\nExperience Requirements:\n"
                    if isinstance(exp_req, list):
                        for req in exp_req:
                            job_analysis_summary += f"  • {req}\n"
                    else:
                        job_analysis_summary += f"  {exp_req}\n"

                # Education Requirements
                edu_req = analysis.get('education_requirements') or analysis.get('Education Requirements')
                if edu_req:
                    job_analysis_summary += f"\nEducation Requirements:\n"
                    if isinstance(edu_req, list):
                        for req in edu_req:
                            job_analysis_summary += f"  • {req}\n"
                    else:
                        job_analysis_summary += f"  {edu_req}\n"

                # Key Responsibilities
                key_resp = analysis.get('key_responsibilities') or analysis.get('Key Responsibilities') or analysis.get('responsibilities') or analysis.get('Responsibilities')
                if key_resp:
                    job_analysis_summary += f"\nKey Responsibilities:\n"
                    if isinstance(key_resp, list):
                        for resp in key_resp:
                            job_analysis_summary += f"  • {resp}\n"
                    else:
                        job_analysis_summary += f"  {key_resp}\n"

                # Nice to Have / Preferred Qualifications
                nice_to_have = analysis.get('nice_to_have') or analysis.get('Nice to Have') or analysis.get('preferred_qualifications') or analysis.get('Preferred Qualifications')
                if nice_to_have:
                    job_analysis_summary += f"\nNice to Have / Preferred:\n"
                    if isinstance(nice_to_have, list):
                        for item in nice_to_have:
                            job_analysis_summary += f"  • {item}\n"
                    else:
                        job_analysis_summary += f"  {nice_to_have}\n"

                # Domain/Industry
                domain = analysis.get('domain_industry') or analysis.get('Domain/Industry')
                if domain:
                    job_analysis_summary += f"\nDomain/Industry: {domain}\n"

        full_output = formatted_cv + job_analysis_summary

        print(f"[DEBUG] Recalculated scores - OpenAI ATS: {openai_ats}, Claude ATS: {claude_ats}")

        return {
            "openai_ats_score": openai_ats,
            "claude_ats_score": claude_ats,
            "openai_fit_score": openai_fit,
            "claude_fit_score": claude_fit,
            "formatted_cv_content": full_output  # Include CV + job analysis for debugging
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] ATS recalculation failed: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Error recalculating ATS scores: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
