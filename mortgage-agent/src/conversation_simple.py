"""
================================================================================
CONVERSATION_SIMPLE.PY - SIMPLIFIED MORTGAGE ASSISTANT
================================================================================

Single-prompt architecture for natural mortgage pre-qualification conversations.
Replaces complex slot-filling system with coherent conversational flow.
"""

import os
import json
from typing import Dict, List, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

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

# Master system prompt for natural conversation flow
MASTER_SYSTEM_PROMPT = """You are a mortgage pre-qualification assistant specializing in foreign national loans.

Your mission: Pre-qualify users by collecting these 8 pieces of information:
1. Down payment amount 
2. Property price 
3. Property purpose: primary residence, second home, or investment
4. Property location (city and state)
5. Valid passport status
6. Valid U.S. visa status  
7. Income documentation capability
8. Financial reserves (6-12 months of payments saved)

CONVERSATION RULES:
- If user asks a question, answer it directly BEFORE asking the next question
- If user changes their requirements (down payment/property price), acknowledge the change and update
- Provide specific examples when user asks "what type" or "how much"
- Don't rush to qualification if user is still exploring or has pending questions
- Be direct, professional, and concise
- Ask one question at a time in logical order

CRITICAL: DOWN PAYMENT VALIDATION RULES:
- NEVER validate down payment percentage until you have BOTH down payment AND property price
- Foreign nationals need 25% minimum down payment, but this can only be calculated with both values
- If user provides down payment but no property price, ask for property price next
- Only after having both values, check if down payment ≥ 25% of property price
- If insufficient, ask user to adjust EITHER down payment up OR property price down

CONFIRMATION PROTOCOL (CRITICAL):
- After answering ANY question from the user, ask for confirmation
- NEVER move to the next qualification topic without confirming the user's choice
- When multiple options are discussed, explicitly ask which one to proceed with
- Pattern: Answer → Confirm → Proceed

Response Examples:
- User asks "how much for 2M?" → Calculate, then ask "Would you like to proceed with $2M and $500k down?"
- User says "what if I put 300k?" → Calculate, then ask "Should I update your down payment to $300k?"
- User asks "what visas are admissible?" → List visas, then ask "Do you have one of these visas?"
- User explores multiple options → Present options, ask "Which option works best for you?"

NEVER combine confirmation with next question. Keep them separate:
❌ Wrong: "Would you like $2M? What's the property purpose?"
❌ Wrong: "Is this correct? Next, what's the location?"
❌ Wrong: "Would you like to proceed with this? If so, what's the property purpose?"
❌ Wrong: "With $200k down, you can afford $800k maximum. What's the purpose of the property?"
❌ Wrong: "Admissible visas include B1/B2, E-2, H-1B. Do you have income documentation?"
✅ Right: "Would you like to proceed with $2M and $500k down?"
[Wait for answer]
✅ Then: "Great! What's the property purpose?"
✅ Right: "Admissible visas include B1/B2, E-2, H-1B. Do you have one of these visas?"
[Wait for answer]
✅ Then: "Great! Can you demonstrate income with bank statements or tax returns?"

CONFIRMATION MODE RULES (STRICTLY ENFORCED):
- When asking for confirmation after exploratory questions, ask ONLY the confirmation question
- ABSOLUTELY DO NOT ask about property purpose, location, passport, visa, income, or reserves
- Keep confirmation questions under 20 words
- Wait for user response before asking the next question
- If you catch yourself starting to ask about qualification topics, STOP and ask only for confirmation

EDUCATIONAL RESPONSES:
- Documentation types: "Bank statements, tax returns, employment letters, or business financials work well."
- Down payment requirements: Always 25% minimum for foreign nationals

RESERVE CALCULATION (CRITICAL - AVOID MAGNITUDE ERRORS):
- For reserves, calculate using loan amount (NOT property price)
- Monthly payment ≈ (loan amount × 0.005) for 30-year mortgage estimation
- Loan amount = property price - down payment
- Reserves needed = monthly payment × 6-12 months
- IMPORTANT: $1,000,000 = $1M = one million dollars (NOT billion)
- Example: $1M property with $250k down = $750k loan → $750,000 × 0.005 = $3,750/month → $22,500-$45,000 reserves

NUMBER FORMATTING (CRITICAL - PREVENT MAGNITUDE ERRORS):
- $1,000,000 = $1M = one million dollars (NEVER say $1B or billion)
- $750,000 = $750k = seven hundred fifty thousand dollars
- Always use full numbers in calculations to avoid confusion
- When showing results, format as: $1,000,000 or $1M (never just "1")

LOAN CALCULATIONS:
- Foreign nationals need 25% minimum down payment (75% max LTV)
- Max property price = down payment ÷ 0.25
- Max loan amount = max property price - down payment
- When user wants higher property price, calculate new required down payment
- Example: "For a $1M property, you need $250k down (25%). What's your actual down payment?"

QUALIFICATION RULES:
- Only qualify when ALL 8 pieces collected AND user has no pending questions
- If down payment insufficient for desired property price, guide them to correct amount
- Provide helpful rejection explanations with next steps"""


