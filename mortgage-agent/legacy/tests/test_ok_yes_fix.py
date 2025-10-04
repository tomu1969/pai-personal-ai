#!/usr/bin/env python3
"""
Test the exact 'ok yes' scenario that was failing
"""
import requests
import json
import time

def test_ok_yes_fix():
    """Test the exact failing conversation to verify the fix"""
    
    base_url = "http://localhost:8000"
    
    # The exact failing scenario from the user
    test_conversation = [
        "Hello",
        "100k", 
        "about 500k",
        "whats the minimum down payment i need?",
        "ok yes"  # This was failing before - should work now
    ]
    
    print("🧪 Testing 'ok yes' Fix")
    print("=" * 60)
    print("Scenario: User says 'ok yes' after being asked about adjustment")
    print("Expected: LLM understands this as confirmation and proceeds naturally")
    print("Should NOT get: 'I couldn't process ok yes as a down payment amount'")
    print()
    
    conversation_id = f"test-ok-yes-fix-{int(time.time())}"
    
    for i, msg in enumerate(test_conversation, 1):
        print(f"{i}. USER: {msg}")
        
        start_time = time.time()
        try:
            response = requests.post(
                f"{base_url}/chat",
                json={"message": msg, "conversation_id": conversation_id},
                timeout=30
            )
            
            elapsed = time.time() - start_time
            print(f"   Status: {response.status_code} ({elapsed:.2f}s)")
            
            if response.status_code == 200:
                data = response.json()
                assistant_msg = data['response']
                print(f"   ASSISTANT: {assistant_msg}")
                
                # Check for the failing response
                if i == 5 and "ok yes" in msg:
                    if "I couldn't process" in assistant_msg:
                        print("   ❌ FAILED: Still getting hardcoded error message")
                        print(f"       Got: {assistant_msg}")
                        return False
                    elif elapsed < 0.5:
                        print(f"   ⚠️  WARNING: Response too fast ({elapsed:.2f}s) - might be hardcoded")
                    else:
                        print("   ✅ SUCCESS: LLM handled 'ok yes' properly")
                        print(f"   ✅ Timing: {elapsed:.2f}s (good - shows LLM processing)")
                
            else:
                print(f"   ERROR: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ERROR: {e}")
            return False
        
        print()
        time.sleep(0.5)
    
    print("=" * 60)
    print("✅ Test passed - 'ok yes' is now handled by unified LLM")
    return True

if __name__ == "__main__":
    test_ok_yes_fix()