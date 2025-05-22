from flask import request, jsonify, Response
from app import app
from llm_processor import LLMProcessor
import logging
import json
import time
import threading
import queue
import os

# Configure logging
logger = logging.getLogger(__name__)

# Create LLM processor instance
logger.info("Creating LLMProcessor instance...")
llm_processor = LLMProcessor()
logger.info("LLMProcessor instance created successfully")

# Serve React app directly from Flask
from flask import send_from_directory
import os

@app.route('/')
def serve_main_app():
    """Serve the main product evaluation interface"""
    logger.info("=== Serving main product evaluation interface ===")
    try:
        from flask import render_template
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error serving main app: {e}")
        return f"Error loading app: {e}", 500

@app.route('/<path:path>')
def serve_react_static_files(path):
    """Serve React static files, or fallback to index.html for SPA routing"""
    logger.info(f"=== Serving static file request: {path} ===")
    full_path = os.path.join('static/react', path)
    if os.path.exists(full_path):
        logger.info(f"Found static file: {path}")
        return send_from_directory('static/react', path)
    else:
        logger.info(f"File not found, serving index.html for SPA routing: {path}")
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
    logger.info("=== /api/process endpoint called ===")
    try:
        data = request.get_json()
        logger.debug(f"Request data received: {data is not None}")
        
        if not data or 'product_idea' not in data:
            logger.warning("Missing product_idea in request body")
            return jsonify({
                'error': 'Missing product_idea in request body'
            }), 400
        
        product_idea = data['product_idea']
        logger.info(f"Product idea received - length: {len(product_idea)} characters")
        logger.debug(f"Product idea preview: {product_idea[:100]}...")
        
        if not product_idea or len(product_idea.strip()) < 10:
            logger.warning(f"Product idea too short: {len(product_idea)} characters")
            return jsonify({
                'error': 'Product idea is too short. Please provide more details.'
            }), 400
            
        # Process the product idea through all steps
        logger.info("Starting LLM processing...")
        start_time = time.time()
        results = llm_processor.process_all_steps(product_idea)
        end_time = time.time()
        
        logger.info(f"LLM processing completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in results:
            logger.error(f"LLM processing failed: {results['error']}")
            return jsonify({
                'error': results['error'],
                'step': results.get('step', 'unknown')
            }), 500
            
        logger.info("Returning successful results")
        logger.debug(f"Results contain {len(results.get('steps', []))} steps")
        return jsonify(results)
        
    except Exception as e:
        logger.exception("Unexpected error in process_product_idea")
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
    logger.info("=== /api/process_stream endpoint called ===")
    try:
        data = request.get_json()
        logger.debug(f"Stream request data received: {data is not None}")
        
        if not data or 'product_idea' not in data:
            logger.warning("Missing product_idea in stream request body")
            return jsonify({
                'error': 'Missing product_idea in request body'
            }), 400
        
        product_idea = data['product_idea']
        logger.info(f"Stream product idea received - length: {len(product_idea)} characters")
        
        if not product_idea or len(product_idea.strip()) < 10:
            logger.warning(f"Stream product idea too short: {len(product_idea)} characters")
            return jsonify({
                'error': 'Product idea is too short. Please provide more details.'
            }), 400
        
        def generate():
            logger.info("Starting stream generator")
            # Create a queue for progress updates
            progress_queue = queue.Queue()
            result_container = {}
            
            def progress_callback(update):
                logger.debug(f"Progress callback received: {update.get('status', 'unknown')}")
                progress_queue.put(update)
            
            def process_in_thread():
                try:
                    logger.info("Background processing thread started")
                    result = llm_processor.process_all_steps(product_idea, progress_callback)
                    result_container['result'] = result
                    progress_queue.put({'done': True})
                    logger.info("Background processing thread completed")
                except Exception as e:
                    logger.exception("Error in background processing thread")
                    progress_queue.put({
                        'error': True,
                        'message': f'Server error: {str(e)}'
                    })
            
            # Start processing in background thread
            thread = threading.Thread(target=process_in_thread)
            thread.daemon = True
            thread.start()
            logger.info("Background thread started")
            
            # Send initial status
            initial_update = {'status': 'started', 'message': 'Starting evaluation...', 'progress': 0}
            logger.debug(f"Sending initial update: {initial_update}")
            yield f"data: {json.dumps(initial_update)}\n\n"
            
            # Stream progress updates
            update_count = 0
            while True:
                try:
                    update = progress_queue.get(timeout=60)  # 60 second timeout
                    update_count += 1
                    logger.debug(f"Streaming update #{update_count}: {update.get('status', 'unknown')}")
                    
                    if update.get('done'):
                        logger.info("Processing completed - sending final result")
                        # Send final result
                        if 'result' in result_container:
                            if 'error' in result_container['result']:
                                yield f"data: {json.dumps({'error': result_container['result']['error'], 'step': result_container['result'].get('step', 'unknown')})}\n\n"
                            else:
                                yield f"data: {json.dumps({'complete': True, 'result': result_container['result']})}\n\n"
                        break
                    elif update.get('error'):
                        logger.error(f"Error in stream: {update['message']}")
                        yield f"data: {json.dumps({'error': update['message']})}\n\n"
                        break
                    else:
                        # Send progress update
                        yield f"data: {json.dumps(update)}\n\n"
                        
                except queue.Empty:
                    # Timeout - send keepalive
                    logger.debug("Stream timeout - sending keepalive")
                    yield f"data: {json.dumps({'keepalive': True})}\n\n"
                    continue
                except Exception as e:
                    logger.exception("Error in stream generator")
                    yield f"data: {json.dumps({'error': f'Stream error: {str(e)}'})}\n\n"
                    break
                    
            logger.info(f"Stream generator completed after {update_count} updates")
        
        logger.info("Returning streaming response")
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
        logger.exception("Error setting up stream")
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
    logger.info("=== /api/process_step endpoint called ===")
    try:
        data = request.get_json()
        logger.debug(f"Single step request data received: {data is not None}")
        
        if not data or 'step_id' not in data or 'input' not in data:
            logger.warning("Missing required fields in single step request")
            return jsonify({
                'error': 'Missing required fields (step_id, input) in request body'
            }), 400
            
        step_id = data['step_id']
        input_text = data['input']
        step_data = data.get('step_data', None)
        
        logger.info(f"Processing single step {step_id}")
        logger.debug(f"Input text length: {len(input_text)}")
        
        # Process the single step
        start_time = time.time()
        result = llm_processor.generate_step_response(step_id, input_text, step_data)
        end_time = time.time()
        
        logger.info(f"Single step {step_id} completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in result:
            logger.error(f"Single step {step_id} failed: {result['error']}")
            return jsonify({
                'error': result['error'],
                'step': step_id
            }), 500
            
        logger.info(f"Single step {step_id} successful")
        return jsonify(result)
        
    except Exception as e:
        logger.exception(f"Error processing single step {data.get('step_id', 'unknown')}")
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500
