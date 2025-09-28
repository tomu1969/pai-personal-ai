#!/usr/bin/env python
"""Test that the reset bug is fixed."""
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
    print('\n' + '='*70)
    print('COMPREHENSIVE TEST: Verify conversation never resets unexpectedly')
    print('='*70)
    
    # Start conversation
    r = requests.post(API, json={'message': 'start'})
    cid = r.json()['conversation_id']
    
    # Exact user scenario from bug report
    responses = []
    responses.append(('yes', send('yes', cid)))
    responses.append(('300k', send('300k', cid)))
    responses.append(('miami', send('miami', cid)))
    responses.append(('investment', send('investment', cid)))
    responses.append(('it depends on the size of the loan', send('it depends on the size of the loan', cid)))
    
    # Check final response
    last_msg, last_resp = responses[-1]
    
    print(f'\\nUser said: "{last_msg}"')
    print(f'Agent response: {last_resp[:150]}...')
    
    # Check for reset
    if 'Hello!' in last_resp and 'Would you like to get started' in last_resp:
        print('\\n' + '='*70)
        print('❌ ❌ ❌ BUG STILL EXISTS!')
        print('Conversation was reset to greeting.')
        print('='*70)
    elif 'afford' in last_resp.lower() or '720' in last_resp or '1.2' in last_resp:
        print('\\n' + '='*70)
        print('✅ ✅ ✅ BUG FIXED!')
        print('Agent correctly helped with affordability calculation.')
        print('No conversation reset detected.')
        print('='*70)
    else:
        print(f'\\n⚠️  Unexpected response (but not a reset)')
    
    # Additional test: Send "Hello" mid-conversation
    print('\\n--- Additional Test: Send "Hello" mid-conversation ---')
    r = send('Hello', cid)
    
    if 'Would you like to get started' in r:
        print('❌ Sending "Hello" caused reset')
    else:
        print('✅ Sending "Hello" did NOT cause reset')
        print(f'Response: {r[:100]}...')
    
    print('\\n' + '='*70)
    print('Testing Complete')
    print('='*70)
        
finally:
    proc.terminate()
    proc.wait()