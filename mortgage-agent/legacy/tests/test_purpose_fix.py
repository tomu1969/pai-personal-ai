"""
Test purpose mapping fix: "new home" should map to "personal"
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.slot_state import create_slot_state
from src.slot_graph import process_slot_turn

def test_purpose_mapping():
    """Test that 'new home' gets mapped to 'personal' correctly"""
    
    print("\n" + "="*80)
    print("TEST: Purpose Mapping - 'New home' → 'personal'")
    print("="*80 + "\n")
    
    state = create_slot_state()
    
    # Start conversation
    state = process_slot_turn(state)
    print(f"Assistant: {state['messages'][-1]['content']}\n")
    
    # User says yes
    state["messages"].append({"role": "user", "content": "yes"})
    state = process_slot_turn(state)
    print(f"Assistant: {state['messages'][-1]['content']}\n")
    
    # User provides down payment
    state["messages"].append({"role": "user", "content": "200k"})
    state = process_slot_turn(state)
    print(f"Assistant: {state['messages'][-1]['content']}\n")
    
    # User says "New home" for purpose
    user_msg = "New home."
    print(f"User: {user_msg}\n")
    state["messages"].append({"role": "user", "content": user_msg})
    state = process_slot_turn(state)
    
    print(f"Assistant: {state['messages'][-1]['content']}\n")
    
    # Check what was extracted
    print("\n" + "="*80)
    print("PURPOSE MAPPING TEST:")
    print("="*80)
    
    loan_purpose = state["slots"].get("loan_purpose")
    print(f"\nExtracted loan_purpose: {loan_purpose}")
    
    # Verify purpose mapping
    if loan_purpose and loan_purpose["value"] == "personal":
        print("\n✅ Purpose mapping CORRECT: 'New home' → 'personal'")
    else:
        print(f"\n❌ Purpose mapping FAILED: Expected 'personal', got {loan_purpose}")
    
    # Check for no excessive praise
    last_msg = state["messages"][-1]["content"]
    praise_words = ["great", "excellent", "wonderful", "sounds good", "that's great"]
    found_praise = [word for word in praise_words if word in last_msg.lower()]
    
    if found_praise:
        print(f"❌ Found excessive praise: {found_praise}")
    else:
        print("✅ No excessive praise detected")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    test_purpose_mapping()