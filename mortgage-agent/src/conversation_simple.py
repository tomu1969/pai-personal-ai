"""
================================================================================
CONVERSATION_SIMPLE.PY - SIMPLIFIED MORTGAGE ASSISTANT
================================================================================

Single-prompt architecture for natural mortgage pre-qualification conversations.
Replaces complex slot-filling system with coherent conversational flow.
"""

import os
import json
import re
import time
from typing import Dict, List, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Enhanced logging for debugging
from .enhanced_logging import (
    logger, 
    log_function_call, 
    log_api_call, 
    log_processing_step,
    log_entity_state,
    log_conversation_state,
    log_api_metrics,
    check_environment,
    TimingTracker,
    log_extraction_details,
    log_conversation_flow,
    log_failure_point,
    log_entity_validation,
    validate_entities
)

# Database functions
from .database import get_or_create_conversation, save_conversation_safe

# Load environment variables
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Feature flag for batched analysis approach (leverages OpenAI's automatic caching)
USE_BATCHED_ANALYSIS = os.getenv("USE_BATCHED_ANALYSIS", "true").lower() == "true"

# Log environment at startup
check_environment()

# Check if GPT-5 is available, fallback to GPT-4o
def get_working_model():
    try:
        # Test if the configured model works
        test_response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": "Hello"}],
            max_completion_tokens=5
        )
        if test_response.choices[0].message.content:
            return MODEL
    except Exception as e:
        print(f"Model {MODEL} not working: {e}")
    
    # Try GPT-4o as fallback
    try:
        test_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
            max_completion_tokens=5
        )
        if test_response.choices[0].message.content:
            print(f"Falling back to GPT-4o")
            return "gpt-4o"
    except Exception as e:
        print(f"GPT-4o fallback failed: {e}")
    
    # Final fallback
    return "gpt-4o-mini"

WORKING_MODEL = get_working_model()
print(f"Using model: {WORKING_MODEL}")


def validate_response_against_state(response: str, all_entities: Dict[str, Any], last_user_message: str, messages: List[Dict[str, str]]) -> str:
    """
    Validate the LLM response against conversation state and enforce guardrails.
    Prevents re-asking answered questions and ensures proper conversation flow.
    
    Args:
        response: The LLM-generated response
        all_entities: Current conversation state with all collected entities
        last_user_message: User's latest message
        messages: Full conversation history
    
    Returns:
        Validated and potentially corrected response
    """
    
    logger.log("Validating response against conversation state", 'INFO')
    
    # GUARDRAIL 1: Prevent re-asking already answered questions
    collected_fields = {
        'down_payment': all_entities.get('down_payment'),
        'property_price': all_entities.get('property_price'), 
        'loan_purpose': all_entities.get('loan_purpose'),
        'property_city': all_entities.get('property_city'),
        'property_state': all_entities.get('property_state'),
        'has_valid_passport': all_entities.get('has_valid_passport'),
        'has_valid_visa': all_entities.get('has_valid_visa'),
        'can_demonstrate_income': all_entities.get('can_demonstrate_income'),
        'has_reserves': all_entities.get('has_reserves')
    }
    
    # Check if response asks for already provided information
    response_lower = response.lower()
    
    violations = []
    
    if collected_fields['down_payment'] and any(phrase in response_lower for phrase in ['down payment', 'put down', 'how much can you']):
        violations.append(f"Re-asking down payment (already: ${collected_fields['down_payment']:,})")
    
    if collected_fields['property_price'] and any(phrase in response_lower for phrase in ['property price', 'cost of', 'price you']):
        violations.append(f"Re-asking property price (already: ${collected_fields['property_price']:,})")
    
    if collected_fields['loan_purpose'] and any(phrase in response_lower for phrase in ['purpose', 'property purpose', 'second home', 'investment']):
        violations.append(f"Re-asking loan purpose (already: {collected_fields['loan_purpose']})")
    
    if (collected_fields['property_city'] and collected_fields['property_state']) and any(phrase in response_lower for phrase in ['location', 'city', 'where is', 'state']):
        violations.append(f"Re-asking location (already: {collected_fields['property_city']}, {collected_fields['property_state']})")
    
    if collected_fields['has_valid_passport'] is not None and any(phrase in response_lower for phrase in ['passport', 'valid passport']):
        violations.append(f"Re-asking passport status (already: {'Yes' if collected_fields['has_valid_passport'] else 'No'})")
    
    if collected_fields['has_valid_visa'] is not None and any(phrase in response_lower for phrase in ['visa', 'u.s. visa']):
        violations.append(f"Re-asking visa status (already: {'Yes' if collected_fields['has_valid_visa'] else 'No'})")
    
    if collected_fields['can_demonstrate_income'] is not None and any(phrase in response_lower for phrase in ['income', 'documentation', 'demonstrate income']):
        violations.append(f"Re-asking income documentation (already: {'Yes' if collected_fields['can_demonstrate_income'] else 'No'})")
    
    if collected_fields['has_reserves'] is not None and any(phrase in response_lower for phrase in ['reserves', 'saved', 'payments saved']):
        violations.append(f"Re-asking reserves (already: {'Yes' if collected_fields['has_reserves'] else 'No'})")
    
    # GUARDRAIL 2: Block irrelevant questions for foreign nationals
    irrelevant_patterns = ['credit score', 'credit rating', 'fico', 'employment history', 'job history']
    for pattern in irrelevant_patterns:
        if pattern in response_lower:
            violations.append(f"Asking irrelevant question: {pattern} (not needed for foreign nationals)")
    
    # GUARDRAIL 3: Enforce confirmation protocol - don't combine confirmation with next question
    user_msg_lower = last_user_message.lower().strip()
    is_user_exploring = any(phrase in user_msg_lower for phrase in ['what if', 'how much would', 'can you calculate', 'what about', 'suppose'])
    is_asking_for_options = 'options' in user_msg_lower
    
    if is_user_exploring:
        # User is exploring options - response should ask for confirmation, not jump to next topic
        next_topic_phrases = ['property purpose', 'what\'s the purpose', 'second home', 'investment', 
                             'location', 'city', 'state', 'passport', 'visa', 'income', 'documentation', 'reserves']
        
        has_next_topic = any(phrase in response_lower for phrase in next_topic_phrases)
        has_confirmation = any(phrase in response_lower for phrase in ['would you like', 'should i', 'proceed with', 'confirm'])
        
        if has_next_topic and not has_confirmation:
            violations.append("Jumping to next topic without confirmation after user exploration")
    
    # GUARDRAIL 3B: Handle location options requests
    if is_asking_for_options:
        # Check what was asked in the previous assistant message to understand context
        if any(phrase in messages[-2]["content"].lower() for phrase in ['location', 'city', 'state']) if len(messages) >= 2 else False:
            # User is asking for location options, not property options
            if any(phrase in response_lower for phrase in ['property price', 'down payment', 'price you']):
                violations.append("Misunderstanding location options request as property question")
    
    # GUARDRAIL 4: Consistency checks
    if 'down payment' in response_lower and 'property price' in response_lower:
        # Check for inconsistent down payment requirements
        if '20%' in response_lower or '20-25%' in response_lower:
            violations.append("Inconsistent down payment requirement (should be 30% for foreign nationals)")
    
    # If violations found, generate corrected response
    if violations:
        logger.log(f"Response validation violations: {violations}", 'WARNING')
        print(f">>> GUARDRAIL VIOLATIONS: {violations}")
        
        # Generate state-aware corrected response
        return generate_corrected_response(all_entities, last_user_message, violations)
    
    logger.log("Response passed validation", 'INFO')
    return response


