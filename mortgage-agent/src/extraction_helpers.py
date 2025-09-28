"""
================================================================================
EXTRACTION_HELPERS.PY - ROBUST DETERMINISTIC EXTRACTION
================================================================================

Fallback extraction functions that don't rely on LLM.
These run FIRST before any LLM extraction to catch common patterns.
"""

import re
from typing import Optional, Dict, Any


def parse_money(text: str) -> Optional[float]:
    """
    Extract monetary value from text with various formats.
    
    Handles:
    - "$50k", "50k", "50 thousand"
    - "$1.5m", "1.5 million", "1.5mm"
    - "$500,000", "500000", "USD 500,000"
    
    Returns the largest sensible number found, or None.
    """
    if not text:
        return None
        
    t = text.lower()
    
    # Normalize verbal magnitudes
    t = re.sub(r'\b(\d+(?:\.\d+)?)\s*(?:thousand|k)\b', lambda m: str(float(m.group(1)) * 1000), t)
    t = re.sub(r'\b(\d+(?:\.\d+)?)\s*(?:million|mill?|mm)\b', lambda m: str(float(m.group(1)) * 1000000), t)
    
    # Find all numbers (with optional currency symbols, commas, periods)
    # Patterns: $500,000 | 500000 | 500.000 | USD 500000
    pattern = r'(?:(?:usd|us\$|\$)\s*)?([0-9]{1,}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?)'
    matches = re.findall(pattern, t)
    
    values = []
    for raw in matches:
        # Remove commas and periods used as thousand separators
        # Keep only the last period if it's a decimal point
        clean = raw.replace(',', '').replace('.', '', raw.count('.') - 1) if '.' in raw else raw.replace(',', '')
        try:
            val = float(clean)
            if val >= 1000:  # Minimum sensible value
                values.append(val)
        except (ValueError, TypeError):
            continue
    
    return max(values) if values else None


def parse_boolean(text: str) -> Optional[bool]:
    """
    Extract yes/no answer from text.
    
    Returns True for yes, False for no, None for unclear.
    """
    if not text:
        return None
        
    t = text.strip().lower()
    
    # Affirmative words
    true_words = {"yes", "y", "correct", "true", "si", "sí", "affirmative", 
                  "yep", "yeah", "yup", "sure", "ok", "okay", "right", "good"}
    
    # Negative words  
    false_words = {"no", "n", "false", "nope", "nah", "negative", "not", 
                   "don't", "dont", "never"}
    
    # Check for affirmative
    if any(word in t.split() for word in true_words):
        return True
    
    # Check for negative
    if any(word in t.split() for word in false_words):
        return False
    
    # Check for "I have" vs "I don't have"
    if "don't have" in t or "dont have" in t or "do not have" in t:
        return False
    if "i have" in t or "have" in t:
        return True
        
    return None


def normalize_loan_purpose(text: str) -> Optional[str]:
    """
    Normalize loan purpose to standard values.
    
    Returns: "investment", "second", or "personal"
    """
    if not text:
        return None
        
    t = text.lower()
    
    # Investment property keywords
    invest_keywords = ["invest", "rental", "rent", "airbnb", "tenant", 
                       "income property", "cash flow"]
    if any(kw in t for kw in invest_keywords):
        return "investment"
    
    # Second home keywords
    second_keywords = ["second", "vacation", "holiday", "weekend"]
    if any(kw in t for kw in second_keywords):
        return "second"
    
    # Primary residence keywords
    primary_keywords = ["primary", "personal", "live", "residence", 
                        "home", "myself", "family"]
    if any(kw in t for kw in primary_keywords):
        return "personal"
    
    return None


