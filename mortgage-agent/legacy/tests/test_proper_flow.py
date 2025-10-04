#!/usr/bin/env python
"""Proper test starting with fresh conversation."""
import requests

API_URL = "http://localhost:8001/chat"

def send(msg, conv_id=None):
    data = {"message": msg}
    if conv_id:
        data["conversation_id"] = conv_id
    r = requests.post(API_URL, json=data)
    result = r.json()
    print(f"\n{'='*60}")
    print(f"User: {msg}")
    print(f"Asst: {result['response'][:150]}...")
    return result

print("\n🚀 Starting Fresh Conversation")
print("="*60)

# New conversation - will get greeting
r = send("start")
cid = r["conversation_id"]

# Confirm to start
r = send("yes", cid)

# Q1: Down payment
r = send("300k", cid)

# Q2: Location
r = send("miami", cid)

# Q3: Loan purpose
r = send("investment", cid)

# Q4: Property price
r = send("800k", cid)

# Q5: Passport/visa
r = send("yes", cid)

# Q6: Current location  
r = send("usa", cid)

# Q7: Income docs
r = send("yes", cid)

# Q8: Reserves
r = send("yes", cid)

print("\n" + "="*60)
if "correct" in r["response"].lower() and "information" in r["response"].lower():
    print("✅ REACHED VERIFICATION!")
    
    # Confirm
    r = send("yes", cid)
    
    if "pre-approved" in r["response"].lower():
        print("✅ GOT PRE-APPROVAL DECISION!")
    else:
        print(f"❌ No decision. Response: {r['response'][:200]}")
else:
    print(f"❌ Not at verification. Last response: {r['response'][:200]}")