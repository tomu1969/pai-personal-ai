#!/usr/bin/env python
"""Check state in scenario 2."""
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
    r = requests.post(API, json={'message': 'Hi'})
    cid = r.json()['conversation_id']
    
    send('What is a down payment?', cid)
    send('I have $150k', cid)
    send('Miami', cid)
    send("What's the difference between investment and personal?", cid)
    send('investment property', cid)
    send("I'm not sure what I can afford", cid)
    send('$500k', cid)
    send('yes passport and visa', cid)
    send('Colombia', cid)
    send('What documents do I need?', cid)
    send('Yes, I can provide those', cid)
    send('How much reserves do I need?', cid)
    send('Yes, I have 6 months', cid)
    
    # Check state
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    
    print("\n=== STATE ===")
    print(f"current_question: {state.get('current_question')}")
    print(f"down_payment: {state.get('down_payment')}")
    print(f"loan_purpose: {state.get('loan_purpose')}")
    print(f"property_price: {state.get('property_price')}")
    print(f"has_valid_passport: {state.get('has_valid_passport')}")
    print(f"has_valid_visa: {state.get('has_valid_visa')}")
    print(f"current_location: {state.get('current_location')}")
    print(f"can_demonstrate_income: {state.get('can_demonstrate_income')}")
    print(f"has_reserves: {state.get('has_reserves')}")
    
    # Try forcing through
    print("\n=== TRYING TO FORCE THROUGH ===")
    resp = send('yes i have tax returns', cid)
    print(f"Response: {resp['response'][:200]}")
    
    resp = send('yes', cid)
    print(f"\nAfter yes: {resp['response'][:200]}")
    
    if 'pre-approved' in resp['response'].lower():
        print("\n✅ GOT PRE-APPROVED")
    
finally:
    proc.terminate()
    proc.wait()
