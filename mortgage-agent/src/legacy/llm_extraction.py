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


def normalize_location_with_llm(text: str) -> Dict[str, Any]:
    """
    Use LLM to normalize geographic information without hardcoded maps.
    
    Args:
        text: Location text from user (e.g., "Brickell", "South Florida", "33131")
    
    Returns:
        Dict with: {neighborhood, city, state, country_iso, confidence, ambiguous, candidates}
    """
    prompt = f"""You are a geographic normalization expert. Given location text, return a JSON object with geographic information.

TEXT TO NORMALIZE: "{text}"

EXAMPLES:
Input: "Brickell"
Output: {{"neighborhood": "Brickell", "city": "Miami", "state": "FL", "country_iso": "US", "confidence": 0.95, "ambiguous": false}}

Input: "South Florida"  
Output: {{"neighborhood": null, "city": null, "state": "FL", "country_iso": "US", "confidence": 0.9, "ambiguous": true, "candidates": ["Miami", "Fort Lauderdale", "West Palm Beach"]}}

Input: "Mexico"
Output: {{"neighborhood": null, "city": null, "state": null, "country_iso": "MX", "confidence": 1.0, "ambiguous": false}}

Input: "33131"
Output: {{"neighborhood": "Brickell", "city": "Miami", "state": "FL", "country_iso": "US", "confidence": 0.95, "ambiguous": false}}

Input: "Coral Gables"
Output: {{"neighborhood": "Coral Gables", "city": "Miami", "state": "FL", "country_iso": "US", "confidence": 0.95, "ambiguous": false}}

RULES:
- Return only JSON, no explanation
- confidence: 0.0-1.0 based on how certain the mapping is
- ambiguous: true if multiple cities/areas possible
- candidates: list of possible cities if ambiguous
- Use null for unknown fields
- Common Miami neighborhoods: Brickell, Coral Gables, Coconut Grove, Wynwood, South Beach
- Regional terms: "South Florida" covers Miami-Dade, Broward, Palm Beach counties

Return JSON for: "{text}"
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=200
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        try:
            result = json.loads(result_text)
            
            # Validate required fields
            required_fields = ["confidence", "ambiguous", "country_iso"]
            for field in required_fields:
                if field not in result:
                    result[field] = None
            
            # Ensure confidence is valid
            if result["confidence"] is None or not isinstance(result["confidence"], (int, float)):
                result["confidence"] = 0.7
            
            print(f">>> Geographic normalization: '{text}' → {result}")
            return result
            
        except json.JSONDecodeError:
            print(f">>> Geographic normalization failed to parse JSON: {result_text}")
            return _fallback_geo_result(text)
    
    except Exception as e:
        print(f">>> Geographic normalization error: {e}")
        return _fallback_geo_result(text)


def _fallback_geo_result(text: str) -> Dict[str, Any]:
    """Fallback geographic result when LLM fails"""
    # Simple fallback logic
    text_lower = text.lower()
    
    if any(country in text_lower for country in ["mexico", "canada", "colombia", "venezuela", "brazil"]):
        return {
            "neighborhood": None,
            "city": None, 
            "state": None,
            "country_iso": "OTHER",
            "confidence": 0.8,
            "ambiguous": False
        }
    
    # Default to US location with low confidence
    return {
        "neighborhood": None,
        "city": text,
        "state": None,
        "country_iso": "US", 
        "confidence": 0.5,
        "ambiguous": True,
        "candidates": []
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