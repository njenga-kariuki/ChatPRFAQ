import time
import logging

logger = logging.getLogger(__name__)

# Import database service for dual-write pattern
try:
    from utils.database_service import get_db_service
    DATABASE_ENABLED = True
    logger.info("Database service available for dual-write reporting")
except ImportError as e:
    logger.warning(f"Database service not available: {e}")
    DATABASE_ENABLED = False

# --- BEGIN: Raw LLM Output Cache ---
# Structure: {'request_id': {'timestamp': time.time(), 'steps_outputs': list}}
raw_llm_outputs_cache = {}
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours
MAX_CACHE_ENTRIES = 100 # Max number of unique request_id entries to keep

def store_raw_llm_output(request_id: str, step_info: str, raw_output: str):
    if not request_id or not step_info or not raw_output:
        logger.debug(f"Skipping storage: missing request_id, step_info, or raw_output. ReqID: {request_id}, StepInfo: {step_info}, OutputPresent: {bool(raw_output)}")
        return

    current_time = time.time()

    # === EXISTING CACHE LOGIC (UNCHANGED) ===
    # Evict oldest request_id entry if cache is full and new request_id is being added
    if request_id not in raw_llm_outputs_cache and len(raw_llm_outputs_cache) >= MAX_CACHE_ENTRIES:
        oldest_req_id_to_evict = None
        min_ts = float('inf')
        for r_id, entry in raw_llm_outputs_cache.items():
            if entry['timestamp'] < min_ts:
                min_ts = entry['timestamp']
                oldest_req_id_to_evict = r_id
        if oldest_req_id_to_evict:
            try:
                del raw_llm_outputs_cache[oldest_req_id_to_evict]
                logger.info(f"Evicted oldest request_id entry '{oldest_req_id_to_evict}' from cache due to size limit. Cache size: {len(raw_llm_outputs_cache)}")
            except KeyError:
                logger.warning(f"Failed to evict oldest request_id entry '{oldest_req_id_to_evict}', key not found.")

    # Get or initialize the entry for the request_id
    if request_id not in raw_llm_outputs_cache:
        raw_llm_outputs_cache[request_id] = {
            'timestamp': current_time, 
            'steps_outputs': []
        }
        logger.info(f"Initialized new cache entry for request_id '{request_id}'. Cache size: {len(raw_llm_outputs_cache)}")
    else:
        # Update the main timestamp for existing request_id to reflect recent activity
        raw_llm_outputs_cache[request_id]['timestamp'] = current_time

    # Append the current step's output
    step_output_entry = {
        'step_info': step_info,
        'raw_output': raw_output,
        'timestamp_step': current_time
    }
    raw_llm_outputs_cache[request_id]['steps_outputs'].append(step_output_entry)
    
    logger.debug(f"Stored/Appended raw LLM output for request_id '{request_id}', step '{step_info}'. Num steps stored for this ID: {len(raw_llm_outputs_cache[request_id]['steps_outputs'])}")

    # === NEW: DATABASE DUAL-WRITE (ADDITIVE ONLY) ===
    if DATABASE_ENABLED:
        try:
            # Extract step_id and step_name from step_info (format: "step_1_MarketResearch")
            step_parts = step_info.split('_')
            if len(step_parts) >= 3 and step_parts[0] == 'step':
                step_id = int(step_parts[1])
                step_name = '_'.join(step_parts[2:])
                
                # Save to database (non-blocking, graceful failure)
                db_service = get_db_service()
                db_service.save_step_output(
                    request_id=request_id,
                    step_id=step_id,
                    step_name=step_name,
                    raw_llm_output=raw_output
                )
                logger.debug(f"Database: Saved step output for {request_id}/step_{step_id}")
            else:
                logger.debug(f"Database: Could not parse step_info '{step_info}' for database storage")
                
        except Exception as e:
            # Log error but don't break existing functionality
            logger.error(f"Database: Failed to store step output for {request_id}: {e}")
            # Continue - cache storage was successful

