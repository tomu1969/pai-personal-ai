"""
================================================================================
QUESTION_GENERATOR.PY - DYNAMIC QUESTION GENERATION WITH LLM
================================================================================

Generates natural, context-aware questions using OpenAI.
Includes acknowledgments and helpful guidance.
"""

import os
import re
from typing import Dict, Any, Optional
from openai import OpenAI
from .business_rules import MIN_DOWN_PCT, MIN_RESERVES_MONTHS, MAX_RESERVES_MONTHS

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def apply_tone_guard(text: str) -> str:
    """
    Clean up LLM responses to ensure neutral, concise tone.
    
    Rules:
    - Remove praise words and excessive positivity
    - Limit to 2 sentences maximum
    - Remove exclamation marks
    - Keep professional and direct tone
    """
    if not text:
        return text
    
    # Remove praise words and overly positive phrases
    praise_patterns = [
        r'\b(great|excellent|wonderful|perfect|amazing|fantastic|outstanding|superb|brilliant)\b',
        r'\b(sounds? good|that\'?s good|very good|good choice|nice|lovely)\b',
        r'\b(congratulations|well done|good job|nicely done)\b',
        r'\b(I\'?m excited|excited to|thrilled|delighted|pleased)\b',
    ]
    
    cleaned = text
    for pattern in praise_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Remove excessive exclamation marks
    cleaned = re.sub(r'!+', '.', cleaned)
    
    # Clean up extra spaces and punctuation
    cleaned = re.sub(r'\s+', ' ', cleaned)  # Multiple spaces → single space
    cleaned = re.sub(r'\s*,\s*,\s*', ', ', cleaned)  # Multiple commas
    cleaned = re.sub(r'\.\s*\.\s*', '. ', cleaned)  # Multiple periods
    cleaned = cleaned.strip()
    
    # Limit to 2 sentences maximum
    sentences = re.split(r'[.!?]+\s*', cleaned)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if len(sentences) > 2:
        cleaned = '. '.join(sentences[:2]) + '.'
    elif sentences:
        cleaned = '. '.join(sentences)
        if not cleaned.endswith(('.', '?', ':')):
            cleaned += '.'
    
    return cleaned


def generate_question(
    slot_name: str,
    state: Dict[str, Any],
    last_user_message: Optional[str] = None
) -> str:
    """
    Generate a natural, context-aware question for a missing slot.
    
    Args:
        slot_name: The slot to ask about
        state: Current conversation state with filled slots
        last_user_message: User's last message for context
    
    Returns:
        Natural question string with acknowledgment if appropriate
    """
    
    # Get filled slots for context
    filled_slots = {}
    for key, slot_data in state.get("slots", {}).items():
        filled_slots[key] = slot_data["value"]
    
    # Build context description
    context_parts = []
    if "down_payment" in filled_slots:
        context_parts.append(f"down payment of ${filled_slots['down_payment']:,.0f}")
    if "loan_purpose" in filled_slots:
        context_parts.append(f"for {filled_slots['loan_purpose']} property")
    if "property_city" in filled_slots:
        context_parts.append(f"in {filled_slots['property_city']}")
    if "property_price" in filled_slots:
        context_parts.append(f"priced at ${filled_slots['property_price']:,.0f}")
    
    context_str = ", ".join(context_parts) if context_parts else "no information yet"
    
    # Special handling for specific slots
    if slot_name == "property_price" and "down_payment" in filled_slots:
        return generate_property_price_question(filled_slots, last_user_message)
    
    if slot_name == "has_reserves" and "property_price" in filled_slots:
        return generate_reserves_question(filled_slots, last_user_message)
    
    # Generate general question with LLM
    prompt = f"""You are a mortgage assistant. Be concise and professional.

Context: User has provided {context_str}
User's last message: "{last_user_message or 'none'}"

STRICT GUIDELINES:
- Maximum 2 sentences 
- No praise words: "great", "excellent", "wonderful", "perfect"
- Brief acknowledgment if relevant, then ask about {slot_name}
- Be direct and neutral

Generate concise question about {slot_name}:"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=100
        )
        
        raw_response = response.choices[0].message.content.strip()
        return apply_tone_guard(raw_response)
    
    except Exception as e:
        print(f"Question generation error: {e}")
        # Fallback to static question
        return get_fallback_question(slot_name, filled_slots)


def generate_property_price_question(filled_slots: Dict[str, Any], last_user_message: Optional[str]) -> str:
    """
    Generate property price question with affordability calculation.
    """
    down_payment = filled_slots.get("down_payment", 0)
    loan_purpose = filled_slots.get("loan_purpose", "personal")
    
    if down_payment > 0:
        # Calculate affordability using business rule constants
        max_price = down_payment / MIN_DOWN_PCT  # Use actual minimum down percentage
        comfortable_price = down_payment / 0.30  # 30% down (more comfortable)
        
        prompt = f"""You are a mortgage assistant. The user has ${down_payment:,.0f} for down payment and wants an {loan_purpose} property.

