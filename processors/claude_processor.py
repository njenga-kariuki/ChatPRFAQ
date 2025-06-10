import logging
import anthropic
import httpx
import os
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
import time

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

class ClaudeProcessor:
    def __init__(self):
        # Production-resilient timeout configuration
        if os.environ.get('FLASK_DEPLOYMENT_MODE') == 'production':
            # Production: More aggressive timeout settings for infrastructure resilience
            timeout_config = httpx.Timeout(300.0, connect=30.0, read=270.0)  # 5min total, 4.5min read
        else:
            # Development: Current settings
            timeout_config = httpx.Timeout(180.0)  # 3 minute HTTP timeout
            
        self.client = anthropic.Anthropic(
            api_key=ANTHROPIC_API_KEY,
            timeout=timeout_config
        )
        self.model = CLAUDE_MODEL
        logger.info(f"ClaudeProcessor initialized with model: {self.model}")
        
        # Step-specific activity messages for enhanced progress tracking
        self.step_activity_messages = {
            0: [
                "PM analyzing concept...",
                "Sharing analysis with team for feedback..."
            ],
            1: [
                "Market analyst pulling competitive intelligence...",
                "Analyzing industry trends and competitors...",
                "Presenting findings to product team..."
            ],
            2: [
                "User researcher scheduling customer interviews...",
                "Conducting problem discovery sessions...",
                "Synthesizing findings for team review..."
            ],
            3: [
                "PM drafting initial press release...",
                "Circulating draft for team input...",
                "Incorporating feedback from marketing and engineering..."
            ],
            4: [
                "VP Product reviewing press release...",
                "Running exec readout session...",
                "PM incorporating VP's strategic feedback..."
            ],
            5: [
                "Legal and compliance reviewing proposal...",
                "Engineering assessing technical feasibility...",
                "Finance analyzing business model...",
                "PM synthesizing cross-functional feedback..."
            ],
            6: [
                "User researcher reviewing concept...",
                "Scheduling concept validation sessions...",
                "Running customer feedback sessions...",
                "Documenting key insights..."
            ],
            7: [
                "PM reviewing validation results...",
                "Meeting with engineering on feasibility concerns...",
                "Refining solution based on feedback..."
            ],
            8: [
                "Customer success team drafting FAQ from research...",
                "PM reviewing for completeness..."
            ],
            9: [
                "Editor reviewing all documents...",
                "Final stakeholder alignment meeting...",
                "Incorporating last feedback round..."
            ],
            10: [
                "Engineering and PM defining MLP scope...",
                "Prioritization workshop in progress...",
                "Finalizing MLP roadmap with leadership..."
            ]
        }
        
        if not ANTHROPIC_API_KEY:
            logger.error("ANTHROPIC_API_KEY is not set. Claude functionality will not work.")
        else:
            logger.info("ANTHROPIC_API_KEY is properly configured")
    
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
    
    def generate_response(self, system_prompt, user_prompt, progress_callback=None, step_id=None, request_id=None, step_info=None):
        """
        Generate a response from Claude API
        
        Args:
            system_prompt: The system prompt for Claude
            user_prompt: The user prompt for Claude
            progress_callback: Optional callback for progress updates
            step_id: Optional step ID for progress tracking
            request_id: Optional request ID for caching raw output
            step_info: Optional string describing the step for caching (e.g., "step_1_MarketResearch")
            
        Returns:
            Dict containing response or error information
        """
        log_prefix = f"[{request_id or 'NO_REQ_ID'}]" if request_id else f"[Step {step_id or 'N/A'}]"
        logger.info(f"{log_prefix} Starting Claude API call for step {step_id}")
        
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
            'message': f'🎯 Step {step_id} starting Claude API call',
            'request_id': request_id
        })
        
        # Check if client was properly initialized
        if not self.client:
            error_msg = "Claude API client not initialized. Please set ANTHROPIC_API_KEY in Replit Secrets."
            logger.error(f"{log_prefix} {error_msg}")
            safe_callback({
                "step": step_id,
                "status": "error",
                "message": "Claude API not configured",
                "error": error_msg
            })
            safe_callback({
                'type': 'log',
                'level': 'error',
                'message': f'❌ Step {step_id} failed: API not configured',
                'request_id': request_id
            })
            return {"error": error_msg}
        
        try:
            # Get messages for this step
            messages = self.step_activity_messages.get(step_id, ["Processing..."])
            
            # Send initial message
            if isinstance(messages, list) and len(messages) > 0:
                safe_callback({
                    "step": step_id,
                    "status": "processing",
                    "message": messages[0],
                    "progress": self._calculate_step_progress(step_id)
                })
                
                # Set up message progression for team dynamics
                if len(messages) > 1:
                    import threading
                    for i, msg in enumerate(messages[1:], 1):
                        delay = i * 2.0
                        progress_increment = self._calculate_step_progress(step_id, i)
                        threading.Timer(delay, lambda m=msg, p=progress_increment, sid=step_id: safe_callback({
                            "step": sid,
                            "status": "processing", 
                            "message": m,
                            "progress": p
                        })).start()
            
            # Enhanced diagnostic logging for payload analysis
            total_prompt_size = len(system_prompt) + len(user_prompt)
            logger.info(f"{log_prefix} Step {step_id} payload size: {total_prompt_size} chars (system: {len(system_prompt)}, user: {len(user_prompt)})")
            logger.info(f"{log_prefix} Step {step_id} production mode: {os.environ.get('FLASK_DEPLOYMENT_MODE') == 'production'}")
            logger.info(f"{log_prefix} Calling Claude API with model: {self.model}")
            logger.debug(f"{log_prefix} System prompt length: {len(system_prompt)}")
            logger.debug(f"{log_prefix} User prompt length: {len(user_prompt)}")
            
            # Send API call start log with timing
            api_start_time = time.time()
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': f'🔄 Step {step_id} calling Claude API (model: {self.model})',
                'request_id': request_id
            })
            
            # Universal retry logic for production resilience
            max_retries = 3 if step_id >= 7 else 2  # Extra retries for complex later steps
            retry_delays = [2.0, 5.0, 10.0]  # Progressive backoff
            
            response = None
            for attempt in range(max_retries):
                try:
                    response = self.client.messages.create(
                        model=self.model,
                        max_tokens=8192,
                        temperature=0.3,
                        top_p=0.95,
                        system=system_prompt,
                        messages=[
                            {"role": "user", "content": user_prompt}
                        ]
                    )
                    # Success - exit retry loop
                    break
                    
                except Exception as e:
                    # Check for retryable errors (rate limits, timeouts, overloaded)
                    is_retryable_error = (
                        'rate' in str(e).lower() or 
                        'overloaded' in str(e).lower() or
                        'timeout' in str(e).lower() or
                        '529' in str(e) or
                        'connection' in str(e).lower()
                    )
                    
                    if is_retryable_error and attempt < max_retries - 1:
                        delay = retry_delays[attempt]
                        logger.warning(f"{log_prefix} Step {step_id} retry {attempt + 1}/{max_retries} after {delay}s: {str(e)}")
                        safe_callback({
                            'type': 'log',
                            'level': 'warn',
                            'message': f'⚠️ Step {step_id} retrying in {delay}s (attempt {attempt + 1}/{max_retries})',
                            'request_id': request_id
                        })
                        time.sleep(delay)
                        continue
                    else:
                        # Re-raise for existing error handling
                        raise
            
            api_duration = time.time() - api_start_time
            
            if not response or not response.content or not response.content[0].text:
                logger.error(f"{log_prefix} Invalid response from Claude API")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step {step_id} received invalid Claude API response',
                    'request_id': request_id
                })
                return {"error": "Invalid response from Claude API"}
            
            output = response.content[0].text
            logger.info(f"{log_prefix} Claude response: {format_response_summary(output)}")

            # Enhanced diagnostic logging for response analysis
            logger.info(f"{log_prefix} Step {step_id} API response time: {api_duration:.2f}s, response size: {len(output)} chars")

            # Send API completion log with timing
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': f'✅ Step {step_id} Claude API completed in {api_duration:.1f}s ({len(output)} chars)',
                'request_id': request_id
            })

            # Store raw output if request_id is provided
            if request_id and step_info:
                logger.debug(f"{log_prefix} PRE-CACHE RAW OUTPUT for {step_info} (len: {len(output)}): '{output[:500]}...'" ) # Log first 500 chars
                try:
                    store_raw_llm_output(request_id, step_info, output)
                except Exception as e_store:
                    logger.error(f"{log_prefix} Failed to store raw LLM output for step {step_info}: {e_store}")
            
            # Critical validation logging for response quality
            if len(output.strip()) < 100:
                logger.warning(f"{log_prefix} Claude response seems unusually short: {len(output)} chars")
                safe_callback({
                    'type': 'log',
                    'level': 'warn',
                    'message': f'⚠️ Step {step_id} response unusually short ({len(output)} chars)',
                    'request_id': request_id
                })
            else:
                logger.info(f"{log_prefix} Claude response appears to be of appropriate length")
            
            # Send completion update via progress callback
            safe_callback({
                "step": step_id,
                "status": "completed",
                "message": f"Step {step_id} completed successfully",
                "progress": self._calculate_step_progress(step_id, 7),
                "output": output
            })
            
            logger.info(f"{log_prefix} Claude API call completed successfully")
            return {"output": output}
            
        except Exception as e:
            api_duration = time.time() - api_start_time if 'api_start_time' in locals() else 0
            error_msg = f"Claude API error: {str(e)}"
            logger.error(f"{log_prefix} API call failed | Model: {self.model}, Error: {type(e).__name__}: {str(e)}")
            logger.exception("Full error traceback:")
            
            safe_callback({
                "step": step_id,
                "status": "error",
                "message": f"Step {step_id} failed: {str(e)}",
                "error": error_msg
            })
            
            safe_callback({
                'type': 'log',
                'level': 'error',
                'message': f'💥 Step {step_id} Claude API failed after {api_duration:.1f}s: {type(e).__name__}: {str(e)}',
                'request_id': request_id
            })
            
            return {"error": error_msg} 