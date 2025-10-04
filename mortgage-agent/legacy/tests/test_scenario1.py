#!/usr/bin/env python
"""Scenario 1: Direct straightforward answers."""
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
    print("SCENARIO 1: Direct answers, no questions")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    print(f"\n🤖: {r.json()['response']}")
    
    print(f"\n👤: $250,000")
    resp = send('$250,000', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: Austin, Texas")
    resp = send('Austin, Texas', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: personal home")
    resp = send('personal home', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: $800,000")
    resp = send('$800,000', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: Yes, I have both")
    resp = send('Yes, I have both', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: USA")
    resp = send('USA', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: Yes, bank statements")
    resp = send('Yes, bank statements', cid)
    print(f"🤖: {resp['response']}")
    
    print(f"\n👤: Yes, 12 months")
    resp = send('Yes, 12 months', cid)
    print(f"🤖: {resp['response'][:400]}")
    
    if 'verify' in resp['response'].lower():
        print(f"\n👤: yes correct")
        resp = send('yes correct', cid)
        print(f"🤖: {resp['response'][:400]}")
    
    if 'pre-approved' in resp['response'].lower():
        print("\n✅ SUCCESS: PRE-APPROVED")
    elif 'review' in resp['response'].lower():
        print("\n📋 RESULT: NEEDS REVIEW")
    else:
        print("\n❌ No clear decision")
        
finally:
    proc.terminate()
    proc.wait()
