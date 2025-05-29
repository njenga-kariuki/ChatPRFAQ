import logging
import anthropic
import httpx
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
        self.client = anthropic.Anthropic(
            api_key=ANTHROPIC_API_KEY,
            timeout=httpx.Timeout(180.0)  # 3 minute HTTP timeout
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
            # Get messages for this step
            messages = self.step_activity_messages.get(step_id, ["Processing..."])
            
            # Send initial message
            if progress_callback:
                if isinstance(messages, list) and len(messages) > 0:
                    progress_callback({
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
                            threading.Timer(delay, lambda m=msg, p=progress_increment, sid=step_id: progress_callback({
                                "step": sid,
                                "status": "processing", 
                                "message": m,
                                "progress": p
                            })).start()
            
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
                    "progress": self._calculate_step_progress(step_id, 7),
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