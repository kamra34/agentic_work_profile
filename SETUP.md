# Setup Guide - v3.0.0 Hierarchical Structure

## Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL database

## Backend Setup

1. Create and activate virtual environment:
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
   - Copy `.env.example` to `.env`
   - Update database connection: `DATABASE_URL=postgresql://user:pass@host:port/your_database_name`
   - Add API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

4. Initialize database:
```bash
python init_db.py
```

5. Run backend:
```bash
uvicorn main:app --reload
```

Backend will be available at: `http://localhost:8000`

## Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run development server:
```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## Testing

Test the backend API:
```bash
cd backend
python temp/test_api.py
```

## What's New in v3.0

- **Universal ProfileNode model**: Single model handles all profile content
- **Infinite nesting**: Create hierarchies as deep as you need
- **Flexible metadata**: Only store dates/locations when needed
- **Global ID tracking**: Perfect CV tailoring with UUID tracking
- **Generic APIs**: One set of endpoints for all content types

## Current Status

- ✅ Backend: Fully implemented with hierarchical structure
- 🚧 Frontend: Master Profile and CV Tailoring coming soon
- ✅ Saved CVs and Application Tracker: Still functional
