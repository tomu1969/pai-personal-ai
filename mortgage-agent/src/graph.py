"""
================================================================================
GRAPH.PY - THE TRAFFIC CONTROLLER / WORKFLOW ORCHESTRATOR
================================================================================

This file is the brain that manages the conversation flow and decision-making.

MAIN RESPONSIBILITIES:
1. Control which question (Q1-Q8) we're currently asking
2. Extract information from user responses
3. Decide when to advance to the next question
4. Handle verification and final approval decision
5. Manage conversation state throughout the entire process

THINK OF IT LIKE: A GPS navigation system for conversations
- Knows where you are (current_question)
- Knows where you need to go (Q1 → Q8 → Verification → Decision)
- Adjusts route if you get off track (fallback extraction, force progression)
- Has safety checks to prevent getting lost (validation, stuck detection)

KEY CONCEPTS:
- LangGraph = The framework that manages state and node connections
- process_conversation_step() = Main function called for each user message
- Fallback extraction = Backup regex patterns when AI extraction fails
- Force progression = Safety net to prevent infinite loops on one question
- Verification phase = Final confirmation before approval/rejection

CONVERSATION FLOW:
User Message → API (api.py) → Graph (this file) → LLM (nodes.py) → Response → API → User
                                  ↓
                            Database models check (rules_engine.py)
                                  ↓
                          Final decision (approve/reject)
"""
from langgraph.graph import StateGraph, END
from hashlib import sha256
from .state import GraphState
from .nodes import extract_info_node, final_decision_node, handle_letter_request, verification_node
from .router import route_input, clarification_node
from .extraction_helpers import (
    extract_from_message,
    is_correction_intent,
    contains_data
)


# ============================================================================
# IDEMPOTENCY AND ATTEMPT TRACKING HELPERS
# ============================================================================

def _already_have_data(q: int, state: GraphState) -> bool:
    """Check if we already have valid data for this question."""
    required_by_q = {
        1: ["down_payment"],
        2: ["property_city", "property_state"],  # Either is fine
        3: ["loan_purpose"],
        4: ["property_price"],
        5: ["has_valid_passport", "has_valid_visa"],  # Either is fine
        6: ["current_location"],
        7: ["can_demonstrate_income"],
        8: ["has_reserves"],
    }
    
    req = required_by_q.get(q, [])
    
    # Special case: Q2 and Q5 accept either field
    if q == 2:
        return bool(state.get("property_city") or state.get("property_state"))
    elif q == 5:
        return (state.get("has_valid_passport") is not None or 
                state.get("has_valid_visa") is not None)
    
    # For others, check all required fields
    return all(state.get(k) not in (None, "", []) for k in req)


def _force_progression_allowed(state: GraphState, q: int) -> bool:
    """
    Allow force progression if:
    - Asked 2+ times
    - AND we have at least some valid data for this question
    """
    attempts = state.get("asked_counts", {}).get(q, 0)
    return attempts >= 2 and _already_have_data(q, state)


def _should_emit_prompt(state: GraphState, q: int, prompt_text: str) -> bool:
    """
    Check if we should emit this prompt or if it's a duplicate.
    
    Returns True if we should emit, False if it's a duplicate.
    """
    prompt_hash = sha256(prompt_text.encode()).hexdigest()[:16]
    
    # Check if same question and same hash as last time
    if (state.get("last_asked_q") == q and 
        state.get("last_prompt_hash") == prompt_hash):
        return False
    
    # Update tracking
    state["last_asked_q"] = q
    state["last_prompt_hash"] = prompt_hash
    
    return True


def _increment_attempt(state: GraphState, q: int):
    """Increment the ask counter for a question."""
    if "asked_counts" not in state:
        state["asked_counts"] = {}
    state["asked_counts"][q] = state["asked_counts"].get(q, 0) + 1


def _reset_attempt(state: GraphState, q: int):
    """Reset the ask counter when successfully advancing."""
    if "asked_counts" in state:
        state["asked_counts"][q] = 0


# ============================================================================
# INITIALIZATION NODE
# ============================================================================

def start_node(state: GraphState) -> GraphState:
    """
    INITIAL GREETING NODE (Deprecated - now handled in process_conversation_step)
    
    This function sends the very first greeting when a conversation begins.
    However, we now prefer to start directly with Q1 in process_conversation_step()
    to avoid confusion with a Q0 confirmation step.
    
    LEGACY: This node is kept for backwards compatibility but rarely used.
    """
    if not state["messages"]:
        state["messages"].append({
            "role": "assistant",
            "content": "Hello! I'm here to help you with your mortgage pre-approval. I'll need to ask you 8 questions to determine if you qualify for our Foreign Nationals loan program. Let's begin!"
        })
    return state