def parse_location(text: str) -> Dict[str, Optional[str]]:
    """
    Extract city and/or state from text.
    
    Returns: {"city": str|None, "state": str|None}
    """
    result = {"city": None, "state": None}
    
    if not text:
        return result
    
    # Pattern 1: "City, State" or "City, ST"
    match = re.search(r'([A-Z][a-z\s]+),\s*([A-Z][a-z\s]+|[A-Z]{2})', text)
    if match:
        result["city"] = match.group(1).strip()
        result["state"] = match.group(2).strip()
        return result
    
    # Pattern 2: Split on commas and extract parts
    parts = [p.strip() for p in re.split(r'[,;/]|\sin\s|\sen\s', text) if p.strip()]
    
    if len(parts) >= 2:
        # Last part might be state
        if re.fullmatch(r'[A-Z]{2}', parts[-1]):
            result["state"] = parts[-1]
            result["city"] = parts[-2] if len(parts) > 1 else None
        else:
            result["city"] = parts[0]
            result["state"] = parts[-1]
    elif len(parts) == 1:
        # Check if it's a 2-letter state code
        if re.fullmatch(r'[A-Z]{2}', parts[0]):
            result["state"] = parts[0]
        else:
            # Assume it's a city
            result["city"] = parts[0]
    
    # Pattern 3: Known major cities
    known_cities = ["miami", "dallas", "austin", "houston", "seattle", 
                    "portland", "phoenix", "atlanta", "boston", "denver",
                    "chicago", "new york", "los angeles", "san francisco"]
    
    text_lower = text.lower()
    for city in known_cities:
        if city in text_lower and not result["city"]:
            result["city"] = city.title()
            break
    
    return result


def is_correction_intent(text: str) -> bool:
    """
    Detect if user is correcting a previous answer.
    
    Returns True if text contains correction language.
    """
    if not text:
        return False
        
    t = text.lower()
    
    correction_phrases = [
        "actually", "change to", "correction", "not", "it's", 
        "it is", "update to", "meant to say", "should be",
        "i said", "wait", "sorry"
    ]
    
    return any(phrase in t for phrase in correction_phrases)


def contains_data(text: str) -> bool:
    """
    Check if text contains substantive data (numbers, locations, etc).
    
    Used to distinguish between questions and answers.
    """
    if not text:
        return False
    
    # Has numbers
    if re.search(r'\d', text):
        return True
    
    # Has currency
    if re.search(r'\$|usd|dollar', text.lower()):
        return True
    
    # Has location indicators
    if re.search(r'\b[A-Z]{2}\b', text):  # State code
        return True
    
    # Has city, state pattern
    if re.search(r'[A-Z][a-z]+,\s*[A-Z]', text):
        return True
    
    return False


def extract_from_message(text: str, current_question: int, state: dict) -> Dict[str, Any]:
    """
    Master extraction function for a given question.
    
    Returns dict with extracted fields for that question.
    """
    extracted = {}
    
    if current_question == 1:
        # Q1: Down payment
        amount = parse_money(text)
        if amount and amount >= 1000:
            extracted["down_payment"] = amount
    
    elif current_question == 2:
        # Q2: Location
        loc = parse_location(text)
        if loc["city"]:
            extracted["property_city"] = loc["city"]
        if loc["state"]:
            extracted["property_state"] = loc["state"]
    
    elif current_question == 3:
        # Q3: Loan purpose
        purpose = normalize_loan_purpose(text)
        if purpose:
            extracted["loan_purpose"] = purpose
    
    elif current_question == 4:
        # Q4: Property price
        price = parse_money(text)
        if price and price >= 100000:
            extracted["property_price"] = price
    
    elif current_question == 5:
        # Q5: Passport/Visa
        # Check for specific mentions
        t = text.lower()
        if "passport" in t:
            val = parse_boolean(text)
            if val is not None:
                extracted["has_valid_passport"] = val
        if "visa" in t:
            val = parse_boolean(text)
            if val is not None:
                extracted["has_valid_visa"] = val
        if "both" in t:
            extracted["has_valid_passport"] = True
            extracted["has_valid_visa"] = True
    
    elif current_question == 6:
        # Q6: Current location
        t = text.lower()
        usa_keywords = ["usa", "united states", "america", "us", "u.s.", "states"]
        if any(kw in t for kw in usa_keywords):
            extracted["current_location"] = "USA"
        elif any(kw in t for kw in ["mexico", "colombia", "brazil", "canada", 
                                      "country", "home", "origin"]):
            extracted["current_location"] = "Origin Country"
    
    elif current_question == 7:
        # Q7: Income documentation
        val = parse_boolean(text)
        if val is not None:
            extracted["can_demonstrate_income"] = val
    
    elif current_question == 8:
        # Q8: Reserves
        val = parse_boolean(text)
        if val is not None:
            extracted["has_reserves"] = val
    
    return extracted