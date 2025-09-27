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
        llm = ChatOpenAI(temperature=0, model="gpt-5", openai_api_key=api_key)
        print("✅ OpenAI LLM initialized successfully")
    else:
        raise Exception("No valid OpenAI API key found")
except Exception as e:
    print(f"Warning: OpenAI initialization failed: {e}")
    llm = None


def generate_conversational_response(state: GraphState) -> dict:
    """
    Unified LLM-based response system that handles any user input naturally.
    Returns both the response and whether to advance to the next question.
    """
    # Removed delays for faster response
    
    if not llm:
        return {"response": "I'm here to help with your mortgage pre-approval. Please let me know how I can assist you.", "advance": False}
    
    try:
        # Get conversation context
        user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
        
        if not user_messages:
            return {"response": "I'm here to help with your mortgage pre-approval.", "advance": False}
        
        last_user_message = user_messages[-1]["content"]
        current_q = state.get("current_question", 1)
        
        print(f"\n=== CONVERSATIONAL RESPONSE DEBUG ===")
        print(f"Current Question: {current_q}")
        print(f"Last User Message: {last_user_message}")
        
        # Build conversation context
        recent_messages = ""
        if len(state["messages"]) > 1:
            recent_context = state["messages"][-4:]  # Last 4 messages for context
            for msg in recent_context:
                role = "You" if msg["role"] == "assistant" else "Client"
                recent_messages += f"{role}: {msg['content']}\n"
        
        # Get what we know so far - be comprehensive to avoid re-asking
        known_info = []
        collected_data = []
        
        if state.get("property_city") or state.get("property_state"):
            location = f"{state.get('property_city', '')}, {state.get('property_state', '')}".strip(', ')
            known_info.append(f"Property location: {location}")
            collected_data.append("location")
            
        if state.get("loan_purpose"):
            known_info.append(f"Loan purpose: {state.get('loan_purpose')}")
            collected_data.append("loan_purpose")
            
        if state.get("property_price"):
            known_info.append(f"Property price: ${state.get('property_price'):,.0f}")
            collected_data.append("property_price")
            
        if state.get("down_payment"):
            known_info.append(f"Down payment: ${state.get('down_payment'):,.0f}")
            collected_data.append("down_payment")
            
        if state.get("has_valid_passport") is not None:
            known_info.append(f"Has passport: {state.get('has_valid_passport')}")
            collected_data.append("passport")
            
        if state.get("has_valid_visa") is not None:
            known_info.append(f"Has visa: {state.get('has_valid_visa')}")
            collected_data.append("visa")
            
        if state.get("current_location"):
            known_info.append(f"Current location: {state.get('current_location')}")
            collected_data.append("current_location")
            
        if state.get("can_demonstrate_income") is not None:
            known_info.append(f"Can demonstrate income: {state.get('can_demonstrate_income')}")
            collected_data.append("income_documentation")
            
        if state.get("has_reserves") is not None:
            known_info.append(f"Has reserves: {state.get('has_reserves')}")
            collected_data.append("reserves")
        
        known_context = "\n".join(known_info) if known_info else "No information collected yet"
        
        print(f"State Data Collected:")
        print(f"  - Location: {state.get('property_city')}, {state.get('property_state')}")
        print(f"  - Loan Purpose: {state.get('loan_purpose')}")
        print(f"  - Property Price: {state.get('property_price')}")
        print(f"  - Down Payment: {state.get('down_payment')}")
        print(f"  - Passport/Visa: {state.get('has_valid_passport')}/{state.get('has_valid_visa')}")
        print(f"  - Current Location: {state.get('current_location')}")
        print(f"  - Income Docs: {state.get('can_demonstrate_income')}")
        print(f"  - Reserves: {state.get('has_reserves')}")
        
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

WHAT WE ALREADY HAVE (DO NOT ASK FOR THESE AGAIN):
{known_context}
Already collected: {', '.join(collected_data) if collected_data else 'nothing yet'}

CURRENT OBJECTIVE: {current_objective}

CLIENT'S LATEST MESSAGE: "{last_user_message}"

CRITICAL INSTRUCTIONS:
1. NEVER ask for information that's already been collected (listed above)
2. If client gives partial info (like "1 mill" for property price), EXTRACT IT and move on
3. If they asked a question, answer it helpfully and naturally
4. Acknowledge information warmly when provided
5. Be conversational, not robotic - vary your responses
6. Use their specific details in your responses
7. Keep responses under 3 sentences when possible

EXTRACTION NOTES:
- "1 mill", "1M", "one million" = 1000000 for property price
- "300k", "300 thousand" = 300000 for down payment
- "florida", "FL" = valid location responses
- "investment", "rental" = investment property