def extract_entities(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Extract mortgage-related entities from conversation using OpenAI function calling.
    
    Args:
        messages: Full conversation history
    
    Returns:
        Dictionary of extracted entities
    """
    
    # Get the latest user message
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        return {}
    
    latest_message = user_messages[-1]["content"]
    
    # Function definition for entity extraction
    extraction_function = {
        "name": "extract_mortgage_entities",
        "description": "Extract mortgage-related information from user message",
        "parameters": {
            "type": "object",
            "properties": {
                "down_payment": {
                    "type": "number",
                    "description": "Down payment amount in dollars"
                },
                "property_price": {
                    "type": "number", 
                    "description": "Property price in dollars"
                },
                "loan_purpose": {
                    "type": "string",
                    "enum": ["personal", "second", "investment"],
                    "description": "Property purpose: personal=primary residence, second=second home, investment=investment property"
                },
                "property_city": {
                    "type": "string",
                    "description": "City where property is located"
                },
                "property_state": {
                    "type": "string",
                    "description": "State where property is located (2-letter code)"
                },
                "has_valid_passport": {
                    "type": "boolean",
                    "description": "Whether user has valid passport"
                },
                "has_valid_visa": {
                    "type": "boolean", 
                    "description": "Whether user has valid U.S. visa"
                },
                "can_demonstrate_income": {
                    "type": "boolean",
                    "description": "Whether user can provide income documentation"
                },
                "has_reserves": {
                    "type": "boolean",
                    "description": "Whether user has 6-12 months of reserves saved"
                },
                "user_question": {
                    "type": "string",
                    "description": "Any question the user asked that needs an answer (e.g., 'what type of documentation?', 'how much would that be?')"
                },
                "needs_clarification": {
                    "type": "boolean",
                    "description": "True if user is asking questions or seems uncertain about requirements"
                },
                "updated_down_payment": {
                    "type": "number",
                    "description": "New down payment amount if user is adjusting their requirements"
                },
                "updated_property_price": {
                    "type": "number",
                    "description": "New property price if user is exploring different options"
                }
            },
            "additionalProperties": False
        }
    }
    
    try:
        response = client.chat.completions.create(
            model=WORKING_MODEL,
            messages=[
                {"role": "system", "content": """Extract mortgage information from the user's message. Apply intelligent inference:

ENTITY EXTRACTION:
- When a well-known US city is mentioned, automatically include the state (e.g., Miami→FL, NYC→NY, Los Angeles→CA, etc.)
- Extract both explicit and reasonably implied information
- Use common knowledge for geographic relationships

QUESTION DETECTION:
- If user asks ANY question (contains ?, "what", "how", "which", "when", "where", "why"), extract it as user_question
- Common questions: "what type of documentation?", "how much would that be?", "which documents are good?"
- Set needs_clarification=true if user is asking questions or seems uncertain

EXPLORATORY LANGUAGE DETECTION:
- Detect exploratory phrases: "what if", "how much would", "can you calculate", "what about", "suppose I"
- These indicate user is exploring options, not committing to changes
- Always set needs_clarification=true for exploratory language
- Examples: "what if I put down 300k?" "how much would I need for 2M?" "can you calculate for 1.5M?"

ENTITY UPDATES:
- If user mentions a different down payment amount, extract as updated_down_payment
- If user mentions a different property price, extract as updated_property_price
- Detect phrases like "i'd like to buy a 1m property" or "what if I put down 300k"

REJECTION HANDLING:
- If user says "no" to a question about updating values, DO NOT extract any updated amounts
- "no, keep my original" → NO extraction of updated_down_payment or updated_property_price
- "no, that's too much" → NO extraction of updated amounts
- Only extract amounts when user actually provides new specific numbers

EXAMPLES:
- "what type of documentation is good?" → user_question="what type of documentation is good?", needs_clarification=true
- "how much would that be?" → user_question="how much would that be?", needs_clarification=true  
- "i'd like to buy a 1m property" → updated_property_price=1000000
- "what if I put down 300k" → updated_down_payment=300000
- "no, keep my original" → NO extraction of updated amounts"""},
                {"role": "user", "content": f"Extract entities from: '{latest_message}'"}
            ],
            tools=[{"type": "function", "function": extraction_function}],
            tool_choice={"type": "function", "function": {"name": "extract_mortgage_entities"}},
            temperature=1
        )
        
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls and tool_calls[0].function.arguments:
            return json.loads(tool_calls[0].function.arguments)
    
    except Exception as e:
        print(f"Entity extraction error: {e}")
    
    return {}


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
        ("loan_purpose", "Property purpose (primary residence, second home, or investment)"),
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
    
    # LTV calculation (must be ≤ 75% for foreign nationals)
    ltv = (property_price - down_payment) / property_price
    down_pct = down_payment / property_price
    
    if down_pct < 0.25:
        return {
            "qualified": False, 
            "reason": f"Down payment must be ≥25%. You have {down_pct*100:.1f}%",
            "required_down": property_price * 0.25
        }
    
    # Documentation requirements
    if not entities.get("has_valid_passport"):
        errors.append("Valid passport required")
    if not entities.get("has_valid_visa"):
        errors.append("Valid U.S. visa required")
    if not entities.get("can_demonstrate_income"):
        errors.append("Income documentation required")
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


def analyze_user_response_with_llm(user_message: str, assistant_message: str, current_entities: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use LLM to contextually analyze user's response for confirmations, rejections, and value updates.
    
    Args:
        user_message: The user's current message
        assistant_message: The assistant's previous message (for context)
        current_entities: Current conversation entities
    
    Returns:
        Dictionary with confirmation analysis and extracted values
    """
    
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
                    "enum": ["positive", "negative", "neutral"],
                    "description": "positive = accepting/agreeing, negative = rejecting/declining, neutral = unclear"
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
                {"role": "system", "content": """You are analyzing user responses in a mortgage pre-qualification conversation.

CONTEXT UNDERSTANDING:
- Look at the assistant's previous message to understand what the user is responding to
- Determine if the user is confirming, rejecting, or providing new information
- Extract both explicit values and contextual confirmations

CONFIRMATION DETECTION:
- "yes", "sure", "that works", "sounds good" = positive confirmation
- "no", "not really", "I'd rather", "actually..." = negative confirmation  
- Direct statements like "I'll put down 250k" = positive confirmation with new value
- Questions or uncertainty = needs clarification

VALUE EXTRACTION FROM CONTEXT:
- When user says "yes" to assistant's proposal, extract the values from the assistant's message
- Look for phrases like "proceed with $X property and $Y down" or "confirm $Z down payment"
- Extract amounts mentioned in assistant's confirmation questions
- Handle formats: $250k, $250,000, 1M, etc.

EXAMPLES:
Assistant: "Should we proceed with $1M property and $250k down?"
User: "yes" → positive confirmation of both values (extract 1000000 for property_price, 250000 for down_payment)
User: "yes but make it 300k down" → positive confirmation of property, update down payment
User: "actually I want 2M" → negative confirmation, new property price"""},
                {"role": "user", "content": f"""
ASSISTANT'S PREVIOUS MESSAGE: "{assistant_message}"

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
        # Fallback to simple analysis
        return {
            "is_confirmation": False,
            "confirmation_type": "neutral", 
            "confirmed_values": {},
            "new_information": {},
            "reasoning": f"LLM analysis failed: {e}"
        }
    
    return {
        "is_confirmation": False,
        "confirmation_type": "neutral",
        "confirmed_values": {},
        "new_information": {},
        "reasoning": "No analysis result"
    }


def process_conversation_turn(messages: List[Dict[str, str]]) -> str:
    """
    Process a single conversation turn using the simplified architecture.
    
    Args:
        messages: Full conversation history
    
    Returns:
        Assistant response
    """
    
    # Handle initial greeting
    assistant_messages = [m for m in messages if m["role"] == "assistant"]
    if len(assistant_messages) == 0:
        return "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?"
    
    # Get the last user message and analyze it with LLM
    user_messages = [m for m in messages if m["role"] == "user"]
    last_user_message = user_messages[-1]["content"] if user_messages else ""
    last_assistant_content = assistant_messages[-1]["content"] if assistant_messages else ""
    
    # Extract basic entities first to provide context to LLM analysis
    basic_entities = extract_entities(messages)
    
    # Use LLM to analyze the user's response contextually
    llm_analysis = analyze_user_response_with_llm(
        last_user_message, 
        last_assistant_content, 
        basic_entities
    )
    
    is_confirmation = llm_analysis.get("is_confirmation", False)
    is_positive_conf = llm_analysis.get("confirmation_type") == "positive"
    confirmed_values = llm_analysis.get("confirmed_values", {})
    new_information = llm_analysis.get("new_information", {})
    
    print(f">>> Last user message: '{last_user_message}'")
    print(f">>> LLM Analysis: {llm_analysis.get('reasoning', '')}")
    print(f">>> Is confirmation: {is_confirmation} ({llm_analysis.get('confirmation_type', 'neutral')})")
    print(f">>> Confirmed values: {confirmed_values}")
    print(f">>> New information: {new_information}")
    
    # Extract entities from entire conversation with smart merging
    all_entities = {}
    confirmed_entities = {}  # Track explicitly confirmed values throughout the conversation
    temp_messages = []
    latest_extraction = {}
    
    # First pass: identify all confirmations throughout the conversation history
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and i > 0:  # Skip first message, need assistant context
            # Get assistant's previous message for context
            prev_assistant_msg = ""
            for j in range(i-1, -1, -1):
                if messages[j]["role"] == "assistant":
                    prev_assistant_msg = messages[j]["content"]
                    break
            
            # Analyze this user message for confirmations
            if prev_assistant_msg:
                temp_analysis = analyze_user_response_with_llm(
                    msg["content"], 
                    prev_assistant_msg, 
                    all_entities
                )
                
                # If this is a positive confirmation, store the confirmed values
                # Later confirmations overwrite earlier ones (more recent = more accurate)
                if temp_analysis.get("is_confirmation") and temp_analysis.get("confirmation_type") == "positive":
                    temp_confirmed = temp_analysis.get("confirmed_values", {})
                    for field, value in temp_confirmed.items():
                        if value is not None:
                            if field in confirmed_entities:
                                print(f">>> [HISTORY SCAN] Updating confirmed {field}: {confirmed_entities[field]} → {value} (from: '{msg['content']}')")
                            else:
                                print(f">>> [HISTORY SCAN] Found confirmed {field}: {value} (from: '{msg['content']}')")
                            confirmed_entities[field] = value  # Later confirmations overwrite earlier ones
    
    # Second pass: extract entities with confirmed values protection
    for msg in messages:
        temp_messages.append(msg)
        if msg["role"] == "user":
            extracted = extract_entities(temp_messages)
            
            # Use smart merging instead of simple update, prioritizing confirmed values
            all_entities = smart_merge_entities(all_entities, extracted, confirmed_entities)
            latest_extraction = extracted  # Keep track of latest message extraction
            
            # If this is the current message and it's a positive confirmation, apply confirmed values
            if is_confirmation and is_positive_conf and msg["content"] == last_user_message:
                # Store confirmed values in the confirmed_entities tracker
                for field, value in confirmed_values.items():
                    if value is not None:
                        confirmed_entities[field] = value
                        all_entities[field] = value
                        print(f">>> [CURRENT CONFIRMATION] Confirmed and applied {field}: {value}")
                
                # Remove any updated_ fields that were just confirmed
                for field in ["down_payment", "property_price"]:
                    updated_field = f"updated_{field}"
                    if field in confirmed_values and updated_field in all_entities:
                        del all_entities[updated_field]
                        print(f">>> [CURRENT CONFIRMATION] Cleaned up {updated_field}")
                
                # Also promote any updated fields that exist but weren't specifically confirmed
                # BUT only if we don't already have a confirmed value from history scan
                if "updated_down_payment" in all_entities and "down_payment" not in confirmed_values:
                    promoted_value = all_entities["updated_down_payment"]
                    # Don't overwrite confirmed values from history scan
                    if "down_payment" not in confirmed_entities:
                        confirmed_entities["down_payment"] = promoted_value  # Mark as confirmed
                        all_entities["down_payment"] = promoted_value
                        print(f">>> [CURRENT CONFIRMATION] Promoted and confirmed updated_down_payment: ${promoted_value:,}")
                    else:
                        print(f">>> [CURRENT CONFIRMATION] Skipping promotion of updated_down_payment: ${promoted_value:,} (already confirmed: ${confirmed_entities['down_payment']:,})")
                    del all_entities["updated_down_payment"]
                
                if "updated_property_price" in all_entities and "property_price" not in confirmed_values:
                    promoted_value = all_entities["updated_property_price"]
                    # Don't overwrite confirmed values from history scan
                    if "property_price" not in confirmed_entities:
                        confirmed_entities["property_price"] = promoted_value  # Mark as confirmed
                        all_entities["property_price"] = promoted_value
                        print(f">>> [CURRENT CONFIRMATION] Promoted and confirmed updated_property_price: ${promoted_value:,}")
                    else:
                        print(f">>> [CURRENT CONFIRMATION] Skipping promotion of updated_property_price: ${promoted_value:,} (already confirmed: ${confirmed_entities['property_price']:,})")
                    del all_entities["updated_property_price"]
    
    # Apply new information from LLM analysis (outside of confirmation context)
    if not is_confirmation:
        # Apply new information extracted by LLM
        for field, value in new_information.items():
            if value is not None and field != "user_question" and field != "needs_clarification":
                all_entities[field] = value
                print(f">>> [NEW INFO] Applied {field}: {value}")
        
        # Handle entity updates (when user changes requirements) - legacy fallback
        if "updated_down_payment" in latest_extraction and latest_extraction["updated_down_payment"] is not None:
            all_entities["down_payment"] = latest_extraction["updated_down_payment"]
            print(f">>> [LEGACY] Updated down payment to: ${latest_extraction['updated_down_payment']:,}")
        
        if "updated_property_price" in latest_extraction and latest_extraction["updated_property_price"] is not None:
            all_entities["property_price"] = latest_extraction["updated_property_price"]
            print(f">>> [LEGACY] Updated property price to: ${latest_extraction['updated_property_price']:,}")
    
    # Ensure all confirmed entities are applied to final entities
    for field, value in confirmed_entities.items():
        all_entities[field] = value
        
    print(f">>> Final entities: {all_entities}")
    print(f">>> Confirmed entities: {confirmed_entities}")
    print(f">>> Latest extraction: {latest_extraction}")
    
    # Check if user has a pending question that needs answering (use LLM analysis when available)
    user_question = None
    needs_clarification = False
    
    if not is_confirmation:
        # Use LLM analysis first, fallback to extraction
        user_question = new_information.get("user_question") or latest_extraction.get("user_question")
        needs_clarification = new_information.get("needs_clarification", False) or latest_extraction.get("needs_clarification", False)
    
    # Check if all information is collected
    missing_info_context = get_missing_information_context(all_entities)
    
    # Check if we have all required information
    required_fields = ["down_payment", "property_price", "loan_purpose", "property_city", "has_valid_passport", "has_valid_visa", "can_demonstrate_income", "has_reserves"]
    all_complete = all(field in all_entities and all_entities[field] is not None for field in required_fields)
    
    # Don't qualify if user has pending questions or needs clarification (unless they just confirmed)
    if all_complete and not needs_clarification and not user_question:
        # CRITICAL: Ensure confirmed values override everything else before qualification
        print(f">>> [PRE-QUALIFICATION] Before override - all_entities: {all_entities}")
        print(f">>> [PRE-QUALIFICATION] Confirmed entities: {confirmed_entities}")
        
        # Validate and fix entity mismatches
        for field in ['down_payment', 'property_price']:
            if field in confirmed_entities and field in all_entities:
                if confirmed_entities[field] != all_entities[field]:
                    print(f">>> [WARNING] Entity mismatch for {field}: confirmed={confirmed_entities[field]}, using={all_entities[field]}")
                    all_entities[field] = confirmed_entities[field]  # Force correction
                    print(f">>> [FIXED] Corrected {field} to confirmed value: {confirmed_entities[field]}")
        
        # Final override: ensure all confirmed entities are applied
        for field, value in confirmed_entities.items():
            all_entities[field] = value
            print(f">>> [PRE-QUALIFICATION] Applied confirmed {field}: {value}")
        
        print(f">>> [PRE-QUALIFICATION] Final entities for qualification: {all_entities}")
        
        # All info collected and no pending questions - provide qualification decision
        qualification = calculate_qualification(all_entities)
        
        if qualification["qualified"]:
            return f"""Congratulations! You're pre-qualified for a foreign national mortgage.

Loan amount: ${qualification['max_loan_amount']:,}
LTV: {qualification['ltv']}
Down payment: {qualification['down_payment_pct']}

A loan officer will contact you within 2 business days to proceed."""
        else:
            return f"Unfortunately, you don't qualify at this time. {qualification['reason']}"
    
    # Enhanced prompt with question handling and entity updates
    conversation_context = "\n".join([f"{m['role']}: {m['content']}" for m in messages[-4:]])
    
    # Build prompt based on current situation
    prompt_parts = ["You are a mortgage pre-qualification assistant."]
    
    # Check if we're waiting for confirmation from a previous question
    last_assistant_msg = ""
    if assistant_messages:
        last_assistant_msg = assistant_messages[-1]["content"]
    
    waiting_for_confirmation = (last_assistant_msg and "?" in last_assistant_msg and 
                               any(phrase in last_assistant_msg.lower() for phrase in 
                                   ["would you like", "should i", "proceed with", "confirm", "is that correct", "which option"]))
    
    # If user asked a question, prioritize answering it and enforce confirmation protocol
    if user_question:
        prompt_parts.append(f"CRITICAL: USER ASKED QUESTION: '{user_question}' - Answer the question first, then ask ONLY ONE confirmation question related to that topic. YOU MUST NOT ask about property purpose, location, passport, visa, income, or reserves until they confirm their choice. STOP after the confirmation question.")
    
    # If we're waiting for confirmation, handle the user's response
    elif waiting_for_confirmation:
        prompt_parts.append("User is responding to your confirmation question. Process their response and either update values or continue with current ones, then ask the next qualification question.")
    
    # If entity was updated, acknowledge the change
    elif "updated_down_payment" in latest_extraction or "updated_property_price" in latest_extraction:
        prompt_parts.append("User updated their requirements. Acknowledge the change and ask ONE CLEAR confirmation question. CONFIRMATION MODE: Ask ONLY for confirmation. Do NOT ask about other topics until they confirm.")
    
    # Add validation warning for down payment
    has_down_payment = 'down_payment' in all_entities and all_entities['down_payment'] is not None
    has_property_price = 'property_price' in all_entities and all_entities['property_price'] is not None
    
    if has_down_payment and not has_property_price:
        prompt_parts.append("CRITICAL: User provided down payment but NO property price yet. Do NOT validate down payment percentage. Simply ask for property price next.")
    elif has_down_payment and has_property_price:
        down_pct = all_entities['down_payment'] / all_entities['property_price']
        if down_pct < 0.25:
            prompt_parts.append(f"VALIDATION: Down payment is {down_pct*100:.1f}% (need 25%). User must adjust EITHER down payment up OR property price down.")
        else:
            prompt_parts.append(f"VALIDATION: Down payment is {down_pct*100:.1f}% (sufficient ≥25%). Proceed to next question.")
    
    prompt_parts.extend([
        f"\nCONVERSATION:\n{conversation_context}",
        f"\nCOLLECTED INFO:\n{missing_info_context}",
        "\nRespond helpfully and ask for the next missing information. Keep responses under 30 words."
    ])
    
    prompt = "\n".join(prompt_parts)
    
    try:
        print(f">>> Sending to OpenAI - Model: {WORKING_MODEL}")
        print(f">>> Prompt length: {len(prompt)}")
        
        response = client.chat.completions.create(
            model=WORKING_MODEL,
            messages=[
                {"role": "system", "content": MASTER_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=1,
            max_completion_tokens=100
        )
        
        result = response.choices[0].message.content
        print(f">>> OpenAI raw response: '{result}'")
        
        if not result or not result.strip():
            print(">>> WARNING: OpenAI returned empty response!")
            return "I understand. What's the property price you're considering?"
        
        return result.strip()
    
    except Exception as e:
        print(f"Response generation error: {e}")
        return "Sorry, I'm having trouble processing your response. Could you please try again?"