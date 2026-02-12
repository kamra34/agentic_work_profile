# 📦 Installation Guide - Agentic CV Builder

Complete step-by-step guide to set up the Agentic CV Builder on your local machine.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [PostgreSQL Setup](#postgresql-setup)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Running the Application](#running-the-application)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

### **Required Software**

| Software | Version | Download Link |
|----------|---------|---------------|
| **Python** | 3.9 or higher | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js** | 20.19+ (or 22.12+) | [nodejs.org/download](https://nodejs.org/en/download/) |
| **PostgreSQL** | 13 or higher | [postgresql.org/download](https://www.postgresql.org/download/) |
| **Git** | Latest | [git-scm.com/downloads](https://git-scm.com/downloads) |

### **API Keys Required**

You'll need API keys from:
- **OpenAI**: Sign up at [platform.openai.com](https://platform.openai.com/)
- **Anthropic**: Sign up at [console.anthropic.com](https://console.anthropic.com/)

---

## 💻 System Requirements

### **Minimum Requirements**
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: 4GB
- **Storage**: 2GB free space
- **Internet**: Required for AI API calls

### **Recommended Requirements**
- **RAM**: 8GB or more
- **Storage**: 5GB free space
- **Processor**: Dual-core 2.0GHz or better

---

## 🐘 PostgreSQL Setup

### **Step 1: Install PostgreSQL**

#### **Windows**
1. Download installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run installer and follow wizard
3. Set a password for the `postgres` user (remember this!)
4. Default port: `5432` (keep this)
5. Complete installation

#### **macOS**
```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Or download from postgresql.org
```

#### **Linux (Ubuntu/Debian)**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### **Step 2: Create Database**

#### **Option A: Using pgAdmin (GUI - Recommended for Beginners)**

1. Open **pgAdmin** (installed with PostgreSQL)
2. Connect to PostgreSQL server (enter your password)
3. Right-click on **Databases** → **Create** → **Database**
4. Enter database name: `agentic_cv_db`
5. Click **Save**

#### **Option B: Using Command Line**

**Windows:**
```bash
# Open Command Prompt as Administrator
psql -U postgres

# In psql prompt:
CREATE DATABASE agentic_cv_db;
\q
```

**macOS/Linux:**
```bash
# Switch to postgres user
sudo -u postgres psql

# In psql prompt:
CREATE DATABASE agentic_cv_db;
\q
```

### **Step 3: Verify Database Connection**

Test your database connection:

```bash
# Windows
psql -U postgres -d agentic_cv_db

# macOS/Linux
sudo -u postgres psql -d agentic_cv_db
```

If you see the `agentic_cv_db=#` prompt, you're good to go! Type `\q` to exit.

---

## 🔧 Backend Setup

### **Step 1: Clone the Repository**

```bash
# Clone the repository (replace with your actual repo URL)
git clone <repository-url>
cd agentic_work_profile
```

### **Step 2: Create Python Virtual Environment**

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### **Step 3: Install Python Dependencies**

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

This will install:
- FastAPI
- SQLAlchemy
- PostgreSQL drivers
- OpenAI SDK
- Anthropic SDK
- ReportLab (PDF generation)
- And all other dependencies

### **Step 4: Create Environment File**

Create a file named `.env` in the `backend/` directory:

**Windows (Command Prompt):**
```bash
echo. > .env
notepad .env
```

**macOS/Linux:**
```bash
touch .env
nano .env
```

Add the following content to `.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/agentic_cv_db

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Optional: CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:5174,http://localhost:3000
```

**Important:**
- Replace `YOUR_PASSWORD` with your PostgreSQL password
- Replace `your-super-secret-key-change-this-in-production` with a random string (e.g., `openssl rand -hex 32`)
- Add your actual OpenAI API key (starts with `sk-`)
- Add your actual Anthropic API key (starts with `sk-ant-`)
- Use PostgreSQL only for this project (do not configure SQLite).

### **Step 5: Initialize Database Tables**

Make sure your virtual environment is activated, then run:

```bash
python -c "from sqlalchemy import create_engine; from dotenv import load_dotenv; import os; from models import Base; load_dotenv(); engine=create_engine(os.getenv('DATABASE_URL')); Base.metadata.create_all(bind=engine)"
```

You should see no errors. This creates all necessary tables in your database.

### **Step 6: Verify Backend Setup**

Start the backend server:

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000 --log-level debug --access-log

```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Open your browser and go to:
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/

If you see the API docs, the backend is working! Keep this terminal running.

---

## ⚛️ Frontend Setup

Open a **new terminal window** (keep backend running in the first one).

### **Step 1: Navigate to Frontend Directory**

```bash
cd frontend
```

### **Step 2: Install Node Dependencies**

```bash
npm install
```

This will install:
- React
- Vite
- And all other frontend dependencies

### **Step 3: Verify Frontend Configuration**

Frontend API base URL defaults to `http://localhost:8000`.

If your backend runs on a different host/port, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8001
```

### **Step 4: Start Frontend Development Server**

```bash
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## 🚀 Running the Application

You should now have **two terminals running**:

### **Terminal 1: Backend**
```bash
cd backend
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
uvicorn main:app --reload --port 8000
```

### **Terminal 2: Frontend**
```bash
cd frontend
npm run dev
```

### **Access the Application**

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the login page!

### **Create Your First Account**

1. Click **"Register"** or **"Sign Up"**
2. Enter your details:
   - Full name
   - Email
   - Password
3. Click **"Register"**
4. Log in with your credentials

---

## 🎯 Quick Start Guide

After logging in for the first time:

### **Step 1: Set Your Profile**
Navigate to **"My Profile"** and add your contact information.

### **Step 2: Build Your Profile Pool**
Go to **"Profile Pool"** and start adding:
- Work experiences
- Skills
- Education
- Projects
- And more!

### **Step 3: Tailor Your First CV**
1. Go to **"Tailor CV"**
2. Paste a job description
3. Click **"Analyze with AI"**
4. Wait for dual-AI analysis (runs in background)
5. Review recommendations
6. Click **"Save Tailored CV"**

### **Step 4: View & Export**
1. Go to **"CV Portfolio"**
2. Click on your saved CV
3. Customize visible items
4. Download as PDF

### **Step 5: Track Applications**
1. Go to **"Application Tracker"**
2. Create new applications
3. Drag and drop between status columns
4. Track your job search progress

---

## 🐛 Troubleshooting

### **Backend Issues**

#### **Database Connection Error**
```
Error: could not translate host name "localhost" to address
```

**Solution:**
- Ensure PostgreSQL is running
- Check your DATABASE_URL in `.env`
- Verify database exists: `psql -U postgres -l`

#### **Module Not Found Error**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution:**
- Activate virtual environment: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (macOS/Linux)
- Reinstall dependencies: `pip install -r requirements.txt`

#### **API Key Error**
```
Error: OpenAI API key is invalid
```

**Solution:**
- Check your API key in `.env`
- Ensure no spaces around the `=` sign
- Verify key is active on OpenAI/Anthropic dashboard

### **Frontend Issues**

#### **Port Already in Use**
```
Error: Port 5173 is already in use
```

**Solution:**
- Kill the process using the port:
  - **Windows**: `netstat -ano | findstr :5173` then `taskkill /PID <PID> /F`
  - **macOS/Linux**: `lsof -ti:5173 | xargs kill -9`
- Or use a different port: `npm run dev -- --port 3000`

#### **Cannot Connect to Backend**
```
Network Error / Failed to fetch
```

**Solution:**
- Ensure backend is running on port 8000
- Check browser console for errors
- Verify CORS configuration in backend `.env`

### **Database Issues**

#### **Cannot Create Database**
```
ERROR: permission denied to create database
```

**Solution:**
- Use postgres superuser: `psql -U postgres`
- Or create user with permissions:
  ```sql
  CREATE USER myuser WITH PASSWORD 'mypassword';
  ALTER USER myuser CREATEDB;
  ```

#### **Tables Not Created**
```
relation "users" does not exist
```

**Solution:**
- Run database initialization again:
  ```bash
  python -c "from sqlalchemy import create_engine; from dotenv import load_dotenv; import os; from models import Base; load_dotenv(); engine=create_engine(os.getenv('DATABASE_URL')); Base.metadata.create_all(bind=engine)"
  ```

---

## 🔄 Updating the Application

### **Pull Latest Changes**
```bash
git pull origin main
```

### **Update Backend**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt --upgrade
```

### **Update Frontend**
```bash
cd frontend
npm install
```

### **Update Database Schema**
```bash
cd backend
python -c "from sqlalchemy import create_engine; from dotenv import load_dotenv; import os; from models import Base; load_dotenv(); engine=create_engine(os.getenv('DATABASE_URL')); Base.metadata.create_all(bind=engine)"
```

---

## 🛑 Stopping the Application

### **Stop Backend**
In the backend terminal: Press `CTRL + C`

### **Stop Frontend**
In the frontend terminal: Press `CTRL + C`

### **Stop PostgreSQL (Optional)**

**Windows:**
```bash
# Via Services: services.msc → PostgreSQL → Stop
```

**macOS:**
```bash
brew services stop postgresql@15
```

**Linux:**
```bash
sudo systemctl stop postgresql
```

---

## 📚 Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://react.dev/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **OpenAI API Documentation**: https://platform.openai.com/docs/
- **Anthropic API Documentation**: https://docs.anthropic.com/

---

## 💡 Tips for Development

### **Backend Hot Reload**
The `--reload` flag automatically restarts the server when you save Python files.

### **Frontend Hot Reload**
Vite automatically updates the browser when you save React files.

### **View Database**
Use **pgAdmin** or **DBeaver** to visually explore your database tables and data.

### **API Testing**
Use the built-in Swagger UI at http://localhost:8000/docs to test API endpoints.

### **Environment Variables**
Never commit your `.env` file to Git! It's already in `.gitignore`.

---

## 🎓 Learning Resources

New to these technologies? Check out:

- **Python Basics**: [python.org/about/gettingstarted](https://www.python.org/about/gettingstarted/)
- **React Tutorial**: [react.dev/learn](https://react.dev/learn)
- **SQL Tutorial**: [postgresql.org/docs/tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- **REST APIs**: [restfulapi.net](https://restfulapi.net/)

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the [README.md](README.md) for feature documentation
2. Review error messages carefully
3. Search for the error on Stack Overflow
4. Contact the development team

---

**Happy Building! 🚀**

*Last Updated: February 12, 2026*
