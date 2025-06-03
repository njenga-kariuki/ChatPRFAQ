import logging
import threading
from config import ANTHROPIC_API_KEY, WORKING_BACKWARDS_STEPS, CLAUDE_MODEL, PERPLEXITY_API_KEY, GEMINI_API_KEY, GEMINI_FLASH_MODEL, PRODUCT_ANALYSIS_STEP
from processors.perplexity_processor import PerplexityProcessor
from processors.claude_processor import ClaudeProcessor
from utils.raw_output_cache import store_insight, get_insights
import anthropic
import google.generativeai as genai

# Get logger for this module
logger = logging.getLogger(__name__)

# Configure Google Generative AI with API key
# genai.configure(api_key=ANTHROPIC_API_KEY)

class LLMProcessor:
    def __init__(self):
        self.model = CLAUDE_MODEL
        self.steps = WORKING_BACKWARDS_STEPS
        self.step_outputs = {}
        self.perplexity_processor = PerplexityProcessor()
        self.claude_processor = ClaudeProcessor()
        logger.info(f"LLMProcessor initialized with model: {self.model}")
        logger.info(f"Number of steps configured: {len(self.steps)}")
        
        # Check if API key is set
        if not ANTHROPIC_API_KEY:
            logger.error("ANTHROPIC_API_KEY is not set. LLM functionality will not work.")
        else:
            logger.info("ANTHROPIC_API_KEY is properly configured")

        # Initialize Gemini for insight extraction
        self.gemini_flash_model = None # Initialize to None
        if GEMINI_API_KEY:
            logger.info("GEMINI_API_KEY found, attempting to initialize Gemini Flash.")
            try:
                logger.debug("Calling genai.configure()...")
                genai.configure(api_key=GEMINI_API_KEY)
                logger.debug(f"Successfully configured Gemini. Attempting to initialize GenerativeModel with model: {GEMINI_FLASH_MODEL}")
                self.gemini_flash_model = genai.GenerativeModel(GEMINI_FLASH_MODEL)
                logger.info(f"Gemini Flash initialized successfully for insight extraction: {GEMINI_FLASH_MODEL}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Flash model: {e}", exc_info=True)
                # self.gemini_flash_model remains None
        else:
            logger.warning("GEMINI_API_KEY not set - insight extraction will not work (gemini_flash_model remains None).")

        # Initialize isolated Claude client specifically for insights only
        self.insight_claude_client = None
        self.insight_claude_model = "claude-3-5-haiku-20241022"
        if ANTHROPIC_API_KEY:
            logger.info("ANTHROPIC_API_KEY found, attempting to initialize isolated Claude client for insights.")
            try:
                self.insight_claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                logger.info(f"Isolated Claude client initialized successfully for insight extraction: {self.insight_claude_model}")
                logger.info("Insight extraction will use isolated Claude client (separate from main processing)")
            except Exception as e:
                logger.error(f"Failed to initialize isolated Claude client for insights: {e}", exc_info=True)
                # self.insight_claude_client remains None
        else:
            logger.warning("ANTHROPIC_API_KEY not set - isolated Claude insight extraction will not work.")
            
    def generate_step_response(self, step_id, input_text, step_data=None, progress_callback=None, request_id=None):
        """
        Generate a response from the LLM for a specific step in the Working Backwards process.
        
        Args:
            step_id: The ID of the step to process
            input_text: The input text from the previous step or user
            step_data: Additional data needed for multi-input steps
            progress_callback: Optional callback function to report progress
            request_id: Optional request ID for logging and caching raw output
            
        Returns:
            The generated response from the LLM
        """
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Starting step {step_id}")
        logger.debug(f"[{request_id or 'NO_REQ_ID'}] Input text length: {len(input_text) if input_text else 0}")
        logger.debug(f"[{request_id or 'NO_REQ_ID'}] Step data provided: {step_data is not None}")
        
        try:
            # Handle different step types based on their requirements
            if step_id == 1:
                # Initial market research step
                return self._handle_initial_market_research(input_text, progress_callback, request_id)
            elif step_id == 2:
                # Problem validation research
                return self._handle_problem_validation_research(input_text, step_data, progress_callback, request_id)
            elif step_id == 3:
                # Press release drafting with market research AND problem validation
                return self._handle_press_release_with_research_and_validation(input_text, step_data, progress_callback, request_id)
            elif step_id == 4:
                # Press release refinement (existing handler works)
                return self._handle_press_release_refinement(input_text, step_data, progress_callback, request_id)
            elif step_id == 5:
                # Internal FAQ (existing handler works with adjusted ID)
                return self._handle_step_with_market_research(step_id, input_text, step_data, progress_callback, request_id)
            elif step_id == 6:
                # Concept validation research
                return self._handle_concept_validation_research(input_text, step_data, progress_callback, request_id)
            elif step_id == 7:
                # Solution refinement
                return self._handle_solution_refinement(input_text, step_data, progress_callback, request_id)
            elif step_id == 8:
                # External FAQ (now based on research)
                return self._handle_external_faq_from_research(input_text, step_data, progress_callback, request_id)
            elif step_id == 9:
                # PRFAQ synthesis
                return self._handle_prfaq_synthesis_enhanced(input_text, step_data, progress_callback, request_id)
            elif step_id == 10:
                # MLP Plan
                return self._handle_mlp_with_research_context(input_text, step_data, progress_callback, request_id)
            else:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Unknown step ID: {step_id}")
                return {"error": f"Unknown step ID: {step_id}"}
                
        except Exception as e:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id} failed | Error: {type(e).__name__}: {str(e)}")
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id} context | input_length: {len(input_text) if input_text else 0}, step_data: {step_data is not None}")
            logger.exception("Full error traceback:")
            return {
                "error": f"Step {step_id} failed: {str(e)}",
                "step": step_id
            }

    def _handle_initial_market_research(self, product_idea, progress_callback=None, request_id=None):
        """Handle initial market research step using Perplexity"""
        step_id_for_log = 1
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling initial market research step ({step_id_for_log})")
        
        # Get the market research step configuration
        research_step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not research_step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Initial research step configuration not found")
            return {"error": "Market research step configuration not found"}
        
        # Use Perplexity processor for market research
        result = self.perplexity_processor.conduct_initial_market_research(
            product_idea=product_idea,
            system_prompt=research_step["system_prompt"],
            user_prompt=research_step["user_prompt"],
            progress_callback=progress_callback,
            request_id=request_id,
            step_info=f"step_{step_id_for_log}_{research_step.get('name', 'MarketResearch')}"
        )
        
        # Store Step 1 output and trigger insight extraction (if successful)
        if "error" not in result and result.get("output"):
            output = result["output"]
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log} response received - length: {len(output)} characters")
            
            # Store output for potential use by comparative insights in later steps
            self.step_outputs[step_id_for_log] = output
            
            # Trigger insight extraction in background thread (same as other steps)
            logger.debug(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Triggering insight extraction for market research")
            self._trigger_insight_extraction(step_id_for_log, output, progress_callback, request_id)
        else:
            logger.warning(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Skipping insight extraction due to error or missing output")
        
        return result

    def _handle_problem_validation_research(self, product_idea, step_data, progress_callback=None, request_id=None):
        """Handle problem validation research step"""
        step_id_for_log = 2
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling problem validation research ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Problem validation step configuration not found")
            return {"error": "Problem validation step configuration not found"}
        
        # Format prompt with product idea and market research
        formatted_prompt = step["user_prompt"].format(
            product_idea=product_idea,
            market_research=step_data.get('market_research', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_press_release_with_research_and_validation(self, product_idea, step_data, progress_callback=None, request_id=None):
        """Handle press release drafting with BOTH market research and problem validation"""
        step_id_for_log = 3
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling press release with research and validation ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Press release step configuration not found")
            return {"error": "Press release step configuration not found"}
        
        # Format prompt with product idea, market research, AND problem validation
        formatted_prompt = step["user_prompt"].format(
            product_idea=product_idea,
            market_research=step_data.get('market_research', ''),
            problem_validation=step_data.get('problem_validation', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_press_release_refinement(self, input_text, step_data, progress_callback=None, request_id=None):
        """Handle press release refinement step (special case)"""
        step_id_for_log = 4
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling press release refinement step ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Press release refinement step configuration not found")
            return {"error": "Press release refinement step configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: No step_data provided")
            return {"error": "Market research data required for press release refinement"}
        elif 'market_research' not in step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": "Market research data required for press release refinement"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        input_length = len(input_text) if input_text else 0
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Market research data available ({market_research_length} chars), press release draft ({input_length} chars)")
        
        # Format prompt with press_release_draft and market_research (step 4 specific format)
        formatted_prompt = step["user_prompt"].format(
            press_release_draft=input_text,
            market_research=step_data['market_research'],
            problem_validation=step_data['problem_validation']
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_step_with_market_research(self, step_id, input_text, step_data, progress_callback=None, request_id=None):
        """Handle steps that need both input text and market research context"""
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling step {step_id} with market research")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id} configuration not found")
            return {"error": f"Step {step_id} configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id}: No step_data provided")
            return {"error": "Market research data required for this step"}
        elif 'market_research' not in step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id}: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": "Market research data required for this step"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        input_length = len(input_text) if input_text else 0
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id}: Market research data available ({market_research_length} chars), input text ({input_length} chars)")
        
        # Format prompt with correct parameter names based on step
        if step_id in [5, 6]:
            formatted_prompt = step["user_prompt"].format(
                press_release=input_text,
                market_research=step_data['market_research'],
                problem_validation_summary=step_data.get('problem_validation', '')
            )
        else:
            logger.warning(f"[{request_id or 'NO_REQ_ID'}] _handle_step_with_market_research called for unexpected step_id: {step_id}")
            formatted_prompt = step["user_prompt"].format(
                input=input_text,
                market_research=step_data['market_research']
            )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id, request_id)

    def _handle_prfaq_synthesis(self, input_text, step_data, progress_callback=None, request_id=None):
        """Handle PRFAQ synthesis step with all previous outputs"""
        step_id_for_log = 9
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling PRFAQ synthesis (old version?) with research ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] PRFAQ synthesis step configuration not found for id {step_id_for_log}")
            return {"error": f"PRFAQ synthesis step configuration not found for id {step_id_for_log}"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: No step_data provided")
            return {"error": "Previous step outputs required for PRFAQ synthesis"}
        
        # Extract required data
        market_research = step_data.get('market_research', '')
        refined_press_release = input_text
        external_faq = step_data.get('external_faq', '')
        internal_faq = step_data.get('internal_faq', '')
        
        market_research_length = len(market_research)
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Synthesizing PRFAQ with market_research ({market_research_length} chars), "
                   f"refined_press_release ({len(refined_press_release)} chars), "
                   f"external_faq ({len(external_faq)} chars), "
                   f"internal_faq ({len(internal_faq)} chars)")
        
        formatted_prompt = step["user_prompt"].format(
            market_research=market_research,
            refined_press_release=refined_press_release,
            external_faq=external_faq,
            internal_faq=internal_faq
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_standard_step(self, step_id, input_text, progress_callback=None, request_id=None):
        """Handle standard steps that only need single input"""
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling standard step {step_id}")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id} configuration not found")
            return {"error": f"Step {step_id} configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(input=input_text)
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id, request_id)

    def _handle_concept_validation_research(self, press_release, step_data, progress_callback=None, request_id=None):
        """Handle concept validation research step"""
        step_id_for_log = 6
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling concept validation research ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Concept validation step configuration not found")
            return {"error": "Concept validation step configuration not found"}
        
        problem_validation_summary = step_data.get('problem_validation', '')
        if problem_validation_summary:
            problem_validation_summary = f"Key findings from problem validation:\n{problem_validation_summary[:500]}..."
        
        formatted_prompt = step["user_prompt"].format(
            press_release=press_release,
            market_research=step_data.get('market_research', ''),
            problem_validation_summary=problem_validation_summary
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_solution_refinement(self, press_release, step_data, progress_callback=None, request_id=None):
        """Handle solution refinement based on concept validation"""
        step_id_for_log = 7
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling solution refinement ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Solution refinement step configuration not found")
            return {"error": "Solution refinement step configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(
            refined_press_release=press_release,
            concept_validation_feedback=step_data.get('concept_validation', ''),
            internal_faq=step_data.get('internal_faq', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_external_faq_from_research(self, press_release, step_data, progress_callback=None, request_id=None):
        """Create external FAQ based on concept validation findings"""
        step_id_for_log = 8
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling external FAQ from research ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log} configuration not found in steps list")
            return {"error": "External FAQ step configuration not found"}
        
        if not step_data:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: No step_data provided")
            return {"error": f"Step {step_id_for_log} requires previous step data"}
        
        concept_validation = step_data.get('concept_validation', '')
        if not concept_validation:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Missing concept_validation data from step 6")
            return {"error": f"Step {step_id_for_log} requires concept validation data from step 6"}
        
        if not press_release:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: No press release provided")
            return {"error": f"Step {step_id_for_log} requires refined press release from step 7"}
        
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Press release length: {len(press_release)} chars")
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Concept validation length: {len(concept_validation)} chars")
        
        try:
            formatted_prompt = step["user_prompt"].format(
                solution_refined_press_release=press_release,
                concept_validation_feedback=concept_validation
            )
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Calling Claude API for External FAQ generation")
            result = self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)
            
            if "error" in result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Claude API call failed: {result['error']}")
                return result
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Successfully generated External FAQ ({len(result.get('output', ''))} chars)")
            return result
            
        except Exception as e:
            logger.exception(f"[{request_id or 'NO_REQ_ID'}] Step {step_id_for_log}: Unexpected error during External FAQ generation")
            return {"error": f"Step {step_id_for_log} failed: {str(e)}"}

    def _handle_prfaq_synthesis_enhanced(self, input_text, step_data, progress_callback=None, request_id=None):
        """Enhanced PRFAQ synthesis with user research insights"""
        step_id_for_log = 9
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling enhanced PRFAQ synthesis ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] PRFAQ synthesis step configuration not found")
            return {"error": "PRFAQ synthesis step configuration not found"}
        
        user_research_insights = f"""
Problem Validation Key Findings:
{step_data.get('problem_validation', '')[:500]}...

Concept Validation Key Findings:
{step_data.get('concept_validation', '')[:500]}...
"""
        
        formatted_prompt = step["user_prompt"].format(
            market_research=step_data.get('market_research', ''),
            refined_press_release=input_text,
            external_faq=step_data.get('external_faq', ''),
            internal_faq=step_data.get('internal_faq', ''),
            user_research_insights=user_research_insights
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _handle_mlp_with_research_context(self, input_text, step_data, progress_callback=None, request_id=None):
        """Handle MLP plan with research context for prioritization"""
        step_id_for_log = 10
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Handling MLP plan with research context ({step_id_for_log})")
        
        step = next((s for s in self.steps if s["id"] == step_id_for_log), None)
        if not step:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] MLP plan step configuration not found")
            return {"error": "MLP plan step configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(input=input_text)
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id_for_log, request_id)

    def _call_claude_api(self, step, formatted_prompt, progress_callback, step_id, request_id=None):
        """Shared Claude API call logic for all Claude-based steps"""
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Calling Claude API for step {step_id}")
        step_name_for_info = step.get("name", f"UnknownStep{step_id}")
        
        system_prompt = step["system_prompt"]
        logger.debug(f"[{request_id or 'NO_REQ_ID'}] System prompt length: {len(system_prompt)}")
        logger.debug(f"[{request_id or 'NO_REQ_ID'}] User prompt length: {len(formatted_prompt)}")
        
        result = self.claude_processor.generate_response(
            system_prompt=system_prompt,
            user_prompt=formatted_prompt,
            progress_callback=progress_callback,
            step_id=step_id,
            request_id=request_id,
            step_info=f"step_{step_id}_{step_name_for_info}"
        )
        
        if "error" in result:
            return result
        
        output = result["output"]
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Step {step_id} response received - length: {len(output)} characters")
        
        # Apply FAQ formatting fix for steps 5, 8, 9 (Internal FAQ, External FAQ, PRFAQ Synthesis)
        if step_id in [5, 8, 9] and output:
            try:
                import re
                
                # Track if we made changes
                original_output = output
                
                # Fix FAQ formatting issues:
                # 1. Remove excessive line breaks around **Question:** and **Answer:**
                # 2. Ensure consistent spacing
                
                # Pattern 1: Fix **Question:** followed by excessive line breaks
                output = re.sub(r'\*\*Question:\*\*\s*\n+\s*', '**Question:** ', output)
                
                # Pattern 2: Fix **Answer:** followed by excessive line breaks  
                output = re.sub(r'\*\*Answer:\*\*\s*\n+\s*', '**Answer:** ', output)
                
                # Pattern 3: Clean up multiple consecutive empty lines (keep max 2)
                output = re.sub(r'\n\s*\n\s*\n+', '\n\n', output)
                
                # Pattern 4: Fix spacing before **Answer:** (ensure proper indentation)
                output = re.sub(r'\n\s*\*\*Answer:\*\*', '\n   **Answer:**', output)
                
                # Log if we made changes
                if output != original_output:
                    logger.info(f"[{request_id or 'NO_REQ_ID'}] Applied FAQ formatting fixes to step {step_id}")
                
            except Exception as e:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] FAQ formatting fix failed for step {step_id}: {e}")
                # Continue with original output - don't break the pipeline
                output = original_output
        
        self.step_outputs[step_id] = output
        
        # NEW: Fire-and-forget insight extraction
        self._trigger_insight_extraction(step_id, output, progress_callback, request_id)
        
        return {
            "output": output,
            "step": step["name"],
            "persona": step["persona"],
            "description": step["description"]
        }

    def process_all_steps(self, product_idea, progress_callback=None, request_id=None):
        """
        Process a product idea through all steps of the Working Backwards methodology.
        
        Args:
            product_idea: The product idea to process
            progress_callback: Optional callback function to report progress
            request_id: Optional request ID for logging and caching raw output
            
        Returns:
            Dictionary containing results from all steps or error information
        """
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Starting complete Working Backwards process with enhanced research")
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Product idea: {product_idea[:100]}...")
        
        # Protected progress callback wrapper
        def safe_callback(update):
            if progress_callback:
                try:
                    progress_callback(update)
                except Exception as e:
                    logger.error(f"[{request_id or 'NO_REQ_ID'}] Progress callback failed in process_all_steps: {e}")
                    # Don't re-raise to avoid killing the processing thread
        
        try:
            self.step_outputs = {}
            
            # Send workflow start log
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '🚀 Starting 10-step Working Backwards process',
                'request_id': request_id
            })
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 1: Market Research & Analysis ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 1/10: Market Research & Analysis',
                'request_id': request_id
            })
            step1_result = self.generate_step_response(1, product_idea, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step1_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 1 failed: {step1_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 1 failed: {step1_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step1_result['error'], 'step': 1}
            
            market_research = step1_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 2: Problem Validation Research ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 2/10: Problem Validation Research',
                'request_id': request_id
            })
            step_data = {'market_research': market_research}
            step2_result = self.generate_step_response(2, product_idea, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step2_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 2 failed: {step2_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 2 failed: {step2_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step2_result['error'], 'step': 2}
            
            problem_validation = step2_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 3: Draft Press Release ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 3/10: Draft Press Release',
                'request_id': request_id
            })
            step_data['problem_validation'] = problem_validation
            step3_result = self.generate_step_response(3, product_idea, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step3_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 3 failed: {step3_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 3 failed: {step3_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step3_result['error'], 'step': 3}
            
            press_release_draft = step3_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 4: Refine Press Release ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 4/10: Refine Press Release',
                'request_id': request_id
            })
            step4_result = self.generate_step_response(4, press_release_draft, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step4_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 4 failed: {step4_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 4 failed: {step4_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step4_result['error'], 'step': 4}
            
            refined_press_release = step4_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 5: Internal FAQ ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 5/10: Internal FAQ',
                'request_id': request_id
            })
            step5_result = self.generate_step_response(5, refined_press_release, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step5_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 5 failed: {step5_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 5 failed: {step5_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step5_result['error'], 'step': 5}
            
            internal_faq = step5_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 6: Concept Validation Research ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 6/10: Concept Validation Research',
                'request_id': request_id
            })
            step_data['internal_faq'] = internal_faq
            step6_result = self.generate_step_response(6, refined_press_release, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step6_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 6 failed: {step6_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 6 failed: {step6_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step6_result['error'], 'step': 6}
            
            concept_validation = step6_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 7: Solution Refinement ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 7/10: Solution Refinement',
                'request_id': request_id
            })
            step_data['concept_validation'] = concept_validation
            step7_result = self.generate_step_response(7, refined_press_release, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step7_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 7 failed: {step7_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 7 failed: {step7_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step7_result['error'], 'step': 7}
            
            solution_refined_pr = step7_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 8: External FAQ ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 8/10: External FAQ',
                'request_id': request_id
            })
            step8_result = self.generate_step_response(8, solution_refined_pr, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step8_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 8 failed: {step8_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 8 failed: {step8_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step8_result['error'], 'step': 8}
            
            external_faq = step8_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 9: Synthesize PRFAQ ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 9/10: Synthesize PRFAQ',
                'request_id': request_id
            })
            step_data['external_faq'] = external_faq
            step_data['refined_press_release'] = solution_refined_pr
            step9_result = self.generate_step_response(9, solution_refined_pr, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step9_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 9 failed: {step9_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 9 failed: {step9_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step9_result['error'], 'step': 9}
            
            prfaq_document = step9_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 10: MLP Plan ---")
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '📊 Step 10/10: MLP Plan',
                'request_id': request_id
            })
            step10_result = self.generate_step_response(10, prfaq_document, step_data, progress_callback=safe_callback, request_id=request_id)
            
            if 'error' in step10_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 10 failed: {step10_result['error']}")
                safe_callback({
                    'type': 'log',
                    'level': 'error',
                    'message': f'❌ Step 10 failed: {step10_result["error"]}',
                    'request_id': request_id
                })
                return {'error': step10_result['error'], 'step': 10}
            
            mlp_plan = step10_result['output']
            
            # Wait for step 10 insight extraction before completion
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Step 10 completed, waiting for insight extraction...")
            self._wait_for_step_10_insight(request_id, timeout_seconds=2)
            
            results = {
                'prfaq': prfaq_document,
                'mlp_plan': mlp_plan,
                'steps': [
                    {'id': 1, 'name': 'Market Research & Analysis', 'output': market_research},
                    {'id': 2, 'name': 'Problem Validation Research', 'output': problem_validation},
                    {'id': 3, 'name': 'Draft Press Release', 'output': press_release_draft},
                    {'id': 4, 'name': 'Refined Press Release', 'output': refined_press_release},
                    {'id': 5, 'name': 'Internal FAQ', 'output': internal_faq},
                    {'id': 6, 'name': 'Concept Validation Research', 'output': concept_validation},
                    {'id': 7, 'name': 'Solution Refinement', 'output': solution_refined_pr},
                    {'id': 8, 'name': 'External FAQ', 'output': external_faq},
                    {'id': 9, 'name': 'PRFAQ Document', 'output': prfaq_document},
                    {'id': 10, 'name': 'MLP Plan', 'output': mlp_plan}
                ]
            }
            
            safe_callback({
                'type': 'log',
                'level': 'info',
                'message': '🎉 All 10 steps completed successfully',
                'request_id': request_id
            })
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Complete Working Backwards process completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Error in process_all_steps: {str(e)}")
            logger.exception("Full error traceback:")
            safe_callback({
                'type': 'log',
                'level': 'error',
                'message': f'💥 Workflow failed: {str(e)}',
                'request_id': request_id
            })
            return {"error": f"Processing failed: {str(e)}"}

    def analyze_product_idea(self, product_idea, request_id=None):
        """Analyze a product idea using the Product Analysis step configuration"""
        step_id_for_log = 0
        step_name_for_info = PRODUCT_ANALYSIS_STEP.get("name", "ProductAnalysis")
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Starting product analysis (Step {step_id_for_log})")
        
        try:
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=PRODUCT_ANALYSIS_STEP["initial_prompt"].format(input=product_idea),
                progress_callback=None,
                step_id=step_id_for_log,
                request_id=request_id,
                step_info=f"step_{step_id_for_log}_{step_name_for_info}"
            )
            
            if "error" in result:
                return result
            
            return {
                "analysis": result["output"],
                "step": PRODUCT_ANALYSIS_STEP["name"],
                "persona": PRODUCT_ANALYSIS_STEP["persona"]
            }
            
        except Exception as e:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Product analysis failed: {str(e)}")
            return {"error": f"Analysis failed: {str(e)}"}

    def refine_product_analysis(self, original_input, current_analysis, feedback, request_id=None):
        """Refine product analysis based on user feedback"""
        step_id_for_log = 0
        step_name_for_info = PRODUCT_ANALYSIS_STEP.get("name", "ProductAnalysisRefinement")
        logger.info(f"[{request_id or 'NO_REQ_ID'}] Refining product analysis (Step {step_id_for_log})")
        
        try:
            refinement_prompt = PRODUCT_ANALYSIS_STEP["refinement_prompt"].format(
                original_input=original_input,
                current_analysis=current_analysis,
                customer_feedback=feedback.get('customer', ''),
                problem_feedback=feedback.get('problem', ''),
                scope_feedback=feedback.get('scope', '')
            )
            
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=refinement_prompt,
                progress_callback=None,
                step_id=step_id_for_log,
                request_id=request_id,
                step_info=f"step_{step_id_for_log}_{step_name_for_info}"
            )
            
            if "error" in result:
                return result
            
            return {
                "analysis": result["output"],
                "step": PRODUCT_ANALYSIS_STEP["name"],
                "persona": PRODUCT_ANALYSIS_STEP["persona"]
            }
            
        except Exception as e:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Analysis refinement failed: {str(e)}")
            return {"error": f"Refinement failed: {str(e)}"}

    def create_enriched_product_brief(self, original_idea, analysis):
        """Create an enriched product brief combining original idea with analysis insights"""
        logger.info("Creating enriched product brief")
        
        try:
            # Simple combination approach - could be enhanced with Claude if needed
            enriched_brief = f"""Product Concept: {original_idea}

Strategic Analysis:
{analysis}

This enriched brief combines the original product idea with strategic insights to guide the Working Backwards process."""
            
            return enriched_brief
            
        except Exception as e:
            # If enrichment fails, fall back to original idea
            result = self.claude_processor.generate_response(
                system_prompt="You are a product strategist. Create a comprehensive product brief.",
                user_prompt=f"Original idea: {original_idea}\n\nAnalysis: {analysis}\n\nCombine these into a comprehensive product brief.",
                progress_callback=None,
                step_id=0
            )
            
            if "error" in result:
                logger.error(f"Failed to create enriched brief: {result['error']}")
                return original_idea  # Fallback to original
            
            return result["output"]
            
        except Exception as e:
            logger.error(f"Failed to create enriched brief: {str(e)}")
            return original_idea  # Fallback to original

    def _wait_for_step_10_insight(self, request_id, timeout_seconds=5):
        """Wait for step 10 insight to complete with timeout"""
        import time
        start_time = time.time()
        
        if not request_id:
            logger.warning("No request_id provided for step 10 insight wait")
            return False
            
        logger.info(f"[{request_id}] Waiting for step 10 insight extraction (timeout: {timeout_seconds}s)...")
        
        while time.time() - start_time < timeout_seconds:
            # Check if insight has been stored in cache
            try:
                cached_insights = get_insights(request_id)
                if cached_insights and 10 in cached_insights:
                    elapsed = time.time() - start_time
                    logger.info(f"[{request_id}] Step 10 insight found in cache after {elapsed:.1f}s")
                    return True
            except Exception as e:
                logger.error(f"[{request_id}] Error checking for step 10 insight in cache: {e}")
                break
                
            time.sleep(0.5)  # Check every 500ms
        
        elapsed = time.time() - start_time
        logger.warning(f"[{request_id}] Step 10 insight not found after {elapsed:.1f}s timeout - will rely on late retrieval")
        return False

    def _trigger_insight_extraction(self, step_id, output, progress_callback, request_id=None):
        """
        Trigger insight extraction for any step in a background thread.
        This method is used by both Claude-based steps and Perplexity-based Step 1.
        """
        def extract_async():
            logger.info(f"[INSIGHT THREAD - Step {step_id}] Thread started.")
            try:
                insight = None
                label = None
                logger.debug(f"[INSIGHT THREAD - Step {step_id}] Initial check: isolated Claude client available: {self.insight_claude_client is not None}")
                
                if step_id == 4:  # PR Refinement
                    draft_pr = self.step_outputs.get(3, "")
                    logger.debug(f"[INSIGHT THREAD - Step {step_id}] Comparative insight for step 4. Draft PR (len: {len(draft_pr)}): '{draft_pr[:50]}...'")
                    if draft_pr:
                        insight = self._extract_comparative_insight(
                            step_id=4,
                            before_content=draft_pr,
                            after_content=output,
                            prompt_template="Compare these press releases. What's the most important strategic improvement made? Focus on positioning, messaging, or differentiation changes.\\n\\nDraft: {before}\\n\\nRefined: {after}"
                        )
                        label = "Refined:"
                    else:
                        logger.warning(f"[INSIGHT THREAD - Step {step_id}] Draft PR for step 4 not found, falling back to single content extraction.")
                        insight = self._extract_key_insight(step_id, output)
                        label = "Key change:"
                        
                elif step_id == 7:  # Solution Refinement
                    validation_feedback = self.step_outputs.get(6, "")
                    logger.debug(f"[INSIGHT THREAD - Step {step_id}] Comparative insight for step 7. Validation feedback (len: {len(validation_feedback)}): '{validation_feedback[:50]}...'")
                    if validation_feedback:
                        insight = self._extract_comparative_insight(
                            step_id=7,
                            before_content=validation_feedback,
                            after_content=output,
                            prompt_template="Given this user feedback, what specific change was made to the solution? Focus on what was added or modified to address user concerns.\\n\\nUser feedback themes: {before}\\n\\nRefined solution: {after}"
                        )
                        label = "Added:"
                    else:
                        logger.warning(f"[INSIGHT THREAD - Step {step_id}] Validation feedback for step 7 not found, falling back to single content extraction.")
                        insight = self._extract_key_insight(step_id, output)
                        label = "Refined:"
                        
                else:
                    logger.debug(f"[INSIGHT THREAD - Step {step_id}] Standard insight: calling _extract_key_insight.")
                    insight = self._extract_key_insight(step_id, output)
                    label = self._get_insight_label(step_id)
                
                logger.info(f"[INSIGHT THREAD - Step {step_id}] Insight generation attempt completed. Insight: '{str(insight)[:50]}...', Label: {label}")
                
                # Always store insight in cache, regardless of progress_callback status
                if insight and request_id:
                    logger.info(f"[INSIGHT THREAD - Step {step_id}] Storing insight in cache for potential late retrieval")
                    store_insight(request_id, step_id, insight, label)
                
                if insight and progress_callback:
                    logger.info(f"[INSIGHT THREAD - Step {step_id}] Insight is valid. Sending to frontend via progress_callback.")
                    progress_callback({
                        "step": step_id,
                        "keyInsight": insight,
                        "insightLabel": label
                    })
                elif not insight:
                    logger.warning(f"[INSIGHT THREAD - Step {step_id}] Insight was None or empty, not sending to frontend.")
                elif not progress_callback:
                    logger.warning(f"[INSIGHT THREAD - Step {step_id}] Progress_callback was None, cannot send insight.")

            except Exception as e:
                logger.error(f"[INSIGHT THREAD - Step {step_id}] Insight extraction thread failed: {e}", exc_info=True)
                pass  # Silent fail (as per original plan for non-blocking)
            finally:
                logger.info(f"[INSIGHT THREAD - Step {step_id}] Thread finished.")

        threading.Thread(target=extract_async, daemon=True).start()

    def _get_insight_label(self, step_id):
        """Get the appropriate label for each step's insight"""
        labels = {
            1: "Insight:",  # Market research insight
            2: "Pain:",
            3: "Headline:",
            4: "Refined:",
            5: "Risk:",
            6: "Finding:",
            7: "Change:",
            8: "Top Q:",
            9: "Thesis:",
            10: "Must nail:"
        }
        return labels.get(step_id)

    def _extract_key_insight(self, step_id, output):
        logger.info(f"[_extract_key_insight - Step {step_id}] Method called. Output length: {len(output)}. Using isolated Claude client: {self.insight_claude_client is not None}")
        
        # Check if isolated Claude client is available
        if not self.insight_claude_client:
            logger.warning(f"[_extract_key_insight - Step {step_id}] Isolated Claude client not initialized - skipping insight extraction")
            return None
        
        insight_prompts = {
            1: "What is the primary finding from this research? One sentence.",
            2: "What issue appears most frequently? One sentence.",
            3: "What is the main headline or title from this document? (keep as is)",
            4: "What change or improvement is emphasized? One sentence.",
            5: "What risk is raised most? One sentence.",
            6: "What reaction pattern appears repeatedly? One sentence.",
            7: "What change or modification is described? One sentence.",
            8: "What is the first question in this content? (repeat exactly as is; no preface or explanation)?",
            9: "What is the core value proposition presented? One sentence.",
            10: "Which hypothesis is identified as most critical to validate? One sentence"
        }
        
        prompt = insight_prompts.get(step_id, "Summarize the key finding in one concise sentence.")
        
        try:
            # Create Claude-format prompt
            user_prompt = f"""Thoroughly review the following content and extract the most important insight. Respond with exactly one clear, concise sentence. No quotes around the response. Write with maximum economy. Use only essential words. No adjectives, adverbs, or qualifiers unless absolutely necessary for clarity.

Task: {prompt}

Content to analyze:
{output}"""
            
            logger.info(f"[_extract_key_insight - Step {step_id}] Attempting isolated Claude API call with model: {self.insight_claude_model}")
            logger.debug(f"[_extract_key_insight - Step {step_id}] Prompt task: '{prompt[:100]}...'")
            
            # Call isolated Claude client
            response = self.insight_claude_client.messages.create(
                model=self.insight_claude_model,
                max_tokens=60,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )
            
            logger.info(f"[_extract_key_insight - Step {step_id}] Isolated Claude API call completed successfully")
            
            # Extract content from response
            if response.content and len(response.content) > 0:
                insight_text = response.content[0].text.strip()
                logger.info(f"[_extract_key_insight - Step {step_id}] Insight extracted (first 50 chars): '{insight_text[:50]}...'")
                
                if insight_text:
                    # Clean up any quotes that might have been added
                    clean_insight = insight_text.strip().strip('"').strip("'")
                    logger.debug(f"[_extract_key_insight - Step {step_id}] Cleaned insight: '{clean_insight[:50]}...'")
                    return clean_insight
                else:
                    logger.warning(f"[_extract_key_insight - Step {step_id}] Empty insight text received from Claude")
                    return None
            else:
                logger.warning(f"[_extract_key_insight - Step {step_id}] No content in Claude response")
                return None
                
        except Exception as e:
            logger.error(f"[_extract_key_insight - Step {step_id}] Failed during isolated Claude API call or processing: {e}", exc_info=True)
            return None

    def _extract_comparative_insight(self, step_id, before_content, after_content, prompt_template):
        logger.info(f"[_extract_comparative_insight - Step {step_id}] Method called. Before length: {len(before_content)}, After length: {len(after_content)}. Using isolated Claude client: {self.insight_claude_client is not None}")
        
        # Check if isolated Claude client is available
        if not self.insight_claude_client:
            logger.warning(f"[_extract_comparative_insight - Step {step_id}] Isolated Claude client not initialized - skipping comparative insight extraction")
            return None

        try:
            # Format the comparison prompt using the template
            comparison_prompt = prompt_template.format(
                before=before_content, 
                after=after_content 
            )
            
            # Create Claude-format prompt for comparison
            user_prompt = f"""Compare the content and extract a key insight. Respond with exactly one clear, concise sentence. No quotes around the response.

{comparison_prompt}"""
            
            logger.info(f"[_extract_comparative_insight - Step {step_id}] Attempting isolated Claude API call with model: {self.insight_claude_model}")
            logger.debug(f"[_extract_comparative_insight - Step {step_id}] Using prompt template for comparison analysis")
            
            # Call isolated Claude client
            response = self.insight_claude_client.messages.create(
                model=self.insight_claude_model,
                max_tokens=60,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )

            logger.info(f"[_extract_comparative_insight - Step {step_id}] Isolated Claude API call completed successfully")

            # Extract content from response
            if response.content and len(response.content) > 0:
                insight_text = response.content[0].text.strip()
                logger.info(f"[_extract_comparative_insight - Step {step_id}] Comparative insight extracted (first 50 chars): '{insight_text[:50]}...'")
                
                if insight_text:
                    # Clean up any quotes that might have been added
                    clean_insight = insight_text.strip().strip('"').strip("'")
                    logger.debug(f"[_extract_comparative_insight - Step {step_id}] Cleaned comparative insight: '{clean_insight[:50]}...'")
                    return clean_insight
                else:
                    logger.warning(f"[_extract_comparative_insight - Step {step_id}] Empty insight text received from Claude")
                    return None
            else:
                logger.warning(f"[_extract_comparative_insight - Step {step_id}] No content in Claude response")
                return None
                
        except Exception as e:
            logger.error(f"[_extract_comparative_insight - Step {step_id}] Failed during isolated Claude API call or processing: {e}", exc_info=True)
            return None
