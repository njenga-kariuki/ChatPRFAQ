#!/usr/bin/env python3
"""
Production deployment script that builds fresh React code and serves it via Flask on port 3000
"""

import os
import subprocess
import sys
from flask import send_from_directory, abort
from app import app

def build_frontend():
    """Build the React frontend for production"""
    print("🏗️  Building React frontend for production...")
    
    try:
        # Change to frontend directory and build
        os.chdir('frontend')
        
        # Install dependencies if needed
        if not os.path.exists('node_modules'):
            print("📦 Installing frontend dependencies...")
            subprocess.run(['npm', 'install'], check=True, capture_output=True, text=True)
        
        # Build the React app
        result = subprocess.run(['npm', 'run', 'build'], check=True, capture_output=True, text=True)
        print("✅ Frontend build completed successfully")
        print(f"Build output: {result.stdout}")
        
        os.chdir('..')
        
        # Verify build output exists
        if not os.path.exists('build/react/index.html'):
            print("❌ Build verification failed: index.html not found")
            return False
            
        print("✅ Build verification successful")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Frontend build failed: {e.stderr}")
        os.chdir('..')
        return False
    except Exception as e:
        print(f"❌ Build error: {str(e)}")
        os.chdir('..')
        return False

def setup_production_routes():
    """Set up Flask routes to serve the fresh build"""
    
    @app.route('/')
    def serve_fresh_build():
        """Serve the freshly built React app"""
        try:
            return send_from_directory('build/react', 'index.html')
        except Exception as e:
            print(f"❌ Error serving index.html: {e}")
            return f"Error loading application: {e}", 500
    
    @app.route('/<path:path>')
    def serve_fresh_assets(path):
        """Serve fresh build assets or fallback to index.html for SPA routing"""
        # Don't interfere with API routes
        if path.startswith('api/'):
            abort(404)
        
        try:
            build_path = os.path.join('build/react', path)
            if os.path.exists(build_path) and os.path.isfile(build_path):
                return send_from_directory('build/react', path)
            else:
                # SPA fallback - serve index.html for client-side routing
                return send_from_directory('build/react', 'index.html')
        except Exception as e:
            print(f"❌ Error serving {path}: {e}")
            return send_from_directory('build/react', 'index.html')

if __name__ == "__main__":
    print("🚀 Starting production deployment...")
    print("📍 This will serve the application on port 3000")
    
    # Build fresh frontend
    if not build_frontend():
        print("❌ Deployment failed due to build errors")
        sys.exit(1)
    
    # Set up production routes
    setup_production_routes()
    
    print("🌐 Starting production server on port 3000...")
    print("🔗 External traffic will be routed to this port")
    print("=" * 50)
    
    # Start Flask for production on port 3000 (matching Replit external routing)
    app.run(
        host="0.0.0.0", 
        port=3000,  # Changed from 5000 to 3000 to match Replit routing
        debug=False,
        threaded=True
    )