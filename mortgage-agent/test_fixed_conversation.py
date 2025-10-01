#!/usr/bin/env python3
"""
Test the fixed conversation processing with the actual production scenario.
This tests the complete flow with all fixes applied.
"""

import sys
import os

# Add the src directory to Python path to import conversation_simple
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from conversation_simple import is_location_context, enhance_location_extraction, smart_merge_entities

def simulate_production_conversation():
    """Simulate the exact production conversation that previously failed."""
    
    print("🧪 TESTING FIXED CONVERSATION PROCESSING")
    print("=" * 60)
    
    # Simulate the conversation flow with assistant messages and user responses
    conversation_steps = [
        {
            "assistant_msg": "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?",
            "user_msg": "i can do 120k",
            "should_extract_location": False
        },
        {
            "assistant_msg": "Great! Can you please provide the property price?", 
            "user_msg": "about 500k",
            "should_extract_location": False
        },
        {
            "assistant_msg": "Thank you for the info! Your down payment of $120,000 is 24% of the $500,000 property price, so you'll need to adjust one of these amounts. Would you like to increase your down payment or lower the property price?",
            "user_msg": "whtas the minimun down payment i need?",
            "should_extract_location": False
        },
        {
            "assistant_msg": "The minimum down payment required is 25%, which would be $125,000 for a $500,000 property. Would you like to increase your down payment to $125,000?",
            "user_msg": "ok yes",
            "should_extract_location": False
        },
        {
            "assistant_msg": "Great! What's the property purpose: primary residence, second home, or investment?",
            "user_msg": "investment", 
            "should_extract_location": False
        },
        {
            "assistant_msg": "Thank you! Do you have a valid passport?",
            "user_msg": "i do",
            "should_extract_location": False
        },
        {
            "assistant_msg": "Great! Do you have a valid U.S. visa?",
            "user_msg": "yes",
            "should_extract_location": False
        },
        {
            "assistant_msg": "Where is the property located?",
            "user_msg": "miami fl",
            "should_extract_location": True
        }
    ]
    
    # Track entities throughout conversation
    all_entities = {}
    confirmed_entities = {}
    
    passed_tests = 0
    total_tests = len(conversation_steps)
    
    for i, step in enumerate(conversation_steps):
        print(f"\n📩 Step {i+1}:")
        print(f"   Assistant: '{step['assistant_msg']}'")
        print(f"   User: '{step['user_msg']}'")
        
        # Build message history for context detection
        messages = [
            {"role": "assistant", "content": step["assistant_msg"]},
            {"role": "user", "content": step["user_msg"]}
        ]
        
        # Test context detection
        location_context = is_location_context(messages)
        expected_context = step["should_extract_location"]
        
        print(f"   🔍 Location context detected: {location_context}")
        print(f"   ✓ Should detect location: {expected_context}")
        
        context_correct = location_context == expected_context
        if context_correct:
            print(f"   ✅ Context detection: CORRECT")
            passed_tests += 1
        else:
            print(f"   ❌ Context detection: WRONG")
        
        # If location context is detected, test extraction
        if location_context:
            print(f"   🏃 Running location extraction...")
            extracted = enhance_location_extraction(step["user_msg"], {})
            
            print(f"   📝 Extracted: {extracted}")
            
            # For the Miami FL test, verify it extracts correctly
            if step["user_msg"] == "miami fl":
                expected_city = "Miami"
                expected_state = "FL"
                actual_city = extracted.get("property_city")
                actual_state = extracted.get("property_state")
                
                if actual_city == expected_city and actual_state == expected_state:
                    print(f"   ✅ Extraction: CORRECT (Miami, FL)")
                else:
                    print(f"   ❌ Extraction: WRONG ({actual_city}, {actual_state})")
        else:
            print(f"   ⏭️  Skipped extraction (no location context)")
    
    print(f"\n" + "=" * 60)
    print(f"📊 CONTEXT DETECTION RESULTS: {passed_tests}/{total_tests} correct")
    
    return passed_tests == total_tests

