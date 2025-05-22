# LLM-Powered Product Concept Evaluator

## Overview

This web application simulates Amazon's "Working Backwards" process using Large Language Models to help product managers, entrepreneurs, and innovators develop and refine their product concepts. The application generates a comprehensive Press Release/FAQ (PRFAQ) document and a Minimum Lovable Product (MLP) plan through a structured 6-step AI-driven process.

## Features

### Core Functionality
- **6-Step Working Backwards Process**: Automated simulation of Amazon's proven product development methodology
- **Real-time Progress Updates**: Live streaming of processing steps with detailed progress tracking
- **Professional Output**: Generates publication-ready PRFAQ documents and actionable MLP plans
- **Export Capabilities**: Download results in multiple formats for sharing and documentation
- **Responsive UI**: Modern, mobile-friendly interface with dark theme

### AI-Powered Steps
1. **Draft Press Release** (Product Manager Persona) - Initial customer-focused announcement
2. **Refine Press Release** (Marketing Lead Persona) - Polished, persuasive messaging
3. **External FAQ** (Customer Advocate & PM Personas) - Customer-facing questions and answers
4. **Internal FAQ** (Lead Engineer & PM Personas) - Internal stakeholder concerns and feasibility
5. **Synthesize PRFAQ** (Editor Persona) - Combined, coherent document with risk analysis
6. **Define MLP Plan** (PM & Engineer Personas) - Minimum Lovable Product roadmap

## Technology Stack

### Backend
- **Framework**: Flask 3.1.1 with Flask-CORS
- **LLM Integration**: Google Gemini API (gemini-2.5-pro-preview-05-06)
- **Real-time Communication**: Server-Sent Events for live progress updates
- **Configuration**: Environment-based configuration management
- **Deployment**: Gunicorn with custom timeout configuration

### Frontend
- **Framework**: Vanilla JavaScript with modern ES6+ features
- **UI Framework**: Bootstrap 5.3.0 with custom dark theme
- **Icons**: Bootstrap Icons for consistent visual elements
- **Content Formatting**: Markdown-it for rich text rendering
- **Progress Tracking**: Real-time step visualization with accordion interface

### Development Environment
- **Python**: 3.11+
- **Package Management**: UV with pyproject.toml
- **Platform**: Replit-compatible with cross-platform support

## Architecture

```
┌─────────────────┐    HTTP/JSON     ┌───────────────────┐
│  Frontend UI    │ ◄──────────────► │  Flask Web Server │
│  (HTML/CSS/JS)  │                  │  (app.py/routes) │
└─────────────────┘                  └───────────────────┘
                                              │
                                              │ Function Calls
                                              ▼
                                     ┌───────────────────┐
                                     │   LLM Processor   │
                                     │ (llm_processor.py)│
                                     └───────────────────┘
                                              │
                                              │ API Calls
                                              ▼
                                     ┌───────────────────┐
                                     │  Google Gemini    │
                                     │      API          │
                                     └───────────────────┘
```

## Getting Started

### Prerequisites
- Python 3.11 or higher
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd product-concept-evaluator
   ```

2. **Install dependencies**
   ```bash
   pip install -e .
   ```

3. **Set up environment variables**
   
   **For Replit:** Add to Replit Secrets:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   
   **For local development:** Create a `.env` file:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   export SESSION_SECRET="your-session-secret"  # Optional
   ```

### Running the Application

#### Option 1: Development Server (Recommended for Testing)
```bash
python run_dev.py
```
- ✅ No timeout limitations
- ✅ Detailed console logging
- ✅ Auto-reload on code changes
- ✅ Perfect for development and debugging

#### Option 2: Production Server
```bash
python main.py
```
or
```bash
gunicorn --bind 0.0.0.0:5000 --timeout 120 main:app
```

#### Option 3: Replit Deployment
The application is pre-configured for Replit. Simply hit the "Run" button.

### Testing the Setup

Run the included test script to verify everything is working:
```bash
python test_api.py
```

This will test:
- API key validation
- Gemini API connectivity
- Core functionality
- Step processing

## Usage Guide

### Basic Workflow

1. **Access the Application**
   - Open your browser to `http://localhost:5000` (development)
   - Or your Replit URL (production)

2. **Enter Your Product Idea**
   - Provide a detailed description (minimum 10 characters)
   - Include the problem it solves, target audience, and unique value proposition
   - Example: "A mobile app for Kenya small businesses that integrates M-Pesa, WhatsApp, and inventory management"

3. **Choose Processing Mode**
   - **Standard**: Complete processing, then display results
   - **Streaming**: Real-time updates as each step completes

