#!/usr/bin/env python
"""Test context-aware extraction fixes."""
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
    print("TEST 1: '1m' pattern extraction")
    print("="*80)
    
    r = send("I'm looking at a 1m property")
    if r and 'property_price' in r.get('captured_slots', {}):
        val = r['captured_slots']['property_price']['value']
        if val == 1000000.0:
            print(f"✅ TEST 1 PASSED: '1m' → ${val:,.0f}")
        else:
            print(f"⚠️  TEST 1 FAILED: '1m' → ${val:,.0f} (expected $1,000,000)")
    else:
        print(f"❌ TEST 1 FAILED: '1m' not extracted")
    
    print("\n" + "="*80)
    print("TEST 2: Context-aware down_payment extraction")
    print("="*80)
    
    # Follow proper flow: loan_purpose → location → price → DOWN PAYMENT
    r1 = send("investment")
    cid = r1['conversation_id']
    send("Miami, FL", cid)
    send("1m", cid)  # property_price
    r2 = send("300k", cid)  # Should be down_payment
    
    if r2:
        print(f"User: '300k' (after being asked about down payment)")
        if 'down_payment' in r2.get('captured_slots', {}):
            val = r2['captured_slots']['down_payment']['value']
            print(f"✅ TEST 2 PASSED: Captured as down_payment = ${val:,.0f}")
        else:
            print(f"❌ TEST 2 FAILED: Not captured as down_payment")
            print(f"   Captured: {list(r2.get('captured_slots', {}).keys())}")
    
    print("\n" + "="*80)
    print("TEST 3: Multi-value extraction still works")
    print("="*80)
    
    r3 = send("$200k down on $800k Miami condo, investment")
    if r3:
        slots = r3.get('captured_slots', {})
        has_down = 'down_payment' in slots and slots['down_payment']['value'] == 200000.0
        has_price = 'property_price' in slots and slots['property_price']['value'] == 800000.0
        has_city = 'property_city' in slots and slots['property_city']['value'] == 'Miami'
        has_purpose = 'loan_purpose' in slots and slots['loan_purpose']['value'] == 'investment'
        
        if has_down and has_price and has_city and has_purpose:
            print(f"✅ TEST 3 PASSED: All 4 entities extracted correctly")
        else:
            print(f"⚠️  TEST 3 PARTIAL:")
            print(f"  down_payment: {'✅' if has_down else '❌'}")
            print(f"  property_price: {'✅' if has_price else '❌'}")
            print(f"  property_city: {'✅' if has_city else '❌'}")
            print(f"  loan_purpose: {'✅' if has_purpose else '❌'}")
    
    print("\n" + "="*80)
    print("TEST 4: Full conversation - no double asking")
    print("="*80)
    
    r1 = send("investment property")
    cid = r1['conversation_id']
    r2 = send("Miami", cid)
    r3 = send("1m", cid)
    r4 = send("300k", cid)
    r5 = send("yes passport and visa", cid)
    r6 = send("yes income docs", cid)
    r7 = send("yes reserves", cid)
    r8 = send("yes", cid)  # Confirm verification
    
    # Check if property_price was ever asked twice
    responses = [r1['response'], r2['response'], r3['response'], r4['response'], 
                r5['response'], r6['response'], r7['response']]
    
    price_asks = sum(1 for r in responses if 'property' in r.lower() and 'price' in r.lower())
    
    if price_asks <= 1:
        print(f"✅ TEST 4 PASSED: Property price asked {price_asks} time(s)")
    else:
        print(f"❌ TEST 4 FAILED: Property price asked {price_asks} times")
    
    print("\n" + "="*80)
    print("✅ CONTEXT-AWARE EXTRACTION TESTS COMPLETED")
    print("="*80 + "\n")

except Exception as e:
    print(f"\n❌ TEST FAILED: {e}")
    import traceback
    traceback.print_exc()

finally:
    print("\nStopping server...")
    proc.send_signal(signal.SIGTERM)
    proc.wait(timeout=5)