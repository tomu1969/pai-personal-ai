#!/usr/bin/env python3
"""
Diagnostic script to test entity merging and pollution logic.
Tests how false location data accumulates and overwrites legitimate data.
"""

def smart_merge_entities_test(current_entities, new_entities, confirmed_entities=None):
    """Reproduce the exact smart_merge_entities logic."""
    if confirmed_entities is None:
        confirmed_entities = {}
    
    merged = current_entities.copy()
    
    for key, value in new_entities.items():
        # If this field has been explicitly confirmed, don't overwrite it
        if key in confirmed_entities:
            print(f">>> [SMART_MERGE] Skipping overwrite of confirmed {key}: {confirmed_entities[key]} (ignoring extracted: {value})")
            continue
        
        # For critical financial fields, only update with positive meaningful values
        if key in ['down_payment', 'property_price']:
            if value and value > 0:
                merged[key] = value
            elif merged.get(key, 0) > 0:
                continue  # Don't overwrite positive value with zero
        
        # Special handling for updated_ fields
        elif key in ['updated_down_payment', 'updated_property_price']:
            regular_field = key.replace('updated_', '')
            if regular_field in merged and merged[regular_field] is not None:
                continue  # Skip adding updated_ field if regular field exists
            else:
                if value is not None:
                    merged[key] = value
        
        else:
            # For other fields (INCLUDING LOCATION), update normally
            if value is not None:
                merged[key] = value
    
    return merged

def test_location_pollution():
    """Test how location data gets polluted throughout conversation."""
    
    print("=== LOCATION POLLUTION TEST ===\n")
    
    # Simulate the production conversation entity accumulation
    all_entities = {}
    confirmed_entities = {}
    
    conversation_steps = [
        {
            "message": "i can do 120k",
            "extracted": {"property_city": "I Can", "property_state": "DO", "down_payment": 120000},
            "confirmed": {"down_payment": 120000}
        },
        {
            "message": "about 500k", 
            "extracted": {"property_price": 500000},
            "confirmed": {"property_price": 500000}
        },
        {
            "message": "ok yes",
            "extracted": {"property_state": "OK"},  # OK = Oklahoma
            "confirmed": {"down_payment": 125000}  # Confirmed new amount
        },
        {
            "message": "investment",
            "extracted": {"loan_purpose": "investment"},
            "confirmed": {"loan_purpose": "investment"}
        },
        {
            "message": "i do", 
            "extracted": {"property_city": "I", "property_state": "DO", "has_valid_passport": True},
            "confirmed": {"has_valid_passport": True}
        }
    ]
    
    for i, step in enumerate(conversation_steps):
        print(f"Step {i+1}: '{step['message']}'")
        print(f"  Extracted: {step['extracted']}")
        
        # Update confirmed entities
        confirmed_entities.update(step['confirmed'])
        
        # Merge with smart logic
        all_entities = smart_merge_entities_test(all_entities, step['extracted'], confirmed_entities)
        
        print(f"  Merged entities: {all_entities}")
        print(f"  Confirmed entities: {confirmed_entities}")
        print()
    
    print("=== FINAL POLLUTION ANALYSIS ===")
    print(f"Final entities: {all_entities}")
    
    # Check for pollution
    location_fields = ['property_city', 'property_state']
    for field in location_fields:
        if field in all_entities:
            value = all_entities[field]
            is_valid = field == 'property_state' and value in ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY']
            
            print(f"  {field}: '{value}' - {'✓ VALID' if is_valid else '✗ POLLUTED'}")

def test_confirmation_protection():
    """Test if confirmed entities are properly protected from pollution."""
    
    print("\n=== CONFIRMATION PROTECTION TEST ===\n")
    
    # Start with legitimate confirmed location
    current_entities = {"property_city": "Miami", "property_state": "FL"}
    confirmed_entities = {"property_city": "Miami", "property_state": "FL"}
    
    # Try to pollute with bad extraction
    bad_extraction = {"property_city": "I Can", "property_state": "DO"}
    
    print("Current entities:", current_entities)
    print("Confirmed entities:", confirmed_entities)
    print("Bad extraction:", bad_extraction)
    
    merged = smart_merge_entities_test(current_entities, bad_extraction, confirmed_entities)
    
    print("After merge:", merged)
    
    # Check if legitimate data was protected
    protected = (merged["property_city"] == "Miami" and merged["property_state"] == "FL")
    print(f"Legitimate data protected: {'✓ YES' if protected else '✗ NO'}")

def test_no_confirmation_vulnerability():
    """Test vulnerability when no entities are confirmed yet."""
    
    print("\n=== NO CONFIRMATION VULNERABILITY TEST ===\n")
    
    # Start with empty state (new conversation)
    current_entities = {}
    confirmed_entities = {}
    
    # First message extracts bad location data
    bad_extraction = {"property_city": "I Can", "property_state": "DO", "down_payment": 120000}
    
    print("Current entities:", current_entities)
    print("Confirmed entities:", confirmed_entities)
    print("Bad extraction:", bad_extraction)
    
    merged = smart_merge_entities_test(current_entities, bad_extraction, confirmed_entities)
    
    print("After merge:", merged)
    
    # Check if bad data was accepted
    polluted = "property_city" in merged and merged["property_city"] == "I Can"
    print(f"Bad data accepted: {'✗ YES' if polluted else '✓ NO'}")

if __name__ == "__main__":
    test_location_pollution()
    test_confirmation_protection()
    test_no_confirmation_vulnerability()