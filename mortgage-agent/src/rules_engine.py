"""
================================================================================
RULES_ENGINE.PY - THE JUDGE / DECISION MAKER
================================================================================

This file makes the final Pre-Approval / Rejected / Needs Review decision.

MAIN RESPONSIBILITIES:
1. Check all Foreign Nationals Non-QM Loan Guidelines
2. Calculate financial ratios (LTV, down payment percentage)
3. Validate documentation requirements
4. Return final decision: "Pre-Approved", "Rejected", or "Needs Review"

THINK OF IT LIKE: A loan officer reviewing an application
- Reviews all the information collected
- Checks against strict lending guidelines
- Makes a yes/no decision based on rules (not opinions)

KEY CONCEPTS:
- Pure Python rules (NO AI/LLM involved here)
- Deterministic = Same inputs always produce same output
- LTV (Loan-to-Value) = What percentage of the property needs to be financed
- Down payment % = What percentage of the property price the borrower has saved

LENDING GUIDELINES (Foreign Nationals Non-QM):
1. Minimum 25% down payment (maximum 75% LTV)
2. Valid passport AND valid visa required
3. Must be able to demonstrate income (bank statements, tax returns)
4. Must have 6-12 months cash reserves
5. All loan purposes accepted: personal, second home, investment

DECISION LOGIC:
- Pre-Approved: Meets ALL requirements
- Rejected: Fails ANY critical requirement
- Needs Review: Missing data or borderline case

USAGE FLOW:
All Q1-Q8 answered → Verification confirmed → check_preapproval(state) → Decision
"""
from typing import Optional
from .state import GraphState


# ============================================================================
# MAIN DECISION FUNCTION
# ============================================================================

