"""
Unit tests for the rules engine (Phase 1 testing requirement).
"""
import pytest
from src.state import GraphState
from src.rules_engine import check_preapproval, calculate_ltv_ratio, get_preapproval_details


def test_check_preapproval_rejected_insufficient_down_payment():
    """Test that less than 25% down payment results in rejection."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 80000.0,  # 20% - less than required 25%
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Rejected"


def test_check_preapproval_approved_all_conditions_met():
    """Test that all conditions met results in pre-approval."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL", 
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,  # 30% - meets requirement
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Pre-Approved"


def test_check_preapproval_rejected_no_passport():
    """Test rejection when passport is missing."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,
        "has_valid_passport": False,  # Missing passport
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Rejected"


def test_check_preapproval_rejected_no_visa():
    """Test rejection when visa is missing."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal", 
        "property_price": 400000.0,
        "down_payment": 120000.0,
        "has_valid_passport": True,
        "has_valid_visa": False,  # Missing visa
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Rejected"


def test_check_preapproval_rejected_no_reserves():
    """Test rejection when reserves are insufficient."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": False,  # No reserves
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Rejected"


def test_check_preapproval_rejected_no_income_documentation():
    """Test rejection when income cannot be demonstrated."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": False,  # Cannot demonstrate income
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Rejected"


def test_check_preapproval_needs_review_missing_data():
    """Test 'Needs Review' when required data is missing."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": None,  # Missing property price
        "down_payment": 120000.0,
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = check_preapproval(state)
    assert result == "Needs Review"


def test_calculate_ltv_ratio():
    """Test LTV ratio calculation."""
    # 75% LTV (25% down payment)
    assert calculate_ltv_ratio(400000, 100000) == 0.75
    
    # 80% LTV (20% down payment) 
    assert calculate_ltv_ratio(400000, 80000) == 0.80
    
    # 70% LTV (30% down payment)
    assert calculate_ltv_ratio(400000, 120000) == 0.70


def test_get_preapproval_details():
    """Test detailed pre-approval analysis."""
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,  # 30%
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    details = get_preapproval_details(state)
    
    assert details["property_price"] == 400000.0
    assert details["down_payment"] == 120000.0
    assert details["down_payment_percentage"] == 30.0
    assert details["ltv_ratio"] == 70.0
    assert details["loan_amount"] == 280000.0
    assert details["meets_ltv_requirement"] == True
    assert details["meets_down_payment_requirement"] == True
    assert details["has_documentation"] == True
    assert details["has_income_proof"] == True
    assert details["has_reserves"] == True
    assert details["decision"] == "Pre-Approved"


if __name__ == "__main__":
    pytest.main([__file__])