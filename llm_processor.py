import logging
# import google.generativeai as genai  # Kept for potential future use
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS, PRODUCT_ANALYSIS_STEP
from perplexity_processor import PerplexityProcessor
from claude_processor import ClaudeProcessor

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
        logger.info(f"=== Starting Step {step_id} ===")
        logger.debug(f"Input text length: {len(input_text) if input_text else 0}")
        logger.debug(f"Step data provided: {step_data is not None}")
        
        try:
            # Special handling for different step types
            if step_id == 1:  # Market Research step
                return self._handle_initial_research_step(input_text, progress_callback)
            elif step_id == 2:  # Draft Press Release with research
                return self._handle_press_release_with_research(input_text, step_data, progress_callback)
            elif step_id in [3, 4, 5]:  # Steps that need market research
                return self._handle_step_with_market_research(step_id, input_text, step_data, progress_callback)
            elif step_id == 6:  # Synthesize PRFAQ with research
                return self._handle_prfaq_synthesis_with_research(input_text, step_data, progress_callback)
            elif step_id == 7:  # MLP Plan (no research needed)
                return self._handle_standard_step(step_id, input_text, progress_callback)
            else:
                return {"error": f"Unknown step ID: {step_id}"}
                
        except Exception as e:
            logger.error(f"Error in generate_step_response for step {step_id}: {str(e)}")
            logger.exception("Full error traceback:")
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": f"Error in step {step_id}: {str(e)}",
                    "error": str(e)
                })
            return {"error": f"Failed to generate response: {str(e)}"}

    def _handle_initial_research_step(self, product_idea, progress_callback=None):
        """Handle the initial market research step using Perplexity"""
        logger.info("=== Handling Initial Market Research Step ===")
        
        # Find the research step configuration
        research_step = next((s for s in self.steps if s["id"] == 1), None)
        if not research_step:
            logger.error("Initial research step configuration not found")
            return {"error": "Initial research step configuration not found"}
        
        return self.perplexity_processor.conduct_initial_market_research(
            product_idea=product_idea,
            system_prompt=research_step["system_prompt"],
            user_prompt=research_step["user_prompt"],
            progress_callback=progress_callback
        )

    def _handle_press_release_with_research(self, product_idea, step_data, progress_callback=None):
        """Handle press release drafting with market research input"""
        logger.info("=== Handling Press Release with Research ===")
        
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
        """Handle steps 3-5 that need both primary input and market research"""
        logger.info(f"=== Handling Step {step_id} with Market Research ===")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            return {"error": f"Step {step_id} configuration not found"}
        
        # Enhanced validation logging with specific details
        if not step_data:
            logger.error(f"Step {step_id}: No step_data provided")
            return {"error": f"Market research data required for step {step_id}"}
        elif 'market_research' not in step_data:
            logger.error(f"Step {step_id}: step_data missing 'market_research' key. Available keys: {list(step_data.keys())}")
            return {"error": f"Market research data required for step {step_id}"}
        
        # Critical data flow tracking
        market_research_length = len(step_data['market_research'])
        input_length = len(input_text) if input_text else 0
        logger.info(f"Step {step_id}: Market research data available ({market_research_length} chars), input text ({input_length} chars)")
        
        # Format prompt based on step requirements
        if step_id == 3:  # Refine Press Release
            formatted_prompt = step["user_prompt"].format(
                market_research=step_data['market_research'],
                press_release_draft=input_text
            )
        elif step_id in [4, 5]:  # External/Internal FAQ
            formatted_prompt = step["user_prompt"].format(
                market_research=step_data['market_research'], 
                press_release=input_text
            )
        
        # Use existing Claude processing logic
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id)

    def _handle_prfaq_synthesis_with_research(self, input_text, step_data, progress_callback=None):
        """Handle PRFAQ synthesis including market research"""
        logger.info("=== Handling PRFAQ Synthesis with Research ===")
        
        step = next((s for s in self.steps if s["id"] == 6), None)
        if not step:
            return {"error": "PRFAQ synthesis step configuration not found"}
        
        if not step_data:
            logger.error("Step 6: No step_data provided")
            return {"error": "Step data required for PRFAQ synthesis"}
        
        # Critical data flow tracking for all inputs
        market_research_length = len(step_data.get("market_research", ""))
        press_release_length = len(step_data.get("refined_press_release", ""))
        external_faq_length = len(step_data.get("external_faq", ""))
        internal_faq_length = len(step_data.get("internal_faq", ""))
        
        logger.info(f"Step 6: Synthesizing PRFAQ with market_research ({market_research_length} chars), "
                   f"press_release ({press_release_length} chars), "
                   f"external_faq ({external_faq_length} chars), "
                   f"internal_faq ({internal_faq_length} chars)")
        
        # Format prompt with all inputs including market research
        formatted_prompt = step["user_prompt"].format(
            market_research=step_data.get("market_research", ""),
            refined_press_release=step_data.get("refined_press_release", ""),
            external_faq=step_data.get("external_faq", ""),
            internal_faq=step_data.get("internal_faq", "")
        )
        
        # Use existing Claude processing logic
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id=6)

    def _handle_standard_step(self, step_id, input_text, progress_callback=None):
        """Handle standard steps that only need single input"""
        logger.info(f"=== Handling Standard Step {step_id} ===")
        
        step = next((s for s in self.steps if s["id"] == step_id), None)
        if not step:
            return {"error": f"Step {step_id} configuration not found"}
        
        formatted_prompt = step["user_prompt"].format(input=input_text)
        return self._call_claude_api(step, formatted_prompt, progress_callback, step_id)

    def _call_claude_api(self, step, formatted_prompt, progress_callback, step_id):
        """Shared Claude API call logic for all Claude-based steps"""
        logger.info(f"=== Calling Claude API for Step {step_id} ===")
        
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
        
        # Send completion update (if not already sent by claude_processor)
        if progress_callback:
            progress_callback({
                "step": step_id,
                "status": "completed",
                "message": f"Completed {step['name']}",
                "progress": (step_id / 7) * 100,
                "output": output
            })
        
        return {
            "output": output,
            "step": step["name"],
            "persona": step["persona"],
            "description": step["description"]
        }
            
    def process_all_steps(self, product_idea, progress_callback=None):
        """
        Process all steps in the Working Backwards process with market research integration.
        
        Args:
            product_idea: The initial product idea from the user
            progress_callback: Optional callback function to report progress
            
        Returns:
            A dictionary containing all step inputs, outputs, and metadata
        """
        logger.info("=== Starting complete Working Backwards process with market research ===")
        logger.info(f"Product idea: {product_idea[:100]}...")
        
        results = {
            "product_idea": product_idea,
            "steps": []
        }
        
        try:
            # Step 1: Initial Market Research
            logger.info("--- Processing Step 1: Market Research & Analysis ---")
            step1_result = self.generate_step_response(1, product_idea, progress_callback=progress_callback)
            if "error" in step1_result:
                logger.error(f"Step 1 failed: {step1_result['error']}")
                return {"error": step1_result["error"], "step": 1}
            
            market_research = step1_result["output"]
            results["steps"].append({
                "id": 1,
                "name": step1_result["step"],
                "persona": step1_result["persona"],
                "description": step1_result["description"],
                "input": product_idea,
                "output": market_research
            })
            
            # Step 2: Draft Press Release (with market research)
            logger.info("--- Processing Step 2: Draft Press Release ---")
            step2_data = {"market_research": market_research}
            step2_result = self.generate_step_response(2, product_idea, step2_data, progress_callback=progress_callback)
            if "error" in step2_result:
                logger.error(f"Step 2 failed: {step2_result['error']}")
                return {"error": step2_result["error"], "step": 2}
            
            results["steps"].append({
                "id": 2,
                "name": step2_result["step"],
                "persona": step2_result["persona"],
                "description": step2_result["description"],
                "input": f"Product Idea + Market Research ({len(market_research)} chars)",
                "output": step2_result["output"]
            })
            
            # Step 3: Refine Press Release (with market research)
            logger.info("--- Processing Step 3: Refine Press Release ---")
            step3_data = {"market_research": market_research}
            step3_result = self.generate_step_response(3, step2_result["output"], step3_data, progress_callback=progress_callback)
            if "error" in step3_result:
                logger.error(f"Step 3 failed: {step3_result['error']}")
                return {"error": step3_result["error"], "step": 3}
            
            results["steps"].append({
                "id": 3,
                "name": step3_result["step"],
                "persona": step3_result["persona"],
                "description": step3_result["description"],
                "input": f"Press Release Draft + Market Research",
                "output": step3_result["output"]
            })
            
            # Store refined press release for later use
            refined_press_release = step3_result["output"]
            
            # Step 4: External FAQ (with market research)
            logger.info("--- Processing Step 4: External FAQ ---")
            step4_data = {"market_research": market_research}
            step4_result = self.generate_step_response(4, refined_press_release, step4_data, progress_callback=progress_callback)
            if "error" in step4_result:
                logger.error(f"Step 4 failed: {step4_result['error']}")
                return {"error": step4_result["error"], "step": 4}
            
            results["steps"].append({
                "id": 4,
                "name": step4_result["step"],
                "persona": step4_result["persona"],
                "description": step4_result["description"],
                "input": f"Refined Press Release + Market Research",
                "output": step4_result["output"]
            })
            
            # Step 5: Internal FAQ (with market research)
            logger.info("--- Processing Step 5: Internal FAQ ---")
            step5_data = {"market_research": market_research}
            step5_result = self.generate_step_response(5, refined_press_release, step5_data, progress_callback=progress_callback)
            if "error" in step5_result:
                logger.error(f"Step 5 failed: {step5_result['error']}")
                return {"error": step5_result["error"], "step": 5}
            
            results["steps"].append({
                "id": 5,
                "name": step5_result["step"],
                "persona": step5_result["persona"],
                "description": step5_result["description"],
                "input": f"Refined Press Release + Market Research",
                "output": step5_result["output"]
            })
            
            # Step 6: Synthesize PRFAQ (with market research)
            logger.info("--- Processing Step 6: Synthesize PRFAQ Document ---")
            step6_data = {
                "market_research": market_research,
                "refined_press_release": refined_press_release,
                "external_faq": step4_result["output"],
                "internal_faq": step5_result["output"]
            }
            step6_result = self.generate_step_response(6, None, step6_data, progress_callback=progress_callback)
            if "error" in step6_result:
                logger.error(f"Step 6 failed: {step6_result['error']}")
                return {"error": step6_result["error"], "step": 6}
            
            results["steps"].append({
                "id": 6,
                "name": step6_result["step"],
                "persona": step6_result["persona"],
                "description": step6_result["description"],
                "input": "Combined: Market Research + Press Release + FAQs",
                "output": step6_result["output"]
            })
            
            # Step 7: MLP Plan (based on PRFAQ)
            logger.info("--- Processing Step 7: MLP Plan ---")
            step7_result = self.generate_step_response(7, step6_result["output"], progress_callback=progress_callback)
            if "error" in step7_result:
                logger.error(f"Step 7 failed: {step7_result['error']}")
                return {"error": step7_result["error"], "step": 7}
            
            results["steps"].append({
                "id": 7,
                "name": step7_result["step"],
                "persona": step7_result["persona"],
                "description": step7_result["description"],
                "input": "Complete PRFAQ Document",
                "output": step7_result["output"]
            })
            
            # Store market research and final outputs in results
            results["market_research"] = market_research
            results["prfaq"] = step6_result["output"]
            results["mlp_plan"] = step7_result["output"]
            
            logger.info("=== Complete Working Backwards process completed successfully ===")
            return results
            
        except Exception as e:
            logger.error(f"Error in process_all_steps: {str(e)}")
            logger.exception("Full error traceback:")
            return {"error": f"Process failed: {str(e)}", "step": "unknown"}

    def analyze_product_idea(self, product_idea, progress_callback=None):
        """Initial product concept analysis"""
        logger.info("=== Starting Product Analysis (Step 0) ===")
        
        try:
            if progress_callback:
                progress_callback({
                    "step": 0,
                    "status": "processing",
                    "message": "Analyzing product concept...",
                    "progress": 5
                })
            
            # Use Claude processor for analysis
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=PRODUCT_ANALYSIS_STEP["initial_prompt"].format(input=product_idea),
                progress_callback=progress_callback,
                step_id=0
            )
            
            if "error" in result:
                return result
            
            analysis = result["output"]
            
            if progress_callback:
                progress_callback({
                    "step": 0,
                    "status": "completed",
                    "message": "Product analysis complete",
                    "progress": 15,
                    "output": analysis
                })
            
            return {"analysis": analysis}
            
        except Exception as e:
            logger.error(f"Product analysis failed: {str(e)}")
            return {"error": str(e)}

    def refine_product_analysis(self, original_input, current_analysis, feedback_data, progress_callback=None):
        """Refine analysis based on user feedback"""
        logger.info("=== Refining Product Analysis ===")
        
        try:
            # Use Claude processor for refinement
            formatted_prompt = PRODUCT_ANALYSIS_STEP["refinement_prompt"].format(
                original_input=original_input,
                current_analysis=current_analysis,
                customer_feedback=feedback_data.get("customer", "No changes requested"),
                problem_feedback=feedback_data.get("problem", "No changes requested"),
                scope_feedback=feedback_data.get("scope", "No changes requested")
            )
            
            result = self.claude_processor.generate_response(
                system_prompt=PRODUCT_ANALYSIS_STEP["system_prompt"],
                user_prompt=formatted_prompt,
                progress_callback=progress_callback,
                step_id=0
            )
            
            if "error" in result:
                return result
            
            return {"analysis": result["output"]}
            
        except Exception as e:
            logger.error(f"Analysis refinement failed: {str(e)}")
            return {"error": str(e)}

    def create_enriched_product_brief(self, original_idea, analysis):
        """Create enhanced product brief for Step 1"""
        logger.info("=== Creating Enriched Product Brief ===")
        
        try:
            system_prompt = """You are an expert product strategist. Transform the original product idea and strategic analysis into a comprehensive product brief that will serve as optimal input for creating a press release.

Combine the original idea with the strategic insights to create a rich, detailed product brief that maintains the original vision while incorporating the strategic clarity. This brief should read as a cohesive product definition, not separate sections."""
            
            prompt = f"""Create a comprehensive product brief by combining this original idea with the strategic analysis:

Original Product Idea:
{original_idea}

Strategic Analysis:
{analysis}

Transform this into a cohesive, detailed product brief that captures the original vision enhanced with strategic clarity."""
            
            result = self.claude_processor.generate_response(
                system_prompt=system_prompt,
                user_prompt=prompt,
                progress_callback=None,
                step_id=None
            )
            
            if "error" in result:
                logger.error(f"Failed to create enriched brief: {result['error']}")
                return original_idea  # Fallback to original
            
            return result["output"]
            
        except Exception as e:
            logger.error(f"Failed to create enriched brief: {str(e)}")
            return original_idea  # Fallback to original
