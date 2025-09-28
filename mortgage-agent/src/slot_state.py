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
            "loan_purpose",
            "property_city",
            "property_state", 
            "property_price",
            "down_payment",
            "has_valid_passport",
            "has_valid_visa",
            "current_location",
            "can_demonstrate_income",
            "has_reserves"
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


def get_next_slot_to_ask(state: SlotFillingState) -> Optional[str]:
    """
    Get the next slot to ask about based on priority queue.
    
    Rules:
    - Skip slots with confidence >= 0.6
    - Skip slots asked >= 2 times unless critical
    - Skip last_slot_asked to avoid immediate repeat
    """
    missing = get_missing_slots(state)
    
    for slot in missing:
        # Skip if just asked
        if slot == state.get("last_slot_asked"):
            continue
        
        # Skip if asked too many times (unless critical)
        ask_count = state["slot_ask_counts"].get(slot, 0)
        if ask_count >= 2:
            continue
        
        return slot
    
    # If all slots asked 2+ times, return first missing
    return missing[0] if missing else None