def generate_corrected_response(all_entities: Dict[str, Any], last_user_message: str, violations: List[str]) -> str:
    """
    Generate a corrected response that respects conversation state and flow.
    
    Args:
        all_entities: Current conversation state
        last_user_message: User's latest message
        violations: List of detected violations
    
    Returns:
        State-aware corrected response
    """
    
    user_msg_lower = last_user_message.lower().strip()
    
    # Determine the next appropriate question based on missing information
    missing_context = get_missing_information_context(all_entities)
    
    # Handle user exploration/questions first
    is_exploring = any(phrase in user_msg_lower for phrase in ['what if', 'how much would', 'can you calculate', 'what about', 'suppose'])
    is_simple_confirmation = user_msg_lower in ['ok yes', 'yes', 'sure', 'ok', 'sounds good', 'that works']
    is_asking_location_options = 'options' in user_msg_lower and not all_entities.get('property_city')
    
    if is_asking_location_options:
        # User is asking for location options specifically
        return "For foreign nationals, popular locations include states with no income tax (Florida, Texas, Nevada) or major cities with strong rental markets (Miami, Austin, Las Vegas). Which location interests you?"
    
    elif is_exploring:
        # User is exploring - provide answer and ask for confirmation
        if all_entities.get('down_payment') and all_entities.get('property_price'):
            down_payment = all_entities['down_payment']
            property_price = all_entities['property_price']
            return f"With ${down_payment:,} down, you can afford up to ${property_price:,}. Would you like to proceed with these amounts?"
        else:
            return "I can help calculate that. What specific scenario would you like me to analyze?"
    
    elif is_simple_confirmation:
        # User confirmed - move to next missing information
        if 'Down payment amount: Not provided' in missing_context:
            return "How much can you put down?"
        elif 'Property price: Not provided' in missing_context:
            return "What's the property price you're considering?"
        elif 'Property purpose: Not provided' in missing_context:
            return "What's the property purpose: second home or investment?"
        elif 'Property city: Not provided' in missing_context or 'Property state: Not provided' in missing_context:
            return "What city and state is the property in?"
        elif 'Valid passport status: Not provided' in missing_context:
            return "Do you have a valid passport?"
        elif 'Valid U.S. visa status: Not provided' in missing_context:
            return "Do you have a valid U.S. visa?"
        elif 'Income documentation capability: Not provided' in missing_context:
            return "Can you demonstrate income with bank statements or tax returns?"
        elif 'Financial reserves: Not provided' in missing_context:
            return "Do you have 6-12 months of payments saved in reserves?"
        else:
            # All information collected - check qualification
            qualification = calculate_qualification(all_entities)
            if qualification.get('qualified', False):
                return "Based on your information, you appear to pre-qualify! I'll connect you with a loan officer to proceed."
            else:
                return f"Unfortunately, you don't qualify at this time. {qualification.get('reason', 'Please review the requirements.')}"
    
    # Default: Ask next missing question based on priority order
    # Check what's missing by looking at the actual entities, not the context string
    if not all_entities.get('down_payment'):
        return "How much can you put down?"
    elif not all_entities.get('property_price'):
        return "What's the property price you're considering?"
    elif not all_entities.get('loan_purpose'):
        # Before asking for loan purpose, check if down payment is sufficient
        down_payment = all_entities.get('down_payment', 0)
        property_price = all_entities.get('property_price', 0)
        
        if down_payment and property_price:
            down_pct = (down_payment / property_price) * 100
            if down_pct < 25:
                required_down = property_price * 0.30
                return f"Your ${down_payment:,} down payment is {down_pct:.1f}% of the ${property_price:,} property. Foreign nationals need 30% minimum (${required_down:,}). Would you like to increase your down payment or lower the property price?"
        
        return "What's the property purpose: second home or investment?"
    elif not all_entities.get('property_city') or not all_entities.get('property_state'):
        # Handle user asking for location options
        if 'options' in last_user_message.lower():
            return "For foreign nationals, popular locations include states with no income tax (Florida, Texas, Nevada) or major cities with strong rental markets (Miami, Austin, Las Vegas). Which location interests you?"
        return "What city and state is the property in?"
    elif all_entities.get('has_valid_passport') is None:
        return "Do you have a valid passport?"
    elif all_entities.get('has_valid_visa') is None:
        return "Do you have a valid U.S. visa?"
    elif all_entities.get('can_demonstrate_income') is None:
        return "Can you demonstrate income with bank statements or tax returns?"
    elif all_entities.get('has_reserves') is None:
        return "Do you have 6-12 months of payments saved in reserves?"
    else:
        # All information collected - check qualification
        qualification = calculate_qualification(all_entities)
        if qualification.get('qualified', False):
            return "Based on your information, you appear to pre-qualify! I'll connect you with a loan officer to proceed."
        else:
            return f"Unfortunately, you don't qualify at this time. {qualification.get('reason', 'Please review the requirements.')}"


