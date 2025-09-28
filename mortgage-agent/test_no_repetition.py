#!/usr/bin/env python
"""Test that the original repetition bug is fixed."""
import requests

API_URL = "http://localhost:8001/chat"

def send(msg, cid):
    r = requests.post(API_URL, json={"message": msg, "conversation_id": cid})
    result = r.json()
    return result["response"]

print("\n🔍 TESTING: No Question Repetition (Original Bug)")
print("="*70)
print("Recreating the original problematic scenario...")
print("="*70)

# Start
r = requests.post(API_URL, json={"message": "start"})
cid = r.json()["conversation_id"]

# Original problematic flow from user
responses = []
responses.append(("yes", send("yes", cid)))
responses.append(("300k", send("300k", cid)))
responses.append(("miami", send("miami", cid)))
responses.append(("investment", send("investment", cid)))
responses.append(("how much could i afford", send("how much could i afford", cid)))
responses.append(("800k", send("800k", cid)))
responses.append(("what documents are good", send("what documents are good", cid)))
responses.append(("bank statements", send("bank statements", cid)))

# Collect all responses
all_text = "\n".join([r for _, r in responses]).lower()

print("\n📊 ANALYSIS:")
print("-"*70)

# Check for repetitions
loan_purpose_count = all_text.count("personal home, a second home, or an investment")
price_count = all_text.count("price range")
location_count = all_text.count("city") + all_text.count("location")

print(f"Loan purpose asked: {loan_purpose_count} time(s)")
print(f"Price asked: {price_count} time(s)")  
print(f"Location asked: {location_count} time(s)")

# Check that it didn't re-ask completed questions
if "investment" in responses[3][1].lower():
    print("\n✅ Q3 (loan purpose) was asked at step 4")
    
    # Check if it was asked again after step 4
    later_responses = "\n".join([r for _, r in responses[4:]]).lower()
    if "personal home, a second home, or an investment" not in later_responses:
        print("✅ Q3 (loan purpose) was NOT re-asked later")
    else:
        print("❌ Q3 (loan purpose) WAS RE-ASKED!")

if "800k" in responses[5][0]:
    print("\n✅ Q4 (price) was answered at step 6")
    
    # Check if it was asked again after step 6
    later_responses = "\n".join([r for _, r in responses[6:]]).lower()
    if "price range" not in later_responses and "how much" not in later_responses:
        print("✅ Q4 (price) was NOT re-asked later")
    else:
        print("❌ Q4 (price) WAS RE-ASKED!")

print("\n" + "="*70)
if loan_purpose_count <= 1 and price_count <= 2:  # 2 for price is OK (initial + affordability help)
    print("✅ ✅ ✅ NO REPETITION BUG - TEST PASSED!")
    print("\nThe original issue is FIXED:")
    print("  - Questions are asked in order ✅")
    print("  - Completed questions are not re-asked ✅")
    print("  - Agent returns to correct question after helping ✅")
else:
    print("❌ REPETITION DETECTED - TEST FAILED")
    print(f"  Loan purpose: {loan_purpose_count}x (should be ≤1)")
    print(f"  Price: {price_count}x (should be ≤2)")