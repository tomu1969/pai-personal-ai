#!/usr/bin/env python3
"""
Test to catch the exact property purpose question and test fast-path.
"""
import requests
import json
import time

base_url = "http://localhost:8000"
conversation_id = f"property-purpose-test-{int(time.time())}"

print(f"Testing for property purpose question: {conversation_id}")
print("=" * 60)

# Step by step to find when property purpose is asked
messages = [
    "Hello",
    "120k",
    "about 500k",
    "whtas the minimun down payment i need?",
    "ok yes"
]

print("Step-by-step conversation to catch property purpose question...")
for i, msg in enumerate(messages, 1):
    print(f"\n{i}. USER: {msg}")
    response = requests.post(f"{base_url}/chat", json={"message": msg, "conversation_id": conversation_id}, timeout=30)
    if response.status_code == 200:
        data = response.json()
        assistant_msg = data['response']
        print(f"   ASSISTANT: {assistant_msg}")
        
        # Check if this asks about property purpose
        if any(keyword in assistant_msg.lower() for keyword in ["property purpose", "purpose of the property", "primary residence", "investment"]):
            print(f"   🎯 FOUND PROPERTY PURPOSE QUESTION!")
            
            # Test investment response
            print(f"\nTesting 'investment' response (should be fast-path):")
            start = time.time()
            response = requests.post(f"{base_url}/chat", json={"message": "investment", "conversation_id": conversation_id}, timeout=30)
            elapsed = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Time: {elapsed:.2f}s")
                print(f"   Response: {data['response']}")
                if elapsed < 1.0:
                    print("   ✅ FAST-PATH SUCCESS!")
                else:
                    print("   ❌ SLOW: Still taking too long")
            break
    else:
        print(f"   ERROR: {response.status_code}")
        break
    time.sleep(0.1)