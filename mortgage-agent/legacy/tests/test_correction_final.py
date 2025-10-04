#!/usr/bin/env python
"""Final correction test with proper answers."""
import requests

API_URL = "http://localhost:8001/chat"

def send(msg, cid):
    r = requests.post(API_URL, json={"message": msg, "conversation_id": cid})
    result = r.json()
    print(f"\nUser: {msg}")
    print(f"Asst: {result['response'][:130]}...")
    return result

print("\n🔧 FINAL CORRECTION TEST")
print("="*70)

# Start
r = requests.post(API_URL, json={"message": "hello"})
cid = r.json()["conversation_id"]

# Complete questionnaire
send("yes", cid)
send("$300,000", cid)
send("Miami, FL", cid)
send("investment", cid)
send("$800,000", cid)
send("yes i have passport and visa", cid)
send("I'm in the USA", cid)
send("yes bank statements", cid)
r = send("yes 12 months of reserves", cid)

# Check for verification
if "correct" in r["response"].lower():
    print("\n✅ Reached verification!")
    print("\n📝 Requesting correction...")
    
    r = send("no", cid)
    print(f"\nCorrection prompt: {r['response'][:180]}...")
    
    # Make correction
    r = send("change the price to $900,000", cid)
    
    if "900" in r["response"] and "correct" in r["response"].lower():
        print("\n✅ Correction applied! Re-verification shown.")
        print(f"\nRe-verification:\n{r['response']}\n")
        
        # Confirm
        r = send("yes all correct now", cid)
        
        if "congratulations" in r["response"].lower() or "pre-approved" in r["response"].lower():
            print("\n✅ ✅ ✅ COMPLETE SUCCESS!")
            print("All tests passed:")
            print("  - Verification before decision ✅")
            print("  - Correction flow works ✅")
            print("  - Final decision after correction ✅")
        else:
            print(f"\n⚠️  Got response but not decision: {r['response'][:200]}")
    else:
        print(f"\n❌ Correction issue: {r['response'][:300]}")
else:
    print(f"\n⚠️  Not at verification yet. Let me answer one more time...")
    r = send("yes I have 12 months", cid)
    if "correct" in r["response"].lower():
        print("✅ Now at verification!")
        print(f"\n{r['response']}")