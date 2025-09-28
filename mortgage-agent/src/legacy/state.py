"""
================================================================================
STATE.PY - THE DATA STRUCTURE / FILING CABINET
================================================================================

This file defines the structure of all data we collect during a conversation.

MAIN RESPONSIBILITY:
Define the GraphState data structure that holds ALL information for a conversation

THINK OF IT LIKE: A paper form with labeled boxes
- Each field is a box on the form
- Some boxes hold text (strings), some hold numbers, some hold yes/no (booleans)
- The form gets passed around between api.py, graph.py, and nodes.py
- Each component reads from and writes to this form

KEY CONCEPTS:
- TypedDict = Python's way of defining a dictionary structure with specific fields
- Optional = Field can be None (not yet filled in) or have a value
- This is NOT a class with methods - it's just a data structure definition

STRUCTURE:
1. Property & Finance Data (Q1-Q4)
2. Identification & Status (Q5-Q6)
3. Income & Backing (Q7-Q8)
4. Conversation Management (tracking, messages)
5. Verification & Correction (special states)

USAGE EXAMPLE:
    state = {
        "down_payment": 50000,        # User provided this
        "property_city": None,         # Not yet asked
        "messages": [...],             # Full chat history
        "current_question": 2          # We're on Q2 (location)
    }
"""
from typing import TypedDict, List, Optional, Dict


