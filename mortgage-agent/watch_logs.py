#!/usr/bin/env python3
"""
Simple, reliable conversation log watcher.
Monitors the conversation_debug.log file for real-time updates.
"""

import subprocess
import sys
import time
import os

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

def format_entity_display(entity_dict):
    """Format entity dictionary for enhanced display."""
    if not entity_dict:
        return "No entities"
    
    # Define entity order and display names
    entity_map = {
        'down_payment': ('💰 Down Payment', lambda x: f"${x:,}" if x else "Not set"),
        'property_price': ('🏠 Property Price', lambda x: f"${x:,}" if x else "Not set"),
        'loan_purpose': ('📋 Purpose', lambda x: x.replace('_', ' ').title() if x else "Not set"),
        'property_city': ('🌆 City', lambda x: x if x else "Not set"),
        'property_state': ('🗺️  State', lambda x: x if x else "Not set"),
        'has_valid_passport': ('🛂 Passport', lambda x: "✅ Yes" if x else ("❌ No" if x is False else "❓ Unknown")),
        'has_valid_visa': ('📄 Visa', lambda x: "✅ Yes" if x else ("❌ No" if x is False else "❓ Unknown")),
        'can_demonstrate_income': ('💼 Income Docs', lambda x: "✅ Yes" if x else ("❌ No" if x is False else "❓ Unknown")),
        'has_reserves': ('💾 Reserves', lambda x: "✅ Yes" if x else ("❌ No" if x is False else "❓ Unknown"))
    }
    
    # Format entities that are present
    formatted_parts = []
    for key, value in entity_dict.items():
        if key in entity_map:
            name, formatter = entity_map[key]
            formatted_value = formatter(value)
            formatted_parts.append(f"{name}: {formatted_value}")
    
    return " | ".join(formatted_parts) if formatted_parts else "No recognized entities"

def detect_question_type(response):
    """Detect what type of question is being asked."""
    response_lower = response.lower()
    
    if "down payment" in response_lower or "put down" in response_lower:
        return "💰 Down Payment Amount"
    elif "property price" in response_lower or "cost" in response_lower:
        return "🏠 Property Price"  
    elif "purpose" in response_lower:
        return "📋 Property Purpose"
    elif "city" in response_lower or "state" in response_lower or "location" in response_lower:
        return "🗺️  Property Location"
    elif "passport" in response_lower:
        return "🛂 Passport Status"
    elif "visa" in response_lower:
        return "📄 Visa Status"
    elif "income" in response_lower or "documentation" in response_lower:
        return "💼 Income Documentation"
    elif "reserves" in response_lower or "months" in response_lower:
        return "💾 Financial Reserves"
    elif "qualify" in response_lower or "qualification" in response_lower:
        return "🎯 Final Qualification"
    else:
        return "❓ Other Question"

