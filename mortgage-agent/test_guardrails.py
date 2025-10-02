#!/usr/bin/env python3
"""
Test script to verify the guardrail implementation is working correctly.
Tests specific scenarios that should trigger guardrail violations.
"""

import requests
import json
import time

API_URL = "http://localhost:8000/chat"

def send_message(message, conversation_id):
    """Send a message to the API and return response."""
    payload = {
        "message": message,
        "conversation_id": conversation_id
    }
    
    response = requests.post(API_URL, json=payload)
    return response.json()

def test_guardrails():
    """Test various guardrail scenarios."""
    
    print("🧪 Testing Guardrail Implementation")
    print("=" * 50)
    
    # Test 1: Re-asking already answered questions
    print("\n1️⃣ TEST: Re-asking already answered questions")
    conv_id = "guardrail-test-reask"
    
    # Establish context with down payment and property price
    print("   Setting up conversation with down payment...")
    response1 = send_message("120k", conv_id)
    print(f"   Response 1: {response1['response']}")
    
    print("   Providing property price...")
    response2 = send_message("500k", conv_id)
    print(f"   Response 2: {response2['response']}")
    
    # Now try to trigger a response that would re-ask for location
    print("   Asking about location (should NOT re-ask location if already provided)...")
    response3 = send_message("Miami, FL", conv_id)
    print(f"   Response 3: {response3['response']}")
    
    # Try to get the system to re-ask about something we already provided
    print("   Trying to trigger re-asking down payment...")
    response4 = send_message("What was my down payment again?", conv_id)
    print(f"   Response 4: {response4['response']}")
    
    time.sleep(2)
    
    # Test 2: Confirmation protocol enforcement
    print("\n2️⃣ TEST: Confirmation protocol enforcement")
    conv_id_2 = "guardrail-test-confirmation"
    
    print("   Testing exploration scenario...")
    response5 = send_message("What if I put down 150k for a 600k property?", conv_id_2)
    print(f"   Response 5: {response5['response']}")
    
    print("   Following up with 'ok yes' (should ask for confirmation, not jump topics)...")
    response6 = send_message("ok yes", conv_id_2)
    print(f"   Response 6: {response6['response']}")
    
    time.sleep(2)
    
    # Test 3: Simulating a conversation that might trigger violations
    print("\n3️⃣ TEST: Complex scenario that might bypass guardrails")
    conv_id_3 = "guardrail-test-complex"
    
    # Set up a full conversation context
    messages = [
        ("200k", "Setting down payment"),
        ("800k", "Setting property price"), 
        ("investment", "Setting property purpose"),
        ("Miami, FL", "Setting location"),
        ("Tell me about credit requirements", "Asking about credit (should be blocked)")
    ]
    
    for message, description in messages:
        print(f"   {description}: '{message}'")
        response = send_message(message, conv_id_3)
        print(f"      → {response['response']}")
        time.sleep(1)
    
    print("\n✅ Guardrail testing completed!")
    print("Check the server logs for 'GUARDRAIL VIOLATIONS' and 'GUARDRAIL CORRECTION' messages.")

if __name__ == "__main__":
    test_guardrails()