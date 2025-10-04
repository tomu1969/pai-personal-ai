#!/usr/bin/env python
"""Test triggering verification with all data present."""
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
    send('yes tax returns', cid)
    resp = send('yes reserves', cid)
    
    print(f"After Q8: {resp['response'][:150]}")
    
    # Try one more to trigger verification
    resp = send('yes', cid)
    print(f"\nAfter 'yes': {resp['response'][:300]}")
    
    if 'verify' in resp['response'].lower() or 'confirm' in resp['response'].lower():
        print("\n✅ REACHED VERIFICATION")
        # Confirm
        resp = send("yes that's correct", cid)
        print(f"\nFinal decision: {resp['response'][:400]}")
        
        if 'pre-approved' in resp['response'].lower():
            print("\n🎉 SUCCESS: Pre-Approved!")
        else:
            print(f"\n⚠️  Decision: {resp['response'][:100]}")
    else:
        # Check state
        r = requests.get(f'http://localhost:8001/conversations/{cid}')
        state = r.json()
        print(f"\n❌ Still at Q{state.get('current_question')}")
    
finally:
    proc.terminate()
    proc.wait()
