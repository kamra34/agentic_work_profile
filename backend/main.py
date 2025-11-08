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
    ProfileResponse, ProfileUploadResponse,
    SectionResponse, SectionCreate, SectionUpdate,
    SectionEntryResponse, SectionEntryCreate, SectionEntryUpdate,
    SectionItemResponse, SectionItemCreate, SectionItemUpdate,
    LinkedInRequest, LinkedInProcessResponse
)
from file_utils import extract_text_from_file
from openai_service import parse_cv_with_openai
from linkedin_service import parse_linkedin_text_with_openai

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

@app.post("/api/profile/upload", response_model=ProfileUploadResponse)
async def upload_profile(
    file: UploadFile = File(...),
    openai_model: str = Form("gpt-4o"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload CV (PDF/DOCX) and extract profile information using OpenAI"""

    # Check file type
    if not file.filename.lower().endswith(('.pdf', '.docx', '.doc')):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    # Delete existing profile if any
    existing_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if existing_profile:
        # Delete old file
        if os.path.exists(existing_profile.file_path):
            os.remove(existing_profile.file_path)
        db.delete(existing_profile)
        db.commit()

    # Save file
    file_path = UPLOAD_DIR / f"user_{current_user.id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Extract text from file
        cv_text, file_type = extract_text_from_file(str(file_path))

        # Parse with OpenAI
        parsed_data = parse_cv_with_openai(cv_text, model=openai_model)

        # Create profile
        db_profile = Profile(
            user_id=current_user.id,
            original_filename=file.filename,
            file_path=str(file_path),
            file_type=file_type,
            openai_model=openai_model
        )
        db.add(db_profile)
        db.flush()  # Get the profile ID

        # Create sections
        for idx, section_data in enumerate(parsed_data.get("sections", [])):
            db_section = Section(
                profile_id=db_profile.id,
                title=section_data.get("title"),
                section_type=section_data.get("section_type"),
                content=section_data.get("content"),
                order=idx,
                source=f"source: CV-{file.filename}"
            )
            db.add(db_section)
            db.flush()

            # Create entries if any
            for entry_idx, entry_data in enumerate(section_data.get("entries", [])):
                db_entry = SectionEntry(
                    section_id=db_section.id,
                    title=entry_data.get("title"),
                    subtitle=entry_data.get("subtitle"),
                    start_date=entry_data.get("start_date"),
                    end_date=entry_data.get("end_date"),
                    location=entry_data.get("location"),
                    description=entry_data.get("description"),
                    order=entry_idx,
                    source=f"source: CV-{file.filename}",
                    extra_data=entry_data.get("extra_data")
                )
                db.add(db_entry)
                db.flush()

                # Create items if any
                for item_idx, item_content in enumerate(entry_data.get("items", [])):
                    db_item = SectionItem(
                        entry_id=db_entry.id,
                        content=item_content,
                        order=item_idx,
                        source=f"source: CV-{file.filename}"
                    )
                    db.add(db_item)

        db.commit()
        db.refresh(db_profile)

        return {
            "profile": db_profile,
            "message": "CV uploaded and parsed successfully"
        }

    except Exception as e:
        db.rollback()
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing CV: {str(e)}")

@app.get("/api/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's profile with all sections"""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.delete("/api/profile")
def delete_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete user's profile"""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Delete file
    if os.path.exists(profile.file_path):
        os.remove(profile.file_path)

    db.delete(profile)
    db.commit()
    return {"message": "Profile deleted successfully"}

@app.get("/api/profile/file")
def get_profile_file(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download the original CV file"""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if not os.path.exists(profile.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(profile.file_path, filename=profile.original_filename)

@app.post("/api/profile/linkedin", response_model=LinkedInProcessResponse)
async def process_linkedin(
    linkedin_data: LinkedInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process LinkedIn profile text and merge with existing profile"""

    # Get existing profile
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Please upload your CV first before adding LinkedIn data")

    # Parse LinkedIn data with OpenAI
    try:
        # Extract the actual LinkedIn profile text from the URL field
        # In the frontend, users will paste their LinkedIn profile content
        linkedin_text = linkedin_data.linkedin_url

        parsed_data = parse_linkedin_text_with_openai(linkedin_text, profile.openai_model)

        sections_added = 0
        items_added = 0

        # Process each section from LinkedIn
        for section_data in parsed_data.get("sections", []):
            section_title = section_data.get("title", "")
            section_type = section_data.get("section_type", "other")

            # Find if a similar section already exists
            existing_section = None
            for sec in profile.sections:
                # Match by title (case-insensitive) or section_type
                if (sec.title.lower() == section_title.lower() or
                    sec.section_type.lower() == section_type.lower()):
                    existing_section = sec
                    break

            if not existing_section:
                # Create new section
                db_section = Section(
                    profile_id=profile.id,
                    title=section_title,
                    section_type=section_type,
                    content=section_data.get("content"),
                    order=len(profile.sections),
                    source="source: LinkedIn"
                )
                db.add(db_section)
                db.flush()
                sections_added += 1
            else:
                db_section = existing_section

            # Process entries
            for entry_data in section_data.get("entries", []):
                entry_title = entry_data.get("title", "")

                # Check if entry already exists
                existing_entry = None
                for entry in db_section.entries:
                    if entry.title.lower() == entry_title.lower():
                        existing_entry = entry
                        break

                if not existing_entry:
                    # Create new entry
                    db_entry = SectionEntry(
                        section_id=db_section.id,
                        title=entry_title,
                        subtitle=entry_data.get("subtitle"),
                        start_date=entry_data.get("start_date"),
                        end_date=entry_data.get("end_date"),
                        location=entry_data.get("location"),
                        description=entry_data.get("description"),
                        order=len(db_section.entries),
                        source="source: LinkedIn"
                    )
                    db.add(db_entry)
                    db.flush()
                else:
                    db_entry = existing_entry

                # Process items
                for item_content in entry_data.get("items", []):
                    # Check if this item already exists
                    item_exists = any(
                        item.content.lower() == item_content.lower()
                        for item in db_entry.items
                    )

                    if not item_exists:
                        db_item = SectionItem(
                            entry_id=db_entry.id,
                            content=item_content,
                            order=len(db_entry.items),
                            source="source: LinkedIn"
                        )
                        db.add(db_item)
                        items_added += 1

        # Update profile with LinkedIn URL
        profile.linkedin_url = linkedin_data.linkedin_url[:500]  # Store first 500 chars as reference

        db.commit()

        return LinkedInProcessResponse(
            message=f"Successfully processed LinkedIn data",
            sections_added=sections_added,
            items_added=items_added
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing LinkedIn data: {str(e)}")

# ==================== SECTION ENDPOINTS ====================

@app.post("/api/profile/sections", response_model=SectionResponse)
def create_section(
    section_data: SectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new section"""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    db_section = Section(
        profile_id=profile.id,
        title=section_data.title,
        section_type=section_data.section_type,
        content=section_data.content,
        order=section_data.order,
        source=section_data.source or "source: Manual Entry"
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

    db_entry = SectionEntry(
        section_id=section.id,
        title=entry_data.title,
        subtitle=entry_data.subtitle,
        start_date=entry_data.start_date,
        end_date=entry_data.end_date,
        location=entry_data.location,
        description=entry_data.description,
        order=entry_data.order,
        source=entry_data.source or "source: Manual Entry",
        extra_data=entry_data.extra_data
    )
    db.add(db_entry)
    db.flush()

    # Add items if any
    for idx, item in enumerate(entry_data.items or []):
        db_item = SectionItem(
            entry_id=db_entry.id,
            content=item.content,
            order=item.order if item.order is not None else idx,
            source=item.source or "source: Manual Entry"
        )
        db.add(db_item)

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
        source=item_data.source or "source: Manual Entry"
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
