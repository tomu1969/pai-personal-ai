#!/usr/bin/env python
"""Debug test to see server logs."""
import requests
import subprocess
import time
import sys

# Start server with logs visible
proc = subprocess.Popen(['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)

print('Starting server...')
time.sleep(8)

API = 'http://localhost:8001/chat'

try:
    # Start conversation
    print("\n=== SENDING: 'yes' ===")
    r = requests.post(API, json={'message': 'yes'})
    cid = r.json()['conversation_id']
    print(f"Response: {r.json()['response'][:100]}")
    
    # Send down payment
    print("\n=== SENDING: 'I have $250,000 saved' ===")
    r = requests.post(API, json={'message': 'I have $250,000 saved', 'conversation_id': cid})
    print(f"Response: {r.json()['response'][:100]}")
    
    # Check logs
    print("\n=== SERVER LOGS ===")
    time.sleep(1)
    proc.terminate()
    output, _ = proc.communicate(timeout=5)
    
    # Print last 100 lines of logs
    log_lines = output.split('\n')
    for line in log_lines[-100:]:
        if 'Graph Processing' in line or 'FALLBACK' in line or 'Advance' in line or 'extracted' in line:
            print(line)
    
except Exception as e:
    print(f"Error: {e}")
    proc.terminate()
    proc.wait()