#!/usr/bin/env python
"""Test reserves extraction."""
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
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    
    send('300k', cid)
    send('miami', cid)
    send('investment', cid)
    send('1 mill', cid)
    send('yes', cid)
    send('mexico', cid)
    send('yes tax returns', cid)
    
    # Now try reserves
    resp = send('yes', cid)
    print(f"Reserves response: {resp['response'][:100]}")
    
    # Check state immediately
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    
    print(f"\nState after 'yes' for reserves:")
    print(f"  current_question: {state.get('current_question')}")
    print(f"  can_demonstrate_income: {state.get('can_demonstrate_income')}")
    print(f"  has_reserves: {state.get('has_reserves')}")
    
    # Try again with more explicit message
    resp = send('yes i have 6 months reserves', cid)
    print(f"\nExplicit response: {resp['response'][:100]}")
    
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\nState after explicit:")
    print(f"  current_question: {state.get('current_question')}")
    print(f"  has_reserves: {state.get('has_reserves')}")
    
finally:
    proc.terminate()
    proc.wait()
