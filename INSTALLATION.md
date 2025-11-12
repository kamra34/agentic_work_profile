# Installation Guide

This guide will help you set up the AI-Powered Resume Tailoring Platform on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+**: [Download Python](https://www.python.org/downloads/)
- **Node.js 16+**: [Download Node.js](https://nodejs.org/)
- **PostgreSQL 12+**: [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git**: [Download Git](https://git-scm.com/downloads)

## API Keys Required

You'll need API keys from:

1. **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Anthropic**: Get your API key from [Anthropic Console](https://console.anthropic.com/)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd agentic_work_profile
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE work_profile;

# Create user (optional, but recommended)
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE work_profile TO your_username;

# Exit
\q
```

### 3. Backend Setup

Navigate to the backend directory and set up the Python environment:

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-jose[cryptography] passlib[bcrypt] python-multipart python-dotenv openai anthropic reportlab
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/work_profile

# Security
SECRET_KEY=your-secret-key-here-use-a-long-random-string

# AI API Keys
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**Important**:
- Replace `your_username` and `your_password` with your PostgreSQL credentials
- Generate a secure SECRET_KEY (use `openssl rand -hex 32` or similar)
- Add your actual API keys from OpenAI and Anthropic

### 5. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend

# Install dependencies
npm install
```

### 6. Database Initialization

The database tables will be created automatically when you first run the backend server. However, you can verify the connection:

```bash
# From backend directory with activated virtual environment
python -c "from main import engine; from models import Base; Base.metadata.create_all(bind=engine); print('Database initialized successfully')"
```

## Running the Application

You need to run both the backend and frontend servers.

### Terminal 1: Backend Server

```bash
cd backend
# Activate virtual environment if not already activated
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Run the server
python main.py
```

The backend API will be available at: `http://localhost:8000`

### Terminal 2: Frontend Server

```bash
cd frontend

# Run the development server
npm run dev
```

The frontend will be available at: `http://localhost:5173`

## Accessing the Application

1. Open your browser and navigate to `http://localhost:5173`
2. Create a new account using the Sign Up option
3. Login with your credentials
4. Start building your master profile!

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify PostgreSQL is running:
   ```bash
   # Windows:
   pg_ctl status
   # macOS/Linux:
   sudo systemctl status postgresql
   ```

2. Check your DATABASE_URL in `.env` file
3. Ensure the database exists and credentials are correct

### Port Already in Use

If port 8000 or 5173 is already in use:

**Backend (port 8000):**
```python
# Edit backend/main.py, last line:
uvicorn.run(app, host="0.0.0.0", port=8001)  # Change to 8001 or any available port
```

**Frontend (port 5173):**
```bash
# Run with different port
npm run dev -- --port 3000
```

### API Key Issues

If you see errors related to OpenAI or Anthropic:

1. Verify your API keys are correct in `.env`
2. Check your API usage limits and billing status
3. Ensure you have access to GPT-4o (OpenAI) and Claude Sonnet 4.5 (Anthropic)

### Python Virtual Environment Issues

If you have issues with the virtual environment:

```bash
# Remove and recreate
rm -rf venv  # On Windows: rmdir /s venv
python -m venv venv
# Activate and reinstall dependencies
```

### Node Modules Issues

If you encounter frontend dependency issues:

```bash
# Remove and reinstall
rm -rf node_modules package-lock.json  # On Windows: rmdir /s node_modules, del package-lock.json
npm install
```

## Production Deployment

For production deployment, additional steps are required:

1. **Backend**:
   - Use a production WSGI server (e.g., Gunicorn with Uvicorn workers)
   - Set up proper environment variables
   - Configure CORS for your production domain
   - Use a managed PostgreSQL database

2. **Frontend**:
   - Build the production bundle: `npm run build`
   - Serve the `dist` folder using a web server (Nginx, Apache, etc.)
   - Update API_URL in frontend code to point to production backend

3. **Security**:
   - Use HTTPS for all connections
   - Set strong SECRET_KEY
   - Configure proper CORS origins
   - Set up rate limiting
   - Regular security updates

## Development Tips

- **Backend Auto-reload**: FastAPI with Uvicorn automatically reloads on code changes
- **Frontend Hot Reload**: Vite provides instant hot module replacement
- **API Documentation**: Access interactive API docs at `http://localhost:8000/docs`
- **Database Browser**: Use tools like pgAdmin or DBeaver to inspect your database

## Updating the Application

To update to the latest version:

```bash
# Pull latest changes
git pull origin main

# Update backend dependencies
cd backend
pip install -r requirements.txt  # if requirements.txt is added

# Update frontend dependencies
cd ../frontend
npm install

# Restart both servers
```

## Support

For issues during installation:

1. Check the error messages carefully
2. Verify all prerequisites are installed correctly
3. Ensure all configuration files are set up properly
4. Check that all required ports are available
5. Contact the development team if issues persist

## System Requirements

**Minimum:**
- 2 GB RAM
- 1 GB free disk space
- Internet connection for AI API calls

**Recommended:**
- 4 GB+ RAM
- 5 GB+ free disk space
- Stable internet connection

## Next Steps

After successful installation:

1. Read the [README.md](README.md) for feature overview
2. Create your first profile
3. Try analyzing a job description
4. Generate your first tailored resume
5. Explore all features

Happy job hunting!