def main():
    """Watch the conversation debug log for real-time updates."""
    print(colorize("🎯 Mortgage Agent - Live Conversation Monitor", 'bold'))
    print(colorize("=" * 60, 'white'))
    print(f"{colorize('👤 USER:', 'blue')} User messages")
    print(f"{colorize('🤖 ASSISTANT:', 'green')} Assistant responses") 
    print(f"{colorize('📋 ENTITIES:', 'cyan')} Current entity state with values")
    print(f"{colorize('❓ NEXT Q:', 'blue')} Next question type to be asked")
    print(f"{colorize('🧮 QUALIFICATION:', 'purple')} Qualification calculations")
    print(f"{colorize('💰 CALC:', 'green')} Down payment calculations")
    print(f"{colorize('📊 DOWN PMT %:', 'cyan')} Down payment percentage (pass/fail)")
    print(f"{colorize('🔄 ENTITY UPDATES:', 'yellow')} Entity changes per turn")
    print(f"{colorize('⏱️  TIMING:', 'purple')} Performance metrics")
    print(f"{colorize('❌ ERROR:', 'red')} System errors")
    print(colorize("=" * 60, 'white'))
    print()
    
    # Check if log file exists
    log_file = "conversation_debug.log"
    if not os.path.exists(log_file):
        print(f"{colorize('❌ Log file not found:', 'red')} {log_file}")
        print(f"{colorize('💡 Make sure the server is running and has created the log file', 'yellow')}")
        return
    
    print(f"{colorize('✅ Monitoring:', 'green')} {log_file}")
    print(f"{colorize('💡 Send test messages to http://localhost:8000/chat', 'cyan')}")
    print()
    
    try:
        # Use tail -f to follow the log file
        process = subprocess.Popen(
            ['tail', '-f', log_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1  # Line buffered
        )
        
        while True:
            line = process.stdout.readline()
            if not line:
                break
                
            line = line.strip()
            if not line:
                continue
                
            # Parse and colorize different types of log entries
            timestamp = time.strftime("%H:%M:%S")
            
            # Enhanced log parsing with comprehensive pattern matching
            if "[FLOW_USER]" in line:
                msg = line.split("[FLOW_USER]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('👤 USER:', 'blue')} {msg}")
                
            elif "[FLOW_ASSISTANT]" in line:
                response = line.split("[FLOW_ASSISTANT]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🤖 ASSISTANT:', 'green')} {response}")
                
            elif "[FLOW_CHANGES]" in line:
                changes = line.split("[FLOW_CHANGES]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🔄 CHANGES:', 'yellow')} {changes}")
                
            elif "[FLOW_ANALYSIS]" in line:
                analysis = line.split("[FLOW_ANALYSIS]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🧠 ANALYSIS:', 'cyan')} {analysis}")
                
            elif "[FLOW_REASONING]" in line:
                reasoning = line.split("[FLOW_REASONING]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('💭 REASONING:', 'white')} {reasoning}")
                
            elif "[TIMING]" in line:
                timing_info = line.split("[TIMING]", 1)[1].strip()
                warning = "⚠️" if "⚠️" in timing_info else ""
                print(f"[{timestamp}] {colorize('⏱️  TIMING:', 'purple')} {timing_info} {warning}")
                
            elif "[TIMING_WARNING]" in line:
                warning = line.split("[TIMING_WARNING]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('⚠️  TIMEOUT RISK:', 'red')} {warning}")
                
            elif "[EXTRACTION]" in line:
                extraction = line.split("[EXTRACTION]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('⚡ EXTRACTION:', 'cyan')} {extraction}")
                
            elif "[EXTRACTION_FOUND]" in line:
                found = line.split("[EXTRACTION_FOUND]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('✅ FOUND:', 'green')} {found}")
                
            elif "[EXTRACTION_EMPTY]" in line:
                empty = line.split("[EXTRACTION_EMPTY]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('⚠️  EMPTY:', 'yellow')} {empty}")
                
            elif "[ENTITIES_PRESENT]" in line:
                present = line.split("[ENTITIES_PRESENT]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('📊 PRESENT:', 'cyan')} {present}")
                
            elif "[ENTITIES_CONFIRMED]" in line:
                confirmed = line.split("[ENTITIES_CONFIRMED]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('✅ CONFIRMED:', 'green')} {confirmed}")
                
            elif "[ENTITIES_MISSING]" in line:
                missing = line.split("[ENTITIES_MISSING]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('⚠️  MISSING:', 'yellow')} {missing}")
                
            elif "[ENTITIES_CONFLICT]" in line:
                conflict = line.split("[ENTITIES_CONFLICT]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('❌ CONFLICT:', 'red')} {conflict}")
                
            elif "[VALIDATION_SUMMARY]" in line:
                summary = line.split("[VALIDATION_SUMMARY]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('✅ VALIDATION:', 'green')} {summary}")
                
            elif "[VALIDATION_ISSUE]" in line:
                issue = line.split("[VALIDATION_ISSUE]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('⚠️  ISSUE:', 'yellow')} {issue}")
                
            elif "[VALIDATION_MISSING]" in line:
                missing = line.split("[VALIDATION_MISSING]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('❌ MISSING REQ:', 'red')} {missing}")
                
            elif "[VALIDATION_PROGRESS]" in line:
                progress = line.split("[VALIDATION_PROGRESS]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('📈 PROGRESS:', 'cyan')} {progress}")
                
            # Enhanced entity tracking patterns
            elif "[UNIFIED LLM] Entity updates:" in line:
                entities = line.split("[UNIFIED LLM] Entity updates:", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🔄 ENTITY UPDATES:', 'yellow')} {entities}")
                
            elif "[UNIFIED LLM] Final entities:" in line:
                entities = line.split("[UNIFIED LLM] Final entities:", 1)[1].strip()
                # Parse and format entities for better display
                try:
                    import ast
                    entity_dict = ast.literal_eval(entities)
                    formatted_entities = format_entity_display(entity_dict)
                    print(f"[{timestamp}] {colorize('📋 ENTITIES:', 'cyan')} {formatted_entities}")
                except:
                    print(f"[{timestamp}] {colorize('📋 ENTITIES:', 'cyan')} {entities}")
            
            # Qualification tracking patterns  
            elif "[QUALIFICATION] Calculating" in line:
                calc_info = line.split("[QUALIFICATION]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🧮 QUALIFICATION:', 'purple')} {calc_info}")
                
            elif "[QUALIFICATION] Using down_payment:" in line:
                payment_info = line.split("[QUALIFICATION]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('💰 CALC:', 'green')} {payment_info}")
                
            elif "[QUALIFICATION] Calculated down payment %" in line:
                pct_info = line.split("[QUALIFICATION]", 1)[1].strip()
                # Extract percentage for visual indicator
                if "%" in pct_info:
                    try:
                        pct = float(pct_info.split("%")[0].split(":")[-1].strip())
                        status = "✅ PASS" if pct >= 25 else "❌ FAIL"
                        print(f"[{timestamp}] {colorize('📊 DOWN PMT %:', 'cyan')} {pct_info} {colorize(status, 'green' if pct >= 25 else 'red')}")
                    except:
                        print(f"[{timestamp}] {colorize('📊 DOWN PMT %:', 'cyan')} {pct_info}")
                else:
                    print(f"[{timestamp}] {colorize('📊 DOWN PMT %:', 'cyan')} {pct_info}")
            
            # Next question detection patterns
            elif any(pattern in line for pattern in [
                "What's the property purpose",
                "What city and state", 
                "Do you have a valid passport",
                "Do you have a valid U.S. visa",
                "Can you demonstrate income",
                "Do you have 6-12 months"
            ]):
                if "ASSISTANT:" in line:
                    response = line.split("ASSISTANT:", 1)[1].strip()
                    # Detect if this is a new question
                    if "?" in response:
                        question_type = detect_question_type(response)
                        print(f"[{timestamp}] {colorize('❓ NEXT Q:', 'blue')} {question_type}")
                        print(f"[{timestamp}] {colorize('🤖 ASSISTANT:', 'green')} {response}")
                        continue  # Skip normal assistant processing
                        
            elif "[FAILURE]" in line:
                failure = line.split("[FAILURE]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('❌ FAILURE:', 'red')} {failure}")
                
            elif "[FAILURE_CONTEXT]" in line:
                context = line.split("[FAILURE_CONTEXT]", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🔍 CONTEXT:', 'red')} {context}")
                
            elif "GUARDRAIL VIOLATIONS:" in line:
                violations = line.split("GUARDRAIL VIOLATIONS:", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🚨 VIOLATION:', 'red')} {violations}")
                
            elif "GUARDRAIL CORRECTION:" in line:
                correction = line.split("GUARDRAIL CORRECTION:", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🔧 CORRECTION:', 'purple')} {correction}")
                
            elif "User Message:" in line:
                msg = line.split("User Message:", 1)[1].strip()
                print(f"[{timestamp}] {colorize('👤 USER:', 'blue')} {msg}")
                
            elif "Assistant Response:" in line:
                response = line.split("Assistant Response:", 1)[1].strip()
                print(f"[{timestamp}] {colorize('🤖 ASSISTANT:', 'green')} {response}")
                
            elif "API Call #" in line:
                api_info = line.split("API_CALL] ", 1)[1] if "API_CALL] " in line else line
                print(f"[{timestamp}] {colorize('🌐 API:', 'blue')} {api_info}")
                
            elif "ERROR" in line and any(word in line for word in ["Exception", "Error", "failed"]):
                print(f"[{timestamp}] {colorize('❌ ERROR:', 'red')} {line}")
                
            elif "Starting conversation processing" in line:
                msg_count = line.split("messages")[0].split("-")[-1].strip() if "messages" in line else "?"
                print(f"[{timestamp}] {colorize('⚙️  PROCESSING:', 'yellow')} New conversation turn")
                
            elif "completed in" in line and "s" in line:
                timing_info = line.split("] ", 1)[1] if "] " in line else line
                print(f"[{timestamp}] {colorize('⏱️  TIMING:', 'purple')} {timing_info}")
                
    except KeyboardInterrupt:
        print(f"\n{colorize('👋 Monitoring stopped by user', 'yellow')}")
    except Exception as e:
        print(f"{colorize('❌ Error:', 'red')} {e}")
    finally:
        if 'process' in locals():
            process.terminate()

if __name__ == "__main__":
    main()