#!/usr/bin/env python
"""
Test script for verification and no-repetition fixes.
"""
import sys
sys.path.insert(0, 'src')

from src.graph import create_mortgage_graph
from src.api import create_initial_state

def test_conversation_flow():
    """Test the complete conversation flow with verification."""
    print("="*60)
    print("TEST: Complete Conversation Flow with Verification")
    print("="*60)
    
    graph = create_mortgage_graph()
    state = create_initial_state()
    
    # Simulate conversation
    conversation = [
        ("yes", "User starts"),
        ("300k", "Q1: Down payment"),
        ("miami", "Q2: Location"),
        ("investment", "Q3: Loan purpose"),
        ("how much could i afford", "Q4: User asks for help"),
        ("800k", "Q4: Property price"),
        ("yes", "Q5: Passport/visa"),
        ("usa", "Q6: Current location"),
        ("yes", "Q7: Income docs"),
        ("yes", "Q8: Reserves"),
    ]
    
    # First invocation to get greeting
    result = graph.invoke(state)
    state = result
    print(f"\nInitial greeting: {state['messages'][0]['content'][:100]}...")
    
    for i, (user_msg, description) in enumerate(conversation):
        print(f"\n--- Step {i+1}: {description} ---")
        print(f"User: {user_msg}")
        
        # Add user message
        state["messages"].append({"role": "user", "content": user_msg})
        
        # Process
        result = graph.invoke(state)
        state = result
        
        # Show assistant response
        assistant_msgs = [m for m in state["messages"] if m["role"] == "assistant"]
        if assistant_msgs:
            last_response = assistant_msgs[-1]["content"]
            print(f"Assistant: {last_response[:150]}...")
        
        # Check state
        print(f"Current Q: {state.get('current_question')}")
        print(f"Down payment: {state.get('down_payment')}")
        print(f"Location: {state.get('property_city')}")
        print(f"Purpose: {state.get('loan_purpose')}")
        print(f"Price: {state.get('property_price')}")
        
        # Stop if verification reached
        if state.get("awaiting_verification"):
            print("\n✅ REACHED VERIFICATION STEP")
            break
    
    # Test verification confirmation
    print("\n--- Verification: User confirms ---")
    state["messages"].append({"role": "user", "content": "yes"})
    state = graph.invoke(state)
    
    assistant_msgs = [m for m in state["messages"] if m["role"] == "assistant"]
    if assistant_msgs:
        last_response = assistant_msgs[-1]["content"]
        print(f"Assistant: {last_response[:200]}...")
    
    print(f"\nFinal Decision: {state.get('final_decision')}")
    print(f"Conversation Complete: {state.get('conversation_complete')}")
    
    # Verify no repetitions
    all_messages = "\n".join([m["content"] for m in state["messages"] if m["role"] == "assistant"])
    
    # Count how many times loan purpose was asked
    purpose_count = all_messages.lower().count("personal home, a second home, or an investment")
    print(f"\n📊 Loan purpose asked {purpose_count} time(s)")
    
    # Count how many times price was asked  
    price_count = all_messages.lower().count("price range")
    print(f"📊 Price range asked {price_count} time(s)")
    
    if purpose_count <= 1 and price_count <= 2:  # 2 for price because of affordability help
        print("\n✅ TEST PASSED: No question repetition detected")
    else:
        print("\n❌ TEST FAILED: Questions were repeated")
    
    return state

if __name__ == "__main__":
    test_conversation_flow()