# Load system prompt from external markdown file
def load_system_prompt():
    """Load system prompt from markdown file"""
    prompt_path = os.path.join(os.path.dirname(__file__), '..', 'new_system_prompt.md')
    try:
        with open(prompt_path, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Error: System prompt file not found at {prompt_path}")
        # Fallback to a basic prompt
        return "You are a mortgage pre-qualification assistant for foreign nationals."

# Load the system prompt at module level
MASTER_SYSTEM_PROMPT = load_system_prompt()


def handle_context_aware_response(user_question: str, user_message: str, entities: Dict[str, Any]) -> str:
    """
    Handle context-aware responses for user help requests and clarification needs.
    
    Args:
        user_question: The question/request extracted from user's message
        user_message: The full user message
        entities: Current conversation entities
    
    Returns:
        Context-appropriate response or None if not handled
    """
    user_msg_lower = user_message.lower().strip()
    question_lower = user_question.lower() if user_question else ""
    
    
    # Location options/suggestions
    if any(phrase in user_msg_lower for phrase in ["want options", "give me options", "i want choices", "what cities", "examples", "suggestions"]):
        # Check if we're asking for location
        missing_location = not entities.get("property_city") or not entities.get("property_state")
        
        if missing_location:
            # If state is provided, suggest cities in that state
            state = entities.get("property_state", "").upper()
            if state == "FL" or state == "FLORIDA":
                return "Popular Florida cities include Miami, Orlando, Tampa, Jacksonville, Fort Lauderdale, and Gainesville. Please provide the city and state like 'Miami, Florida'."
            elif state == "CA" or state == "CALIFORNIA":
                return "Popular California cities include Los Angeles, San Francisco, San Diego, Sacramento, and San Jose. Please provide the city and state like 'Los Angeles, California'."
            elif state == "NY" or state == "NEW YORK":
                return "Popular New York cities include New York City, Buffalo, Rochester, Syracuse, and Albany. Please provide the city and state like 'New York, NY'."
            elif state == "TX" or state == "TEXAS":
                return "Popular Texas cities include Houston, Dallas, Austin, San Antonio, and Fort Worth. Please provide the city and state like 'Austin, Texas'."
            else:
                return "Please provide the city and state where the property is located. For example: 'Miami, Florida' or 'Austin, Texas'."
        
    # Partial location handling - if only state provided, ask for city specifically  
    if entities.get("property_state") and not entities.get("property_city"):
        state = entities.get("property_state", "").upper()
        if user_msg_lower in ["fl", "florida"]:
            return "Thank you for specifying Florida. Which city in Florida? For example: Miami, Orlando, Tampa, or Jacksonville?"
        elif state:
            return f"Thank you for specifying {state}. Which city in {state} is the property located?"
    
    # Help with incomplete location
    if any(phrase in user_msg_lower for phrase in ["i don't know", "not sure", "help"]) and not entities.get("property_city"):
        return "For the property location, I need both city and state. Popular examples: 'Miami, Florida', 'Austin, Texas', 'Los Angeles, California'. What city and state?"
    
    return None


def handle_down_payment_adjustment(entities: Dict[str, Any]) -> str:
    """
    Handle user requests to adjust down payment for foreign national requirements.
    
    Args:
        entities: Current conversation entities
    
    Returns:
        Helpful response with calculated adjustment or None if not applicable
    """
    down_payment = entities.get("down_payment")
    property_price = entities.get("property_price")
    
    if not down_payment or not property_price:
        return None
    
    # Calculate current percentage and required amount
    current_percentage = (down_payment / property_price) * 100
    required_down_payment = property_price * 0.30  # 30% minimum
    
    # Only handle if currently below 30%
    if current_percentage >= 30:
        return None
    
    # Calculate the adjustment needed
    adjustment_needed = required_down_payment - down_payment
    
    return f"To meet the 30% minimum for foreign nationals, you'll need ${required_down_payment:,.0f} down payment (currently ${down_payment:,.0f}). That's an increase of ${adjustment_needed:,.0f}. Would you like to proceed with ${required_down_payment:,.0f} down, or would you prefer to lower the property price?"


def generate_next_question_from_context(entities: Dict[str, Any]) -> str:
    """
    Generate the next appropriate question based on missing entities and context.
    
    Args:
        entities: Current conversation entities
    
    Returns:
        Appropriate next question to ask the user
    """
    
    # Handle multiple city options case
    if 'property_city_options' in entities and entities['property_city_options']:
        cities = entities['property_city_options']
        if len(cities) == 2:
            return f"Would you prefer {cities[0]} or {cities[1]} for your investment property?"
        else:
            city_list = ", ".join(cities[:-1]) + f", or {cities[-1]}"
            return f"Which city would you prefer: {city_list}?"
    
    # Normal question sequence based on missing entities
    if not entities.get('down_payment'):
        return "How much can you put down?"
    elif not entities.get('property_price'):
        return "What's the property price you're considering?"
    elif not entities.get('loan_purpose'):
        # Check if down payment is sufficient first
        down_payment = entities.get('down_payment', 0)
        property_price = entities.get('property_price', 0)
        
        if down_payment and property_price:
            down_pct = (down_payment / property_price) * 100
            if down_pct < 25:
                required_down = property_price * 0.30
                return f"Your ${down_payment:,} down payment is {down_pct:.1f}% of the ${property_price:,} property. Foreign nationals need 30% minimum (${required_down:,}). Would you like to increase your down payment or lower the property price?"
        
        return "What's the property purpose: second home or investment?"
    elif not entities.get('property_city') or not entities.get('property_state'):
        return "What city and state is the property in?"
    elif entities.get('has_valid_passport') is None:
        return "Do you have a valid passport?"
    elif entities.get('has_valid_visa') is None:
        return "Do you have a valid U.S. visa?"
    elif entities.get('can_demonstrate_income') is None:
        return "Can you demonstrate income with bank statements or tax returns?"
    elif entities.get('has_reserves') is None:
        return "Do you have 6-12 months of payments saved in reserves?"
    else:
        return "Based on your information, let me check your qualification status..."


def validate_extracted_values(extracted: Dict[str, Any], latest_message: str) -> Dict[str, Any]:
    """
    Validate extracted values for reasonableness and context appropriateness.
    
    Args:
        extracted: Dictionary of extracted entities
        latest_message: Original user message for context
    
    Returns:
        Validated extracted entities with unrealistic values removed
    """
    validated = extracted.copy()
    
    # Validate down payment amount
    if 'down_payment' in validated and validated['down_payment'] is not None:
        down_payment = validated['down_payment']
        
        # Reject unreasonably low amounts (likely extraction errors)
        if down_payment < 10000:  # Less than $10k is unrealistic for foreign national mortgages
            print(f">>> [VALIDATION] Rejected unrealistic down_payment: ${down_payment:,} from '{latest_message}'")
            del validated['down_payment']
        elif down_payment > 10000000:  # More than $10M is extremely high
            print(f">>> [VALIDATION] Rejected extremely high down_payment: ${down_payment:,} from '{latest_message}'")
            del validated['down_payment']
        else:
            print(f">>> [VALIDATION] Accepted down_payment: ${down_payment:,}")
    
    # Validate property price
    if 'property_price' in validated and validated['property_price'] is not None:
        property_price = validated['property_price']
        
        # Reject unreasonably low amounts
        if property_price < 50000:  # Less than $50k is unrealistic
            print(f">>> [VALIDATION] Rejected unrealistic property_price: ${property_price:,} from '{latest_message}'")
            del validated['property_price']
        elif property_price > 50000000:  # More than $50M is extremely high
            print(f">>> [VALIDATION] Rejected extremely high property_price: ${property_price:,} from '{latest_message}'")
            del validated['property_price']
        else:
            print(f">>> [VALIDATION] Accepted property_price: ${property_price:,}")
    
    return validated


def generate_response_and_update_entities(messages: List[Dict[str, str]], persistent_entities: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
    """
    Pure LLM-based conversation processing that both generates response AND updates entities.
    No regex, no pattern matching - just natural language understanding.
    
    Args:
        messages: Full conversation history
        persistent_entities: Previously confirmed entities
    
    Returns:
        Tuple of (response_text, updated_entities)
    """
    
    # Function for the LLM to both respond and update entities
    conversation_function = {
        "name": "process_mortgage_conversation",
        "description": "Process user message and respond naturally while updating entity state",
        "parameters": {
            "type": "object",
            "properties": {
                "response": {
                    "type": "string",
                    "description": "Your natural response to the user"
                },
                "updated_entities": {
                    "type": "object",
                    "properties": {
                        "down_payment": {"type": "number", "description": "Down payment amount in dollars (convert percentages using property price if available)"},
                        "property_price": {"type": "number", "description": "Property price in dollars"},
                        "loan_purpose": {"type": "string", "enum": ["second_home", "investment"], "description": "Property purpose"},
                        "property_city": {"type": "string", "description": "Property city (understand major cities like Miami, NYC, LA without state clarification)"},
                        "property_state": {"type": "string", "description": "Property state (2-letter code, auto-fill for major cities: Miami=FL, NYC=NY, LA=CA, etc.)"},
                        "has_valid_passport": {"type": "boolean", "description": "Valid passport status"},
                        "has_valid_visa": {"type": "boolean", "description": "Valid U.S. visa status"},
                        "can_demonstrate_income": {"type": "boolean", "description": "Can provide income documentation"},
                        "has_reserves": {"type": "boolean", "description": "Has 6-12 months reserves saved"}
                    },
                    "description": "Updated entities based on conversation (only include entities that are confirmed or changed)"
                }
            },
            "required": ["response", "updated_entities"],
            "additionalProperties": False
        }
    }
    
    # Build conversation context for the LLM
    conversation_history = "\n".join([f"{msg['role'].upper()}: {msg['content']}" for msg in messages])
    
    # Add qualification context to prevent premature qualification
    qualification_context = ""
    all_info_collected = all([
        persistent_entities.get('down_payment'),
        persistent_entities.get('property_price'),
        persistent_entities.get('loan_purpose'),
        persistent_entities.get('property_city'),
        persistent_entities.get('has_valid_passport') is not None,
        persistent_entities.get('has_valid_visa') is not None,
        persistent_entities.get('can_demonstrate_income') is not None,
        persistent_entities.get('has_reserves') is not None
    ])

    if persistent_entities.get('down_payment') and persistent_entities.get('property_price'):
        down_pct = persistent_entities['down_payment'] / persistent_entities['property_price']
        if down_pct < 0.30:
            qualification_context = f"""
CRITICAL: Down payment is {down_pct*100:.1f}% - BELOW 30% requirement!
- Required: ${int(persistent_entities['property_price'] * 0.30):,}
- Current: ${persistent_entities['down_payment']:,}
DO NOT say user qualifies. Offer to adjust down payment first."""

    if all_info_collected:
        # Calculate qualification using the authoritative function
        qualification_result = calculate_qualification(persistent_entities)
        
        if qualification_result.get('qualified', False):
            qualification_context += f"""
ALL INFO COLLECTED - QUALIFICATION RESULT: PRE-QUALIFIED
You MUST tell the user they are pre-qualified and present the summary.
Reason: {qualification_result.get('reason', 'Met all requirements')}"""
        else:
            qualification_context += f"""
ALL INFO COLLECTED - QUALIFICATION RESULT: NOT QUALIFIED
You MUST tell the user they don't qualify at this time.
Reason: {qualification_result.get('reason', 'Requirements not met')}"""

    system_prompt = f"""{MASTER_SYSTEM_PROMPT}

CURRENT CONFIRMED ENTITIES:
{json.dumps(persistent_entities, indent=2)}
{qualification_context}

INSTRUCTIONS:
1. Read the conversation and understand what the user just said
2. Generate a natural, helpful response 
3. Update entities ONLY if the user confirms or provides new information
4. Handle ALL scenarios naturally:
   - "I can do 30%" → Ask for property price first, then calculate dollar amount
   - "miami" → Understand as "Miami, FL" (common US cities don't need state clarification)
   - "adjust downpayment" → Calculate 30% and offer specific amount
   - "what cities?" → Provide examples and ask which one
   - "yes" → Understand what they're confirming from context
   - Questions → Answer directly, then ask for confirmation

ENTITY UPDATE RULES:
- Only update entities when user explicitly confirms or provides new info
- If user says "adjust downpayment", calculate required 30% minimum and update down_payment
- If user asks "what if I put 300k?", treat as exploratory (don't update entities)
- If user says "yes" to a proposal, extract the values from the assistant's proposal
- Preserve existing entities unless explicitly changed

RESPONSE RULES:
- Be conversational and helpful
- Answer questions directly before asking next question  
- When user provides info, acknowledge it and move to next question
- NO confirmation needed during collection phase
- ONLY confirm once: After all 8 pieces collected, summarize everything
- NEVER decide qualification yourself - use the QUALIFICATION RESULT provided above
- Handle calculations naturally (30% down payment for foreign nationals)"""

    try:
        start_time = time.time()
        response = client.chat.completions.create(
            model=WORKING_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"CONVERSATION:\n{conversation_history}\n\nProcess the latest user message and respond naturally."}
            ],
            tools=[{"type": "function", "function": conversation_function}],
            tool_choice={"type": "function", "function": {"name": "process_mortgage_conversation"}},
            temperature=0.7
        )
        extraction_time = time.time() - start_time
        
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls and tool_calls[0].function.arguments:
            result = json.loads(tool_calls[0].function.arguments)
            
            response_text = result.get("response", "I understand. Let me help you with your mortgage needs.")
            updated_entities = result.get("updated_entities", {})
            
            # Merge with persistent entities (updated entities override persistent ones)
            final_entities = persistent_entities.copy()
            final_entities.update(updated_entities)
            
            # Log extraction details that watch_logs.py expects
            user_message = messages[-1]["content"] if messages else ""
            log_extraction_details("unified_llm", user_message, updated_entities, extraction_time)
            
            print(f">>> [UNIFIED LLM] Response: {response_text[:80]}...")
            print(f">>> [UNIFIED LLM] Entity updates: {updated_entities}")
            print(f">>> [UNIFIED LLM] Final entities: {final_entities}")
            
            logger.log(f"[RESPONSE_SOURCE] Unified LLM generated response successfully", 'INFO')
            return response_text, final_entities
        
    except Exception as e:
        print(f"Unified LLM processing error: {e}")
        return "I understand. Let me help you with your mortgage needs.", persistent_entities
    
    return "I understand. Let me help you with your mortgage needs.", persistent_entities


