#!/usr/bin/env python3
"""
Production deployment script that builds fresh React code and serves it via Flask
"""

import os
import subprocess
import sys
from app import app

def build_frontend():
    """Build the React frontend for production"""
    print("🏗️  Building React frontend for production...")
    
    try:
        # Change to frontend directory and build
        os.chdir('frontend')
        result = subprocess.run(['npm', 'run', 'build'], check=True, capture_output=True, text=True)
        print("✅ Frontend build completed successfully")
        os.chdir('..')
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Frontend build failed: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Build error: {str(e)}")
        return False

def setup_production_routes():
    """Set up Flask routes to serve the fresh build"""
    from flask import send_from_directory
    
    @app.route('/')
    def serve_fresh_build():
        """Serve the freshly built React app"""
        return send_from_directory('build/react', 'index.html')
    
    @app.route('/<path:path>')
    def serve_fresh_assets(path):
        """Serve fresh build assets or fallback to index.html for SPA routing"""
        if path.startswith('api/'):
            from flask import abort
            abort(404)
        
        try:
            if os.path.exists(os.path.join('build/react', path)):
                return send_from_directory('build/react', path)
            else:
                return send_from_directory('build/react', 'index.html')
        except:
            return send_from_directory('build/react', 'index.html')

if __name__ == "__main__":
    print("🚀 Starting production deployment...")
    
    # Build fresh frontend
    if not build_frontend():
        print("❌ Deployment failed due to build errors")
        sys.exit(1)
    
    # Set up production routes
    setup_production_routes()
    
    print("🌐 Starting production server...")
    print("=" * 50)
    
    # Start Flask for production
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=False,
        threaded=True
    )