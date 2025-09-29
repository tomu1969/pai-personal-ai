"""
================================================================================
SLOT_STATE.PY - SLOT-FILLING STATE WITH CONFIDENCE TRACKING
================================================================================

New state schema for opportunistic slot-filling approach.
Each slot tracks: value, confidence, source, and last seen turn.
"""

from typing import TypedDict, Optional, List, Dict, Any, Literal


class SlotValue(TypedDict):
    """Individual slot with metadata."""
    value: Any  # The actual value
    confidence: float  # 0.0-1.0
    source: Literal["deterministic", "llm", "user_confirm"]  # How extracted
    last_seen_turn: int  # Which turn was this captured
    last_confirmed_turn: Optional[int]  # When user confirmed it


class SlotFillingState(TypedDict):
    """
    State for slot-filling mortgage pre-qualification.
    
    Business-critical slots in priority order:
    1. loan_purpose (determines LTV requirements)
    2. property_location (city, state)
    3. property_price & down_payment (LTV calculation)
    4. passport & visa (documentation requirement)
    5. current_location (affects processing)
    6. income_documentation (required for approval)
    7. reserves (6-12 months requirement)
    """
    
    # =========================================================================
    # SLOT VALUES (with confidence tracking)
    # =========================================================================
    
    slots: Dict[str, SlotValue]
    """
    All extracted slots with metadata.
    
    Keys: 
    - loan_purpose: "personal", "second", "investment"
    - property_city: str
    - property_state: str
    - property_price: float
    - down_payment: float
    - has_valid_passport: bool
    - has_valid_visa: bool
    - current_location: "USA" | "Origin Country"
    - can_demonstrate_income: bool
    - has_reserves: bool
    
    Example:
    {
        "down_payment": {
            "value": 200000.0,
            "confidence": 1.0,
            "source": "deterministic",
            "last_seen_turn": 1,
            "last_confirmed_turn": None
        }
    }
    """
    
    # =========================================================================
    # PRIORITY QUEUE
    # =========================================================================
    
    priority_order: List[str]
    """
    Business-critical priority order for asking questions.
    
    Default: [
        "loan_purpose",         # Affects LTV limits
        "property_city",        # Location
        "property_state",       # Location  
        "property_price",       # LTV calculation
        "down_payment",         # LTV calculation
        "has_valid_passport",   # Required documentation
        "has_valid_visa",       # Required documentation
        "current_location",     # Processing requirements
        "can_demonstrate_income",  # Approval requirement
        "has_reserves"          # Approval requirement
    ]
    """
    
    last_slot_asked: Optional[str]
    """Last slot we asked about to avoid immediate repeats."""
    
    slot_ask_counts: Dict[str, int]
    """How many times we've asked about each slot."""
    
    # =========================================================================
    # CONVERSATION TRACKING
    # =========================================================================
    
    messages: List[Dict[str, str]]
    """Message history: [{"role": "user"|"assistant", "content": "..."}]"""
    
    turn_number: int
    """Current turn number (increments with each user message)."""
    
    # =========================================================================
    # CONFIRMATION & VALIDATION
    # =========================================================================
    
    pending_confirmation: Optional[Dict[str, Any]]
    """
    Slots awaiting user confirmation.
    
    Format: {
        "slot_name": SlotValue,
        "prompt": "Captured: down_payment $200k. Correct?"
    }
    """
    
    awaiting_verification: bool
    """True when all slots filled and waiting for final yes/no."""
    
    verification_complete: bool
    """True after user confirmed all data."""
    
    validation_errors: List[Dict[str, str]]
    """
    Business rule violations.
    
    Format: [
        {"rule": "min_down_payment", "message": "Down payment must be ≥25%", "severity": "error"}
    ]
    """
    
    # =========================================================================
    # COMPLETION
    # =========================================================================
    
    conversation_complete: bool
    """True when final decision made."""
    
    final_decision: Optional[str]
    """Pre-Approved | Rejected | Needs Review"""
    
    # =========================================================================
    # IDEMPOTENCY
    # =========================================================================
    
    last_prompt_hash: Optional[str]
    """Hash of last prompt to suppress exact duplicates."""
    
    correction_mode: bool
    """True when user is correcting a specific value."""


def create_slot_state() -> SlotFillingState:
    """Initialize empty slot-filling state."""
    return {
        # Slots
        "slots": {},
        
        # Priority queue
        "priority_order": [
            "down_payment",         # FIRST - determines affordability
            "loan_purpose",         # Affects LTV requirements
            "property_city",        # Location
            "property_state",       # Only if needed
            "property_price",       # Based on affordability range
            "has_valid_passport",   # Documentation
            "has_valid_visa",       # Documentation
            "current_location",     # Processing
            "can_demonstrate_income",  # Approval
            "has_reserves"          # Approval
        ],
        "last_slot_asked": None,
        "slot_ask_counts": {},
        
        # Conversation
        "messages": [],
        "turn_number": 0,
        
        # Confirmation
        "pending_confirmation": None,
        "awaiting_verification": False,
        "verification_complete": False,
        "validation_errors": [],
        
        # Completion
        "conversation_complete": False,
        "final_decision": None,
        
        # Idempotency
        "last_prompt_hash": None,
        "correction_mode": False
    }


def get_slot_value(state: SlotFillingState, slot_name: str) -> Any:
    """Get the actual value of a slot, or None if not present."""
    slot = state["slots"].get(slot_name)
    return slot["value"] if slot else None


def get_slot_confidence(state: SlotFillingState, slot_name: str) -> float:
    """Get confidence score for a slot, or 0.0 if not present."""
    slot = state["slots"].get(slot_name)
    return slot["confidence"] if slot else 0.0


