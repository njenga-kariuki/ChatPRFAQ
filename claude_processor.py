import logging
import anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL

logger = logging.getLogger(__name__)

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
        Generate a response using Claude Sonnet API
        
        Args:
            system_prompt: The system prompt defining the persona and context
            user_prompt: The formatted user prompt with input data
            progress_callback: Optional callback for progress updates
            step_id: Optional step identifier for progress tracking
            
        Returns:
            Dict containing response results or error information
        """
        logger.info(f"=== Starting Claude API call for Step {step_id} ===")
        
        # Check if client was properly initialized
        if not self.client:
            error_msg = "Claude API client not initialized. Please set ANTHROPIC_API_KEY in Replit Secrets."
            logger.error(error_msg)
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": "Claude API failed: API key not configured",
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
            logger.info(f"Claude response received - length: {len(output)} characters")
            
            # Critical validation logging for response quality
            if len(output.strip()) < 100:
                logger.warning(f"Claude response seems unusually short: {len(output)} chars")
            else:
                logger.info("Claude response appears to be of appropriate length")
            
            # Get completion message
            completion_messages = {
                0: "Product analysis complete",
                1: "Market research and competitive analysis complete",
                2: "Press release draft complete", 
                3: "Press release refinement complete",
                4: "Customer FAQ complete",
                5: "Internal FAQ complete",
                6: "PRFAQ document synthesis complete",
                7: "MLP roadmap complete"
            }
            completion_message = completion_messages.get(step_id, "Agent completed processing")
            
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "completed",
                    "message": completion_message,
                    "progress": (step_id / 7) * 100 if step_id else 100,
                    "output": output
                })
            
            logger.info("=== Claude API call completed successfully ===")
            return {
                "output": output,
                "model_used": self.model
            }
            
        except Exception as e:
            logger.error(f"Error in Claude API call: {str(e)}")
            logger.exception("Full error traceback:")
            
            # Better error message for API key issues
            error_msg = str(e)
            if "authentication" in error_msg.lower() or "api_key" in error_msg.lower():
                error_msg = "Invalid API key. Please check ANTHROPIC_API_KEY in Replit Secrets."
            elif "connection" in error_msg.lower():
                error_msg = "Unable to connect to Claude API. Please verify ANTHROPIC_API_KEY is correct."
            
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": f"Error in Agent processing: {error_msg}",
                    "error": error_msg
                })
            return {"error": f"Claude API call failed: {error_msg}"} 