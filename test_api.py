#!/usr/bin/env python3
"""
Test script to verify Claude API integration
"""

import os
import sys
import time

# Basic imports check
try:
    print("Testing imports...")
    import anthropic
    print("✓ Anthropic import successful")
    
    from flask import Flask
    print("✓ Flask import successful")
    
    from flask_cors import CORS
    print("✓ Flask-CORS import successful")
    
    # Test project-specific imports
    print("\nTesting project imports...")
    
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("✗ ANTHROPIC_API_KEY not found in environment")
        sys.exit(1)
    print("✓ ANTHROPIC_API_KEY found in environment")
    
    from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS
    print("✓ Config import successful")
    print(f"✓ Model configured: {CLAUDE_MODEL}")
    
    from llm_processor import LLMProcessor
    print("✓ LLMProcessor import successful")
    
    from perplexity_processor import PerplexityProcessor
    print("✓ PerplexityProcessor import successful")
    
    from claude_processor import ClaudeProcessor
    print("✓ ClaudeProcessor import successful")
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

def test_claude_api():
    """Test basic Claude API functionality"""
    print("\n=== Testing Claude API ===")
    
    try:
        from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
        
        if not ANTHROPIC_API_KEY:
            print("✗ ANTHROPIC_API_KEY not configured")
            return False
        
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        print("✓ Claude API client configured")
        
        # Test basic API call
        print(f"✓ Testing model: {CLAUDE_MODEL}")
        
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=100,
            temperature=0.7,
            messages=[
                {"role": "user", "content": "Hello, Claude! Please respond with 'API test successful' to confirm the connection works."}
            ]
        )
        
        if response and response.content and response.content[0].text:
            print(f"✓ Claude API test successful")
            print(f"Response: {response.content[0].text[:100]}...")
            return True
        else:
            print("✗ Invalid response from Claude API")
            return False
            
    except Exception as e:
        print(f"✗ Claude API test failed: {e}")
        return False

def test_claude_processor():
    """Test ClaudeProcessor functionality"""
    print("\n=== Testing ClaudeProcessor ===")
    
    try:
        processor = ClaudeProcessor()
        print("✓ ClaudeProcessor initialized")
        
        result = processor.generate_response(
            system_prompt="You are a helpful assistant.",
            user_prompt="Say 'ClaudeProcessor test successful' to confirm this works.",
            progress_callback=None,
            step_id=None
        )
        
        if "error" in result:
            print(f"✗ ClaudeProcessor test failed: {result['error']}")
            return False
        
        if "output" in result and result["output"]:
            print("✓ ClaudeProcessor test successful")
            print(f"Response: {result['output'][:100]}...")
            return True
        else:
            print("✗ Invalid response from ClaudeProcessor")
            return False
            
    except Exception as e:
        print(f"✗ ClaudeProcessor test failed: {e}")
        return False

def test_llm_processor():
    """Test LLMProcessor with Claude integration"""
    print("\n=== Testing LLMProcessor ===")
    
    try:
        processor = LLMProcessor()
        print("✓ LLMProcessor initialized")
        
        # Test product analysis (Step 0)
        result = processor.analyze_product_idea("A simple test product idea for API testing")
        
        if "error" in result:
            print(f"✗ LLMProcessor test failed: {result['error']}")
            return False
        
        if "analysis" in result and result["analysis"]:
            print("✓ LLMProcessor test successful")
            print(f"Analysis: {result['analysis'][:100]}...")
            return True
        else:
            print("✗ Invalid response from LLMProcessor")
            return False
            
    except Exception as e:
        print(f"✗ LLMProcessor test failed: {e}")
        return False

def test_config_values():
    """Test configuration values"""
    print("\n=== Testing Configuration ===")
    
    try:
        from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, WORKING_BACKWARDS_STEPS
        
        if not ANTHROPIC_API_KEY:
            print("✗ ANTHROPIC_API_KEY not configured")
            return False
        print("✓ ANTHROPIC_API_KEY configured")
        
        if CLAUDE_MODEL != "claude-sonnet-4-20250514":
            print(f"⚠ Expected claude-sonnet-4-20250514, got: {CLAUDE_MODEL}")
        else:
            print(f"✓ Correct Claude model configured: {CLAUDE_MODEL}")
        
        if len(WORKING_BACKWARDS_STEPS) != 7:
            print(f"✗ Expected 7 working backwards steps, got: {len(WORKING_BACKWARDS_STEPS)}")
            return False
        print(f"✓ Working backwards steps configured: {len(WORKING_BACKWARDS_STEPS)} steps")
        
        return True
        
    except Exception as e:
        print(f"✗ Configuration test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Starting API connectivity tests...\n")
    
    tests = [
        ("Configuration", test_config_values),
        ("Claude API", test_claude_api),
        ("Claude Processor", test_claude_processor),
        ("LLM Processor", test_llm_processor),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"Running {test_name} test...")
        print('='*50)
        
        start_time = time.time()
        success = test_func()
        end_time = time.time()
        
        results.append((test_name, success, end_time - start_time))
        
        if success:
            print(f"✓ {test_name} test PASSED ({end_time - start_time:.2f}s)")
        else:
            print(f"✗ {test_name} test FAILED ({end_time - start_time:.2f}s)")
    
    # Summary
    print(f"\n{'='*50}")
    print("TEST SUMMARY")
    print('='*50)
    
    total_tests = len(results)
    passed_tests = sum(1 for _, success, _ in results if success)
    
    for test_name, success, duration in results:
        status = "PASSED" if success else "FAILED"
        print(f"{test_name:20} | {status:6} | {duration:6.2f}s")
    
    print(f"\nResult: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Claude integration is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Please check the configuration and API keys.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 