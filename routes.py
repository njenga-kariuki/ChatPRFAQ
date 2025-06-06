from flask import request, jsonify, Response, render_template
from app import app
from processors.llm_processor import LLMProcessor
import logging
import json
import time
import threading
import queue
import os
import uuid

# Import cache utilities from the new location
from utils.raw_output_cache import store_raw_llm_output, get_raw_llm_output, get_insights

# Configure logging
logger = logging.getLogger(__name__)

# Import database service for session tracking (dual-write pattern)
try:
    from utils.database_service import get_db_service
    DATABASE_ENABLED = True
    logger.info("Database service available for session tracking")
except ImportError as e:
    logger.warning(f"Database service not available: {e}")
    DATABASE_ENABLED = False

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
    """Redirect to Vite dev server in development, serve production build in deployment"""
    import os
    
    # In production mode, serve the built React app instead of redirecting
    if os.environ.get('FLASK_DEPLOYMENT_MODE') == 'production':
        try:
            from flask import send_from_directory
            return send_from_directory('build/react', 'index.html')
        except Exception as e:
            return f"Error loading application: {e}", 500
    
    # Development mode: redirect to Vite dev server as before (preserves exact behavior)
    from flask import redirect
    return redirect('http://localhost:3000')

@app.route('/<path:path>')
def serve_react_static_files(path):
    """Redirect to Vite dev server in development, serve production assets in deployment"""
    import os
    
    # Skip API routes (always)
    if path.startswith('api/'):
        from flask import abort
        abort(404)
    
    # Skip reporting route (let Flask handle it directly)
    if path == 'reporting':
        from flask import abort
        abort(404)
    
    # In production mode, serve built assets or SPA fallback
    if os.environ.get('FLASK_DEPLOYMENT_MODE') == 'production':
        try:
            from flask import send_from_directory
            build_path = os.path.join('build/react', path)
            if os.path.exists(build_path) and os.path.isfile(build_path):
                # Serve the actual asset file
                return send_from_directory('build/react', path)
            else:
                # SPA fallback - serve index.html for client-side routing
                return send_from_directory('build/react', 'index.html')
        except Exception as e:
            # Final fallback
            return send_from_directory('build/react', 'index.html')
    
    # Development mode: redirect to Vite dev server as before (preserves exact behavior)
    from flask import redirect
    return redirect(f'http://localhost:3000/{path}')

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

        # === NEW: DATABASE SESSION TRACKING (ADDITIVE ONLY) ===
        if DATABASE_ENABLED:
            try:
                db_service = get_db_service()
                db_service.save_processing_session(request_id, product_idea)
                logger.debug(f"Database: Started session tracking for {request_id}")
            except Exception as e:
                logger.error(f"Database: Failed to start session tracking for {request_id}: {e}")
                # Continue - don't break processing
            
        # Process the product idea through all steps
        logger.info(f"[{request_id}] Starting LLM processing...")
        start_time = time.time()
        results = llm_processor.process_all_steps(product_idea, request_id=request_id)
        end_time = time.time()
        
        logger.info(f"[{request_id}] LLM processing completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in results:
            logger.error(f"[{request_id}] LLM processing failed: {results['error']}")
            
            # === NEW: DATABASE SESSION COMPLETION TRACKING (ADDITIVE ONLY) ===
            if DATABASE_ENABLED:
                try:
                    db_service = get_db_service()
                    db_service.update_session_completion(
                        request_id=request_id,
                        status='failed',
                        duration=end_time - start_time,
                        error=results['error']
                    )
                    logger.debug(f"Database: Updated session {request_id} as failed")
                except Exception as e:
                    logger.error(f"Database: Failed to update session completion for {request_id}: {e}")
            
            return jsonify({
                'error': results['error'],
                'step': results.get('step', 'unknown'),
                'request_id': request_id
            }), 500

        # === NEW: DATABASE SESSION COMPLETION TRACKING (ADDITIVE ONLY) ===
        if DATABASE_ENABLED:
            try:
                db_service = get_db_service()
                db_service.update_session_completion(
                    request_id=request_id,
                    status='completed',
                    duration=end_time - start_time
                )
                logger.debug(f"Database: Updated session {request_id} as completed")
            except Exception as e:
                logger.error(f"Database: Failed to update session completion for {request_id}: {e}")
            
        logger.info(f"[{request_id}] Returning successful results")
        logger.debug(f"[{request_id}] Results contain {len(results.get('steps', []))} steps")
        final_response = results.copy()
        final_response['request_id'] = request_id
        return jsonify(final_response)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error in process_product_idea")
        return jsonify({
            'error': f'Server error: {str(e)}',
            'request_id': request_id
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

        # === NEW: DATABASE SESSION TRACKING (ADDITIVE ONLY) ===
        if DATABASE_ENABLED:
            try:
                db_service = get_db_service()
                db_service.save_processing_session(request_id, product_idea)
                logger.debug(f"Database: Started session tracking for {request_id} (stream)")
            except Exception as e:
                logger.error(f"Database: Failed to start session tracking for {request_id} (stream): {e}")
                # Continue - don't break processing
        
        def generate():
            logger.info(f"[{request_id}] Starting stream generator")
            # Create a queue for progress updates
            progress_queue = queue.Queue()
            result_container = {}
            last_heartbeat = {'time': time.time()}
            
            def safe_progress_callback(update):
                """Protected progress callback that won't kill the background thread"""
                try:
                    # Don't log heartbeat messages to avoid log clutter
                    if update.get('type') != 'heartbeat':
                        logger.info(f"[{request_id}] Step {update.get('step', '?')} | {update.get('status', 'unknown')}")
                    progress_queue.put(update)
                except Exception as e:
                    logger.error(f"[{request_id}] Progress callback failed but thread continues: {e}")
                    # Don't re-raise - keep the background thread alive
                    try:
                        progress_queue.put({
                            'type': 'log',
                            'level': 'error',
                            'message': f'🚨 Progress callback failed: {str(e)}',
                            'request_id': request_id
                        })
                    except:
                        pass  # Final safety net
            
            def process_in_thread():
                processing_start_time = time.time()
                try:
                    logger.info(f"[{request_id}] Background processing thread started")
                    
                    # Send thread start log to frontend
                    safe_progress_callback({
                        'type': 'log',
                        'level': 'info',
                        'message': '🧵 Background processing thread started',
                        'request_id': request_id
                    })
                    
                    # Heartbeat mechanism with stop flag
                    heartbeat_stop = {'stop': False}
                    import threading
                    def heartbeat():
                        while not heartbeat_stop['stop']:
                            try:
                                last_heartbeat['time'] = time.time()
                                safe_progress_callback({
                                    'type': 'heartbeat',
                                    'timestamp': time.time(),
                                    'request_id': request_id
                                })
                                time.sleep(15)  # Heartbeat every 15 seconds
                            except:
                                break  # Exit heartbeat if main thread ends
                    
                    heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
                    heartbeat_thread.start()
                    
                    result = llm_processor.process_all_steps(product_idea, safe_progress_callback, request_id=request_id)
                    result_container['result'] = result
                    processing_end_time = time.time()
                    
                    # Stop heartbeat thread
                    heartbeat_stop['stop'] = True

                    # === NEW: DATABASE SESSION COMPLETION TRACKING (ADDITIVE ONLY) ===
                    if DATABASE_ENABLED:
                        try:
                            db_service = get_db_service()
                            if 'error' in result:
                                db_service.update_session_completion(
                                    request_id=request_id,
                                    status='failed',
                                    duration=processing_end_time - processing_start_time,
                                    error=result['error']
                                )
                                logger.debug(f"Database: Updated session {request_id} as failed (stream)")
                            else:
                                db_service.update_session_completion(
                                    request_id=request_id,
                                    status='completed',
                                    duration=processing_end_time - processing_start_time
                                )
                                logger.debug(f"Database: Updated session {request_id} as completed (stream)")
                        except Exception as e:
                            logger.error(f"Database: Failed to update session completion for {request_id} (stream): {e}")
                    
                    # Send completion log
                    safe_progress_callback({
                        'type': 'log',
                        'level': 'info',
                        'message': '✅ Background processing completed successfully',
                        'request_id': request_id
                    })
                    
                    progress_queue.put({'done': True})
                    logger.info(f"[{request_id}] Background processing thread completed")
                    
                except Exception as e:
                    # Stop heartbeat thread on error too
                    heartbeat_stop['stop'] = True
                    processing_end_time = time.time()
                    
                    logger.exception(f"[{request_id}] Error in background processing thread")

                    # === NEW: DATABASE SESSION ERROR TRACKING (ADDITIVE ONLY) ===
                    if DATABASE_ENABLED:
                        try:
                            db_service = get_db_service()
                            db_service.update_session_completion(
                                request_id=request_id,
                                status='failed',
                                duration=processing_end_time - processing_start_time,
                                error=str(e)
                            )
                            logger.debug(f"Database: Updated session {request_id} as failed due to exception (stream)")
                        except Exception as db_e:
                            logger.error(f"Database: Failed to update session exception for {request_id} (stream): {db_e}")
                    
                    # Send error log to frontend
                    safe_progress_callback({
                        'type': 'log',
                        'level': 'error',
                        'message': f'🚨 Background thread failed: {str(e)}',
                        'request_id': request_id
                    })
                    
                    progress_queue.put({
                        'error': True,
                        'message': f'Server error: {str(e)}'
                    })
            
            # Start processing in background thread
            thread = threading.Thread(target=process_in_thread)
            thread.daemon = True
            thread.start()
            logger.info(f"[{request_id}] Background thread started")
            
            # Send initial status, including request_id
            initial_update = {'status': 'started', 'message': 'Starting evaluation...', 'progress': 0, 'request_id': request_id}
            logger.debug(f"[{request_id}] Sending initial update: {initial_update}")
            yield f"data: {json.dumps(initial_update)}\n\n"
            
            # Stream progress updates
            update_count = 0
            last_step_time = time.time()
            current_step_id = None  # Track current step for step-aware timeouts
            
            while True:
                try:
                    update = progress_queue.get(timeout=10)  # Reduced from 60s to 10s for faster detection
                    update_count += 1
                    current_time = time.time()
                    
                    # Log step timing for debugging
                    if update.get('step'):
                        step_duration = current_time - last_step_time
                        logger.info(f"[{request_id}] Step {update.get('step')} update after {step_duration:.1f}s | Status: {update.get('status', 'unknown')}")
                        last_step_time = current_time
                        # Track current step for step-aware timeouts
                        current_step_id = update.get('step')
                    
                    # Update heartbeat tracking for non-heartbeat messages
                    if update.get('type') != 'heartbeat':
                        last_heartbeat['time'] = current_time
                    else:
                        # Reset elapsed time on heartbeat for long-running steps (9-10)
                        if current_step_id and current_step_id >= 9:
                            last_step_time = current_time
                            logger.debug(f"[{request_id}] Heartbeat reset elapsed time for Step {current_step_id}")
                    
                    logger.debug(f"[{request_id}] Streaming update #{update_count}: {update.get('status', 'unknown')}")
                    
                    if update.get('done'):
                        logger.info(f"[{request_id}] Processing completed - sending final result")
                        # Send final result
                        if 'result' in result_container:
                            if 'error' in result_container['result']:
                                error_step = result_container['result'].get('step', 'unknown')
                                logger.error(f"[{request_id}] Final result contains error at step {error_step}: {result_container['result']['error']}")
                                yield f"data: {json.dumps({'error': result_container['result']['error'], 'step': error_step, 'request_id': request_id})}\n\n"
                            else:
                                logger.info(f"[{request_id}] Sending successful completion result")
                                yield f"data: {json.dumps({'complete': True, 'result': result_container['result'], 'request_id': request_id})}\n\n"
                        break
                    elif update.get('error'):
                        logger.error(f"[{request_id}] Error in stream: {update['message']}")
                        yield f"data: {json.dumps({'error': update['message'], 'request_id': request_id})}\n\n"
                        break
                    else:
                        # Send progress update (including logs and heartbeats)
                        yield f"data: {json.dumps(update)}\n\n"
                        
                except queue.Empty:
                    # Faster timeout detection with thread health checking
                    elapsed_time = time.time() - last_step_time
                    heartbeat_elapsed = time.time() - last_heartbeat['time']
                    thread_alive = thread.is_alive()
                    
                    logger.warning(f"[{request_id}] Stream timeout after {elapsed_time:.1f}s | Thread alive: {thread_alive} | Heartbeat age: {heartbeat_elapsed:.1f}s | Current step: {current_step_id}")
                    
                    # Check if thread died
                    if not thread_alive:
                        logger.error(f"[{request_id}] Background thread died unexpectedly")
                        yield f"data: {json.dumps({'error': 'Processing thread failed unexpectedly. Please try again.', 'request_id': request_id})}\n\n"
                        break
                    
                    # Check if we've lost heartbeat (thread might be hung)
                    if heartbeat_elapsed > 45:  # No heartbeat for 45 seconds = hung thread
                        logger.error(f"[{request_id}] Thread appears hung (no heartbeat for {heartbeat_elapsed:.1f}s)")
                        yield f"data: {json.dumps({'error': 'Processing appears to be stuck. Please try again.', 'request_id': request_id})}\n\n"
                        break
                    
                    # Step-aware timeout: longer timeout for steps 9-10 (PRFAQ synthesis and MLP plan)
                    timeout_threshold = 180 if current_step_id and current_step_id >= 9 else 120
                    
                    # If we've been stuck for too long, consider it a failure
                    if elapsed_time > timeout_threshold:
                        step_info = f" (Step {current_step_id})" if current_step_id else ""
                        logger.error(f"[{request_id}] Processing appears stuck{step_info} - terminating stream after {elapsed_time:.1f}s (threshold: {timeout_threshold}s)")
                        yield f"data: {json.dumps({'error': 'Processing timeout - the operation took too long to complete. Please try again.', 'request_id': request_id})}\n\n"
                        break
                    
                    yield f"data: {json.dumps({'keepalive': True, 'message': 'Processing continues...', 'request_id': request_id})}\n\n"
                    continue
                except Exception as e:
                    logger.exception(f"[{request_id}] Error in stream generator")
                    yield f"data: {json.dumps({'error': f'Stream error: {str(e)}', 'request_id': request_id})}\n\n"
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
            'error': f'Server error: {str(e)}',
            'request_id': request_id
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
        result = llm_processor.generate_step_response(step_id, input_text, step_data, request_id=request_id)
        end_time = time.time()
        
        logger.info(f"[{request_id}] Single step {step_id} completed in {end_time - start_time:.2f} seconds")
        
        if 'error' in result:
            logger.error(f"[{request_id}] Single step {step_id} failed: {result['error']}")
            return jsonify({
                'error': result['error'],
                'step': step_id,
                'request_id': request_id
            }), 500
            
        logger.info(f"[{request_id}] Single step {step_id} successful")
        final_response = result.copy()
        final_response['request_id'] = request_id
        return jsonify(final_response)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Error processing single step {data.get('step_id', 'unknown')}")
        return jsonify({
            'error': f'Server error: {str(e)}',
            'request_id': request_id
        }), 500

@app.route('/api/analyze_product_idea', methods=['POST'])
def analyze_product_idea():
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /analyze_product_idea endpoint called")
    try:
        data = request.get_json()
        if not data or 'product_idea' not in data:
            logger.warning(f"[{request_id}] Missing product_idea for analyze_product_idea")
            return jsonify({'error': 'Missing product_idea', 'request_id': request_id}), 400
        
        result = llm_processor.analyze_product_idea(data['product_idea'], request_id=request_id)
        
        if 'error' in result:
            logger.error(f"[{request_id}] Product analysis failed: {result['error']}")
            error_response = result.copy()
            if 'request_id' not in error_response: error_response['request_id'] = request_id
            return jsonify(error_response), 500
        
        final_response = result.copy()
        if 'request_id' not in final_response: final_response['request_id'] = request_id
        logger.info(f"[{request_id}] Product analysis successful.")
        return jsonify(final_response)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error in analyze_product_idea")
        return jsonify({'error': str(e), 'request_id': request_id}), 500

@app.route('/api/refine_analysis', methods=['POST'])
def refine_analysis():
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /refine_analysis endpoint called")
    try:
        data = request.get_json()
        required_fields = ['original_input', 'current_analysis', 'feedback']
        
        if not data or not all(field in data for field in required_fields):
            logger.warning(f"[{request_id}] Missing required fields for refine_analysis")
            return jsonify({'error': 'Missing required fields', 'request_id': request_id}), 400
        
        result = llm_processor.refine_product_analysis(
            data['original_input'],
            data['current_analysis'], 
            data['feedback'],
            request_id=request_id
        )
        
        if 'error' in result:
            logger.error(f"[{request_id}] Refine analysis failed: {result['error']}")
            return jsonify({'error': result['error'], 'request_id': request_id}), 500
        
        final_response = result.copy()
        final_response['request_id'] = request_id
        return jsonify(final_response)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error in refine_analysis")
        return jsonify({'error': str(e), 'request_id': request_id}), 500

@app.route('/api/create_enriched_brief', methods=['POST'])
def create_enriched_brief():
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /create_enriched_brief endpoint called")
    try:
        data = request.get_json()
        required_fields = ['original_idea', 'analysis']
        
        if not data or not all(field in data for field in required_fields):
            logger.warning(f"[{request_id}] Missing required fields for create_enriched_brief")
            return jsonify({'error': 'Missing required fields', 'request_id': request_id}), 400
        
        brief = llm_processor.create_enriched_product_brief(
            data['original_idea'],
            data['analysis']
        )
        
        return jsonify({'brief': brief, 'request_id': request_id})
        
    except Exception as e:
        logger.exception(f"[{request_id}] Unexpected error in create_enriched_brief")
        return jsonify({'error': str(e), 'request_id': request_id}), 500

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
    request_id = generate_request_id()
    logger.info(f"[{request_id}] API /api/debug/test-step/{step_id} endpoint called")
    try:
        data = request.get_json()
        if not data or 'input' not in data:
            logger.warning(f"[{request_id}] Missing input in request body for test-step")
            return jsonify({'error': 'Missing input in request body', 'request_id': request_id}), 400
        
        input_text = data['input']
        step_data = data.get('step_data', {})
        
        logger.info(f"[{request_id}] Debug: Testing step {step_id} with input length {len(input_text)}")
        
        result = llm_processor.generate_step_response(step_id, input_text, step_data, request_id=request_id)
        
        final_response = {
            "step_id": step_id,
            "success": "error" not in result,
            "result": result,
            "request_id": request_id
        }
        return jsonify(final_response)
        
    except Exception as e:
        logger.exception(f"[{request_id}] Debug: Error testing step {step_id}")
        return jsonify({"error": str(e), 'request_id': request_id}), 500

# --- BEGIN: New Raw LLM Output Debug Endpoint ---
@app.route('/api/debug/get_raw_llm_output', methods=['GET'])
def get_raw_llm_output_route():
    """Endpoint to retrieve all raw LLM outputs for a given request_id."""
    query_request_id = request.args.get('request_id')
    # query_step_info = request.args.get('step_info') # REMOVE: No longer needed

    if not query_request_id:
        return jsonify({"error": "request_id parameter is required"}), 400
    # if not query_step_info: # REMOVE: No longer needed
    #     return jsonify({"error": "step_info parameter is required (e.g., step_0_Analyze Product Concept)"}), 400

    # Call get_raw_llm_output with only request_id
    output_entry_for_request_id = get_raw_llm_output(query_request_id)
    # cache_key_used = f"{query_request_id}_{query_step_info}" # REMOVE: No longer needed

    if output_entry_for_request_id:
        logger.info(f"Retrieved all raw LLM outputs for request_id '{query_request_id}' via debug API.")
        return jsonify(output_entry_for_request_id) # This now contains the list of step outputs
    else:
        logger.warn(f"No raw LLM output found in cache for request_id '{query_request_id}' for debug API.")
        return jsonify({"error": f"Raw output not found for request_id '{query_request_id}' (may have expired or not been stored)"}), 404
# --- END: New Raw LLM Output Debug Endpoint ---

# --- BEGIN: Insights API Endpoint ---
@app.route('/api/insights/<request_id>', methods=['GET'])
def get_request_insights(request_id):
    """
    Fetch any stored insights for a specific request_id.
    Used to retrieve insights that may have been generated after stream completion.
    """
    logger.info(f"[{request_id}] Fetching insights via API")
    
    try:
        insights = get_insights(request_id)
        
        if insights:
            logger.info(f"[{request_id}] Retrieved {len(insights)} insights via API")
            return jsonify({
                "success": True,
                "insights": insights,
                "request_id": request_id
            })
        else:
            logger.debug(f"[{request_id}] No insights found via API")
            return jsonify({
                "success": True,
                "insights": {},
                "request_id": request_id
            })
            
    except Exception as e:
        logger.error(f"[{request_id}] Error fetching insights via API: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "request_id": request_id
        }), 500
# --- END: Insights API Endpoint ---

# --- BEGIN: Safe Insights API Endpoint with Query Parameters ---
@app.route('/api/insights', methods=['GET'])
def get_insights_by_query():
    """
    Fetch any stored insights for a specific request_id using query parameters.
    Used to retrieve insights that may have been generated after stream completion.
    Safe route that won't conflict with React app routing.
    """
    request_id = request.args.get('request_id')
    
    if not request_id:
        return jsonify({
            "success": False,
            "error": "request_id parameter is required",
            "request_id": None
        }), 400
    
    logger.info(f"[{request_id}] Fetching insights via safe API")
    
    try:
        insights = get_insights(request_id)
        
        if insights:
            logger.info(f"[{request_id}] Retrieved {len(insights)} insights via safe API")
            return jsonify({
                "success": True,
                "insights": insights,
                "request_id": request_id
            })
        else:
            logger.debug(f"[{request_id}] No insights found via safe API")
            return jsonify({
                "success": True,
                "insights": {},
                "request_id": request_id
            })
            
    except Exception as e:
        logger.error(f"[{request_id}] Error fetching insights via safe API: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e),
            "request_id": request_id
        }), 500
# --- END: Safe Insights API Endpoint ---

# =============================================================================
# REPORTING WEB INTERFACE (ULTRA-SAFE IMPLEMENTATION)
# =============================================================================

@app.route('/reporting')
def reporting_dashboard():
    """
    Reporting dashboard web interface.
    Ultra-safe implementation: completely isolated from core functionality.
    """
    try:
        # Completely isolated - just render the template
        return render_template('reporting.html')
    except Exception as e:
        # Graceful failure - never break the app
        logger.error(f"Reporting dashboard error: {e}")
        return f"""
        <html>
        <head><title>Reporting Dashboard - Error</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>⚠️ Reporting Dashboard Temporarily Unavailable</h1>
            <p>The reporting system encountered an error and is temporarily unavailable.</p>
            <p>Your main application continues to work normally.</p>
            <p>Error: {str(e)}</p>
            <a href="/" style="color: #3b82f6;">← Return to Main App</a>
        </body>
        </html>
        """, 500

# =============================================================================
# REPORTING API ENDPOINTS
# =============================================================================

@app.route('/api/reporting/usage', methods=['GET'])
def get_usage_report():
    """
    Returns usage analytics with filtering capabilities.
    
    Query parameters:
    - start_date: Filter start date (YYYY-MM-DD format)
    - end_date: Filter end date (YYYY-MM-DD format)  
    - granularity: Data granularity ('daily', 'weekly', 'monthly')
    
    Returns analytics including:
    - Total ideas processed
    - Success/failure rates
    - Average processing time
    - Step-level performance metrics
    - Daily trends
    """
    logger.info("API /api/reporting/usage endpoint called")
    
    if not DATABASE_ENABLED:
        return jsonify({
            'error': 'Reporting database not available',
            'message': 'Database service is not configured'
        }), 503
    
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        granularity = request.args.get('granularity', 'daily')
        
        # Validate date format if provided
        if start_date:
            try:
                from datetime import datetime
                datetime.strptime(start_date, '%Y-%m-%d')
            except ValueError:
                return jsonify({
                    'error': 'Invalid start_date format',
                    'message': 'Please use YYYY-MM-DD format'
                }), 400
                
        if end_date:
            try:
                from datetime import datetime
                datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError:
                return jsonify({
                    'error': 'Invalid end_date format', 
                    'message': 'Please use YYYY-MM-DD format'
                }), 400
        
        db_service = get_db_service()
        analytics = db_service.get_usage_analytics(start_date, end_date, granularity)
        
        if 'error' in analytics:
            logger.error(f"Usage analytics failed: {analytics['error']}")
            return jsonify({
                'error': 'Failed to generate usage analytics',
                'details': analytics['error']
            }), 500
        
        logger.info(f"Usage analytics retrieved successfully: {analytics['summary']['total_sessions']} total sessions")
        return jsonify({
            'success': True,
            'data': analytics,
            'filters': {
                'start_date': start_date,
                'end_date': end_date,
                'granularity': granularity
            }
        })
        
    except Exception as e:
        logger.exception("Error in usage analytics endpoint")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/api/reporting/ideas', methods=['GET'])
def get_ideas_report():
    """
    Returns paginated list of processed ideas with search and filtering.
    
    Query parameters:
    - page: Page number (default: 1)
    - limit: Items per page (default: 50, max: 100)
    - status: Filter by status ('processing', 'completed', 'failed')
    - search: Search in idea text
    
    Returns paginated list with:
    - Original idea text (truncated)
    - Processing status and duration
    - Timestamp and metadata
    - Pagination info
    """
    logger.info("API /api/reporting/ideas endpoint called")
    
    if not DATABASE_ENABLED:
        return jsonify({
            'error': 'Reporting database not available',
            'message': 'Database service is not configured'
        }), 503
    
    try:
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 50)), 100)  # Cap at 100
        status = request.args.get('status')
        search = request.args.get('search')
        
        if page < 1:
            return jsonify({
                'error': 'Invalid page number',
                'message': 'Page must be >= 1'
            }), 400
            
        if limit < 1:
            return jsonify({
                'error': 'Invalid limit',
                'message': 'Limit must be >= 1'
            }), 400
            
        # Validate status filter
        if status and status not in ['processing', 'completed', 'failed']:
            return jsonify({
                'error': 'Invalid status filter',
                'message': 'Status must be one of: processing, completed, failed'
            }), 400
        
        db_service = get_db_service()
        ideas_data = db_service.get_ideas_list(page, limit, status, search)
        
        if 'error' in ideas_data:
            logger.error(f"Ideas list failed: {ideas_data['error']}")
            return jsonify({
                'error': 'Failed to retrieve ideas list',
                'details': ideas_data['error']
            }), 500
        
        logger.info(f"Ideas list retrieved: page {page}, {len(ideas_data['ideas'])} items")
        return jsonify({
            'success': True,
            'data': ideas_data,
            'filters': {
                'page': page,
                'limit': limit,
                'status': status,
                'search': search
            }
        })
        
    except ValueError as e:
        return jsonify({
            'error': 'Invalid parameter format',
            'message': str(e)
        }), 400
    except Exception as e:
        logger.exception("Error in ideas list endpoint")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/api/reporting/session/<request_id>', methods=['GET'])
