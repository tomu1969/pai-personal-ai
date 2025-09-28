"""
Graph nodes for the mortgage pre-approval chatbot.
Contains question nodes and extraction logic for Phase 2.
"""
from langchain.prompts import ChatPromptTemplate
from langchain.schema import HumanMessage
from langchain_openai import ChatOpenAI
from typing import Optional
import os
from .state import GraphState


# Load OpenAI API key from parent project's .env file
def load_openai_key():
    """Load OpenAI API key from parent project."""
    import os
    from pathlib import Path
    
    # Try to load from parent project's .env file
    parent_env_path = Path(__file__).parent.parent.parent / '.env'
    if parent_env_path.exists():
        with open(parent_env_path, 'r') as f:
            for line in f:
                if line.startswith('OPENAI_API_KEY='):
                    key = line.split('=', 1)[1].strip()
                    os.environ['OPENAI_API_KEY'] = key
                    print(f"Loaded OpenAI API key from {parent_env_path}")
                    return key
    
    # Fallback to environment variable
    return os.getenv('OPENAI_API_KEY')

# Initialize LLM with proper API key
try:
    api_key = load_openai_key()
    if api_key and not api_key.startswith('your-api'):
        llm = ChatOpenAI(temperature=0, model="gpt-3.5-turbo", openai_api_key=api_key)
        print("✅ OpenAI LLM initialized successfully")
    else:
        raise Exception("No valid OpenAI API key found")
except Exception as e:
    print(f"Warning: OpenAI initialization failed: {e}")
    llm = None

# Questions from questionnaire.md
QUESTIONS = {
    1: "In what city or state of the U.S. are you interested in buying the property?",
    2: "Is the loan for a personal home, a second home, or an investment?",
    3: "What is the approximate price of the property you wish to buy?",
    4: "What is the amount you have available for the down payment?",
    5: "Do you have a valid passport and visa?",
    6: "Are you currently living in your country of origin or in the U.S.?",
    7: "Can you demonstrate your income through bank statements or a CPA letter from your country?",
    8: "Do you have reserves equivalent to 6-12 months of mortgage payments?"
}


def question_1_node(state: GraphState) -> GraphState:
    """Ask about property location."""
    state["current_question"] = 1
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[1]
    })
    return state


def question_2_node(state: GraphState) -> GraphState:
    """Ask about loan purpose."""
    state["current_question"] = 2
    state["messages"].append({
        "role": "assistant", 
        "content": QUESTIONS[2]
    })
    return state


def question_3_node(state: GraphState) -> GraphState:
    """Ask about property price."""
    state["current_question"] = 3
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[3]
    })
    return state


def question_4_node(state: GraphState) -> GraphState:
    """Ask about down payment."""
    state["current_question"] = 4
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[4]
    })
    return state


def question_5_node(state: GraphState) -> GraphState:
    """Ask about passport and visa."""
    state["current_question"] = 5
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[5]
    })
    return state


def question_6_node(state: GraphState) -> GraphState:
    """Ask about current location."""
    state["current_question"] = 6
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[6]
    })
    return state


def question_7_node(state: GraphState) -> GraphState:
    """Ask about income documentation."""
    state["current_question"] = 7
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[7]
    })
    return state


def question_8_node(state: GraphState) -> GraphState:
    """Ask about reserves."""
    state["current_question"] = 8
    state["messages"].append({
        "role": "assistant",
        "content": QUESTIONS[8]
    })
    return state


def extract_info_node(state: GraphState) -> GraphState:
    """
    Extract information from user responses using enhanced LLM and pattern matching.
    Updates the appropriate field in GraphState based on current_question.
    """
    if not state["messages"]:
        return state
    
    # Get the last user message
    user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
    if not user_messages:
        return state
    
    last_user_message = user_messages[-1]["content"]
    current_q = state.get("current_question", 1)
    
    # Use enhanced LLM extraction first
    if llm:
        try:
            extracted_data = extract_with_enhanced_llm(last_user_message, current_q, state)
            if extracted_data:
                for key, value in extracted_data.items():
                    if value is not None:
                        state[key] = value
                return state
        except Exception as e:
            print(f"Enhanced LLM extraction failed: {e}")
            # Fall back to pattern matching
    
    # Enhanced pattern matching that works across all conversations
    extract_from_full_conversation(state)
    return state


