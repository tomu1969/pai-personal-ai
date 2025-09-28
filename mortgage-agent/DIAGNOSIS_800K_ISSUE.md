# Diagnosis: Property Price Asked Again After "$800k"

## User's Reported Conversation

```
System: Great to hear from you! To get started, can you let me know 
        how much you have saved for the down payment?
User: 250k

System: Thanks for sharing that you have $250,000 saved for the down payment!
        Now, could you let me know where you're looking to purchase the property?
User: I'm interested in South Florida.

System: South Florida sounds like a great choice! Now, can you tell me the 
        purpose of the loan? Are you looking for a personal residence, a 
        second home, or an investment property?
User: I think there's a good appreciation potential because the market has 
      been down. I'm looking to buy and maybe use for a couple of weeks and 
      rent out the rest of the time.

System: It sounds like a solid investment strategy! Now, can you share the 
        price range you're considering for the property?
User: It depends on the loan amount. How much can I get in the mortgage?

System: I understand that the loan amount can influence your price range. 
        With your $250,000 down payment, you could potentially afford 
        properties in the range of $720,000 to $1.2 million. Based on 
        that, what price range would you like to explore?
User: I think I'd be comfortable with $800k.

System: Noted that you're looking for an investment property in South Florida. 
        Now, can you share the property price you're considering for this 
        investment?
        ⬆️ ❌ ASKED AGAIN!
```

## Key Observation

**The user is NOT using the slot-filling system (`slot_api.py`) we just built!**

Evidence:
1. **First question:** Old system asks "how much for down payment?"
   - Slot-filling system asks "What will you use the property for?" (loan_purpose priority)
   
2. **Conversational tone:** "Great to hear from you!", "sounds like a great choice!"
   - Slot-filling system uses direct questions: "What's the property price?"
   
3. **Question flow:** Old system follows Q1→Q2→Q3... sequential order
   - Slot-filling system uses priority queue + opportunistic extraction

## Which System Is Being Used?

The user is using the **OLD LangGraph-based system** (`api.py` + `graph.py`), NOT the new slot-filling system.

**Ports:**
- Old system: `http://localhost:8000` (api.py)
- New system: `http://localhost:8002` (slot_api.py)

## Root Cause Analysis for OLD System

The old system has issues we already documented in PATCHES.md:

###Issue: "$800k" Not Extracted

**What happened:**
```python
User: "I think I'd be comfortable with $800k."
```

**Why extraction might fail in old system:**

1. **No "m" pattern support** (if using old `extraction_helpers.py`)
   - Wait, "$800k" should work...
   
2. **"I think" prefix** - Natural language wrapper
   - Old extraction may focus on exact patterns
   - "I'd be comfortable with $800k" is conversational

3. **Context issues** - User said this in response to:
   - "what price range would you like to explore?"
   - System already had down_payment = $250k
   - "$800k" should be property_price

Let me test the old extraction logic:
```python
# Old extraction (deterministic only)
text = "I think I'd be comfortable with $800k."
# Would extract: $800,000

# But which slot?
# - User previously answered "it depends on loan amount"
# - System responded with a question about "price range"
# - Context: This is clearly property_price
```

**Likely issue:** The old system's extraction probably worked, but:
- The value might not have been properly stored
- Or the question routing logic asked again anyway
- Or there's a bug in the old graph flow

## Why This Happened

The old system (`api.py` + `graph.py`) was NEVER fixed with:
- Context-aware extraction
- Improved money pattern recognition  
- Better slot assignment logic

**We only fixed `slot_api.py` (the new system)!**

## What Needs To Be Done

**Option 1: User should switch to new system**
- Change URL from `http://localhost:8000` to `http://localhost:8002`
- New system has all the fixes

**Option 2: Backport fixes to old system**
- Apply context awareness to old `graph.py`
- Update old extraction logic
- But this is a lot of work for deprecated code

**Option 3: Deploy only new system**
- Deprecate old `api.py`
- Use `slot_api.py` as primary
- Update render.yaml to deploy slot_api

## Testing The Actual Issue

To confirm diagnosis, I need to:
1. Check which system user is accessing
2. Test "$800k" extraction in old system
3. Verify old graph's question routing logic

## Recommendation

**Switch to new slot-filling system immediately:**
1. Update deployment to use `slot_api.py` (port 8002)
2. Update render.yaml start command
3. Deprecate old `api.py`

The new system already has all these fixes:
- ✅ "1m", "$800k", "300k" extraction
- ✅ Context-aware slot assignment
- ✅ No duplicate questions
- ✅ Priority queue
- ✅ Business rules validation

---

## Alternative: Test If Issue Exists in New System

Let me test if "$800k" with conversational prefix works in new system...