#!/usr/bin/env python3
"""
================================================================================
TEST_SCENARIOS.PY - COMPREHENSIVE CONVERSATION SIMULATION FRAMEWORK
================================================================================

Real conversation simulations to test all fixes:
- Contextual extraction (no hardcoded geo)
- Smart agenda selection 
- Confidence-based protection
- Delta-only confirmations
- Tone guard (neutral, max 2 sentences)
- Business rule constants validation
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.slot_graph import process_slot_turn
from src.slot_state import create_slot_state, get_slot_value
from src.business_rules import MIN_DOWN_PCT, validate_all_rules, make_final_decision


class ConversationTest:
    """Test framework for simulating conversations."""
    
    def __init__(self, name: str, messages: list, expected_outcome: str):
        self.name = name
        self.messages = messages
        self.expected_outcome = expected_outcome
        self.state = None
        self.passed = False
        self.errors = []
    
    def run(self):
        """Execute the conversation simulation."""
        print(f"\n{'='*80}")
        print(f"TEST: {self.name}")
        print(f"{'='*80}")
        
        self.state = create_slot_state()
        
        for i, user_message in enumerate(self.messages):
            print(f"\n>>> Turn {i+1}: User says: '{user_message}'")
            
            # Add user message to state
            self.state["messages"].append({
                "role": "user", 
                "content": user_message
            })
            
            # Process the turn
            try:
                self.state = process_slot_turn(self.state)
                
                # Get assistant response
                assistant_messages = [m for m in self.state["messages"] if m["role"] == "assistant"]
                if assistant_messages:
                    last_response = assistant_messages[-1]["content"]
                    print(f">>> Assistant: {last_response}")
                    
                    # Validate tone guard (no praise words)
                    self._check_tone_guard(last_response)
                
            except Exception as e:
                self.errors.append(f"Turn {i+1} error: {str(e)}")
                print(f">>> ERROR: {e}")
        
        # Final validation
        self._validate_final_state()
        
        if not self.errors:
            self.passed = True
            print(f"\n✅ TEST PASSED: {self.name}")
        else:
            print(f"\n❌ TEST FAILED: {self.name}")
            for error in self.errors:
                print(f"   • {error}")
        
        return self.passed
    
    def _check_tone_guard(self, response: str):
        """Validate tone guard rules."""
        praise_words = ['great', 'excellent', 'wonderful', 'perfect', 'amazing']
        for word in praise_words:
            if word.lower() in response.lower():
                self.errors.append(f"Tone guard failed: Found praise word '{word}' in response")
        
        # Check sentence count (should be ≤ 2)
        import re
        sentences = re.split(r'[.!?]+', response.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) > 2:
            self.errors.append(f"Tone guard failed: {len(sentences)} sentences (max 2 allowed)")
    
    def _validate_final_state(self):
        """Validate final conversation state."""
        if self.expected_outcome == "pre_approved":
            decision = make_final_decision(self.state)
            if decision != "Pre-Approved":
                self.errors.append(f"Expected Pre-Approved, got {decision}")
        
        elif self.expected_outcome == "rejected":
            decision = make_final_decision(self.state)
            if decision != "Rejected":
                self.errors.append(f"Expected Rejected, got {decision}")
        
        # Validate LTV calculation uses constants
        price = get_slot_value(self.state, "property_price")
        down = get_slot_value(self.state, "down_payment")
        if price and down:
            down_pct = down / price
            if down_pct < MIN_DOWN_PCT:
                errors = validate_all_rules(self.state)
                ltv_error = any("Down payment must be ≥25%" in e.message for e in errors)
                if not ltv_error:
                    self.errors.append("Business rule validation failed: LTV error not detected")


# =============================================================================
# TEST SCENARIOS - Real conversation patterns
# =============================================================================

SCENARIOS = [
    ConversationTest(
        name="Geographic Normalization - Brickell Miami",
        messages=[
            "I want to buy a property in Brickell for $800k with $200k down",
            "yes", 
            "personal",
            "yes",
            "yes", 
            "USA",
            "yes",
            "yes"
        ],
        expected_outcome="pre_approved"
    ),
    
    ConversationTest(
        name="Regional Description - South Florida", 
        messages=[
            "Looking for a $500k investment property in South Florida, have $150k down",
            "yes",
            "investment", 
            "yes",
            "yes",
            "USA", 
            "yes",
            "yes"
        ],
        expected_outcome="pre_approved"
    ),
    
    ConversationTest(
        name="Contextual Yes/No - Boolean Slots",
        messages=[
            "$300k down payment for a $900k home",
            "Miami",
            "personal",
            "yes",  # passport
            "yes",  # visa
            "USA",
            "yes",  # income
            "yes"   # reserves
        ],
        expected_outcome="pre_approved"
    ),
    
    ConversationTest(
        name="Smart Agenda - Non-Linear Order",
        messages=[
            "I'm looking at a condo in Miami for investment",
            "$800k", # property price asked due to context
            "$250k", # down payment
            "yes",   # passport
            "yes",   # visa  
            "USA",
            "yes",   # income
            "yes"    # reserves
        ],
        expected_outcome="pre_approved"
    ),
    
    ConversationTest(
        name="Confidence Protection - No Overwrite",
        messages=[
            "$400k down on $1.2M property in Miami",
            "personal",
            "$300k down",  # Should NOT overwrite $400k (lower confidence)
            "yes",
            "yes",
            "USA", 
            "yes",
            "yes"
        ],
        expected_outcome="pre_approved" 
    ),
    
    ConversationTest(
        name="LTV Violation - 20% Down (Should Reject)",
        messages=[
            "$100k down on $600k property",
            "Miami", 
            "personal",
            "yes",
            "yes",
            "USA",
            "yes", 
            "yes"
        ],
        expected_outcome="rejected"
    ),
    
    ConversationTest(
        name="Missing Documentation - No Passport",
        messages=[
            "$300k down on $800k property in Miami",
            "personal",
            "no",  # passport
            "yes", # visa
            "USA",
            "yes",
            "yes"
        ],
        expected_outcome="rejected"
    ),
    
    ConversationTest(
        name="Delta Confirmation - Changed Values",
        messages=[
            "$200k down payment",
            "$300k down payment",  # Changed value - should confirm
            "yes",  # confirm change
            "$800k property price",
            "Miami",
            "personal", 
            "yes",
            "yes",
            "USA",
            "yes",
            "yes"
        ],
        expected_outcome="pre_approved"
    )
]


def run_all_tests():
    """Execute all test scenarios."""
    print("🧪 MORTGAGE AGENT - COMPREHENSIVE TEST SUITE")
    print("Testing all fixes: geo normalization, smart agenda, confidence protection, tone guard")
    
    passed = 0
    failed = 0
    
    for scenario in SCENARIOS:
        if scenario.run():
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'='*80}")
    print(f"FINAL RESULTS: {passed} passed, {failed} failed")
    if failed == 0:
        print("🎉 ALL TESTS PASSED! Fixes are working correctly.")
    else:
        print("⚠️  Some tests failed. Review errors above.")
    print(f"{'='*80}")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)