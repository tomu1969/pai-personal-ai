"""
Phase 3 testing: Conversational intelligence and clarification handling.
"""
import pytest
from src.state import GraphState
from src.router import classify_input, route_input, clarification_node


def test_classify_input_answers():
    """Test that answers are correctly classified."""
    
    # Test typical answers
    answers = [
        "Miami, Florida",
        "Personal home", 
        "$400,000",
        "Yes, I have both",
        "I'm living in the USA",
        "8 months of savings"
    ]
    
    for answer in answers:
        result = classify_input(answer)
        assert result == "answer", f"'{answer}' should be classified as answer, got {result}"
    
    print("✅ Answer classification test passed!")


def test_classify_input_questions():
    """Test that questions are correctly classified."""
    
    # Test typical questions
    questions = [
        "Why do you need to know the location?",
        "What's the difference between personal and investment?",
        "How much down payment do I need?",
        "Can you explain the requirements?",
        "What documents do you accept?",
        "Why is the down payment so high?",
        "What does LTV mean?",
        "Could you clarify this question?"
    ]
    
    for question in questions:
        result = classify_input(question)
        assert result == "question", f"'{question}' should be classified as question, got {result}"
    
    print("✅ Question classification test passed!")


def test_route_input_function():
    """Test the route_input function with different states."""
    
    # Test with answer
    state_with_answer: GraphState = {
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
        "messages": [
            {"role": "assistant", "content": "In what city or state..."},
            {"role": "user", "content": "Miami, Florida"}
        ],
        "current_question": 1,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = route_input(state_with_answer)
    assert result == "extract", f"Expected 'extract' for answer, got {result}"
    
    # Test with question
    state_with_question = state_with_answer.copy()
    state_with_question["messages"] = [
        {"role": "assistant", "content": "In what city or state..."},
        {"role": "user", "content": "Why do you need to know the location?"}
    ]
    
    result = route_input(state_with_question)
    assert result == "clarify", f"Expected 'clarify' for question, got {result}"
    
    print("✅ Route input test passed!")


def test_clarification_node():
    """Test the clarification node provides helpful responses."""
    
    # Test clarification for question 1 (location)
    state: GraphState = {
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
        "messages": [
            {"role": "assistant", "content": "In what city or state..."},
            {"role": "user", "content": "Why do you need the location?"}
        ],
        "current_question": 1,
        "conversation_complete": False,
        "final_decision": None
    }
    
    result = clarification_node(state)
    
    # Check that a clarification message was added
    assert len(result["messages"]) == 3, "Should have added one clarification message"
    clarification_msg = result["messages"][-1]
    assert clarification_msg["role"] == "assistant"
    assert "location" in clarification_msg["content"].lower()
    assert "answer the original question" in clarification_msg["content"]
    
    print("✅ Clarification node test passed!")


def test_clarification_different_questions():
    """Test clarifications for different question types."""
    
    test_cases = [
        {
            "question": 3,
            "user_input": "Why do you need the price?",
            "expected_keywords": ["price", "calculate", "down payment"]
        },
        {
            "question": 4, 
            "user_input": "What percentage do I need?",
            "expected_keywords": ["25%", "percentage", "$100,000"]
        },
        {
            "question": 5,
            "user_input": "Why passport and visa?",
            "expected_keywords": ["federal requirement", "identity", "banking"]
        }
    ]
    
    for case in test_cases:
        state: GraphState = {
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
            "messages": [
                {"role": "assistant", "content": "Question..."},
                {"role": "user", "content": case["user_input"]}
            ],
            "current_question": case["question"],
            "conversation_complete": False,
            "final_decision": None
        }
        
        result = clarification_node(state)
        clarification_msg = result["messages"][-1]["content"].lower()
        
        # Check that relevant keywords appear in the clarification
        found_keywords = [kw for kw in case["expected_keywords"] if kw.lower() in clarification_msg]
        assert len(found_keywords) > 0, f"Expected keywords {case['expected_keywords']} in clarification for Q{case['question']}"
    
    print("✅ Different question clarifications test passed!")


def test_happy_path_still_works():
    """Test Case 1: Ensure the router correctly identifies answers (happy path unchanged)."""
    
    # Simulate answers that should go straight to extraction
    answers = [
        "Miami, Florida",           # Q1 
        "Personal home",            # Q2
        "$400,000",                # Q3
        "$120,000",                # Q4
        "Yes, I have both",        # Q5
        "I'm living in the USA",   # Q6
        "Yes, I have bank statements", # Q7
        "Yes, I have 8 months saved"  # Q8
    ]
    
    for i, answer in enumerate(answers, 1):
        state: GraphState = {
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
            "messages": [
                {"role": "assistant", "content": f"Question {i}..."},
                {"role": "user", "content": answer}
            ],
            "current_question": i,
            "conversation_complete": False,
            "final_decision": None
        }
        
        result = route_input(state)
        assert result == "extract", f"Answer '{answer}' should route to extract, got {result}"
    
    print("✅ Happy path routing test passed!")


def test_clarification_then_answer():
    """Test Case 2: User asks question, gets clarification, then provides answer."""
    
    # Step 1: User asks a question
    state: GraphState = {
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
        "messages": [
            {"role": "assistant", "content": "What is the approximate price of the property you wish to buy?"},
            {"role": "user", "content": "Why is the down payment so high?"}
        ],
        "current_question": 3,
        "conversation_complete": False,
        "final_decision": None
    }
    
    # Should route to clarification
    route_result = route_input(state)
    assert route_result == "clarify", "Question should route to clarify"
    
    # Get clarification
    clarified_state = clarification_node(state)
    clarification = clarified_state["messages"][-1]["content"]
    assert "25%" in clarification, "Clarification should mention 25% requirement"
    
    # Step 2: User provides real answer after clarification
    clarified_state["messages"].append({
        "role": "user", 
        "content": "$400,000"
    })
    
    # Should now route to extraction
    final_route = route_input(clarified_state)
    assert final_route == "extract", "Answer after clarification should route to extract"
    
    print("✅ Clarification then answer test passed!")


if __name__ == "__main__":
    test_classify_input_answers()
    test_classify_input_questions()
    test_route_input_function()
    test_clarification_node()
    test_clarification_different_questions()
    test_happy_path_still_works()
    test_clarification_then_answer()
    
    print("🎉 All Phase 3 tests passed!")