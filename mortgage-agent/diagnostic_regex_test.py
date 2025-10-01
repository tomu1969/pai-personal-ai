#!/usr/bin/env python3
"""
Diagnostic script to test regex patterns in isolation.
Tests the exact patterns causing location extraction problems.
"""

import re
import sys

def test_regex_patterns():
    """Test each regex pattern against problematic inputs from production."""
    
    # Test inputs from production logs
    test_inputs = [
        "i can do 120k",
        "ok yes", 
        "i do",
        "about 500k",
        "investment",
        "whtas the minimun down payment i need?"
    ]
    
    # The actual patterns from enhance_location_extraction()
    city_state_patterns = [
        (r'([a-zA-Z\s]+),\s*([a-zA-Z\s]{2,})', "Miami, Florida pattern"),
        (r'([a-zA-Z\s]+)\s+([a-zA-Z]{2})(?:\s|$)', "Miami FL pattern"), 
        (r'([a-zA-Z\s]+)\s+([a-zA-Z\s]{4,})(?:\s|$)', "Miami Florida pattern")
    ]
    
    # State abbreviation pattern
    state_abbrev_pattern = r'\b([a-zA-Z]{2})\b'
    
    print("=== REGEX PATTERN ANALYSIS ===\n")
    
    for test_input in test_inputs:
        print(f"Testing input: '{test_input}'")
        print("-" * 40)
        
        # Test city-state patterns
        for pattern, description in city_state_patterns:
            match = re.search(pattern, test_input.lower())
            if match:
                city = match.group(1).strip().title()
                state = match.group(2).strip()
                print(f"  ✓ MATCH: {description}")
                print(f"    Pattern: {pattern}")
                print(f"    Extracted: city='{city}', state='{state}'")
        
        # Test state abbreviation pattern
        state_match = re.search(state_abbrev_pattern, test_input.lower())
        if state_match:
            state = state_match.group(1).upper()
            print(f"  ✓ MATCH: State abbreviation pattern")
            print(f"    Pattern: {state_abbrev_pattern}")
            print(f"    Extracted: state='{state}'")
        
        if not any(re.search(p[0], test_input.lower()) for p in city_state_patterns) and not re.search(state_abbrev_pattern, test_input.lower()):
            print("  ✗ No matches (correct behavior)")
        
        print()

def test_state_validation():
    """Test state validation logic."""
    
    # Valid US state abbreviations
    valid_states = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    }
    
    # Test extractions from production
    test_states = ["DO", "OK", "IN", "TO", "IS", "CAN"]
    
    print("=== STATE VALIDATION ANALYSIS ===\n")
    
    for state in test_states:
        is_valid = state in valid_states
        print(f"State '{state}': {'✓ VALID' if is_valid else '✗ INVALID'}")
    
    print()

def simulate_production_extraction():
    """Simulate the exact extraction that happened in production."""
    
    print("=== PRODUCTION SIMULATION ===\n")
    
    production_messages = [
        "i can do 120k",
        "about 500k", 
        "whtas the minimun down payment i need?",
        "ok yes",
        "investment",
        "i do",
        "yes"
    ]
    
    for msg in production_messages:
        print(f"Message: '{msg}'")
        
        # Simulate the enhancement process
        extracted = {}
        
        # Pattern 1 test (the problematic one)
        pattern = r'([a-zA-Z\s]+)\s+([a-zA-Z]{2})(?:\s|$)'
        match = re.search(pattern, msg.lower())
        if match:
            potential_city = match.group(1).strip().title()
            potential_state = match.group(2).strip().upper()
            
            # This is the bug - it accepts ANY 2-letter combo
            extracted['property_city'] = potential_city
            extracted['property_state'] = potential_state
            print(f"  → City: '{potential_city}', State: '{potential_state}'")
        
        # State abbreviation test
        state_pattern = r'\b([a-zA-Z]{2})\b'
        state_match = re.search(state_pattern, msg.lower())
        if state_match:
            state = state_match.group(1).upper()
            extracted['property_state'] = state
            print(f"  → State: '{state}'")
        
        if not extracted:
            print("  → No extraction (correct)")
        
        print()

if __name__ == "__main__":
    test_regex_patterns()
    test_state_validation()
    simulate_production_extraction()