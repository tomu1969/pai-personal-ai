#!/usr/bin/env python3
"""
Diagnostic script to test conversation context detection.
Tests how the system determines whether to extract location data.
"""

import re

def test_clarification_detection():
    """Test the existing clarification question detection."""
    
    clarification_patterns = [
        r'\bwhat do you mean\b',
        r'\bwhat does\b', 
        r'\bcan you explain\b',
        r'\bi don\'t understand\b',
        r'\bwhat is\b',
        r'\bhow do you\b',
        r'\bwhy\b',
        r'\bwhen\b'
    ]
    
    print("=== CLARIFICATION DETECTION TEST ===\n")
    
    test_messages = [
        "i can do 120k",
        "about 500k",
        "ok yes", 
        "i do",
        "investment",
        "what do you mean by status?",  # This should be skipped
        "whtas the minimun down payment i need?",  # This is missed!
        "where is the property?",
        "can you explain that?",
        "yes"
    ]
    
    for message in test_messages:
        message_lower = message.lower().strip()
        is_clarification = any(re.search(pattern, message_lower) for pattern in clarification_patterns)
        
        status = "✓ SKIP EXTRACTION" if is_clarification else "✗ RUN EXTRACTION"
        print(f"'{message}': {status}")
    
    print()

def test_location_context_detection():
    """Test what a proper location context detector should look like."""
    
    print("=== LOCATION CONTEXT DETECTION TEST ===\n")
    
    # Simulate conversation with assistant messages
    conversation_examples = [
        # Example 1: Down payment question (NOT location)
        {
            "assistant": "How much can you put down as a down payment?",
            "user": "i can do 120k",
            "should_extract": False
        },
        # Example 2: Property price question (NOT location)
        {
            "assistant": "What's the property price?", 
            "user": "about 500k",
            "should_extract": False
        },
        # Example 3: Confirmation question (NOT location)
        {
            "assistant": "Should we proceed with $500k property and $125k down payment?",
            "user": "ok yes",
            "should_extract": False
        },
        # Example 4: Actual location question (YES location)
        {
            "assistant": "Where is the property located?",
            "user": "miami fl", 
            "should_extract": True
        },
        # Example 5: City question (YES location)
        {
            "assistant": "What city is the property in?",
            "user": "new york",
            "should_extract": True  
        },
        # Example 6: Passport question (NOT location)
        {
            "assistant": "Do you have a valid passport?",
            "user": "i do",
            "should_extract": False
        }
    ]
    
    location_keywords = [
        "location", "city", "state", "where", "located", 
        "address", "area", "region", "property location"
    ]
    
    for example in conversation_examples:
        assistant_msg = example["assistant"].lower()
        user_msg = example["user"]
        expected = example["should_extract"]
        
        # Check if assistant was asking about location
        is_location_question = any(keyword in assistant_msg for keyword in location_keywords)
        
        print(f"Assistant: '{example['assistant']}'")
        print(f"User: '{user_msg}'")
        print(f"Contains location keywords: {is_location_question}")
        print(f"Should extract: {expected}")
        print(f"Result: {'✓ CORRECT' if is_location_question == expected else '✗ WRONG'}")
        print()

def test_production_context_failures():
    """Test the specific production cases that failed."""
    
    print("=== PRODUCTION CONTEXT FAILURES ===\n")
    
    # Recreate the production conversation flow
    production_flow = [
        ("I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?", "i can do 120k"),
        ("Great! Can you please provide the property price?", "about 500k"),
        ("Thank you for the info! Your down payment of $120,000 is 24% of the $500,000 property price, so you'll need to adjust one of these amounts. Would you like to increase your down payment or lower the property price?", "whtas the minimun down payment i need?"),
        ("The minimum down payment required is 25%, which would be $125,000 for a $500,000 property. Would you like to increase your down payment to $125,000?", "ok yes"),
        ("Great! What's the property purpose: primary residence, second home, or investment?", "investment"),
        ("Thank you! Do you have a valid passport?", "i do"),
        ("Great! Do you have a valid U.S. visa?", "yes")
    ]
    
    location_keywords = ["location", "city", "state", "where", "located", "address", "area", "region"]
    
    for assistant_msg, user_msg in production_flow:
        print(f"Assistant: '{assistant_msg}'")
        print(f"User: '{user_msg}'")
        
        # Check if this was a location question
        is_location_question = any(keyword in assistant_msg.lower() for keyword in location_keywords)
        
        # Current system extracts on ALL messages
        current_behavior = "EXTRACTS"
        correct_behavior = "EXTRACTS" if is_location_question else "SKIPS"
        
        print(f"Location question: {is_location_question}")
        print(f"Current system: {current_behavior}")
        print(f"Should: {correct_behavior}")
        print(f"Status: {'✓ CORRECT' if current_behavior == correct_behavior else '✗ WRONG - FALSE POSITIVE'}")
        print()

if __name__ == "__main__":
    test_clarification_detection()
    test_location_context_detection()
    test_production_context_failures()