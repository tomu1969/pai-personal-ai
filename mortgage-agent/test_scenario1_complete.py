#!/usr/bin/env python
"""Scenario 1: Direct straightforward answers - COMPLETE."""
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
    print(f"\nSTART")
    
    send('$250,000', cid)
    print(f"Q1: ✓")
    
    send('Austin, Texas', cid)
    print(f"Q2: ✓")
    
    send('personal home', cid)
    print(f"Q3: ✓")
    
    send('$800,000', cid)
    print(f"Q4: ✓")
    
    send('Yes, I have both', cid)
    print(f"Q5: ✓")
    
    send('USA', cid)
    print(f"Q6: ✓")
    
    send('Yes, bank statements', cid)
    print(f"Q7: ✓")
    
    resp = send('Yes, 12 months', cid)
    print(f"Q8: ✓")
    
    print(f"\n📋 VERIFICATION:")
    print(f"{resp['response'][:300]}...")
    
    if 'verify' in resp['response'].lower() or 'confirm' in resp['response'].lower():
        print(f"\n👤: yes that's correct")
        resp = send('yes correct', cid)
        print(f"\n📊 FINAL DECISION:")
        print(f"{resp['response'][:500]}")
        
        if 'pre-approved' in resp['response'].lower():
            print("\n✅ ✅ ✅ RESULT: PRE-APPROVED")
        elif 'review' in resp['response'].lower():
            print("\n📋 RESULT: NEEDS REVIEW")
    
finally:
    proc.terminate()
    proc.wait()
