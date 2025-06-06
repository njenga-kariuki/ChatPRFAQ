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

For Replit deployment, ensure `.replit` file has:
```toml
[[ports]]
localPort = 5000
externalPort = 80

[[ports]]
localPort = 3000
externalPort = 3000
```

This ensures external traffic routes to Flask (port 5000) while keeping development server accessible.

## Key Changes Made
1. Removed all static build directories
2. Updated Flask routing to always use live Vite server
3. Changed Vite build output to `build/react/`
4. Added `.gitignore` to prevent committing builds
5. Created fresh build scripts for deployment