def final_decision_node(state: GraphState) -> GraphState:
        1: """Extract the city and state from this response about property location: "{response}"
        
        Respond in JSON format:
        {{"property_city": "city name or null", "property_state": "state abbreviation or null"}}
        
        Examples:
        - "Miami, Florida" -> {{"property_city": "Miami", "property_state": "FL"}}
        - "California" -> {{"property_city": null, "property_state": "CA"}}
        - "New York City" -> {{"property_city": "New York City", "property_state": "NY"}}""",
        
        2: """Extract the loan purpose from this response: "{response}"
        
        Respond in JSON format:
        {{"loan_purpose": "personal|second|investment|null"}}
        
        Map responses to:
        - personal home, primary residence, first home -> "personal"
        - second home, vacation home -> "second" 
        - investment property, rental -> "investment"
        - unclear responses -> null""",
        
        3: """Extract the property price from this response: "{response}"
        
        Respond in JSON format:
        {{"property_price": number_or_null}}
        
        Examples:
        - "$400,000" -> {{"property_price": 400000}}
        - "four hundred thousand" -> {{"property_price": 400000}}
        - "around 500k" -> {{"property_price": 500000}}
        - "not sure yet" -> {{"property_price": null}}""",
        
        4: """Extract the down payment amount from this response: "{response}"
        
        Respond in JSON format:
        {{"down_payment": number_or_null}}
        
        Examples:
        - "$100,000" -> {{"down_payment": 100000}}
        - "20% of 400k" -> {{"down_payment": 80000}}
        - "one hundred thousand" -> {{"down_payment": 100000}}""",
        
        5: """Determine if the person has valid passport and visa from this response: "{response}"
        
        Respond in JSON format:
        {{"has_valid_passport": true_false_or_null, "has_valid_visa": true_false_or_null}}
        
        IMPORTANT: If they say "yes" without specifying which document, assume they have BOTH passport and visa.
        
        Examples:
        - "Yes" -> {{"has_valid_passport": true, "has_valid_visa": true}}
        - "Yes, I have both" -> {{"has_valid_passport": true, "has_valid_visa": true}}
        - "I have a passport but working on visa" -> {{"has_valid_passport": true, "has_valid_visa": false}}
        - "No" -> {{"has_valid_passport": false, "has_valid_visa": false}}""",
        
        6: """Extract current location from this response: "{response}"
        
        Respond in JSON format:
        {{"current_location": "origin|usa|null"}}
        
        Map to:
        - Living in home country, origin country -> "origin"
        - Living in USA, United States -> "usa"
        - Unclear -> null""",
        
        7: """Determine if they can demonstrate income from this response: "{response}"
        
        Respond in JSON format:
        {{"can_demonstrate_income": true_false_or_null}}
        
        Examples:
        - "Yes, I have bank statements" -> {{"can_demonstrate_income": true}}
        - "I can get CPA letter" -> {{"can_demonstrate_income": true}}
        - "No documentation available" -> {{"can_demonstrate_income": false}}""",
        
        8: """Determine if they have reserves from this response: "{response}"
        
        Respond in JSON format:
        {{"has_reserves": true_false_or_null}}
        
        Examples:
        - "Yes, I have 8 months saved" -> {{"has_reserves": true}}
        - "I have enough for 6 months" -> {{"has_reserves": true}}
        - "No, I don't have reserves" -> {{"has_reserves": false}}"""
    }
    
    if current_q not in extraction_prompts:
        return state
    
    # Create and invoke LLM prompt
    prompt = extraction_prompts[current_q].format(response=last_user_message)
    
    try:
        if llm is None:
            raise Exception("OpenAI API not available")
            
        response = llm.invoke([HumanMessage(content=prompt)])
        result_text = response.content
        
        # Parse JSON response
        import json
        extracted_data = json.loads(result_text)
        
        # Update state with extracted information
        for key, value in extracted_data.items():
            if key in state and value is not None:
                state[key] = value
                
    except Exception as e:
        # If extraction fails, try fallback pattern matching
        print(f"Extraction failed for question {current_q}: {e}")
        try:
            fallback_extract_info(state, current_q, last_user_message)
        except Exception as fallback_error:
            print(f"Fallback extraction also failed: {fallback_error}")
    
    return state


