"""
Router for Phase 3: Conversational Intelligence
Classifies user input as "answer" or "question" to enable clarifications.
"""
import time
import random
from typing import Literal
from .state import GraphState


def classify_input(user_message: str) -> Literal["answer", "question"]:
    """
    Classify user input as either an answer to our question or a question from the user.
    
    This is a simple rule-based classifier for now.
    In a full implementation, this would use an LLM.
    """
    
    # Simple heuristics for classification
    question_indicators = [
        "?", "why", "how", "what", "when", "where", "who", "which",
        "can you", "could you", "would you", "will you", "do you",
        "explain", "tell me", "help me", "i don't understand",
        "what does", "what is", "what are", "how much", "how many"
    ]
    
    user_lower = user_message.lower().strip()
    
    # Check for question indicators
    for indicator in question_indicators:
        if indicator in user_lower:
            return "question"
    
    # If it ends with a question mark, it's likely a question
    if user_message.strip().endswith("?"):
        return "question"
    
    # Otherwise, assume it's an answer
    return "answer"


def route_input(state: GraphState) -> str:
    """
    Route function for LangGraph conditional edge.
    
    Returns:
        "extract" if user provided an answer
        "clarify" if user asked a question
    """
    if not state["messages"]:
        return "extract"
    
    # Get the last user message
    user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
    if not user_messages:
        return "extract"
    
    last_message = user_messages[-1]["content"]
    classification = classify_input(last_message)
    
    if classification == "answer":
        return "extract"
    else:  # question
        return "clarify"


def clarification_node(state: GraphState) -> GraphState:
    """
    Handle user questions and provide clarifications.
    Routes back to the current question after clarification.
    """
    # Add realistic delay for human-like response
    delay = random.uniform(1.5, 3.0)
    time.sleep(delay)
    
    if not state["messages"]:
        return state
    
    # Get the last user message
    user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
    if not user_messages:
        return state
    
    last_message = user_messages[-1]["content"]
    current_q = state.get("current_question", 1)
    
    # For calculation requests on question 8 (reserves), provide detailed help
    if current_q == 8 and any(word in last_message.lower() for word in ["calculate", "help me", "how much"]):
        # Try to use LLM for better calculation help
        try:
            from .nodes import generate_calculation_help
            response = generate_calculation_help(last_message, state)
        except Exception:
            # Fallback to detailed manual calculation
            response = """I'd be happy to help you calculate your reserves requirement!

Here's how to estimate it:

1. **Estimate your monthly mortgage payment:**
   - Use an online mortgage calculator with your property price and 25% down
   - Include principal, interest, property taxes, insurance, and HOA (if any)
   
2. **Multiply by 6-12 months:**
   - Conservative: Monthly payment × 12 months
   - Minimum: Monthly payment × 6 months

**Example:** For a $400,000 home with $100,000 down (25%):
- Loan amount: $300,000
- Estimated monthly payment: ~$2,200
- Reserves needed: $13,200 - $26,400

Do you have an estimated property price? I can help you calculate more precisely."""
    else:
        # Use LLM for other clarifications when possible
        try:
            from .nodes import generate_clarification_response
            response = generate_clarification_response(last_message, current_q, state)
        except Exception:
            # Fallback to rule-based responses
            clarifications = {
                1: "I need to know the location to determine which state's lending regulations apply. You can provide either just the state (like 'California') or a specific city and state (like 'Miami, Florida').",
                2: "This determines the loan type and requirements. A 'personal home' means it's your primary residence where you'll live. A 'second home' is for vacation or occasional use. An 'investment property' is for rental income.",
                3: "I need an approximate property price to calculate your loan amount and down payment percentage. You can provide an estimate like '$400,000' or '400k'.",
                4: "This is the cash amount you can put toward the purchase. For our Foreign Nationals program, you need at least 25% of the property price as down payment.",
                5: "For Foreign Nationals loans, we require both a valid passport and visa. This is a federal requirement for lending to non-US citizens.",
                6: "I need to know if you're currently living in your home country or already in the United States. This affects documentation requirements and loan processing.",
                7: "Since you don't have US credit history, we accept alternative documentation like international bank statements or a CPA letter from your country showing your income.",
                8: "Reserves are savings equal to 6-12 months of your future mortgage payments (including principal, interest, taxes, and insurance). This shows you can handle payments if your income is disrupted."
            }
            response = clarifications.get(current_q, "I'm here to help! Could you please provide an answer to the question, or let me know specifically what you'd like clarified?")
    
    # Add clarification to messages
    state["messages"].append({
        "role": "assistant", 
        "content": response
    })
    
    return state


def get_current_question_node(current_q: int) -> str:
    """Helper function to get the question node name for routing back."""
    return f"question_{current_q}"