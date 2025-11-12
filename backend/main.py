"""
FastAPI backend with universal hierarchical node structure.
Generic endpoints handle all profile content through ProfileNode model.
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Load .env from project root (parent directory)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from models import User, Profile, ProfileNode, TailoredCV
from schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    ProfileResponse, ProfileCreate, ProfileUpdate,
    ProfileNodeResponse, ProfileNodeCreate, ProfileNodeUpdate
)
import ai_tailor_service

# Database
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

app = FastAPI(title="Work Profile API - Hierarchical v3.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Dependencies
# ============================================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ============================================================================
# Auth Endpoints
# ============================================================================

@app.post("/api/register", response_model=UserResponse)
@app.post("/auth/register", response_model=UserResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register new user"""
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=pwd_context.hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default profile
    profile = Profile(user_id=user.id, title="My Profile", is_default=True)
    db.add(profile)
    db.commit()

    return user


@app.post("/api/login", response_model=Token)
@app.post("/auth/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/me", response_model=UserResponse)
@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user"""
    return current_user


# ============================================================================
# Profile Endpoints
# ============================================================================

@app.get("/profiles", response_model=List[ProfileResponse])
def get_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all profiles for current user"""
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).all()
    # Only return root nodes, sorted by order
    for profile in profiles:
        profile.nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order)
    return profiles


