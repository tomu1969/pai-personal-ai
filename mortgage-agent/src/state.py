"""
GraphState definition for the mortgage pre-approval chatbot.
Contains all data points from questionnaire.md and message history.
"""
from typing import TypedDict, List, Optional


class GraphState(TypedDict):
    """State object for the mortgage pre-approval graph."""
    
    # Property and Finances (Questions 1-4)
    property_city: Optional[str]
    property_state: Optional[str]
    loan_purpose: Optional[str]  # "personal", "second", or "investment"
    property_price: Optional[float]
    down_payment: Optional[float]
    
    # Identification and Status (Questions 5-6)
    has_valid_passport: Optional[bool]
    has_valid_visa: Optional[bool]
    current_location: Optional[str]  # "origin" or "usa"
    
    # Income and Backing (Questions 7-8)
    can_demonstrate_income: Optional[bool]
    has_reserves: Optional[bool]
    
    # Chat management
    messages: List[dict]  # [{"role": "user/assistant", "content": "..."}]
    current_question: Optional[int]  # Track which question we're on (1-8)
    
    # Conversation management
    conversation_complete: bool
    final_decision: Optional[str]