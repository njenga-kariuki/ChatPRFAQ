# LLM-Powered Product Concept Evaluator

## Overview

This is a web application that simulates Amazon's "Working Backwards" process using AI. The system takes a user's product idea as input and generates a PRFAQ document and MLP (Minimum Lovable Product) plan through a sequence of LLM-powered steps. Each step in the process involves a different AI persona (Product Manager, Marketing Lead, etc.) that contributes to developing the product concept.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a traditional client-server architecture:

1. **Frontend**: HTML/CSS/JavaScript single-page application with a Bootstrap UI
2. **Backend**: Flask Python server that orchestrates LLM processing
3. **AI Integration**: Google Gemini API for LLM capabilities
4. **Deployment**: Configured for Replit deployment with Gunicorn

The system is designed for simplicity and maintainability, avoiding unnecessary complexity while providing a robust user experience. The application processes product ideas through a sequence of predefined steps, each with specific prompts and personas, to simulate Amazon's Working Backwards methodology.

## Key Components

### Backend Components

1. **Flask Application (`app.py`)**
   - Creates and configures the Flask application
   - Sets up CORS for API access
   - Defines the secret key for sessions

2. **Routes (`routes.py`)**
   - Defines API endpoints and page routes
   - Main endpoints:
     - `/`: Serves the main application page
     - `/api/process`: Processes a product idea through the full Working Backwards pipeline

3. **LLM Processor (`llm_processor.py`)**
   - Handles interactions with the Google Gemini API
   - Manages the sequence of Working Backwards steps
   - Processes input through each step and returns comprehensive results

4. **Configuration (`config.py`)**
   - Stores API keys and configuration settings
   - Defines the Working Backwards process steps, including:
     - Step 1: Drafting Press Release (Product Manager Persona)
     - Step 2: Refining Press Release (Marketing Lead Persona)
     - Step 3: Drafting External FAQ (Customer Advocate & PM Persona)
     - (Additional steps defined in the configuration)

### Frontend Components

1. **Main Application Page (`templates/index.html`)**
   - Bootstrap-based responsive UI with dark theme
   - Form for product idea input
   - Display areas for each processing step and results

2. **JavaScript Client (`static/js/main.js`)**
   - Handles form submission and API interactions
   - Updates UI to show processing status and results
   - Provides functionality to export results

3. **CSS Styling (`static/css/style.css`)**
   - Custom styling for the application
   - Step display and progress indicators

## Data Flow

1. User enters a product idea in the web interface
2. Frontend sends the idea to the backend via the `/api/process` endpoint
3. Backend orchestrates the processing through the LLM pipeline:
   - Each step takes the output from the previous step as input
   - The LLM processor formats prompts based on the current step
   - The Google Gemini API generates responses for each step
4. Results are returned to the frontend
5. Frontend displays the intermediate outputs from each step and the final PRFAQ document

## External Dependencies

1. **Google Gemini API**
   - Primary LLM provider for all text generation
   - Requires an API key set in environment variables
   - Uses the `gemini-pro` model for all prompts

2. **Frontend Libraries (CDN-hosted)**
   - Bootstrap for UI components and theming
   - Bootstrap Icons for iconography
   - Markdown-it for rendering markdown content

3. **Python Libraries**
   - Flask: Web framework
   - Flask-CORS: Cross-origin resource sharing
   - Google Generative AI: Python client for Gemini API
   - Gunicorn: Production WSGI server
   - Additional utilities (see pyproject.toml)

## Deployment Strategy

The application is configured for deployment on Replit with:

1. **Environment**
   - Python 3.11 as the primary runtime
   - OpenSSL and PostgreSQL packages (via Nix)

2. **Run Configuration**
   - Gunicorn as the production server
   - Binding to 0.0.0.0:5000 for external access
   - Entry point: `main:app`

3. **Development**
   - Flask's built-in development server with debugging enabled
   - Auto-reload for code changes

4. **Security Considerations**
   - API keys stored in environment variables
   - Session secret configurable via environment

## Database Configuration

The application is currently prepared for potential database integration with:
- SQLAlchemy and PostgreSQL dependencies included
- Future database schema would likely include:
  - User accounts
  - Saved product ideas
  - Generated PRFAQ documents

Note: While PostgreSQL-related packages are included, the current version does not implement database functionality.