#!/usr/bin/env python
"""Test if we reach verification despite wrong LLM text."""
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
    # Rapid fire through all 8 questions
    r = requests.post(API, json={'message': 'start'})
    cid = r.json()['conversation_id']
    
    send('$300,000', cid)  # Q1
    send('Miami, Florida', cid)  # Q2
    send('Primary residence', cid)  # Q3
    send('$900,000', cid)  # Q4
    send('Yes, passport and visa', cid)  # Q5
    send('USA', cid)  # Q6
    send('Yes, bank statements', cid)  # Q7
    resp = send('Yes, 6 months', cid)  # Q8
    
    print(f"After Q8: {resp['response'][:150]}")
    
    # Check state
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\nCurrent question: {state.get('current_question')}")
    print(f"All data: down={state.get('down_payment')}, price={state.get('property_price')}")
    print(f"  loan_purpose={state.get('loan_purpose')}")
    print(f"  passport={state.get('has_valid_passport')}, visa={state.get('has_valid_visa')}")
    print(f"  location={state.get('current_location')}")
    print(f"  income={state.get('can_demonstrate_income')}, reserves={state.get('has_reserves')}")
    
    # Try one more message to trigger verification
    resp = send('yes', cid)
    print(f"\nAfter 'yes': {resp['response'][:200]}")
    
    if 'verify' in resp['response'].lower() or 'correct' in resp['response'].lower():
        print("\n✅ REACHED VERIFICATION!")
    elif 'approved' in resp['response'].lower() or 'qualified' in resp['response'].lower():
        print("\n✅ REACHED FINAL DECISION!")
    else:
        print(f"\n❌ Still in questions")
        
finally:
    proc.terminate()
    proc.wait()