def generate_natural_response(question_num: int, user_answer: str, next_question: str) -> str:
    """
    Generate a natural, conversational response that acknowledges the user's answer
    and smoothly transitions to the next question.
    """
    if llm is None:
        # Fallback to simple responses if no LLM
        return next_question
    
    try:
        context_map = {
            1: "property location",
            2: "loan purpose (personal, second home, or investment)",
            3: "property price",
            4: "down payment amount",
            5: "passport and visa documentation",
            6: "current living location",
            7: "income documentation capability",
            8: "financial reserves"
        }
        
        context = context_map.get(question_num, "your response")
        
        prompt = f"""You are a friendly, professional mortgage loan officer. A client just answered a question about {context}. 

Their answer was: "{user_answer}"

Generate a brief (1-2 sentences), natural acknowledgment of their answer, followed by the next question. Be warm, professional, and encouraging. Don't repeat their exact words - paraphrase or add context.

IMPORTANT: 
- Vary your acknowledgment style to avoid repetition. Don't use the same phrases each time like "Great" or "Thanks for sharing".
- Be authentic and conversational, not robotic

Next question to ask: "{next_question}"

Respond in a conversational tone as if you're speaking to them in person. Keep it concise but friendly."""

        # Add realistic processing delay (1-3 seconds)
        import time
        import random
        time.sleep(random.uniform(1.0, 3.0))
        
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
        
    except Exception as e:
        print(f"Error generating natural response: {e}")
        # Fallback to next question only
        return next_question


def fallback_extract_info(state: GraphState, current_q: int, user_message: str) -> None:
    """
    Fallback extraction using simple pattern matching when OpenAI is unavailable.
    """
    import re
    
    user_lower = user_message.lower().strip()
    
    if current_q == 1:  # Property location
        # Look for state names or city, state patterns
        states = {
            'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
            'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
            'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
            'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
            'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
            'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
            'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
            'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA',
            'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
            'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
            'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
        }
        
        # Check for "City, State" pattern
        city_state_match = re.search(r'([^,]+),\s*([a-z\s]+)', user_lower)
        if city_state_match:
            city = city_state_match.group(1).strip().title()
            state_name = city_state_match.group(2).strip()
            if state_name in states:
                state["property_city"] = city
                state["property_state"] = states[state_name]
                return
        
        # Check for just state name
        for state_name, state_code in states.items():
            if state_name in user_lower:
                state["property_state"] = state_code
                return
    
    elif current_q == 2:  # Loan purpose
        if any(word in user_lower for word in ['personal', 'primary', 'first', 'live', 'residence']):
            state["loan_purpose"] = "personal"
        elif any(word in user_lower for word in ['second', 'vacation', 'holiday']):
            state["loan_purpose"] = "second"
        elif any(word in user_lower for word in ['investment', 'rental', 'rent', 'income']):
            state["loan_purpose"] = "investment"
    
    elif current_q == 3:  # Property price
        # Look for dollar amounts
        price_match = re.search(r'\$?([0-9,]+(?:\.[0-9]{2})?)', user_message)
        if price_match:
            price_str = price_match.group(1).replace(',', '')
            try:
                price = float(price_str)
                state["property_price"] = price
            except ValueError:
                pass
    
    elif current_q == 4:  # Down payment
        # Look for dollar amounts or percentages
        amount_match = re.search(r'\$?([0-9,]+(?:\.[0-9]{2})?)', user_message)
        if amount_match:
            amount_str = amount_match.group(1).replace(',', '')
            try:
                amount = float(amount_str)
                state["down_payment"] = amount
            except ValueError:
                pass
    
    elif current_q == 5:  # Documents
        if any(word in user_lower for word in ['yes', 'have', 'both', 'valid', 'current']):
            state["has_valid_passport"] = True
            state["has_valid_visa"] = True
        elif any(word in user_lower for word in ['no', 'don\'t', 'missing', 'expired']):
            state["has_valid_passport"] = False
            state["has_valid_visa"] = False
    
    elif current_q == 6:  # Current location
        if any(word in user_lower for word in ['usa', 'us', 'united states', 'america', 'living here']):
            state["current_location"] = "USA"
        else:
            state["current_location"] = "Origin Country"
    
    elif current_q == 7:  # Income documentation
        if any(word in user_lower for word in ['yes', 'can', 'have', 'bank', 'cpa', 'statements']):
            state["can_demonstrate_income"] = True
        elif any(word in user_lower for word in ['no', 'cannot', 'don\'t', 'unable']):
            state["can_demonstrate_income"] = False
    
    elif current_q == 8:  # Reserves
        if any(word in user_lower for word in ['yes', 'have', 'months', 'saved', 'enough']):
            state["has_reserves"] = True
        elif any(word in user_lower for word in ['no', 'don\'t', 'insufficient', 'not enough']):
            state["has_reserves"] = False


