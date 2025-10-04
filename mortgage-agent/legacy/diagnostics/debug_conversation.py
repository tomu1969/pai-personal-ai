#!/usr/bin/env python3
"""
Debug wrapper for conversation processing with detailed logging.
This will help identify exactly where the error occurs.
"""

import sys
import os
import time
import traceback
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def log(message, level="INFO"):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    color = {
        "INFO": "\033[0m",      # Default
        "DEBUG": "\033[36m",    # Cyan
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "SUCCESS": "\033[32m",  # Green
        "TRACE": "\033[35m"     # Magenta
    }
    print(f"[{timestamp}] {color.get(level, '')}[{level}] {message}\033[0m", flush=True)

def test_conversation():
    """Test the exact failing conversation with detailed logging"""
    
    log("="*60)
    log("STARTING DEBUG CONVERSATION TEST")
    log("="*60)
    
    # The exact conversation that fails
    messages = [
        {'role': 'assistant', 'content': 'I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?'},
        {'role': 'user', 'content': 'i can do 120k'},
        {'role': 'assistant', 'content': 'Great! Now, what is the property price you are considering?'},
        {'role': 'user', 'content': 'about 500k'},
        {'role': 'assistant', 'content': 'Your down payment of $120,000 is 24% of the $500,000 property price, but you need at least 25%. Would you like to adjust your down payment or property price?'},
        {'role': 'user', 'content': 'whtas the minimun down payment i need?'},
        {'role': 'assistant', 'content': 'The minimum down payment you need for a $500,000 property is $125,000 (25%). Would you like to adjust your down payment or property price?'},
        {'role': 'user', 'content': 'ok yes'},
        {'role': 'assistant', 'content': 'Great! What\'s the property purpose: primary residence, second home, or investment?'},
        {'role': 'user', 'content': 'investment'},
        {'role': 'assistant', 'content': 'Thank you! Now, could you please provide the property location, including the city and state?'},
        {'role': 'user', 'content': 'Miami fl'},
        {'role': 'assistant', 'content': 'Thank you for the information! Do you have a valid passport?'},
        {'role': 'user', 'content': 'i do'}
    ]
    
    log(f"Processing conversation with {len(messages)} messages", "INFO")
    log(f"Last message: '{messages[-1]['content']}'", "DEBUG")
    
    try:
        # Import with error handling
        log("Importing conversation_simple module...", "TRACE")
        try:
            from src.conversation_simple import process_conversation_turn
            log("Module imported successfully", "SUCCESS")
        except ImportError as e:
            log(f"Import error: {e}", "ERROR")
            return
        except SyntaxError as e:
            log(f"Syntax error in module: {e}", "ERROR")
            return
        
        # Patch the functions for debugging
        log("Patching functions for debugging...", "TRACE")
        import src.conversation_simple as cs
        
        # Wrap the main function
        original_process = cs.process_conversation_turn
        def wrapped_process(*args, **kwargs):
            log("Starting process_conversation_turn", "TRACE")
            try:
                result = original_process(*args, **kwargs)
                log(f"process_conversation_turn completed", "SUCCESS")
                return result
            except Exception as e:
                log(f"ERROR in process_conversation_turn: {type(e).__name__}: {e}", "ERROR")
                raise
        cs.process_conversation_turn = wrapped_process
        
        # Wrap analyze_user_response_with_llm
        if hasattr(cs, 'analyze_user_response_with_llm'):
            original_analyze = cs.analyze_user_response_with_llm
            call_count = [0]
            def wrapped_analyze(*args, **kwargs):
                call_count[0] += 1
                log(f"API Call #{call_count[0]}: analyze_user_response_with_llm", "DEBUG")
                log(f"  User msg: '{args[0][:30]}...'", "TRACE")
                start = time.time()
                try:
                    result = original_analyze(*args, **kwargs)
                    elapsed = time.time() - start
                    log(f"  API Call #{call_count[0]} completed in {elapsed:.2f}s", "SUCCESS")
                    return result
                except Exception as e:
                    log(f"  API Call #{call_count[0]} FAILED: {type(e).__name__}: {e}", "ERROR")
                    raise
            cs.analyze_user_response_with_llm = wrapped_analyze
        
        # Wrap extract_entities
        if hasattr(cs, 'extract_entities'):
            original_extract = cs.extract_entities
            def wrapped_extract(*args, **kwargs):
                log("Extracting entities...", "TRACE")
                try:
                    result = original_extract(*args, **kwargs)
                    log(f"Entity extraction completed", "DEBUG")
                    return result
                except Exception as e:
                    log(f"ERROR in extract_entities: {type(e).__name__}: {e}", "ERROR")
                    raise
            cs.extract_entities = wrapped_extract
        
        # Wrap smart_merge_entities
        if hasattr(cs, 'smart_merge_entities'):
            original_merge = cs.smart_merge_entities
            def wrapped_merge(*args, **kwargs):
                log("Merging entities...", "TRACE")
                try:
                    result = original_merge(*args, **kwargs)
                    log(f"Entity merge completed", "DEBUG")
                    return result
                except Exception as e:
                    log(f"ERROR in smart_merge_entities: {type(e).__name__}: {e}", "ERROR")
                    log(f"  Args: current={args[0] if args else 'N/A'}", "DEBUG")
                    log(f"  Args: new={args[1] if len(args) > 1 else 'N/A'}", "DEBUG")
                    raise
            cs.smart_merge_entities = wrapped_merge
        
        # Start processing
        log("="*60)
        log("STARTING PROCESSING", "WARNING")
        log("="*60)
        
        start_time = time.time()
        result = process_conversation_turn(messages)
        elapsed = time.time() - start_time
        
        log("="*60)
        log(f"PROCESSING COMPLETED IN {elapsed:.2f} SECONDS", "SUCCESS")
        log("="*60)
        log(f"Response: {result[:100]}..." if len(result) > 100 else f"Response: {result}", "INFO")
        
    except Exception as e:
        elapsed = time.time() - start_time if 'start_time' in locals() else 0
        log("="*60)
        log(f"PROCESSING FAILED AFTER {elapsed:.2f} SECONDS", "ERROR")
        log("="*60)
        log(f"Exception Type: {type(e).__name__}", "ERROR")
        log(f"Exception Message: {e}", "ERROR")
        log("", "ERROR")
        log("FULL TRACEBACK:", "ERROR")
        for line in traceback.format_exc().split('\n'):
            if line:
                log(line, "ERROR")
        
        # Check for specific error types
        if "openai" in str(e).lower() or "api" in str(e).lower():
            log("→ This looks like an OpenAI API error", "WARNING")
        elif "timeout" in str(e).lower():
            log("→ This looks like a timeout error", "WARNING")
        elif "key" in str(type(e)).lower() or "index" in str(e).lower():
            log("→ This looks like a data structure access error", "WARNING")

if __name__ == "__main__":
    test_conversation()