class GraphState(TypedDict):
    """
    ============================================================================
    COMPLETE STATE DEFINITION FOR MORTGAGE PRE-APPROVAL CONVERSATIONS
    ============================================================================
    
    This TypedDict defines every piece of data we track during a conversation.
    Think of it as a comprehensive form with all the boxes we need to fill in.
    
    The state flows through this pipeline:
    User Message → api.py → graph.py → nodes.py → rules_engine.py → final_decision
                     ↓          ↓          ↓             ↓
                  Creates   Modifies   Updates      Reads
                   state     fields    fields       fields
    
    CRITICAL: All components share this SAME state object, so any changes
    made in one place are visible everywhere else.
    """
    
    # =========================================================================
    # SECTION 1: PROPERTY & FINANCE INFORMATION (Questions 1-4)
    # =========================================================================
    # These fields collect basic information about the property purchase
    
    property_city: Optional[str]
    """
    Q2: What city is the property in?
    Examples: "Miami", "Dallas", "Seattle"
    Used by: rules_engine.py (potentially for location-specific rules)
    """
    
    property_state: Optional[str]
    """
    Q2: What state is the property in?
    Examples: "FL", "Texas", "Washington"
    Used by: rules_engine.py (potentially for state-specific regulations)
    """
    
    loan_purpose: Optional[str]
    """
    Q3: What is the purpose of this loan?
    MUST BE ONE OF: "personal", "second", "investment"
    
    Values explained:
    - "personal": Primary residence where borrower will live
    - "second": Vacation home or second residence
    - "investment": Rental property or investment property
    
    CRITICAL: rules_engine.py expects EXACTLY these three values!
    Do NOT use "primary residence" or other variations!
    
    Used by: rules_engine.py (affects LTV requirements and eligibility)
    """
    
    property_price: Optional[float]
    """
    Q4: How much does the property cost?
    Examples: 500000.0 (for $500k), 1500000.0 (for $1.5M)
    Minimum: 100000.0 ($100k)
    
    Used by: rules_engine.py (calculate LTV = loan / property_price)
    """
    
    down_payment: Optional[float]
    """
    Q1: How much money do you have for a down payment?
    Examples: 50000.0 (for $50k), 200000.0 (for $200k)
    Minimum: 1000.0 ($1k)
    
    Used by: rules_engine.py (calculate LTV and verify minimum down payment)
    """
    
    # =========================================================================
    # SECTION 2: IDENTIFICATION & STATUS (Questions 5-6)
    # =========================================================================
    # These fields verify the borrower's legal status and documentation
    
    has_valid_passport: Optional[bool]
    """
    Q5a: Do you have a valid passport?
    Values: True (yes), False (no), None (not yet answered)
    
    Used by: rules_engine.py (verify borrower identity documentation)
    """
    
    has_valid_visa: Optional[bool]
    """
    Q5b: Do you have a valid U.S. visa?
    Values: True (yes), False (no), None (not yet answered)
    
    Used by: rules_engine.py (verify legal status to purchase property)
    Note: Either passport OR visa is typically required
    """
    
    current_location: Optional[str]
    """
    Q6: Where are you currently located?
    Values: "USA" or "Origin Country"
    
    Used by: rules_engine.py (may affect verification process)
    Note: Being in USA may make documentation verification easier
    """
    
    # =========================================================================
    # SECTION 3: INCOME & BACKING (Questions 7-8)
    # =========================================================================
    # These fields verify the borrower's financial stability
    
    can_demonstrate_income: Optional[bool]
    """
    Q7: Can you demonstrate income with documentation?
    Values: True (yes), False (no), None (not yet answered)
    
    Documentation could include:
    - Bank statements
    - Tax returns
    - Pay stubs
    - Business financial records
    
    Used by: rules_engine.py (critical for loan approval)
    Note: Being able to demonstrate income is usually required
    """
    
    has_reserves: Optional[bool]
    """
    Q8: Do you have cash reserves (6-12 months of payments)?
    Values: True (yes), False (no), None (not yet answered)
    
    Reserves = Savings that can cover mortgage payments if income stops
    Typical requirement: 6-12 months of mortgage payments saved
    
    Used by: rules_engine.py (shows financial stability)
    Note: Having reserves significantly improves approval chances
    """
    
    # =========================================================================
    # SECTION 4: CONVERSATION MANAGEMENT
    # =========================================================================
    # These fields control the flow and tracking of the conversation
    
    messages: List[dict]
    """
    Full chat history between user and assistant.
    
    Format: List of message dictionaries
    Each message: {"role": "user" or "assistant", "content": "message text"}
    
    Example:
    [
        {"role": "user", "content": "I have $50k saved"},
        {"role": "assistant", "content": "Great! Where is the property located?"},
        {"role": "user", "content": "Miami, Florida"}
    ]
    
    Used by:
    - api.py: Stores messages between API calls
    - nodes.py: Provides context to LLM for natural conversation
    - graph.py: Reads to understand user's latest message
    
    CRITICAL: This maintains conversation context across multiple API calls!
    """
    
    current_question: Optional[int]
    """
    Which question (1-8) are we currently asking?
    
    Values: 1-8 (during questions), 9 (triggers verification), None (not started)
    
    Question mapping:
    1 = Down payment (Q1)
    2 = Property location (Q2)
    3 = Loan purpose (Q3)
    4 = Property price (Q4)
    5 = Passport/visa (Q5)
    6 = Current location (Q6)
    7 = Income documentation (Q7)
    8 = Cash reserves (Q8)
    9 = All questions answered, ready for verification
    
    Used by:
    - graph.py: Determines which question to ask next
    - nodes.py: Generates appropriate question text
    - api.py: Tracks progress through conversation
    
    CRITICAL: This is how we maintain sequential flow across API calls!
    """
    
    asked_counts: Dict[int, int]
    """
    Track how many times we've asked each question.
    
    Format: {question_number: attempt_count}
    Example: {1: 2, 2: 1, 3: 3}
    
    Used for force progression after 2 attempts with valid data.
    Prevents infinite loops on the same question.
    """
    
    last_asked_q: Optional[int]
    """Last question number that was emitted to user."""
    
    last_prompt_hash: Optional[str]
    """
    Hash of the last prompt sent to avoid duplicate emissions.
    Prevents asking the exact same question twice in a row.
    """
    
    conversation_complete: bool
    """
    Has the conversation finished (final decision made)?
    
    Values: True (done), False (still in progress)
    
    Used by:
    - api.py: Determines if conversation can be closed
    - graph.py: Prevents further processing after completion
    - Frontend: Can disable input or show completion message
    """
    
    final_decision: Optional[str]
    """
    The final pre-approval decision.
    
    Values: "Pre-Approved", "Rejected", "Needs Review", or None (not yet decided)
    
    "Pre-Approved": Applicant meets all requirements
    "Rejected": Applicant does not meet minimum requirements
    "Needs Review": Borderline case requiring manual review
    
    Used by:
    - api.py: Sends decision back to user
    - rules_engine.py: Sets this value based on collected data
    - Frontend: Displays approval status to user
    """
    
    # =========================================================================
    # SECTION 5: VERIFICATION & CORRECTION FLOW
    # =========================================================================
    # These fields manage the final verification and correction process
    
    awaiting_verification: Optional[bool]
    """
    Are we waiting for user to confirm collected data?
    
    Values: True (waiting for yes/no), False/None (not in verification)
    
    When True, the system has asked:
    "Here's what I collected: [lists all data]. Is this correct?"
    
    Expected user response: "yes" (proceed) or "no" (make corrections)
    
    Used by:
    - graph.py: Routes to verification confirmation logic
    - nodes.py: Generates verification summary message
    
    Flow:
    All Q1-Q8 answered → awaiting_verification=True → User confirms → final decision
    """
    
    verification_complete: Optional[bool]
    """
    Has the user confirmed the collected data?
    
    Values: True (confirmed), False/None (not yet confirmed)
    
    When True, user has reviewed and approved all collected information,
    and we can proceed to final decision.
    
    Used by:
    - graph.py: Determines when to call final_decision_node()
    - nodes.py: Prevents re-asking verification
    
    Flow:
    awaiting_verification=True → User says "yes" → verification_complete=True → final decision
    """
    
    correction_mode: Optional[bool]
    """
    Is the user currently making corrections to collected data?
    
    Values: True (making corrections), False/None (normal flow)
    
    When True, user has indicated some collected data was wrong:
    "Actually, the property price should be $900k"
    "I'm in the USA, not my origin country"
    
    System will:
    1. Extract corrected information
    2. Update affected fields
    3. Return to verification (awaiting_verification=True)
    
    Used by:
    - graph.py: Routes to correction handling logic
    - nodes.py: Generates correction request message
    
    Flow:
    User says "no" at verification → correction_mode=True → Extract corrections → 
    correction_mode=False → Back to awaiting_verification=True
    """