def final_decision_node(state: GraphState) -> GraphState:
    """Final node that applies the rules engine and provides decision."""
    from .rules_engine import check_preapproval, get_preapproval_details
    
    decision = check_preapproval(state)
    details = get_preapproval_details(state)
    
    state["final_decision"] = decision
    state["conversation_complete"] = True
    
    # Create detailed response
    if decision == "Pre-Approved":
        message = f"""🎉 Congratulations! You are PRE-APPROVED for our Foreign Nationals loan program!

Here's your loan summary:
• Property Price: ${details['property_price']:,.2f}
• Down Payment: ${details['down_payment']:,.2f} ({details['down_payment_percentage']:.1f}%)
• Loan Amount: ${details['loan_amount']:,.2f}
• LTV Ratio: {details['ltv_ratio']:.1f}%

Next steps: A loan officer will contact you within 24 hours to proceed with your application."""

    elif decision == "Rejected":
        reasons = []
        improvements = []
        
        if not details['meets_down_payment_requirement']:
            reasons.append(f"• Down payment is {details['down_payment_percentage']:.1f}% (minimum 25% required)")
            shortage = details['property_price'] * 0.25 - details['down_payment']
            improvements.append(f"• Increase your down payment by ${shortage:,.0f} to reach the 25% minimum (${details['property_price'] * 0.25:,.0f} total)")
            
        if not details['has_documentation']:
            reasons.append("• Valid passport and visa required")
            improvements.append("• Obtain or renew your passport and ensure you have a valid visa to enter/stay in the U.S.")
            
        if not details['has_income_proof']:
            reasons.append("• Income documentation required")
            improvements.append("• Gather recent bank statements (6-12 months) or obtain a CPA letter verifying your income")
            
        if not details['has_reserves']:
            reasons.append("• 6-12 months of reserves required")
            estimated_payment = (details['loan_amount'] * 0.06) / 12  # Rough 6% annual rate
            min_reserves = estimated_payment * 6
            improvements.append(f"• Save approximately ${min_reserves:,.0f}-${min_reserves*2:,.0f} for reserves (6-12 months of estimated payments)")
            
        message = f"""I understand this news might be disappointing, but don't worry - we can work together to get you qualified!

**Current gaps:**
{chr(10).join(reasons)}

**Here's your roadmap to approval:**
{chr(10).join(improvements)}

**Next steps:**
1. Work on addressing the items above
2. Contact me when you're ready - I'll be happy to review your updated application
3. Consider speaking with a loan officer for personalized guidance

You're closer than you think! These are common hurdles that many successful borrowers overcome."""

    else:  # Needs Review
        message = f"""Thank you for your application. Your request requires manual review.

Application summary:
• Property Price: ${details.get('property_price', 'N/A')}
• Down Payment: ${details.get('down_payment', 'N/A')}

A loan officer will contact you within 24 hours to discuss your options."""
    
    state["messages"].append({
        "role": "assistant",
        "content": message
    })
    
    return state


