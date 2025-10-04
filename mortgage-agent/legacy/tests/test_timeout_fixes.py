import requests
import json
import time

base_url = "http://localhost:8000"
conversation_id = f"test-timeout-fix-{int(time.time())}"

# The exact failing conversation from the user
messages = [
    "Hello",
    "120k", 
    "about 500k",
    "whtas the minimun down payment i need?",
    "ok yes",  # This should now use fast-path
    "investment"  # This should work now
]

print(f"Testing timeout fixes with conversation: {conversation_id}")
print("=" * 70)

total_time = 0
for i, msg in enumerate(messages, 1):
    print(f"\n{i}. USER: {msg}")
    
    start = time.time()
    try:
        response = requests.post(
            f"{base_url}/chat",
            json={"message": msg, "conversation_id": conversation_id},
            timeout=15
        )
        elapsed = time.time() - start
        total_time += elapsed
        
        print(f"   Status: {response.status_code} ({elapsed:.2f}s)")
        
        if response.status_code == 200:
            data = response.json()
            assistant_msg = data['response']
            print(f"   ASSISTANT: {assistant_msg[:80]}...")
            
            # Check for fast-path indicators
            if "Fast-path:" in assistant_msg:
                print("   🚀 FAST-PATH USED!")
                
        else:
            print(f"   ERROR: {response.text[:100]}")
            break
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start
        print(f"   TIMEOUT after {elapsed:.2f}s")
        break
    except Exception as e:
        elapsed = time.time() - start
        print(f"   ERROR: {e} (after {elapsed:.2f}s)")
        break
    
    time.sleep(0.2)

print(f"\n{'='*70}")
print(f"Total conversation time: {total_time:.2f}s")
print("Test complete")