def get_raw_llm_output(request_id: str):
    if not request_id:
        logger.debug(f"Cannot get raw LLM output due to missing request_id.")
        return None
    
    current_time = time.time()

    # Clean expired top-level request_id entries before retrieving
    for r_id_key in list(raw_llm_outputs_cache.keys()): 
        entry = raw_llm_outputs_cache.get(r_id_key)
        if entry and (current_time - entry['timestamp'] > CACHE_TTL_SECONDS):
            try:
                del raw_llm_outputs_cache[r_id_key]
                logger.info(f"Expired request_id entry '{r_id_key}' from cache. Cache size: {len(raw_llm_outputs_cache)}")
            except KeyError:
                logger.warning(f"Failed to remove expired request_id entry '{r_id_key}', key not found during TTL cleanup.")
    
    return raw_llm_outputs_cache.get(request_id) # Returns the dict {'timestamp': ..., 'steps_outputs': [...]} or None

# --- END: Raw LLM Output Cache --- 

# --- BEGIN: Insight Cache ---
def store_insight(request_id: str, step_id: int, insight: str, insight_label: str = None):
    """Store insight for a specific step, even after main processing completes"""
    if not request_id or not step_id or not insight:
        logger.debug(f"Skipping insight storage: missing required data. ReqID: {request_id}, StepID: {step_id}, InsightPresent: {bool(insight)}")
        return

    current_time = time.time()
    
    # === EXISTING CACHE LOGIC (UNCHANGED) ===
    # Get or initialize the entry for the request_id (reuse existing logic)
    if request_id not in raw_llm_outputs_cache:
        raw_llm_outputs_cache[request_id] = {
            'timestamp': current_time, 
            'steps_outputs': [],
            'insights': {}  # New field for insights
        }
        logger.info(f"Initialized new cache entry with insights for request_id '{request_id}'. Cache size: {len(raw_llm_outputs_cache)}")
    else:
        # Update timestamp and ensure insights field exists
        raw_llm_outputs_cache[request_id]['timestamp'] = current_time
        if 'insights' not in raw_llm_outputs_cache[request_id]:
            raw_llm_outputs_cache[request_id]['insights'] = {}
    
    # Store the insight for this step
    raw_llm_outputs_cache[request_id]['insights'][step_id] = {
        'insight': insight,
        'insight_label': insight_label,
        'timestamp': current_time
    }
    
    logger.info(f"Stored insight for request_id '{request_id}', step {step_id}: '{insight[:50]}...' with label '{insight_label}'")

    # === NEW: DATABASE DUAL-WRITE (ADDITIVE ONLY) ===
    if DATABASE_ENABLED:
        try:
            db_service = get_db_service()
            db_service.save_insight(
                request_id=request_id,
                step_id=step_id,
                insight_text=insight,
                insight_label=insight_label
            )
            logger.debug(f"Database: Saved insight for {request_id}/step_{step_id}")
            
        except Exception as e:
            # Log error but don't break existing functionality
            logger.error(f"Database: Failed to store insight for {request_id}: {e}")
            # Continue - cache storage was successful

def get_insights(request_id: str):
    """Get all stored insights for a request_id"""
    if not request_id:
        logger.debug(f"Cannot get insights due to missing request_id.")
        return {}
    
    current_time = time.time()
    
    # Clean expired entries (reuse existing TTL logic)
    for r_id_key in list(raw_llm_outputs_cache.keys()): 
        entry = raw_llm_outputs_cache.get(r_id_key)
        if entry and (current_time - entry['timestamp'] > CACHE_TTL_SECONDS):
            try:
                del raw_llm_outputs_cache[r_id_key]
                logger.info(f"Expired request_id entry '{r_id_key}' from cache. Cache size: {len(raw_llm_outputs_cache)}")
            except KeyError:
                logger.warning(f"Failed to remove expired request_id entry '{r_id_key}', key not found during TTL cleanup.")
    
    entry = raw_llm_outputs_cache.get(request_id)
    if entry and 'insights' in entry:
        logger.debug(f"Retrieved {len(entry['insights'])} insights for request_id '{request_id}'")
        return entry['insights']
    
    logger.debug(f"No insights found for request_id '{request_id}'")
    return {}
# --- END: Insight Cache --- 