def generate_calculation_help(user_message: str, state: GraphState) -> str:
    """Generate helpful calculation assistance using LLM."""
    if not llm:
        return "I'd be happy to help you calculate your reserves requirement! Please let me know your estimated property price and I can provide specific calculations."
    
    try:
        # Get property info from state if available
        property_price = state.get("property_price", "not provided")
        down_payment = state.get("down_payment", "not provided")
        
        prompt = f"""You are a helpful mortgage loan officer. A client asked: "{user_message}"

They are applying for a Foreign Nationals loan that requires 6-12 months of reserves (savings equal to mortgage payments).

Available information:
- Property price: {property_price}  
- Down payment: {down_payment}
- Loan requirement: 25% down payment minimum
- Reserve requirement: 6-12 months of monthly mortgage payments

Provide a helpful, step-by-step calculation guide. If they need specific numbers, use realistic examples. Be encouraging and practical. Keep it under 200 words."""

        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content
        
    except Exception as e:
        print(f"LLM calculation help failed: {e}")
        return "I'd be happy to help you calculate your reserves requirement! Please let me know your estimated property price and I can provide specific calculations."


def generate_clarification_response(user_message: str, current_question: int, state: GraphState = None) -> str:
    """Generate contextual clarification responses using LLM."""
    if not llm:
        return "I'm here to help! Could you please provide an answer to the question, or let me know specifically what you'd like clarified?"
    
    try:
        questions = {
            1: "the city or state where they want to buy property",
            2: "whether the loan is for a personal home, second home, or investment",
            3: "the approximate property price",
            4: "their available down payment amount",
            5: "whether they have valid passport and visa",
            6: "whether they're currently in the US or their home country",
            7: "whether they can provide income documentation",
            8: "whether they have 6-12 months of reserves"
        }
        
        current_topic = questions.get(current_question, "their response")
        
        prompt = f"""You are a friendly, professional mortgage loan officer. A client just asked: "{user_message}"

You were asking them about {current_topic} for their Foreign Nationals loan application.

Provide a helpful, encouraging clarification that:
1. Addresses their specific question
2. Explains why this information is needed
3. Gives practical examples or guidance
4. Maintains a warm, professional tone
5. Is concise (under 150 words)

Don't end with "Now, could you please answer the original question?" - just provide the helpful information."""

        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content
        
    except Exception as e:
        print(f"LLM clarification failed: {e}")
        return "I'm here to help! Could you please provide an answer to the question, or let me know specifically what you'd like clarified?"


