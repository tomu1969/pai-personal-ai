#!/usr/bin/env python
"""Test multiple conversation scenarios."""
import requests
import subprocess
import time
import sys

proc = subprocess.Popen(['python', '-m', 'uvicorn', 'src.api:app', '--host', '0.0.0.0', '--port', '8001'],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print('Starting server...')
time.sleep(8)

API = 'http://localhost:8001/chat'

def send(msg, cid):
    r = requests.post(API, json={'message': msg, 'conversation_id': cid})
    return r.json()

def print_exchange(label, user_msg, bot_response):
    print(f"\n{label}")
    print(f"👤: {user_msg}")
    print(f"🤖: {bot_response[:200]}{'...' if len(bot_response) > 200 else ''}")

try:
    # ==================== SCENARIO 1: STRAIGHTFORWARD ==================== 
    print("\n" + "="*80)
    print("SCENARIO 1: Direct answers, no questions")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hello'})
    cid1 = r.json()['conversation_id']
    print(f"🤖: {r.json()['response'][:150]}...")
    
    resp = send('$250,000', cid1)
    print_exchange("Q1", "$250,000", resp['response'])
    
    resp = send('Austin, Texas', cid1)
    print_exchange("Q2", "Austin, Texas", resp['response'])
    
    resp = send('personal home', cid1)
    print_exchange("Q3", "personal home", resp['response'])
    
    resp = send('$800,000', cid1)
    print_exchange("Q4", "$800,000", resp['response'])
    
    resp = send('Yes, I have both', cid1)
    print_exchange("Q5", "Yes, I have both", resp['response'])
    
    resp = send('USA', cid1)
    print_exchange("Q6", "USA", resp['response'])
    
    resp = send('Yes, bank statements', cid1)
    print_exchange("Q7", "Yes, bank statements", resp['response'])
    
    resp = send('Yes, 12 months', cid1)
    print_exchange("Q8", "Yes, 12 months", resp['response'])
    
    if 'verify' in resp['response'].lower() or 'confirm' in resp['response'].lower():
        resp = send('yes correct', cid1)
        print(f"\n✅ VERIFICATION: {resp['response'][:300]}...")
        
        if 'pre-approved' in resp['response'].lower():
            print("\n🎉 RESULT: PRE-APPROVED")
        else:
            print(f"\n📋 RESULT: {resp['response'][:100]}")
    
    # ==================== SCENARIO 2: WITH CLARIFYING QUESTIONS ==================== 
    print("\n\n" + "="*80)
    print("SCENARIO 2: User asks clarifying questions")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hi'})
    cid2 = r.json()['conversation_id']
    print(f"🤖: {r.json()['response'][:150]}...")
    
    resp = send('What is a down payment?', cid2)
    print_exchange("QUESTION", "What is a down payment?", resp['response'])
    
    resp = send('I have $150k', cid2)
    print_exchange("Q1 ANSWER", "I have $150k", resp['response'])
    
    resp = send('Miami', cid2)
    print_exchange("Q2", "Miami", resp['response'])
    
    resp = send("What's the difference between investment and personal?", cid2)
    print_exchange("QUESTION", "What's the difference between investment and personal?", resp['response'])
    
    resp = send('investment property', cid2)
    print_exchange("Q3 ANSWER", "investment property", resp['response'])
    
    resp = send("I'm not sure what I can afford", cid2)
    print_exchange("Q4 QUESTION", "I'm not sure what I can afford", resp['response'])
    
    resp = send('$500k', cid2)
    print_exchange("Q4 ANSWER", "$500k", resp['response'])
    
    resp = send('yes passport and visa', cid2)
    print_exchange("Q5", "yes passport and visa", resp['response'])
    
    resp = send('Colombia', cid2)
    print_exchange("Q6", "Colombia", resp['response'])
    
    resp = send('What documents do I need?', cid2)
    print_exchange("Q7 QUESTION", "What documents do I need?", resp['response'])
    
    resp = send('Yes, I can provide those', cid2)
    print_exchange("Q7 ANSWER", "Yes, I can provide those", resp['response'])
    
    resp = send('How much reserves do I need?', cid2)
    print_exchange("Q8 QUESTION", "How much reserves do I need?", resp['response'])
    
    resp = send('Yes, I have 6 months', cid2)
    print_exchange("Q8 ANSWER", "Yes, I have 6 months", resp['response'])
    
    if 'verify' in resp['response'].lower() or 'confirm' in resp['response'].lower() or 'pre-approved' in resp['response'].lower():
        if 'pre-approved' not in resp['response'].lower():
            resp = send('yes', cid2)
        print(f"\n✅ FINAL: {resp['response'][:300]}...")
        if 'pre-approved' in resp['response'].lower():
            print("\n🎉 RESULT: PRE-APPROVED")
    
    # ==================== SCENARIO 3: OUT OF ORDER INFO ==================== 
    print("\n\n" + "="*80)
    print("SCENARIO 3: User provides info out of order")
    print("="*80)
    
    r = requests.post(API, json={'message': 'Hello'})
    cid3 = r.json()['conversation_id']
    print(f"🤖: {r.json()['response'][:150]}...")
    
    resp = send('I have $400k and looking at $1.5M house in Seattle for investment', cid3)
    print_exchange("MULTIPLE INFO", "I have $400k and looking at $1.5M house in Seattle for investment", resp['response'])
    
    resp = send('Washington state', cid3)
    print_exchange("CLARIFY", "Washington state", resp['response'])
    
    resp = send('yes passport and visa', cid3)
    print_exchange("Q5", "yes passport and visa", resp['response'])
    
    resp = send('USA', cid3)
    print_exchange("Q6", "USA", resp['response'])
    
    resp = send('yes tax returns', cid3)
    print_exchange("Q7", "yes tax returns", resp['response'])
    
    resp = send('yes', cid3)
    print_exchange("Q8", "yes", resp['response'])
    
    if 'verify' in resp['response'].lower() or 'pre-approved' in resp['response'].lower():
        if 'pre-approved' not in resp['response'].lower():
            resp = send('correct', cid3)
        print(f"\n✅ FINAL: {resp['response'][:300]}...")
        if 'pre-approved' in resp['response'].lower():
            print("\n🎉 RESULT: PRE-APPROVED")
    
    # ==================== SCENARIO 4: BORDERLINE CASE ==================== 
    print("\n\n" + "="*80)
    print("SCENARIO 4: Borderline case (low down payment)")
    print("="*80)
    
    r = requests.post(API, json={'message': 'start'})
    cid4 = r.json()['conversation_id']
    print(f"🤖: {r.json()['response'][:150]}...")
    
    resp = send('$50,000', cid4)
    print_exchange("Q1", "$50,000", resp['response'])
    
    resp = send('Phoenix, Arizona', cid4)
    print_exchange("Q2", "Phoenix, Arizona", resp['response'])
    
    resp = send('second home', cid4)
    print_exchange("Q3", "second home", resp['response'])
    
    resp = send('What can I afford?', cid4)
    print_exchange("Q4 QUESTION", "What can I afford?", resp['response'])
    
    resp = send('$200,000', cid4)
    print_exchange("Q4", "$200,000", resp['response'])
    
    resp = send('yes', cid4)
    print_exchange("Q5", "yes", resp['response'])
    
    resp = send('Mexico', cid4)
    print_exchange("Q6", "Mexico", resp['response'])
    
    resp = send('yes', cid4)
    print_exchange("Q7", "yes", resp['response'])
    
    resp = send('3 months', cid4)
    print_exchange("Q8", "3 months", resp['response'])
    
    if 'verify' in resp['response'].lower() or 'review' in resp['response'].lower() or 'pre-approved' in resp['response'].lower():
        if 'pre-approved' not in resp['response'].lower() and 'review' not in resp['response'].lower():
            resp = send('yes', cid4)
        print(f"\n✅ FINAL: {resp['response'][:300]}...")
        if 'pre-approved' in resp['response'].lower():
            print("\n🎉 RESULT: PRE-APPROVED")
        elif 'review' in resp['response'].lower():
            print("\n📋 RESULT: NEEDS REVIEW")
    
    # ==================== SUMMARY ==================== 
    print("\n\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print("✅ Scenario 1: Direct answers - COMPLETED")
    print("✅ Scenario 2: With clarifying questions - COMPLETED")
    print("✅ Scenario 3: Out of order info - COMPLETED")
    print("✅ Scenario 4: Borderline case - COMPLETED")
    
finally:
    proc.terminate()
    proc.wait()