def handle_percentage_inputs(latest_message: str, extracted: Dict[str, Any], messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Handle percentage inputs for down payment by converting them to dollar amounts.
    Now uses LLM-based extraction only, no regex.
    
    Args:
        latest_message: The user's current message
        extracted: Currently extracted entities
        messages: Full conversation history to find property price
    
    Returns:
        Updated extracted entities with percentage converted to dollars
    """
    
    # Simple check for percentage symbol - if not present, skip
    if '%' not in latest_message:
        return extracted
    
    print(f">>> [PERCENTAGE] Detected percentage symbol in user input - relying on LLM extraction")
    
    # Let the LLM handle percentage conversion through the main extraction
    # The system prompt already instructs the LLM to handle percentages contextually
    return extracted


def is_location_context(messages: List[Dict[str, str]]) -> bool:
    """
    Check if the conversation context suggests location information is expected.
    
    Args:
        messages: Full conversation history
    
    Returns:
        True if the assistant's last question was about location
    """
    if len(messages) < 2:
        return False
    
    # Find the last assistant message
    last_assistant_message = None
    for msg in reversed(messages):
        if msg["role"] == "assistant":
            last_assistant_message = msg["content"].lower()
            break
    
    if not last_assistant_message:
        return False
    
    # Check for location-related keywords in assistant's question
    location_keywords = [
        "location", "city", "state", "where", "located", 
        "address", "area", "region", "property location"
    ]
    
    return any(keyword in last_assistant_message for keyword in location_keywords)


def enhance_location_extraction(latest_message: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhance location extraction with state name mapping and case handling.
    
    Args:
        latest_message: The user's current message
        extracted: Currently extracted entities
    
    Returns:
        Updated extracted entities with improved location data
    """
    import re
    
    # State name to abbreviation mapping
    STATE_MAPPING = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }
    
    # City to state mapping for common cities
    CITY_STATE_MAPPING = {
        'miami': 'FL', 'orlando': 'FL', 'tampa': 'FL', 'jacksonville': 'FL', 'fort lauderdale': 'FL',
        'new york': 'NY', 'brooklyn': 'NY', 'manhattan': 'NY', 'queens': 'NY', 'bronx': 'NY',
        'los angeles': 'CA', 'san francisco': 'CA', 'san diego': 'CA', 'sacramento': 'CA',
        'chicago': 'IL', 'houston': 'TX', 'dallas': 'TX', 'austin': 'TX', 'san antonio': 'TX',
        'phoenix': 'AZ', 'philadelphia': 'PA', 'atlanta': 'GA', 'boston': 'MA', 'seattle': 'WA',
        'denver': 'CO', 'las vegas': 'NV', 'detroit': 'MI', 'nashville': 'TN', 'charlotte': 'NC'
    }
    
    # Common 2-letter words that should NOT be treated as state codes
    COMMON_TWO_LETTER_WORDS = {
        'do', 'to', 'is', 'in', 'it', 'of', 'be', 'as', 'at', 'so', 'we', 'he', 'by', 
        'or', 'on', 'an', 'if', 'go', 'me', 'no', 'us', 'am', 'up', 'my', 'ad', 'ah'
    }
    
    message_lower = latest_message.lower().strip()
    
    # ENHANCED: Handle multiple city options like "miami or orlando"
    or_patterns = ['or', 'vs', 'versus', 'and', ',']
    for pattern in or_patterns:
        if pattern in message_lower:
            cities_mentioned = []
            for city_name, state_code in CITY_STATE_MAPPING.items():
                if city_name in message_lower:
                    cities_mentioned.append((city_name.title(), state_code))
            
            if len(cities_mentioned) >= 2:
                # User mentioned multiple cities - need clarification
                city_names = [city for city, state in cities_mentioned]
                print(f">>> [LOCATION] Multiple cities detected: {city_names}")
                # Store a special marker to indicate multiple options
                extracted['property_city_options'] = city_names
                extracted['property_state'] = cities_mentioned[0][1]  # Use first state as default
                return extracted
    
    # Skip location extraction for clarification questions or non-location contexts
    clarification_patterns = [
        r'\bwhat do you mean\b',
        r'\bwhat does\b',
        r'\bcan you explain\b',
        r'\bi don\'t understand\b',
        r'\bwhat is\b',
        r'\bhow do you\b',
        r'\bwhy\b',
        r'\bwhen\b'
    ]
    
    # Check if this looks like a clarification question
    is_clarification = any(re.search(pattern, message_lower) for pattern in clarification_patterns)
    if is_clarification:
        print(f">>> [LOCATION] Skipping extraction for clarification question: {latest_message}")
        return extracted
    
    # Extract location information
    city = None
    state = None
    
    # Check if we already have extracted city/state
    if 'property_city' in extracted:
        city = extracted['property_city']
    if 'property_state' in extracted:
        state = extracted['property_state']
    
    # Pattern 1: "City, State" or "City State" - TIGHTENED with minimum lengths
    city_state_patterns = [
        r'([a-zA-Z\s]{3,}),\s*([a-zA-Z\s]{2,})',  # Miami, Florida (min 3-char city)
        r'([a-zA-Z\s]{3,})\s+([a-zA-Z]{2})(?:\s|$)',  # Miami FL (min 3-char city)
        r'([a-zA-Z\s]{3,})\s+([a-zA-Z\s]{4,})(?:\s|$)'  # Miami Florida (min 3-char city)
    ]
    
    for pattern in city_state_patterns:
        match = re.search(pattern, message_lower)
        if match:
            potential_city = match.group(1).strip().title()
            potential_state = match.group(2).strip()
            
            # Handle state - VALIDATE ALL 2-letter codes against STATE_MAPPING
            if len(potential_state) == 2:
                potential_state_upper = potential_state.upper()
                potential_state_lower = potential_state.lower()
                
                # CRITICAL FIX: Check blacklist first, then validate against valid states
                if potential_state_lower in COMMON_TWO_LETTER_WORDS:
                    print(f">>> [LOCATION] Rejected common word: {potential_state_upper}")
                elif potential_state_upper in STATE_MAPPING.values():
                    state = potential_state_upper
                    print(f">>> [LOCATION] Validated 2-letter state: {state}")
                else:
                    print(f">>> [LOCATION] Rejected invalid 2-letter code: {potential_state_upper}")
            elif potential_state.lower() in STATE_MAPPING:
                state = STATE_MAPPING[potential_state.lower()]
                print(f">>> [LOCATION] Mapped full state name: {potential_state} -> {state}")
            
            # Use the city if we found a valid state
            if state:
                city = potential_city
                break
    
    # Pattern 2: Just city name (try to infer state)
    if not city or not state:
        for known_city, known_state in CITY_STATE_MAPPING.items():
            if known_city in message_lower:
                city = known_city.title()
                state = known_state
                print(f">>> [LOCATION] Inferred {city}, {state} from common city mapping")
                break
    
    # Pattern 3: Just state name
    if not state:
        for state_name, state_abbrev in STATE_MAPPING.items():
            if state_name in message_lower:
                state = state_abbrev
                print(f">>> [LOCATION] Found state {state} from full name")
                break
        
        # Check for state abbreviations (case insensitive)
        state_abbrev_match = re.search(r'\b([a-zA-Z]{2})\b', message_lower)
        if state_abbrev_match:
            potential_state_upper = state_abbrev_match.group(1).upper()
            potential_state_lower = state_abbrev_match.group(1).lower()
            
            # Apply blacklist filter and validate against real state abbreviations
            if potential_state_lower in COMMON_TWO_LETTER_WORDS:
                print(f">>> [LOCATION] Rejected common word in state search: {potential_state_upper}")
            elif potential_state_upper in STATE_MAPPING.values():
                state = potential_state_upper
                print(f">>> [LOCATION] Found state abbreviation {state}")
            else:
                print(f">>> [LOCATION] Rejected invalid state abbreviation: {potential_state_upper}")
    
    # Update extracted entities
    if city:
        extracted['property_city'] = city
        print(f">>> [LOCATION] Enhanced city extraction: {city}")
    
    if state:
        extracted['property_state'] = state
        print(f">>> [LOCATION] Enhanced state extraction: {state}")
    
    return extracted


