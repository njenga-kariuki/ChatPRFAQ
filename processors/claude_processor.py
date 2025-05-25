import logging
import anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL

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
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.model = CLAUDE_MODEL
        logger.info(f"ClaudeProcessor initialized with model: {self.model}")
        
        # Step-specific activity messages for enhanced progress tracking
        self.step_activity_messages = {
            0: "Agent analyzing product concept structure...",
            1: "Agent researching market landscape and competitive intelligence...",
            2: "Agent drafting customer-focused press release...",
            3: "Agent refining press release for executive review...",
            4: "Agent anticipating customer concerns and adoption barriers...",
            5: "Agent analyzing strategic business and technical challenges...",
            6: "Agent synthesizing comprehensive PRFAQ document...",
            7: "Agent defining minimum lovable product roadmap..."
        }
        
        if not ANTHROPIC_API_KEY:
            logger.error("ANTHROPIC_API_KEY is not set. Claude functionality will not work.")
        else:
            logger.info("ANTHROPIC_API_KEY is properly configured")
    
    def generate_response(self, system_prompt, user_prompt, progress_callback=None, step_id=None):
        """
        Generate a response from Claude API
        
        Args:
            system_prompt: The system prompt for Claude
            user_prompt: The user prompt for Claude
            progress_callback: Optional callback for progress updates
            step_id: Optional step ID for progress tracking
            
        Returns:
            Dict containing response or error information
        """
        logger.info(f"Starting Claude API call for step {step_id}")
        
        # Check if client was properly initialized
        if not self.client:
            error_msg = "Claude API client not initialized. Please set ANTHROPIC_API_KEY in Replit Secrets."
            logger.error(error_msg)
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": "Claude API not configured",
                    "error": error_msg
                })
            return {"error": error_msg}
        
        try:
            # Get step-specific activity message
            activity_message = self.step_activity_messages.get(step_id, "Agent processing...")
            
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "processing",
                    "message": activity_message,
                    "progress": ((step_id - 1) / 7) * 100 + 10 if step_id else 10
                })
            
            logger.info(f"Calling Claude API with model: {self.model}")
            logger.debug(f"System prompt length: {len(system_prompt)}")
            logger.debug(f"User prompt length: {len(user_prompt)}")
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=8192,
                temperature=0.7,
                top_p=0.95,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            if not response or not response.content or not response.content[0].text:
                logger.error("Invalid response from Claude API")
                return {"error": "Invalid response from Claude API"}
            
            output = response.content[0].text
            logger.info(f"Claude response: {format_response_summary(output)}")
            
            # Critical validation logging for response quality
            if len(output.strip()) < 100:
                logger.warning(f"Claude response seems unusually short: {len(output)} chars")
            else:
                logger.info("Claude response appears to be of appropriate length")
            
            # Send completion update via progress callback
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "completed",
                    "message": f"Step {step_id} completed successfully",
                    "progress": (step_id / 7) * 100 if step_id else 100,
                    "output": output
                })
            
            logger.info("Claude API call completed successfully")
            return {"output": output}
            
        except Exception as e:
            error_msg = f"Claude API error: {str(e)}"
            logger.error(f"API call failed | Model: {self.model}, Error: {type(e).__name__}: {str(e)}")
            logger.exception("Full error traceback:")
            
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": f"Step {step_id} failed: {str(e)}",
                    "error": error_msg
                })
            
            return {"error": error_msg} 