Based on their down payment, they can afford properties between ${comfortable_price:,.0f} and ${max_price:,.0f}.

Their last message: "{last_user_message or 'none'}"

Generate a natural question that:
1. Briefly acknowledges their previous answer if relevant
2. Mentions the affordability range
3. Asks what price range they're considering

Keep it brief and conversational (2-3 sentences max):"""

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=100
            )
            raw_response = response.choices[0].message.content.strip()
            return apply_tone_guard(raw_response)
        except:
            return f"Based on your ${down_payment:,.0f} down payment, you can afford properties between ${comfortable_price:,.0f} and ${max_price:,.0f}. What price range are you considering?"
    
    return "What's your target property price?"


def generate_reserves_question(filled_slots: Dict[str, Any], last_user_message: Optional[str]) -> str:
    """
    Generate reserves question with calculated amount.
    """
    property_price = filled_slots.get("property_price", 0)
    down_payment = filled_slots.get("down_payment", 0)
    
    if property_price > 0 and down_payment > 0:
        # Calculate monthly mortgage payment (rough estimate)
        loan_amount = property_price - down_payment
        # Assume 7% interest, 30 years, plus taxes/insurance
        monthly_rate = 0.07 / 12
        n_payments = 360
        monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate)**n_payments) / ((1 + monthly_rate)**n_payments - 1)
        monthly_payment *= 1.3  # Add ~30% for taxes, insurance, HOA
        
        # Use business rule constants for reserves
        min_reserves = monthly_payment * MIN_RESERVES_MONTHS
        max_reserves = monthly_payment * MAX_RESERVES_MONTHS
        
        prompt = f"""You are a mortgage assistant. The user needs to have reserves (savings for emergencies).

Monthly mortgage payment will be approximately ${monthly_payment:,.0f}.
They need 6-12 months of reserves, which is ${min_reserves:,.0f} to ${max_reserves:,.0f}.

Their last message: "{last_user_message or 'none'}"

Generate a natural question that:
1. Briefly acknowledges their previous answer
2. Mentions how much reserves they need (the calculated range)
3. Asks if they have that amount saved

Keep it brief and helpful (2-3 sentences max):"""

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=120
            )
            raw_response = response.choices[0].message.content.strip()
            return apply_tone_guard(raw_response)
        except:
            return f"You'll need {MIN_RESERVES_MONTHS}-{MAX_RESERVES_MONTHS} months of reserves (approximately ${min_reserves:,.0f} to ${max_reserves:,.0f}). Do you have this amount saved?"
    
    return f"Do you have {MIN_RESERVES_MONTHS}-{MAX_RESERVES_MONTHS} months of mortgage payments saved as reserves?"


def get_fallback_question(slot_name: str, filled_slots: Dict[str, Any]) -> str:
    """
    Fallback static questions if LLM fails.
    """
    questions = {
        "down_payment": "How much do you have for a down payment?",
        "loan_purpose": "Property use: primary residence, second home, or investment?",
        "property_city": "Which city?",
        "property_state": "Which state?", 
        "property_price": "Target property price?",
        "has_valid_passport": "Do you have a valid passport?",
        "has_valid_visa": "Do you have a valid U.S. visa?",
        "current_location": "Are you currently in the USA or your home country?",
        "can_demonstrate_income": "Can you provide income documentation?",
        "has_reserves": f"Do you have {MIN_RESERVES_MONTHS}-{MAX_RESERVES_MONTHS} months of mortgage payments saved?"
    }
    
    return questions.get(slot_name, f"Could you tell me about your {slot_name}?")