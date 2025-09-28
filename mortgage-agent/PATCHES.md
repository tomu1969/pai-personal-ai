# Mortgage Agent Fixes - Unified Patches

This document contains all patches to fix the re-asking loops and extraction issues.

## Summary of Changes

1. **state.py**: Add attempt tracking and idempotency fields
2. **extraction_helpers.py** (NEW): Robust deterministic extraction functions
3. **graph.py**: Add idempotency guards, attempt caps, and use deterministic extraction
4. **router.py**: Fix classification to avoid false positives on questions
5. **nodes.py**: Remove excessive praise, enforce neutral tone

---

## Patch 1: state.py - Add tracking fields

```diff
--- a/src/state.py
+++ b/src/state.py
@@ -36,7 +36,7 @@
 """
-from typing import TypedDict, List, Optional
+from typing import TypedDict, List, Optional, Dict
 
 
 class GraphState(TypedDict):
@@ -226,6 +226,27 @@ class GraphState(TypedDict):
     CRITICAL: This is how we maintain sequential flow across API calls!
     """
     
+    asked_counts: Dict[int, int]
+    """
+    Track how many times we've asked each question.
+    
+    Format: {question_number: attempt_count}
+    Example: {1: 2, 2: 1, 3: 3}
+    
+    Used for force progression after 2 attempts with valid data.
+    Prevents infinite loops on the same question.
+    """
+    
+    last_asked_q: Optional[int]
+    """Last question number that was emitted to user."""
+    
+    last_prompt_hash: Optional[str]
+    """
+    Hash of the last prompt sent to avoid duplicate emissions.
+    Prevents asking the exact same question twice in a row.
+    """
+    
     conversation_complete: bool
     """
     Has the conversation finished (final decision made)?
```

---

## Patch 2: Create extraction_helpers.py (NEW FILE)

```python
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
        clean = raw.replace(',', '').replace('.', '', raw.count('.') - 1)
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


def extract_from_message(text: str, current_question: int) -> Dict[str, Any]:
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
```

---

## Patch 3: graph.py - Add idempotency and use deterministic extraction

Insert after imports:

```python
from hashlib import sha256
from .extraction_helpers import (
    extract_from_message,
    is_correction_intent,
    contains_data
)


# ============================================================================
# IDEMPOTENCY AND ATTEMPT TRACKING
# ============================================================================

def _already_have_data(q: int, state: GraphState) -> bool:
    """Check if we already have valid data for this question."""
    required_by_q = {
        1: ["down_payment"],
        2: ["property_city", "property_state"],  # Either is fine
        3: ["loan_purpose"],
        4: ["property_price"],
        5: ["has_valid_passport", "has_valid_visa"],  # Either is fine
        6: ["current_location"],
        7: ["can_demonstrate_income"],
        8: ["has_reserves"],
    }
    
    req = required_by_q.get(q, [])
    
    # Special case: Q2 and Q5 accept either field
    if q == 2:
        return bool(state.get("property_city") or state.get("property_state"))
    elif q == 5:
        return (state.get("has_valid_passport") is not None or 
                state.get("has_valid_visa") is not None)
    
    # For others, check all required fields
    return all(state.get(k) not in (None, "", []) for k in req)


def _force_progression_allowed(state: GraphState, q: int) -> bool:
    """
    Allow force progression if:
    - Asked 2+ times
    - AND we have at least some valid data for this question
    """
    attempts = state.get("asked_counts", {}).get(q, 0)
    return attempts >= 2 and _already_have_data(q, state)


def _should_emit_prompt(state: GraphState, q: int, prompt_text: str) -> bool:
    """
    Check if we should emit this prompt or if it's a duplicate.
    
    Returns True if we should emit, False if it's a duplicate.
    """
    prompt_hash = sha256(prompt_text.encode()).hexdigest()[:16]
    
    # Check if same question and same hash as last time
    if (state.get("last_asked_q") == q and 
        state.get("last_prompt_hash") == prompt_hash):
        return False
    
    # Update tracking
    state["last_asked_q"] = q
    state["last_prompt_hash"] = prompt_hash
    
    return True


def _increment_attempt(state: GraphState, q: int):
    """Increment the ask counter for a question."""
    if "asked_counts" not in state:
        state["asked_counts"] = {}
    state["asked_counts"][q] = state["asked_counts"].get(q, 0) + 1


def _reset_attempt(state: GraphState, q: int):
    """Reset the ask counter when successfully advancing."""
    if "asked_counts" in state:
        state["asked_counts"][q] = 0
```

