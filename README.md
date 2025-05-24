# LLM-Powered Product Concept Evaluator

A sophisticated web application that implements Amazon's "Working Backwards" methodology using Anthropic Claude to help product teams develop comprehensive product strategies and PRFAQs.

This web application simulates Amazon's "Working Backwards" process using Large Language Models to help product managers, entrepreneurs, and innovators develop and refine their product concepts. The application generates a comprehensive Press Release/FAQ (PRFAQ) document and a Minimum Lovable Product (MLP) plan through a structured 6-step AI-driven process.

## Key Features

- **Working Backwards Method**: Implements Amazon's product development methodology with AI assistance
- **LLM Integration**: Anthropic Claude Sonnet (claude-sonnet-4-20250514) for advanced reasoning
- **Market Research**: Integrated Perplexity AI for real-time competitive analysis  
- **Interactive Web Interface**: Modern React-based frontend for seamless user experience
- **Progress Tracking**: Real-time updates on document generation progress
- **Export Options**: Download generated documents in multiple formats

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
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React.js      │    │   Flask API     │    │  Anthropic      │
│   Frontend      │◄──►│   (Python)      │◄──►│  Claude Sonnet  │
│                 │    │                 │    │  4-20250514     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Perplexity AI  │
                       │  (Market        │
                       │   Research)     │
                       └─────────────────┘
```

## Getting API Keys

### Anthropic Claude API
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account and verify your email
3. Navigate to API Keys in your dashboard
4. Create a new API key
5. Add the key to Replit Secrets as `ANTHROPIC_API_KEY`

### Perplexity API  
1. Go to [Perplexity API](https://docs.perplexity.ai/)
2. Sign up for an account
3. Generate an API key from your dashboard
4. Add the key to Replit Secrets as `PERPLEXITY_API_KEY`

## Environment Variables

The application requires the following environment variables (set in Replit Secrets):

- `ANTHROPIC_API_KEY` (Required): Anthropic Claude API key
- `PERPLEXITY_API_KEY` (Required): Perplexity AI API key for market research

```bash
# Set these in Replit Secrets
export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
export PERPLEXITY_API_KEY="your-perplexity-api-key-here"
```

## Model Configuration

The application uses `claude-sonnet-4-20250514` for optimal results. To change models, update `config.py`:

```python
CLAUDE_MODEL = "your-preferred-model"
```

Available Claude models:
- `claude-sonnet-4-20250514` (Recommended)
- `claude-opus-4-20250514` (Most capable)
- `claude-3-5-sonnet-20241022` (Previous generation)

## Testing

Run the test suite to verify all components:

```bash
python test_api.py
```

The test suite validates:
- Claude API connectivity
- Configuration values
- Claude processor functionality  
- LLM processor integration

## Troubleshooting

### Common Issues

**Claude API Error**
- Solution: Verify `ANTHROPIC_API_KEY` in environment/secrets
- Check API key validity at [Anthropic Console](https://console.anthropic.com/)

**Model Not Found**
- Solution: Ensure you're using a valid Claude model identifier
- Update `CLAUDE_MODEL` in `config.py` if needed

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