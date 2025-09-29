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

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

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
            model=MODEL,
            messages=[
                {"role": "system", "content": "Extract mortgage information from the user's message. Only include information explicitly mentioned."},
                {"role": "user", "content": f"Extract entities from: '{latest_message}'"}
            ],
            functions=[extraction_function],
            function_call={"name": "extract_mortgage_entities"},
            temperature=0.1
        )
        
        function_call = response.choices[0].message.function_call
        if function_call and function_call.arguments:
            return json.loads(function_call.arguments)
    
    except Exception as e:
        print(f"Entity extraction error: {e}")
    
    return {}


def determine_next_question(filled_entities: Dict[str, Any]) -> Optional[str]:
    """
    Determine which question to ask next based on filled entities.
    
    Args:
        filled_entities: Currently filled information
    
    Returns:
        Next question to ask, or None if all complete
    """
    
    # Priority order for questions
    question_order = [
        ("down_payment", "How much can you put down for the down payment?"),
        ("property_price", "What's the price of the property you're interested in?"),
        ("loan_purpose", "Will this be your primary residence, second home, or investment property?"),
        ("property_city", "What city is the property in?"),
        ("property_state", "What state is that in?"),
        ("has_valid_passport", "Do you have a valid passport?"),
        ("has_valid_visa", "Do you have a valid U.S. visa?"),
        ("can_demonstrate_income", "Can you provide income documentation?"),
        ("has_reserves", "Do you have 6-12 months of mortgage payments saved in reserves?")
    ]
    
    for field, question in question_order:
        if field not in filled_entities or filled_entities[field] is None:
            return question
    
    return None  # All questions answered


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
    next_question = determine_next_question(all_entities)
    
    if next_question is None:
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
    
    # Use OpenAI to generate natural response + next question
    conversation_context = "\n".join([f"{m['role']}: {m['content']}" for m in messages[-4:]])  # Last 4 messages for context
    
    # Check if user is asking about loan amounts or affordability
    user_messages = [m for m in messages if m["role"] == "user"]
    latest_user_msg = user_messages[-1]["content"].lower() if user_messages else ""
    
    is_asking_loan_question = any(phrase in latest_user_msg for phrase in [
        "how much can you lend", "loan amount", "how much loan", "can i borrow",
        "what can i afford", "depends on the loan", "how much mortgage"
    ])
    
    # Add affordability context if down payment is known
    affordability_context = ""
    if "down_payment" in all_entities and is_asking_loan_question:
        down_payment = all_entities["down_payment"]
        max_property_price = down_payment / 0.25
        max_loan = max_property_price - down_payment
        affordability_context = f"\nAFfordability calculation: With ${down_payment:,.0f} down payment, max property price is ${max_property_price:,.0f} (max loan ${max_loan:,.0f})."
    
    if is_asking_loan_question and affordability_context:
        prompt = f"""Based on this conversation:
{conversation_context}

The user is asking about loan amounts or affordability.{affordability_context}

Provide a helpful answer with the specific calculations, then ask: "{next_question}"

Be direct and helpful. Calculate and state the exact numbers, then ask the question."""
    else:
        prompt = f"""Based on this conversation:
{conversation_context}

The user just provided information. Acknowledge what they said briefly (1 sentence max), then ask: "{next_question}"

Be natural and conversational but direct. Always end with the exact question provided."""
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": MASTER_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=100
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        print(f"Response generation error: {e}")
        return f"Thank you. {next_question}"