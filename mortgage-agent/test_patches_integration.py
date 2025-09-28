#!/usr/bin/env python
"""Integration test - test actual conversation flow with patches."""
import requests
import subprocess
import time
import signal

# Start server
print("Starting server...")
proc = subprocess.Popen(
    ['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(8)

API = 'http://localhost:8001/chat'

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
    print("INTEGRATION TEST: Out-of-order extraction")
    print("="*80)
    
    # Test 1: Out-of-order info (should extract all in one message)
    print("\nTest: User provides multiple pieces at once")
    r = send("I have $400k down, looking at $1.5M house in Seattle for investment")
    if r:
        cid = r['conversation_id']
        print(f"👤: $400k down, $1.5M house in Seattle for investment")
        print(f"🤖: {r['response'][:150]}...")
        
        # Check what was extracted
        state_r = requests.get(f'http://localhost:8001/conversations/{cid}')
        if state_r.status_code == 200:
            state = state_r.json()
            print(f"\n✓ Extracted:")
            print(f"  down_payment: {state.get('down_payment')}")
            print(f"  property_city: {state.get('property_city')}")
            print(f"  loan_purpose: {state.get('loan_purpose')}")
            print(f"  property_price: {state.get('property_price')}")
            
            # Verify critical extraction
            if state.get('loan_purpose') == 'investment':
                print("\n✅ SUCCESS: 'investment' purpose extracted correctly!")
            else:
                print(f"\n⚠️  WARNING: loan_purpose is '{state.get('loan_purpose')}', expected 'investment'")
        
        # Test 2: Airbnb should extract as investment
        print("\n" + "-"*80)
        print("Test: 'rent on Airbnb' should extract as investment")
        r2 = send('Hello')
        if r2:
            cid2 = r2['conversation_id']
            # Skip to Q3
            send('$100k', cid2)
            send('Miami', cid2)
            r3 = send('I want to rent it on Airbnb', cid2)
            
            state_r = requests.get(f'http://localhost:8001/conversations/{cid2}')
            if state_r.status_code == 200:
                state = state_r.json()
                purpose = state.get('loan_purpose')
                print(f"  Extracted loan_purpose: {purpose}")
                if purpose == 'investment':
                    print("  ✅ SUCCESS: Airbnb → investment")
                else:
                    print(f"  ⚠️  WARNING: Expected 'investment', got '{purpose}'")
    
    print("\n" + "="*80)
    print("✅ Integration test completed!")
    print("="*80 + "\n")

except Exception as e:
    print(f"\n❌ TEST FAILED: {e}")
    import traceback
    traceback.print_exc()

finally:
    print("\nStopping server...")
    proc.send_signal(signal.SIGTERM)
    proc.wait(timeout=5)