from flask import request, jsonify, Response
from app import app
from processors.llm_processor import LLMProcessor
import logging
import json
import time
import threading
import queue
import os
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Create LLM processor instance
logger.info("Creating LLMProcessor instance...")
llm_processor = LLMProcessor()
logger.info("LLMProcessor instance created successfully")

def generate_request_id():
    """Generate a short request ID for tracking"""
    return str(uuid.uuid4())[:8]

# Serve React app directly from Flask
from flask import send_from_directory
import os

@app.route('/')
def serve_react_app():
    """Serve the React app's main page"""
    return send_from_directory('static/react', 'index.html')

@app.route('/<path:path>')
def serve_react_static_files(path):
    """Serve React static files, or fallback to index.html for SPA routing"""
    if os.path.exists(os.path.join('static/react', path)):
        return send_from_directory('static/react', path)
    else:
        # For SPA routing, serve index.html for unknown paths
        return send_from_directory('static/react', 'index.html')

# API routes start here
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
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /process endpoint called")
    try:
        data = request.get_json()
        logger.debug(f"[{request_id}] Request data received: {data is not None}")
        
        if not data or 'product_idea' not in data:
            logger.warning(f"[{request_id}] Missing product_idea in request body")
            return jsonify({
                'error': 'Missing product_idea in request body'
            }), 400
        
        product_idea = data['product_idea']
        logger.info(f"[{request_id}] Product idea received - length: {len(product_idea)} characters")
        logger.debug(f"[{request_id}] Product idea preview: {product_idea[:100]}...")
        
        if not product_idea or len(product_idea.strip()) < 10:
            logger.warning(f"[{request_id}] Product idea too short: {len(product_idea)} characters")
            return jsonify({
                'error': 'Product idea is too short. Please provide more details.'
            }), 400
            
        # Process the product idea through all steps
        logger.info(f"[{request_id}] Starting LLM processing...")
        start_time = time.time()
        results = llm_processor.process_all_steps(product_idea)
        end_time = time.time()
        
        logger.info(f"[{request_id}] LLM processing completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in results:
            logger.error(f"[{request_id}] LLM processing failed: {results['error']}")
            return jsonify({
                'error': results['error'],
                'step': results.get('step', 'unknown')
            }), 500
            
        logger.info(f"[{request_id}] Returning successful results")
        logger.debug(f"[{request_id}] Results contain {len(results.get('steps', []))} steps")
        return jsonify(results)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error in process_product_idea")
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/process_stream', methods=['POST'])
def process_product_idea_stream():
    """
    Process a product idea with real-time streaming updates.
    
    Expects a JSON payload with the following structure:
    {
        "product_idea": "Description of the product idea"
    }
    
    Returns Server-Sent Events stream with real-time progress updates.
    """
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /process_stream endpoint called")
    try:
        data = request.get_json()
        logger.debug(f"[{request_id}] Stream request data received: {data is not None}")
        
        if not data or 'product_idea' not in data:
            logger.warning(f"[{request_id}] Missing product_idea in stream request body")
            return jsonify({
                'error': 'Missing product_idea in request body'
            }), 400
        
        product_idea = data['product_idea']
        logger.info(f"[{request_id}] Stream product idea received - length: {len(product_idea)} characters")
        
        if not product_idea or len(product_idea.strip()) < 10:
            logger.warning(f"[{request_id}] Stream product idea too short: {len(product_idea)} characters")
            return jsonify({
                'error': 'Product idea is too short. Please provide more details.'
            }), 400
        
        def generate():
            logger.info(f"[{request_id}] Starting stream generator")
            # Create a queue for progress updates
            progress_queue = queue.Queue()
            result_container = {}
            
            def progress_callback(update):
                logger.info(f"[{request_id}] Step {update.get('step', '?')} | {update.get('status', 'unknown')}")
                progress_queue.put(update)
            
            def process_in_thread():
                try:
                    logger.info(f"[{request_id}] Background processing thread started")
                    result = llm_processor.process_all_steps(product_idea, progress_callback)
                    result_container['result'] = result
                    progress_queue.put({'done': True})
                    logger.info(f"[{request_id}] Background processing thread completed")
                except Exception as e:
                    logger.exception(f"[{request_id}] Error in background processing thread")
                    progress_queue.put({
                        'error': True,
                        'message': f'Server error: {str(e)}'
                    })
            
            # Start processing in background thread
            thread = threading.Thread(target=process_in_thread)
            thread.daemon = True
            thread.start()
            logger.info(f"[{request_id}] Background thread started")
            
            # Send initial status
            initial_update = {'status': 'started', 'message': 'Starting evaluation...', 'progress': 0}
            logger.debug(f"[{request_id}] Sending initial update: {initial_update}")
            yield f"data: {json.dumps(initial_update)}\n\n"
            
            # Stream progress updates
            update_count = 0
            last_step_time = time.time()
            
            while True:
                try:
                    update = progress_queue.get(timeout=60)  # 60 second timeout
                    update_count += 1
                    current_time = time.time()
                    
                    # Log step timing for debugging
                    if update.get('step'):
                        step_duration = current_time - last_step_time
                        logger.info(f"[{request_id}] Step {update.get('step')} update after {step_duration:.1f}s | Status: {update.get('status', 'unknown')}")
                        last_step_time = current_time
                    
                    logger.debug(f"[{request_id}] Streaming update #{update_count}: {update.get('status', 'unknown')}")
                    
                    if update.get('done'):
                        logger.info(f"[{request_id}] Processing completed - sending final result")
                        # Send final result
                        if 'result' in result_container:
                            if 'error' in result_container['result']:
                                error_step = result_container['result'].get('step', 'unknown')
                                logger.error(f"[{request_id}] Final result contains error at step {error_step}: {result_container['result']['error']}")
                                yield f"data: {json.dumps({'error': result_container['result']['error'], 'step': error_step})}\n\n"
                            else:
                                logger.info(f"[{request_id}] Sending successful completion result")
                                yield f"data: {json.dumps({'complete': True, 'result': result_container['result']})}\n\n"
                        break
                    elif update.get('error'):
                        logger.error(f"[{request_id}] Error in stream: {update['message']}")
                        yield f"data: {json.dumps({'error': update['message']})}\n\n"
                        break
                    else:
                        # Send progress update
                        yield f"data: {json.dumps(update)}\n\n"
                        
                except queue.Empty:
                    # Timeout - send keepalive and check for stuck processing
                    elapsed_time = time.time() - last_step_time
                    logger.warning(f"[{request_id}] Stream timeout after {elapsed_time:.1f}s - sending keepalive")
                    
                    # If we've been stuck for too long, consider it a failure
                    if elapsed_time > 120:  # 2 minutes without progress
                        logger.error(f"[{request_id}] Processing appears stuck - terminating stream")
                        yield f"data: {json.dumps({'error': 'Processing timeout - the operation took too long to complete. Please try again.'})}\n\n"
                        break
                    
                    yield f"data: {json.dumps({'keepalive': True, 'message': 'Processing continues...'})}\n\n"
                    continue
                except Exception as e:
                    logger.exception(f"[{request_id}] Error in stream generator")
                    yield f"data: {json.dumps({'error': f'Stream error: {str(e)}'})}\n\n"
                    break
                    
            logger.info(f"[{request_id}] Stream generator completed after {update_count} updates")
        
        logger.info(f"[{request_id}] Returning streaming response")
        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            }
        )
        
    except Exception as e:
        logger.exception(f"[{request_id}] Error setting up stream")
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
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /process_step endpoint called")
    try:
        data = request.get_json()
        logger.debug(f"[{request_id}] Single step request data received: {data is not None}")
        
        if not data or 'step_id' not in data or 'input' not in data:
            logger.warning(f"[{request_id}] Missing required fields in single step request")
            return jsonify({
                'error': 'Missing required fields (step_id, input) in request body'
            }), 400
            
        step_id = data['step_id']
        input_text = data['input']
        step_data = data.get('step_data', None)
        
        logger.info(f"[{request_id}] Processing single step {step_id}")
        logger.debug(f"[{request_id}] Input text length: {len(input_text)}")
        
        # Process the single step
        start_time = time.time()
        result = llm_processor.generate_step_response(step_id, input_text, step_data)
        end_time = time.time()
        
        logger.info(f"[{request_id}] Single step {step_id} completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in result:
            logger.error(f"[{request_id}] Single step {step_id} failed: {result['error']}")
            return jsonify({
                'error': result['error'],
                'step': step_id
            }), 500
            
        logger.info(f"[{request_id}] Single step {step_id} successful")
        return jsonify(result)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Error processing single step {data.get('step_id', 'unknown')}")
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/analyze_product_idea', methods=['POST'])
def analyze_product_idea():
    try:
        data = request.get_json()
        if not data or 'product_idea' not in data:
            return jsonify({'error': 'Missing product_idea'}), 400
        
        result = llm_processor.analyze_product_idea(data['product_idea'])
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 500
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refine_analysis', methods=['POST'])
def refine_analysis():
    try:
        data = request.get_json()
        required_fields = ['original_input', 'current_analysis', 'feedback']
        
        if not data or not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        result = llm_processor.refine_product_analysis(
            data['original_input'],
            data['current_analysis'], 
            data['feedback']
        )
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 500
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create_enriched_brief', methods=['POST'])
def create_enriched_brief():
    try:
        data = request.get_json()
        required_fields = ['original_idea', 'analysis']
        
        if not data or not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        brief = llm_processor.create_enriched_product_brief(
            data['original_idea'],
            data['analysis']
        )
        
        return jsonify({'brief': brief})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-perplexity', methods=['GET'])
def test_perplexity_api():
    """Test endpoint to debug Perplexity API authentication"""
    from config import PERPLEXITY_API_KEY, PERPLEXITY_BASE_URL, PERPLEXITY_MODEL
    from openai import OpenAI
    import requests
    import traceback
    
    results = {
        "api_key_check": {},
        "direct_request": {},
        "openai_client": {},
        "summary": ""
    }
    
    # 1. Check API key
    if PERPLEXITY_API_KEY:
        results["api_key_check"] = {
            "status": "present",
            "length": len(PERPLEXITY_API_KEY),
            "prefix": PERPLEXITY_API_KEY[:20] + "..." if len(PERPLEXITY_API_KEY) > 20 else PERPLEXITY_API_KEY,
            "format_check": {
                "starts_with_pplx": PERPLEXITY_API_KEY.startswith("pplx-"),
                "contains_spaces": " " in PERPLEXITY_API_KEY,
                "contains_newlines": "\n" in PERPLEXITY_API_KEY
            }
        }
    else:
        results["api_key_check"] = {
            "status": "missing",
            "error": "PERPLEXITY_API_KEY not found in environment"
        }
        results["summary"] = "API key not configured. Please check Replit Secrets."
        return jsonify(results), 500
    
    # 2. Test with direct HTTP request
    try:
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": PERPLEXITY_MODEL,
            "messages": [{"role": "user", "content": "Reply 'test ok' only"}],
            "max_tokens": 10,
            "temperature": 0
        }
        
        response = requests.post(
            f"{PERPLEXITY_BASE_URL}/chat/completions",
            headers=headers,
            json=data,
            timeout=10
        )
        
        results["direct_request"] = {
            "status_code": response.status_code,
            "success": response.status_code == 200
        }
        
        if response.status_code == 200:
            resp_json = response.json()
            if "choices" in resp_json:
                results["direct_request"]["response"] = resp_json["choices"][0]["message"]["content"]
        else:
            results["direct_request"]["error"] = response.text[:500]
            
    except Exception as e:
        results["direct_request"] = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
    
    # 3. Test with OpenAI client
    try:
        client = OpenAI(
            api_key=PERPLEXITY_API_KEY,
            base_url=PERPLEXITY_BASE_URL
        )
        
        response = client.chat.completions.create(
            model=PERPLEXITY_MODEL,
            messages=[{"role": "user", "content": "Reply 'test ok' only"}],
            max_tokens=10,
            temperature=0
        )
        
        results["openai_client"] = {
            "success": True,
            "response": response.choices[0].message.content
        }
        
    except Exception as e:
        results["openai_client"] = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
        }
    
    # 4. Summary
    if results["direct_request"].get("success") and results["openai_client"].get("success"):
        results["summary"] = "✅ Both tests passed! Perplexity API is working correctly."
        status_code = 200
    elif results["direct_request"].get("success") and not results["openai_client"].get("success"):
        results["summary"] = "⚠️ API key is valid but OpenAI client has issues."
        status_code = 500
    else:
        results["summary"] = "❌ Perplexity API authentication failed. Check API key."
        status_code = 500
    
    return jsonify(results), status_code

