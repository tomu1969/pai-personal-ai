"""
================================================================================
LLM_EXTRACTION.PY - OPENAI FUNCTION CALLING FOR ACCURATE EXTRACTION
================================================================================

Uses OpenAI structured outputs to extract mortgage application data.
More accurate than regex, handles context and natural language.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


# Unambiguous major cities that don't need state clarification
CITY_TO_STATE = {
    "miami": "FL",
    "orlando": "FL",
    "tampa": "FL",
    "jacksonville": "FL",
    "dallas": "TX",
    "houston": "TX",
    "austin": "TX",
    "san antonio": "TX",
    "seattle": "WA",
    "boston": "MA",
    "denver": "CO",
    "atlanta": "GA",
    "phoenix": "AZ",
    "las vegas": "NV",
    "portland": "OR",
    "detroit": "MI",
    "minneapolis": "MN",
    "nashville": "TN",
    "memphis": "TN",
    "milwaukee": "WI",
    "albuquerque": "NM",
    "tucson": "AZ",
    "baltimore": "MD",
    "philadelphia": "PA",
    "pittsburgh": "PA",
    "indianapolis": "IN",
    "charlotte": "NC",
    "raleigh": "NC",
    "chicago": "IL",
    "new york": "NY",
    "los angeles": "CA",
    "san francisco": "CA",
    "san diego": "CA",
    "san jose": "CA",
    "sacramento": "CA"
}


# Valid US state codes
US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
]


EXTRACTION_FUNCTIONS = [
    {
        "name": "extract_mortgage_data",
        "description": "Extract mortgage pre-qualification information from user message",
        "parameters": {
            "type": "object",
            "properties": {
                "down_payment": {
                    "type": "number",
                    "description": "Down payment amount in dollars (e.g., 50000 for $50k)"
                },
                "property_price": {
                    "type": "number",
                    "description": "Property price in dollars (e.g., 300000 for $300k)"
                },
                "property_city": {
                    "type": "string",
                    "description": "City where property is located (e.g., Miami, Dallas)"
                },
                "property_state": {
                    "type": "string",
                    "enum": US_STATES,
                    "description": "Two-letter US state code (e.g., CA, FL, TX)"
                },
                "loan_purpose": {
                    "type": "string",
                    "enum": ["personal", "second", "investment"],
                    "description": "Purpose: personal (primary residence), second (vacation home), or investment (rental)"
                },
                "has_valid_passport": {
                    "type": "boolean",
                    "description": "Whether user has a valid passport"
                },
                "has_valid_visa": {
                    "type": "boolean",
                    "description": "Whether user has a valid U.S. visa"
                },
                "current_location": {
                    "type": "string",
                    "enum": ["USA", "Origin Country"],
                    "description": "Where user is currently located"
                },
                "can_demonstrate_income": {
                    "type": "boolean",
                    "description": "Whether user can provide income documentation"
                },
                "has_reserves": {
                    "type": "boolean",
                    "description": "Whether user has 6-12 months of reserves saved"
                }
            }
        }
    }
]


def extract_with_llm(user_message: str, context: Optional[str] = None) -> Dict[str, Tuple[Any, float, str]]:
    """
    Extract mortgage data using OpenAI function calling.
    
    Args:
        user_message: The user's latest message
        context: Optional context about what was asked (e.g., "down_payment")
    
    Returns:
        Dict[slot_name, (value, confidence, source)]
    """
    
    # Build the prompt
    messages = [
        {
            "role": "system",
            "content": """You are a mortgage data extraction assistant for Foreign National loans. Extract information from user messages.

CRITICAL: Map loan purpose correctly:
- "new home", "purchase", "buy", "primary residence" → "personal"
- "vacation home", "second home" → "second"  
- "rental", "investment", "income property" → "investment"
- "refinance", "refi" → DO NOT EXTRACT (Foreign National loans are purchase-only)

For locations, handle regional descriptions:
- "South Florida" → extract likely city (Miami) + state (FL)
- "North Florida" → extract likely city (Jacksonville) + state (FL)
- "Central Florida" → extract likely city (Orlando) + state (FL)

Extract only information explicitly stated by the user."""
        },
        {
            "role": "user",
            "content": user_message
        }
    ]
    
    if context:
        messages[0]["content"] += f"\n\nContext: The user was just asked about {context}."
    
    try:
        print(f"\n>>> LLM EXTRACTION DEBUG:")
        print(f"    User message: '{user_message}'")
        print(f"    Context: {context}")
        
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            functions=EXTRACTION_FUNCTIONS,
            function_call={"name": "extract_mortgage_data"},
            temperature=0.0  # Deterministic extraction
        )
        
        # Parse function call result
        function_call = response.choices[0].message.function_call
        if not function_call:
            print(f"    ⚠️  No function call returned by LLM")
            return {}
        
        extracted_raw = json.loads(function_call.arguments)
        print(f"    Raw LLM response: {json.dumps(extracted_raw, indent=2)}")
        
        # Convert to our format: (value, confidence, source)
        extracted = {}
        for key, value in extracted_raw.items():
            if value is not None:
                # LLM extraction always has confidence 0.95 (very high but not perfect)
                extracted[key] = (value, 0.95, "llm")
                print(f"    ✓ Extracted {key}: {value}")
        
        # Auto-fill state for unambiguous cities
        if "property_city" in extracted:
            city = extracted["property_city"][0]
            city_lower = city.lower()
            
            if city_lower in CITY_TO_STATE and "property_state" not in extracted:
                state = CITY_TO_STATE[city_lower]
                extracted["property_state"] = (state, 1.0, "llm")
                print(f">>> Auto-filled state {state} for unambiguous city {city}")
        
        return extracted
    
    except Exception as e:
        print(f"LLM extraction error: {e}")
        return {}


def extract_boolean_intent(user_message: str) -> Optional[bool]:
    """
    Extract yes/no intent from user message using LLM.
    
    Returns True for yes, False for no, None for unclear.
    """
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Determine if the user is saying yes or no. Respond with only 'yes', 'no', or 'unclear'."
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            temperature=0.0,
            max_tokens=10
        )
        
        answer = response.choices[0].message.content.strip().lower()
        
        if "yes" in answer:
            return True
        elif "no" in answer:
            return False
        else:
            return None
    
    except Exception as e:
        print(f"Boolean extraction error: {e}")
        return None