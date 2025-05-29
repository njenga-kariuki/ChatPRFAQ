#!/usr/bin/env python3
"""
Development server script that bypasses Gunicorn timeout issues
"""

from app import app

if __name__ == "__main__":
    print("🚀 Starting LLM-Powered Product Concept Evaluator (Development Mode)")
    print("📝 This uses Flask's built-in server with no timeouts")
    print("🌐 Access the application at: http://localhost:5000")
    print("🔍 Watch the logs below for detailed debugging info")
    print("=" * 60)
    
    app.run(
        host="0.0.0.0", 
        port=5000, 
        debug=True,
        threaded=True,  # Enable threading for better concurrency
        use_reloader=False  # Disabled to prevent orphaned processes in Replit workflows
    ) 