def check_preapproval(state: GraphState) -> str:
    """
    APPLY ALL PRE-APPROVAL RULES AND MAKE FINAL DECISION
    
    This is the core decision-making function that determines whether
    an applicant is pre-approved for a Foreign Nationals Non-QM mortgage.
    
    DECISION CRITERIA (ALL must be met for Pre-Approval):
    
    1. DOCUMENTATION REQUIREMENT ✓
       - Must have valid passport: has_valid_passport = True
       - Must have valid visa: has_valid_visa = True
       - Both are required for Foreign Nationals loans
    
    2. DOWN PAYMENT REQUIREMENT ✓
       - Minimum 25% of property price required
       - Example: $500k house requires $125k down payment
       - Calculated as: (down_payment / property_price) >= 0.25
    
    3. LTV (Loan-to-Value) REQUIREMENT ✓
       - Maximum 75% LTV allowed
       - LTV = (property_price - down_payment) / property_price
       - Example: $500k house with $125k down = 75% LTV
    
    4. CASH RESERVES REQUIREMENT ✓
       - Must have 6-12 months of mortgage payments saved
       - has_reserves = True
       - Shows financial stability if income stops
    
    5. INCOME DOCUMENTATION REQUIREMENT ✓
       - Must be able to prove income with documentation
       - can_demonstrate_income = True
       - Documents: bank statements, tax returns, pay stubs
    
    6. LOAN PURPOSE VALIDATION ✓
       - loan_purpose must be "personal", "second", or "investment"
       - All three types are allowed for this program
    
    Args:
        state: Complete GraphState with all Q1-Q8 fields populated
        
    Returns:
        "Pre-Approved": Applicant meets all requirements
        "Rejected": Applicant fails one or more critical requirements
        "Needs Review": Missing data or borderline case requiring manual review
    
    EXAMPLE 1 - Pre-Approved:
        property_price: 500000
        down_payment: 125000 (25%)
        has_valid_passport: True
        has_valid_visa: True
        has_reserves: True
        can_demonstrate_income: True
        loan_purpose: "personal"
        → Result: "Pre-Approved"
    
    EXAMPLE 2 - Rejected (insufficient down payment):
        property_price: 500000
        down_payment: 50000 (10% - below 25% requirement)
        → Result: "Rejected"
    
    EXAMPLE 3 - Needs Review (missing data):
        property_price: None
        down_payment: 100000
        → Result: "Needs Review"
    """
    
    # -------------------------------------------------------------------------
    # CHECK 1: DOCUMENTATION (Passport AND Visa required)
    # -------------------------------------------------------------------------
    # Foreign Nationals MUST have both valid passport and valid visa
    # Rejecting immediately if either is missing saves processing time
    if not state.get("has_valid_passport") or not state.get("has_valid_visa"):
        return "Rejected"
    
    # -------------------------------------------------------------------------
    # CHECK 2: PROPERTY PRICE AND DOWN PAYMENT EXIST
    # -------------------------------------------------------------------------
    # Need both values to calculate LTV and down payment percentage
    property_price = state.get("property_price")
    down_payment = state.get("down_payment")
    
    if not property_price or not down_payment:
        # Missing critical financial data - cannot make decision
        return "Needs Review"
    
    # -------------------------------------------------------------------------
    # CHECK 3: VALID POSITIVE VALUES
    # -------------------------------------------------------------------------
    # Property price and down payment must be positive numbers
    # Zero or negative values indicate data error
    try:
        if property_price <= 0 or down_payment <= 0:
            return "Rejected"
    except (TypeError, ValueError):
        # Data type error (e.g., string instead of number)
        return "Needs Review"
    
    # -------------------------------------------------------------------------
    # CHECK 4: LTV (LOAN-TO-VALUE) CALCULATION
    # -------------------------------------------------------------------------
    # Calculate what percentage of the property needs to be financed
    # LTV = Loan Amount / Property Price
    # LTV = (Property Price - Down Payment) / Property Price
    # 
    # Example: $500k house with $125k down
    # Loan Amount = $500k - $125k = $375k
    # LTV = $375k / $500k = 0.75 (75%)
    #
    # Maximum allowed LTV: 75%
    # If LTV > 75%, the down payment is insufficient
    try:
        ltv_ratio = (property_price - down_payment) / property_price
        
        # Maximum 75% LTV means minimum 25% down payment
        if ltv_ratio > 0.75:
            return "Rejected"
    except (TypeError, ValueError, ZeroDivisionError):
        # Calculation error - cannot make decision
        return "Needs Review"
    
    # -------------------------------------------------------------------------
    # CHECK 5: CASH RESERVES (6-12 months savings)
    # -------------------------------------------------------------------------
    # Applicant must have saved cash to cover mortgage payments if income stops
    # This shows financial stability and reduces lender risk
    if not state.get("has_reserves"):
        return "Rejected"
    
    # -------------------------------------------------------------------------
    # CHECK 6: INCOME DOCUMENTATION
    # -------------------------------------------------------------------------
    # Must be able to prove income with bank statements, tax returns, etc.
    # Without income documentation, we cannot verify ability to repay
    if not state.get("can_demonstrate_income"):
        return "Rejected"
    
    # -------------------------------------------------------------------------
    # CHECK 7: LOAN PURPOSE VALIDATION
    # -------------------------------------------------------------------------
    # CRITICAL: Must be one of the three standard values
    # These values come from Q3 and were normalized in graph.py
    #
    # Allowed values:
    # - "personal": Primary residence (borrower will live there)
    # - "second": Second home or vacation property
    # - "investment": Rental property or investment property
    #
    # NOTE: "primary residence" is NOT a valid value!
    # graph.py should have normalized it to "personal"
    loan_purpose = state.get("loan_purpose")
    if not loan_purpose or loan_purpose not in ["personal", "second", "investment"]:
        # Invalid or missing loan purpose - cannot make decision
        return "Needs Review"
    
    # -------------------------------------------------------------------------
    # ALL CHECKS PASSED - PRE-APPROVED!
    # -------------------------------------------------------------------------
    # Applicant meets all Foreign Nationals Non-QM Loan requirements:
    # ✓ Valid passport and visa
    # ✓ At least 25% down payment
    # ✓ LTV at or below 75%
    # ✓ 6-12 months cash reserves
    # ✓ Can demonstrate income
    # ✓ Valid loan purpose
    return "Pre-Approved"


# ============================================================================
# CALCULATION HELPER FUNCTIONS
# ============================================================================

