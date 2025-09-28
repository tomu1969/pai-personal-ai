"""
================================================================================
SLOT_EXTRACTION.PY - MULTI-ENTITY EXTRACTION WITH CONFIDENCE
================================================================================

Hybrid extraction: deterministic + LLM.
Extracts ALL entities from a single message with confidence scores.
"""

import re
from typing import Dict, Any, Tuple, List, Optional
from .extraction_helpers import (
    parse_money,
    parse_boolean,
    normalize_loan_purpose,
    parse_location
)


def extract_all_slots(text: str, llm_available: bool = True, state: Optional[Dict[str, Any]] = None) -> Dict[str, Tuple[Any, float, str]]:
    """
    Extract ALL possible slots from text with confidence scores.
    
    Args:
        text: User message to extract from
        llm_available: Whether LLM extraction is available (unused for now)
        state: Optional conversation state for context-aware extraction
    
    Returns:
        Dict[slot_name, (value, confidence, source)]
    
    Example:
        "$200k down on $800k Miami condo, investment"
        →
        {
            "down_payment": (200000.0, 1.0, "deterministic"),
            "property_price": (800000.0, 1.0, "deterministic"),
            "property_city": ("Miami", 1.0, "deterministic"),
            "loan_purpose": ("investment", 1.0, "deterministic")
        }
    """
    extracted = {}
    
    # =========================================================================
    # DETERMINISTIC EXTRACTION (confidence = 1.0)
    # =========================================================================
    
    # Money values (multiple possible)
    money_values = extract_all_money(text)
    t_lower = text.lower()
    
    # =========================================================================
    # CONTEXT-AWARE EXTRACTION (for single money values)
    # =========================================================================
    last_asked = state.get("last_slot_asked") if state else None
    
    if last_asked and len(money_values) == 1:
        val = money_values[0]
        
        # If we just asked about down_payment, assign there
        if last_asked == "down_payment" and 10000 <= val <= 5000000:
            extracted["down_payment"] = (val, 1.0, "deterministic")
            money_values = []  # Mark as consumed
        
        # If we just asked about property_price, assign there  
        elif last_asked == "property_price" and 100000 <= val <= 50000000:
            extracted["property_price"] = (val, 1.0, "deterministic")
            money_values = []  # Mark as consumed
    
    # Check for both price and down keywords
    has_down_kw = any(kw in t_lower for kw in ["down payment", "down", "deposit", "upfront"])
    has_price_kw = any(kw in t_lower for kw in ["property", "house", "home", "condo", "price", "cost"])
    
    # If we have 2+ money values, extract smartly
    if len(money_values) >= 2:
        # Sort by value (largest first)
        sorted_values = sorted(money_values, reverse=True)
        
        # Assume larger = price, smaller = down payment
        if sorted_values[0] >= 100000:
            extracted["property_price"] = (sorted_values[0], 1.0, "deterministic")
        if sorted_values[1] >= 10000:
            extracted["down_payment"] = (sorted_values[1], 1.0, "deterministic")
    
    elif len(money_values) == 1:
        # Single money value - guess based on magnitude
        val = money_values[0]
        if val >= 100000:
            # Could be price or large down payment
            if "down" in text.lower():
                extracted["down_payment"] = (val, 1.0, "deterministic")
            else:
                extracted["property_price"] = (val, 0.8, "deterministic")
        elif val >= 10000:
            extracted["down_payment"] = (val, 0.8, "deterministic")
    
    # Location
    location = parse_location(text)
    if location["city"]:
        extracted["property_city"] = (location["city"], 1.0, "deterministic")
    if location["state"]:
        extracted["property_state"] = (location["state"], 1.0, "deterministic")
    
    # Loan purpose
    purpose = normalize_loan_purpose(text)
    if purpose:
        extracted["loan_purpose"] = (purpose, 1.0, "deterministic")
    
    # Booleans (passport/visa/income/reserves)
    bool_val = parse_boolean(text)
    if bool_val is not None:
        # Try to determine which field based on keywords
        t = text.lower()
        if "passport" in t:
            extracted["has_valid_passport"] = (bool_val, 1.0, "deterministic")
        if "visa" in t:
            extracted["has_valid_visa"] = (bool_val, 1.0, "deterministic")
        if any(kw in t for kw in ["income", "bank statement", "tax return", "cpa letter"]):
            extracted["can_demonstrate_income"] = (bool_val, 1.0, "deterministic")
        if any(kw in t for kw in ["reserve", "saving", "emergency fund", "month"]):
            extracted["has_reserves"] = (bool_val, 1.0, "deterministic")
    
    # Current location
    t = text.lower()
    if any(kw in t for kw in ["usa", "united states", "america", "u.s.", "states"]):
        extracted["current_location"] = ("USA", 1.0, "deterministic")
    elif any(kw in t for kw in ["mexico", "colombia", "brazil", "canada", "country", "home", "origin"]):
        extracted["current_location"] = ("Origin Country", 0.9, "deterministic")
    
    # =========================================================================
    # LLM EXTRACTION (for fuzzy cases) - TODO if needed
    # =========================================================================
    # This could be added later for more complex narratives
    
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