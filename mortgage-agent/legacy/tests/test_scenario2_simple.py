#!/usr/bin/env python
"""Scenario 2: Simpler with fewer questions."""
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
    print("SCENARIO 2: With some clarifying questions")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hi'})
    cid = r.json()['conversation_id']
    
    print(f"\nQ1 - User asks first")
    resp = send('What is a down payment?', cid)
    print(f"👤: What is a down payment?")
    print(f"🤖: {resp['response'][:100]}...")
    
    resp = send('$175k', cid)
    print(f"👤: $175k")
    print(f"🤖: {resp['response'][:80]}...")
    
    print(f"\nQ2")
    resp = send('Dallas, TX', cid)
    print(f"👤: Dallas, TX")
    print(f"🤖: {resp['response'][:80]}...")
    
    print(f"\nQ3 - User asks")
    resp = send("What's better, investment or personal?", cid)
    print(f"👤: What's better, investment or personal?")
    print(f"🤖: {resp['response'][:100]}...")
    
    resp = send('personal', cid)
    print(f"👤: personal")
    print(f"🤖: {resp['response'][:80]}...")
    
    print(f"\nQ4 - User needs help")
    resp = send("not sure, what can I afford?", cid)
    print(f"👤: not sure, what can I afford?")
    print(f"🤖: {resp['response'][:100]}...")
    
    resp = send('$650k sounds good', cid)
    print(f"👤: $650k sounds good")
    print(f"🤖: {resp['response'][:80]}...")
    
    print(f"\nQ5-Q8 - Direct answers")
    send('yes both', cid)
    print(f"Q5: ✓")
    
    send('USA', cid)
    print(f"Q6: ✓")
    
    send('yes bank statements', cid)
    print(f"Q7: ✓")
    
    resp = send('yes 9 months', cid)
    print(f"Q8: ✓")
    
    print(f"\n📋 VERIFICATION/DECISION:")
    print(f"{resp['response'][:400]}")
    
    if 'verify' in resp['response'].lower():
        resp = send('yes', cid)
        print(f"\n{resp['response'][:400]}")
    
    if 'pre-approved' in resp['response'].lower():
        print("\n✅ ✅ ✅ SUCCESS: Agent handled questions AND completed pre-approval!")
    else:
        print("\n⚠️  Did not reach pre-approval")
    
finally:
    proc.terminate()
    proc.wait()
