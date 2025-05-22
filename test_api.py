#!/usr/bin/env python3
"""
Test script to verify Gemini API integration
"""

import os
import sys
import logging

# Configure logging for the test
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_api_key():
    """Test if API key is available"""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    print(f"✓ API Key present: {'Yes' if api_key else 'No'}")
    if api_key:
        print(f"✓ API Key length: {len(api_key)} characters")
    return bool(api_key)

def test_imports():
    """Test if all required imports work"""
    try:
        import google.generativeai as genai
        print("✓ google.generativeai import successful")
        
        from config import GEMINI_API_KEY, GEMINI_MODEL, WORKING_BACKWARDS_STEPS
        print("✓ config imports successful")
        print(f"✓ Model configured: {GEMINI_MODEL}")
        print(f"✓ Steps configured: {len(WORKING_BACKWARDS_STEPS)}")
        
        from llm_processor import LLMProcessor
        print("✓ LLMProcessor import successful")
        
        return True
    except Exception as e:
        print(f"✗ Import error: {e}")
        return False

def test_gemini_api():
    """Test basic Gemini API functionality"""
    try:
        import google.generativeai as genai
        from config import GEMINI_API_KEY, GEMINI_MODEL
        
        # Configure API
        genai.configure(api_key=GEMINI_API_KEY)
        print("✓ Gemini API configured")
        
        # Test model creation
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction="You are a helpful assistant."
        )
        print("✓ GenerativeModel created successfully")
        
        # Test simple generation
        response = model.generate_content("Say hello in exactly 5 words.")
        print("✓ generate_content call successful")
        
        if hasattr(response, 'text') and response.text:
            print(f"✓ Response received: '{response.text.strip()}'")
            return True
        else:
            print(f"✗ Invalid response: {response}")
            return False
            
    except Exception as e:
        print(f"✗ Gemini API test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_llm_processor():
    """Test LLMProcessor with a simple step"""
    try:
        from llm_processor import LLMProcessor
        
        processor = LLMProcessor()
        print("✓ LLMProcessor instance created")
        
        # Test simple step processing
        test_input = "A smart alarm clock that learns your sleep patterns"
        result = processor.generate_step_response(1, test_input)
        
        if "error" in result:
            print(f"✗ Step processing failed: {result['error']}")
            return False
        elif "output" in result:
            output_length = len(result["output"])
            print(f"✓ Step 1 processing successful - output length: {output_length}")
            print(f"✓ Output preview: {result['output'][:100]}...")
            return True
        else:
            print(f"✗ Unexpected result format: {result}")
            return False
            
    except Exception as e:
        print(f"✗ LLMProcessor test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=== Testing LLM-Powered Product Concept Evaluator ===\n")
    
    tests = [
        ("API Key", test_api_key),
        ("Imports", test_imports),
        ("Gemini API", test_gemini_api),
        ("LLMProcessor", test_llm_processor)
    ]
    
    results = {}
    for test_name, test_func in tests:
        print(f"\n--- Testing {test_name} ---")
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"✗ {test_name} test crashed: {e}")
            results[test_name] = False
    
    print("\n=== Test Results ===")
    all_passed = True
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! The application should work correctly.")
    else:
        print("\n❌ Some tests failed. Check the errors above for debugging.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main()) 