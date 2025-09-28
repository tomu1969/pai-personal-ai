#!/usr/bin/env python
"""Test exact user scenario from logs."""
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
    print("EXACT USER SCENARIO TEST")
    print("="*80)
    
    # Start
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    print(f"\n🤖: {r.json()['response']}\n")
    
    # Follow exact user inputs
    resp = send('yes', cid)
    print(f"👤: yes")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('300k', cid)
    print(f"👤: 300k")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('miami', cid)
    print(f"👤: miami")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('investment', cid)
    print(f"👤: investment")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('it depends on the loan amount', cid)
    print(f"👤: it depends on the loan amount")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('1 mill', cid)
    print(f"👤: 1 mill")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('yes', cid)
    print(f"👤: yes (passport/visa)")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('mexico', cid)
    print(f"👤: mexico")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('how do i do that', cid)
    print(f"👤: how do i do that (income)")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('yes i can provide tax returns', cid)
    print(f"👤: yes i can provide tax returns")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('how much do i need', cid)
    print(f"👤: how much do i need (reserves)")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('what does this amount to', cid)
    print(f"👤: what does this amount to")
    print(f"🤖: {resp['response']}\n")
    
    resp = send('yes', cid)
    print(f"👤: yes (reserves)")
    print(f"🤖: {resp['response'][:400]}\n")
    
    # Check for decision
    if 'pre-approved' in resp['response'].lower():
        print("\n✅ SUCCESS: Reached Pre-Approved decision!")
    elif 'review' in resp['response'].lower():
        print("\n⚠️  ISSUE: Needs Review")
        # Check state
        r = requests.get(f'http://localhost:8001/conversations/{cid}')
        state = r.json()
        print(f"loan_purpose in state: '{state.get('loan_purpose')}'")
    else:
        print("\n❌ ISSUE: No clear decision")
    
finally:
    proc.terminate()
    proc.wait()
