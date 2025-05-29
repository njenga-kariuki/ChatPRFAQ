import logging
import threading
import google.generativeai as genai
# import google.generativeai as genai  # Kept for potential future use
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS, PRODUCT_ANALYSIS_STEP, GEMINI_API_KEY, GEMINI_FLASH_MODEL
from .perplexity_processor import PerplexityProcessor
from .claude_processor import ClaudeProcessor
# REMOVE: store_raw_llm_output is now imported and used by individual processors (claude, perplexity)
# from routes import store_raw_llm_output 

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
            market_research=step_data['market_research']
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
                market_research=step_data['market_research']
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
        
        self.step_outputs[step_id] = output
        
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
        
        try:
            self.step_outputs = {}
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 1: Market Research & Analysis ---")
            step1_result = self.generate_step_response(1, product_idea, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step1_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 1 failed: {step1_result['error']}")
                return {'error': step1_result['error'], 'step': 1}
            
            market_research = step1_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 2: Problem Validation Research ---")
            step_data = {'market_research': market_research}
            step2_result = self.generate_step_response(2, product_idea, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step2_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 2 failed: {step2_result['error']}")
                return {'error': step2_result['error'], 'step': 2}
            
            problem_validation = step2_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 3: Draft Press Release ---")
            step_data['problem_validation'] = problem_validation
            step3_result = self.generate_step_response(3, product_idea, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step3_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 3 failed: {step3_result['error']}")
                return {'error': step3_result['error'], 'step': 3}
            
            press_release_draft = step3_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 4: Refine Press Release ---")
            step4_result = self.generate_step_response(4, press_release_draft, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step4_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 4 failed: {step4_result['error']}")
                return {'error': step4_result['error'], 'step': 4}
            
            refined_press_release = step4_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 5: Internal FAQ ---")
            step5_result = self.generate_step_response(5, refined_press_release, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step5_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 5 failed: {step5_result['error']}")
                return {'error': step5_result['error'], 'step': 5}
            
            internal_faq = step5_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 6: Concept Validation Research ---")
            step_data['internal_faq'] = internal_faq
            step6_result = self.generate_step_response(6, refined_press_release, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step6_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 6 failed: {step6_result['error']}")
                return {'error': step6_result['error'], 'step': 6}
            
            concept_validation = step6_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 7: Solution Refinement ---")
            step_data['concept_validation'] = concept_validation
            step7_result = self.generate_step_response(7, refined_press_release, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step7_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 7 failed: {step7_result['error']}")
                return {'error': step7_result['error'], 'step': 7}
            
            solution_refined_pr = step7_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 8: External FAQ ---")
            step8_result = self.generate_step_response(8, solution_refined_pr, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step8_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 8 failed: {step8_result['error']}")
                return {'error': step8_result['error'], 'step': 8}
            
            external_faq = step8_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 9: Synthesize PRFAQ ---")
            step_data['external_faq'] = external_faq
            step_data['refined_press_release'] = solution_refined_pr
            step9_result = self.generate_step_response(9, solution_refined_pr, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step9_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 9 failed: {step9_result['error']}")
                return {'error': step9_result['error'], 'step': 9}
            
            prfaq_document = step9_result['output']
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] --- Processing Step 10: MLP Plan ---")
            step10_result = self.generate_step_response(10, prfaq_document, step_data, progress_callback=progress_callback, request_id=request_id)
            
            if 'error' in step10_result:
                logger.error(f"[{request_id or 'NO_REQ_ID'}] Step 10 failed: {step10_result['error']}")
                return {'error': step10_result['error'], 'step': 10}
            
            mlp_plan = step10_result['output']
            
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
            
            logger.info(f"[{request_id or 'NO_REQ_ID'}] Complete Working Backwards process completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"[{request_id or 'NO_REQ_ID'}] Error in process_all_steps: {str(e)}")
            logger.exception("Full error traceback:")
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

    def _get_insight_label(self, step_id):
        """Get the appropriate label for each step's insight"""
        labels = {
            1: None,  # No label for market research
            2: "Pain:",
            3: "Headline:",
            4: "Refined:",
            5: "Risk:",
            6: "Users:",
            7: "Added:",
            8: "Top Q:",
            9: "Thesis:",
            10: "Must nail:"
        }
        return labels.get(step_id)

    def _extract_key_insight(self, step_id, output):
        """Extract a one-line insight from step output using Gemini Flash"""
        
        if not self.gemini_flash_model:
            logger.warning("Gemini Flash not initialized - skipping insight extraction")
            return None
        
        insight_prompts = {
            1: "What's the single most important market insight that would make a PM lean forward in their chair? Focus on opportunity size, competitive gaps, or surprising user behavior. Be specific with numbers if mentioned.",
            2: "What specific customer struggle or behavior pattern was most consistently validated across participants? Include frequency or intensity if mentioned.",
            3: "Extract the exact headline from this press release. If there's no clear headline, create one that captures the core product announcement.",
            4: "In one sentence, what's the most important improvement made? Focus on strategic positioning, clarity, or differentiation changes.",
            5: "Across all internal FAQs, what's the most critical business, technical, or strategic concern raised? Be specific about the risk or challenge.",
            6: "What specific feature or aspect of the concept generated the strongest user reaction (positive or negative)? Include the split if mentioned (e.g., '8/10 loved X').",
            7: "Based on user feedback, what's the most significant change made to the solution? Be specific about what was added, removed, or modified.",
            8: "What's the most important customer question answered in this FAQ? Choose the one that addresses the biggest adoption concern or clarifies the core value.",
            9: "In one sentence, what's the strategic thesis of this PRFAQ? Focus on market opportunity + our unique approach.",
            10: "What's the single most important capability or feature that defines the MLP? What must work perfectly on day one?"
        }
        
        prompt = insight_prompts.get(step_id, "Summarize the key finding in one sentence.")
        
        try:
            # Prepare the full prompt for Gemini
            full_prompt = f"""You are an expert at extracting key insights. Respond with exactly one clear, concise sentence. No quotes around the response.

{prompt}

Content to analyze:
{output}""" # NO TRUNCATION
            
            # Generate with Gemini Flash
            response = self.gemini_flash_model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=100,
                    temperature=0.5,
                )
            )
            
            if response.text:
                return response.text.strip().strip('"')
            else:
                logger.warning(f"Empty response from Gemini for step {step_id}")
                return None
                
        except Exception as e:
            logger.warning(f"Failed to extract insight for step {step_id}: {e}")
            return None

    def _extract_comparative_insight(self, step_id, before_content, after_content, prompt_template):
        """Extract insights that need before/after comparison using Gemini Flash"""
        
        if not self.gemini_flash_model:
            logger.warning("Gemini Flash not initialized - skipping comparative insight extraction")
            return None
        
        try:
            prompt = prompt_template.format(
                before=before_content, # NO TRUNCATION
                after=after_content # NO TRUNCATION
            )
            
            full_prompt = f"""You are an expert at identifying key changes and improvements. Respond with exactly one clear, concise sentence. No quotes around the response.

{prompt}"""
            
            response = self.gemini_flash_model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=60,
                    temperature=0,
                )
            )
            
            if response.text:
                return response.text.strip().strip('"')
            else:
                logger.warning(f"Empty comparative response from Gemini for step {step_id}")
                return None
                
        except Exception as e:
            logger.warning(f"Failed to extract comparative insight for step {step_id}: {e}")
            return None
