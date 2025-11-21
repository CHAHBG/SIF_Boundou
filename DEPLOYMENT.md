# SIF Boundou - Deployment Guide

## Architecture Overview

This application has a **separate frontend and backend**:

- **Frontend**: Static HTML/CSS/JS hosted on Netlify
- **Backend**: Node.js/Express API with PostGIS hosted on Render.com
- **Database**: PostgreSQL with PostGIS on Neon (Serverless Postgres)

## Quick Start - Deploy to Production

### Step 1: Deploy Backend API to Render.com

1. **Go to [Render.com](https://dashboard.render.com/)** and sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `CHAHBG/SIF_Boundou`
4. Configure the service:
   - **Name**: `sif-boundou-api`
   - **Region**: Choose closest to your users (e.g., Frankfurt for Europe/Africa)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or Starter for better performance)

5. **Add Environment Variable**:
   - Click "Environment" tab
   - Add: `DATABASE_URL`
   - Value: `postgresql://neondb_owner:npg_jE36dGYAocfv@ep-wild-base-ab7csm1o-pooler.eu-west-2.aws.neon.tech/BoundouGeoportal?sslmode=require`

6. Click **"Create Web Service"**

7. **Wait for deployment** (2-5 minutes). Render will provide a URL like:
   ```
   https://sif-boundou-api.onrender.com
   ```

8. **Test the API** by visiting:
   ```
   https://sif-boundou-api.onrender.com/api/health
   ```
   You should see: `{"status":"ok","timestamp":"..."}`

### Step 2: Update Frontend Configuration

1. **Edit `frontend/config.js`**:
   ```javascript
   const config = {
       BACKEND_URL: window.location.hostname === 'localhost'
           ? 'http://localhost:4000'
           : 'https://sif-boundou-api.onrender.com', // ⚠️ UPDATE WITH YOUR RENDER URL
       ...
   };
   ```

2. **Replace** `https://sif-boundou-api.onrender.com` with your actual Render URL from Step 1

3. **Commit and push**:
   ```bash
   git add frontend/config.js
   git commit -m "Update backend URL for production"
   git push
   ```

### Step 3: Deploy Frontend to Netlify

Your frontend is already on Netlify at `https://sifboundou.netlify.app`

Netlify auto-deploys when you push to GitHub, so after Step 2, wait 1-2 minutes for deployment.

### Step 4: Verify Everything Works

1. Visit: `https://sifboundou.netlify.app`
2. You should see the map load with parcels
3. Test search functionality
4. Click parcels to see modals with data and photos

## Troubleshooting

### Map tiles not loading?

**Check browser console**. If you see CORS errors:
1. Ensure backend `.env` file has correct database URL
2. Verify Render backend is running at `/api/health`
3. Check `frontend/config.js` has correct backend URL

### Backend sleeping (Free tier)?

Render free tier puts services to sleep after 15 minutes of inactivity.
- **Solution**: Upgrade to Starter ($7/month) or use a ping service

### Database connection errors?

Verify your Neon database connection string in Render environment variables:
```
postgresql://neondb_owner:npg_jE36dGYAocfv@ep-wild-base-ab7csm1o-pooler.eu-west-2.aws.neon.tech/BoundouGeoportal?sslmode=require
```

## Local Development

### Backend

```bash
cd backend
npm install
# Create .env file with DATABASE_URL
npm start
# Server runs on http://localhost:4000
```

### Frontend

```bash
cd frontend
# Open with Live Server or any HTTP server
# Example:
python -m http.server 8888
# Visit http://localhost:8888
```

## Project Structure

```
SIF_Boundou/
├── backend/
│   ├── index.js           # Express API with MVT endpoints
│   ├── package.json
│   ├── .env              # Database credentials (not in git)
│   └── .env.example
├── frontend/
│   ├── index.html        # Main UI
│   ├── app.js           # MapLibre GL JS application
│   └── config.js        # Backend URL configuration
├── database/
│   └── import_collective_surveys_full.js
└── DEPLOYMENT.md        # This file
```

## Environment Variables

### Backend (Render)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `PORT` | Auto-set by Render (usually 10000) |

### Frontend (Netlify)

No environment variables needed - all configuration is in `config.js`

## Database Schema

Tables:
- `parcels` - Parcel geometries and metadata
- `individual_surveys` - Individual parcel survey data
- `collective_surveys` - Collective parcel survey data
- `mandataries` - Mandataire information for collective parcels
- `beneficiaries` - Beneficiary list for collective parcels

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/tiles/{z}/{x}/{y}` | Vector tiles (MVT) |
| `GET /api/search?q=...` | Search parcels |
| `GET /api/parcels/:id` | Get parcel details |

## Tech Stack

- **Frontend**: MapLibre GL JS 3.6.2, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, pg (PostgreSQL client)
- **Database**: PostgreSQL 14 + PostGIS (Neon serverless)
- **Hosting**: Netlify (frontend), Render (backend)

## Support

For issues, check:
1. Render logs: https://dashboard.render.com/
2. Netlify deploy logs: https://app.netlify.com/
3. Browser console (F12)
