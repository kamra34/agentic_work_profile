from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Import our modules
from models import Base, User, Profile, Section, SectionEntry, SectionItem
from schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    ProfileResponse, ProfileCreate, ProfileUpdate,
    SectionResponse, SectionCreate, SectionUpdate,
    SectionEntryResponse, SectionEntryCreate, SectionEntryUpdate,
    SectionItemResponse, SectionItemCreate, SectionItemUpdate,
    AIEditRequest, AIEditResponse, AIChatRequest, AIChatResponse
)
from file_utils import extract_text_from_file
from openai_service import parse_cv_with_openai
from linkedin_service import parse_linkedin_text_with_openai
from ai_editor_service import edit_with_openai, edit_with_claude, chat_with_ai

load_dotenv()

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