@app.route('/api/debug/status', methods=['GET'])
def debug_status():
    """Debug endpoint to check system status"""
    try:
        from config import ANTHROPIC_API_KEY, PERPLEXITY_API_KEY
        
        status = {
            "timestamp": time.time(),
            "anthropic_configured": bool(ANTHROPIC_API_KEY),
            "perplexity_configured": bool(PERPLEXITY_API_KEY),
            "steps_configured": len(llm_processor.steps),
            "processor_ready": hasattr(llm_processor, 'claude_processor') and llm_processor.claude_processor is not None
        }
        
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/debug/test-step/<int:step_id>', methods=['POST'])
def debug_test_step(step_id):
    """Debug endpoint to test individual steps"""
    try:
        data = request.get_json()
        if not data or 'input' not in data:
            return jsonify({'error': 'Missing input in request body'}), 400
        
        input_text = data['input']
        step_data = data.get('step_data', {})
        
        logger.info(f"Debug: Testing step {step_id} with input length {len(input_text)}")
        
        result = llm_processor.generate_step_response(step_id, input_text, step_data)
        
        return jsonify({
            "step_id": step_id,
            "success": "error" not in result,
            "result": result
        })
        
    except Exception as e:
        logger.exception(f"Debug: Error testing step {step_id}")
        return jsonify({"error": str(e)}), 500
