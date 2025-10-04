#!/usr/bin/env python3
"""
Test the new unified LLM approach
"""
import requests
import json
import time

def test_unified_approach():
    """Test the unified LLM approach with adjust downpayment scenario"""
    
    base_url = "http://localhost:8000"
    
    # Test the exact failing scenario
    test_conversation = [
        "Hello",
        "120k", 
        "about 500k",
        "whats the minimum down payment i need?",
        "ok yes",
        "investment",
        "Miami fl",
        "adjust downpayment"  # This should work with unified approach
    ]
    
    print("🧪 Testing Unified LLM Approach")
    print("=" * 60)
    print("Scenario: User says 'adjust downpayment' (no space)")
    print("Expected: LLM calculates 25% requirement and responds naturally")
    print()
    
    conversation_id = f"test-unified-{int(time.time())}"
    
    for i, msg in enumerate(test_conversation, 1):
        print(f"{i}. USER: {msg}")
        
        try:
            response = requests.post(
                f"{base_url}/chat",
                json={"message": msg, "conversation_id": conversation_id},
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                assistant_msg = data['response']
                print(f"   ASSISTANT: {assistant_msg}")
                
                # Check for successful adjustment handling
                if i == 8 and "adjust downpayment" in msg:
                    if "25%" in assistant_msg or "125" in assistant_msg or "125,000" in assistant_msg:
                        print("   ✅ SUCCESS: LLM correctly handled 'adjust downpayment'")
                    else:
                        print("   ❌ FAILED: LLM did not calculate 25% adjustment")
                        print(f"       Expected: Response mentioning 25% or $125,000")
                        print(f"       Got: {assistant_msg}")
                
            else:
                print(f"   ERROR: {response.text}")
                break
                
        except Exception as e:
            print(f"   ERROR: {e}")
            break
        
        print()
        time.sleep(0.5)
    
    print("=" * 60)
    print("Test complete")

if __name__ == "__main__":
    test_unified_approach()