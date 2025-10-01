#!/usr/bin/env python3
"""
Diagnostic script to test how polluted location data affects OpenAI prompts.
Tests the exact prompt construction with bad location data.
"""

def get_missing_information_context_test(filled_entities):
    """Reproduce the exact get_missing_information_context logic."""
    
    # All required information in priority order
    required_fields = [
        ("down_payment", "Down payment amount"),
        ("property_price", "Property price"),
        ("loan_purpose", "Property purpose (primary residence, second home, or investment)"),
        ("property_city", "Property city"),
        ("property_state", "Property state"),
        ("has_valid_passport", "Valid passport status"),
        ("has_valid_visa", "Valid U.S. visa status"),
        ("can_demonstrate_income", "Income documentation capability"),
        ("has_reserves", "6-12 months reserves saved")
    ]
    
    collected = []
    missing = []
    
    for field, description in required_fields:
        if field in filled_entities and filled_entities[field] is not None:
            value = filled_entities[field]
            if isinstance(value, bool):
                value = "Yes" if value else "No"
            elif isinstance(value, (int, float)):
                value = f"${value:,.0f}" if field in ["down_payment", "property_price"] else str(value)
            collected.append(f"✓ {description}: {value}")
        else:
            missing.append(f"• {description}")
    
    context = ""
    if collected:
        context += "Information collected:\n" + "\n".join(collected) + "\n\n"
    
    if missing:
        context += "Still needed:\n" + "\n".join(missing)
    
    return context

def test_polluted_prompt_construction():
    """Test how polluted location data appears in OpenAI prompts."""
    
    print("=== POLLUTED PROMPT CONSTRUCTION TEST ===\n")
    
    # Simulate final state from production with polluted location data
    polluted_entities = {
        "down_payment": 125000,
        "property_price": 500000, 
        "loan_purpose": "investment",
        "property_city": "I",  # POLLUTED
        "property_state": "DO",  # POLLUTED AND INVALID
        "has_valid_passport": True,
        "has_valid_visa": True  # This would be the final field
    }
    
    print("Polluted entities:", polluted_entities)
    print()
    
    # Generate the context that would be sent to OpenAI
    context = get_missing_information_context_test(polluted_entities)
    
    print("OpenAI prompt context:")
    print("-" * 40)
    print(context)
    print("-" * 40)
    print()
    
    # Check what information appears as "collected"
    if "Property city: I" in context:
        print("✗ PROBLEM: Polluted city 'I' appears as collected information")
    
    if "Property state: DO" in context:
        print("✗ PROBLEM: Invalid state 'DO' appears as collected information") 
        print("  This could confuse the AI about the property location")
    
    # Check if all required fields are filled
    missing_count = context.count("• ")
    if missing_count == 0:
        print("✗ CRITICAL: All fields appear complete with polluted data!")
        print("  This triggers qualification calculation with invalid location")

def test_clean_vs_polluted_prompt():
    """Compare clean vs polluted prompt contexts."""
    
    print("\n=== CLEAN VS POLLUTED COMPARISON ===\n")
    
    # Clean entities (what should happen)
    clean_entities = {
        "down_payment": 125000,
        "property_price": 500000,
        "loan_purpose": "investment", 
        "property_city": "Miami",
        "property_state": "FL",
        "has_valid_passport": True,
        "has_valid_visa": True
    }
    
    # Polluted entities (what actually happened)
    polluted_entities = {
        "down_payment": 125000,
        "property_price": 500000,
        "loan_purpose": "investment",
        "property_city": "I",
        "property_state": "DO", 
        "has_valid_passport": True,
        "has_valid_visa": True
    }
    
    print("CLEAN CONTEXT:")
    print("-" * 30)
    print(get_missing_information_context_test(clean_entities))
    print()
    
    print("POLLUTED CONTEXT:")
    print("-" * 30)
    print(get_missing_information_context_test(polluted_entities))
    print()
    
    print("ANALYSIS:")
    print("- Clean context shows legitimate location: Miami, FL")
    print("- Polluted context shows nonsense location: I, DO")
    print("- OpenAI receives confusing/invalid location data") 
    print("- This could cause unexpected behavior or errors")

def test_qualification_trigger():
    """Test if polluted data triggers qualification calculation."""
    
    print("\n=== QUALIFICATION TRIGGER TEST ===\n")
    
    # Check if polluted entities would trigger final qualification
    required_fields = [
        "down_payment", "property_price", "loan_purpose", 
        "property_city", "property_state", "has_valid_passport", 
        "has_valid_visa", "can_demonstrate_income", "has_reserves"
    ]
    
    polluted_entities = {
        "down_payment": 125000,
        "property_price": 500000,
        "loan_purpose": "investment",
        "property_city": "I", 
        "property_state": "DO",
        "has_valid_passport": True,
        "has_valid_visa": True
        # Missing: can_demonstrate_income, has_reserves
    }
    
    filled_count = sum(1 for field in required_fields if field in polluted_entities and polluted_entities[field] is not None)
    missing_count = len(required_fields) - filled_count
    
    print(f"Required fields: {len(required_fields)}")
    print(f"Filled fields: {filled_count}")
    print(f"Missing fields: {missing_count}")
    print()
    
    if missing_count <= 2:  # Close to complete
        print("✗ DANGER: Nearly complete with polluted data!")
        print("  System might attempt qualification with invalid location")
    else:
        print("✓ Safe: Still missing fields, qualification won't trigger yet")
    
    print()
    
    # Show what's missing
    missing_fields = [field for field in required_fields if field not in polluted_entities or polluted_entities[field] is None]
    print("Missing fields:", missing_fields)

if __name__ == "__main__":
    test_polluted_prompt_construction()
    test_clean_vs_polluted_prompt()
    test_qualification_trigger()