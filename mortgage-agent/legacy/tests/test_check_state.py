#!/usr/bin/env python
"""Check state after all questions."""
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
    # Quick run through
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    
    send('300k', cid)
    send('miami', cid)
    send('investment', cid)
    send('1 mill', cid)
    send('yes', cid)
    send('mexico', cid)
    send('yes i can provide tax returns', cid)
    send('yes', cid)  # reserves
    
    # Check state
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    
    print("\n=== STATE CHECK ===")
    print(f"current_question: {state.get('current_question')}")
    print(f"down_payment: {state.get('down_payment')}")
    print(f"property_city: {state.get('property_city')}")
    print(f"property_state: {state.get('property_state')}")
    print(f"loan_purpose: '{state.get('loan_purpose')}'")
    print(f"property_price: {state.get('property_price')}")
    print(f"has_valid_passport: {state.get('has_valid_passport')}")
    print(f"has_valid_visa: {state.get('has_valid_visa')}")
    print(f"current_location: {state.get('current_location')}")
    print(f"can_demonstrate_income: {state.get('can_demonstrate_income')}")
    print(f"has_reserves: {state.get('has_reserves')}")
    
    print(f"\n=== MISSING DATA CHECK ===")
    missing = []
    if not state.get("down_payment"): missing.append("down_payment")
    if not state.get("loan_purpose"): missing.append("loan_purpose")
    if not state.get("property_price"): missing.append("property_price")
    if state.get("has_valid_passport") is None: missing.append("has_valid_passport")
    if state.get("has_valid_visa") is None: missing.append("has_valid_visa")
    if state.get("can_demonstrate_income") is None: missing.append("can_demonstrate_income")
    if state.get("has_reserves") is None: missing.append("has_reserves")
    
    if missing:
        print(f"Missing: {', '.join(missing)}")
    else:
        print("All data present! Should be in verification.")
    
finally:
    proc.terminate()
    proc.wait()
