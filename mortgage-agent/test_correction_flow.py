#!/usr/bin/env python
"""Test correction flow."""
import requests

API_URL = "http://localhost:8001/chat"

def send(msg, cid):
    r = requests.post(API_URL, json={"message": msg, "conversation_id": cid})
    result = r.json()
    print(f"\nUser: {msg}")
    print(f"Asst: {result['response'][:150]}...")
    return result

print("\n🔧 CORRECTION FLOW TEST")
print("="*70)

# Start conversation
r = requests.post(API_URL, json={"message": "start"})
cid = r.json()["conversation_id"]

# Fill in all questions
send("yes", cid)
send("300k", cid)
send("miami", cid)
send("investment", cid)
send("800k", cid)  # Will change this
send("yes", cid)
send("usa", cid)
send("yes", cid)
r = send("yes", cid)

# Should be at verification now
if "correct" in r["response"].lower():
    print("\n✅ At verification")
    
    # Request correction
    print("\n📝 Testing correction...")
    r = send("no", cid)
    
    if "what information" in r["response"].lower():
        print("✅ Correction mode activated!")
        
        # Make a correction
        r = send("the property price should be $900k", cid)
        
        if "correct" in r["response"].lower() and "900" in r["response"]:
            print("✅ Correction applied and re-verification shown!")
            print(f"\nUpdated verification:\n{r['response']}\n")
            
            # Confirm corrected info
            r = send("yes", cid)
            
            if "pre-approved" in r["response"].lower() or "rejected" in r["response"].lower():
                print("✅ ✅ CORRECTION FLOW COMPLETE - Decision made!")
            else:
                print(f"❌ No decision: {r['response'][:200]}")
        else:
            print(f"❌ Correction not applied: {r['response'][:200]}")
    else:
        print(f"❌ Correction mode not activated: {r['response'][:200]}")
else:
    print(f"❌ Not at verification: {r['response'][:200]}")