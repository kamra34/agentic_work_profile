# Deployment Guide - Railway + Vercel

## ✅ Backend Deployment (Railway) - COMPLETED

Your backend is now deployed on Railway with PostgreSQL database.

**Railway Backend URL:** `https://your-app.up.railway.app`

### Backend Environment Variables (Already Set)
```
DATABASE_URL=<your-railway-postgres-url>
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
SECRET_KEY=<your-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

---

## 🚀 Frontend Deployment (Vercel)

### Step 1: Get Your Railway Backend URL

1. Go to your Railway dashboard
2. Click on your backend service
3. Go to "Settings" tab
4. Copy your **Public Domain** (e.g., `https://agentic-work-profile-production.up.railway.app`)

### Step 2: Deploy to Vercel

#### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from project root:**
   ```bash
   vercel
   ```

4. **When prompted:**
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name: `agentic-work-profile` (or your choice)
   - In which directory is your code located? **.**
   - Override settings? **N**

5. **Set environment variable:**
   ```bash
   vercel env add VITE_API_URL
   ```
   - What's the value? Enter your Railway backend URL: `https://your-app.up.railway.app`
   - Which environments? Select **Production**, **Preview**, **Development**

6. **Deploy to production:**
   ```bash
   vercel --prod
   ```

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Add Environment Variable:**
   - Name: `VITE_API_URL`
   - Value: `https://your-railway-backend-url.up.railway.app`
   - Select all environments (Production, Preview, Development)

6. Click "Deploy"

### Step 3: Update Railway CORS Settings

Once you have your Vercel URL (e.g., `https://your-app.vercel.app`):

1. Go to Railway dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app
   ```
5. Redeploy backend (Railway will auto-deploy on variable change)

### Step 4: Test Your Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Try to:
   - ✅ Register a new account
   - ✅ Login
   - ✅ Create a profile
   - ✅ Tailor a CV
   - ✅ Download PDF

---

## 🔧 Troubleshooting

### CORS Errors
- **Problem:** "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Solution:** Make sure your Vercel URL is in Railway's `CORS_ORIGINS` variable

### API Connection Failed
- **Problem:** Frontend can't connect to backend
- **Solution:**
  1. Verify `VITE_API_URL` in Vercel environment variables
  2. Check Railway backend is running (visit `https://your-backend.up.railway.app/health`)

### Build Errors
- **Problem:** Vercel build fails
- **Solution:**
  1. Check build logs in Vercel dashboard
  2. Verify `package.json` has correct dependencies
  3. Try building locally: `cd frontend && npm run build`

---

## 📝 Quick Reference

### Your URLs
- **Frontend (Vercel):** `https://your-app.vercel.app`
- **Backend (Railway):** `https://your-backend.up.railway.app`
- **Database (Railway):** `postgresql://postgres:...@yamabiko.proxy.rlwy.net:59917/railway`

### Important Commands

**Frontend:**
```bash
# Local development
cd frontend
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

**Backend:**
```bash
# Local development
cd backend
./venv/Scripts/python.exe -m uvicorn main:app --reload

# Check Railway deployment
railway logs
```

---

## 🎉 Post-Deployment Checklist

- [ ] Backend deployed on Railway
- [ ] Database migrated to Railway
- [ ] Frontend deployed on Vercel
- [ ] Environment variables set correctly
- [ ] CORS configured with Vercel URL
- [ ] Test login/register works
- [ ] Test CV creation works
- [ ] Test PDF download works
- [ ] Share your app URL! 🚀