Then modify `process_conversation_step` to add these checks BEFORE the existing fallback extraction:

```python
# Inside process_conversation_step, after getting last_user_message:

        # =====================================================================
        # DETERMINISTIC EXTRACTION (runs FIRST, before LLM)
        # =====================================================================
        deterministic_extracted = extract_from_message(last_user_message, current_q)
        
        print(f">>> DETERMINISTIC EXTRACTION: {deterministic_extracted}")
        
        # Apply extracted fields to state
        for key, value in deterministic_extracted.items():
            if value is not None:
                state[key] = value
                print(f">>> ✅ DETERMINISTIC extracted {key}: {value}")
        
        # Check if deterministic extraction filled the requirement
        if deterministic_extracted and _already_have_data(current_q, state):
            print(f">>> ✅ DETERMINISTIC extraction satisfied Q{current_q}")
            conversation_result = {
                "response": "",  # Will be filled by LLM
                "advance": True,
                "extract": "deterministic"
            }
        
        # =====================================================================
        # IDEMPOTENCY CHECK: Skip if we already have data
        # =====================================================================
        if _already_have_data(current_q, state):
            print(f">>> ⏭️  Q{current_q} already satisfied, advancing")
            should_advance = True
            # Don't increment asked_counts
        
        # =====================================================================
        # CORRECTION DETECTION
        # =====================================================================
        elif is_correction_intent(last_user_message):
            print(f">>> 🔧 CORRECTION detected")
            # Extract correction but don't increment asked_counts
            # Don't re-ask the question
            pass
```

And before the existing "Apply advancement decision" section, add:

```python
        # =====================================================================
        # FORCE PROGRESSION CHECK
        # =====================================================================
        if not should_advance and _force_progression_allowed(state, current_q):
            print(f">>> 🚨 FORCE ADVANCING Q{current_q} after {state['asked_counts'].get(current_q, 0)} attempts")
            should_advance = True
        
        # Only increment attempt counter if we're emitting a question prompt
        if not should_advance:
            _increment_attempt(state, current_q)
        else:
            _reset_attempt(state, current_q)
```

---

## Patch 4: router.py - Fix classification

```diff
--- a/src/router.py
+++ b/src/router.py
@@ -5,12 +5,16 @@
 import time
 import random
 from typing import Literal, Optional, Dict, Any
 from .state import GraphState
+from .extraction_helpers import contains_data
 
 
-def classify_input(user_message: str) -> Literal["answer", "question"]:
+def classify_input(user_message: str, extracted: Optional[Dict[str, Any]] = None) -> Literal["answer", "question"]:
     """
     Classify user input as either an answer to our question or a question from the user.
     
+    Args:
+        user_message: The text to classify
+        extracted: Dict of extracted data (if present, likely an answer)
+    
     This is a simple rule-based classifier for now.
     In a full implementation, this would use an LLM.
     """
@@ -18,24 +22,34 @@ def classify_input(user_message: str) -> Literal["answer", "question"]:
-    # Simple heuristics for classification
-    question_indicators = [
-        "?", "why", "how", "what", "when", "where", "who", "which",
-        "can you", "could you", "would you", "will you", "do you",
-        "explain", "tell me", "help me", "i don't understand",
-        "what does", "what is", "what are", "how much", "how many"
-    ]
-    
     user_lower = user_message.lower().strip()
     
-    # Check for question indicators
-    for indicator in question_indicators:
-        if indicator in user_lower:
-            return "question"
-    
-    # If it ends with a question mark, it's likely a question
+    # If ends with ?, it's a question
     if user_message.strip().endswith("?"):
         return "question"
     
+    # If we extracted data, it's an answer
+    if extracted and any(extracted.values()):
+        return "answer"
+    
+    # If contains substantive data, it's an answer
+    if contains_data(user_message):
+        return "answer"
+    
+    # Check if question word is at the START (after stripping)
+    question_leads = {
+        "why", "how", "what", "when", "where", "who", "which",
+        "can", "could", "would", "will", "do", "does", "did"
+    }
+    
+    first_word = user_lower.split()[0] if user_lower.split() else ""
+    
+    if first_word in question_leads:
+        # But if it also contains numbers/money, treat as answer
+        # E.g., "How much? $200k" should be an answer
+        if contains_data(user_message):
+            return "answer"
+        return "question"
+    
     # Otherwise, assume it's an answer
     return "answer"
```

