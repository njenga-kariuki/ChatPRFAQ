#!/usr/bin/env python3
"""
Stable Flask development server for Replit workflows
"""

from app import app

if __name__ == "__main__":
    print("🚀 Starting Flask Backend Server")
    print("🌐 Access API at: http://localhost:5000")
    print("🔍 Frontend should run separately on port 3000")
    print("=" * 50)
    
    # Start Flask with stable configuration
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=True,
        threaded=True,
        use_reloader=False  # Prevents multiple processes in Replit
    ) 