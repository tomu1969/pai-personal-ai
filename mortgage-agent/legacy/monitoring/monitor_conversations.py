#!/usr/bin/env python3
"""
Real-time conversation monitor for mortgage agent debugging.
Shows user messages, assistant responses, and any errors in real-time.
"""

import subprocess
import sys
import time
import re
from datetime import datetime

def colorize(text, color):
    """Add color to text for terminal output."""
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'purple': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'bold': '\033[1m',
        'reset': '\033[0m'
    }
    return f"{colors.get(color, '')}{text}{colors['reset']}"

def parse_log_line(line):
    """Parse and format log lines for better readability."""
    line = line.strip()
    
    # Skip empty lines
    if not line:
        return None
    
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    # User messages
    if "User Message:" in line:
        user_msg = line.split("User Message:", 1)[1].strip()
        return f"[{timestamp}] {colorize('👤 USER:', 'blue')} {colorize(user_msg, 'white')}"
    
    # Assistant responses
    elif "Assistant Response:" in line:
        response = line.split("Assistant Response:", 1)[1].strip()
        return f"[{timestamp}] {colorize('🤖 ASSISTANT:', 'green')} {colorize(response, 'white')}"
    
    # Guardrail violations
    elif "GUARDRAIL VIOLATIONS:" in line:
        violations = line.split("GUARDRAIL VIOLATIONS:", 1)[1].strip()
        return f"[{timestamp}] {colorize('🚨 GUARDRAIL VIOLATION:', 'red')} {colorize(violations, 'yellow')}"
    
    # Guardrail corrections
    elif "GUARDRAIL CORRECTION:" in line:
        correction = line.split("GUARDRAIL CORRECTION:", 1)[1].strip()
        return f"[{timestamp}] {colorize('🔧 GUARDRAIL FIX:', 'purple')} {colorize(correction, 'cyan')}"
    
    # API errors
    elif "ERROR" in line and "API_ERROR" in line:
        return f"[{timestamp}] {colorize('❌ API ERROR:', 'red')} {colorize(line, 'red')}"
    
    # State information
    elif "Final entities:" in line:
        entities = line.split("Final entities:", 1)[1].strip()
        return f"[{timestamp}] {colorize('📊 STATE:', 'cyan')} {colorize(entities, 'white')}"
    
    # Processing steps
    elif "Starting conversation processing" in line:
        return f"[{timestamp}] {colorize('⚙️  PROCESSING:', 'yellow')} New conversation turn started"
    
    # Response time metrics
    elif "completed in" in line and "s" in line:
        return f"[{timestamp}] {colorize('⏱️  TIMING:', 'purple')} {colorize(line, 'white')}"
    
    # Return None for lines we don't want to display
    return None

def monitor_logs():
    """Monitor live conversation logs."""
    print(colorize("🎯 Mortgage Agent - Live Conversation Monitor", 'bold'))
    print(colorize("=" * 60, 'white'))
    print(f"{colorize('👤 USER:', 'blue')} User messages")
    print(f"{colorize('🤖 ASSISTANT:', 'green')} Assistant responses") 
    print(f"{colorize('🚨 GUARDRAIL VIOLATION:', 'red')} When guardrails detect issues")
    print(f"{colorize('🔧 GUARDRAIL FIX:', 'purple')} When guardrails correct responses")
    print(f"{colorize('❌ API ERROR:', 'red')} API or system errors")
    print(f"{colorize('📊 STATE:', 'cyan')} Current conversation state")
    print(colorize("=" * 60, 'white'))
    print()
    
    try:
        print(f"{colorize('🔄 Reading from stdin...', 'yellow')}")
        print(f"{colorize('💡 Send test messages to http://localhost:8000/chat to see live output', 'cyan')}")
        print()
        
        # Read from stdin (pipe input) with immediate flushing
        import sys
        while True:
            try:
                line = sys.stdin.readline()
                if not line:  # EOF
                    print(f"{colorize('📝 No more input - stream ended', 'yellow')}")
                    break
                
                formatted_line = parse_log_line(line)
                if formatted_line:
                    print(formatted_line)
                    sys.stdout.flush()  # Force immediate output
                    
            except EOFError:
                print(f"{colorize('📝 Input stream ended', 'yellow')}")
                break
                
    except KeyboardInterrupt:
        print(f"\n{colorize('👋 Monitoring stopped.', 'yellow')}")
    except Exception as e:
        print(f"{colorize('❌ Error:', 'red')} {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Test mode - show sample output
        print(colorize("🧪 TEST MODE - Sample Output:", 'bold'))
        print()
        sample_lines = [
            "User Message: Hello",
            "Assistant Response: I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?",
            "User Message: 120k", 
            "Assistant Response: What's the property price you're considering?",
            ">>> GUARDRAIL VIOLATIONS: ['Re-asking down payment (already: $120,000)']",
            ">>> GUARDRAIL CORRECTION: 'How much down payment?' -> 'What's the property purpose?'",
            "Final entities: {'down_payment': 120000, 'property_price': 500000}",
            "process_conversation_turn completed in 3.45s"
        ]
        
        for line in sample_lines:
            formatted = parse_log_line(line)
            if formatted:
                print(formatted)
            time.sleep(0.5)
    else:
        monitor_logs()