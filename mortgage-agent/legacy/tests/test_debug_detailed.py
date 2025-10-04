#!/usr/bin/env python
"""Detailed debug to see what's happening with loan_purpose."""
import requests
import subprocess
import time

proc = subprocess.Popen(['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
print('Starting server...')
time.sleep(8)

API = 'http://localhost:8001/chat'

try:
    # Start
    r = requests.post(API, json={'message': 'start'})
    cid = r.json()['conversation_id']
    print(f"1. START -> CID: {cid}")
    
    # Q1
    r = requests.post(API, json={'message': 'I have $300,000', 'conversation_id': cid})
    print(f"2. Q1 (down payment) -> {r.json()['response'][:80]}")
    
    # Q2
    r = requests.post(API, json={'message': 'Miami, Florida', 'conversation_id': cid})
    print(f"3. Q2 (location) -> {r.json()['response'][:80]}")
    
    # Q3
    r = requests.post(API, json={'message': 'Primary residence', 'conversation_id': cid})
    print(f"4. Q3 (purpose) -> {r.json()['response'][:80]}")
    
    # Check state
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\n=== STATE AFTER Q3 ===")
    print(f"current_question: {state.get('current_question')}")
    print(f"loan_purpose: '{state.get('loan_purpose')}'")
    print(f"property_price: {state.get('property_price')}")
    print(f"down_payment: {state.get('down_payment')}")
    
    # Q4
    r = requests.post(API, json={'message': '$900,000', 'conversation_id': cid})
    print(f"\n5. Q4 (price) -> {r.json()['response'][:80]}")
    
    # Check state again
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\n=== STATE AFTER Q4 ===")
    print(f"current_question: {state.get('current_question')}")
    print(f"loan_purpose: '{state.get('loan_purpose')}'")
    print(f"property_price: {state.get('property_price')}")
    
finally:
    proc.terminate()
    proc.wait()