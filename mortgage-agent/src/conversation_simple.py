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
    check_environment
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
                {"role": "system", "content": """Extract mortgage information from the user's message only if entities are present. Apply intelligent inference:

IMPORTANT: Only call the function if there are actual entities to extract. For pure clarification questions like "what do you mean by status?", don't call the function.

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
            tool_choice="auto",  # Changed from forced to auto - prevents crashes on clarification questions
            temperature=1
        )
        
        # Handle both function call and regular responses
        tool_calls = response.choices[0].message.tool_calls
        extracted = {}
        if tool_calls and tool_calls[0].function.arguments:
            extracted = json.loads(tool_calls[0].function.arguments)
        else:
            # No function call - indicates no entities were found (which is normal for clarification questions)
            extracted = {}
        
        # Post-process: Handle percentage inputs for down payment
        extracted = handle_percentage_inputs(latest_message, extracted, messages)
        
        # Post-process: Improve location extraction (only in location context)
        if is_location_context(messages):
            print(f">>> [CONTEXT] Location context detected - running extraction")
            extracted = enhance_location_extraction(latest_message, extracted)
        else:
            print(f">>> [CONTEXT] No location context - skipping extraction")
        
        return extracted
    
    except Exception as e:
        print(f"Entity extraction error: {e}")
    
    return {}


def handle_percentage_inputs(latest_message: str, extracted: Dict[str, Any], messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Handle percentage inputs for down payment by converting them to dollar amounts.
    
    Args:
        latest_message: The user's current message
        extracted: Currently extracted entities
        messages: Full conversation history to find property price
    
    Returns:
        Updated extracted entities with percentage converted to dollars
    """
    import re
    
    # Check if user mentioned a percentage
    percentage_match = re.search(r'(\d+(?:\.\d+)?)\s*%', latest_message)
    if not percentage_match:
        return extracted
    
    percentage_value = float(percentage_match.group(1))
    print(f">>> [PERCENTAGE] Detected {percentage_value}% in user input")
    
    # Find property price from conversation history or current extraction
    property_price = None
    
    # First check if property price is in current extraction
    if 'property_price' in extracted and extracted['property_price']:
        property_price = extracted['property_price']
    else:
        # Look through conversation history for property price
        temp_messages = []
        for msg in messages:
            temp_messages.append(msg)
            if msg["role"] == "user":
                temp_extracted = extract_entities_basic(temp_messages)
                if 'property_price' in temp_extracted and temp_extracted['property_price']:
                    property_price = temp_extracted['property_price']
                    break
    
    if property_price:
        # Convert percentage to dollar amount
        dollar_amount = property_price * (percentage_value / 100)
        extracted['down_payment'] = dollar_amount
        print(f">>> [PERCENTAGE] Converted {percentage_value}% of ${property_price:,} = ${dollar_amount:,}")
    else:
        print(f">>> [PERCENTAGE] Cannot convert {percentage_value}% - no property price available")
    
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


def extract_entities_basic(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Basic entity extraction without percentage handling to avoid recursion.
    Used internally by handle_percentage_inputs.
    """
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        return {}
    
    latest_message = user_messages[-1]["content"]
    
    # Simple regex-based extraction for property price
    property_price_patterns = [
        r'\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|thousand)',  # $500k
        r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*k',                # 500k
        r'\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:m|million)',  # $1m
        r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:m|million)',    # 1 million
        r'\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)',                  # $500000
        r'(\d{3,})'                                           # 500000
    ]
    
    for pattern in property_price_patterns:
        match = re.search(pattern, latest_message.lower())
        if match:
            amount_str = match.group(1).replace(',', '')
            amount = float(amount_str)
            
            # Apply multipliers
            if 'k' in latest_message.lower() or 'thousand' in latest_message.lower():
                amount *= 1000
            elif 'm' in latest_message.lower() or 'million' in latest_message.lower():
                amount *= 1000000
            
            # Only consider amounts that could be property prices (>= $50k)
            if amount >= 50000:
                return {'property_price': amount}
    
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

EXAMPLES:
Assistant: "Should we proceed with $1M property and $250k down?"
User: "yes" → positive confirmation of both values (extract 1000000 for property_price, 250000 for down_payment)
User: "yes but make it 300k down" → positive confirmation of property, update down payment to 300000
User: "yes adjust" → positive confirmation, but flag that user wants to make changes
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
    
    # Only analyze the last 6 messages (3 exchanges) to prevent exponential slowdown
    recent_messages = messages[-6:] if len(messages) > 6 else messages
    
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
def process_conversation_turn(messages: List[Dict[str, str]], conversation_id: str = None) -> str:
    """
    Process a single conversation turn using the simplified architecture.
    
    Args:
        messages: Full conversation history
    
    Returns:
        Assistant response
    """
    import time
    
    # Initialize metrics tracking
    start_time = time.time()
    api_call_count = 0
    total_tokens_used = 0
    cached_tokens_used = 0
    
    # TIMEOUT PROTECTION: Maximum processing time to prevent gateway timeouts
    MAX_PROCESSING_TIME = 10.0  # seconds - well under Render's 30s limit
    
    def check_timeout():
        elapsed = time.time() - start_time
        if elapsed > MAX_PROCESSING_TIME:
            logger.log(f"Timeout protection triggered after {elapsed:.1f}s", 'WARNING')
            return True
        return False
    
    # Log conversation state
    log_conversation_state(messages, "Starting conversation processing")
    
    # Handle initial greeting
    assistant_messages = [m for m in messages if m["role"] == "assistant"]
    if len(assistant_messages) == 0:
        logger.log("No assistant messages - returning initial greeting", 'INFO')
        return "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?"
    
    # Get the last user message and analyze it with LLM
    user_messages = [m for m in messages if m["role"] == "user"]
    last_user_message = user_messages[-1]["content"] if user_messages else ""
    last_assistant_content = assistant_messages[-1]["content"] if assistant_messages else ""
    
    # FAST-PATH: Handle simple confirmations and property types without API calls to prevent timeouts
    simple_confirmations = ["ok yes", "yes", "sure", "ok", "sounds good", "that works", "i agree"]
    property_types = {
        "investment": "investment",
        "investment property": "investment", 
        "rental": "investment",
        "rental property": "investment",
        "primary": "primary_residence",
        "primary residence": "primary_residence",
        "live in": "primary_residence",
        "own home": "primary_residence",
        "main home": "primary_residence",
        "second home": "second_home",
        "vacation": "second_home",
        "vacation home": "second_home",
        "holiday home": "second_home"
    }
    
    user_msg_clean = last_user_message.lower().strip()
    
    # DEBUG: Log assistant message content for fast-path debugging
    logger.log(f"Fast-path debug: user='{user_msg_clean}', assistant='{last_assistant_content[:50]}...'", 'DEBUG')
    
    # Fast-path for property purpose responses
    property_purpose_patterns = [
        "property purpose",
        "property's purpose", 
        "purpose of the property",
        "property: primary residence"
    ]
    assistant_mentions_property_purpose = any(pattern in last_assistant_content.lower() for pattern in property_purpose_patterns)
    
    if assistant_mentions_property_purpose and user_msg_clean in property_types:
        property_type = property_types[user_msg_clean]
        logger.log(f"Fast-path: Property type '{user_msg_clean}' -> {property_type}", 'INFO')
        
        # Note: Property purpose will be saved later in the normal flow
        
        # Move to next question based on property type
        if property_type == "investment":
            return "Thanks! For investment properties, you'll typically need 20-25% down. Do you have good credit (score 700+)?"
        else:
            return "Perfect! Do you have good credit (score 700+)?"
    
    # Fast-path for simple confirmations
    if user_msg_clean in simple_confirmations:
        # Determine what was being confirmed based on assistant's last message
        if "would you like to adjust" in last_assistant_content.lower():
            logger.log("Fast-path: Simple confirmation to down payment adjustment", 'INFO')
            return "Great! What's the property purpose: primary residence, second home, or investment?"
        elif "minimum down payment" in last_assistant_content.lower():
            logger.log("Fast-path: Simple confirmation to minimum down payment question", 'INFO')
            return "Perfect! What's the property purpose: primary residence, second home, or investment?"
        elif "property price" in last_assistant_content.lower():
            logger.log("Fast-path: Simple confirmation to property price", 'INFO')
            # Need to extract values for validation but can use fast logic
            pass  # Fall through to normal processing for price validation
        # Add more fast-path patterns as needed
    
    # UNIVERSAL FAST-PATH: Handle obvious entity values without heavy processing
    obvious_values = {
        # Credit scores
        "excellent": {"credit_score": "excellent"},
        "good": {"credit_score": "good"}, 
        "fair": {"credit_score": "fair"},
        "poor": {"credit_score": "poor"},
        
        # Income patterns (simple cases)
        "unemployed": {"employment_status": "unemployed"},
        "retired": {"employment_status": "retired"},
        "self employed": {"employment_status": "self_employed"},
        
        # Simple yes/no for existing customers
        "new customer": {"existing_customer": False},
        "existing customer": {"existing_customer": True},
        
        # Other obvious answers
        "no": {"generic_no": True},
        "none": {"generic_none": True}
    }
    
    if user_msg_clean in obvious_values:
        entity_data = obvious_values[user_msg_clean]
        logger.log(f"Fast-path: Obvious value '{user_msg_clean}' -> {entity_data}", 'INFO')
        
        # Note: Entity data will be saved later in the normal flow
        
        # Return appropriate response based on what was confirmed
        if "credit_score" in entity_data:
            return "Great! What's your approximate annual income?"
        elif "employment_status" in entity_data:
            return "Thanks for that information. What else would you like me to know?"
        else:
            return "I understand. What's the next piece of information you'd like to provide?"
    
    log_processing_step("Extracting basic entities")
    # Extract basic entities first to provide context to LLM analysis
    basic_entities = extract_entities(messages)
    log_entity_state(basic_entities, {}, "After basic extraction")
    
    # TIMING: Basic extraction checkpoint
    basic_extraction_time = time.time() - start_time
    logger.log(f"⏱️  Basic extraction completed in {basic_extraction_time:.2f}s", 'INFO')
    
    # Use LLM to analyze the user's response contextually
    llm_analysis = analyze_user_response_with_llm(
        last_user_message, 
        last_assistant_content, 
        basic_entities
    )
    
    is_confirmation = llm_analysis.get("is_confirmation", False)
    confirmation_type = llm_analysis.get("confirmation_type", "neutral")
    
    # Handle compound response types as positive confirmations with special handling
    positive_types = ["positive", "positive_with_adjustment", "positive_with_condition"]
    is_positive_conf = confirmation_type in positive_types
    is_compound_response = confirmation_type in ["positive_with_adjustment", "negative_with_alternative", "positive_with_condition"]
    
    confirmed_values = llm_analysis.get("confirmed_values", {})
    new_information = llm_analysis.get("new_information", {})
    
    # TIMING: LLM analysis checkpoint
    llm_analysis_time = time.time() - start_time
    logger.log(f"⏱️  LLM analysis completed in {llm_analysis_time:.2f}s", 'INFO')
    
    print(f">>> Last user message: '{last_user_message}'")
    print(f">>> LLM Analysis: {llm_analysis.get('reasoning', '')}")
    print(f">>> Is confirmation: {is_confirmation} ({confirmation_type})")
    print(f">>> Is compound response: {is_compound_response}")
    print(f">>> Confirmed values: {confirmed_values}")
    print(f">>> New information: {new_information}")
    
    # Extract entities from entire conversation with smart merging
    all_entities = {}
    confirmed_entities = {}  # Track explicitly confirmed values throughout the conversation
    temp_messages = []
    latest_extraction = {}
    
    # First pass: identify all confirmations throughout the conversation history
    if USE_BATCHED_ANALYSIS:
        # Check timeout before expensive batched analysis
        if check_timeout():
            logger.log("Timeout: Skipping batched analysis", 'WARNING')
            return "I understand. Could you please tell me the property purpose: primary residence, second home, or investment?"
        
        # BATCHED APPROACH: Analyze all history in single API call (leverages OpenAI caching)
        logger.log(f"Using batched analysis for {len(messages)} messages", 'INFO')
        batched_results, batch_usage = analyze_conversation_history_batched(messages, all_entities)
        
        # Track API usage from batched analysis
        api_call_count += 1
        total_tokens_used += batch_usage.get('total_tokens', 0)
        cached_tokens_used += batch_usage.get('cached_tokens', 0)
        
        # Process batched results to build confirmed_entities
        for msg_index, analysis in batched_results.items():
            msg = messages[msg_index]
            temp_confirmation_type = analysis.get("confirmation_type", "neutral")
            is_positive_temp = temp_confirmation_type in ["positive", "positive_with_adjustment", "positive_with_condition"]
            
            if analysis.get("is_confirmation") and is_positive_temp:
                temp_confirmed = analysis.get("confirmed_values", {})
                for field, value in temp_confirmed.items():
                    if value is not None:
                        if field in confirmed_entities:
                            print(f">>> [BATCHED SCAN] Updating confirmed {field}: {confirmed_entities[field]} → {value} (from: '{msg['content']}')")
                        else:
                            print(f">>> [BATCHED SCAN] Found confirmed {field}: {value} (from: '{msg['content']}')")
                        confirmed_entities[field] = value
    
    # TIMING: Batched analysis checkpoint
    if USE_BATCHED_ANALYSIS:
        batched_analysis_time = time.time() - start_time
        logger.log(f"⏱️  Batched analysis completed in {batched_analysis_time:.2f}s", 'INFO')
    else:
        # LEGACY APPROACH: Per-message analysis (expensive - for rollback only)
        logger.log(f"Using legacy per-message analysis for {len(messages)} messages", 'WARNING')
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
                    
                    # If this is a positive confirmation (including compound types), store the confirmed values
                    # Later confirmations overwrite earlier ones (more recent = more accurate)
                    temp_confirmation_type = temp_analysis.get("confirmation_type", "neutral")
                    is_positive_temp = temp_confirmation_type in ["positive", "positive_with_adjustment", "positive_with_condition"]
                    if temp_analysis.get("is_confirmation") and is_positive_temp:
                        temp_confirmed = temp_analysis.get("confirmed_values", {})
                        for field, value in temp_confirmed.items():
                            if value is not None:
                                if field in confirmed_entities:
                                    print(f">>> [HISTORY SCAN] Updating confirmed {field}: {confirmed_entities[field]} → {value} (from: '{msg['content']}')")
                                else:
                                    print(f">>> [HISTORY SCAN] Found confirmed {field}: {value} (from: '{msg['content']}')")
                                confirmed_entities[field] = value  # Later confirmations overwrite earlier ones
    
    # OPTIMIZED: Use only the current message extraction + batched analysis results
    # The batched analysis already found all confirmed values - no need for redundant API calls
    
    # Extract entities from ONLY the current message (not entire conversation)
    latest_extraction = basic_entities
    
    # Start with basic entities and merge in confirmed values from batched analysis
    all_entities = basic_entities.copy()
    
    # Apply all confirmed values from batched analysis
    for field, value in confirmed_entities.items():
        all_entities[field] = value
        print(f">>> [BATCHED] Applied confirmed {field}: {value}")
    
    # If current message is a positive confirmation, apply confirmed values from LLM analysis
    if is_confirmation and is_positive_conf:
        for field, value in confirmed_values.items():
            if value is not None:
                confirmed_entities[field] = value
                all_entities[field] = value
                print(f">>> [CURRENT CONFIRMATION] Confirmed and applied {field}: {value}")
        
        # Clean up any updated_ fields that were just confirmed
        for field in ["down_payment", "property_price"]:
            updated_field = f"updated_{field}"
            if field in confirmed_values and updated_field in all_entities:
                del all_entities[updated_field]
                print(f">>> [CURRENT CONFIRMATION] Cleaned up {updated_field}")
        
        # Promote updated fields only if not already confirmed
        if "updated_down_payment" in all_entities and "down_payment" not in confirmed_values:
            promoted_value = all_entities["updated_down_payment"]
            if "down_payment" not in confirmed_entities:
                confirmed_entities["down_payment"] = promoted_value
                all_entities["down_payment"] = promoted_value
                print(f">>> [CURRENT CONFIRMATION] Promoted and confirmed updated_down_payment: ${promoted_value:,}")
            else:
                print(f">>> [CURRENT CONFIRMATION] Skipping promotion of updated_down_payment: ${promoted_value:,} (already confirmed: ${confirmed_entities['down_payment']:,})")
            del all_entities["updated_down_payment"]
        
        if "updated_property_price" in all_entities and "property_price" not in confirmed_values:
            promoted_value = all_entities["updated_property_price"]
            if "property_price" not in confirmed_entities:
                confirmed_entities["property_price"] = promoted_value
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
    
    # TIMING: Entity processing checkpoint
    entity_processing_time = time.time() - start_time
    logger.log(f"⏱️  Entity processing completed in {entity_processing_time:.2f}s", 'INFO')
    
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
        # Final timeout check before expensive OpenAI call
        if check_timeout():
            logger.log("Timeout: Using fallback response instead of OpenAI call", 'WARNING')
            return "I understand. What's the next piece of information you'd like to provide?"
        
        print(f">>> Sending to OpenAI - Model: {WORKING_MODEL}")
        print(f">>> Prompt length: {len(prompt)}")
        
        log_processing_step("Making final OpenAI API call for response generation")
        logger.log(f"Using model: {WORKING_MODEL}, prompt length: {len(prompt)}", 'INFO')
        
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
        
        # Log API metrics before returning
        end_time = time.time()
        response_time_ms = (end_time - start_time) * 1000
        
        log_api_metrics({
            "message_count": len(messages),
            "call_count": api_call_count,
            "usage": {
                "total_tokens": total_tokens_used,
                "cached_tokens": cached_tokens_used
            },
            "response_time_ms": response_time_ms,
            "approach": "batched" if USE_BATCHED_ANALYSIS else "legacy"
        })
        
        return result.strip()
    
    except Exception as e:
        # Log metrics even for errors
        end_time = time.time()
        response_time_ms = (end_time - start_time) * 1000
        
        log_api_metrics({
            "message_count": len(messages),
            "call_count": api_call_count,
            "usage": {
                "total_tokens": total_tokens_used,
                "cached_tokens": cached_tokens_used
            },
            "response_time_ms": response_time_ms,
            "approach": "batched" if USE_BATCHED_ANALYSIS else "legacy",
            "error": str(e)
        })
        
        print(f"Response generation error: {e}")
        return "Sorry, I'm having trouble processing your response. Could you please try again?"