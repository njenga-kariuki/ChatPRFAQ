import logging
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL, WORKING_BACKWARDS_STEPS

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Google Generative AI with API key
logger.info(f"Configuring Gemini API with model: {GEMINI_MODEL}")
logger.info(f"API Key configured: {'Yes' if GEMINI_API_KEY else 'No'}")
genai.configure(api_key=GEMINI_API_KEY)

class LLMProcessor:
    def __init__(self):
        self.model = GEMINI_MODEL
        self.steps = WORKING_BACKWARDS_STEPS
        self.step_outputs = {}
        logger.info(f"LLMProcessor initialized with model: {self.model}")
        logger.info(f"Number of steps configured: {len(self.steps)}")
        
        # Check if API key is set
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY is not set. LLM functionality will not work.")
        else:
            logger.info("GEMINI_API_KEY is properly configured")
            
    def generate_step_response(self, step_id, input_text, step_data=None, progress_callback=None):
        """
        Generate a response from the LLM for a specific step in the Working Backwards process.
        
        Args:
            step_id: The ID of the step to process
            input_text: The input text from the previous step or user
            step_data: Additional data needed for multi-input steps (like step 5)
            progress_callback: Optional callback function to report progress
            
        Returns:
            The generated response from the LLM
        """
        logger.info(f"=== Starting Step {step_id} ===")
        logger.debug(f"Input text length: {len(input_text) if input_text else 0}")
        logger.debug(f"Step data provided: {step_data is not None}")
        
        try:
            # Find the step configuration
            step = next((s for s in self.steps if s["id"] == step_id), None)
            if not step:
                logger.error(f"Step {step_id} not found in configuration")
                return {"error": f"Step {step_id} not found"}
            
            logger.info(f"Step found: {step['name']} ({step['persona']})")
            
            # Send progress update
            if progress_callback:
                logger.debug("Sending 'starting' progress update")
                progress_callback({
                    "step": step_id,
                    "status": "starting",
                    "message": f"Starting {step['name']}...",
                    "progress": ((step_id - 1) / 6) * 100
                })
            
            # Prepare the prompt based on the step
            system_prompt = step["system_prompt"]
            logger.debug(f"System prompt length: {len(system_prompt)}")
            
            # Special handling for step 5 which needs multiple inputs
            if step_id == 5 and step_data:
                logger.info("Step 5 detected - using combined inputs")
                user_prompt = step["user_prompt"].format(
                    refined_press_release=step_data.get("refined_press_release", ""),
                    external_faq=step_data.get("external_faq", ""),
                    internal_faq=step_data.get("internal_faq", "")
                )
            else:
                logger.debug("Using single input for prompt formatting")
                user_prompt = step["user_prompt"].format(input=input_text)
            
            logger.debug(f"User prompt length: {len(user_prompt)}")
            
            # Send progress update
            if progress_callback:
                logger.debug("Sending 'processing' progress update")
                progress_callback({
                    "step": step_id,
                    "status": "processing",
                    "message": f"Processing {step['name']} with LLM...",
                    "progress": ((step_id - 1) / 6) * 100 + 10
                })
            
            # Call the Gemini API
            logger.info("Preparing Gemini API call...")
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
            logger.debug(f"Generation config: {generation_config}")
            
            try:
                logger.info("Creating GenerativeModel instance...")
                model = genai.GenerativeModel(
                    model_name=self.model,
                    generation_config=generation_config,
                    system_instruction=system_prompt
                )
                logger.info("GenerativeModel created successfully")
                
                logger.info("Calling generate_content...")
                logger.debug(f"Model name: {self.model}")
                logger.debug(f"System instruction set: {len(system_prompt)} chars")
                logger.debug(f"User prompt: {user_prompt[:200]}...")  # First 200 chars
                
                response = model.generate_content(user_prompt)
                logger.info("generate_content call completed")
                
                # Check if response is valid
                if not response or not hasattr(response, 'text'):
                    logger.error("Invalid response from Gemini API")
                    logger.debug(f"Response object: {response}")
                    return {"error": "Invalid response from Gemini API"}
                
                output = response.text
                logger.info(f"Response received - length: {len(output)} characters")
                logger.debug(f"Response preview: {output[:200]}...")
                
            except Exception as api_error:
                logger.error(f"Gemini API call failed: {str(api_error)}")
                logger.exception("Full API error traceback:")
                return {"error": f"Gemini API error: {str(api_error)}"}
            
            # Store the output for this step
            self.step_outputs[step_id] = output
            logger.info(f"Step {step_id} output stored successfully")
            
            # Send completion update
            if progress_callback:
                logger.debug("Sending 'completed' progress update")
                progress_callback({
                    "step": step_id,
                    "status": "completed",
                    "message": f"Completed {step['name']}",
                    "progress": (step_id / 6) * 100,
                    "output": output
                })
            
            logger.info(f"=== Step {step_id} completed successfully ===")
            return {
                "output": output,
                "step": step["name"],
                "persona": step["persona"],
                "description": step["description"]
            }
            
        except Exception as e:
            logger.error(f"Error in generate_step_response for step {step_id}: {str(e)}")
            logger.exception("Full error traceback:")
            if progress_callback:
                progress_callback({
                    "step": step_id,
                    "status": "error",
                    "message": f"Error in {step.get('name', f'Step {step_id}')}: {str(e)}",
                    "error": str(e)
                })
            return {"error": f"Failed to generate response: {str(e)}"}
            
    def process_all_steps(self, product_idea, progress_callback=None):
        """
        Process all steps in the Working Backwards process sequentially.
        
        Args:
            product_idea: The initial product idea from the user
            progress_callback: Optional callback function to report progress
            
        Returns:
            A dictionary containing all step inputs, outputs, and metadata
        """
        logger.info("=== Starting complete Working Backwards process ===")
        logger.info(f"Product idea: {product_idea[:100]}...")
        
        results = {
            "product_idea": product_idea,
            "steps": []
        }
        
        try:
            # Step 1: Draft Press Release
            logger.info("--- Processing Step 1: Draft Press Release ---")
            step1_result = self.generate_step_response(1, product_idea, progress_callback=progress_callback)
            if "error" in step1_result:
                logger.error(f"Step 1 failed: {step1_result['error']}")
                return {"error": step1_result["error"], "step": 1}
            logger.info("Step 1 completed successfully")
            
            results["steps"].append({
                "id": 1,
                "name": step1_result["step"],
                "persona": step1_result["persona"],
                "description": step1_result["description"],
                "input": product_idea,
                "output": step1_result["output"]
            })
            
            # Step 2: Refine Press Release
            logger.info("--- Processing Step 2: Refine Press Release ---")
            step2_result = self.generate_step_response(2, step1_result["output"], progress_callback=progress_callback)
            if "error" in step2_result:
                logger.error(f"Step 2 failed: {step2_result['error']}")
                return {"error": step2_result["error"], "step": 2}
            logger.info("Step 2 completed successfully")
            
            results["steps"].append({
                "id": 2,
                "name": step2_result["step"],
                "persona": step2_result["persona"],
                "description": step2_result["description"],
                "input": step1_result["output"],
                "output": step2_result["output"]
            })
            
            # Store refined press release for later use
            refined_press_release = step2_result["output"]
            
            # Step 3: Draft External FAQ
            logger.info("--- Processing Step 3: Draft External FAQ ---")
            step3_result = self.generate_step_response(3, refined_press_release, progress_callback=progress_callback)
            if "error" in step3_result:
                logger.error(f"Step 3 failed: {step3_result['error']}")
                return {"error": step3_result["error"], "step": 3}
            logger.info("Step 3 completed successfully")
            
            results["steps"].append({
                "id": 3,
                "name": step3_result["step"],
                "persona": step3_result["persona"],
                "description": step3_result["description"],
                "input": refined_press_release,
                "output": step3_result["output"]
            })
            
            # Step 4: Draft Internal FAQ
            logger.info("--- Processing Step 4: Draft Internal FAQ ---")
            step4_result = self.generate_step_response(4, refined_press_release, progress_callback=progress_callback)
            if "error" in step4_result:
                logger.error(f"Step 4 failed: {step4_result['error']}")
                return {"error": step4_result["error"], "step": 4}
            logger.info("Step 4 completed successfully")
            
            results["steps"].append({
                "id": 4,
                "name": step4_result["step"],
                "persona": step4_result["persona"],
                "description": step4_result["description"],
                "input": refined_press_release,
                "output": step4_result["output"]
            })
            
            # Step 5: Synthesize PRFAQ Document
            logger.info("--- Processing Step 5: Synthesize PRFAQ Document ---")
            step5_data = {
                "refined_press_release": refined_press_release,
                "external_faq": step3_result["output"],
                "internal_faq": step4_result["output"]
            }
            step5_result = self.generate_step_response(5, None, step5_data, progress_callback=progress_callback)
            if "error" in step5_result:
                logger.error(f"Step 5 failed: {step5_result['error']}")
                return {"error": step5_result["error"], "step": 5}
            logger.info("Step 5 completed successfully")
            
            results["steps"].append({
                "id": 5,
                "name": step5_result["step"],
                "persona": step5_result["persona"],
                "description": step5_result["description"],
                "input": "Combined inputs from steps 2, 3, and 4",
                "output": step5_result["output"]
            })
            
            # Step 6: Define MLP Plan
            logger.info("--- Processing Step 6: Define MLP Plan ---")
            step6_result = self.generate_step_response(6, step5_result["output"], progress_callback=progress_callback)
            if "error" in step6_result:
                logger.error(f"Step 6 failed: {step6_result['error']}")
                return {"error": step6_result["error"], "step": 6}
            logger.info("Step 6 completed successfully")
            
            results["steps"].append({
                "id": 6,
                "name": step6_result["step"],
                "persona": step6_result["persona"],
                "description": step6_result["description"],
                "input": step5_result["output"],
                "output": step6_result["output"]
            })
            
            # Add final outputs
            results["prfaq"] = step5_result["output"]
            results["mlp_plan"] = step6_result["output"]
            
            if progress_callback:
                logger.debug("Sending final 'finished' progress update")
                progress_callback({
                    "step": "complete",
                    "status": "finished",
                    "message": "Evaluation Complete!",
                    "progress": 100
                })
            
            logger.info("=== All steps completed successfully ===")
            return results
            
        except Exception as e:
            logger.error(f"Error in process_all_steps: {str(e)}")
            logger.exception("Full process_all_steps error traceback:")
            return {"error": f"Process failed: {str(e)}", "step": "unknown"}