YOU MUST RESPOND WITH EXACTLY THIS FORMAT (all 3 lines required):
RESPONSE: [Your natural, conversational response - DO NOT re-ask for info already collected]
EXTRACT: [Any information to extract, or "none"]
ADVANCE: [true if you got meaningful info for current question, false if still need info]

Example correct response:
RESPONSE: Perfect—$500,000 down on a $1,000,000 Miami investment is very strong. Now, do you have a valid passport and visa?
EXTRACT: down_payment: 500000
ADVANCE: true"""

        llm_response = llm.invoke([HumanMessage(content=prompt)])
        response_text = llm_response.content
        
        print(f"\nLLM Response:")
        print(response_text[:500])  # First 500 chars
        
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
        
        # Safety net: If parsing failed, use the whole response
        if not response:
            response = response_text
            
            # Check if this looks like an acknowledgment even without proper format
            acknowledgment_phrases = [
                "perfect", "great", "excellent", "wonderful", "fantastic",
                "got it", "noted", "understood", "sounds good", "that works"
            ]
            
            response_lower = response.lower()
            
            # If response acknowledges info and mentions a value, assume we should advance
            if any(phrase in response_lower for phrase in acknowledgment_phrases):
                # Check if response contains the expected data type for current question
                if current_q == 3 and ("$" in response or "million" in response_lower or "000" in response):
                    advance = True
                elif current_q == 4 and ("$" in response or "down" in response_lower or "000" in response):
                    advance = True
                elif current_q in [1, 2, 5, 6, 7, 8] and len(response_lower) < 200:
                    # For other questions, if it's a short acknowledgment, likely got the info
                    advance = True
        
        print(f"\nParsed Results:")
        print(f"  - Response: {response[:100]}...")
        print(f"  - Extract: {extract_info}")
        print(f"  - Advance: {advance}")
        print("=== END DEBUG ===\n")
            
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
    
    print(f"\n>>> Extraction for Q{current_q}: '{last_user_message[:50]}...'")
    
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
- Property price (IMPORTANT: convert to number - "1 mill"/"1M"/"one million" = 1000000, "500K" = 500000)
- Down payment amount (convert to number - "300k" = 300000)
- Loan purpose (Personal Home/Second Home/Investment - "rental" = Investment)
- Has passport (true/false - if they say "yes" to "passport and visa", set BOTH to true)
- Has visa (true/false - if they say "yes" to "passport and visa", set BOTH to true)
- Current location (USA/Origin Country - any non-US country = Origin Country)
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
        
        # Parse the response with field name mapping
        extracted = {}
        field_mappings = {
            'location_city': 'property_city',
            'location_state': 'property_state',
            'property_purpose': 'loan_purpose',
            'property_type': 'property_type'
        }
        
        for line in response_text.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                
                # Map field names if needed
                mapped_key = field_mappings.get(key, key)
                
                if value.lower() in ['null', 'none', '']:
                    continue
                elif value.lower() == 'true':
                    extracted[mapped_key] = True
                elif value.lower() == 'false':
                    extracted[mapped_key] = False
                elif mapped_key in ['property_price', 'down_payment']:
                    try:
                        extracted[mapped_key] = float(value)
                    except ValueError:
                        continue
                else:
                    extracted[mapped_key] = value
        
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
            r'\$?([\d,]+(?:\.\d+)?)\s*(?:million|millions|mil|mill|m)\b',  # 1.5 million, 1 mill
            r'\$?([\d,]+(?:\.\d+)?)\s*(?:thousand|thousands|k)\b',     # 500k
            r'\$?([\d,]+(?:\.\d+)?)',                        # $500,000
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, full_conversation)
            if match:
                try:
                    number_str = match.group(1).replace(',', '')
                    number = float(number_str)
                    
                    if any(word in full_conversation for word in ['million', 'millions', 'mil', 'mill']):
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


def handle_letter_request(state: GraphState) -> GraphState:
    """
    Handle the user's response to the pre-qualification letter offer.
    Collects email and name if needed, then sends the letter.
    """
    import logging
    from .email_sender import send_prequalification_letter, send_simple_email
    
    logger = logging.getLogger(__name__)
    
    # Check if user has responded to letter offer
    if state.get("final_decision") == "Pre-Approved" and state.get("conversation_complete"):
        # Get last user message
        user_messages = [msg for msg in state["messages"] if msg["role"] == "user"]
        if user_messages:
            last_message = user_messages[-1]["content"].lower()
            
            # Check if user wants the letter
            yes_words = ['yes', 'sure', 'okay', 'ok', 'send', 'please', 'si', 'sí']
            no_words = ['no', 'nope', 'not', 'later', 'non', 'nein']
            
            if any(word in last_message for word in yes_words):
                # User wants the letter - check if we have email and name
                if not state.get("user_email") or not state.get("user_name"):
                    state["messages"].append({
                        "role": "assistant",
                        "content": "Perfect! To send you the pre-qualification letter, I'll need your email address and full name. Could you please provide both?"
                    })
                    state["awaiting_contact_info"] = True
                else:
                    # We have everything - send the letter
                    success = False
                    try:
                        # Try Gmail API first
                        success = send_prequalification_letter(
                            state["user_email"],
                            state["user_name"],
                            state["loan_details"]
                        )
                    except Exception as e:
                        logger.warning(f"Gmail API failed: {e}")
                        # Try simple SMTP as fallback
                        try:
                            from .letter_generator import generate_prequalification_letter
                            html_content, _ = generate_prequalification_letter(
                                state["user_name"],
                                state["loan_details"]
                            )
                            success = send_simple_email(
                                state["user_email"],
                                f"Your Mortgage Pre-Qualification Letter - {state['user_name']}",
                                html_content
                            )
                        except Exception as e2:
                            logger.error(f"SMTP fallback also failed: {e2}")
                    
                    if success:
                        state["messages"].append({
                            "role": "assistant",
                            "content": f"Excellent! I've sent your pre-qualification letter to {state['user_email']}. The letter includes your pre-qualified loan amount of ${state['loan_details']['loan_amount']:,.2f} and is valid for 90 days.\\n\\nA loan officer will also contact you within 24 hours to guide you through the next steps. If you have any questions in the meantime, feel free to ask!"
                        })
                    else:
                        state["messages"].append({
                            "role": "assistant",
                            "content": "I've recorded your information, but there was an issue sending the email automatically. A loan officer will contact you within 24 hours with your pre-qualification letter and to guide you through the next steps. Thank you for your patience!"
                        })
                    
                    state["letter_sent"] = success
                    
            elif any(word in last_message for word in no_words):
                # User declined the letter
                state["messages"].append({
                    "role": "assistant",
                    "content": "No problem! Your pre-qualification is still valid. When you're ready to receive your formal letter or move forward with your application, just let us know. A loan officer will contact you within 24 hours to discuss your options."
                })
                state["letter_declined"] = True
                
            elif state.get("awaiting_contact_info"):
                # Try to extract email and name from the message
                import re
                
                # Extract email
                email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                email_match = re.search(email_pattern, last_message)
                if email_match:
                    state["user_email"] = email_match.group()
                
                # Extract name (simple heuristic - look for capitalized words)
                # This is a simplified approach - in production, use NER
                words = last_message.split()
                potential_names = []
                for i, word in enumerate(words):
                    if word[0].isupper() and word.lower() not in ['my', 'name', 'is', 'email', 'address']:
                        potential_names.append(word)
                        # Check if next word is also capitalized (last name)
                        if i + 1 < len(words) and words[i + 1][0].isupper():
                            potential_names.append(words[i + 1])
                            break
                
                if potential_names:
                    state["user_name"] = ' '.join(potential_names)
                
                # Check if we have both now
                if state.get("user_email") and state.get("user_name"):
                    # Recurse to send the letter
                    state["awaiting_contact_info"] = False
                    return handle_letter_request(state)
                elif state.get("user_email") and not state.get("user_name"):
                    state["messages"].append({
                        "role": "assistant",
                        "content": f"Thank you! I have your email as {state['user_email']}. Could you please also provide your full name for the letter?"
                    })
                elif state.get("user_name") and not state.get("user_email"):
                    state["messages"].append({
                        "role": "assistant",
                        "content": f"Thank you, {state['user_name']}! Could you please also provide your email address so I can send you the letter?"
                    })
                else:
                    state["messages"].append({
                        "role": "assistant",
                        "content": "I couldn't quite catch that. Could you please provide your email address and full name? For example: 'John Smith, john.smith@email.com'"
                    })
    
    return state


def final_decision_node(state: GraphState) -> GraphState:
    """Final node that applies the rules engine and provides decision."""
    from .rules_engine import check_preapproval, get_preapproval_details
    
    decision = check_preapproval(state)
    details = get_preapproval_details(state)
    
    state["final_decision"] = decision
    state["conversation_complete"] = True
    
    # Create detailed response
    if decision == "Pre-Approved":
        # Store loan details for letter generation
        state["loan_details"] = details
        
        message = f"""🎉 Congratulations! You are PRE-APPROVED for our Foreign Nationals loan program!

Here's your loan summary:
• Property Price: ${details['property_price']:,.2f}
• Down Payment: ${details['down_payment']:,.2f} ({details['down_payment_percentage']:.1f}%)
• **Pre-Qualified Loan Amount: ${details['loan_amount']:,.2f}**
• LTV Ratio: {details['ltv_ratio']:.1f}%

Based on your information, you qualify for a loan of **${details['loan_amount']:,.2f}** to purchase your property in {state.get('property_city', '')}, {state.get('property_state', '')}.

Would you like me to send you a formal pre-qualification letter? This official document can be used when making offers on properties and shows sellers that you're a serious, qualified buyer."""

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