4. **Review Results**
   - Browse through each step in the accordion interface
   - Review the final PRFAQ document
   - Examine the MLP plan with features and metrics

5. **Export and Share**
   - Download results as text files
   - Copy sections for presentations or documentation

### API Endpoints

#### Core Endpoints
- `GET /` - Main application interface
- `POST /api/process` - Process complete pipeline (3-4 minutes)
- `POST /api/process_stream` - Stream processing with real-time updates
- `POST /api/process_step` - Process individual steps

#### Request Format
```json
{
  "product_idea": "Your detailed product description here..."
}
```

#### Response Format
```json
{
  "product_idea": "Original input",
  "steps": [
    {
      "id": 1,
      "name": "Drafting Press Release",
      "persona": "Product Manager Persona",
      "input": "...",
      "output": "..."
    }
  ],
  "prfaq": "Complete PRFAQ document",
  "mlp_plan": "MLP plan with features and metrics"
}
```

## Performance & Expectations

### Processing Times
- **Each Step**: 20-40 seconds (depends on complexity)
- **Total Duration**: 3-4 minutes for complete evaluation
- **Concurrent Users**: Supports multiple simultaneous evaluations

### Output Quality
- **Press Release**: Publication-ready, 500-800 words
- **FAQs**: 5-7 comprehensive Q&As per section
- **PRFAQ Document**: 2000-4000 words, professionally formatted
- **MLP Plan**: Actionable roadmap with metrics and technical considerations

## File Structure

```
├── main.py                 # Application entry point
├── app.py                  # Flask application factory
├── routes.py               # API routes and endpoints
├── llm_processor.py        # Core LLM processing logic
├── config.py               # Configuration and step definitions
├── run_dev.py              # Development server script
├── test_api.py             # API integration tests
├── pyproject.toml          # Python dependencies
├── .replit                 # Replit deployment configuration
├── templates/
│   └── index.html          # Main web interface
├── static/
│   ├── js/
│   │   └── main.js         # Frontend JavaScript
│   └── css/
│       └── style.css       # Custom styling
└── README.md               # This file
```

## Configuration

### Environment Variables
- `GEMINI_API_KEY` (Required): Google Gemini API key
- `SESSION_SECRET` (Optional): Flask session secret key

### Model Configuration
The application uses `gemini-2.5-pro-preview-05-06` for optimal results. To change models, update `config.py`:

```python
GEMINI_MODEL = "your-preferred-model"
```

### Step Customization
Modify personas and prompts in `config.py` under `WORKING_BACKWARDS_STEPS`. Each step includes:
- System prompt (persona definition)
- User prompt template
- Metadata (name, description)

## Troubleshooting

### Common Issues

**Application gets stuck processing**
- Cause: Timeout issues with long-running requests
- Solution: Use `python run_dev.py` or ensure Gunicorn timeout is set to 120+ seconds

**API errors or authentication failures**
- Cause: Invalid or missing API key
- Solution: Verify `GEMINI_API_KEY` in environment/secrets

**Import errors on startup**
- Cause: Missing dependencies
- Solution: Run `pip install -e .` to install all requirements

**Poor quality outputs**
- Cause: Insufficient input detail or API rate limiting
- Solution: Provide more detailed product descriptions (50+ words)

### Debug Mode

For detailed logging, run:
```bash
python run_dev.py
```

This provides:
- Step-by-step processing logs
- API call timing information
- Error details and stack traces
- Progress callback debugging

### Testing Individual Components

```bash
# Test API connectivity
python test_api.py

# Test single step processing
python -c "from llm_processor import LLMProcessor; p = LLMProcessor(); print(p.generate_step_response(1, 'test idea'))"

# Test web server
curl -X POST http://localhost:5000/api/process -H "Content-Type: application/json" -d '{"product_idea":"test"}'
```

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Update documentation as needed
5. Submit a pull request

### Code Style
- Follow PEP 8 for Python code
- Use meaningful variable names
- Add logging for debugging
- Include error handling for external API calls

### Adding New Features
- New LLM steps: Modify `config.py` and update frontend accordingly
- New endpoints: Add to `routes.py` with proper error handling
- UI changes: Update `templates/index.html` and `static/` files

## Security Considerations

- API keys are handled via environment variables
- No sensitive data is logged
- CORS is properly configured
- Input validation prevents malicious payloads
- Rate limiting should be implemented for production use

## License

[Add your license information here]

## Support

For issues, questions, or contributions:
1. Check this README for common solutions
2. Run `python test_api.py` to diagnose issues
3. Review application logs for error details
4. Create an issue with reproduction steps

---

**Version**: 1.0
**Last Updated**: January 2025
**Status**: Production Ready 