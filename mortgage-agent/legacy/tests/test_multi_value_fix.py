"""
Test to verify multi-value extraction and LLM confirmation fixes.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.slot_state import create_slot_state
from src.slot_graph import process_slot_turn

def test_multi_value_extraction():
    """Test the specific scenario: '$400k down payment and $2 million home'"""
    
    print("\n" + "="*80)
    print("TEST: Multi-value extraction + LLM confirmations")
    print("="*80 + "\n")
    
    state = create_slot_state()
    
    # Start conversation
    state = process_slot_turn(state)
    print(f"\nAssistant: {state['messages'][-1]['content']}\n")
    
    # User says yes
    state["messages"].append({"role": "user", "content": "yes"})
    state = process_slot_turn(state)
    print(f"\nAssistant: {state['messages'][-1]['content']}\n")
    
    # User provides both down payment AND property price in one message
    user_msg = "I can put down a million and a half, and I will target a $4M home"
    print(f"User: {user_msg}\n")
    state["messages"].append({"role": "user", "content": user_msg})
    state = process_slot_turn(state)
    
    print(f"\nAssistant: {state['messages'][-1]['content']}\n")
    
    # Check what was extracted
    print("\n" + "="*80)
    print("EXTRACTION RESULTS:")
    print("="*80)
    
    down_payment = state["slots"].get("down_payment")
    property_price = state["slots"].get("property_price")
    
    print(f"\nDown Payment: {down_payment}")
    print(f"Property Price: {property_price}")
    
    # Verify both values extracted correctly
    if down_payment and down_payment["value"] == 1500000.0:
        print("\n✅ Down payment extracted correctly: $1,500,000")
    else:
        print(f"\n❌ Down payment extraction FAILED: {down_payment}")
    
    if property_price and property_price["value"] == 4000000.0:
        print("✅ Property price extracted correctly: $4,000,000")
    else:
        print(f"❌ Property price extraction FAILED: {property_price}")
    
    # Check 25% down payment rule
    if down_payment and property_price:
        down_pct = down_payment["value"] / property_price["value"]
        if down_pct >= 0.25:
            print(f"✅ 25% down payment rule satisfied: {down_pct*100:.1f}%")
        else:
            print(f"❌ Down payment below 25% minimum: {down_pct*100:.1f}%")
    
    # Check for unwanted "Captured:" messages
    last_msg = state["messages"][-1]["content"]
    if "captured" in last_msg.lower():
        print(f"\n❌ Found 'Captured:' message (should use LLM): {last_msg[:100]}")
    else:
        print("\n✅ No 'Captured:' messages (using LLM confirmation)")
    
    # Check formatting (no markdown **bold**)
    if "**" in last_msg:
        print(f"❌ Found markdown formatting (should be plain): {last_msg[:100]}")
    else:
        print("✅ No markdown formatting (natural LLM response)")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    test_multi_value_extraction()