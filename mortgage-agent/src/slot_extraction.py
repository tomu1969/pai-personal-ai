"""
================================================================================
SLOT_EXTRACTION.PY - MULTI-ENTITY EXTRACTION WITH CONFIDENCE
================================================================================

LLM-based extraction for accuracy and context awareness.
Extracts ALL entities from a single message with confidence scores.
"""

import re
from typing import Dict, Any, Tuple, List, Optional
from .llm_extraction import extract_with_llm


def extract_all_slots(text: str, llm_available: bool = True, state: Optional[Dict[str, Any]] = None) -> Dict[str, Tuple[Any, float, str]]:
    """
    Extract ALL possible slots from text using LLM.
    
    Args:
        text: User message to extract from (ONLY the user's latest message)
        llm_available: Whether LLM extraction is available
        state: Optional conversation state for context-aware extraction
    
    Returns:
        Dict[slot_name, (value, confidence, source)]
    
    Example:
        "$200k down on $800k Miami condo, investment"
        →
        {
            "down_payment": (200000.0, 0.95, "llm"),
            "property_price": (800000.0, 0.95, "llm"),
            "property_city": ("Miami", 0.95, "llm"),
            "property_state": ("FL", 1.0, "llm"),  # Auto-filled
            "loan_purpose": ("investment", 0.95, "llm")
        }
    """
    
    # Get context about what was just asked
    last_asked = state.get("last_slot_asked") if state else None
    
    # Use LLM extraction for all fields
    extracted = extract_with_llm(text, context=last_asked)
    
    print(f">>> LLM extracted {len(extracted)} slots from: '{text}'")
    for key, (val, conf, source) in extracted.items():
        print(f"    {key} = {val} (confidence={conf})")
    
    return extracted


def extract_all_money(text: str) -> List[float]:
    """
    Extract ALL money values from text (not just the first one).
    
    "$200k down on $800k condo" → [200000.0, 800000.0]
    """
    values = []
    t = text.lower()
    
    # Normalize verbal magnitudes first
    t = re.sub(r'\b(\d+(?:\.\d+)?)\s*(?:thousand|k)\b', lambda m: str(float(m.group(1)) * 1000), t, flags=re.IGNORECASE)
    t = re.sub(r'\b(\d+(?:\.\d+)?)\s*(?:m|mm|mil|million)\b', lambda m: str(float(m.group(1)) * 1000000), t, flags=re.IGNORECASE)
    
    # Find all numbers with optional currency
    pattern = r'(?:(?:usd|us\$|\$)\s*)?([0-9]{1,}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?)'
    matches = re.finditer(pattern, t)
    
    for match in matches:
        raw = match.group(1)
        # Remove commas and periods used as thousand separators
        clean = raw.replace(',', '').replace('.', '', raw.count('.') - 1) if '.' in raw else raw.replace(',', '')
        try:
            val = float(clean)
            if val >= 1000:  # Minimum sensible value
                values.append(val)
        except (ValueError, TypeError):
            continue
    
    return values


def calculate_extraction_delta(
    old_slots: Dict[str, Any],
    new_extracted: Dict[str, Tuple[Any, float, str]]
) -> Dict[str, Tuple[Any, float, str, str]]:
    """
    Calculate what changed between old state and new extraction.
    
    Returns:
        Dict[slot_name, (value, confidence, source, change_type)]
        change_type: "new" | "changed" | "confirmed" | "unchanged"
    """
    delta = {}
    
    for slot_name, (new_value, confidence, source) in new_extracted.items():
        if slot_name not in old_slots:
            # New slot
            delta[slot_name] = (new_value, confidence, source, "new")
        elif old_slots[slot_name]["value"] != new_value:
            # Changed value
            delta[slot_name] = (new_value, confidence, source, "changed")
        else:
            # Confirmed (same value seen again)
            delta[slot_name] = (new_value, confidence, source, "confirmed")
    
    return delta