# extract_entities_basic function removed - replaced with pure LLM-based extraction




def get_missing_information_context(filled_entities: Dict[str, Any]) -> str:
    """
    Generate context about what information is still needed.
    
    Args:
        filled_entities: Currently filled information
    
    Returns:
        String describing missing information for the assistant
    """
    
    # All required information in priority order
    required_fields = [
        ("down_payment", "Down payment amount"),
        ("property_price", "Property price"),
        ("loan_purpose", "Property purpose (second home or investment)"),
        ("property_city", "Property city"),
        ("property_state", "Property state"),
        ("has_valid_passport", "Valid passport status"),
        ("has_valid_visa", "Valid U.S. visa status"),
        ("can_demonstrate_income", "Income documentation capability"),
        ("has_reserves", "6-12 months reserves saved")
    ]
    
    collected = []
    missing = []
    
    for field, description in required_fields:
        if field in filled_entities and filled_entities[field] is not None:
            value = filled_entities[field]
            if isinstance(value, bool):
                value = "Yes" if value else "No"
            elif isinstance(value, (int, float)):
                value = f"${value:,.0f}" if field in ["down_payment", "property_price"] else str(value)
            collected.append(f"✓ {description}: {value}")
        else:
            missing.append(f"• {description}")
    
    context = ""
    if collected:
        context += "Information collected:\n" + "\n".join(collected) + "\n\n"
    
    if missing:
        context += "Still needed:\n" + "\n".join(missing)
    
    return context


