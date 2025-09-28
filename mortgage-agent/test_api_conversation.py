#!/usr/bin/env python
"""Quick API test for verification flow."""
import requests
import json

API_URL = "http://localhost:8001/chat"

def send_message(message, conversation_id=None):
    """Send a message and return response."""
    data = {"message": message}
    if conversation_id:
        data["conversation_id"] = conversation_id
    
    response = requests.post(API_URL, json=data)
    result = response.json()
    
    print(f"\nUser: {message}")
    print(f"Assistant: {result['response'][:200]}...")
    
    return result

print("="*60)
print("Testing Conversation Flow with Verification")
print("="*60)

# Start conversation
r1 = send_message("yes")
conv_id = r1["conversation_id"]

# Q1: Down payment
r2 = send_message("300k", conv_id)

# Q2: Location
r3 = send_message("miami", conv_id)

# Q3: Loan purpose
r4 = send_message("investment", conv_id)

# Q4: Property price - with help request
r5 = send_message("how much could i afford", conv_id)
r6 = send_message("800k", conv_id)

# Q5: Passport/visa
r7 = send_message("yes", conv_id)

# Q6: Current location
r8 = send_message("usa", conv_id)

# Q7: Income docs
r9 = send_message("yes", conv_id)

# Q8: Reserves
r10 = send_message("yes", conv_id)

print("\n" + "="*60)
print("Should now be at verification...")
print("="*60)

# Check if we're at verification
if "is all this information correct" in r10["response"].lower():
    print("\n✅ REACHED VERIFICATION STEP!")
    
    # Confirm verification
    r11 = send_message("yes", conv_id)
    
    if "pre-approved" in r11["response"].lower() or "rejected" in r11["response"].lower():
        print("\n✅ RECEIVED FINAL DECISION!")
        print(f"Decision: {r11.get('decision')}")
    else:
        print("\n❌ Did not receive final decision")
else:
    print("\n❌ Did not reach verification")
    print(f"Last response: {r10['response'][:300]}")