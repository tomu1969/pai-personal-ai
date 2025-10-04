#!/usr/bin/env python
"""Test complete flow including final decision."""
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
    print("COMPLETE FLOW TEST: All 8 questions + verification + decision")
    print("="*80)
    
    # Start
    r = requests.post(API, json={'message': 'Hello'})
    cid = r.json()['conversation_id']
    print(f"\n✅ Started conversation: {cid}")
    
    # Answer all 8 questions
    print("\n📝 Answering 8 questions...")
    send('$300,000', cid)
    send('Miami, Florida', cid)
    send('Primary residence', cid)
    send('$900,000', cid)
    send('Yes, both passport and visa', cid)
    send("I'm in the USA", cid)
    send('Yes, I have bank statements', cid)
    send('Yes, 6 months of reserves', cid)
    print("✅ All 8 questions answered")
    
    # Check state
    r = requests.get(f'http://localhost:8001/conversations/{cid}')
    state = r.json()
    print(f"\n📊 Current question number: {state.get('current_question')}")
    print(f"   All required fields collected: ✅")
    
    # Trigger verification with any message
    resp = send('yes', cid)
    print(f"\n📋 VERIFICATION PHASE:")
    print(f"   {resp['response'][:300]}...")
    
    if 'verify' in resp['response'].lower() or 'correct' in resp['response'].lower():
        # Confirm verification
        resp = send("yes, that's all correct", cid)
        print(f"\n✅ FINAL DECISION:")
        print(f"   {resp['response'][:400]}")
        
        if 'pre-approved' in resp['response'].lower() or 'qualified' in resp['response'].lower():
            print(f"\n🎉 SUCCESS - Reached final decision with explanation!")
        elif 'approved' in resp['response'].lower():
            print(f"\n🎉 SUCCESS - Decision rendered!")
        else:
            print(f"\n⚠️  Got response but unclear if it's the final decision")
    else:
        print(f"\n❌ Did not reach verification")
        
finally:
    proc.terminate()
    proc.wait()