# ============================================================================
# MAIN CONVERSATION PROCESSOR
# ============================================================================

def process_conversation_step(state: GraphState) -> GraphState:
    """
    ============================================================================
    THE HEART OF THE SYSTEM - MAIN CONVERSATION ORCHESTRATOR
    ============================================================================
    
    This function is called for EVERY user message. It:
    1. Determines what question we're on (Q1-Q8)
    2. Gets the AI's response using generate_conversational_response()
    3. Extracts data from the user's answer
    4. Decides whether to advance to the next question
    5. Handles special cases (verification, corrections, stuck loops)
    
    PROCESSING PIPELINE FOR EACH MESSAGE:
    
    Step 1: GREETING (first message only)
       - If this is the very first interaction, send greeting
       - Start at Q1 (down payment question)
    
    Step 2: SPECIAL MODE HANDLING
       - Verification mode: User confirming collected data
       - Correction mode: User fixing incorrect information
    
    Step 3: AI RESPONSE GENERATION
       - Call generate_conversational_response() in nodes.py
       - LLM analyzes user message and generates appropriate response
       - Returns: {response: str, extract: str, advance: bool}
    
    Step 4: FALLBACK EXTRACTION (Safety Net)
       - If AI didn't extract data, try regex patterns
       - Question-specific extraction logic (Q1-Q8)
       - Example Q1: Look for dollar amounts like "$50k" or "50000"
       - Example Q3: Look for keywords like "investment", "personal", "second"
    
    Step 5: VALIDATION
       - Check if extracted data meets requirements
       - Example Q1: down_payment must be >= $1,000
       - Example Q3: loan_purpose must be "personal", "second", or "investment"
       - If invalid, stay on same question
    
    Step 6: STUCK DETECTION (Anti-Loop Protection)
       - Count how many times we've asked the same question
       - After 2 attempts with ANY data present, force advance
       - Prevents infinite loops where user is confused or AI isn't extracting
    
    Step 7: ADVANCEMENT DECISION
       - If validation passed and data extracted: current_question += 1
       - If reached Q8 and completed: current_question = 9 (triggers verification)
       - Otherwise: stay on current question
    
    Step 8: COMPLETION CHECK
       - If all 8 questions answered (Q1-Q8), jump to verification
       - After verification confirmed, jump to final decision
       - Final decision determines: Pre-Approved / Rejected / Needs Review
    
    Args:
        state: GraphState dictionary containing all conversation data
            - messages: List of chat messages
            - current_question: Which question (1-8) we're on
            - down_payment, property_city, loan_purpose, etc: Collected data
            - awaiting_verification: True if waiting for user to confirm data
            - verification_complete: True after user confirmed
            - correction_mode: True if user is fixing information
    
    Returns:
        Updated GraphState with new message, possibly updated current_question,
        and potentially updated collected data fields
    
    CRITICAL FIELDS MODIFIED:
        - messages: Appends assistant's response
        - current_question: Advances when answer is validated
        - [data fields]: down_payment, loan_purpose, etc. filled in when extracted
        - awaiting_verification: Set when ready for confirmation
        - verification_complete: Set when user confirms
    """
    
    # -------------------------------------------------------------------------
    # STEP 1: FIRST-TIME GREETING
    # -------------------------------------------------------------------------
    # Show greeting only on very first interaction (empty message history)
    if len(state["messages"]) == 0:
        state["messages"].append({
            "role": "assistant",
            "content": "Hello! Let's start your mortgage pre-approval. I have 8 quick questions. First, how much do you have saved for a down payment?"
        })
        return state
    
    # -------------------------------------------------------------------------
    # TRACKING: Log current state for debugging
    # -------------------------------------------------------------------------
    current_q = state.get("current_question", 1)
    print(f"\n>>> Graph Processing Step - Current Question: {current_q}")
    
    # -------------------------------------------------------------------------
    # STEP 2: IDENTIFY USER'S LATEST MESSAGE
    # -------------------------------------------------------------------------
    user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
    if user_messages:
        last_user_message = user_messages[-1]["content"]
        print(f">>> Processing user message: {last_user_message[:50]}...")
        
        # ---------------------------------------------------------------------
        # SPECIAL MODE: VERIFICATION RESPONSE HANDLING
        # ---------------------------------------------------------------------
        # When awaiting_verification=True, user is confirming collected data
        # We expect: "yes"/"correct" (proceed) or "no"/"wrong" (make corrections)
        if state.get("awaiting_verification"):
            user_lower = last_user_message.lower().strip()
            yes_words = ['yes', 'correct', 'right', 'good', 'ok', 'okay', 'yep', 'yeah', 'si', 'sí']
            no_words = ['no', 'wrong', 'incorrect', 'change', 'fix', 'correction', 'mistake']
            
            if any(word in user_lower for word in yes_words):
                # USER CONFIRMED - Move to final decision
                print(">>> User confirmed verification - proceeding to final decision")
                state["verification_complete"] = True
                state["awaiting_verification"] = False
                return final_decision_node(state)
            
            elif any(word in user_lower for word in no_words):
                # USER WANTS CORRECTIONS - Enter correction mode
                print(">>> User requested corrections")
                state["awaiting_verification"] = False
                state["correction_mode"] = True
                state["messages"].append({
                    "role": "assistant",
                    "content": "No problem! What information would you like to correct? Please tell me specifically what needs to be changed (e.g., 'the property price should be $900k' or 'I'm actually in the USA')."
                })
                return state
            else:
                # UNCLEAR RESPONSE - Ask for clarification
                state["messages"].append({
                    "role": "assistant",
                    "content": "I need to confirm: is all the information I listed correct? Please reply 'yes' to proceed or 'no' if you need to make corrections."
                })
                return state
        
        # ---------------------------------------------------------------------
        # SPECIAL MODE: CORRECTION HANDLING
        # ---------------------------------------------------------------------
        # When correction_mode=True, user is fixing previously extracted data
        # Extract the corrected information and return to verification
        if state.get("correction_mode"):
            print(">>> Processing correction from user")
            # Extract the correction using the normal extraction logic
            extract_info_node(state)
            
            # Reset correction mode and return to verification
            state["correction_mode"] = False
            return verification_node(state)
        
        # =====================================================================
        # DETERMINISTIC EXTRACTION (runs FIRST, before LLM)
        # =====================================================================
        print(f">>> Running deterministic extraction on: '{last_user_message[:100]}'")
        deterministic_extracted = extract_from_message(last_user_message, current_q, state)
        
        print(f">>> DETERMINISTIC EXTRACTION: {deterministic_extracted}")
        
        # Apply extracted fields to state
        for key, value in deterministic_extracted.items():
            if value is not None:
                state[key] = value
                print(f">>> ✅ DETERMINISTIC extracted {key}: {value}")
        
        # Check if deterministic extraction satisfied the requirement
        if deterministic_extracted and _already_have_data(current_q, state):
            print(f">>> ✅ DETERMINISTIC extraction satisfied Q{current_q}")
        
        # =====================================================================
        # IDEMPOTENCY CHECK: Skip if we already have data
        # =====================================================================
        if _already_have_data(current_q, state):
            print(f">>> ⏭️  Q{current_q} already satisfied, advancing")
            # Mark for advancement (will be processed later)
            # Don't generate a new response, just advance
            state["messages"].append({
                "role": "assistant",
                "content": ""  # Will be filled by LLM if needed
            })
            # Set flag to advance
            should_advance_early = True
        else:
            should_advance_early = False
        
        # =====================================================================
        # CORRECTION DETECTION
        # =====================================================================
        if is_correction_intent(last_user_message):
            print(f">>> 🔧 CORRECTION detected")
            # Don't increment asked_counts for corrections
        
        # ---------------------------------------------------------------------
        # STEP 3: GENERATE AI RESPONSE
        # ---------------------------------------------------------------------
        # Use the unified conversational response system (LLM-based)
        # This calls OpenAI to analyze user message and generate response
        # Returns: {response: str, extract: str, advance: bool}
        from .nodes import generate_conversational_response
        conversation_result = generate_conversational_response(state)
        
        # ---------------------------------------------------------------------
        # STEP 4: FALLBACK EXTRACTION (Safety Net)
        # ---------------------------------------------------------------------
        # If the LLM didn't extract data, try regex patterns as backup
        # This is critical because LLM extraction can fail on simple answers
        # Example: User says "$50k" - LLM might not extract it properly
        print(f">>> FALLBACK CHECK: extract={conversation_result.get('extract')}, has_user_msg={bool(user_messages)}")
        if (not conversation_result.get("extract") or conversation_result["extract"] == "none") and user_messages:
            import re
            user_text = last_user_message.lower()
            print(f">>> Running fallback extraction on: '{user_text[:100]}'")
            
            # =================================================================
            # Q1 FALLBACK: DOWN PAYMENT EXTRACTION
            # =================================================================
            # Try to find dollar amounts: "$50k", "$50,000", "50000"
            if current_q == 1 and not state.get("down_payment"):
                print(f">>> Trying Q1 fallback extraction...")
                money_patterns = [r'\$?([\d,]+)k', r'\$?([\d,]+),?(\d{3})', r'\$?([\d]+)']
                for pattern in money_patterns:
                    match = re.search(pattern, user_text)
                    if match:
                        try:
                            # Handle different formats:
                            # "$50k" → 50000
                            # "$50,000" → 50000
                            # "50000" → 50000
                            if 'k' in user_text:
                                amount = float(match.group(1).replace(',', '')) * 1000
                            else:
                                amount = float(match.group(1).replace(',', ''))
                            if amount >= 1000:  # Reasonable down payment (at least $1k)
                                state["down_payment"] = amount
                                print(f">>> ✅ FALLBACK extracted down_payment: {amount}")
                                conversation_result["advance"] = True
                                print(f">>> ✅ FALLBACK set advance=True")
                                break
                        except Exception as e:
                            print(f">>> FALLBACK extraction error: {e}")
                            pass
            
            # =================================================================
            # Q2 FALLBACK: LOCATION EXTRACTION
            # =================================================================
            # Try to find city/state: "Miami, FL", "Dallas, Texas", "Seattle"
            if current_q == 2:
                # Pattern 1: "City, State" or "City, ST"
                location_match = re.search(r'([A-Z][a-z\s]+),\s*([A-Z][a-z\s]+|[A-Z]{2})', last_user_message)
                if location_match:
                    state["property_city"] = location_match.group(1).strip()
                    state["property_state"] = location_match.group(2).strip()
                    print(f">>> FALLBACK extracted location: {state['property_city']}, {state['property_state']}")
                    conversation_result["advance"] = True
                # Pattern 2: Known city names
                elif any(city in user_text for city in ['miami', 'dallas', 'austin', 'houston', 'phoenix', 'seattle', 'atlanta']):
                    for city in ['Miami', 'Dallas', 'Austin', 'Houston', 'Phoenix', 'Seattle', 'Atlanta']:
                        if city.lower() in user_text:
                            state["property_city"] = city
                            print(f">>> FALLBACK extracted city: {city}")
                            conversation_result["advance"] = True
                            break
            
            # =================================================================
            # Q3 FALLBACK: LOAN PURPOSE EXTRACTION
            # =================================================================
            # CRITICAL: Must use standard values: "personal", "second", "investment"
            # These exact values are required by rules_engine.py
            if current_q == 3 and not state.get("loan_purpose"):
                # Investment property keywords
                if 'investment' in user_text or 'rental' in user_text or 'rent' in user_text:
                    state["loan_purpose"] = "investment"
                    print(f">>> FALLBACK extracted loan_purpose: investment")
                    conversation_result["advance"] = True
                # Primary residence keywords
                elif 'primary' in user_text or 'residence' in user_text or 'live' in user_text or 'personal' in user_text:
                    state["loan_purpose"] = "personal"  # Standard value (NOT "primary residence")
                    print(f">>> FALLBACK extracted loan_purpose: personal")
                    conversation_result["advance"] = True
                # Second home keywords
                elif 'second' in user_text or 'vacation' in user_text:
                    state["loan_purpose"] = "second"
                    print(f">>> FALLBACK extracted loan_purpose: second")
                    conversation_result["advance"] = True
            
            # =================================================================
            # Q4 FALLBACK: PROPERTY PRICE EXTRACTION
            # =================================================================
            # Try to find prices: "$500k", "$1.5 million", "500000"
            if current_q == 4 and not state.get("property_price"):
                price_patterns = [r'\$?([\d,]+)k', r'\$?([\d,]+)\s*(?:million|mill|m)', r'\$?([\d,]+)']
                for pattern in price_patterns:
                    match = re.search(pattern, user_text)
                    if match:
                        try:
                            num = float(match.group(1).replace(',', ''))
                            # Handle different formats:
                            # "$500k" → 500000
                            # "$1.5 million" → 1500000
                            # "500000" → 500000
                            if 'k' in user_text and num >= 100:
                                price = num * 1000
                            elif 'million' in user_text or 'mill' in user_text or 'm' in user_text.split():
                                price = num * 1000000
                            else:
                                price = num
                            
                            if price >= 100000:  # Reasonable property price (at least $100k)
                                state["property_price"] = price
                                print(f">>> FALLBACK extracted property_price: {price}")
                                conversation_result["advance"] = True
                                break
                        except:
                            pass
            
            # =================================================================
            # Q5 FALLBACK: PASSPORT/VISA EXTRACTION
            # =================================================================
            # Handle: "yes both", "have passport", "no visa", etc.
            if current_q == 5:
                has_passport = state.get("has_valid_passport")
                has_visa = state.get("has_valid_visa")
                
                # Positive responses
                if 'yes' in user_text or 'have' in user_text:
                    if 'passport' in user_text and has_passport is None:
                        state["has_valid_passport"] = True
                        print(f">>> FALLBACK extracted has_valid_passport: True")
                    if 'visa' in user_text and has_visa is None:
                        state["has_valid_visa"] = True
                        print(f">>> FALLBACK extracted has_valid_visa: True")
                    if 'both' in user_text:
                        state["has_valid_passport"] = True
                        state["has_valid_visa"] = True
                        print(f">>> FALLBACK extracted both passport and visa: True")
                    
                    # If we got at least one, advance
                    if state.get("has_valid_passport") or state.get("has_valid_visa"):
                        conversation_result["advance"] = True
                # Negative responses
                elif 'no' in user_text or 'don\'t' in user_text or 'not' in user_text:
                    if 'passport' in user_text and has_passport is None:
                        state["has_valid_passport"] = False
                        print(f">>> FALLBACK extracted has_valid_passport: False")
                        conversation_result["advance"] = True
                    if 'visa' in user_text and has_visa is None:
                        state["has_valid_visa"] = False
                        print(f">>> FALLBACK extracted has_valid_visa: False")
                        conversation_result["advance"] = True
            
            # =================================================================
            # Q6 FALLBACK: CURRENT LOCATION EXTRACTION
            # =================================================================
            # Determine if user is in USA or their origin country
            if current_q == 6 and not state.get("current_location"):
                if any(word in user_text for word in ['usa', 'united states', 'america', 'us', 'u.s.']):
                    state["current_location"] = "USA"
                    print(f">>> FALLBACK extracted current_location: USA")
                    conversation_result["advance"] = True
                elif any(word in user_text for word in ['mexico', 'colombia', 'brazil', 'canada', 'country', 'home']):
                    state["current_location"] = "Origin Country"
                    print(f">>> FALLBACK extracted current_location: Origin Country")
                    conversation_result["advance"] = True
            
            # =================================================================
            # Q7 FALLBACK: INCOME DEMONSTRATION EXTRACTION
            # =================================================================
            # Can they provide bank statements, tax returns, etc.?
            if current_q == 7 and state.get("can_demonstrate_income") is None:
                if 'yes' in user_text or 'can' in user_text or 'bank' in user_text or 'statement' in user_text or 'tax' in user_text or 'return' in user_text:
                    state["can_demonstrate_income"] = True
                    print(f">>> FALLBACK extracted can_demonstrate_income: True")
                    conversation_result["advance"] = True
                elif 'no' in user_text or 'cannot' in user_text or 'can\'t' in user_text:
                    state["can_demonstrate_income"] = False
                    print(f">>> FALLBACK extracted can_demonstrate_income: False")
                    conversation_result["advance"] = True
            
            # =================================================================
            # Q8 FALLBACK: RESERVES EXTRACTION
            # =================================================================
            # Do they have 6-12 months of savings?
            if current_q == 8 and state.get("has_reserves") is None:
                if 'yes' in user_text or 'have' in user_text or 'month' in user_text or re.search(r'\d+\s*month', user_text):
                    state["has_reserves"] = True
                    print(f">>> FALLBACK extracted has_reserves: True")
                    conversation_result["advance"] = True
                elif 'no' in user_text or 'don\'t' in user_text or 'not' in user_text:
                    state["has_reserves"] = False
                    print(f">>> FALLBACK extracted has_reserves: False")
                    conversation_result["advance"] = True
        
        # ---------------------------------------------------------------------
        # STEP 3B: ADD AI RESPONSE TO MESSAGE HISTORY
        # ---------------------------------------------------------------------
        state["messages"].append({
            "role": "assistant",
            "content": conversation_result["response"]
        })
        
        # ---------------------------------------------------------------------
        # STEP 4B: PARSE LLM EXTRACTION (if any)
        # ---------------------------------------------------------------------
        # If LLM provided extraction instructions, parse them
        # Format: "field1:value1,field2:value2"
        # Example: "down_payment:50000,property_city:Miami"
        if conversation_result.get("extract") and conversation_result["extract"] != "none":
            print(f">>> LLM suggested extraction: {conversation_result['extract']}")
            # Parse the extraction string and update state directly
            extract_str = conversation_result["extract"]
            if ":" in extract_str:
                # Split by commas for multiple fields
                pairs = extract_str.split(",") if "," in extract_str else [extract_str]
                for pair in pairs:
                    if ":" in pair:
                        key, value = pair.split(":", 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Field name aliases (handle variations)
                        field_mappings = {
                            'location_city': 'property_city',
                            'city': 'property_city',
                            'location_state': 'property_state',
                            'state': 'property_state',
                            'property_purpose': 'loan_purpose',
                            'purpose': 'loan_purpose',
                            'loan_type': 'loan_purpose'
                        }
                        mapped_key = field_mappings.get(key, key)
                        
                        # Skip empty/null values
                        if value.lower() in ['none', 'null', '', 'n/a']:
                            continue
                        
                        # Convert values to appropriate types
                        if value.lower() == 'true':
                            state[mapped_key] = True
                            print(f">>> Extracted {mapped_key}: True")
                        elif value.lower() == 'false':
                            state[mapped_key] = False
                            print(f">>> Extracted {mapped_key}: False")
                        elif mapped_key in ['property_price', 'down_payment']:
                            # Parse monetary values
                            try:
                                clean_value = value.replace('$', '').replace(',', '')
                                state[mapped_key] = float(clean_value)
                                print(f">>> Extracted {mapped_key}: {state[mapped_key]}")
                            except ValueError:
                                print(f">>> Failed to parse number: {value}")
                                pass
                        elif mapped_key == 'loan_purpose':
                            state[mapped_key] = value.lower()
                            print(f">>> Extracted {mapped_key}: {value.lower()}")
                        else:
                            state[mapped_key] = value
                            print(f">>> Extracted {mapped_key}: {value}")
        
        # ---------------------------------------------------------------------
        # STEP 5: VALIDATION
        # ---------------------------------------------------------------------
        # Check if extracted data meets requirements before advancing
        # This prevents moving forward with invalid/incomplete data
        should_advance = conversation_result.get("advance", False)
        
        # Question-specific validation rules
        if current_q == 1 and should_advance:
            # Q1: Need valid down payment (at least $1k)
            if not state.get("down_payment") or state.get("down_payment") < 1000:
                print(f">>> ⚠️  Validation failed: Q1 requires down_payment >= 1000")
                should_advance = False
        
        elif current_q == 2 and should_advance:
            # Q2: Need city or state (or both)
            if not (state.get("property_city") or state.get("property_state")):
                print(f">>> ⚠️  Validation failed: Q2 requires city or state")
                should_advance = False
        
        elif current_q == 3 and should_advance:
            # Q3: Need loan purpose
            if not state.get("loan_purpose"):
                print(f">>> ⚠️  Validation failed: Q3 requires loan_purpose")
                should_advance = False
            
            # =================================================================
            # CRITICAL FIX: NORMALIZE LOAN_PURPOSE TO STANDARD VALUES
            # =================================================================
            # The rules_engine.py expects EXACTLY: "personal", "second", "investment"
            # But LLM might extract: "primary residence", "rental", etc.
            # We must normalize to standard values here!
            if state.get("loan_purpose"):
                purpose_lower = state["loan_purpose"].lower()
                user_msg_lower = last_user_message.lower()
                
                # Normalize based on user's actual message (more reliable than LLM extraction)
                if "investment" in user_msg_lower or "rental" in user_msg_lower:
                    if state["loan_purpose"] != "investment":
                        print(f">>> 🔧 Correcting loan_purpose to 'investment'")
                        state["loan_purpose"] = "investment"
                elif "primary" in user_msg_lower or "personal" in user_msg_lower or "live" in user_msg_lower:
                    if state["loan_purpose"] != "personal":
                        print(f">>> 🔧 Correcting loan_purpose to 'personal'")
                        state["loan_purpose"] = "personal"
                elif "second" in user_msg_lower or "vacation" in user_msg_lower:
                    if state["loan_purpose"] != "second":
                        print(f">>> 🔧 Correcting loan_purpose to 'second'")
                        state["loan_purpose"] = "second"
                # Also normalize if already set but in wrong format
                elif "primary residence" in purpose_lower:
                    state["loan_purpose"] = "personal"
                    print(f">>> 🔧 Normalized 'primary residence' to 'personal'")
                elif purpose_lower not in ["personal", "second", "investment"]:
                    # Unknown value - try to guess from content
                    print(f">>> ⚠️  Unknown loan_purpose value: '{state['loan_purpose']}'")
                    if "primary" in purpose_lower or "residence" in purpose_lower:
                        state["loan_purpose"] = "personal"
                    elif "invest" in purpose_lower:
                        state["loan_purpose"] = "investment"
        
        elif current_q == 4 and should_advance:
            # Q4: Need valid property price (at least $100k)
            if not state.get("property_price") or state.get("property_price") < 100000:
                print(f">>> ⚠️  Validation failed: Q4 requires property_price >= 100000")
                should_advance = False
        
        elif current_q == 5 and should_advance:
            # Q5: Need passport or visa information (either is fine)
            if state.get("has_valid_passport") is None and state.get("has_valid_visa") is None:
                print(f">>> ⚠️  Validation failed: Q5 requires passport or visa info")
                should_advance = False
        
        elif current_q == 6 and should_advance:
            # Q6: Need current location
            if not state.get("current_location"):
                print(f">>> ⚠️  Validation failed: Q6 requires current_location")
                should_advance = False
        
        elif current_q == 7 and should_advance:
            # Q7: Need income demonstration answer
            if state.get("can_demonstrate_income") is None:
                print(f">>> ⚠️  Validation failed: Q7 requires can_demonstrate_income")
                should_advance = False
        
        elif current_q == 8 and should_advance:
            # Q8: Need reserves answer
            if state.get("has_reserves") is None:
                print(f">>> ⚠️  Validation failed: Q8 requires has_reserves")
                should_advance = False
        
        # ---------------------------------------------------------------------
        # STEP 6: FORCE PROGRESSION CHECK (Anti-Loop Protection)
        # ---------------------------------------------------------------------
        # Use new helper function to check force progression
        if not should_advance and _force_progression_allowed(state, current_q):
            print(f">>> 🚨 FORCE ADVANCING Q{current_q} after {state['asked_counts'].get(current_q, 0)} attempts")
            should_advance = True
        
        # Increment or reset attempt counter
        if not should_advance:
            _increment_attempt(state, current_q)
            print(f">>> Question Q{current_q} attempt count: {state['asked_counts'].get(current_q, 0)}")
        else:
            _reset_attempt(state, current_q)
        
        # ---------------------------------------------------------------------
        # LEGACY STUCK DETECTION (kept for backup)
        # ---------------------------------------------------------------------
        repeated_question_key = f"repeated_q{current_q}_count"
        if not should_advance:
            # Increment stuck counter
            state[repeated_question_key] = state.get(repeated_question_key, 0) + 1
            
            # Force advance after 2 attempts (backup to new system)
            if state.get(repeated_question_key, 0) >= 2:
                force_advance = False
                # Check if we have data for this question
                if current_q == 1 and state.get("down_payment"):
                    force_advance = True
                elif current_q == 2 and (state.get("property_city") or state.get("property_state")):
                    force_advance = True
                elif current_q == 3 and state.get("loan_purpose"):
                    force_advance = True
                elif current_q == 4 and state.get("property_price"):
                    force_advance = True
                elif current_q == 5 and (state.get("has_valid_passport") is not None or state.get("has_valid_visa") is not None):
                    force_advance = True
                elif current_q == 6 and state.get("current_location"):
                    force_advance = True
                elif current_q == 7 and state.get("can_demonstrate_income") is not None:
                    force_advance = True
                elif current_q == 8 and state.get("has_reserves") is not None:
                    force_advance = True
                
                if force_advance:
                    print(f">>> 🚨 FORCE ADVANCING Q{current_q} after 2 attempts (have data)")
                    should_advance = True
                    state[repeated_question_key] = 0  # Reset counter
        else:
            # Reset counter when successfully advancing
            state[repeated_question_key] = 0
        
        # ---------------------------------------------------------------------
        # STEP 7: APPLY ADVANCEMENT DECISION
        # ---------------------------------------------------------------------
        print(f">>> Advance decision: {should_advance} (type: {type(should_advance)})")
        if should_advance:
            if current_q < 8:
                # Advance to next question (Q1→Q2, Q2→Q3, etc.)
                print(f">>> ✅ Advancing from Q{current_q} to Q{current_q + 1}")
                state["current_question"] = current_q + 1
            elif current_q == 8:
                # Finished Q8 - advance to Q9 which triggers verification
                print(f">>> ✅ Q8 complete - advancing to Q9 (triggers verification)")
                state["current_question"] = 9
        else:
            # Stay on current question (validation failed or data not extracted)
            print(f">>> ⏸️  Staying at Q{current_q}")
    
    # -------------------------------------------------------------------------
    # POST-APPROVAL: LETTER REQUEST HANDLING
    # -------------------------------------------------------------------------
    # If user was pre-approved and asks for pre-approval letter
    if state.get("final_decision") == "Pre-Approved" and state.get("conversation_complete"):
        return handle_letter_request(state)
    
    # -------------------------------------------------------------------------
    # STEP 8: AGGRESSIVE COMPLETION CHECK
    # -------------------------------------------------------------------------
    # If we have all required data, jump straight to verification
    # This prevents getting stuck in question loops
    has_all_data = (
        state.get("property_price") and 
        state.get("down_payment") and 
        state.get("loan_purpose") and
        state.get("has_valid_passport") is not None and 
        state.get("has_valid_visa") is not None and
        state.get("can_demonstrate_income") is not None and
        state.get("has_reserves") is not None
    )
    
    # Jump to verification if all data collected (must be at Q6+ to avoid premature jump)
    if has_all_data and current_q >= 6:
        if not state.get("verification_complete"):
            print(f">>> ✅ All data collected at Q{current_q} - jumping to verification")
            return verification_node(state)
        else:
            # Already verified - make final decision
            print(">>> Verification complete - making final decision")
            return final_decision_node(state)
    
    # Standard path: reached Q9+ means all questions answered
    if current_q >= 9:
        if has_all_data:
            if not state.get("verification_complete"):
                print(">>> All questions answered - moving to verification")
                return verification_node(state)
            else:
                return final_decision_node(state)
        else:
            # Reached Q9+ but missing data - log for debugging
            print(f">>> ⚠️  Reached Q{current_q} but missing required data:")
            print(f"    price={state.get('property_price')}, down={state.get('down_payment')}")
            print(f"    loan_purpose={state.get('loan_purpose')}")
            print(f"    passport={state.get('has_valid_passport')}, visa={state.get('has_valid_visa')}")
            print(f"    income={state.get('can_demonstrate_income')}, reserves={state.get('has_reserves')}")
    
    return state


# ============================================================================
# GRAPH CONSTRUCTION
# ============================================================================

def create_mortgage_graph() -> StateGraph:
    """
    CREATE THE CONVERSATION GRAPH STRUCTURE
    
    This function builds the LangGraph workflow that orchestrates the entire
    conversation flow. Think of it like building a flowchart.
    
    GRAPH STRUCTURE:
    
        START (Entry Point)
           ↓
        process_step (Main Node)
           ↓
        END (Exit Point)
    
    SIMPLE DESIGN:
    - We use a single node (process_step) that handles everything
    - Each API call processes one user message through this node
    - The node decides internally what to do (ask question, verify, decide)
    - After processing, we exit (END) and wait for next user message
    
    WHY SO SIMPLE?
    - Each user message is a separate API call
    - State is persisted between calls in api.py
    - No need for complex branching in graph
    - All logic is in process_conversation_step()
    
    ALTERNATIVE (if needed):
    Could add conditional edges to route to different nodes:
    - question_node → verification_node → decision_node
    But current single-node design is simpler and works well
    
    Returns:
        Compiled StateGraph ready to process conversations
    """
    # Create the graph with our state schema
    workflow = StateGraph(GraphState)
    
    # Add single processing node
    workflow.add_node("process_step", process_conversation_step)
    
    # Set entry point (where graph starts)
    workflow.set_entry_point("process_step")
    
    # Simple flow: process one step and end
    # (Each API call handles one user message)
    workflow.add_edge("process_step", END)
    
    # Compile the graph into executable workflow
    return workflow.compile()