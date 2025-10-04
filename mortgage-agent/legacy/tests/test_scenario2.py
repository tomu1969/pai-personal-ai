#!/usr/bin/env python
"""Scenario 2: User asks clarifying questions."""
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

def show(label, user, bot):
    print(f"\n{label}")
    print(f"👤: {user}")
    print(f"🤖: {bot[:150]}...")

try:
    print("\n" + "="*80)
    print("SCENARIO 2: With clarifying questions")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hi'})
    cid = r.json()['conversation_id']
    
    resp = send('What is a down payment?', cid)
    show("USER ASKS", "What is a down payment?", resp['response'])
    
    resp = send('I have $150k', cid)
    show("Q1", "I have $150k", resp['response'])
    
    resp = send('Miami', cid)
    show("Q2", "Miami", resp['response'])
    
    resp = send("What's the difference between investment and personal?", cid)
    show("USER ASKS", "What's the difference between investment and personal?", resp['response'])
    
    resp = send('investment property', cid)
    show("Q3", "investment property", resp['response'])
    
    resp = send("I'm not sure what I can afford", cid)
    show("USER ASKS", "I'm not sure what I can afford", resp['response'])
    
    resp = send('$500k', cid)
    show("Q4", "$500k", resp['response'])
    
    resp = send('yes passport and visa', cid)
    show("Q5", "yes passport and visa", resp['response'])
    
    resp = send('Colombia', cid)
    show("Q6", "Colombia", resp['response'])
    
    resp = send('What documents do I need?', cid)
    show("USER ASKS", "What documents do I need?", resp['response'])
    
    resp = send('Yes, I can provide those', cid)
    show("Q7", "Yes, I can provide those", resp['response'])
    
    resp = send('How much reserves do I need?', cid)
    show("USER ASKS", "How much reserves do I need?", resp['response'])
    
    resp = send('Yes, I have 6 months', cid)
    print(f"\nQ8")
    print(f"👤: Yes, I have 6 months")
    print(f"🤖: {resp['response'][:300]}...")
    
    if 'verify' in resp['response'].lower() or 'pre-approved' in resp['response'].lower():
        if 'pre-approved' not in resp['response'].lower():
            resp = send('yes', cid)
            print(f"\n👤: yes")
            print(f"🤖: {resp['response'][:400]}")
        
        if 'pre-approved' in resp['response'].lower():
            print("\n✅ ✅ ✅ RESULT: PRE-APPROVED")
            print("Agent successfully answered questions AND completed pre-approval!")
        
finally:
    proc.terminate()
    proc.wait()
