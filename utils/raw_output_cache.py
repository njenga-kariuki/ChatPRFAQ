import time
import logging

logger = logging.getLogger(__name__)

# --- BEGIN: Raw LLM Output Cache ---
# Structure: {'request_id': {'timestamp': time.time(), 'data': 'raw_llm_text', 'step_id': 'step_id_or_name'}}
raw_llm_outputs_cache = {}
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours
MAX_CACHE_ENTRIES = 100 # Max number of entries to keep

def store_raw_llm_output(request_id: str, step_info: str, raw_output: str):
    if not request_id or not raw_output:
        logger.debug(f"Skipping storage of raw LLM output due to missing request_id or raw_output. Request ID: {request_id}, Output Present: {bool(raw_output)}")
        return

    current_time = time.time()
    # Evict oldest if cache is full
    if len(raw_llm_outputs_cache) >= MAX_CACHE_ENTRIES:
        oldest_req_id = None
        min_ts = float('inf')
        for req_id, entry in raw_llm_outputs_cache.items():
            if entry['timestamp'] < min_ts:
                min_ts = entry['timestamp']
                oldest_req_id = req_id
        if oldest_req_id:
            try:
                del raw_llm_outputs_cache[oldest_req_id]
                logger.info(f"[{oldest_req_id}] Evicted oldest raw LLM output from cache due to size limit. Cache size: {len(raw_llm_outputs_cache)}")
            except KeyError:
                # This should ideally not happen if oldest_req_id is from the cache keys
                logger.warning(f"[{oldest_req_id}] Failed to evict oldest raw LLM output, key not found during eviction.")


    raw_llm_outputs_cache[request_id] = {
        "timestamp": current_time,
        "step_info": step_info,
        "data": raw_output
    }
    logger.debug(f"[{request_id}] Stored raw LLM output for step '{step_info}'. Cache size: {len(raw_llm_outputs_cache)}")

def get_raw_llm_output(request_id: str):
    if not request_id:
        return None
        
    current_time = time.time()
    # Clean expired entries before retrieving
    # Iterating over a copy of keys for safe deletion
    for key in list(raw_llm_outputs_cache.keys()): 
        entry = raw_llm_outputs_cache.get(key) # Get entry safely
        if entry and (current_time - entry['timestamp'] > CACHE_TTL_SECONDS):
            try:
                del raw_llm_outputs_cache[key]
                logger.info(f"[{key}] Expired raw LLM output from cache. Cache size: {len(raw_llm_outputs_cache)}")
            except KeyError:
                # Entry might have been deleted by another thread/process if running in such environment, or due to MAX_CACHE_ENTRIES eviction
                logger.warning(f"[{key}] Failed to remove expired raw LLM output, key not found during TTL cleanup.")
    
    return raw_llm_outputs_cache.get(request_id)

# --- END: Raw LLM Output Cache --- 