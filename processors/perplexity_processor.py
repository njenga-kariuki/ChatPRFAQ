import logging
from openai import OpenAI
import time
from config import PERPLEXITY_API_KEY, PERPLEXITY_BASE_URL, PERPLEXITY_MODEL

# Import store_raw_llm_output from the new utility location
from utils.raw_output_cache import store_raw_llm_output

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
    
    def _calculate_step_progress(self, step_id, sub_increment=0):
        """
        Calculate progress percentage for a given step and sub-increment using linear distribution.
        
        Progress allocation:
        - Analysis (Step 0): 0% to 8%
        - Main workflow (Steps 1-10): 8% to 97% using linear distribution (8.9% per step)
        
        Linear distribution creates predictable progression:
        - Each step represents approximately 8.9% of total progress
        - Smooth increments that match user expectations
        - No jarring jumps between phases
        
        Args:
            step_id: The step number (1-10 for main workflow)
            sub_increment: Additional progress within the step (0-7)
            
        Returns:
            Progress percentage (0-100)
        """
        if step_id <= 0:
            # Analysis phase handling
            return min(2 + sub_increment, 8)
        
        # Simple linear: 8% to 97% across 10 steps = 8.9% per step
        base_progress = 8 + ((step_id - 1) * 8.9)
        
        # Sub-increments scale slightly for better feel within each step
        step_increment = sub_increment * 1.2
        
        # Cap at 97% to ensure we never exceed 99% with safety margins
        return min(base_progress + step_increment, 97)
    
    def conduct_initial_market_research(self, product_idea, system_prompt, user_prompt, progress_callback=None, request_id=None, step_info=None):
        """
        Conduct initial market research using Perplexity's Sonar API on raw product idea
        
        Args:
            product_idea: The raw product idea from user input
            system_prompt: The system prompt for the research analyst persona
            user_prompt: The user prompt template for research instructions
            progress_callback: Optional callback for progress updates
            request_id: Optional request ID for caching raw output
            step_info: Optional string describing the step for caching (e.g., "step_1_MarketResearch")
            
        Returns:
            Dict containing research results or error information
        """
        log_prefix = f"[{request_id or 'NO_REQ_ID'}]" if request_id else "[PerplexityResearch]"
        logger.info(f"{log_prefix} Starting initial Perplexity market research")
        
        # Protected progress callback wrapper
        def safe_callback(update):
            if progress_callback:
                try:
                    progress_callback(update)
                except Exception as e:
                    logger.error(f"{log_prefix} Progress callback failed: {e}")
                    # Don't re-raise to avoid killing the calling thread
        
        # Send step start log
        safe_callback({
            'type': 'log',
            'level': 'info',
            'message': f'🎯 Step 1 starting Perplexity market research',
            'request_id': request_id
        })
        
        # Check if client was properly initialized
        if not self.client:
            error_msg = "Perplexity API client not initialized. Please set PERPLEXITY_API_KEY in Replit Secrets."
            logger.error(f"{log_prefix} {error_msg}")
            safe_callback({
                "step": 1, # Assuming step 1 for market research
                "status": "error",
                "message": "Market research failed: API key not configured",
                "error": error_msg
            })
            safe_callback({
                'type': 'log',
                'level': 'error',
                'message': f'❌ Step 1 failed: Perplexity API not configured',
                'request_id': request_id
            })
            return {"error": error_msg}
        
        try:
            # Format the user prompt with the product idea
            formatted_prompt = user_prompt.format(input=product_idea)
            
            safe_callback({
                "step": 1, # Assuming step 1
                "status": "processing",
                "message": "Market analyst pulling competitive intelligence...",
                "progress": self._calculate_step_progress(1)
            })
            
            logger.info(f"{log_prefix} Calling Perplexity Sonar API for initial research...")
            logger.debug(f"{log_prefix} Using model: {self.model}")
            
            # Send API call start log with timing
            api_start_time = time.time()
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': f'🔄 Step 1 calling Perplexity API (model: {self.model})',
                'request_id': request_id
            })
            
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
            
            api_duration = time.time() - api_start_time
            
            if not response or not response.choices or not response.choices[0].message.content:
                logger.error(f"{log_prefix} Invalid response from Perplexity API")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 1 received invalid Perplexity API response',
                    'request_id': request_id
                })
                return {"error": "Invalid response from Perplexity API"}
            
            research_output = response.choices[0].message.content
            
            # Extract citations from Perplexity API response and append to output
            try:
                if hasattr(response, 'citations') and response.citations:
                    research_output += "\n\n## Source List\n\n"
                    for i, url in enumerate(response.citations, 1):
                        # Extract meaningful title from URL path
                        from urllib.parse import urlparse
                        parsed = urlparse(url)
                        path_parts = [part for part in parsed.path.strip('/').split('/') if part]
                        
                        if path_parts:
                            # Take the last meaningful part (usually the article slug)
                            title_slug = path_parts[-1]
                            # Convert slug to readable title
                            title = title_slug.replace('-', ' ').replace('_', ' ')
                            title = ' '.join(word.capitalize() for word in title.split())
                            
                            # Remove common file extensions
                            title = title.replace('.Html', '').replace('.Php', '').replace('.Aspx', '')
                        else:
                            # Fallback to domain name if no path
                            domain = parsed.netloc.replace('www.', '').replace('.com', '').replace('.edu', '').replace('.org', '')
                            title = ' '.join(word.capitalize() for word in domain.split('.'))
                        
                        # Format as numbered list with clickable markdown links
                        research_output += f"{i}. [{title}]({url})\n"
                    
                    logger.info(f"{log_prefix} Successfully appended {len(response.citations)} citations to research output")
                else:
                    logger.warning(f"{log_prefix} No citations found in Perplexity response")
            except Exception as e:
                logger.warning(f"{log_prefix} Error processing citations: {str(e)}")
                # Continue without citations if there's an error
            
            logger.info(f"{log_prefix} Perplexity response: {format_response_summary(research_output)}")

            # Send API completion log with timing
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': f'✅ Step 1 Perplexity API completed in {api_duration:.1f}s ({len(research_output)} chars)',
                'request_id': request_id
            })

            # Store raw output if request_id is provided
            if request_id and step_info:
                try:
                    store_raw_llm_output(request_id, step_info, research_output)
                except Exception as e_store:
                    logger.error(f"{log_prefix} Failed to store raw LLM output for {step_info}: {e_store}")
            
            # Quality validation
            if len(research_output.strip()) < 500:
                logger.warning(f"{log_prefix} Perplexity response seems unusually short: {len(research_output)} chars")
                safe_callback({
                    'type': 'log',
                    'level': 'warn',
                    'message': f'⚠️ Step 1 research response unusually short ({len(research_output)} chars)',
                    'request_id': request_id
                })
            elif not any(keyword in research_output.lower() for keyword in ['market', 'competitive', 'customer', 'industry']):
                logger.warning(f"{log_prefix} Perplexity response may not contain expected research sections")
                safe_callback({
                    'type': 'log',
                    'level': 'warn',
                    'message': f'⚠️ Step 1 research may be missing key sections (market/competitive/customer)',
                    'request_id': request_id
                })
            else:
                logger.info(f"{log_prefix} Perplexity response appears to contain expected research sections")
            
            safe_callback({
                "step": 1, # Assuming step 1
                "status": "completed",
                "message": "Market research and competitive analysis complete",
                "progress": self._calculate_step_progress(1, 7),
                "output": research_output
            })
            
            logger.info(f"{log_prefix} Initial market research completed successfully")
            
            return {
                "output": research_output,
                "step": "Market Research & Analysis",
                "persona": "Expert Market Research Analyst",
                "description": "Comprehensive market research and competitive analysis using real-time web data."
            }
            
        except Exception as e:
            api_duration = time.time() - api_start_time if 'api_start_time' in locals() else 0
            logger.error(f"{log_prefix} API call failed | Model: {self.model}, Error: {type(e).__name__}: {str(e)}")
            logger.exception("Full error traceback:")
            
            safe_callback({
                "step": 1, # Assuming step 1
                "status": "error",
                "message": f"Market research failed: {str(e)}",
                "error": str(e)
            })
            
            safe_callback({
                'type': 'log',
                'level': 'error',
                'message': f'💥 Step 1 Perplexity API failed after {api_duration:.1f}s: {type(e).__name__}: {str(e)}',
                'request_id': request_id
            })
            
            return {"error": f"Market research failed: {str(e)}"} 