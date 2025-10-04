#!/usr/bin/env python
"""Simple test of complete flow with clarifying questions."""
import requests
import subprocess
import time

# Start server
proc = subprocess.Popen(['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print('Starting server...')
time.sleep(8)

API = 'http://localhost:8001/chat'

def send(msg, cid):
    r = requests.post(API, json={'message': msg, 'conversation_id': cid})
    return r.json()['response']

try:
    print('\n' + '='*80)
    print('SIMPLE FLOW TEST: Answer questions + ask clarifications')
    print('='*80)
    
    # Start
    r = requests.post(API, json={'message': 'yes'})
    cid = r.json()['conversation_id']
    print(f"\n1️⃣  START")
    print(f"🤖 {r.json()['response'][:150]}")
    
    # Q1: Down payment
    resp = send('I have $300,000 saved', cid)
    print(f"\n2️⃣  Q1: Down Payment")
    print(f"👤 I have $300,000 saved")
    print(f"🤖 {resp[:150]}")
    
    # Q2: Location
    resp = send('Miami, Florida', cid)
    print(f"\n3️⃣  Q2: Location")
    print(f"👤 Miami, Florida")
    print(f"🤖 {resp[:150]}")
    
    # Q3: Purpose - ASK QUESTION FIRST
    resp = send('What\'s the difference between investment and primary residence?', cid)
    print(f"\n4️⃣  Q3: Purpose (user asks question)")
    print(f"👤 What's the difference between investment and primary residence?")
    print(f"🤖 {resp[:200]}")
    
    # Q3: Now answer
    resp = send('Primary residence', cid)
    print(f"\n5️⃣  Q3: Purpose (user answers)")
    print(f"👤 Primary residence")
    print(f"🤖 {resp[:150]}")
    
    # Q4: Price - EXPRESS UNCERTAINTY
    resp = send('I\'m not sure what I can afford', cid)
    print(f"\n6️⃣  Q4: Price (user needs help)")
    print(f"👤 I'm not sure what I can afford")
    print(f"🤖 {resp[:200]}")
    
    # Q4: Accept suggestion
    resp = send('$900,000', cid)
    print(f"\n7️⃣  Q4: Price (user decides)")
    print(f"👤 $900,000")
    print(f"🤖 {resp[:150]}")
    
    # Q5-Q8: Quick answers
    resp = send('Yes, I have passport and visa', cid)
    print(f"\n8️⃣  Q5: Documents")
    print(f"👤 Yes, I have passport and visa")
    print(f"🤖 {resp[:100]}")
    
    resp = send('I\'m in the USA', cid)
    print(f"\n9️⃣  Q6: Current location")
    print(f"👤 I'm in the USA")
    print(f"🤖 {resp[:100]}")
    
    resp = send('Yes, bank statements', cid)
    print(f"\n🔟 Q7: Income proof")
    print(f"👤 Yes, bank statements")
    print(f"🤖 {resp[:100]}")
    
    resp = send('Yes, 6 months', cid)
    print(f"\n1️⃣1️⃣  Q8: Reserves")
    print(f"👤 Yes, 6 months")
    print(f"🤖 {resp[:200]}")
    
    # Should get verification
    if 'correct' in resp.lower() or 'verify' in resp.lower() or 'confirm' in resp.lower():
        print(f"\n✅ VERIFICATION PHASE REACHED")
        resp = send('yes, that\'s correct', cid)
        print(f"👤 yes, that's correct")
        print(f"🤖 {resp[:300]}")
        
        if 'pre-approved' in resp.lower() or 'qualified' in resp.lower():
            print(f"\n✅ FINAL DECISION WITH EXPLANATION")
        else:
            print(f"\n⚠️  Final decision unclear")
    else:
        print(f"\n❌ DID NOT REACH VERIFICATION")
    
finally:
    proc.terminate()
    proc.wait()