def calculate_qualification(entities: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate mortgage pre-qualification based on collected information.
    
    Args:
        entities: All collected mortgage information
    
    Returns:
        Qualification decision with details
    """
    
    # Debug logging to track qualification inputs
    print(f">>> [QUALIFICATION] Calculating with entities: {entities}")
    print(f">>> [QUALIFICATION] Down payment: {entities.get('down_payment', 0)}")
    print(f">>> [QUALIFICATION] Property price: {entities.get('property_price', 0)}")
    
    errors = []
    
    # Check required fields
    required_fields = ["down_payment", "property_price", "loan_purpose", "property_city"]
    for field in required_fields:
        if field not in entities:
            errors.append(f"Missing {field}")
    
    if errors:
        return {"qualified": False, "reason": f"Missing information: {', '.join(errors)}"}
    
    # Business rule validations
    down_payment = entities.get("down_payment", 0)
    property_price = entities.get("property_price", 0)
    
    print(f">>> [QUALIFICATION] Using down_payment: ${down_payment:,}, property_price: ${property_price:,}")
    print(f">>> [QUALIFICATION] Calculated down payment %: {(down_payment/property_price)*100:.1f}%")
    
    if property_price <= 0:
        return {"qualified": False, "reason": "Invalid property price"}
    
    # LTV calculation (must be ≤ 70% for foreign nationals)
    ltv = (property_price - down_payment) / property_price
    down_pct = down_payment / property_price
    
    if down_pct < 0.30:
        return {
            "qualified": False, 
            "reason": f"Down payment must be ≥30%. You have {down_pct*100:.1f}%",
            "required_down": property_price * 0.30
        }
    
    # Documentation requirements
    if not entities.get("has_valid_passport"):
        errors.append("Valid passport required")
    if not entities.get("has_valid_visa"):
        errors.append("Valid U.S. visa required")
    if not entities.get("can_demonstrate_income"):
        if entities.get("loan_purpose") != "investment":
            errors.append("Income documentation required (non-investment property)")
        # For investment properties, no error - they qualify for DSCR
    if not entities.get("has_reserves"):
        errors.append("6-12 months reserves required")
    
    if errors:
        return {"qualified": False, "reason": "; ".join(errors)}
    
    # Calculate loan details
    loan_amount = property_price - down_payment
    max_loan_amount = int(loan_amount)
    
    return {
        "qualified": True,
        "max_loan_amount": max_loan_amount,
        "ltv": f"{ltv*100:.1f}%",
        "down_payment_pct": f"{down_pct*100:.1f}%",
        "reason": "Pre-qualified for foreign national mortgage"
    }


def smart_merge_entities(current_entities: Dict[str, Any], new_entities: Dict[str, Any], confirmed_entities: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Intelligently merge entities, preserving meaningful values and preventing data corruption.
    Prioritizes confirmed values over extracted values.
    
    Args:
        current_entities: Current entity state
        new_entities: New entities to merge
        confirmed_entities: Dictionary of explicitly confirmed values that shouldn't be overwritten
    
    Returns:
        Merged entities with smart preservation logic
    """
    if confirmed_entities is None:
        confirmed_entities = {}
    
    merged = current_entities.copy()
    
    for key, value in new_entities.items():
        # If this field has been explicitly confirmed, don't overwrite it unless it's a new confirmation
        if key in confirmed_entities:
            print(f">>> [SMART_MERGE] Skipping overwrite of confirmed {key}: {confirmed_entities[key]} (ignoring extracted: {value})")
            continue
        
        # For critical financial fields, only update with positive meaningful values
        if key in ['down_payment', 'property_price']:
            if value and value > 0:
                merged[key] = value
            # Keep existing positive value if new value is zero/None
            elif merged.get(key, 0) > 0:
                continue  # Don't overwrite positive value with zero
        
        # Special handling for updated_ fields - don't overwrite promoted values
        elif key in ['updated_down_payment', 'updated_property_price']:
            # If the regular field already exists, don't add the updated_ version
            regular_field = key.replace('updated_', '')
            if regular_field in merged and merged[regular_field] is not None:
                continue  # Skip adding updated_ field if regular field exists
            else:
                # Only add if value is meaningful
                if value is not None:
                    merged[key] = value
        
        # Location field validation
        elif key in ['property_city', 'property_state']:
            if value is not None:
                # Validate state fields
                if key == 'property_state':
                    # Get valid states and common words
                    valid_states = {
                        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
                        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
                    }
                    common_words = {
                        'do', 'to', 'is', 'in', 'it', 'of', 'be', 'as', 'at', 'so', 'we', 'he', 'by', 
                        'or', 'on', 'an', 'if', 'go', 'me', 'no', 'us', 'am', 'up', 'my', 'ad', 'ah'
                    }
                    
                    value_upper = str(value).upper()
                    value_lower = str(value).lower()
                    
                    if value_lower in common_words:
                        print(f">>> [SMART_MERGE] Rejected common word as state: {value}")
                    elif value_upper in valid_states:
                        merged[key] = value_upper
                        print(f">>> [SMART_MERGE] Accepted valid state: {value_upper}")
                    else:
                        print(f">>> [SMART_MERGE] Rejected invalid state: {value}")
                
                # Validate city fields (basic sanity check)
                elif key == 'property_city':
                    # Reject obviously invalid city names
                    invalid_cities = {'i', 'i can', 'i do', 'me', 'you', 'we', 'they'}
                    if str(value).lower() in invalid_cities:
                        print(f">>> [SMART_MERGE] Rejected invalid city: {value}")
                    elif len(str(value).strip()) >= 2:  # Minimum length requirement
                        merged[key] = value
                        print(f">>> [SMART_MERGE] Accepted city: {value}")
                    else:
                        print(f">>> [SMART_MERGE] Rejected too-short city: {value}")
        
        else:
            # For other fields, update normally
            if value is not None:
                merged[key] = value
    
    return merged


# Legacy confirmation functions - replaced by LLM analysis
# Keeping for backward compatibility but not used in main flow

def is_confirmation_message(message: str) -> bool:
    """
    DEPRECATED: Use analyze_user_response_with_llm() instead.
    Legacy function for detecting confirmation responses.
    """
    message_lower = message.lower().strip()
    positive_words = ['yes', 'yeah', 'yep', 'correct', 'right', 'exactly', 'confirm', 'proceed', 'sounds good', 'that works', 'perfect', 'ok', 'okay', 'good', 'fine', 'sure']
    negative_words = ['no', 'nope', 'not', 'don\'t', 'keep', 'stay', 'original']
    return message_lower in positive_words or message_lower in negative_words

def is_positive_confirmation(message: str) -> bool:
    """
    DEPRECATED: Use analyze_user_response_with_llm() instead.
    Legacy function for detecting positive confirmations.
    """
    message_lower = message.lower().strip()
    positive_words = ['yes', 'yeah', 'yep', 'correct', 'right', 'exactly', 'confirm', 'proceed', 'sounds good', 'that works', 'perfect', 'ok', 'okay', 'good', 'fine', 'sure']
    return message_lower in positive_words


@log_api_call("OpenAI-Analysis")
def analyze_user_response_with_llm(user_message: str, assistant_message: str, current_entities: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use LLM to contextually analyze user's response for confirmations, rejections, and value updates.
    Enhanced with simplified pattern matching for compound responses.
    
    Args:
        user_message: The user's current message
        assistant_message: The assistant's previous message (for context)
        current_entities: Current conversation entities
    
    Returns:
        Dictionary with confirmation analysis and extracted values
    """
    
    # Pre-process compound responses with simplified patterns
    user_message_clean = user_message.lower().strip()
    
    # Handle compound responses like "yes adjust", "ok but change", "sure modify"
    compound_patterns = [
        (r'\b(yes|yeah|ok|sure|sounds good)\b.*\b(adjust|change|modify|update|make it)\b', 'positive_with_adjustment'),
        (r'\b(no|nah|not really)\b.*\b(instead|rather|actually|but)\b', 'negative_with_alternative'),
        (r'\b(yes|yeah|ok|sure)\b\s*,?\s*\b(but|however|though)\b', 'positive_with_condition')
    ]
    
    compound_type = None
    for pattern, response_type in compound_patterns:
        if re.search(pattern, user_message_clean):
            compound_type = response_type
            print(f">>> Detected compound response: {response_type}")
            break
    
    # Simple confirmation patterns for quick detection
    simple_confirmations = {
        'positive': [r'\b(yes|yeah|yep|sure|ok|okay|sounds good|that works|correct|right|exactly)\b'],
        'negative': [r'\b(no|nah|nope|not really|don\'t think so|incorrect|wrong)\b']
    }
    
    simple_confirmation = None
    for conf_type, patterns in simple_confirmations.items():
        for pattern in patterns:
            if re.search(pattern, user_message_clean):
                simple_confirmation = conf_type
                break
        if simple_confirmation:
            break
    
    analysis_function = {
        "name": "analyze_user_response",
        "description": "Analyze user's response in context to understand confirmations, rejections, and value updates",
        "parameters": {
            "type": "object",
            "properties": {
                "is_confirmation": {
                    "type": "boolean",
                    "description": "True if user is responding to a yes/no question or confirming/rejecting something"
                },
                "confirmation_type": {
                    "type": "string",
                    "enum": ["positive", "negative", "neutral", "positive_with_adjustment", "negative_with_alternative", "positive_with_condition"],
                    "description": "positive = accepting/agreeing, negative = rejecting/declining, neutral = unclear, positive_with_adjustment = yes but wants changes, negative_with_alternative = no but offers alternative, positive_with_condition = yes but has conditions"
                },
                "confirmed_values": {
                    "type": "object",
                    "properties": {
                        "down_payment": {"type": "number", "description": "Down payment amount if confirmed/updated"},
                        "property_price": {"type": "number", "description": "Property price if confirmed/updated"},
                        "loan_purpose": {"type": "string", "description": "Property purpose if confirmed/updated"},
                        "property_city": {"type": "string", "description": "Property city if confirmed/updated"},
                        "property_state": {"type": "string", "description": "Property state if confirmed/updated"},
                        "has_valid_passport": {"type": "boolean", "description": "Passport status if confirmed/updated"},
                        "has_valid_visa": {"type": "boolean", "description": "Visa status if confirmed/updated"},
                        "can_demonstrate_income": {"type": "boolean", "description": "Income documentation if confirmed/updated"},
                        "has_reserves": {"type": "boolean", "description": "Reserves status if confirmed/updated"}
                    },
                    "description": "Values that the user is confirming or providing"
                },
                "new_information": {
                    "type": "object",
                    "properties": {
                        "down_payment": {"type": "number", "description": "New down payment amount"},
                        "property_price": {"type": "number", "description": "New property price"},
                        "loan_purpose": {"type": "string", "description": "Property purpose"},
                        "property_city": {"type": "string", "description": "Property city"},
                        "property_state": {"type": "string", "description": "Property state"},
                        "has_valid_passport": {"type": "boolean", "description": "Passport status"},
                        "has_valid_visa": {"type": "boolean", "description": "Visa status"},
                        "can_demonstrate_income": {"type": "boolean", "description": "Income documentation capability"},
                        "has_reserves": {"type": "boolean", "description": "Reserves status"},
                        "user_question": {"type": "string", "description": "Any question the user asked"},
                        "needs_clarification": {"type": "boolean", "description": "True if user seems uncertain or is asking questions"}
                    },
                    "description": "Any new information provided by the user"
                },
                "reasoning": {
                    "type": "string",
                    "description": "Brief explanation of the analysis for debugging"
                }
            },
            "required": ["is_confirmation", "confirmation_type", "confirmed_values", "new_information", "reasoning"],
            "additionalProperties": False
        }
    }
    
    try:
        response = client.chat.completions.create(
            model=WORKING_MODEL,
            messages=[
                {"role": "system", "content": f"""You are analyzing user responses in a mortgage pre-qualification conversation.

COMPOUND RESPONSE ANALYSIS:
{f"DETECTED: {compound_type} - Handle this as a confirmation with additional action required." if compound_type else "No compound pattern detected."}
{f"SIMPLE CONFIRMATION: {simple_confirmation}" if simple_confirmation else "No simple confirmation pattern detected."}

CONTEXT UNDERSTANDING:
- Look at the assistant's previous message to understand what the user is responding to
- CRITICAL: Only extract values that match what the assistant was asking for
- If assistant asked about "property purpose" but user gives a number like "500k", do NOT extract as property_price
- If assistant asked about "property price" but user gives non-numeric response, do NOT extract as property_price
- Determine if the user is confirming, rejecting, or providing new information
- Extract both explicit values and contextual confirmations
- Handle compound responses that combine confirmation with adjustment requests

CONFIRMATION DETECTION:
- "yes", "sure", "that works", "sounds good" = positive confirmation
- "no", "not really", "I'd rather", "actually..." = negative confirmation  
- Direct statements like "I'll put down 250k" = positive confirmation with new value
- Questions or uncertainty = needs clarification
- Compound responses like "yes adjust" = positive confirmation + request for modification

COMPOUND RESPONSE HANDLING:
- positive_with_adjustment: User confirms but wants to modify something
- negative_with_alternative: User rejects but offers alternative
- positive_with_condition: User agrees but has conditions

VALUE EXTRACTION FROM CONTEXT:
- When user says "yes" to assistant's proposal, extract the values from the assistant's message
- Look for phrases like "proceed with $X property and $Y down" or "confirm $Z down payment"
- Extract amounts mentioned in assistant's confirmation questions
- Handle formats: $250k, $250,000, 1M, etc.
- For compound responses, still extract base values but note adjustment needed

QUESTION-RESPONSE MATCHING:
- If assistant asks "property purpose" and user says "500k" → this is a confused response, extract nothing
- If assistant asks "property price" and user says "investment" → this is a confused response, extract nothing  
- If assistant asks "down payment" and user says "second home" → this is a confused response, extract nothing
- Only extract values when the user's response type matches what was asked

META RESPONSES (HELP REQUESTS):
- "i want options", "give me options", "what are my choices" → user_question, needs_clarification=true
- "examples", "suggestions", "help", "what cities" → user_question, needs_clarification=true
- "I don't know", "not sure", "what do you recommend" → needs_clarification=true
- These are NOT direct answers - they are requests for help or clarification
- Do NOT extract entity values from meta responses - preserve existing entities

EXAMPLES:
Assistant: "Should we proceed with $1M property and $250k down?"
User: "yes" → positive confirmation of both values (extract 1000000 for property_price, 250000 for down_payment)
User: "yes but make it 300k down" → positive confirmation of property, update down payment to 300000
User: "yes adjust" → positive confirmation, but flag that user wants to make changes
User: "actually I want 2M" → negative confirmation, new property price"""},
                {"role": "user", "content": f"""ASSISTANT'S PREVIOUS MESSAGE: "{assistant_message}"

USER'S RESPONSE: "{user_message}"

CURRENT ENTITIES: {json.dumps(current_entities)}

Analyze the user's response in context and extract confirmation status and values."""}
            ],
            tools=[{"type": "function", "function": analysis_function}],
            tool_choice={"type": "function", "function": {"name": "analyze_user_response"}},
            temperature=0.1
        )
        
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls and tool_calls[0].function.arguments:
            result = json.loads(tool_calls[0].function.arguments)
            print(f">>> LLM Analysis: {result.get('reasoning', 'No reasoning provided')}")
            return result
    
    except Exception as e:
        print(f"LLM analysis error: {e}")
        # Enhanced fallback using pre-processed patterns
        fallback_confirmation_type = "neutral"
        if compound_type:
            fallback_confirmation_type = compound_type
        elif simple_confirmation:
            fallback_confirmation_type = simple_confirmation
        
        return {
            "is_confirmation": bool(simple_confirmation or compound_type),
            "confirmation_type": fallback_confirmation_type, 
            "confirmed_values": {},
            "new_information": {},
            "reasoning": f"LLM analysis failed, used pattern matching: {fallback_confirmation_type}"
        }
    
    return {
        "is_confirmation": False,
        "confirmation_type": "neutral",
        "confirmed_values": {},
        "new_information": {},
        "reasoning": "No analysis result"
    }


