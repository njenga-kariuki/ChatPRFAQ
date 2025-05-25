import os
import logging
import sys
from flask import Flask
from flask_cors import CORS

def setup_logging():
    """Configure centralized logging for the application"""
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s | %(name)s | %(levelname)s | %(message)s'
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear any existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Set specific module levels
    logging.getLogger('llm_processor').setLevel(logging.INFO)
    logging.getLogger('claude_processor').setLevel(logging.INFO)
    logging.getLogger('perplexity_processor').setLevel(logging.INFO)
    logging.getLogger('routes').setLevel(logging.INFO)
    
    # Reduce noise from external libraries
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)

# Set up logging first
setup_logging()

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Enable CORS specifically for API routes, allowing all origins for now
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Import routes after app is created to avoid circular imports
from routes import *

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
