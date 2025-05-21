from flask import request, jsonify, render_template
from app import app
from llm_processor import LLMProcessor
import logging

# Create LLM processor instance
llm_processor = LLMProcessor()

@app.route('/')
def index():
    """Render the main application page"""
    return render_template('index.html')

@app.route('/api/process', methods=['POST'])
def process_product_idea():
    """
    Process a product idea through the Working Backwards pipeline.
    
    Expects a JSON payload with the following structure:
    {
        "product_idea": "Description of the product idea"
    }
    
    Returns a JSON response with the results of each step in the process.
    """
    try:
        data = request.get_json()
        
        if not data or 'product_idea' not in data:
            return jsonify({
                'error': 'Missing product_idea in request body'
            }), 400
        
        product_idea = data['product_idea']
        
        if not product_idea or len(product_idea.strip()) < 10:
            return jsonify({
                'error': 'Product idea is too short. Please provide more details.'
            }), 400
            
        # Process the product idea through all steps
        results = llm_processor.process_all_steps(product_idea)
        
        if 'error' in results:
            return jsonify({
                'error': results['error'],
                'step': results.get('step', 'unknown')
            }), 500
            
        return jsonify(results)
        
    except Exception as e:
        logging.exception("Error processing product idea")
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/process_step', methods=['POST'])
def process_single_step():
    """
    Process a single step in the Working Backwards pipeline.
    
    Expects a JSON payload with the following structure:
    {
        "step_id": 1,
        "input": "Input text for this step",
        "step_data": {} (optional, for steps requiring multiple inputs)
    }
    
    Returns a JSON response with the results of the requested step.
    """
    try:
        data = request.get_json()
        
        if not data or 'step_id' not in data or 'input' not in data:
            return jsonify({
                'error': 'Missing required fields (step_id, input) in request body'
            }), 400
            
        step_id = data['step_id']
        input_text = data['input']
        step_data = data.get('step_data', None)
        
        # Process the single step
        result = llm_processor.generate_step_response(step_id, input_text, step_data)
        
        if 'error' in result:
            return jsonify({
                'error': result['error'],
                'step': step_id
            }), 500
            
        return jsonify(result)
        
    except Exception as e:
        logging.exception(f"Error processing step {data.get('step_id', 'unknown')}")
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500
