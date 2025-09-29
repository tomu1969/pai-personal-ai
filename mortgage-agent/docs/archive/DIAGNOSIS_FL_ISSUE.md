# Diagnosis: Slot-Filling System Fails on Lowercase Input

## User's Experience

```
System: What will you use the property for?
User: investment
System: Which city is the property in?
User: miami
System: Which state?
User: fl    ⬅️ NOT EXTRACTED (lowercase)
System: What's the property price?
User: it depends on the loan amount
System: Which state?    ⬅️ ASKING AGAIN!
User: fl
System: What's the property price?
```

## Root Causes (Multiple Issues)

### Issue 1: Case-Sensitive State Extraction ❌

**Location:** `src/extraction_helpers.py` line 155

```python
# Current regex - ONLY matches uppercase
state_match = re.search(r'\b([A-Z]{2})\b', text)
```

**Test Results:**
- "FL" → ✅ Extracted
- "fl" → ❌ NOT extracted  
- "Fl" → ❌ NOT extracted
- "florida" → ❌ NOT extracted

**Impact:** Most users type lowercase, causing extraction failure.

---

### Issue 2: No Graceful Handling of Indirect Answers

When user says **"it depends on the loan amount"**:
- System doesn't recognize this as needing clarification
- Just moves to next question
- Should offer helpful guidance about affordability range

---

### Issue 3: Poor State Abbreviation Support

The system doesn't handle:
- Full state names ("Florida", "California")
- Mixed case ("Fl", "Ca")
- Common abbreviations ("Fla", "Calif")

---

## Why This Creates a Terrible Experience

1. **User provides answer** → "fl"
2. **System doesn't extract** → property_state remains empty
3. **System moves to next question** → asks about price
4. **User confused** → "it depends..."
5. **System checks missing slots** → finds property_state missing
6. **System asks again** → "Which state?"
7. **User frustrated** → already answered!

---

## Solution

### Fix 1: Make State Extraction Case-Insensitive

**File:** `src/extraction_helpers.py`
**Line:** 155

**Change from:**
```python
state_match = re.search(r'\b([A-Z]{2})\b', text)
```

**Change to:**
```python
state_match = re.search(r'\b([A-Za-z]{2})\b', text, re.IGNORECASE)
if state_match:
    result["state"] = state_match.group(1).upper()
```

### Fix 2: Add Common State Names

**Add state name mapping:**
```python
STATE_NAMES = {
    'florida': 'FL', 'california': 'CA', 'texas': 'TX', 
    'new york': 'NY', 'illinois': 'IL', 'pennsylvania': 'PA',
    # ... add all 50 states
}

# Check for full state names
text_lower = text.lower()
for name, abbrev in STATE_NAMES.items():
    if name in text_lower:
        result["state"] = abbrev
        break
```

### Fix 3: Handle "It Depends" Responses

**File:** `src/slot_graph.py`

Add special handling for indirect responses:
```python
if "depends" in last_user_msg.lower() and last_asked == "property_price":
    # Provide helpful guidance
    if down_payment := get_slot_value(state, "down_payment"):
        min_price = down_payment * 4  # 25% down minimum
        max_price = down_payment * 5  # 20% down comfortable
        response = f"With your ${down_payment:,.0f} down payment, you could look at properties from ${min_price:,.0f} to ${max_price:,.0f}. What range interests you?"
    else:
        response = "I can help calculate that. How much do you have for a down payment?"
```

---

## Testing After Fix

```python
# Test cases that should work
"fl" → FL
"FL" → FL  
"Florida" → FL
"florida" → FL
"miami, fl" → Miami, FL
"Miami, Florida" → Miami, FL
```

---

## Alternative: Revert to Old System

Given the multiple issues, consider reverting to the old system until fixes are tested:

1. Old system has been in production longer
2. Has better error handling
3. While not perfect, provides better experience

**To revert in Render dashboard:**
```
Change: cd mortgage-agent && uvicorn src.slot_api:app
To:     cd mortgage-agent && uvicorn src.api:app
```

---

## Priority

**HIGH PRIORITY:** Fix case-sensitive extraction
- This affects EVERY user who types lowercase
- Simple regex fix
- Big impact on user experience

**MEDIUM PRIORITY:** Add state name support
- Nice to have for full names
- Can be added incrementally

**LOW PRIORITY:** Handle indirect responses
- Edge case but improves conversational flow
- Can be enhanced over time