#!/usr/bin/env python3
"""
Test script to verify conversation flow fixes.
Tests the specific issues identified:
1. Missing question after down payment response
2. Verbose response to "How much do I need for down payment?"
3. Better transitions
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.slot_graph import process_slot_turn
from src.slot_state import create_slot_state


def test_down_payment_flow():
    """Test that after providing down payment, system asks proper follow-up."""
    print("🧪 Testing down payment flow...")
    
    state = create_slot_state()
    
    # Start conversation
    state = process_slot_turn(state)
    print(f"Initial: {state['messages'][-1]['content']}")
    
    # User provides down payment
    state["messages"].append({"role": "user", "content": "200k"})
    state = process_slot_turn(state)
    
    last_response = state["messages"][-1]["content"]
    print(f"After '200k': {last_response}")
    
    # Check if response contains a question
    assert "?" in last_response, f"Response should contain a question: {last_response}"
    assert "range" in last_response.lower(), f"Should ask about price range: {last_response}"
    
    print("✅ Down payment flow test passed")


def test_tone_guard_application():
    """Test that tone guard removes verbose language."""
    from src.question_generator import apply_tone_guard
    
    print("🧪 Testing tone guard...")
    
    # Test verbose input
    verbose_text = "I'm glad you reached out about this! That's excellent. Let me break down your situation and explore your options together. Here are a few things to consider:"
    
    cleaned = apply_tone_guard(verbose_text)
    print(f"Original: {verbose_text}")
    print(f"Cleaned: {cleaned}")
    
    # Should be much shorter
    assert len(cleaned) < len(verbose_text) / 2, "Should be significantly shorter"
    assert "I'm glad" not in cleaned, "Should remove 'I'm glad'"
    assert "excellent" not in cleaned, "Should remove praise words"
    
    print("✅ Tone guard test passed")


def test_smart_transitions():
    """Test smart transition logic."""
    from src.question_handler import get_smart_transition
    
    print("🧪 Testing smart transitions...")
    
    state = {"last_slot_asked": "property_price"}
    
    # Short answer should get transition
    short_answer = "You need $250,000 down payment."
    result = get_smart_transition(short_answer, state)
    assert "By the way" in result, f"Should add transition: {result}"
    assert "price range" in result, f"Should ask about price range: {result}"
    
    # Answer ending with question should NOT get transition
    question_answer = "You need $250,000. What price range are you considering?"
    result = get_smart_transition(question_answer, state)
    assert "By the way" not in result, f"Should not add transition to questions: {result}"
    
    # Long answer should NOT get transition
    long_answer = "A" * 250  # Very long answer
    result = get_smart_transition(long_answer, state)
    assert "By the way" not in result, f"Should not add transition to long answers: {result}"
    
    print("✅ Smart transitions test passed")


def run_all_tests():
    """Run all conversation flow tests."""
    print("🚀 Testing Conversation Flow Fixes")
    print("="*50)
    
    try:
        test_tone_guard_application()
        test_smart_transitions()
        test_down_payment_flow()
        
        print("\n" + "="*50)
        print("🎉 ALL TESTS PASSED!")
        print("✅ Missing questions fixed")
        print("✅ Verbose responses cleaned up") 
        print("✅ Smart transitions working")
        print("="*50)
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)