def generate_conversational_response(state: GraphState) -> dict:
    """
    Unified LLM-based response system that handles any user input naturally.
    Returns both the response and whether to advance to the next question.
    """
    import time
    import random
    
    # Add realistic delay
    delay = random.uniform(1.5, 3.5)
    time.sleep(delay)
    
    if not llm:
        return {"response": "I'm here to help with your mortgage pre-approval. Please let me know how I can assist you.", "advance": False}
    
    try:
        # Get conversation context
        user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
        
        if not user_messages:
            return {"response": "I'm here to help with your mortgage pre-approval.", "advance": False}
        
        last_user_message = user_messages[-1]["content"]
        current_q = state.get("current_question", 1)
        
        # Build conversation context
        recent_messages = ""
        if len(state["messages"]) > 1:
            recent_context = state["messages"][-4:]  # Last 4 messages for context
            for msg in recent_context:
                role = "You" if msg["role"] == "assistant" else "Client"
                recent_messages += f"{role}: {msg['content']}\n"
        
        # Get what we know so far
        known_info = []
        if state.get("property_city") or state.get("property_state"):
            location = f"{state.get('property_city', '')}, {state.get('property_state', '')}".strip(', ')
            known_info.append(f"Property location: {location}")
        if state.get("loan_purpose"):
            known_info.append(f"Loan purpose: {state.get('loan_purpose')}")
        if state.get("property_price"):
            known_info.append(f"Property price: ${state.get('property_price'):,.0f}")
        if state.get("down_payment"):
            known_info.append(f"Down payment: ${state.get('down_payment'):,.0f}")
        
        known_context = "\n".join(known_info) if known_info else "No information collected yet"
        
        # Define what we need for each question
        question_objectives = {
            1: "Need to know the city/state where they want to buy property",
            2: "Need to know if it's for personal home, second home, or investment",  
            3: "Need to know the approximate property price",
            4: "Need to know their available down payment amount",
            5: "Need to know if they have valid passport and visa",
            6: "Need to know if they're currently in US or home country",
            7: "Need to know if they can provide income documentation",
            8: "Need to know if they have 6-12 months of reserves"
        }
        
        current_objective = question_objectives.get(current_q, "Continue the conversation naturally")
        
        prompt = f"""You are a warm, professional mortgage loan officer helping a client with Foreign Nationals loan pre-approval. You need to collect 8 pieces of information, but you should do so conversationally and naturally.

RECENT CONVERSATION:
{recent_messages}

WHAT WE KNOW SO FAR:
{known_context}

CURRENT OBJECTIVE: {current_objective}

CLIENT'S LATEST MESSAGE: "{last_user_message}"

INSTRUCTIONS:
1. If they asked a question, answer it helpfully and naturally
2. If they provided information, acknowledge it warmly  
3. Try to extract any relevant information from their response
4. If you have what you need for the current question, naturally transition to the next topic
5. If you need more info on current topic, ask follow-up questions naturally
6. Be conversational, not robotic - vary your responses
7. Use their specific details (like the $1M property, $300K down from earlier)
8. Keep responses under 3 sentences when possible

RESPOND WITH EXACTLY THIS FORMAT:
RESPONSE: [Your natural, conversational response]
EXTRACT: [Any information to extract, or "none"]
ADVANCE: [true if ready to move to next question, false if need more info on current topic]"""

        llm_response = llm.invoke([HumanMessage(content=prompt)])
        response_text = llm_response.content
        
        # Parse the LLM response
        lines = response_text.strip().split('\n')
        response = ""
        extract_info = "none"
        advance = False
        
        for line in lines:
            if line.startswith("RESPONSE:"):
                response = line.replace("RESPONSE:", "").strip()
            elif line.startswith("EXTRACT:"):
                extract_info = line.replace("EXTRACT:", "").strip()
            elif line.startswith("ADVANCE:"):
                advance_text = line.replace("ADVANCE:", "").strip().lower()
                advance = advance_text in ["true", "yes"]
        
        # If parsing failed, use the whole response
        if not response:
            response = response_text
            
        return {
            "response": response,
            "extract": extract_info,
            "advance": advance
        }
        
    except Exception as e:
        print(f"Conversational response failed: {e}")
        return {
            "response": "I'm here to help with your mortgage pre-approval. Could you tell me more about what you're looking for?",
            "advance": False
        }


