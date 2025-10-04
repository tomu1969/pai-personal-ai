import requests
import json
import time

base_url = "https://mortgage-agent.onrender.com"
conversation_id = f"test-diag-{int(time.time())}"

# Conversation flow matching the exact user scenario
messages = [
    "Hello",
    "120k",
    "about 500k",
    "whtas the minimun down payment i need?",
    "ok yes",
    "investment"
]

print(f"Testing conversation: {conversation_id}")
print("=" * 60)

for i, msg in enumerate(messages, 1):
    print(f"\n{i}. USER: {msg}")
    
    response = requests.post(
        f"{base_url}/chat",
        json={"message": msg, "conversation_id": conversation_id},
        timeout=30
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ASSISTANT: {data['response'][:100]}...")
    else:
        print(f"   ERROR: {response.text[:200]}")
        break
    
    time.sleep(0.5)  # Small delay between messages

print("\n" + "=" * 60)
print("Test complete")