def calculate_ltv_ratio(property_price: float, down_payment: float) -> float:
    """
    CALCULATE LOAN-TO-VALUE (LTV) RATIO
    
    LTV represents what percentage of the property value needs to be financed.
    Lower LTV = More down payment = Less risk for lender
    
    Formula: LTV = (Property Price - Down Payment) / Property Price
    
    Examples:
    - $500k property, $125k down → LTV = ($375k / $500k) = 0.75 (75%)
    - $500k property, $250k down → LTV = ($250k / $500k) = 0.50 (50%)
    - $1M property, $300k down → LTV = ($700k / $1M) = 0.70 (70%)
    
    Args:
        property_price: Total price of the property
        down_payment: Amount of down payment saved
        
    Returns:
        LTV as decimal (0.75 = 75%), or 0.0 if calculation fails
    """
    try:
        if property_price <= 0:
            return 0.0
        return (property_price - down_payment) / property_price
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def calculate_down_payment_percentage(property_price: float, down_payment: float) -> float:
    """
    CALCULATE DOWN PAYMENT AS PERCENTAGE OF PROPERTY PRICE
    
    This is the inverse of LTV - shows what percentage the borrower is paying upfront.
    Higher down payment % = Lower risk for lender
    
    Formula: Down Payment % = Down Payment / Property Price
    
    Examples:
    - $500k property, $125k down → 25% down payment
    - $500k property, $250k down → 50% down payment
    - $1M property, $300k down → 30% down payment
    
    Minimum requirement: 25% for Foreign Nationals Non-QM loans
    
    Args:
        property_price: Total price of the property
        down_payment: Amount of down payment saved
        
    Returns:
        Down payment as decimal (0.25 = 25%), or 0.0 if calculation fails
    """
    try:
        if property_price <= 0:
            return 0.0
        return down_payment / property_price
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


# ============================================================================
# DETAILED ANALYSIS FUNCTION
# ============================================================================

def get_preapproval_details(state: GraphState) -> dict:
    """
    GET COMPREHENSIVE PRE-APPROVAL ANALYSIS WITH ALL DETAILS
    
    This function provides a complete breakdown of the pre-approval decision,
    including all calculations, requirement checks, and the final decision.
    
    Useful for:
    - Generating detailed approval/rejection letters
    - Debugging why a decision was made
    - Providing transparency to applicants
    - Creating detailed logs and reports
    
    Args:
        state: Complete GraphState with all Q1-Q8 fields populated
        
    Returns:
        Dictionary containing:
        {
            # Financial Details
            "property_price": 500000.0,
            "down_payment": 125000.0,
            "loan_amount": 375000.0,
            "down_payment_percentage": 25.0,
            "ltv_ratio": 75.0,
            
            # Requirement Checks
            "meets_ltv_requirement": True,
            "meets_down_payment_requirement": True,
            "has_documentation": True,
            "has_income_proof": True,
            "has_reserves": True,
            
            # Final Decision
            "decision": "Pre-Approved"
        }
    
    EXAMPLE OUTPUT - Pre-Approved Case:
    {
        "property_price": 500000,
        "down_payment": 125000,
        "down_payment_percentage": 25.0,
        "ltv_ratio": 75.0,
        "loan_amount": 375000,
        "meets_ltv_requirement": True,
        "meets_down_payment_requirement": True,
        "has_documentation": True,
        "has_income_proof": True,
        "has_reserves": True,
        "decision": "Pre-Approved"
    }
    
    EXAMPLE OUTPUT - Rejected Case (insufficient down payment):
    {
        "property_price": 500000,
        "down_payment": 50000,
        "down_payment_percentage": 10.0,
        "ltv_ratio": 90.0,
        "loan_amount": 450000,
        "meets_ltv_requirement": False,
        "meets_down_payment_requirement": False,
        "has_documentation": True,
        "has_income_proof": True,
        "has_reserves": True,
        "decision": "Rejected"
    }
    """
    # Get financial values from state
    property_price = state.get("property_price", 0)
    down_payment = state.get("down_payment", 0)
    
    # Calculate ratios
    ltv_ratio = calculate_ltv_ratio(property_price, down_payment)
    down_payment_pct = calculate_down_payment_percentage(property_price, down_payment)
    
    # Calculate loan amount and check requirements
    try:
        meets_ltv = ltv_ratio <= 0.75  # Maximum 75% LTV
        meets_down_payment = down_payment_pct >= 0.25  # Minimum 25% down
        loan_amount = property_price - down_payment
    except (TypeError, ValueError):
        meets_ltv = False
        meets_down_payment = False  
        loan_amount = 0
    
    # Build comprehensive analysis dictionary
    return {
        # ===== Financial Details =====
        "property_price": property_price or 0,
        "down_payment": down_payment or 0,
        "down_payment_percentage": down_payment_pct * 100,  # Convert to percentage
        "ltv_ratio": ltv_ratio * 100,  # Convert to percentage
        "loan_amount": loan_amount,
        
        # ===== Requirement Checks =====
        "meets_ltv_requirement": meets_ltv,
        "meets_down_payment_requirement": meets_down_payment,
        "has_documentation": state.get("has_valid_passport") and state.get("has_valid_visa"),
        "has_income_proof": state.get("can_demonstrate_income"),
        "has_reserves": state.get("has_reserves"),
        
        # ===== Final Decision =====
        "decision": check_preapproval(state)
    }