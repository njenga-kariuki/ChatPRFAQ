import logging
from openai import OpenAI
from config import PERPLEXITY_API_KEY, PERPLEXITY_BASE_URL, PERPLEXITY_MODEL

logger = logging.getLogger(__name__)

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
        logger.info("=== Starting Initial Perplexity Market Research ===")
        
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
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "processing",
                    "message": "Conducting market research with Perplexity...",
                    "progress": 10
                })
            
            # Format the user prompt with the product idea
            formatted_prompt = user_prompt.format(input=product_idea)
            
            logger.info("Calling Perplexity Sonar API for initial research...")
            logger.debug(f"Using model: {self.model}")
            
            # Remove the extra_headers parameter - OpenAI client handles auth automatically
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": formatted_prompt}
                ],
                temperature=0.3,  # Lower temperature for factual research
                max_tokens=4000
            )
            
            if not response or not response.choices or not response.choices[0].message.content:
                logger.error("Invalid response from Perplexity API")
                return {"error": "Invalid response from Perplexity API"}
            
            research_output = response.choices[0].message.content
            logger.info(f"Initial research completed - length: {len(research_output)} characters")
            
            # Critical validation logging for response quality
            if len(research_output.strip()) < 100:
                logger.warning(f"Perplexity response seems unusually short: {len(research_output)} chars")
            elif "Market Opportunity Analysis" not in research_output and "Competitive Intelligence" not in research_output:
                logger.warning("Perplexity response may not contain expected research sections")
            else:
                logger.info("Perplexity response appears to contain expected research sections")
            
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "completed",
                    "message": "Market research completed",
                    "progress": (1/7) * 100,
                    "output": research_output
                })
            
            logger.info("=== Initial Market Research completed successfully ===")
            return {
                "output": research_output,
                "step": "Market Research & Analysis",
                "persona": "Senior Market Research Analyst",
                "description": "Comprehensive market research and competitive analysis"
            }
            
        except Exception as e:
            logger.error(f"Error in conduct_initial_market_research: {str(e)}")
            logger.exception("Full error traceback:")
            
            # Better error message for API key issues
            error_msg = str(e)
            if "401" in error_msg or "Unauthorized" in error_msg:
                error_msg = "Authentication failed. Please check that PERPLEXITY_API_KEY is correct in Replit Secrets."
            elif "Connection error" in error_msg:
                error_msg = "Unable to connect to Perplexity API. Please verify PERPLEXITY_API_KEY is correct."
            
            if progress_callback:
                progress_callback({
                    "step": 1,
                    "status": "error",
                    "message": f"Error in market research: {error_msg}",
                    "error": error_msg
                })
            return {"error": f"Initial market research failed: {error_msg}"} 