def needs_confirmation(
    slot_name: str,
    value: Any,
    confidence: float,
    change_type: str,
    old_confidence: float = 0.0
) -> bool:
    """
    Determine if a slot needs explicit user confirmation.
    
    Rules:
    - New slots with confidence < 0.5: confirm (very uncertain only)
    - Changed slots: always confirm
    - High confidence (>= 0.9): no confirmation needed unless changed
    
    Note: LLM extractions typically have 0.95 confidence, which we should trust.
    """
    if change_type == "changed":
        return True
    
    # Only confirm if confidence is VERY low (< 0.5)
    # LLM gives 0.95 for good extractions, trust it
    if change_type == "new" and confidence < 0.5:
        return True
    
    if change_type == "confirmed" and old_confidence < 0.5 and confidence >= 0.5:
        # Confidence increased, no need to confirm again
        return False
    
    return False


def format_delta_confirmation(delta: Dict[str, Tuple[Any, float, str, str]]) -> str:
    """
    Generate natural confirmation message using LLM.
    
    Instead of "Captured: down_payment $200k", generates natural language like
    "Just to confirm, you're putting down $200,000?"
    """
    import os
    from openai import OpenAI
    
    if not delta:
        return ""
    
    # Build description of what was captured
    captured_items = []
    for slot_name, (value, conf, source, change_type) in delta.items():
        if slot_name == "down_payment":
            captured_items.append(f"down payment of ${value:,.0f}")
        elif slot_name == "property_price":
            captured_items.append(f"property price of ${value:,.0f}")
        elif slot_name == "property_city":
            captured_items.append(f"property in {value}")
        elif slot_name == "property_state":
            captured_items.append(f"in {value} state")
        elif slot_name == "loan_purpose":
            purpose_map = {"personal": "primary residence", "second": "second home", "investment": "investment property"}
            captured_items.append(f"for {purpose_map.get(value, value)}")
        elif slot_name in ["has_valid_passport", "has_valid_visa", "can_demonstrate_income", "has_reserves"]:
            yn = "yes" if value else "no"
            field_names = {
                "has_valid_passport": "passport",
                "has_valid_visa": "visa", 
                "can_demonstrate_income": "income documentation",
                "has_reserves": "reserves"
            }
            captured_items.append(f"{field_names.get(slot_name, slot_name)}: {yn}")
        else:
            captured_items.append(f"{slot_name}: {value}")
    
    if not captured_items:
        return "Let me confirm what I understood. Is this correct?"
    
    # Use LLM to generate natural confirmation
    prompt = f"""You're a mortgage assistant who needs to confirm information with the user.

You understood: {', '.join(captured_items)}

Generate a brief, natural confirmation question (1 sentence).
Examples:
- "Just to confirm, you're putting down $400,000 on a $2 million property?"
- "So you have $250,000 for the down payment, correct?"
- "I have you down for a $300,000 down payment. Is that right?"

Be conversational and natural. Keep it brief."""
    
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=60
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"LLM confirmation generation error: {e}")
        # Fallback to natural but simpler format
        if len(captured_items) == 1:
            return f"I understood {captured_items[0]}. Is that correct?"
        else:
            return f"Let me confirm: {', '.join(captured_items)}. Is this correct?"


def validate_ltv(property_price: float, down_payment: float) -> Tuple[bool, Optional[str]]:
    """
    Validate LTV requirement: down payment must be >= 25%.
    
    Returns: (is_valid, error_message)
    """
    if property_price <= 0:
        return False, "Property price must be positive"
    
    ltv = (property_price - down_payment) / property_price
    down_pct = down_payment / property_price
    
    if down_pct < 0.25:
        return False, f"Down payment must be ≥25%. You have {down_pct*100:.1f}%"
    
    if ltv > 0.75:
        return False, f"LTV must be ≤75%. Your LTV is {ltv*100:.1f}%"
    
    return True, None