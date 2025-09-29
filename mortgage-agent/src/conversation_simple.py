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
1. Down payment amount (minimum 25% required)
2. Property price 
3. Property purpose: primary residence, second home, or investment
4. Property location (city and state)
5. Valid passport status
6. Valid U.S. visa status  
7. Income documentation capability
8. Financial reserves (6-12 months of payments saved)

Guidelines:
- Be direct, professional, and concise
- Start with: "I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?"
- ALWAYS end every response with the next relevant question
- Extract any information provided and acknowledge it briefly
- Ask one question at a time in logical order
- Don't use phrases like "great", "excellent", "wonderful"
- Keep responses under 2 sentences plus the question

IMPORTANT - When users ask about loan amounts or affordability:
- Foreign nationals need 25% minimum down payment (75% max LTV)
- Calculate: Max property price = down payment ÷ 0.25
- Calculate: Max loan amount = max property price - down payment
- Provide these calculations when asked, then ask for their property price preference
- Example: "With $200k down, you can buy up to $800k (max loan $600k). What price are you considering?"

When you have all 8 pieces of information, provide a qualification decision."""


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
- When a well-known US city is mentioned, automatically include the state (e.g., Miami→FL, NYC→NY, Los Angeles→CA, Chicago→IL, Houston→TX, Phoenix→AZ, Philadelphia→PA, San Antonio→TX, San Diego→CA, Dallas→TX, San Jose→CA, Austin→TX, Jacksonville→FL, San Francisco→CA, Columbus→OH, Indianapolis→IN, Charlotte→NC, Seattle→WA, Denver→CO, Boston→MA, Detroit→MI, Nashville→TN, Portland→OR, Las Vegas→NV, Memphis→TN, Baltimore→MD, Milwaukee→WI, Albuquerque→NM, Tucson→AZ, Fresno→CA, Sacramento→CA, Kansas City→MO, Atlanta→GA, Miami Beach→FL, Orlando→FL, Tampa→FL)
- Extract both explicit and reasonably implied information
- Use common knowledge for geographic relationships"""},
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
    
    # Extract entities from entire conversation
    all_entities = {}
    temp_messages = []
    
    for msg in messages:
        temp_messages.append(msg)
        if msg["role"] == "user":
            extracted = extract_entities(temp_messages)
            all_entities.update(extracted)
    
    print(f">>> Extracted entities: {all_entities}")
    
    # Check if all information is collected
    missing_info_context = get_missing_information_context(all_entities)
    
    # Check if we have all required information
    required_fields = ["down_payment", "property_price", "loan_purpose", "property_city", "has_valid_passport", "has_valid_visa", "can_demonstrate_income", "has_reserves"]
    all_complete = all(field in all_entities and all_entities[field] is not None for field in required_fields)
    
    if all_complete:
        # All info collected - provide qualification decision
        qualification = calculate_qualification(all_entities)
        
        if qualification["qualified"]:
            return f"""Congratulations! You're pre-qualified for a foreign national mortgage.

Loan amount: ${qualification['max_loan_amount']:,}
LTV: {qualification['ltv']}
Down payment: {qualification['down_payment_pct']}

A loan officer will contact you within 2 business days to proceed."""
        else:
            return f"Unfortunately, you don't qualify at this time. {qualification['reason']}"
    
    # Simplified prompt for GPT-5
    conversation_context = "\n".join([f"{m['role']}: {m['content']}" for m in messages[-4:]])
    
    prompt = f"""You are a mortgage pre-qualification assistant. Respond naturally and ask for the next missing information.

CONVERSATION:
{conversation_context}

COLLECTED INFO:
{missing_info_context}

Next, ask for one missing piece of information in a conversational way. Keep responses under 20 words."""
    
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