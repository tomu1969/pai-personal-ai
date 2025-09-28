#!/usr/bin/env python
"""Comprehensive test of slot-filling system."""
import subprocess
import time
import requests
import signal

print("Starting slot-filling API server...")
proc = subprocess.Popen(
    ['python', '-m', 'uvicorn', 'src.slot_api:app', '--host', '0.0.0.0', '--port', '8002'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(8)

API = 'http://localhost:8002/chat'

def send(msg, cid=None):
    try:
        payload = {'message': msg}
        if cid:
            payload['conversation_id'] = cid
        r = requests.post(API, json=payload, timeout=30)
        return r.json()
    except Exception as e:
        print(f"ERROR: {e}")
        return None

try:
    print("\n" + "="*80)
    print("TEST 1: Multi-fact extraction")
    print("="*80)
    
    r = send("$200k down on $800k Miami condo, investment")
    if r:
        print(f"\n👤: $200k down on $800k Miami condo, investment")
        print(f"🤖: {r['response']}")
        print(f"\n📊 Captured slots:")
        for slot, data in r.get('captured_slots', {}).items():
            print(f"  • {slot}: {data['value']} (conf={data['confidence']:.2f})")
        
        expected = {
            "down_payment": 200000.0,
            "property_price": 800000.0,
            "property_city": "Miami",
            "loan_purpose": "investment"
        }
        
        captured = r.get('captured_slots', {})
        success = all(
            slot in captured and captured[slot]['value'] == val
            for slot, val in expected.items()
        )
        
        if success:
            print("\n✅ TEST 1 PASSED: All entities extracted correctly!")
        else:
            print("\n⚠️  TEST 1 PARTIAL: Some entities missing")
            for slot, val in expected.items():
                if slot not in captured:
                    print(f"  Missing: {slot}")
                elif captured[slot]['value'] != val:
                    print(f"  Wrong: {slot} = {captured[slot]['value']}, expected {val}")
    
    print("\n" + "="*80)
    print("TEST 2: Synonym extraction (Airbnb → investment)")
    print("="*80)
    
    r2 = send("Hello")
    if r2:
        cid2 = r2['conversation_id']
        r3 = send("I want to rent it on Airbnb", cid2)
        
        if r3:
            print(f"\n👤: I want to rent it on Airbnb")
            print(f"🤖: {r3['response'][:150]}...")
            
            captured = r3.get('captured_slots', {})
            if 'loan_purpose' in captured and captured['loan_purpose']['value'] == 'investment':
                print("\n✅ TEST 2 PASSED: 'Airbnb' → 'investment'")
            else:
                print(f"\n⚠️  TEST 2 FAILED: loan_purpose = {captured.get('loan_purpose', 'missing')}")
    
    print("\n" + "="*80)
    print("TEST 3: LTV validation (insufficient down payment)")
    print("="*80)
    
    r4 = send("New conversation")
    if r4:
        cid3 = r4['conversation_id']
        # Send price and insufficient down payment
        send("$500k property with $50k down, personal", cid3)
        send("yes passport and visa", cid3)
        send("yes income docs", cid3)
        send("yes reserves", cid3)
        
        # Confirm the verification
        r5 = send("yes", cid3)
        
        if r5:
            print(f"\n👤: [Completed all questions with 10% down payment]")
            print(f"🤖: {r5['response'][:200]}...")
            
            if 'rejected' in r5['response'].lower() or '25%' in r5['response']:
                print("\n✅ TEST 3 PASSED: Rejected for insufficient down payment")
            else:
                print("\n⚠️  TEST 3 FAILED: Should have been rejected")
    
    print("\n" + "="*80)
    print("TEST 4: Priority queue (asks loan_purpose first)")
    print("="*80)
    
    r6 = send("Starting fresh")
    if r6:
        print(f"\n👤: Starting fresh")
        print(f"🤖: {r6['response']}")
        
        if 'purpose' in r6['response'].lower() or 'use' in r6['response'].lower():
            print("\n✅ TEST 4 PASSED: First question about loan purpose")
        else:
            print(f"\n⚠️  TEST 4 FAILED: First question should be about loan purpose")
    
    print("\n" + "="*80)
    print("✅ SLOT-FILLING SYSTEM TESTS COMPLETED")
    print("="*80 + "\n")

except Exception as e:
    print(f"\n❌ TEST FAILED: {e}")
    import traceback
    traceback.print_exc()

finally:
    print("\nStopping server...")
    proc.send_signal(signal.SIGTERM)
    proc.wait(timeout=5)