def extract_with_enhanced_llm(user_message: str, current_question: int, state: GraphState) -> dict:
    """Enhanced LLM extraction that considers conversation context."""
    if not llm:
        return {}
    
    try:
        # Build context from the conversation
        known_info = []
        if state.get("property_city") or state.get("property_state"):
            location = f"{state.get('property_city', '')}, {state.get('property_state', '')}".strip(', ')
            known_info.append(f"Property location: {location}")
        if state.get("loan_purpose"):
            known_info.append(f"Loan purpose: {state.get('loan_purpose')}")
        if state.get("property_price"):
            known_info.append(f"Property price: ${state.get('property_price'):,.0f}")
        if state.get("down_payment"):
            known_info.append(f"Down payment: ${state.get('down_payment'):,.0f}")
        
        known_context = "\n".join(known_info) if known_info else "No information collected yet"
        
        prompt = f"""Extract information from this client's message for a mortgage application.

CLIENT MESSAGE: "{user_message}"

CURRENT QUESTION FOCUS: Question {current_question}
WHAT WE ALREADY KNOW:
{known_context}

Extract any of the following information from their message:
- Property city (if mentioned)
- Property state (if mentioned) 
- Property price (convert to number: 1M = 1000000, 500K = 500000)
- Down payment amount (convert to number)
- Loan purpose (Personal Home/Second Home/Investment)
- Has passport (true/false)
- Has visa (true/false)
- Current location (USA/Origin Country)
- Can demonstrate income (true/false)
- Has reserves (true/false)

RESPOND WITH EXACTLY THIS FORMAT:
property_city: [value or null]
property_state: [value or null] 
property_price: [number or null]
down_payment: [number or null]
loan_purpose: [value or null]
has_valid_passport: [true/false or null]
has_valid_visa: [true/false or null]
current_location: [value or null]
can_demonstrate_income: [true/false or null]
has_reserves: [true/false or null]

Only include values that are clearly mentioned or implied in their message."""

        response = llm.invoke([HumanMessage(content=prompt)])
        response_text = response.content
        
        # Parse the response
        extracted = {}
        for line in response_text.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                if value.lower() in ['null', 'none', '']:
                    continue
                elif value.lower() == 'true':
                    extracted[key] = True
                elif value.lower() == 'false':
                    extracted[key] = False
                elif key in ['property_price', 'down_payment']:
                    try:
                        extracted[key] = float(value)
                    except ValueError:
                        continue
                else:
                    extracted[key] = value
        
        return extracted
        
    except Exception as e:
        print(f"Enhanced LLM extraction error: {e}")
        return {}


def extract_from_full_conversation(state: GraphState) -> None:
    """Extract information from the entire conversation context using patterns."""
    # Combine all user messages for comprehensive extraction
    user_messages = [msg["content"] for msg in state["messages"] if msg["role"] == "user"]
    full_conversation = " ".join(user_messages).lower()
    
    # Extract property price if not already found
    if not state.get("property_price"):
        import re
        price_patterns = [
            r'\$?([\d,]+(?:\.\d+)?)\s*(?:million|mil|m)\b',  # 1.5 million
            r'\$?([\d,]+(?:\.\d+)?)\s*(?:thousand|k)\b',     # 500k
            r'\$?([\d,]+(?:\.\d+)?)',                        # $500,000
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, full_conversation)
            if match:
                try:
                    number_str = match.group(1).replace(',', '')
                    number = float(number_str)
                    
                    if 'million' in full_conversation or 'mil' in full_conversation:
                        if number < 50:  # Assume millions if under 50
                            number *= 1_000_000
                    elif 'thousand' in full_conversation or 'k' in full_conversation:
                        if number < 10_000:  # Assume thousands if under 10k
                            number *= 1_000
                    
                    state["property_price"] = number
                    break
                except ValueError:
                    continue
    
    # Extract down payment if not already found
    if not state.get("down_payment"):
        import re
        # Look for down payment patterns
        dp_patterns = [
            r'down\s+payment[:\s]+\$?([\d,]+(?:\.\d+)?)\s*(?:k|thousand)?',
            r'\$?([\d,]+(?:\.\d+)?)\s*(?:k|thousand)?\s+down',
            r'put\s+down\s+\$?([\d,]+(?:\.\d+)?)\s*(?:k|thousand)?'
        ]
        
        for pattern in dp_patterns:
            match = re.search(pattern, full_conversation)
            if match:
                try:
                    number_str = match.group(1).replace(',', '')
                    number = float(number_str)
                    
                    if 'k' in full_conversation or 'thousand' in full_conversation:
                        if number < 10_000:
                            number *= 1_000
                    
                    state["down_payment"] = number
                    break
                except ValueError:
                    continue