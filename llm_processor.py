import logging
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL, WORKING_BACKWARDS_STEPS

# Configure Google Generative AI with API key
genai.configure(api_key=GEMINI_API_KEY)

class LLMProcessor:
    def __init__(self):
        self.model = GEMINI_MODEL
        self.steps = WORKING_BACKWARDS_STEPS
        self.step_outputs = {}
        # Check if API key is set
        if not GEMINI_API_KEY:
            logging.error("GEMINI_API_KEY is not set. LLM functionality will not work.")
            
    def generate_step_response(self, step_id, input_text, step_data=None):
        """
        Generate a response from the LLM for a specific step in the Working Backwards process.
        
        Args:
            step_id: The ID of the step to process
            input_text: The input text from the previous step or user
            step_data: Additional data needed for multi-input steps (like step 5)
            
        Returns:
            The generated response from the LLM
        """
        try:
            # Find the step configuration
            step = next((s for s in self.steps if s["id"] == step_id), None)
            if not step:
                return {"error": f"Step {step_id} not found"}
            
            # Prepare the prompt based on the step
            system_prompt = step["system_prompt"]
            
            # Special handling for step 5 which needs multiple inputs
            if step_id == 5 and step_data:
                user_prompt = step["user_prompt"].format(
                    refined_press_release=step_data.get("refined_press_release", ""),
                    external_faq=step_data.get("external_faq", ""),
                    internal_faq=step_data.get("internal_faq", "")
                )
            else:
                user_prompt = step["user_prompt"].format(input=input_text)
            
            # Call the Gemini API
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
            
            model = genai.GenerativeModel(
                model_name=self.model,
                generation_config=generation_config
            )
            
            response = model.generate_content(
                [
                    {"role": "system", "parts": [system_prompt]},
                    {"role": "user", "parts": [user_prompt]}
                ]
            )
            
            # Store the output for this step
            output = response.text
            self.step_outputs[step_id] = output
            
            return {
                "output": output,
                "step": step["name"],
                "persona": step["persona"],
                "description": step["description"]
            }
            
        except Exception as e:
            logging.error(f"Error generating step {step_id} response: {str(e)}")
            return {"error": f"Failed to generate response: {str(e)}"}
            
    def process_all_steps(self, product_idea):
        """
        Process all steps in the Working Backwards process sequentially.
        
        Args:
            product_idea: The initial product idea from the user
            
        Returns:
            A dictionary containing all step inputs, outputs, and metadata
        """
        results = {
            "product_idea": product_idea,
            "steps": []
        }
        
        # Step 1: Draft Press Release
        step1_result = self.generate_step_response(1, product_idea)
        if "error" in step1_result:
            return {"error": step1_result["error"], "step": 1}
        results["steps"].append({
            "id": 1,
            "name": step1_result["step"],
            "persona": step1_result["persona"],
            "description": step1_result["description"],
            "input": product_idea,
            "output": step1_result["output"]
        })
        
        # Step 2: Refine Press Release
        step2_result = self.generate_step_response(2, step1_result["output"])
        if "error" in step2_result:
            return {"error": step2_result["error"], "step": 2}
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
        step3_result = self.generate_step_response(3, refined_press_release)
        if "error" in step3_result:
            return {"error": step3_result["error"], "step": 3}
        results["steps"].append({
            "id": 3,
            "name": step3_result["step"],
            "persona": step3_result["persona"],
            "description": step3_result["description"],
            "input": refined_press_release,
            "output": step3_result["output"]
        })
        
        # Step 4: Draft Internal FAQ
        step4_result = self.generate_step_response(4, refined_press_release)
        if "error" in step4_result:
            return {"error": step4_result["error"], "step": 4}
        results["steps"].append({
            "id": 4,
            "name": step4_result["step"],
            "persona": step4_result["persona"],
            "description": step4_result["description"],
            "input": refined_press_release,
            "output": step4_result["output"]
        })
        
        # Step 5: Synthesize PRFAQ Document
        step5_data = {
            "refined_press_release": refined_press_release,
            "external_faq": step3_result["output"],
            "internal_faq": step4_result["output"]
        }
        step5_result = self.generate_step_response(5, None, step5_data)
        if "error" in step5_result:
            return {"error": step5_result["error"], "step": 5}
        results["steps"].append({
            "id": 5,
            "name": step5_result["step"],
            "persona": step5_result["persona"],
            "description": step5_result["description"],
            "input": "Combined inputs from steps 2, 3, and 4",
            "output": step5_result["output"]
        })
        
        # Step 6: Define MLP Plan
        step6_result = self.generate_step_response(6, step5_result["output"])
        if "error" in step6_result:
            return {"error": step6_result["error"], "step": 6}
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
        
        return results
