#!/usr/bin/env python3
import os
import sys

# Add parent directory to path so we can import config and processors
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test 1: Check environment variable
api_key = os.environ.get("PERPLEXITY_API_KEY", "")
print(f"API Key present: {bool(api_key)}")
print(f"API Key length: {len(api_key)}")

if not api_key:
    print("ERROR: No API key found")
    sys.exit(1)

# Test 2: Test direct API call with fix
try:
    from openai import OpenAI
    
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.perplexity.ai"
    )
    
    print("Testing Perplexity API with extra_headers fix...")
    
    response = client.chat.completions.create(
        model="sonar-pro",
        messages=[
            {"role": "user", "content": "Say 'API test successful' if you can respond."}
        ],
        max_tokens=20,
        extra_headers={"Authorization": f"Bearer {api_key}"}
    )
    
    if response and response.choices:
        print(f"SUCCESS: {response.choices[0].message.content}")
    else:
        print("ERROR: No response")
        
except Exception as e:
    print(f"ERROR: {e}")

# Test 3: Test PerplexityProcessor class
try:
    from processors.perplexity_processor import PerplexityProcessor
    
    print("Testing PerplexityProcessor...")
    processor = PerplexityProcessor()
    
    result = processor.conduct_initial_market_research(
        product_idea="test product",
        system_prompt="You are helpful.",
        user_prompt="Briefly analyze: {input}",
        progress_callback=None
    )
    
    if "error" in result:
        print(f"PROCESSOR ERROR: {result['error']}")
    else:
        print("PROCESSOR SUCCESS: Got response")
        
except Exception as e:
    print(f"PROCESSOR ERROR: {e}") 