def test_problematic_inputs():
    """Test that problematic inputs from production no longer cause issues."""
    
    print(f"\n🔧 TESTING PROBLEMATIC INPUTS")
    print("=" * 60)
    
    # Test inputs that previously caused problems
    problematic_inputs = [
        "i can do 120k",
        "about 500k", 
        "ok yes",
        "i do",
        "investment",
        "whtas the minimun down payment i need?",
        "yes"
    ]
    
    passed = 0
    total = len(problematic_inputs)
    
    for msg in problematic_inputs:
        print(f"\n🧪 Testing: '{msg}'")
        
        # Create non-location context (these should not extract location)
        messages = [
            {"role": "assistant", "content": "How much can you put down?"},
            {"role": "user", "content": msg}
        ]
        
        # Test context detection
        context = is_location_context(messages)
        print(f"   🔍 Location context: {context}")
        
        if not context:
            print(f"   ✅ PASS: No location extraction")
            passed += 1
        else:
            print(f"   ❌ FAIL: Would extract location incorrectly")
            # Show what would be extracted
            extracted = enhance_location_extraction(msg, {})
            print(f"      📝 Would extract: {extracted}")
    
    print(f"\n📊 PROBLEMATIC INPUT RESULTS: {passed}/{total} handled correctly")
    return passed == total

def test_legitimate_location_inputs():
    """Test that legitimate location inputs still work."""
    
    print(f"\n🗺️  TESTING LEGITIMATE LOCATION INPUTS")
    print("=" * 60)
    
    location_tests = [
        {
            "input": "miami fl",
            "expected_city": "Miami",
            "expected_state": "FL"
        },
        {
            "input": "new york, ny", 
            "expected_city": "New York",
            "expected_state": "NY"
        },
        {
            "input": "los angeles california",
            "expected_city": "Los Angeles",
            "expected_state": "CA"
        }
    ]
    
    passed = 0
    total = len(location_tests)
    
    for test in location_tests:
        print(f"\n🧪 Testing: '{test['input']}'")
        
        # Create location context
        messages = [
            {"role": "assistant", "content": "Where is the property located?"},
            {"role": "user", "content": test["input"]}
        ]
        
        # Test context detection
        context = is_location_context(messages)
        print(f"   🔍 Location context: {context}")
        
        if context:
            # Test extraction
            extracted = enhance_location_extraction(test["input"], {})
            actual_city = extracted.get("property_city")
            actual_state = extracted.get("property_state")
            
            print(f"   📝 Extracted: city='{actual_city}', state='{actual_state}'")
            print(f"   ✓ Expected: city='{test['expected_city']}', state='{test['expected_state']}'")
            
            if actual_city == test["expected_city"] and actual_state == test["expected_state"]:
                print(f"   ✅ PASS: Correct extraction")
                passed += 1
            else:
                print(f"   ❌ FAIL: Wrong extraction")
        else:
            print(f"   ❌ FAIL: Should detect location context")
    
    print(f"\n📊 LEGITIMATE LOCATION RESULTS: {passed}/{total} extracted correctly")
    return passed == total

def main():
    """Run all tests and provide summary."""
    
    print("🚀 COMPREHENSIVE FIXED CONVERSATION TEST")
    print("=" * 80)
    
    # Run all test suites
    production_passed = simulate_production_conversation()
    problematic_passed = test_problematic_inputs()
    legitimate_passed = test_legitimate_location_inputs()
    
    print(f"\n" + "=" * 80)
    print("📋 FINAL TEST SUMMARY")
    print("=" * 80)
    
    results = [
        ("Production conversation flow", production_passed),
        ("Problematic input handling", problematic_passed), 
        ("Legitimate location extraction", legitimate_passed)
    ]
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if not passed:
            all_passed = False
    
    print()
    if all_passed:
        print("🎉 ALL TESTS PASSED! The mortgage agent fixes are working correctly.")
        print("✅ Ready for production deployment.")
    else:
        print("⚠️  Some tests failed. Review the output above for details.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)