def analyze_conversation_history_batched(messages: List[Dict[str, str]], current_entities: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    """
    Batch analyze all user messages in conversation history with single API call.
    Leverages OpenAI's automatic prompt caching for efficiency.
    
    Args:
        messages: Full conversation history
        current_entities: Current conversation entities
    
    Returns:
        Dictionary mapping message index to analysis results
    """
    
    # Build conversation pairs for analysis - SLIDING WINDOW: Only analyze recent messages
    # This prevents O(n²) complexity that was causing timeouts
    conversation_pairs = []
    
    # Only analyze the last 12 messages (6 exchanges) to retain entity context longer
    recent_messages = messages[-12:] if len(messages) > 12 else messages
    
    # Log sliding window details
    logger.log(f"[BATCHED_WINDOW] Total messages: {len(messages)}, analyzing last {len(recent_messages)} messages", 'DEBUG')
    if len(messages) > 12:
        skipped_count = len(messages) - len(recent_messages)
        logger.log(f"[BATCHED_WARNING] Skipping {skipped_count} older messages - may lose entity state!", 'WARNING')
    
    # Adjust indices for the sliding window
    offset = len(messages) - len(recent_messages)
    
    for i, msg in enumerate(recent_messages):
        if msg["role"] == "user" and i > 0:
            # Find previous assistant message within the recent window
            prev_assistant_msg = ""
            for j in range(i-1, -1, -1):
                if recent_messages[j]["role"] == "assistant":
                    prev_assistant_msg = recent_messages[j]["content"]
                    break
            
            if prev_assistant_msg:
                conversation_pairs.append({
                    "index": i + offset,  # Adjust index for original message position
                    "user_message": msg["content"],
                    "assistant_message": prev_assistant_msg
                })
    
    if not conversation_pairs:
        return {}
    
    # Function definition for batch analysis
    batch_analysis_function = {
        "name": "analyze_conversation_history",
        "description": "Batch analyze all user responses in conversation history for confirmations and value updates",
        "parameters": {
            "type": "object",
            "properties": {
                "analyses": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "message_index": {"type": "integer", "description": "Index of the user message in conversation"},
                            "is_confirmation": {"type": "boolean", "description": "True if user is confirming/rejecting something"},
                            "confirmation_type": {
                                "type": "string",
                                "enum": ["positive", "negative", "neutral", "positive_with_adjustment", "negative_with_alternative", "positive_with_condition"],
                                "description": "Type of confirmation response"
                            },
                            "confirmed_values": {
                                "type": "object",
                                "properties": {
                                    "down_payment": {"type": "number", "description": "Down payment amount if confirmed"},
                                    "property_price": {"type": "number", "description": "Property price if confirmed"},
                                    "loan_purpose": {"type": "string", "description": "Property purpose if confirmed"},
                                    "property_city": {"type": "string", "description": "Property city if confirmed"},
                                    "property_state": {"type": "string", "description": "Property state if confirmed"},
                                    "has_valid_passport": {"type": "boolean", "description": "Passport status if confirmed"},
                                    "has_valid_visa": {"type": "boolean", "description": "Visa status if confirmed"},
                                    "can_demonstrate_income": {"type": "boolean", "description": "Income documentation if confirmed"},
                                    "has_reserves": {"type": "boolean", "description": "Reserves status if confirmed"}
                                },
                                "description": "Values confirmed by the user"
                            },
                            "reasoning": {"type": "string", "description": "Brief explanation of analysis"}
                        },
                        "required": ["message_index", "is_confirmation", "confirmation_type", "confirmed_values", "reasoning"]
                    },
                    "description": "Analysis results for each user message"
                }
            },
            "required": ["analyses"]
        }
    }
    
    # Create system prompt for cache optimization (common prefix across calls)
    system_prompt = f"""You are analyzing user responses in a mortgage pre-qualification conversation.

ANALYSIS FRAMEWORK:
- Identify confirmations, rejections, and new information in each user response
- Consider the assistant's previous message as context for each user response
- Extract values from context when user confirms assistant's proposals
- Handle compound responses (confirmation + adjustment request)

CONFIRMATION PATTERNS:
- positive: "yes", "sure", "that works", "sounds good", "I'll do that"
- negative: "no", "not really", "I'd rather not", "can't do that"
- positive_with_adjustment: "yes but change X", "sure, adjust Y"
- negative_with_alternative: "no, instead I'd like Z"
- positive_with_condition: "yes, but only if W"

VALUE EXTRACTION RULES:
- When user says "yes" to assistant's proposal, extract values from assistant's message
- Look for dollar amounts, percentages, locations, yes/no answers
- Handle formats: $250k, $250,000, 1M, 25%, etc.
- For property location, extract both city and state

CURRENT CONVERSATION CONTEXT:
Current entities: {json.dumps(current_entities)}

Analyze each user message in the context of the assistant's previous message."""

    # Build conversation context for analysis
    conversation_context = []
    for pair in conversation_pairs:
        conversation_context.append({
            "message_index": pair["index"],
            "assistant_context": pair["assistant_message"],
            "user_response": pair["user_message"]
        })
    
    try:
        logger.log("Starting batched conversation analysis", 'INFO')
        
        response = client.chat.completions.create(
            model=WORKING_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze these conversation exchanges:\n\n{json.dumps(conversation_context, indent=2)}"}
            ],
            tools=[{"type": "function", "function": batch_analysis_function}],
            tool_choice={"type": "function", "function": {"name": "analyze_conversation_history"}},
            temperature=0.1
        )
        
        # Log cache usage if available
        usage = response.usage
        usage_data = {
            'total_tokens': usage.total_tokens if usage else 0,
            'cached_tokens': 0
        }
        
        if hasattr(usage, 'prompt_tokens_details') and hasattr(usage.prompt_tokens_details, 'cached_tokens'):
            cached_tokens = usage.prompt_tokens_details.cached_tokens
            total_tokens = usage.prompt_tokens
            usage_data['cached_tokens'] = cached_tokens
            cache_hit_rate = (cached_tokens / total_tokens * 100) if total_tokens > 0 else 0
            logger.log(f"Cache effectiveness: {cached_tokens}/{total_tokens} tokens cached ({cache_hit_rate:.1f}%)", 'INFO')
        
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls and tool_calls[0].function.arguments:
            result = json.loads(tool_calls[0].function.arguments)
            analyses = result.get("analyses", [])
            
            # Convert to indexed dictionary
            indexed_results = {}
            for analysis in analyses:
                msg_index = analysis.get("message_index")
                if msg_index is not None:
                    indexed_results[msg_index] = analysis
                    logger.log(f"Batch analysis for message {msg_index}: {analysis.get('reasoning', 'No reasoning')}", 'DEBUG')
            
            logger.log(f"Batched analysis completed: {len(indexed_results)} messages analyzed in 1 API call", 'SUCCESS')
            return indexed_results, usage_data
    
    except Exception as e:
        logger.log(f"Batched analysis failed: {e}", 'ERROR')
        return {}, {'total_tokens': 0, 'cached_tokens': 0}


