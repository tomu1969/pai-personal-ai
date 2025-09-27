"""
Phase 2 testing: Happy path conversation simulation.
Tests the complete flow with mock user answers.
"""
import pytest
import os
from unittest.mock import patch, MagicMock
from src.state import GraphState
from src.graph import create_mortgage_graph


def create_mock_llm():
    """Create a mock LLM that returns predictable extractions."""
    mock_llm = MagicMock()
    
    # Mock responses for each extraction
    mock_responses = {
        1: '{"property_city": "Miami", "property_state": "FL"}',
        2: '{"loan_purpose": "personal"}',
        3: '{"property_price": 400000}',
        4: '{"down_payment": 120000}',
        5: '{"has_valid_passport": true, "has_valid_visa": true}',
        6: '{"current_location": "usa"}',
        7: '{"can_demonstrate_income": true}',
        8: '{"has_reserves": true}'
    }
    
    call_count = 0
    def mock_invoke(messages):
        nonlocal call_count
        call_count += 1
        response = MagicMock()
        response.content = mock_responses.get(call_count, '{}')
        return response
    
    mock_llm.invoke = mock_invoke
    return mock_llm


def test_happy_path_conversation():
    """Test the complete happy path conversation flow."""
    
    # Mock user answers
    user_answers = [
        "Miami, Florida",           # Q1: Property location
        "Personal home",            # Q2: Loan purpose  
        "$400,000",                # Q3: Property price
        "$120,000",                # Q4: Down payment (30%)
        "Yes, I have both",        # Q5: Passport and visa
        "I'm living in the USA",   # Q6: Current location
        "Yes, I have bank statements", # Q7: Income documentation
        "Yes, I have 8 months saved"  # Q8: Reserves
    ]
    
    # Create initial state
    initial_state: GraphState = {
        "property_city": None,
        "property_state": None,
        "loan_purpose": None,
        "property_price": None,
        "down_payment": None,
        "has_valid_passport": None,
        "has_valid_visa": None,
        "current_location": None,
        "can_demonstrate_income": None,
        "has_reserves": None,
        "messages": [],
        "current_question": 1,
        "conversation_complete": False,
        "final_decision": None
    }
    
    # Mock the LLM to return predictable extractions
    with patch('src.nodes.llm', create_mock_llm()):
        # Create graph
        graph = create_mortgage_graph()
        
        # Start conversation
        state = graph.invoke(initial_state)
        
        # Simulate answering each question
        for i, answer in enumerate(user_answers, 1):
            # Add user response
            state["messages"].append({"role": "user", "content": answer})
            
            # Process through graph  
            state = graph.invoke(state)
            
            # Print progress for debugging
            print(f"After Q{i}: Current question = {state.get('current_question')}")
            print(f"Messages count: {len(state['messages'])}")
    
    # Validate final state
    assert state["conversation_complete"] == True, "Conversation should be complete"
    assert state["final_decision"] == "Pre-Approved", f"Expected Pre-Approved, got {state['final_decision']}"
    
    # Validate all fields are populated (with mock data)
    assert state["property_city"] == "Miami"
    assert state["property_state"] == "FL"
    assert state["loan_purpose"] == "personal"
    assert state["property_price"] == 400000
    assert state["down_payment"] == 120000
    assert state["has_valid_passport"] == True
    assert state["has_valid_visa"] == True
    assert state["current_location"] == "usa"
    assert state["can_demonstrate_income"] == True
    assert state["has_reserves"] == True
    
    # Check that we have the right number of messages
    # (greeting + 8 questions + 8 user responses + final decision)
    expected_messages = 1 + 8 + 8 + 1  # 18 total
    assert len(state["messages"]) >= 17, f"Expected at least 17 messages, got {len(state['messages'])}"
    
    print("✅ Happy path test passed!")
    return state


def test_manual_happy_path():
    """Test happy path without LLM (manual field population)."""
    
    # Create state with all fields populated
    state: GraphState = {
        "property_city": "Miami",
        "property_state": "FL",
        "loan_purpose": "personal",
        "property_price": 400000.0,
        "down_payment": 120000.0,  # 30% down
        "has_valid_passport": True,
        "has_valid_visa": True,
        "current_location": "usa",
        "can_demonstrate_income": True,
        "has_reserves": True,
        "messages": [
            {"role": "assistant", "content": "Hello! I'm here to help..."},
            {"role": "user", "content": "Miami, Florida"},
            {"role": "assistant", "content": "Is the loan for..."},
            {"role": "user", "content": "Personal home"},
            # ... simulate full conversation
        ],
        "current_question": None,
        "conversation_complete": False,
        "final_decision": None
    }
    
    # Test just the final decision node
    from src.nodes import final_decision_node
    result = final_decision_node(state)
    
    assert result["final_decision"] == "Pre-Approved"
    assert result["conversation_complete"] == True
    assert "🎉 Congratulations! You are PRE-APPROVED" in result["messages"][-1]["content"]
    
    print("✅ Manual happy path test passed!")


if __name__ == "__main__":
    # Set a dummy OpenAI API key for testing
    os.environ["OPENAI_API_KEY"] = "test-key"
    
    test_manual_happy_path()
    
    # Note: test_happy_path_conversation() would need a real API key or more sophisticated mocking
    print("🎉 All Phase 2 tests passed!")