def set_slot(
    state: SlotFillingState,
    slot_name: str,
    value: Any,
    confidence: float,
    source: Literal["deterministic", "llm", "user_confirm"]
) -> None:
    """Set or update a slot value."""
    state["slots"][slot_name] = {
        "value": value,
        "confidence": confidence,
        "source": source,
        "last_seen_turn": state["turn_number"],
        "last_confirmed_turn": None
    }


def is_slot_filled(state: SlotFillingState, slot_name: str, min_confidence: float = 0.6) -> bool:
    """Check if a slot is filled with sufficient confidence."""
    return get_slot_confidence(state, slot_name) >= min_confidence


def get_missing_slots(state: SlotFillingState, min_confidence: float = 0.6) -> List[str]:
    """Get list of slots that need to be filled, in priority order."""
    return [
        slot for slot in state["priority_order"]
        if not is_slot_filled(state, slot, min_confidence)
    ]


def score_slot_priority(slot_name: str, state: SlotFillingState, recent_mentions: List[str]) -> float:
    """
    Score slot priority based on multiple factors.
    
    Args:
        slot_name: Slot to score
        state: Current conversation state
        recent_mentions: Slots mentioned in last turn
    
    Returns:
        Priority score (higher = more important to ask)
    """
    score = 0.0
    
    # Factor 1: Missingness (highest priority)
    confidence = get_slot_confidence(state, slot_name)
    if confidence < 0.6:
        score += 10.0
    elif confidence < 0.8:
        score += 5.0  # Partially filled, but could be improved
    
    # Factor 2: Dependencies (need certain info before others)
    if slot_name == "has_reserves":
        # Need property price to calculate reserves amount
        if get_slot_value(state, "property_price") and get_slot_value(state, "down_payment"):
            score += 8.0  # Can give precise answer
        else:
            score -= 2.0  # Better to wait until we have price info
    
    if slot_name == "property_price":
        # Need down payment to suggest affordable range
        if get_slot_value(state, "down_payment"):
            score += 6.0  # Can suggest affordable range
    
    # Factor 2b: Financial information priority boost
    if slot_name in ["down_payment", "loan_purpose"]:
        # Financial basics should be asked first
        score += 6.0
    elif slot_name in ["property_city", "property_price"]:
        # Location and price are secondary priorities
        score += 3.0
    elif slot_name in ["has_valid_passport", "has_valid_visa"]:
        # Documentation slots come after financial basics
        score += 1.0
    
    # Factor 3: Recency boost (mentioned in recent turn)
    if slot_name in recent_mentions:
        score += 7.0
        print(f">>> Recency boost for {slot_name}")
    
    # Factor 4: Penalize repeated asks
    ask_count = state["slot_ask_counts"].get(slot_name, 0)
    score -= ask_count * 3.0
    
    # Factor 5: Avoid immediate repeat of last asked
    if slot_name == state.get("last_slot_asked"):
        score -= 15.0  # Strong penalty
    
    return score


def extract_recent_mentions(last_user_message: str, extracted_slots: Dict[str, Any]) -> List[str]:
    """
    Extract which slots were recently mentioned by user or extracted.
    
    Args:
        last_user_message: User's last message
        extracted_slots: Slots extracted from last message
    
    Returns:
        List of slot names that were recently mentioned
    """
    mentions = []
    
    # Add any slots that were extracted from last message
    mentions.extend(extracted_slots.keys())
    
    # Look for explicit mentions in message text
    text_lower = last_user_message.lower()
    
    if any(word in text_lower for word in ['down', 'deposit']):
        mentions.append("down_payment")
    
    if any(word in text_lower for word in ['price', 'cost', 'worth', 'afford']):
        mentions.append("property_price")
    
    if any(word in text_lower for word in ['city', 'location', 'where', 'neighborhood']):
        mentions.extend(["property_city", "property_state"])
    
    if any(word in text_lower for word in ['passport']):
        mentions.append("has_valid_passport")
    
    if any(word in text_lower for word in ['visa']):
        mentions.append("has_valid_visa")
    
    if any(word in text_lower for word in ['reserves', 'savings']):
        mentions.append("has_reserves")
    
    if any(word in text_lower for word in ['income', 'documents', 'documentation']):
        mentions.append("can_demonstrate_income")
    
    return list(set(mentions))  # Remove duplicates


def get_next_slot_to_ask(state: SlotFillingState, last_user_message: str = "", extracted_slots: Dict[str, Any] = None) -> Optional[str]:
    """
    Get the next slot to ask about using smart scoring system.
    
    Args:
        state: Current conversation state
        last_user_message: User's last message for context
        extracted_slots: Recently extracted slots
    
    Returns:
        Next slot to ask about, or None if all filled
    """
    missing = get_missing_slots(state)
    if not missing:
        return None
    
    # Extract what was recently mentioned
    extracted_slots = extracted_slots or {}
    recent_mentions = extract_recent_mentions(last_user_message, extracted_slots)
    
    # Score all missing slots
    scored_slots = []
    for slot in missing:
        score = score_slot_priority(slot, state, recent_mentions)
        scored_slots.append((slot, score))
    
    # Sort by score (highest first)
    scored_slots.sort(key=lambda x: x[1], reverse=True)
    
    print(f">>> Slot scoring:")
    for slot, score in scored_slots[:5]:  # Show top 5
        ask_count = state["slot_ask_counts"].get(slot, 0)
        print(f"    {slot}: {score:.1f} (asked {ask_count} times)")
    
    # Return highest scoring slot
    if scored_slots and scored_slots[0][1] > 0:
        return scored_slots[0][0]
    
    # Fallback: return first missing if all scores are negative
    return missing[0] if missing else None