@log_function_call("process_conversation_turn")
def process_conversation_turn(messages: List[Dict[str, str]], conversation_id: str = None, persistent_confirmed_entities: Dict[str, Any] = None) -> tuple[str, Dict[str, Any]]:
    """
    Process a single conversation turn using the simplified architecture.
    
    Args:
        messages: Full conversation history
        conversation_id: Unique conversation identifier  
        persistent_confirmed_entities: Confirmed entities from previous conversation turns
    
    Returns:
        Tuple of (assistant_response, updated_confirmed_entities)
    """
    import time
    
    # Initialize comprehensive timing tracker
    timing = TimingTracker("conversation_turn")
    
    # Initialize metrics tracking
    api_call_count = 0
    total_tokens_used = 0
    cached_tokens_used = 0
    
    # TIMEOUT PROTECTION: Maximum processing time to prevent gateway timeouts
    MAX_PROCESSING_TIME = 10.0  # seconds - well under Render's 30s limit
    
    def check_timeout():
        elapsed = timing.checkpoints[-1]['elapsed_seconds'] if timing.checkpoints else 0
        if elapsed > MAX_PROCESSING_TIME:
            logger.log(f"Timeout protection triggered after {elapsed:.1f}s", 'WARNING')
            return True
        return False
    
    # Log conversation state with detailed analysis
    log_conversation_state(messages, "Starting conversation processing")
    timing.checkpoint("conversation_state_logged", {
        "message_count": len(messages),
        "conversation_id": conversation_id
    })
    
    # Handle initial greeting
    assistant_messages = [m for m in messages if m["role"] == "assistant"]
    if len(assistant_messages) == 0:
        logger.log("No assistant messages - returning initial greeting", 'INFO')
        initial_entities = persistent_confirmed_entities.copy() if persistent_confirmed_entities else {}
        return "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?", initial_entities
    
    # Get the last user message and analyze it with LLM
    user_messages = [m for m in messages if m["role"] == "user"]
    last_user_message = user_messages[-1]["content"] if user_messages else ""
    last_assistant_content = assistant_messages[-1]["content"] if assistant_messages else ""
    
    # Handle initial greeting case
    assistant_messages = [m for m in messages if m["role"] == "assistant"]
    if len(assistant_messages) == 0:
        logger.log("[RESPONSE_SOURCE] Initial greeting - no LLM call needed", 'INFO')
        initial_entities = persistent_confirmed_entities.copy() if persistent_confirmed_entities else {}
        return "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?", initial_entities
    
    # Use new unified LLM approach - no separate entity extraction
    logger.log("[RESPONSE_SOURCE] Calling unified LLM function", 'INFO')
    entities_before = persistent_confirmed_entities.copy() if persistent_confirmed_entities else {}
    response, entities = generate_response_and_update_entities(messages, persistent_confirmed_entities or {})
    logger.log(f"[RESPONSE_SOURCE] Unified LLM response: {response[:80]}...", 'INFO')
    
    # Log conversation flow details that watch_logs.py expects
    log_conversation_flow(last_user_message, response, entities_before, entities, {
        "model": WORKING_MODEL,
        "processing_time": timing.checkpoints[-1]['elapsed_seconds'] if timing.checkpoints else 0
    })
    
    return response, entities
