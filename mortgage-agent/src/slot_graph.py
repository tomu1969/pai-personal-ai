"""
================================================================================
SLOT_GRAPH.PY - SLOT-FILLING ORCHESTRATOR
================================================================================

Main conversation flow using opportunistic slot-filling.
Extracts multiple entities per turn, confirms deltas, asks about missing slots.
"""

from hashlib import sha256
from typing import Optional
from .slot_state import (
    SlotFillingState,
    get_slot_value,
    get_slot_confidence,
    set_slot,
    get_next_slot_to_ask
)
from .slot_extraction import (
    extract_all_slots,
    calculate_extraction_delta,
    needs_confirmation,
    format_delta_confirmation
)
from .business_rules import (
    validate_all_rules,
    make_final_decision,
    format_approval_message,
    format_rejection_message,
    can_make_decision
)
from .question_generator import generate_question
from .question_handler import is_user_asking_question, handle_user_question


def process_slot_turn(state: SlotFillingState) -> SlotFillingState:
    """
    Main slot-filling turn processor.
    
    Flow:
    1. Extract ALL entities from user message
    2. Calculate delta (what's new/changed)
    3. Update slots
    4. Confirm delta if needed (low confidence or changed)
    5. Validate business rules
    6. If all filled → verification
    7. Otherwise → ask next missing slot from priority queue
    """
    
    # Increment turn
    state["turn_number"] += 1
    turn = state["turn_number"]
    
    print(f"\n{'='*80}")
    print(f"SLOT-FILLING TURN {turn}")
    print(f"{'='*80}")
    
    # =========================================================================
    # STEP 1: HANDLE FIRST MESSAGE (GREETING)
    # =========================================================================
    if len(state["messages"]) == 0:
        state["messages"].append({
            "role": "assistant",
            "content": "Hi, I can help you pre-qualify for a mortgage with just eight questions. Would you like to begin?"
        })
        return state
    
    # =========================================================================
    # STEP 2: GET USER MESSAGE
    # =========================================================================
    user_messages = [m for m in state["messages"] if m["role"] == "user"]
    if not user_messages:
        return state
    
    last_user_msg = user_messages[-1]["content"]
    print(f"User: {last_user_msg[:100]}...")
    
    # =========================================================================
    # STEP 3: DETECT AND HANDLE USER QUESTIONS
    # =========================================================================
    # Check if user is asking a question (at any point in conversation)
    # This runs BEFORE verification/extraction, so questions are handled even
    # during verification phase or when waiting for slot answers
    if is_user_asking_question(last_user_msg):
        print(f">>> Detected user question")
        
        answer = handle_user_question(last_user_msg, state)
        
        if answer:
            print(f">>> Answered question, guiding back to pending slot")
            state["messages"].append({"role": "assistant", "content": answer})
            
            # Don't change last_slot_asked - preserve context
            # Don't increment ask counts - this wasn't a slot question
            # User will answer the original question in next turn
            
            return state
    
    # =========================================================================
    # STEP 4: HANDLE VERIFICATION RESPONSE
    # =========================================================================
    if state.get("awaiting_verification"):
        response_lower = last_user_msg.lower().strip()
        yes_words = ['yes', 'correct', 'right', 'good', 'ok', 'okay', 'yep', 'yeah', 'si', 'sí']
        no_words = ['no', 'wrong', 'incorrect', 'change', 'fix', 'correction']
        
        if any(word in response_lower for word in yes_words):
            # Confirmed - make decision
            state["verification_complete"] = True
            state["awaiting_verification"] = False
            
            decision = make_final_decision(state)
            state["final_decision"] = decision
            state["conversation_complete"] = True
            
            if decision == "Pre-Approved":
                response = format_approval_message(state)
            elif decision == "Rejected":
                errors = validate_all_rules(state)
                response = format_rejection_message(errors)
            else:
                response = "Thank you. Your application requires manual review. A loan officer will contact you within 2 business days."
            
            state["messages"].append({"role": "assistant", "content": response})
            return state
        
        elif any(word in response_lower for word in no_words):
            # User wants to correct something
            state["awaiting_verification"] = False
            state["correction_mode"] = True
            state["messages"].append({
                "role": "assistant",
                "content": "What would you like to correct? Please specify the field and new value."
            })
            return state
        else:
            # Unclear response
            state["messages"].append({
                "role": "assistant",
                "content": "Please reply yes to confirm or no to make corrections."
            })
            return state
    
    # =========================================================================
    # NOTE: Old clarification handling removed - now handled by question_handler.py
    # =========================================================================
    
    # =========================================================================
    # STEP 5: EXTRACT ALL ENTITIES
    # =========================================================================
    print(f"\n>>> Extracting all entities from message...")
    extracted = extract_all_slots(last_user_msg, state=state)
    
    print(f">>> Extracted {len(extracted)} slots:")
    for slot_name, (value, conf, source) in extracted.items():
        print(f"  • {slot_name}: {value} (conf={conf:.2f}, source={source})")
    
    # =========================================================================
    # STEP 5: CALCULATE DELTA
    # =========================================================================
    delta = calculate_extraction_delta(state["slots"], extracted)
    
    print(f"\n>>> Delta analysis:")
    for slot_name, (value, conf, source, change_type) in delta.items():
        print(f"  • {slot_name}: {change_type}")
    
    # =========================================================================
    # STEP 6: UPDATE SLOTS (with validation)
    # =========================================================================
    for slot_name, (value, conf, source) in extracted.items():
        old_conf = get_slot_confidence(state, slot_name)
        old_value = get_slot_value(state, slot_name)
        
        # Validation: Prevent invalid values from overwriting good ones
        if slot_name in ["property_price", "down_payment"]:
            if value <= 0:
                print(f">>> ⚠️  BLOCKED: Attempted to set {slot_name} to invalid value {value}")
                continue
            if old_value and old_value > 0 and value == 0:
                print(f">>> ⚠️  BLOCKED: Attempted to overwrite valid {slot_name} ${old_value} with $0")
                continue
        
        set_slot(state, slot_name, value, conf, source)
        print(f">>> Set slot {slot_name} = {value} (conf {old_conf:.2f} → {conf:.2f})")
    
    # =========================================================================
    # STEP 7: VALIDATE BUSINESS RULES
    # =========================================================================
    errors = validate_all_rules(state)
    state["validation_errors"] = [e.to_dict() for e in errors]
    
    if errors:
        print(f"\n>>> ⚠️  Validation errors:")
        for err in errors:
            print(f"  • {err.rule}: {err.message}")
    
    # =========================================================================
    # STEP 8: DELTA CONFIRMATION (if needed)
    # =========================================================================
    needs_confirm_delta = False
    confirm_slots = {}
    
    for slot_name, (value, conf, source, change_type) in delta.items():
        old_conf = 0.0
        if slot_name in state["slots"]:
            old_conf = state["slots"][slot_name]["confidence"]
        
        if needs_confirmation(slot_name, value, conf, change_type, old_conf):
            needs_confirm_delta = True
            confirm_slots[slot_name] = (value, conf, source, change_type)
    
    if needs_confirm_delta:
        confirmation_msg = format_delta_confirmation(confirm_slots)
        print(f"\n>>> Delta confirmation needed: {confirmation_msg}")
        state["messages"].append({
            "role": "assistant",
            "content": confirmation_msg
        })
        return state
    
    # =========================================================================
    # STEP 9: CHECK IF ALL SLOTS FILLED
    # =========================================================================
    ready, missing = can_make_decision(state)
    
    print(f"\n>>> Decision readiness: {ready}")
    if not ready:
        print(f">>> Missing slots: {missing}")
    
    if ready:
        # All required slots filled - trigger verification
        print(f">>> All slots filled, triggering verification")
        
        # Show summary
        summary_parts = []
        for slot_name in state["priority_order"]:
            value = get_slot_value(state, slot_name)
            if value is not None:
                if slot_name in ["down_payment", "property_price"]:
                    display = f"${value:,.0f}"
                elif isinstance(value, bool):
                    display = "yes" if value else "no"
                else:
                    display = str(value)
                
                friendly_names = {
                    "down_payment": "Down payment",
                    "property_price": "Property price",
                    "property_city": "City",
                    "property_state": "State",
                    "loan_purpose": "Purpose",
                    "has_valid_passport": "Passport",
                    "has_valid_visa": "Visa",
                    "can_demonstrate_income": "Income documentation",
                    "has_reserves": "Reserves",
                    "current_location": "Current location"
                }
                
                friendly = friendly_names.get(slot_name, slot_name)
                summary_parts.append(f"• {friendly}: {display}")
        
        summary = "\n".join(summary_parts)
        
        state["awaiting_verification"] = True
        state["messages"].append({
            "role": "assistant",
            "content": f"Let me verify the information:\n\n{summary}\n\nIs this correct?"
        })
        return state
    
    # =========================================================================
    # STEP 10: ASK NEXT MISSING SLOT
    # =========================================================================
    next_slot = get_next_slot_to_ask(state)
    
    if next_slot is None:
        # All slots asked 2+ times but still missing - force ask first missing
        from .slot_state import get_missing_slots
        missing_slots = get_missing_slots(state, min_confidence=0.6)
        if missing_slots:
            next_slot = missing_slots[0]
        else:
            # Should not reach here
            state["messages"].append({
                "role": "assistant",
                "content": "I need some additional information to proceed. What else can you tell me about your situation?"
            })
            return state
    
    print(f"\n>>> Next slot to ask: {next_slot}")
    
    # Generate dynamic question with context
    question = generate_question(next_slot, state, last_user_msg)
    
    # Check for duplicate
    question_hash = sha256(question.encode()).hexdigest()[:16]
    if state.get("last_prompt_hash") == question_hash:
        print(f">>> Suppressing duplicate question")
        # Skip duplicate, try next slot
        state["slot_ask_counts"][next_slot] = state["slot_ask_counts"].get(next_slot, 0) + 1
        return process_slot_turn(state)  # Recurse to get next slot
    
    state["last_prompt_hash"] = question_hash
    state["last_slot_asked"] = next_slot
    state["slot_ask_counts"][next_slot] = state["slot_ask_counts"].get(next_slot, 0) + 1
    
    print(f">>> Asking: {question}")
    
    state["messages"].append({
        "role": "assistant",
        "content": question
    })
    
    return state


# Note: Question generation moved to question_generator.py for dynamic, context-aware questions