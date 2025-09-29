"""
================================================================================
BUSINESS_RULES.PY - FOREIGN NATIONALS NON-QM GUIDELINES ENFORCEMENT
================================================================================

Strictly enforces lending guidelines:
- Purchase only
- No U.S. credit required
- Minimum 25% down / Maximum 75% LTV
- 1-4 unit residential (primary, second, investment)
- Valid passport AND visa required
- Income documentation required
- 6-12 months reserves required
"""

from typing import List, Dict, Tuple, Set
from .slot_state import SlotFillingState, get_slot_value

# =============================================================================
# BUSINESS RULE CONSTANTS - SINGLE SOURCE OF TRUTH
# =============================================================================

# Down payment and LTV requirements
MIN_DOWN_PCT = 0.25  # 25% minimum down payment for Foreign National loans
MAX_LTV = 0.75       # 75% maximum loan-to-value ratio

# Reserves requirements (months of mortgage payments)
MIN_RESERVES_MONTHS = 6   # Minimum 6 months of reserves
MAX_RESERVES_MONTHS = 12  # Recommended 12 months of reserves

# Allowed loan purposes (no refinance for Foreign National)
PURPOSE_ALLOWED: Set[str] = {"personal", "second", "investment"}

# Boolean slots that accept yes/no responses
BOOLEAN_SLOTS: Set[str] = {
    "has_valid_passport", 
    "has_valid_visa", 
    "can_demonstrate_income", 
    "has_reserves"
}


class ValidationError:
    """Business rule violation."""
    
    def __init__(self, rule: str, message: str, severity: str = "error"):
        self.rule = rule
        self.message = message
        self.severity = severity  # "error" | "warning"
    
    def to_dict(self) -> Dict[str, str]:
        return {
            "rule": self.rule,
            "message": self.message,
            "severity": self.severity
        }


def validate_all_rules(state: SlotFillingState) -> List[ValidationError]:
    """
    Run all business rule validations.
    
    Returns list of violations (empty if all pass).
    """
    errors = []
    
    # Get current values
    price = get_slot_value(state, "property_price")
    down = get_slot_value(state, "down_payment")
    purpose = get_slot_value(state, "loan_purpose")
    passport = get_slot_value(state, "has_valid_passport")
    visa = get_slot_value(state, "has_valid_visa")
    income_docs = get_slot_value(state, "can_demonstrate_income")
    reserves = get_slot_value(state, "has_reserves")
    
    # =========================================================================
    # RULE 1: LTV / Down Payment (25% minimum)
    # =========================================================================
    if price and down:
        if price <= 0:
            errors.append(ValidationError(
                "invalid_price",
                "Property price must be positive",
                "error"
            ))
        elif down <= 0:
            errors.append(ValidationError(
                "invalid_down_payment",
                "Down payment must be positive",
                "error"
            ))
        else:
            ltv = (price - down) / price
            down_pct = down / price
            
            if down_pct < MIN_DOWN_PCT:
                errors.append(ValidationError(
                    "min_down_payment",
                    f"Down payment must be ≥{MIN_DOWN_PCT*100:.0f}% of property price. You have {down_pct*100:.1f}% (${down:,.0f} on ${price:,.0f})",
                    "error"
                ))
            
            if ltv > MAX_LTV:
                errors.append(ValidationError(
                    "max_ltv",
                    f"LTV must be ≤{MAX_LTV*100:.0f}%. Your LTV is {ltv*100:.1f}%",
                    "error"
                ))
    
    # =========================================================================
    # RULE 2: Property Type / Loan Purpose
    # =========================================================================
    if purpose:
        valid_purposes = ["personal", "second", "investment"]
        if purpose not in valid_purposes:
            errors.append(ValidationError(
                "invalid_loan_purpose",
                f"Loan purpose must be one of: {', '.join(valid_purposes)}",
                "error"
            ))
    
    # =========================================================================
    # RULE 3: Documentation (Passport AND Visa)
    # =========================================================================
    if passport is False:
        errors.append(ValidationError(
            "missing_passport",
            "Valid passport is required for Foreign Nationals loans",
            "error"
        ))
    
    if visa is False:
        errors.append(ValidationError(
            "missing_visa",
            "Valid visa is required for Foreign Nationals loans",
            "error"
        ))
    
    # =========================================================================
    # RULE 4: Income Documentation
    # =========================================================================
    if income_docs is False:
        errors.append(ValidationError(
            "missing_income_docs",
            "Must be able to demonstrate income with international bank statements, CPA letter, or similar documentation",
            "error"
        ))
    
    # =========================================================================
    # RULE 5: Reserves (6-12 months)
    # =========================================================================
    if reserves is False:
        errors.append(ValidationError(
            "missing_reserves",
            "Must have 6-12 months of mortgage payments saved as reserves",
            "error"
        ))
    
    return errors


def can_make_decision(state: SlotFillingState) -> Tuple[bool, List[str]]:
    """
    Check if we have all required slots to make a decision.
    
    Returns: (ready, missing_slots)
    """
    required_slots = [
        "loan_purpose",
        "property_price",
        "down_payment",
        "has_valid_passport",
        "has_valid_visa",
        "can_demonstrate_income",
        "has_reserves"
    ]
    
    missing = []
    for slot in required_slots:
        if get_slot_value(state, slot) is None:
            missing.append(slot)
    
    return len(missing) == 0, missing


def make_final_decision(state: SlotFillingState) -> str:
    """
    Make final pre-approval decision based on business rules.
    
    Returns: "Pre-Approved" | "Rejected" | "Needs Review"
    """
    errors = validate_all_rules(state)
    
    # Any error = rejection
    if any(e.severity == "error" for e in errors):
        return "Rejected"
    
    # All rules passed
    ready, missing = can_make_decision(state)
    if not ready:
        return "Needs Review"
    
    return "Pre-Approved"


def format_rejection_message(errors: List[ValidationError]) -> str:
    """Format rejection message explaining why."""
    if not errors:
        return "Your application does not meet our Foreign Nationals Non-QM guidelines."
    
    messages = [e.message for e in errors if e.severity == "error"]
    
    if len(messages) == 1:
        return f"Unfortunately, your application does not qualify: {messages[0]}"
    else:
        reasons = "\n".join(f"• {msg}" for msg in messages)
        return f"Unfortunately, your application does not qualify for the following reasons:\n{reasons}"


def format_approval_message(state: SlotFillingState) -> str:
    """Format pre-approval message with details."""
    price = get_slot_value(state, "property_price")
    down = get_slot_value(state, "down_payment")
    purpose = get_slot_value(state, "loan_purpose")
    
    loan_amount = price - down if (price and down) else 0
    ltv = ((price - down) / price * 100) if (price and down and price > 0) else 0
    
    purpose_text = {
        "personal": "primary residence",
        "second": "second home",
        "investment": "investment property"
    }.get(purpose, purpose)
    
    return f"""Congratulations! You are pre-approved for our Foreign Nationals Non-QM loan program.

Loan Details:
• Property Price: ${price:,.0f}
• Down Payment: ${down:,.0f} ({down/price*100:.1f}%)
• Loan Amount: ${loan_amount:,.0f}
• LTV: {ltv:.1f}%
• Property Type: {purpose_text}

This pre-approval is valid for 90 days. Next steps: contact our loan officer to complete the full application."""