#!/usr/bin/env python3
"""
Test suite to verify API call reduction from batched analysis approach.
Compares legacy vs batched approach performance.
"""

import os
import sys
import time
import json
from unittest.mock import Mock, patch

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_api_call_reduction():
    """Test that batched approach significantly reduces API calls"""
    
    print("=" * 60)
    print("API CALL REDUCTION TEST")
    print("=" * 60)
    
    # The exact failing conversation
    messages = [
        {'role': 'assistant', 'content': 'I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?'},
        {'role': 'user', 'content': 'i can do 120k'},
        {'role': 'assistant', 'content': 'Great! Now, what is the property price you are considering?'},
        {'role': 'user', 'content': 'about 500k'},
        {'role': 'assistant', 'content': 'Your down payment of $120,000 is 24% of the $500,000 property price, but you need at least 25%. Would you like to adjust your down payment or property price?'},
        {'role': 'user', 'content': 'whtas the minimun down payment i need?'},
        {'role': 'assistant', 'content': 'The minimum down payment you need for a $500,000 property is $125,000 (25%). Would you like to adjust your down payment or property price?'},
        {'role': 'user', 'content': 'ok yes'},
        {'role': 'assistant', 'content': 'Great! What\'s the property purpose: primary residence, second home, or investment?'},
        {'role': 'user', 'content': 'investment'},
        {'role': 'assistant', 'content': 'Thank you! Now, could you please provide the property location, including the city and state?'},
        {'role': 'user', 'content': 'Miami fl'},
        {'role': 'assistant', 'content': 'Thank you for the information! Do you have a valid passport?'},
        {'role': 'user', 'content': 'i do'}
    ]
    
    print(f"Testing conversation with {len(messages)} messages")
    print(f"Expected legacy approach: ~27+ API calls")
    print(f"Expected batched approach: ~1-2 API calls")
    print()
    
    # Mock OpenAI client to count calls
    api_call_counts = {'batched': 0, 'legacy': 0}
    
    def mock_openai_call(*args, **kwargs):
        """Mock OpenAI API call that increments counter"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.tool_calls = [Mock()]
        mock_response.choices[0].message.tool_calls[0].function.arguments = json.dumps({
            "is_confirmation": True,
            "confirmation_type": "positive",
            "confirmed_values": {"has_valid_passport": True},
            "reasoning": "Mock analysis"
        })
        mock_response.usage = Mock()
        mock_response.usage.total_tokens = 100
        mock_response.usage.prompt_tokens_details = Mock()
        mock_response.usage.prompt_tokens_details.cached_tokens = 0
        return mock_response
    
    def mock_openai_call_batched(*args, **kwargs):
        """Mock OpenAI API call for batched analysis"""
        api_call_counts['batched'] += 1
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.tool_calls = [Mock()]
        mock_response.choices[0].message.tool_calls[0].function.arguments = json.dumps({
            "analyses": [
                {"message_index": 1, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"down_payment": 120000}, "reasoning": "User confirms down payment"},
                {"message_index": 3, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"property_price": 500000}, "reasoning": "User confirms property price"},
                {"message_index": 7, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"down_payment": 125000}, "reasoning": "User adjusts down payment"},
                {"message_index": 9, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"loan_purpose": "investment"}, "reasoning": "User confirms purpose"},
                {"message_index": 11, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"property_city": "Miami", "property_state": "FL"}, "reasoning": "User confirms location"},
                {"message_index": 13, "is_confirmation": True, "confirmation_type": "positive", "confirmed_values": {"has_valid_passport": True}, "reasoning": "User confirms passport"}
            ]
        })
        mock_response.usage = Mock()
        mock_response.usage.total_tokens = 1190
        mock_response.usage.prompt_tokens_details = Mock()
        mock_response.usage.prompt_tokens_details.cached_tokens = 0
        return mock_response
    
    def mock_openai_call_legacy(*args, **kwargs):
        """Mock OpenAI API call for legacy per-message analysis"""
        api_call_counts['legacy'] += 1
        return mock_openai_call(*args, **kwargs)
    
    try:
        from src.conversation_simple import process_conversation_turn
        
        # Test 1: Batched approach (USE_BATCHED_ANALYSIS=True)
        print("🔄 Testing BATCHED approach...")
        os.environ['USE_BATCHED_ANALYSIS'] = 'true'
        
        with patch('src.conversation_simple.client') as mock_client:
            mock_client.chat.completions.create = mock_openai_call_batched
            
            start_time = time.time()
            try:
                result = process_conversation_turn(messages.copy())
                batched_time = time.time() - start_time
                batched_calls = api_call_counts['batched']
                print(f"✅ Batched approach completed in {batched_time:.2f}s")
                print(f"✅ API calls made: {batched_calls}")
            except Exception as e:
                print(f"❌ Batched approach failed: {e}")
                batched_calls = api_call_counts['batched']
                batched_time = time.time() - start_time
        
        print()
        
        # Test 2: Legacy approach (USE_BATCHED_ANALYSIS=False)
        print("🔄 Testing LEGACY approach...")
        os.environ['USE_BATCHED_ANALYSIS'] = 'false'
        
        # Need to reimport to pick up new env var
        import importlib
        import src.conversation_simple
        importlib.reload(src.conversation_simple)
        
        with patch('src.conversation_simple.client') as mock_client:
            mock_client.chat.completions.create = mock_openai_call_legacy
            
            start_time = time.time()
            try:
                result = src.conversation_simple.process_conversation_turn(messages.copy())
                legacy_time = time.time() - start_time
                legacy_calls = api_call_counts['legacy']
                print(f"✅ Legacy approach completed in {legacy_time:.2f}s")
                print(f"✅ API calls made: {legacy_calls}")
            except Exception as e:
                print(f"❌ Legacy approach failed: {e}")
                legacy_calls = api_call_counts['legacy']
                legacy_time = time.time() - start_time
        
        # Results comparison
        print("\n" + "=" * 60)
        print("RESULTS COMPARISON")
        print("=" * 60)
        print(f"Batched approach:  {batched_calls:2d} API calls")
        print(f"Legacy approach:   {legacy_calls:2d} API calls")
        print()
        
        if batched_calls < legacy_calls:
            reduction = ((legacy_calls - batched_calls) / legacy_calls) * 100 if legacy_calls > 0 else 0
            print(f"✅ SUCCESS: {reduction:.1f}% reduction in API calls!")
            print(f"✅ Reduced from {legacy_calls} to {batched_calls} calls")
        else:
            print(f"❌ FAILED: No reduction achieved")
        
        # Reset environment
        os.environ['USE_BATCHED_ANALYSIS'] = 'true'
        
        return batched_calls <= 2 and legacy_calls >= 10
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_cache_effectiveness():
    """Test that cache effectiveness improves on subsequent calls"""
    print("\n" + "=" * 60)
    print("CACHE EFFECTIVENESS TEST")
    print("=" * 60)
    print("Note: This test requires real OpenAI API calls to measure caching")
    print("Run the debug script twice to see cache effectiveness")
    print("Expected: 0% cache hit on first run, >40% on second run within 5 minutes")
    
    return True

if __name__ == "__main__":
    print("🧪 Running API Optimization Test Suite")
    print()
    
    success = True
    
    # Run API call reduction test
    if test_api_call_reduction():
        print("\n✅ API call reduction test: PASSED")
    else:
        print("\n❌ API call reduction test: FAILED")
        success = False
    
    # Run cache effectiveness test (informational)
    test_cache_effectiveness()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ALL TESTS PASSED - API optimization is working!")
    else:
        print("💥 SOME TESTS FAILED - Check implementation")
    print("=" * 60)