"""
Pure Python rules engine for mortgage pre-approval.
Applies Foreign Nationals Non-QM Loan Guidelines without any LLM calls.
"""
from typing import Optional
from .state import GraphState


def check_preapproval(state: GraphState) -> str:
    """
    Apply pre-approval rules based on guidelines.md.
    
    Args:
        state: Complete GraphState with all fields populated
        
    Returns:
        "Pre-Approved", "Rejected", or "Needs Review"
    """
    # Check required documentation
    if not state.get("has_valid_passport") or not state.get("has_valid_visa"):
        return "Rejected"
    
    # Check down payment requirement (minimum 25%)
    property_price = state.get("property_price")
    down_payment = state.get("down_payment")
    
    if not property_price or not down_payment:
        return "Needs Review"
    
    try:
        if property_price <= 0 or down_payment <= 0:
            return "Rejected"
    except (TypeError, ValueError):
        return "Needs Review"
    
    # Calculate LTV (Loan-to-Value ratio)
    try:
        ltv_ratio = (property_price - down_payment) / property_price
        
        # Maximum 75% LTV means minimum 25% down payment
        if ltv_ratio > 0.75:
            return "Rejected"
    except (TypeError, ValueError, ZeroDivisionError):
        return "Needs Review"
    
    # Check reserves requirement (6-12 months of mortgage payments)
    if not state.get("has_reserves"):
        return "Rejected"
    
    # Check income documentation capability
    if not state.get("can_demonstrate_income"):
        return "Rejected"
    
    # Check loan purpose (all types allowed: personal, second, investment)
    loan_purpose = state.get("loan_purpose")
    if not loan_purpose or loan_purpose not in ["personal", "second", "investment"]:
        return "Needs Review"
    
    # If all conditions are met
    return "Pre-Approved"


def calculate_ltv_ratio(property_price: float, down_payment: float) -> float:
    """Calculate Loan-to-Value ratio."""
    try:
        if property_price <= 0:
            return 0.0
        return (property_price - down_payment) / property_price
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def calculate_down_payment_percentage(property_price: float, down_payment: float) -> float:
    """Calculate down payment as percentage of property price."""
    try:
        if property_price <= 0:
            return 0.0
        return down_payment / property_price
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def get_preapproval_details(state: GraphState) -> dict:
    """
    Get detailed analysis of the pre-approval.
    
    Returns:
        Dictionary with analysis details
    """
    property_price = state.get("property_price", 0)
    down_payment = state.get("down_payment", 0)
    
    ltv_ratio = calculate_ltv_ratio(property_price, down_payment)
    down_payment_pct = calculate_down_payment_percentage(property_price, down_payment)
    
    try:
        meets_ltv = ltv_ratio <= 0.75
        meets_down_payment = down_payment_pct >= 0.25
        loan_amount = property_price - down_payment
    except (TypeError, ValueError):
        meets_ltv = False
        meets_down_payment = False  
        loan_amount = 0
    
    return {
        "property_price": property_price or 0,
        "down_payment": down_payment or 0,
        "down_payment_percentage": down_payment_pct * 100,
        "ltv_ratio": ltv_ratio * 100,
        "loan_amount": loan_amount,
        "meets_ltv_requirement": meets_ltv,
        "meets_down_payment_requirement": meets_down_payment,
        "has_documentation": state.get("has_valid_passport") and state.get("has_valid_visa"),
        "has_income_proof": state.get("can_demonstrate_income"),
        "has_reserves": state.get("has_reserves"),
        "decision": check_preapproval(state)
    }