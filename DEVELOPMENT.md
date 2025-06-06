# Development & Deployment Guide

## Problem Solved
This project was experiencing issues where Flask served old static builds instead of live development code. This has been permanently fixed.

## Current Setup

### Development Mode (Always Live Code)
- Flask always redirects to Vite development server (port 3000)
- No static builds are ever used during development
- All changes are immediately visible

### File Structure
```
- Frontend lives in: frontend/
- Vite dev server: http://localhost:3000
- Flask API server: http://localhost:5000
- Build output: build/react/ (not used in development)
```

## How to Prevent Static Build Issues

### 1. Never Use Static Builds in Development
- The `static/react/` directory has been removed
- Flask routing now always redirects to Vite dev server
- Vite builds go to `build/react/` (separate from Flask)

### 2. Git Configuration
- `.gitignore` prevents committing any build directories
- Only source code is tracked, never built assets

### 3. For Deployment
- Use the fresh build script: `./build-for-deployment.sh`
- Or use the production deployment script: `python deploy.py`
- Both create fresh builds from current source code

## Commands

### Development
```bash
# Start both servers (current setup)
python run_dev.py & (cd frontend && npm run dev)

# Access the app
http://localhost:3000  # Always use this URL
```

### Deployment Preparation
```bash
# Build fresh code for deployment
./build-for-deployment.sh

# Or use production deployment
python deploy.py
```

## Port Configuration for Deployment

For Replit deployment, the `.replit` file is configured to:
- Route external traffic to port 3000 (where Flask serves the built app)
- Keep development server accessible on port 3000 for local development
- Flask API server runs on port 5000 during development only

**Deployment Flow:**
1. `python deploy.py` builds fresh React code and serves it via Flask on port 3000
2. External traffic routes to port 3000 (matching Flask deployment port)
3. Flask serves both the React build AND API endpoints (`/api/*`)

**Development Flow:**
1. Vite dev server runs on port 3000 (live frontend)
2. Flask API server runs on port 5000 (API endpoints)
3. Vite proxies API calls to Flask backend

## Key Changes Made
1. Removed all static build directories
2. Updated Flask routing to always use live Vite server in development
3. Changed Vite build output to `build/react/`
4. Added `.gitignore` to prevent committing builds
5. Created fresh build scripts for deployment
6. **Fixed Replit deployment port mismatch:** Flask now serves on port 3000 in production
7. **Enhanced deployment script:** `deploy.py` builds fresh React code and serves via Flask
8. **Unified deployment:** Single Flask server handles both frontend assets and API routes