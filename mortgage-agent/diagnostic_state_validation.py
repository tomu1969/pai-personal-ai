#!/usr/bin/env python3
"""
Diagnostic script to test state validation logic.
Tests why 'DO' passes validation when it shouldn't.
"""

def test_state_mapping_validation():
    """Test the exact STATE_MAPPING validation logic."""
    
    # The actual STATE_MAPPING from the code
    STATE_MAPPING = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }
    
    # Test problematic states
    test_states = ["DO", "OK", "IN", "TO", "IS", "CAN"]
    
    print("=== STATE_MAPPING.values() VALIDATION TEST ===\n")
    
    valid_states = list(STATE_MAPPING.values())
    print(f"Valid state abbreviations: {sorted(valid_states)}\n")
    
    for state in test_states:
        is_valid = state in valid_states
        print(f"'{state}' in STATE_MAPPING.values(): {is_valid}")
    
    print()

def test_city_state_pattern_validation():
    """Test the city-state pattern validation logic (the problematic one)."""
    
    # The actual STATE_MAPPING from the code
    STATE_MAPPING = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }
    
    print("=== CITY-STATE PATTERN VALIDATION TEST ===\n")
    
    # Simulate the problematic pattern
    test_cases = [
        ("i can do 120k", "I Can", "do"),
        ("i do", "I", "do"), 
        ("ok yes", "Ok", "yes"),  # This wouldn't match city-state pattern
        ("miami fl", "Miami", "fl")
    ]
    
    for message, expected_city, expected_state in test_cases:
        print(f"Message: '{message}'")
        print(f"  Expected extraction: city='{expected_city}', state='{expected_state}'")
        
        # The problematic validation logic
        potential_state = expected_state
        state = None
        
        if len(potential_state) == 2:
            # BUG: This line accepts ANY 2-letter string!
            state = potential_state.upper()
            print(f"  ✗ ACCEPTED by 2-letter rule: '{state}' (NO VALIDATION)")
        elif potential_state.lower() in STATE_MAPPING:
            state = STATE_MAPPING[potential_state.lower()]
            print(f"  ✓ Valid by STATE_MAPPING: '{state}'")
        else:
            print(f"  ✗ REJECTED: '{potential_state}' not found")
        
        print()

def test_state_abbreviation_validation():
    """Test the state abbreviation validation logic."""
    
    STATE_MAPPING = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }
    
    print("=== STATE ABBREVIATION VALIDATION TEST ===\n")
    
    test_cases = ["DO", "OK", "IN", "TO", "IS", "CAN", "FL", "NY"]
    
    for potential_state in test_cases:
        # This is the validation logic from line 464
        is_valid = potential_state in STATE_MAPPING.values()
        print(f"'{potential_state}' in STATE_MAPPING.values(): {is_valid}")
        
        if is_valid:
            print(f"  ✓ Would be accepted")
        else:
            print(f"  ✗ Would be rejected")
    
    print()

def trace_production_validation():
    """Trace exactly how 'DO' gets through in production."""
    
    print("=== PRODUCTION VALIDATION TRACE ===\n")
    
    # From production: "i can do 120k" extracts city="I Can", state="do"
    print("Message: 'i can do 120k'")
    print("Pattern match: city='I Can', state='do'")
    
    potential_state = "do"
    
    print(f"potential_state = '{potential_state}'")
    print(f"len(potential_state) = {len(potential_state)}")
    
    if len(potential_state) == 2:
        state = potential_state.upper()
        print(f"✗ BUG TRIGGERED: Line 433 accepts '{state}' without validation!")
        print("   This is how 'DO' gets through - no validation for 2-letter strings!")
    
    print()

if __name__ == "__main__":
    test_state_mapping_validation()
    test_city_state_pattern_validation()
    test_state_abbreviation_validation()
    trace_production_validation()