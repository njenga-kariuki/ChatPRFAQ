import logging
from openai import OpenAI
from config import PERPLEXITY_API_KEY, PERPLEXITY_BASE_URL, PERPLEXITY_MODEL

logger = logging.getLogger(__name__)

def format_response_summary(text: str, max_length: int = 150) -> str:
    """Format LLM response for clean logging"""
    if not text:
        return "Empty response"
    
    # Clean up response
    cleaned = text.strip().replace('\n', ' ').replace('\r', ' ')
    
    # Truncate if too long
    if len(cleaned) > max_length:
        return f"{cleaned[:max_length]}... ({len(text)} chars total)"
    
    return f"{cleaned} ({len(text)} chars)"

class PerplexityProcessor:
    def __init__(self):
        # The OpenAI client automatically adds the Bearer prefix to the API key
        self.client = OpenAI(
            api_key=PERPLEXITY_API_KEY,
            base_url=PERPLEXITY_BASE_URL
        )
        self.model = PERPLEXITY_MODEL
        logger.info(f"PerplexityProcessor initialized with model: {self.model}")
        
        if not PERPLEXITY_API_KEY:
            logger.error("PERPLEXITY_API_KEY is not set. Research functionality will not work.")
        else:
            logger.info("PERPLEXITY_API_KEY is properly configured")
    
    def conduct_initial_market_research(self, product_idea, system_prompt, user_prompt, progress_callback=None):
        """
        Conduct initial market research using Perplexity's Sonar API on raw product idea
        
        Args:
            product_idea: The raw product idea from user input
            system_prompt: The system prompt for the research analyst persona
            user_prompt: The user prompt template for research instructions
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict containing research results or error information
        """
        logger.info("Starting initial Perplexity market research")
        
        # Check if client was properly initialized
        if not self.client:
            error_msg = "Perplexity API client not initialized. Please set PERPLEXITY_API_KEY in Replit Secrets."
            logger.error(error_msg)
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "error",
                    "message": "Market research failed: API key not configured",
                    "error": error_msg
                })
            return {"error": error_msg}
        
        try:
            # Format the user prompt with the product idea
            formatted_prompt = user_prompt.format(input=product_idea)
            
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "processing",
                    "message": "Agent researching market landscape and competitive intelligence...",
                    "progress": 5
                })
            
            logger.info("Calling Perplexity Sonar API for initial research...")
            logger.debug(f"Using model: {self.model}")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": formatted_prompt}
                ],
                max_tokens=8192,
                temperature=0.3,
                top_p=0.9
            )
            
            if not response or not response.choices or not response.choices[0].message.content:
                logger.error("Invalid response from Perplexity API")
                return {"error": "Invalid response from Perplexity API"}
            
            research_output = response.choices[0].message.content
            logger.info(f"Perplexity response: {format_response_summary(research_output)}")
            
            # Quality validation
            if len(research_output.strip()) < 500:
                logger.warning(f"Perplexity response seems unusually short: {len(research_output)} chars")
            elif not any(keyword in research_output.lower() for keyword in ['market', 'competitive', 'customer', 'industry']):
                logger.warning("Perplexity response may not contain expected research sections")
            else:
                logger.info("Perplexity response appears to contain expected research sections")
            
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "completed",
                    "message": "Market research and competitive analysis complete",
                    "progress": 10.0,  # ~1/10 of total progress
                    "output": research_output
                })
            
            logger.info("Initial market research completed successfully")
            
            return {
                "output": research_output,
                "step": "Market Research & Analysis",
                "persona": "Expert Market Research Analyst",
                "description": "Comprehensive market research and competitive analysis using real-time web data."
            }
            
        except Exception as e:
            logger.error(f"API call failed | Model: {self.model}, Error: {type(e).__name__}: {str(e)}")
            logger.exception("Full error traceback:")
            
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "error",
                    "message": f"Market research failed: {str(e)}",
                    "error": str(e)
                })
            
            return {"error": f"Market research failed: {str(e)}"} 