---

## Patch 5: nodes.py - Remove excessive praise

Find the `generate_conversational_response` function and update the system prompt:

```diff
--- a/src/nodes.py
+++ b/src/nodes.py
@@ -120,15 +120,12 @@ def generate_conversational_response(state: GraphState) -> dict:
         
         # Improved conversational prompt
         prompt = f"""You are a professional mortgage pre-approval assistant for Foreign Nationals.
-You are currently on Question {current_q} of 8.
+Currently on Question {current_q} of 8. Be concise and professional.
 
-Guidelines:
-1. If the client answered your question, thank them and move forward
-2. If the client asked a clarifying question, answer it briefly then re-ask your question
-3. If the answer is unclear, ask for clarification
-4. Be conversational but professional
-5. Don't repeat information unnecessarily
-6. Keep responses concise (2-3 sentences max)
+TONE REQUIREMENTS:
+- Single-line acknowledgment max ("Noted." or "Got it.")
+- No praise, no superlatives (excellent, amazing, great, etc.)
+- No exclamation marks
 
 Current conversation context:
 {recent_messages}
@@ -158,7 +155,7 @@ Q8: Do you have 6-12 months of mortgage payments saved as reserves?
 
-Your response should be natural and conversational. If they answered, briefly acknowledge and ask the next question.
-If they asked something, answer it clearly then guide them back.
+Your response must be succinct. If they answered, acknowledge with ONE word ("Noted.") and ask next question.
+If they asked something, answer in 1-2 sentences then continue.
 
 Required output format:
 RESPONSE: [your conversational response]
@@ -167,7 +164,7 @@ ADVANCE: [true/false - whether to move to next question]
 
 Guidelines for extraction:
-- If the client provided specific information, extract it as "field:value" (e.g., "down_payment:50000")
+- Extract as "field:value" only if CLEARLY stated (e.g., "down_payment:50000")
 - Use standard values for loan_purpose: "personal", "second", or "investment" (not "primary residence"!)
 - For location, extract as "property_city:Miami,property_state:FL"
 - If no extraction needed, use "none"
```

---

## Patch 6: api.py - Initialize new state fields

```diff
--- a/src/api.py
+++ b/src/api.py
@@ -125,6 +125,11 @@ def create_initial_state() -> GraphState:
         # Conversation tracking
         "messages": [],  # Full chat history
         "current_question": 1,  # Which question (1-8) we're currently on
+        
+        # Attempt tracking (NEW)
+        "asked_counts": {},  # Track asks per question
+        "last_asked_q": None,  # Last Q number emitted
+        "last_prompt_hash": None,  # Duplicate prompt detection
+        
         "conversation_complete": False,
         "final_decision": None,  # "Pre-Approved", "Rejected", or "Needs Review"
```

---

## Testing After Applying Patches

Run these test scenarios to verify fixes:

```bash
# Test 1: Out-of-order info (should capture in 1-2 turns)
echo "I have $400k down, looking at $1.5M house in Seattle for investment" | python -m pytest test_scenario3_outoforder.py

# Test 2: Purpose synonyms
# User says "rent on Airbnb" → should extract as "investment"

# Test 3: Correction
# User says "actually it's $500k not $400k" → should not re-ask Q1

# Test 4: Question mid-flow
# User asks "what's LTV?" → should answer without incrementing asked_counts
```

---

## Migration Checklist

- [ ] Apply Patch 1 to state.py
- [ ] Create extraction_helpers.py with Patch 2 content
- [ ] Apply Patch 3 to graph.py
- [ ] Apply Patch 4 to router.py
- [ ] Apply Patch 5 to nodes.py
- [ ] Apply Patch 6 to api.py
- [ ] Run test scenarios
- [ ] Verify no questions asked twice
- [ ] Verify "rent on Airbnb" → "investment"
- [ ] Verify corrections don't trigger re-asks