#!/usr/bin/env python
"""Scenario 3: Out of order information."""
import requests
import subprocess
import time

proc = subprocess.Popen(['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print('Starting server...')
time.sleep(8)

API = 'http://localhost:8001/chat'

def send(msg, cid):
    r = requests.post(API, json={'message': msg, 'conversation_id': cid})
    return r.json()

try:
    print("\n" + "="*80)
    print("SCENARIO 3: Out of order info")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    
    print(f"\nUser provides multiple pieces of info at once:")
    resp = send('I have $400k down payment, looking at a $1.5M house in Seattle for investment', cid)
    print(f"👤: I have $400k down payment, looking at a $1.5M house in Seattle for investment")
    print(f"🤖: {resp['response'][:150]}...")
    
    # Check what was extracted
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\nExtracted so far:")
    print(f"  down_payment: {state.get('down_payment')}")
    print(f"  property_city: {state.get('property_city')}")
    print(f"  loan_purpose: {state.get('loan_purpose')}")
    print(f"  property_price: {state.get('property_price')}")
    
    # Continue with remaining questions
    print(f"\nContinuing with missing info:")
    
    if not state.get('property_city'):
        resp = send('Washington state', cid)
        print(f"👤: Washington state")
        print(f"🤖: {resp['response'][:80]}...")
    
    send('yes passport and visa', cid)
    print(f"Q5: ✓")
    
    send('USA', cid)
    print(f"Q6: ✓")
    
    send('yes tax returns', cid)
    print(f"Q7: ✓")
    
    resp = send('yes 8 months', cid)
    print(f"Q8: ✓")
    
    print(f"\n📋 RESULT:")
    print(f"{resp['response'][:400]}")
    
    if 'verify' in resp['response'].lower():
        resp = send('yes correct', cid)
        print(f"\n{resp['response'][:400]}")
    
    if 'pre-approved' in resp['response'].lower():
        print("\n✅ ✅ ✅ SUCCESS: Handled out-of-order info!")
    
finally:
    proc.terminate()
    proc.wait()
