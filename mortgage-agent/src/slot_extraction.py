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
    - New slots with confidence < 0.7: confirm
    - Changed slots: always confirm
    - High confidence (>= 0.9): no confirmation needed unless changed
    """
    if change_type == "changed":
        return True
    
    if change_type == "new" and confidence < 0.7:
        return True
    
    if change_type == "confirmed" and old_confidence < 0.7 and confidence >= 0.7:
        # Confidence increased, no need to confirm again
        return False
    
    return False


def format_delta_confirmation(delta: Dict[str, Tuple[Any, float, str, str]]) -> str:
    """
    Format delta for user confirmation.
    
    "Captured: down_payment $200k; property_price $800k; location Miami; purpose investment. Correct?"
    """
    if not delta:
        return ""
    
    parts = []
    for slot_name, (value, conf, source, change_type) in delta.items():
        # Format the value for display
        if slot_name in ["down_payment", "property_price"]:
            display = f"${value:,.0f}"
        elif slot_name in ["property_city", "property_state", "current_location"]:
            display = value
        elif slot_name == "loan_purpose":
            display = value
        elif isinstance(value, bool):
            display = "yes" if value else "no"
        else:
            display = str(value)
        
        # Friendly names
        friendly_names = {
            "down_payment": "down payment",
            "property_price": "property price",
            "property_city": "city",
            "property_state": "state",
            "loan_purpose": "purpose",
            "has_valid_passport": "passport",
            "has_valid_visa": "visa",
            "can_demonstrate_income": "income docs",
            "has_reserves": "reserves",
            "current_location": "location"
        }
        
        friendly = friendly_names.get(slot_name, slot_name)
        parts.append(f"{friendly} {display}")
    
    if len(parts) == 1:
        return f"Captured: {parts[0]}. Correct?"
    else:
        return f"Captured: {'; '.join(parts)}. Correct?"


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