def get_session_details(request_id):
    """
    Returns complete processing details for specific session.
    
    URL parameter:
    - request_id: Unique session identifier
    
    Returns detailed session data including:
    - Original idea and session metadata
    - Full step-by-step outputs
    - Timing breakdown
    - Raw LLM responses
    - Extracted insights
    """
    logger.info(f"API /api/reporting/session/{request_id} endpoint called")
    
    if not DATABASE_ENABLED:
        return jsonify({
            'error': 'Reporting database not available',
            'message': 'Database service is not configured'
        }), 503
    
    if not request_id or len(request_id.strip()) == 0:
        return jsonify({
            'error': 'Invalid request_id',
            'message': 'request_id cannot be empty'
        }), 400
    
    try:
        db_service = get_db_service()
        session_data = db_service.get_session_details(request_id)
        
        if 'error' in session_data:
            if session_data['error'] == 'Session not found':
                return jsonify({
                    'error': 'Session not found',
                    'message': f'No session found with request_id: {request_id}'
                }), 404
            else:
                logger.error(f"Session details failed for {request_id}: {session_data['error']}")
                return jsonify({
                    'error': 'Failed to retrieve session details',
                    'details': session_data['error']
                }), 500
        
        logger.info(f"Session details retrieved for {request_id}: {len(session_data['steps'])} steps")
        return jsonify({
            'success': True,
            'data': session_data
        })
        
    except Exception as e:
        logger.exception(f"Error in session details endpoint for {request_id}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/api/reporting/analytics', methods=['GET'])
def get_analytics_dashboard():
    """
    Returns dashboard-ready analytics and key performance indicators.
    
    Query parameters:
    - timeframe: Analysis timeframe ('7d', '30d', '90d', 'all')
    - metrics: Comma-separated metrics to include
    
    Returns comprehensive analytics including:
    - Processing trends over time
    - Performance bottlenecks
    - Success rate analysis
    - Cost and usage projections
    """
    logger.info("API /api/reporting/analytics endpoint called")
    
    if not DATABASE_ENABLED:
        return jsonify({
            'error': 'Reporting database not available',
            'message': 'Database service is not configured'
        }), 503
    
    try:
        timeframe = request.args.get('timeframe', '30d')
        requested_metrics = request.args.get('metrics', '').split(',') if request.args.get('metrics') else []
        
        # Calculate date range based on timeframe
        start_date = None
        if timeframe != 'all':
            from datetime import datetime, timedelta
            days_map = {'7d': 7, '30d': 30, '90d': 90}
            if timeframe in days_map:
                start_date = (datetime.now() - timedelta(days=days_map[timeframe])).strftime('%Y-%m-%d')
            else:
                return jsonify({
                    'error': 'Invalid timeframe',
                    'message': 'Timeframe must be one of: 7d, 30d, 90d, all'
                }), 400
        
        db_service = get_db_service()
        usage_analytics = db_service.get_usage_analytics(start_date, None, 'daily')
        
        if 'error' in usage_analytics:
            logger.error(f"Analytics dashboard failed: {usage_analytics['error']}")
            return jsonify({
                'error': 'Failed to generate analytics dashboard',
                'details': usage_analytics['error']
            }), 500
        
        # Build dashboard-specific response
        dashboard_data = {
            'summary': usage_analytics['summary'],
            'trends': usage_analytics['daily_trends'][:14],  # Last 14 days for chart
            'step_performance': usage_analytics['step_analytics'],
            'timeframe': timeframe,
            'generated_at': time.time()
        }
        
        # Add computed metrics
        summary = usage_analytics['summary']
        if summary['total_sessions'] > 0:
            dashboard_data['computed_metrics'] = {
                'success_rate_percentage': round(summary['success_rate'], 2),
                'avg_duration_minutes': round(summary['avg_duration_seconds'] / 60, 2) if summary['avg_duration_seconds'] else 0,
                'sessions_per_day': round(summary['total_sessions'] / max(len(usage_analytics['daily_trends']), 1), 2),
                'fastest_step': min(usage_analytics['step_analytics'], key=lambda x: x['avg_duration_seconds'] or float('inf'), default={'step_name': 'N/A', 'avg_duration_seconds': 0})['step_name'],
                'slowest_step': max(usage_analytics['step_analytics'], key=lambda x: x['avg_duration_seconds'] or 0, default={'step_name': 'N/A', 'avg_duration_seconds': 0})['step_name']
            }
        
        logger.info(f"Analytics dashboard generated: {timeframe} timeframe, {summary['total_sessions']} sessions")
        return jsonify({
            'success': True,
            'data': dashboard_data
        })
        
    except Exception as e:
        logger.exception("Error in analytics dashboard endpoint")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500
