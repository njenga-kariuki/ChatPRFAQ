import logging
# import google.generativeai as genai  # Kept for potential future use
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS, PRODUCT_ANALYSIS_STEP
from .perplexity_processor import PerplexityProcessor
from .claude_processor import ClaudeProcessor

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
                # Problem validation research
                return self._handle_problem_validation_research(input_text, step_data, progress_callback)
            elif step_id == 3:
                # Press release drafting with market research AND problem validation
                return self._handle_press_release_with_research_and_validation(input_text, step_data, progress_callback)
            elif step_id == 4:
                # Press release refinement (existing handler works)
                return self._handle_press_release_refinement(input_text, step_data, progress_callback)
            elif step_id == 5:
                # Internal FAQ (existing handler works with adjusted ID)
                return self._handle_step_with_market_research(step_id, input_text, step_data, progress_callback)
            elif step_id == 6:
                # Concept validation research
                return self._handle_concept_validation_research(input_text, step_data, progress_callback)
            elif step_id == 7:
                # Solution refinement
                return self._handle_solution_refinement(input_text, step_data, progress_callback)
            elif step_id == 8:
                # External FAQ (now based on research)
                return self._handle_external_faq_from_research(input_text, step_data, progress_callback)
            elif step_id == 9:
                # PRFAQ synthesis
                return self._handle_prfaq_synthesis_enhanced(input_text, step_data, progress_callback)
            elif step_id == 10:
                # MLP Plan
                return self._handle_mlp_with_research_context(input_text, step_data, progress_callback)
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

    def _handle_problem_validation_research(self, product_idea, step_data, progress_callback=None):
        """Handle problem validation research step"""
        logger.info("Handling problem validation research")
        
        step = next((s for s in self.steps if s["id"] == 2), None)
        if not step:
            return {"error": "Problem validation step configuration not found"}
        
        # Format prompt with product idea and market research
        formatted_prompt = step["user_prompt"].format(
            product_idea=product_idea,
            market_research=step_data.get('market_research', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=2)

    def _handle_press_release_with_research_and_validation(self, product_idea, step_data, progress_callback=None):
        """Handle press release drafting with BOTH market research and problem validation"""
        logger.info("Handling press release with research and validation")
        
        step = next((s for s in self.steps if s["id"] == 3), None)
        if not step:
            return {"error": "Press release step configuration not found"}
        
        # Format prompt with product idea, market research, AND problem validation
        formatted_prompt = step["user_prompt"].format(
            product_idea=product_idea,
            market_research=step_data.get('market_research', ''),
            problem_validation=step_data.get('problem_validation', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=3)

    def _handle_press_release_refinement(self, input_text, step_data, progress_callback=None):
        """Handle press release refinement step (special case)"""
        logger.info("Handling press release refinement step")
        
        step = next((s for s in self.steps if s["id"] == 4), None)
        if not step:
            return {"error": "Press release refinement step configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error("Step 4: No step_data provided")
            return {"error": "Market research data required for press release refinement"}
        elif 'market_research' not in step_data:
            logger.error(f"Step 4: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": "Market research data required for press release refinement"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        input_length = len(input_text) if input_text else 0
        logger.info(f"Step 4: Market research data available ({market_research_length} chars), press release draft ({input_length} chars)")
        
        # Format prompt with press_release_draft and market_research (step 4 specific format)
        formatted_prompt = step["user_prompt"].format(
            press_release_draft=input_text,
            market_research=step_data['market_research']
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=4)

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
        
        # Format prompt with correct parameter names based on step
        if step_id in [5, 6]:
            # Steps 5 and 6 expect 'press_release' parameter
            formatted_prompt = step["user_prompt"].format(
                press_release=input_text,
                market_research=step_data['market_research']
            )
        else:
            # Other steps expect 'input' parameter
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

    def _handle_concept_validation_research(self, press_release, step_data, progress_callback=None):
        """Handle concept validation research step"""
        logger.info("Handling concept validation research")
        
        step = next((s for s in self.steps if s["id"] == 6), None)
        if not step:
            return {"error": "Concept validation step configuration not found"}
        
        # Include problem validation summary
        problem_validation_summary = step_data.get('problem_validation', '')
        if problem_validation_summary:
            # Extract key findings for concept validation context
            problem_validation_summary = f"Key findings from problem validation:\n{problem_validation_summary[:500]}..."
        
        formatted_prompt = step["user_prompt"].format(
            press_release=press_release,
            market_research=step_data.get('market_research', ''),
            problem_validation_summary=problem_validation_summary
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=6)

    def _handle_solution_refinement(self, press_release, step_data, progress_callback=None):
        """Handle solution refinement based on concept validation"""
        logger.info("Handling solution refinement")
        
        step = next((s for s in self.steps if s["id"] == 7), None)
        if not step:
            return {"error": "Solution refinement step configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(
            refined_press_release=press_release,
            concept_validation_feedback=step_data.get('concept_validation', ''),
            internal_faq=step_data.get('internal_faq', '')
        )
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=7)

    def _handle_external_faq_from_research(self, press_release, step_data, progress_callback=None):
        """Create external FAQ based on concept validation findings"""
        logger.info("Handling external FAQ from research")
        
        step = next((s for s in self.steps if s["id"] == 8), None)
        if not step:
            logger.error("Step 8 configuration not found in steps list")
            return {"error": "External FAQ step configuration not found"}
        
        # Enhanced validation for step 8 dependencies
        if not step_data:
            logger.error("Step 8: No step_data provided")
            return {"error": "Step 8 requires previous step data"}
        
        concept_validation = step_data.get('concept_validation', '')
        if not concept_validation:
            logger.error("Step 8: Missing concept_validation data from step 6")
            return {"error": "Step 8 requires concept validation data from step 6"}
        
        if not press_release:
            logger.error("Step 8: No press release provided")
            return {"error": "Step 8 requires refined press release from step 7"}
        
        # Log data availability for debugging
        logger.info(f"Step 8: Press release length: {len(press_release)} chars")
        logger.info(f"Step 8: Concept validation length: {len(concept_validation)} chars")
        
        try:
            formatted_prompt = step["user_prompt"].format(
                solution_refined_press_release=press_release,
                concept_validation_feedback=concept_validation
            )
            
            logger.info("Step 8: Calling Claude API for External FAQ generation")
            result = self._call_claude_api(step, formatted_prompt, progress_callback, step_id=8)
            
            if "error" in result:
                logger.error(f"Step 8: Claude API call failed: {result['error']}")
                return result
            
            logger.info(f"Step 8: Successfully generated External FAQ ({len(result.get('output', ''))} chars)")
            return result
            
        except Exception as e:
            logger.exception("Step 8: Unexpected error during External FAQ generation")
            return {"error": f"Step 8 failed: {str(e)}"}
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=8)

    def _handle_prfaq_synthesis_enhanced(self, input_text, step_data, progress_callback=None):
        """Enhanced PRFAQ synthesis with user research insights"""
        logger.info("Handling enhanced PRFAQ synthesis")
        
        step = next((s for s in self.steps if s["id"] == 9), None)
        if not step:
            return {"error": "PRFAQ synthesis step configuration not found"}
        
        # Combine user research insights
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
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=9)

    def _handle_mlp_with_research_context(self, input_text, step_data, progress_callback=None):
        """Handle MLP plan with research context for prioritization"""
        logger.info("Handling MLP plan with research context")
        
        step = next((s for s in self.steps if s["id"] == 10), None)
        if not step:
            return {"error": "MLP plan step configuration not found"}
        
        # Standard MLP handling but with research-aware prompts
        formatted_prompt = step["user_prompt"].format(input=input_text)
        
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=10)

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
        logger.info("Starting complete Working Backwards process with enhanced research")
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
            
            # Step 2: Problem Validation Research (NEW)
            logger.info("--- Processing Step 2: Problem Validation Research ---")
            step_data = {'market_research': market_research}
            step2_result = self.generate_step_response(2, product_idea, step_data, progress_callback)
            
            if 'error' in step2_result:
                logger.error(f"Step 2 failed: {step2_result['error']}")
                return {
                    'error': step2_result['error'],
                    'step': 2
                }
            
            problem_validation = step2_result['output']
            
            # Step 3: Draft Press Release (with problem validation)
            logger.info("--- Processing Step 3: Draft Press Release ---")
            step_data['problem_validation'] = problem_validation
            step3_result = self.generate_step_response(3, product_idea, step_data, progress_callback)
            
            if 'error' in step3_result:
                logger.error(f"Step 3 failed: {step3_result['error']}")
                return {
                    'error': step3_result['error'],
                    'step': 3
                }
            
            press_release_draft = step3_result['output']
            
            # Step 4: Refine Press Release
            logger.info("--- Processing Step 4: Refine Press Release ---")
            step4_result = self.generate_step_response(4, press_release_draft, step_data, progress_callback)
            
            if 'error' in step4_result:
                logger.error(f"Step 4 failed: {step4_result['error']}")
                return {
                    'error': step4_result['error'],
                    'step': 4
                }
            
            refined_press_release = step4_result['output']
            
            # Step 5: Internal FAQ (moved up)
            logger.info("--- Processing Step 5: Internal FAQ ---")
            step5_result = self.generate_step_response(5, refined_press_release, step_data, progress_callback)
            
            if 'error' in step5_result:
                logger.error(f"Step 5 failed: {step5_result['error']}")
                return {
                    'error': step5_result['error'],
                    'step': 5
                }
            
            internal_faq = step5_result['output']
            
            # Step 6: Concept Validation Research (NEW)
            logger.info("--- Processing Step 6: Concept Validation Research ---")
            step_data['internal_faq'] = internal_faq
            step6_result = self.generate_step_response(6, refined_press_release, step_data, progress_callback)
            
            if 'error' in step6_result:
                logger.error(f"Step 6 failed: {step6_result['error']}")
                return {
                    'error': step6_result['error'],
                    'step': 6
                }
            
            concept_validation = step6_result['output']
            
            # Step 7: Solution Refinement (NEW)
            logger.info("--- Processing Step 7: Solution Refinement ---")
            step_data['concept_validation'] = concept_validation
            step7_result = self.generate_step_response(7, refined_press_release, step_data, progress_callback)
            
            if 'error' in step7_result:
                logger.error(f"Step 7 failed: {step7_result['error']}")
                return {
                    'error': step7_result['error'],
                    'step': 7
                }
            
            solution_refined_pr = step7_result['output']
            
            # Step 8: External FAQ (based on research)
            logger.info("--- Processing Step 8: External FAQ ---")
            step8_result = self.generate_step_response(8, solution_refined_pr, step_data, progress_callback)
            
            if 'error' in step8_result:
                logger.error(f"Step 8 failed: {step8_result['error']}")
                return {
                    'error': step8_result['error'],
                    'step': 8
                }
            
            external_faq = step8_result['output']
            
            # Step 9: Synthesize PRFAQ
            logger.info("--- Processing Step 9: Synthesize PRFAQ ---")
            step_data['external_faq'] = external_faq
            step_data['refined_press_release'] = solution_refined_pr
            step9_result = self.generate_step_response(9, solution_refined_pr, step_data, progress_callback)
            
            if 'error' in step9_result:
                logger.error(f"Step 9 failed: {step9_result['error']}")
                return {
                    'error': step9_result['error'],
                    'step': 9
                }
            
            prfaq_document = step9_result['output']
            
            # Step 10: MLP Plan
            logger.info("--- Processing Step 10: MLP Plan ---")
            step10_result = self.generate_step_response(10, prfaq_document, step_data, progress_callback)
            
            if 'error' in step10_result:
                logger.error(f"Step 10 failed: {step10_result['error']}")
                return {
                    'error': step10_result['error'],
                    'step': 10
                }
            
            mlp_plan = step10_result['output']
            
            # Return comprehensive results
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
