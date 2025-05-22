#!/usr/bin/env python3
"""
Run only Flask server with built React app (no Vite development server)
This eliminates the host blocking conflicts by serving everything from Flask
"""

import os
import logging
from app import app

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

if __name__ == '__main__':
    logger.info("🚀 Starting Flask-only server with built React app")
    logger.info("📝 This serves the built React app directly from Flask")
    logger.info("🌐 Access the application at: http://localhost:5000")
    logger.info("🔍 No Vite development server = No host blocking issues")
    logger.info("============================================================")
    
    # Run Flask on port 5000, accessible from all addresses
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=True
    )