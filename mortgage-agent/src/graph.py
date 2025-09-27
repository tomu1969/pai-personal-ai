"""
LangGraph setup for the mortgage pre-approval chatbot.
Phase 3: Added conversational intelligence with router and clarifications.
"""
from langgraph.graph import StateGraph, END
from .state import GraphState
from .nodes import extract_info_node, final_decision_node, handle_letter_request
from .router import route_input, clarification_node


def start_node(state: GraphState) -> GraphState:
    """Initial node to start the conversation."""
    if not state["messages"]:
        state["messages"].append({
            "role": "assistant",
            "content": "Hello! I'm here to help you with your mortgage pre-approval. I'll need to ask you 8 questions to determine if you qualify for our Foreign Nationals loan program. Let's begin!"
        })
    return state


def process_conversation_step(state: GraphState) -> GraphState:
    """
    Process one step of the conversation using unified LLM-based response system.
    This creates a natural, flexible conversation flow.
    """
    # If this is the first message, start with greeting and ask for confirmation
    if len(state["messages"]) <= 1:  # Only has user's initial message
        state["current_question"] = 0  # Set to 0 to indicate waiting for confirmation
        state["messages"].append({
            "role": "assistant",
            "content": "Hello! I'm here to help you with your mortgage pre-approval. I'll need to ask you 8 questions to determine if you qualify for our Foreign Nationals loan program.\n\nWould you like to get started with the pre-approval questions?"
        })
        return state
    
    # Get the current question number
    current_q = state.get("current_question", 1)
    
    print(f"\n>>> Graph Processing Step - Current Question: {current_q}")
    
    # Check if we have a user response to process
    user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
    if user_messages:
        last_user_message = user_messages[-1]["content"]
        print(f">>> Processing user message: {last_user_message[:50]}...")
        
        # Handle confirmation response (when current_question is 0)
        if current_q == 0:
            # Check if user wants to start
            user_lower = last_user_message.lower().strip()
            # Multi-language support for yes
            yes_words = ['yes', 'sure', 'okay', 'ok', 'start', 'begin', 'let\'s', 'go',
                        'si', 'sí', 'oui', 'ja', 'da', 'sim', 'hai', 'ya']
            no_words = ['no', 'nope', 'not', 'later', 'non', 'nein', 'niet', 'não']
            
            if any(word in user_lower for word in yes_words):
                # User confirmed, start with first question (DOWN PAYMENT - what they know!)
                state["current_question"] = 1
                state["messages"].append({
                    "role": "assistant",
                    "content": "Great! Let's start with what you know best - your budget. How much do you have saved for a down payment?"
                })
                return state
            elif any(word in user_lower for word in no_words):
                # User declined
                state["messages"].append({
                    "role": "assistant",
                    "content": "No problem! Feel free to reach out when you're ready to explore your mortgage pre-approval options. I'm here to help whenever you'd like to get started."
                })
                return state
            else:
                # Unclear response - ask for clarification
                state["messages"].append({
                    "role": "assistant", 
                    "content": "I didn't quite catch that. Would you like to start the mortgage pre-approval questions? (Yes/No)"
                })
                return state
        
        # Use the unified conversational response system
        from .nodes import generate_conversational_response
        conversation_result = generate_conversational_response(state)
        
        # Add the assistant's response
        state["messages"].append({
            "role": "assistant",
            "content": conversation_result["response"]
        })
        
        # Extract information if the LLM indicated extraction
        if conversation_result.get("extract") and conversation_result["extract"] != "none":
            print(f">>> LLM suggested extraction: {conversation_result['extract']}")
            # Parse the extraction string and update state directly
            extract_str = conversation_result["extract"]
            if ":" in extract_str:
                # Split by commas but handle multiple fields
                pairs = extract_str.split(",") if "," in extract_str else [extract_str]
                for pair in pairs:
                    if ":" in pair:
                        key, value = pair.split(":", 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Expanded field mappings to catch all variations
                        field_mappings = {
                            'location_city': 'property_city',
                            'city': 'property_city',
                            'location_state': 'property_state',
                            'state': 'property_state',
                            'property_purpose': 'loan_purpose',
                            'purpose': 'loan_purpose',
                            'loan_type': 'loan_purpose'
                        }
                        mapped_key = field_mappings.get(key, key)
                        
                        # Skip if value is empty or null-like
                        if value.lower() in ['none', 'null', '', 'n/a']:
                            continue
                        
                        # Convert values
                        if value.lower() == 'true':
                            state[mapped_key] = True
                            print(f">>> Extracted {mapped_key}: True")
                        elif value.lower() == 'false':
                            state[mapped_key] = False
                            print(f">>> Extracted {mapped_key}: False")
                        elif mapped_key in ['property_price', 'down_payment']:
                            try:
                                # Clean up the value (remove $ and commas)
                                clean_value = value.replace('$', '').replace(',', '')
                                state[mapped_key] = float(clean_value)
                                print(f">>> Extracted {mapped_key}: {state[mapped_key]}")
                            except ValueError:
                                print(f">>> Failed to parse number: {value}")
                                pass
                        else:
                            state[mapped_key] = value
                            print(f">>> Extracted {mapped_key}: {value}")
            
            # Also run the full extraction logic for more comprehensive parsing
            extract_info_node(state)
        
        # Advance to next question if the LLM indicates it's appropriate
        if conversation_result.get("advance") and current_q < 8:
            print(f">>> Advancing from Q{current_q} to Q{current_q + 1} (LLM indicated)")
            state["current_question"] = current_q + 1
        # Safety check: If we have the data for current question but didn't advance, force advance
        # NEW ORDER: Q1=down payment, Q2=location, Q3=purpose, Q4=price, Q5-8=same
        elif current_q < 8:
            should_advance = False
            if current_q == 1 and state.get("down_payment"):
                should_advance = True
                print(f">>> Q1 Check: Have down payment: ${state.get('down_payment'):,.0f}")
            elif current_q == 2 and (state.get("property_city") or state.get("property_state")):
                should_advance = True
                print(f">>> Q2 Check: Have location data - City: {state.get('property_city')}, State: {state.get('property_state')}")
            elif current_q == 3 and state.get("loan_purpose"):
                should_advance = True
                print(f">>> Q3 Check: Have loan purpose: {state.get('loan_purpose')}")
            elif current_q == 4 and state.get("property_price"):
                should_advance = True
                print(f">>> Q4 Check: Have property price: ${state.get('property_price'):,.0f}")
            elif current_q == 5 and state.get("has_valid_passport") is not None:
                should_advance = True
                print(f">>> Q5 Check: Have passport/visa info")
            elif current_q == 6 and state.get("current_location"):
                should_advance = True
                print(f">>> Q6 Check: Have location: {state.get('current_location')}")
            elif current_q == 7 and state.get("can_demonstrate_income") is not None:
                should_advance = True
                print(f">>> Q7 Check: Have income info")
            elif current_q == 8 and state.get("has_reserves") is not None:
                should_advance = True
                print(f">>> Q8 Check: Have reserves info")
                
            if should_advance:
                print(f">>> ✅ ADVANCING from Q{current_q} to Q{current_q + 1} (have required data)")
                state["current_question"] = current_q + 1
            else:
                print(f">>> ⏸️  STAYING at Q{current_q} (need more data)")
                print(f"    Current state: city={state.get('property_city')}, state={state.get('property_state')}, price={state.get('property_price')}, down={state.get('down_payment')}")
    
    # Check if we're handling post-approval letter request
    if state.get("final_decision") == "Pre-Approved" and state.get("conversation_complete"):
        # Handle letter request flow
        return handle_letter_request(state)
    
    # Move to final decision if all questions answered
    if current_q >= 8:
        # Check if we have enough information for a decision
        if (state.get("property_price") and state.get("down_payment") and 
            state.get("has_valid_passport") is not None and 
            state.get("has_valid_visa") is not None and
            state.get("can_demonstrate_income") is not None and
            state.get("has_reserves") is not None):
            # All questions answered, make final decision
            return final_decision_node(state)
    
    return state


def create_mortgage_graph() -> StateGraph:
    """
    Create a simple graph that processes one conversation step at a time.
    """
    # Create the graph
    workflow = StateGraph(GraphState)
    
    # Add single processing node
    workflow.add_node("process_step", process_conversation_step)
    
    # Set entry point
    workflow.set_entry_point("process_step")
    
    # Simple flow: process one step and end (each API call handles one step)
    workflow.add_edge("process_step", END)
    
    # Compile the graph
    return workflow.compile()