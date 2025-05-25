import logging
# import google.generativeai as genai  # Kept for potential future use
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS, PRODUCT_ANALYSIS_STEP
from perplexity_processor import PerplexityProcessor
from claude_processor import ClaudeProcessor

# Get logger for this module
logger = logging.getLogger(__name__)

# Configure Google Generative AI with API key
logger.info(f"Configuring Claude API with model: {CLAUDE_MODEL}")
logger.info(f"API Key configured: {'Yes' if ANTHROPIC_API_KEY else 'No'}")
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
            
    def generate_step_response(self, step_id, input_text, step_data=None, progress_callback=None):
        """
        Generate a response from the LLM for a specific step in the Working Backwards process.
        
        Args:
            step_id: The ID of the step to process
            input_text: The input text from the previous step or user
            step_data: Additional data needed for multi-input steps
            progress_callback: Optional callback function to report progress
            
        Returns:
            The generated response from the LLM
        """
        logger.info(f"Starting step {step_id}")
        logger.debug(f"Input text length: {len(input_text) if input_text else 0}")
        logger.debug(f"Step data provided: {step_data is not None}")
        
        try:
            # Handle different step types based on their requirements
            if step_id == 1:
                # Initial market research step
                return self._handle_initial_market_research(input_text, progress_callback)
            elif step_id == 2:
                # Press release drafting with market research
                return self._handle_press_release_with_research(input_text, step_data, progress_callback)
            elif step_id in [3, 4, 5]:
                # Steps that need market research context
                return self._handle_step_with_market_research(step_id, input_text, step_data, progress_callback)
            elif step_id == 6:
                # PRFAQ synthesis step
                return self._handle_prfaq_synthesis(input_text, step_data, progress_callback)
            elif step_id == 7:
                # Standard step (MLP Plan)
                return self._handle_standard_step(step_id, input_text, progress_callback)
            else:
                return {"error": f"Unknown step ID: {step_id}"}
                
        except Exception as e:
            logger.error(f"Step {step_id} failed | Error: {type(e).__name__}: {str(e)}")
            logger.error(f"Step {step_id} context | input_length: {len(input_text) if input_text else 0}, step_data: {step_data is not None}")
            logger.exception("Full error traceback:")
            return {
                "error": f"Step {step_id} failed: {str(e)}",
                "step": step_id
            }

    def _handle_initial_market_research(self, product_idea, progress_callback=None):
        """Handle initial market research step using Perplexity"""
        logger.info("Handling initial market research step")
        
        # Get the market research step configuration
        research_step = next((s for s in self.steps if s["id"] == 1), None)
        if not research_step:
            logger.error("Initial research step configuration not found")
            return {"error": "Market research step configuration not found"}
        
        # Use Perplexity processor for market research
        result = self.perplexity_processor.conduct_initial_market_research(
            product_idea=product_idea,
            system_prompt=research_step["system_prompt"],
            user_prompt=research_step["user_prompt"],
            progress_callback=progress_callback
        )
        
        return result

    def _handle_press_release_with_research(self, product_idea, step_data, progress_callback=None):
        """Handle press release drafting with market research input"""
        logger.info("Handling press release with research")
        
        step = next((s for s in self.steps if s["id"] == 2), None)
        if not step:
            return {"error": "Press release step configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error("Step 2: No step_data provided")
            return {"error": "Market research data required for press release step"}
        elif 'market_research' not in step_data:
            logger.error(f"Step 2: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": "Market research data required for press release step"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        logger.info(f"Step 2: Market research data available ({market_research_length} chars)")
        
        # Format prompt with both product idea and market research
        formatted_prompt = step["user_prompt"].format(
            product_idea=product_idea,
            market_research=step_data['market_research']
        )
        
        # Use existing Claude processing logic
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=2)

    def _handle_step_with_market_research(self, step_id, input_text, step_data, progress_callback=None):
        """Handle steps that need both input text and market research context"""
        logger.info(f"Handling step {step_id} with market research")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            return {"error": f"Step {step_id} configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error(f"Step {step_id}: No step_data provided")
            return {"error": "Market research data required for this step"}
        elif 'market_research' not in step_data:
            logger.error(f"Step {step_id}: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": "Market research data required for this step"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        input_length = len(input_text) if input_text else 0
        logger.info(f"Step {step_id}: Market research data available ({market_research_length} chars), input text ({input_length} chars)")
        
        # Format prompt with input text and market research
        formatted_prompt = step["user_prompt"].format(
            input=input_text,
            market_research=step_data['market_research']
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id)

    def _handle_prfaq_synthesis(self, input_text, step_data, progress_callback=None):
        """Handle PRFAQ synthesis step with all previous outputs"""
        logger.info("Handling PRFAQ synthesis with research")
        
        step = next((s for s in self.steps if s["id"] == 6), None)
        if not step:
            return {"error": "PRFAQ synthesis step configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error("Step 6: No step_data provided")
            return {"error": "Previous step outputs required for PRFAQ synthesis"}
        
        # Extract required data
        market_research = step_data.get('market_research', '')
        refined_press_release = step_data.get('refined_press_release', '')
        external_faq = step_data.get('external_faq', '')
        internal_faq = step_data.get('internal_faq', '')
        
        # Critical data flow tracking
        market_research_length = len(market_research)
        logger.info(f"Step 6: Synthesizing PRFAQ with market_research ({market_research_length} chars), "
                   f"refined_press_release ({len(refined_press_release)} chars), "
                   f"external_faq ({len(external_faq)} chars), "
                   f"internal_faq ({len(internal_faq)} chars)")
        
        # Format prompt with all required inputs
        formatted_prompt = step["user_prompt"].format(
            market_research=market_research,
            refined_press_release=refined_press_release,
            external_faq=external_faq,
            internal_faq=internal_faq
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=6)

    def _handle_standard_step(self, step_id, input_text, progress_callback=None):
        """Handle standard steps that only need single input"""
        logger.info(f"Handling standard step {step_id}")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            return {"error": f"Step {step_id} configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(input=input_text)
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id)

    def _call_claude_api(self, step, formatted_prompt, progress_callback, step_id):
        """Shared Claude API call logic for all Claude-based steps"""
        logger.info(f"Calling Claude API for step {step_id}")
        
        # Prepare the prompt
        system_prompt = step["system_prompt"]
        logger.debug(f"System prompt length: {len(system_prompt)}")
        logger.debug(f"User prompt length: {len(formatted_prompt)}")
        
        # Call the Claude API through the processor
        result = self.claude_processor.generate_response(
            system_prompt=system_prompt,
            user_prompt=formatted_prompt,
            progress_callback=progress_callback,
            step_id=step_id
        )
        
        # Check if the call was successful
        if "error" in result:
            return result
        
        output = result["output"]
        logger.info(f"Step {step_id} response received - length: {len(output)} characters")
        
        # Store the output for this step
        self.step_outputs[step_id] = output
        
        # Note: Progress callback completion message is handled by claude_processor
        
        return {
            "output": output,
            "step": step["name"],
            "persona": step["persona"],
            "description": step["description"]
        }

    def process_all_steps(self, product_idea, progress_callback=None):
        """
        Process a product idea through all steps of the Working Backwards methodology.
        
        Args:
            product_idea: The product idea to process
            progress_callback: Optional callback function to report progress
            
        Returns:
            Dictionary containing results from all steps or error information
        """
        logger.info("Starting complete Working Backwards process with market research")
        logger.info(f"Product idea: {product_idea[:100]}...")
        
        try:
            # Clear any previous outputs
            self.step_outputs = {}
            
            # Step 1: Market Research & Analysis
            logger.info("--- Processing Step 1: Market Research & Analysis ---")
            step1_result = self.generate_step_response(1, product_idea, progress_callback=progress_callback)
            
            if 'error' in step1_result:
                logger.error(f"Step 1 failed: {step1_result['error']}")
                return {
                    'error': step1_result['error'],
                    'step': 1
                }
            
            market_research = step1_result['output']
            
            # Prepare step data for subsequent steps
            step_data = {
                'market_research': market_research
            }
            
            # Step 2: Draft Press Release
            logger.info("--- Processing Step 2: Draft Press Release ---")
            step2_result = self.generate_step_response(2, product_idea, step_data, progress_callback)
            
            if 'error' in step2_result:
                logger.error(f"Step 2 failed: {step2_result['error']}")
                return {
                    'error': step2_result['error'],
                    'step': 2
                }
            
            press_release_draft = step2_result['output']
            
            # Step 3: Refine Press Release
            logger.info("--- Processing Step 3: Refine Press Release ---")
            step3_result = self.generate_step_response(3, press_release_draft, step_data, progress_callback)
            
            if 'error' in step3_result:
                logger.error(f"Step 3 failed: {step3_result['error']}")
                return {
                    'error': step3_result['error'],
                    'step': 3
                }
            
            refined_press_release = step3_result['output']
            
            # Update step_data with refined press release
            step_data['refined_press_release'] = refined_press_release
            
            # Step 4: External FAQ
            logger.info("--- Processing Step 4: External FAQ ---")
            step4_result = self.generate_step_response(4, refined_press_release, step_data, progress_callback)
            
            if 'error' in step4_result:
                logger.error(f"Step 4 failed: {step4_result['error']}")
                return {
                    'error': step4_result['error'],
                    'step': 4
                }
            
            external_faq = step4_result['output']
            
            # Step 5: Internal FAQ
            logger.info("--- Processing Step 5: Internal FAQ ---")
            step5_result = self.generate_step_response(5, refined_press_release, step_data, progress_callback)
            
            if 'error' in step5_result:
                logger.error(f"Step 5 failed: {step5_result['error']}")
                return {
                    'error': step5_result['error'],
                    'step': 5
                }
            
            internal_faq = step5_result['output']
            
            # Update step_data with FAQs for synthesis
            step_data.update({
                'external_faq': external_faq,
                'internal_faq': internal_faq
            })
            
            # Step 6: Synthesize PRFAQ Document
            logger.info("--- Processing Step 6: Synthesize PRFAQ Document ---")
            step6_result = self.generate_step_response(6, refined_press_release, step_data, progress_callback)
            
            if 'error' in step6_result:
                logger.error(f"Step 6 failed: {step6_result['error']}")
                return {
                    'error': step6_result['error'],
                    'step': 6
                }
            
            prfaq_document = step6_result['output']
            
            # Step 7: MLP Plan
            logger.info("--- Processing Step 7: MLP Plan ---")
            step7_result = self.generate_step_response(7, prfaq_document, progress_callback=progress_callback)
            
            if 'error' in step7_result:
                logger.error(f"Step 7 failed: {step7_result['error']}")
                return {
                    'error': step7_result['error'],
                    'step': 7
                }
            
            mlp_plan = step7_result['output']
            
            # Return comprehensive results
            results = {
                'prfaq': prfaq_document,
                'mlp_plan': mlp_plan,
                'steps': [
                    {'id': 1, 'name': 'Market Research & Analysis', 'output': market_research},
                    {'id': 2, 'name': 'Draft Press Release', 'output': press_release_draft},
                    {'id': 3, 'name': 'Refined Press Release', 'output': refined_press_release},
                    {'id': 4, 'name': 'External FAQ', 'output': external_faq},
                    {'id': 5, 'name': 'Internal FAQ', 'output': internal_faq},
                    {'id': 6, 'name': 'PRFAQ Document', 'output': prfaq_document},
                    {'id': 7, 'name': 'MLP Plan', 'output': mlp_plan}
                ]
            }
            
            logger.info("Complete Working Backwards process completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"Error in process_all_steps: {str(e)}")
            logger.exception("Full error traceback:")
            return {"error": f"Processing failed: {str(e)}"}

    def analyze_product_idea(self, product_idea):
        """Analyze a product idea using the Product Analysis step configuration"""
        logger.info("Starting product analysis (Step 0)")
        
        try:
            # Use the Claude processor with the product analysis configuration
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=PRODUCT_ANALYSIS_STEP["initial_prompt"].format(input=product_idea),
                progress_callback=None,
                step_id=0
            )
            
            if "error" in result:
                return result
            
            return {
                "analysis": result["output"],
                "step": PRODUCT_ANALYSIS_STEP["name"],
                "persona": PRODUCT_ANALYSIS_STEP["persona"]
            }
            
        except Exception as e:
            logger.error(f"Product analysis failed: {str(e)}")
            return {"error": f"Analysis failed: {str(e)}"}

    def refine_product_analysis(self, original_input, current_analysis, feedback):
        """Refine product analysis based on user feedback"""
        logger.info("Refining product analysis")
        
        try:
            # Format the refinement prompt with all inputs
            refinement_prompt = PRODUCT_ANALYSIS_STEP["refinement_prompt"].format(
                original_input=original_input,
                current_analysis=current_analysis,
                customer_feedback=feedback.get('customer', ''),
                problem_feedback=feedback.get('problem', ''),
                scope_feedback=feedback.get('scope', '')
            )
            
            # Use Claude processor for refinement
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=refinement_prompt,
                progress_callback=None,
                step_id=0
            )
            
            if "error" in result:
                return result
            
            return {
                "analysis": result["output"],
                "step": PRODUCT_ANALYSIS_STEP["name"],
                "persona": PRODUCT_ANALYSIS_STEP["persona"]
            }
            
        except Exception as e:
            logger.error(f"Analysis refinement failed: {str(e)}")
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
