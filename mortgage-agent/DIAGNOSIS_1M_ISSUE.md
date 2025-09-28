# Diagnosis: "Property Price Asked Twice" Issue

## Root Causes (TWO separate issues)

### Issue 1: "300k" Extracted as Wrong Slot
**What happened:**
- Assistant asked: "How much you have saved for the down payment?"
- User answered: "300k"
- System extracted: `property_price = $300,000` ❌ (should be `down_payment`)

**Why:**
```python
# slot_extraction.py lines 65-70
if val >= 100000:
    if "down" in text.lower():
        extracted["down_payment"] = (val, 1.0, "deterministic")
    else:
        extracted["property_price"] = (val, 0.8, "deterministic")  # ← THIS
```

- "300k" = $300,000 >= $100,000
- "down" keyword NOT in "300k"
- Defaults to property_price

**Impact:** System never captures down_payment correctly

---

### Issue 2: "1m" Not Extracted At All
**What happened:**
- Assistant asked: "What's the property price?"
- User answered: "1m"
- System extracted: NOTHING ❌

**Why:**
```python
# slot_extraction.py line 126
t = re.sub(r'\b(\d+(?:\.\d+)?)\s*(?:million|mill?|mm)\b', ...)
```

Pattern matches: "million", "mill", "mil", "mm"
Pattern does NOT match: "m", "M"

**Test Results:**
```
❌ '1m'         → []
❌ '1M'         → []  
❌ '1.5m'       → []
❌ '$1m'        → []
✅ '1mm'        → [2000000.0]
✅ '1mil'       → [1000000.0]
✅ '1 million'  → [1000000.0]
```

**Impact:** "1m" completely ignored, property_price stays at wrong value ($300k)

---

## Combined Effect

1. User says "300k" (for down payment) → extracted as property_price
2. User says "1m" (for property price) → NOT extracted at all
3. System state: `property_price = $300k` (from message 1)
4. After all questions answered, property_price is still wrong
5. System asks again: "Can you let me know the property price range you're considering?"

**The user already answered (message 5: "1m"), but system didn't capture it.**

---

## Solution Options

### Recommended: Hybrid Approach (Option 1 + Option 4)

#### Part A: Fix Regex for "1m" Pattern
```python
# Change line 126 from:
r'\b(\d+(?:\.\d+)?)\s*(?:million|mill?|mm)\b'

# To:
r'\b(\d+(?:\.\d+)?)\s*(?:m|mm|mil|million)\b'
```

**Pros:** Handles "1m", "1M", "1.5m", "$1m"
**Cons:** Small risk of false positives ("5m away")
**Mitigation:** In mortgage context, "m" almost always means million

#### Part B: Add Context Awareness
```python
def extract_all_slots(text: str, state: SlotFillingState) -> Dict[...]:
    """Extract with conversation context."""
    extracted = {}
    money_values = extract_all_money(text)
    
    # Get what slot we just asked about
    last_asked = state.get("last_slot_asked")
    
    # If single money value and we just asked about a specific slot
    if len(money_values) == 1 and last_asked:
        val = money_values[0]
        
        if last_asked == "down_payment" and 10000 <= val <= 5000000:
            extracted["down_payment"] = (val, 1.0, "deterministic")
        elif last_asked == "property_price" and 100000 <= val <= 50000000:
            extracted["property_price"] = (val, 1.0, "deterministic")
        # ... continue with fallback logic if not matched
    
    # Continue with existing multi-value logic...
```

**Pros:**
- ✅ Solves "300k" ambiguity (knows we asked about down_payment)
- ✅ Solves "1m" ambiguity (knows we asked about property_price)
- ✅ Still deterministic (fast, predictable)
- ✅ No API costs
- ✅ Higher confidence (1.0 instead of 0.8)

**Cons:**
- Requires passing state to extraction function
- Slightly more complex

---

### Alternative: LLM Fallback (Optional Enhancement)

Add LLM extraction ONLY when deterministic fails:

```python
def extract_with_llm_fallback(text: str, state: SlotFillingState):
    # Try deterministic first
    extracted = extract_all_slots(text, state)
    
    # If no money extracted but text mentions money
    if not has_money_values(extracted):
        money_keywords = ['dollar', 'price', 'cost', 'payment', 'amount']
        if any(kw in text.lower() for kw in money_keywords):
            # Use LLM to extract
            llm_result = llm_extract_money(text, state)
            merge(extracted, llm_result, confidence=0.7)
    
    return extracted
```

**Use Cases:**
- "it depends on the loan amount" → LLM can understand indirect response
- "around a million or so" → LLM handles fuzzy amounts
- "somewhere between 800k and 1.2m" → LLM can extract range

**Pros:** Handles truly ambiguous cases
**Cons:** API cost, latency, potential hallucinations

---

## Implementation Priority

1. **HIGH PRIORITY: Fix "1m" regex** (1 line change)
   - Immediate fix for most common notation
   - Low risk in mortgage context

2. **HIGH PRIORITY: Add context awareness** (20 lines)
   - Fixes "300k" ambiguity
   - Prevents wrong slot assignment
   - Already have `last_slot_asked` in state

3. **MEDIUM PRIORITY: LLM fallback** (50 lines)
   - Nice-to-have for edge cases
   - Can add later if needed

---

## Testing After Fix

```python
# Test case 1: Context aware extraction
Assistant asks: "How much for down payment?"
User: "300k"
Expected: down_payment=$300k ✅ (not property_price)

# Test case 2: "1m" notation
User: "1m"
Expected: property_price=$1,000,000 ✅

# Test case 3: No regression
User: "$200k down on $800k Miami condo"
Expected: down_payment=$200k, property_price=$800k ✅
```