@app.get("/profiles/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific profile with all nodes"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Only return root nodes (children loaded via relationship)
    # Sort by order to ensure correct display
    profile.nodes = sorted([n for n in profile.nodes if n.parent_id is None], key=lambda x: x.order)
    return profile


@app.post("/profiles", response_model=ProfileResponse)
def create_profile(
    profile_data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new profile"""
    profile = Profile(
        user_id=current_user.id,
        **profile_data.model_dump()
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@app.put("/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: int,
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    for field, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    profile.nodes = [n for n in profile.nodes if n.parent_id is None]
    return profile


# ============================================================================
# ProfileNode Endpoints (Universal - handles ALL content)
# ============================================================================

@app.get("/profiles/{profile_id}/nodes", response_model=List[ProfileNodeResponse])
def get_nodes(
    profile_id: int,
    parent_id: Optional[int] = None,
    node_type: Optional[str] = None,
    flat: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get nodes for a profile.
    - parent_id: filter by parent (None = root nodes)
    - node_type: filter by type (section, entry, item, etc.)
    - flat: if True, return flat list; if False, return tree
    """
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    query = db.query(ProfileNode).filter(ProfileNode.profile_id == profile_id)

    if not flat:
        query = query.filter(ProfileNode.parent_id == parent_id)
    if node_type:
        query = query.filter(ProfileNode.node_type == node_type)

    nodes = query.order_by(ProfileNode.order).all()
    return nodes


@app.get("/nodes/{node_id}", response_model=ProfileNodeResponse)
def get_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific node by ID"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    return node


@app.post("/profiles/{profile_id}/nodes", response_model=ProfileNodeResponse)
def create_node(
    profile_id: int,
    node_data: ProfileNodeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new node (section, entry, item, etc.)"""
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Compute level and root_id based on parent
    level = 0
    root_id = None
    if node_data.parent_id is not None:
        parent = db.query(ProfileNode).filter(ProfileNode.id == node_data.parent_id).first()
        if parent:
            level = parent.level + 1
            root_id = parent.root_id if parent.root_id is not None else parent.id

    # Calculate next order value for siblings
    # Get max order among siblings (nodes with same parent_id)
    max_order = db.query(func.max(ProfileNode.order)).filter(
        ProfileNode.profile_id == profile_id,
        ProfileNode.parent_id == node_data.parent_id
    ).scalar()
    # If no siblings exist (max_order is None), start at 0, otherwise increment
    next_order = 0 if max_order is None else max_order + 1

    # Create node
    node = ProfileNode(
        global_id=str(uuid.uuid4()),
        profile_id=profile_id,
        level=level,
        root_id=root_id,
        order=next_order,
        **node_data.model_dump(exclude={"parent_id", "children", "level", "root_id", "order"})
    )
    if node_data.parent_id is not None:
        node.parent_id = node_data.parent_id

    db.add(node)
    db.commit()
    db.refresh(node)

    # If this is a root node, set root_id to itself
    if node.parent_id is None:
        node.root_id = node.id
        db.commit()
        db.refresh(node)

    # Recursively create children if provided
    if node_data.children:
        _create_children_recursive(db, node.id, profile_id, node_data.children)
        db.refresh(node)

    return node


@app.put("/nodes/{node_id}", response_model=ProfileNodeResponse)
def update_node(
    node_id: int,
    node_data: ProfileNodeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update any node"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    for field, value in node_data.model_dump(exclude_unset=True).items():
        setattr(node, field, value)

    db.commit()
    db.refresh(node)
    return node


@app.delete("/nodes/{node_id}")
def delete_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete node and all its children (cascade)"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(node)
    db.commit()
    return {"message": "Node deleted successfully"}


@app.post("/nodes/{node_id}/move")
def move_node(
    node_id: int,
    move_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Move node to different parent or reorder"""
    node = db.query(ProfileNode).filter(ProfileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Verify ownership
    profile = db.query(Profile).filter(
        Profile.id == node.profile_id,
        Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")

    new_parent_id = move_data.get('new_parent_id')
    new_order = move_data.get('new_order')

    print(f"🔄 Moving node {node_id}")
    print(f"   Current: parent_id={node.parent_id}, order={node.order}")
    print(f"   New: parent_id={new_parent_id}, order={new_order}")

    if new_parent_id is not None:
        node.parent_id = new_parent_id
    if new_order is not None:
        node.order = new_order

    db.commit()

    # Normalize orders for all siblings (sequential 0, 1, 2...)
    siblings = db.query(ProfileNode).filter(
        ProfileNode.profile_id == node.profile_id,
        ProfileNode.parent_id == node.parent_id
    ).order_by(ProfileNode.order).all()

    print(f"   Found {len(siblings)} siblings to normalize")
    for idx, sibling in enumerate(siblings):
        print(f"   - Node {sibling.id} ({sibling.title}): {sibling.order} -> {idx}")
        sibling.order = idx

    db.commit()
    db.refresh(node)
    print(f"✅ Node {node_id} moved successfully, new order: {node.order}")
    return node


# ============================================================================
# Helper Functions
# ============================================================================

def _create_children_recursive(db: Session, parent_id: int, profile_id: int, children: List[ProfileNodeCreate]):
    """Recursively create child nodes with proper level and root_id tracking"""
    # Get parent to compute level and root_id
    parent = db.query(ProfileNode).filter(ProfileNode.id == parent_id).first()
    if not parent:
        return

    for child_data in children:
        level = parent.level + 1
        root_id = parent.root_id if parent.root_id is not None else parent.id

        child = ProfileNode(
            global_id=str(uuid.uuid4()),
            profile_id=profile_id,
            parent_id=parent_id,
            level=level,
            root_id=root_id,
            **child_data.model_dump(exclude={"parent_id", "children", "level", "root_id"})
        )
        db.add(child)
        db.commit()
        db.refresh(child)

        if child_data.children:
            _create_children_recursive(db, child.id, profile_id, child_data.children)


# ============================================================================
# Tailored CV Routes
# ============================================================================

@app.post("/api/tailor/analyze-job")
async def analyze_job_description(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze job description with both OpenAI and Claude.
    Returns extracted requirements from both models.
    """
    job_description = request.get("job_description", "")

    if not job_description or len(job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description too short (minimum 50 characters)")

    # Call both AI models in parallel
    openai_result = ai_tailor_service.analyze_job_with_openai(job_description)
    claude_result = ai_tailor_service.analyze_job_with_claude(job_description)

    return {
        "openai": openai_result,
        "claude": claude_result,
        "job_description": job_description
    }


@app.post("/api/tailor/score-profile")
async def score_profile_fit(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Score how well the profile matches job requirements.
    Returns fit scores and ATS scores from both models.
    """
    job_requirements = request.get("job_requirements")
    profile_id = request.get("profile_id")

    if not job_requirements or not profile_id:
        raise HTTPException(status_code=400, detail="Missing job_requirements or profile_id")

    # Get profile with nodes
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Convert nodes to text for scoring
    def node_to_dict(node):
        return {
            "id": node.id,
            "global_id": node.global_id,
            "node_type": node.node_type,
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,
            "level": node.level,
            "is_visible": node.is_visible,
            "children": [node_to_dict(child) for child in node.children] if node.children else []
        }

    nodes_list = [node_to_dict(node) for node in profile.nodes if node.parent_id is None]
    profile_text = ai_tailor_service.profile_nodes_to_text(nodes_list)

    # Score with both models
    openai_scores = ai_tailor_service.score_profile_with_openai(job_requirements, profile_text)
    claude_scores = ai_tailor_service.score_profile_with_claude(job_requirements, profile_text)

    return {
        "openai": openai_scores,
        "claude": claude_scores,
        "profile_id": profile_id
    }


@app.post("/api/tailor/recommend-nodes")
async def recommend_node_selection(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get AI recommendations for which nodes to include/exclude.
    Returns recommendations from both models.
    """
    import time
    start_time = time.time()
    print(f"\n🚀 [RECOMMEND-NODES] Request received from user {current_user.id}")

    job_requirements = request.get("job_requirements")
    profile_id = request.get("profile_id")

    if not job_requirements or not profile_id:
        print(f"❌ [RECOMMEND-NODES] Missing requirements or profile_id")
        raise HTTPException(status_code=400, detail="Missing job_requirements or profile_id")

    print(f"📋 [RECOMMEND-NODES] Profile ID: {profile_id}")

    # Get profile with nodes
    db_start = time.time()
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()
    print(f"⏱️ [RECOMMEND-NODES] Database query took {time.time() - db_start:.2f}s")

    if not profile:
        print(f"❌ [RECOMMEND-NODES] Profile {profile_id} not found")
        raise HTTPException(status_code=404, detail="Profile not found")

    # Convert nodes to flat list for AI analysis
    print(f"🔄 [RECOMMEND-NODES] Converting {len(profile.nodes)} nodes to dict...")
    convert_start = time.time()

    def clean_dict(d):
        """Remove null, empty string, and empty array values to reduce token usage"""
        if not isinstance(d, dict):
            return d

        cleaned = {}
        for key, value in d.items():
            # Skip null, empty strings, and empty lists
            if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
                continue

            # Recursively clean nested dicts
            if isinstance(value, dict):
                cleaned_value = clean_dict(value)
                if cleaned_value:  # Only include if not empty after cleaning
                    cleaned[key] = cleaned_value
            # Clean lists of dicts
            elif isinstance(value, list):
                if all(isinstance(item, dict) for item in value):
                    cleaned_list = [clean_dict(item) for item in value]
                    cleaned_list = [item for item in cleaned_list if item]  # Remove empty dicts
                    if cleaned_list:
                        cleaned[key] = cleaned_list
                else:
                    cleaned[key] = value
            else:
                cleaned[key] = value

        return cleaned

    def node_to_dict(node):
        data = {
            "id": node.id,
            "global_id": node.global_id,
            "node_type": node.node_type,
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,
            "level": node.level,
            "is_visible": node.is_visible,
        }
        cleaned = clean_dict(data)
        if node.children:
            children = [node_to_dict(child) for child in node.children]
            if children:
                cleaned["children"] = children
        return cleaned

    nodes_list = [node_to_dict(node) for node in profile.nodes if node.parent_id is None]

    # Clean job_requirements too
    job_requirements = clean_dict(job_requirements)

    # Calculate original size (before flattening with cleaned structure)
    import json
    original_size = len(json.dumps({"job_requirements": job_requirements, "profile_nodes": nodes_list}))

    flat_nodes = ai_tailor_service.flatten_nodes_for_analysis(nodes_list)
    print(f"✅ [RECOMMEND-NODES] Converted to {len(flat_nodes)} flat nodes in {time.time() - convert_start:.2f}s")

    # Show size reduction
    cleaned_size = len(json.dumps({"job_requirements": job_requirements, "profile_nodes": flat_nodes}))
    reduction = original_size - cleaned_size
    reduction_pct = (reduction / original_size * 100) if original_size > 0 else 0
    print(f"📊 [RECOMMEND-NODES] Data size: {original_size:,} → {cleaned_size:,} characters ({cleaned_size/1000:.1f}K)")
    print(f"📉 [RECOMMEND-NODES] Reduction: {reduction:,} characters ({reduction_pct:.1f}%)")

    # Get recommendations from both models IN PARALLEL
    print(f"🤖 [RECOMMEND-NODES] Calling OpenAI and Claude IN PARALLEL...")
    parallel_start = time.time()

    # Run both AI calls in parallel using ThreadPoolExecutor
    # This allows both models to process simultaneously
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks
        openai_future = executor.submit(
            ai_tailor_service.recommend_nodes_with_openai,
            job_requirements,
            flat_nodes
        )
        claude_future = executor.submit(
            ai_tailor_service.recommend_nodes_with_claude,
            job_requirements,
            flat_nodes
        )

        # Wait for OpenAI result
        openai_start = time.time()
        try:
            openai_recommendations = openai_future.result()
            openai_duration = time.time() - openai_start
            print(f"✅ [RECOMMEND-NODES] OpenAI completed in {openai_duration:.2f}s, success: {openai_recommendations.get('success')}")
        except Exception as e:
            openai_duration = time.time() - openai_start
            print(f"❌ [RECOMMEND-NODES] OpenAI failed after {openai_duration:.2f}s: {str(e)}")
            openai_recommendations = {"success": False, "error": str(e)}

        # Wait for Claude result
        claude_start = time.time()
        try:
            claude_recommendations = claude_future.result()
            claude_duration = time.time() - claude_start
            print(f"✅ [RECOMMEND-NODES] Claude completed in {claude_duration:.2f}s, success: {claude_recommendations.get('success')}")
        except Exception as e:
            claude_duration = time.time() - claude_start
            print(f"❌ [RECOMMEND-NODES] Claude failed after {claude_duration:.2f}s: {str(e)}")
            claude_recommendations = {"success": False, "error": str(e)}

    parallel_duration = time.time() - parallel_start
    print(f"⚡ [RECOMMEND-NODES] Both models completed in parallel in {parallel_duration:.2f}s (vs {openai_duration + claude_duration:.2f}s sequential)")
    print(f"💰 [RECOMMEND-NODES] Time saved: {(openai_duration + claude_duration - parallel_duration):.2f}s")

    total_time = time.time() - start_time
    print(f"🏁 [RECOMMEND-NODES] Total request time: {total_time:.2f}s")

    # Prepare response
    response_data = {
        "openai": openai_recommendations,
        "claude": claude_recommendations,
        "total_nodes": len(flat_nodes)
    }

    return response_data


@app.post("/api/tailor/save")
async def save_tailored_cv(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a tailored CV with complete snapshot of selected nodes.

    This creates a frozen-in-time version of the CV that can always be reconstructed
    exactly as it was, even if the master profile is later modified.
    """
    profile_id = request.get("profile_id")
    job_title = request.get("job_title")
    company_name = request.get("company_name")
    job_description = request.get("job_description")
    selected_node_ids = request.get("selected_node_ids", [])  # List of global_ids
    fit_scores = request.get("fit_scores")
    ats_scores = request.get("ats_scores")
    recommendations = request.get("recommendations")
    job_analysis = request.get("job_analysis")
    selected_model = request.get("selected_model", "openai")  # Which AI model was used
    status = request.get("status", "draft")

    if not profile_id or not job_title:
        raise HTTPException(status_code=400, detail="Missing required fields: profile_id, job_title")

    # Verify profile ownership
    profile = db.query(Profile).filter(
        Profile.id == profile_id,
        Profile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    print(f"📋 [SAVE-CV] Saving tailored CV: {job_title} at {company_name}")
    print(f"📋 [SAVE-CV] Selected {len(selected_node_ids)} nodes from profile {profile.title}")

    # Build complete node lookup map: global_id -> node object
    def build_node_map(node, node_map):
        node_map[node.global_id] = node
        for child in node.children:
            build_node_map(child, node_map)

    node_lookup = {}
    for node in profile.nodes:
        build_node_map(node, node_lookup)

    # Convert node to complete dict with ALL fields from profile_nodes table
    def node_to_complete_dict(node, include_children=True):
        """
        Convert SQLAlchemy node to complete dictionary with ALL fields.
        This ensures we can perfectly reconstruct the CV even if master profile changes.
        """
        node_dict = {
            # Identity
            "id": node.id,
            "global_id": node.global_id,
            "profile_id": node.profile_id,
            "parent_id": node.parent_id,

            # Hierarchy
            "level": node.level,
            "root_id": node.root_id,

            # Type
            "node_type": node.node_type,

            # Content
            "title": node.title,
            "subtitle": node.subtitle,
            "content": node.content,
            "content_type": node.content_type,

            # Optional metadata
            "start_date": node.start_date,
            "end_date": node.end_date,
            "location": node.location,

            # Display and organization
            "order": node.order,
            "is_visible": node.is_visible,
            "icon": node.icon,

            # Flexible extensions
            "attributes": node.attributes,
            "meta_info": node.meta_info,

            # Tracking
            "created_at": node.created_at.isoformat() if node.created_at else None,
            "updated_at": node.updated_at.isoformat() if node.updated_at else None,
        }

        if include_children and node.children:
            node_dict["children"] = [node_to_complete_dict(child) for child in node.children]
        else:
            node_dict["children"] = []

        return node_dict

    # Build hierarchical structure of ONLY selected nodes
    selected_nodes_set = set(selected_node_ids)

    def filter_and_build_hierarchy(node):
        """
        Recursively filter nodes to include only selected ones and their necessary parents.
        Returns the node dict if it or any descendant is selected, None otherwise.
        """
        # Check if any children should be included
        filtered_children = []
        if node.children:
            for child in node.children:
                filtered_child = filter_and_build_hierarchy(child)
                if filtered_child:
                    filtered_children.append(filtered_child)

        # Include this node if it's selected OR has selected descendants
        if node.global_id in selected_nodes_set or filtered_children:
            node_dict = node_to_complete_dict(node, include_children=False)
            node_dict["children"] = filtered_children
            node_dict["is_selected"] = node.global_id in selected_nodes_set
            return node_dict

        return None

    # Build filtered hierarchy starting from root nodes
    filtered_root_nodes = []
    for node in profile.nodes:
        if node.parent_id is None:  # Root node
            filtered_node = filter_and_build_hierarchy(node)
            if filtered_node:
                filtered_root_nodes.append(filtered_node)

    # Save COMPLETE AI recommendations from BOTH models
    # This includes ALL nodes (not just selected) so we have full context
    complete_recommendations = {}
    if recommendations:
        for model_name in ['openai', 'claude']:
            if model_name in recommendations:
                model_data = recommendations[model_name]
                if model_data.get('success') and model_data.get('recommendations'):
                    complete_recommendations[model_name] = {
                        'success': model_data.get('success'),
                        'model': model_data.get('model'),
                        'recommendations': {
                            'selected_nodes': model_data['recommendations'].get('selected_nodes', []),
                            'selection_summary': model_data['recommendations'].get('selection_summary', {}),
                            'tailoring_strategy': model_data['recommendations'].get('tailoring_strategy', ''),
                            'profile_fit_score': model_data['recommendations'].get('profile_fit_score'),
                            'ats_score': model_data['recommendations'].get('ats_score')
                        }
                    }
                else:
                    # Save error info if model failed
                    complete_recommendations[model_name] = {
                        'success': False,
                        'error': model_data.get('error', 'Unknown error')
                    }

    # Read backend version
    backend_version = "unknown"
    try:
        from pathlib import Path
        version_file = Path(__file__).parent / "VERSION"
        if version_file.exists():
            backend_version = version_file.read_text().strip()
    except Exception:
        pass

    # Create complete content snapshot
    content_snapshot = {
        "nodes": filtered_root_nodes,  # Hierarchical structure with only selected nodes
        "contact_info": profile.contact_info,
        "profile_title": profile.title,
        "profile_id": profile.id,
        "backend_version": backend_version,
        "created_at": datetime.now().isoformat(),
        "selected_count": len(selected_node_ids),
        "total_nodes_in_profile": len(node_lookup)
    }

    # Build selected_node_ids list with both id and global_id for reference
    selected_nodes_with_ids = []
    for global_id in selected_node_ids:
        node = node_lookup.get(global_id)
        if node:
            selected_nodes_with_ids.append({
                "id": node.id,
                "global_id": node.global_id
            })

    print(f"📋 [SAVE-CV] Built snapshot with {len(filtered_root_nodes)} root sections")
    print(f"📋 [SAVE-CV] Selected model: {selected_model}")
    print(f"📋 [SAVE-CV] Saving recommendations from both models: {list(complete_recommendations.keys())}")

    # Create tailored CV record with complete snapshot
    tailored_cv = TailoredCV(
        user_id=current_user.id,
        profile_id=profile_id,
        job_title=job_title,
        company_name=company_name,
        job_description=job_description,
        fit_scores=fit_scores,
        ats_scores=ats_scores,
        selected_node_ids=selected_nodes_with_ids,
        content_snapshot=content_snapshot,
        recommendations=complete_recommendations,  # Complete recommendations from BOTH models
        job_analysis=job_analysis,  # Job requirements from BOTH models
        status=status
    )

    # Add selected_model to the record (we'll need to add this field to the model)
    # For now, store it in content_snapshot
    content_snapshot["selected_ai_model"] = selected_model

    db.add(tailored_cv)
    db.commit()
    db.refresh(tailored_cv)

    print(f"✅ [SAVE-CV] Tailored CV saved with ID: {tailored_cv.id}")

    return {
        "success": True,
        "tailored_cv_id": tailored_cv.id,
        "message": "Tailored CV saved successfully",
        "summary": {
            "selected_nodes": len(selected_node_ids),
            "root_sections": len(filtered_root_nodes),
            "ai_model": selected_model
        }
    }


@app.get("/api/tailor/list")
async def list_tailored_cvs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tailored CVs for the current user"""
    tailored_cvs = db.query(TailoredCV).filter(
        TailoredCV.user_id == current_user.id
    ).order_by(TailoredCV.created_at.desc()).all()

    return [
        {
            "id": cv.id,
            "job_title": cv.job_title,
            "company_name": cv.company_name,
            "status": cv.status,
            "fit_scores": cv.fit_scores,
            "ats_scores": cv.ats_scores,
            "created_at": cv.created_at.isoformat(),
            "updated_at": cv.updated_at.isoformat()
        }
        for cv in tailored_cvs
    ]


@app.get("/api/tailor/{cv_id}")
async def get_tailored_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific tailored CV with full details"""
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    return {
        "id": tailored_cv.id,
        "profile_id": tailored_cv.profile_id,
        "job_title": tailored_cv.job_title,
        "company_name": tailored_cv.company_name,
        "job_description": tailored_cv.job_description,
        "fit_scores": tailored_cv.fit_scores,
        "ats_scores": tailored_cv.ats_scores,
        "selected_node_ids": tailored_cv.selected_node_ids,
        "content_snapshot": tailored_cv.content_snapshot,
        "recommendations": tailored_cv.recommendations,
        "job_analysis": tailored_cv.job_analysis,
        "status": tailored_cv.status,
        "created_at": tailored_cv.created_at.isoformat(),
        "updated_at": tailored_cv.updated_at.isoformat()
    }


@app.delete("/api/tailor/{cv_id}")
async def delete_tailored_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a tailored CV"""
    tailored_cv = db.query(TailoredCV).filter(
        TailoredCV.id == cv_id,
        TailoredCV.user_id == current_user.id
    ).first()

    if not tailored_cv:
        raise HTTPException(status_code=404, detail="Tailored CV not found")

    db.delete(tailored_cv)
    db.commit()

    return {"success": True, "message": "Tailored CV deleted"}


# ============================================================================
# Health Check & Version
# ============================================================================

@app.get("/")
def root():
    return {
        "message": "Work Profile API - Hierarchical Structure v3.0",
        "status": "running",
        "features": [
            "Universal ProfileNode model",
            "Infinite nesting capability",
            "Global ID tracking",
            "Flexible metadata"
        ]
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/version")
def get_version():
    """Get backend version"""
    try:
        version_file = os.path.join(os.path.dirname(__file__), "VERSION")
        with open(version_file, "r") as f:
            version = f.read().strip()
        return {"version": version}
    except Exception:
        return {"version": "3.0.0"}
