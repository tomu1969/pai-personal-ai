"""
================================================================================
QUESTION_HANDLER.PY - USER QUESTION DETECTION AND ANSWERING
================================================================================

Handles user questions at any point in the conversation.
Provides helpful answers then guides back to pending question.
"""

import os
from typing import Optional, Dict, Any
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def is_user_asking_question(message: str) -> bool:
    """
    Detect if user is asking a question rather than providing an answer.
    
    Returns True if the message appears to be a question.
    """
    
    msg_lower = message.lower().strip()
    
    # Explicit question marks
    if "?" in message:
        return True
    
    # Question words at start or middle
    question_words = [
        "what", "how", "why", "when", "where", "which", "who", "whom",
        "can i", "could i", "should i", "would i", "may i",
        "do i", "does", "is it", "are there", "will i", "am i"
    ]
    
    for word in question_words:
        if msg_lower.startswith(word + " ") or f" {word} " in f" {msg_lower} ":
            return True
    
    # Help/explanation requests
    help_phrases = [
        "help", "explain", "tell me", "show me", "describe",
        "i don't understand", "i dont understand", "confused",
        "what does", "what is", "what are"
    ]
    
    if any(phrase in msg_lower for phrase in help_phrases):
        return True
    
    return False


def get_pending_question_reminder(state: Dict[str, Any]) -> str:
    """
    Get a friendly reminder about the pending question.
    
    Returns empty string if no pending question.
    """
    
    last_asked = state.get("last_slot_asked")
    if not last_asked:
        return ""
    
    # Simple reminders for each slot
    reminders = {
        "down_payment": "How much do you have saved for a down payment?",
        "loan_purpose": "What will you use the property for?",
        "property_city": "Which city is the property in?",
        "property_state": "Which state is that in?",
        "property_price": "What price range are you considering?",
        "has_valid_passport": "Do you have a valid passport?",
        "has_valid_visa": "Do you have a valid U.S. visa?",
        "current_location": "Where are you currently located?",
        "can_demonstrate_income": "Can you provide income documentation?",
        "has_reserves": "Do you have the required reserves saved?"
    }
    
    return reminders.get(last_asked, f"Could you answer about {last_asked}?")


def handle_user_question(user_msg: str, state: Dict[str, Any]) -> Optional[str]:
    """
    Handle user questions with context-aware answers.
    
    Returns answer + reminder about pending question, or None if can't handle.
    """
    
    msg_lower = user_msg.lower()
    
    # =========================================================================
    # INCOME DOCUMENTATION QUESTIONS
    # =========================================================================
    if any(term in msg_lower for term in ["income", "document", "demonstrate", "proof", "verify"]):
        if any(q in msg_lower for q in ["how", "what", "which", "show", "need"]):
            answer = """To demonstrate income for a Foreign National loan, you can provide:

• **International bank statements** (last 3-6 months)
• **CPA letter** from a certified accountant in your home country
• **Tax returns** from your country of origin (last 2 years)
• **Employment verification letter** on company letterhead
• **Business financial statements** if self-employed
• **Rental income documentation** if applicable

Most lenders require proof of 2 years of stable income."""
            
            # Add pending question reminder
            reminder = get_pending_question_reminder(state)
            if reminder:
                answer += f"\n\nNow, back to where we were: {reminder}"
            
            return answer
    
    # =========================================================================
    # RESERVES CALCULATION
    # =========================================================================
    if "reserves" in msg_lower or ("how much" in msg_lower and state.get("last_slot_asked") == "has_reserves"):
        from .slot_state import get_slot_value
        
        property_price = get_slot_value(state, "property_price")
        down_payment = get_slot_value(state, "down_payment")
        
        if property_price and down_payment:
            # Calculate monthly payment
            loan_amount = property_price - down_payment
            monthly_rate = 0.07 / 12
            n_payments = 360
            monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate)**n_payments) / ((1 + monthly_rate)**n_payments - 1)
            monthly_payment *= 1.3  # Add taxes, insurance
            
            min_reserves = monthly_payment * 6
            max_reserves = monthly_payment * 12
            
            answer = f"""Your monthly mortgage payment will be approximately **${monthly_payment:,.0f}**.

For reserves, you'll need **6-12 months** of mortgage payments saved:
• Minimum (6 months): ${min_reserves:,.0f}
• Recommended (12 months): ${max_reserves:,.0f}

This ensures you can cover payments if income is interrupted."""
            
            reminder = get_pending_question_reminder(state)
            if reminder:
                answer += f"\n\n{reminder}"
            
            return answer
    
    # =========================================================================
    # CLOSING COSTS
    # =========================================================================
    if "closing" in msg_lower and "cost" in msg_lower:
        answer = """Closing costs typically include:

• Loan origination fee: 1-2% of loan amount
• Appraisal fee: $500-$800
• Title insurance: 0.5-1% of purchase price
• Attorney fees: $1,000-$2,000
• Escrow/recording fees: $500-$1,000

**Total: Usually 2-5% of loan amount**

Example: On a $700k loan, expect $14k-$35k in closing costs."""
        
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f"\n\nNow, {reminder}"
        
        return answer
    
    # =========================================================================
    # INTEREST RATES
    # =========================================================================
    if "rate" in msg_lower or "interest" in msg_lower:
        answer = """Current interest rates for Foreign National loans:

• Investment properties: 7.5-9%
• Primary residence: 7-8.5%
• Second home: 7.25-8.75%

Rates depend on:
• Down payment amount (higher = better rate)
• Credit profile
• Property type and location
• Loan amount"""
        
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f"\n\n{reminder}"
        
        return answer
    
    # =========================================================================
    # PROCESS TIMELINE
    # =========================================================================
    if any(term in msg_lower for term in ["how long", "timeline", "process", "takes"]):
        answer = """The mortgage process timeline:

• **Pre-qualification** (now): Immediate
• **Full application**: 2-3 days
• **Document review**: 5-7 days
• **Underwriting**: 2-3 weeks
• **Appraisal**: 1-2 weeks
• **Closing**: 30-45 days total

Foreign National loans may take slightly longer due to international documentation."""
        
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f"\n\nLet's continue: {reminder}"
        
        return answer
    
    # =========================================================================
    # DOWN PAYMENT CALCULATION
    # =========================================================================
    if "down payment" in msg_lower or "afford" in msg_lower:
        from .slot_state import get_slot_value
        import re
        
        # Check if user is asking about a specific property price
        # Extract price from message like "$1.5 million" or "1.5m"
        price_mentioned = None
        
        # Try to extract price from message
        # Check for millions first (most specific)
        million_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:million|mill?|mm|m)\b', msg_lower)
        if million_match:
            num = float(million_match.group(1))
            price_mentioned = num * 1000000
        else:
            # Check for thousands
            thousand_match = re.search(r'(\d+(?:\.\d+)?)\s*k\b', msg_lower)
            if thousand_match:
                num = float(thousand_match.group(1))
                price_mentioned = num * 1000
            else:
                # Check for dollar amounts
                dollar_match = re.search(r'\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)', msg_lower)
                if dollar_match:
                    num_str = dollar_match.group(1).replace(',', '')
                    price_mentioned = float(num_str)
                else:
                    # Check for bare numbers (6+ digits)
                    bare_match = re.search(r'\b(\d{6,})\b', msg_lower)
                    if bare_match:
                        price_mentioned = float(bare_match.group(1))
        
        current_down = get_slot_value(state, "down_payment")
        loan_purpose = get_slot_value(state, "loan_purpose") or "personal"
        
        if price_mentioned and current_down:
            # Calculate how much more down payment is needed
            if loan_purpose == "investment" or loan_purpose == "second":
                min_down_pct = 0.25  # 25%
            else:
                min_down_pct = 0.20  # 20%
            
            required_down = price_mentioned * min_down_pct
            current_down_float = float(current_down)
            difference = required_down - current_down_float
            
            if difference > 0:
                # Generate response with LLM for natural variation
                prompt = f"""You're a helpful mortgage advisor. The user asked about affording a ${price_mentioned:,.0f} property.

Current situation:
- They have ${current_down_float:,.0f} saved for down payment
- They need ${required_down:,.0f} ({int(min_down_pct*100)}% minimum)
- Gap: ${difference:,.0f} more needed
- With their current amount, they can afford up to ${current_down_float/min_down_pct:,.0f}

Generate a natural, helpful response that explains the situation and presents their options.
Be conversational, warm but professional. Don't use markdown formatting like ** or #."""

                try:
                    response = client.chat.completions.create(
                        model=MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7,
                        max_tokens=150
                    )
                    answer = response.choices[0].message.content.strip()
                except:
                    # Fallback if LLM fails
                    answer = f"To afford a ${price_mentioned:,.0f} property with a {int(min_down_pct*100)}% down payment, you'll need ${required_down:,.0f}. You currently have ${current_down_float:,.0f}, so you would need an additional ${difference:,.0f}. Alternatively, with your current down payment, you can afford properties up to ${current_down_float/min_down_pct:,.0f}."
            else:
                # Generate positive response with LLM
                prompt = f"""You're a helpful mortgage advisor. The user asked about affording a ${price_mentioned:,.0f} property.

Good news:
- They have ${current_down_float:,.0f} saved
- That's {(current_down_float/price_mentioned)*100:.1f}% down payment
- This exceeds the {int(min_down_pct*100)}% minimum requirement
- They may qualify for better interest rates

Generate a positive, encouraging response. 
Be conversational and warm. Don't use markdown formatting like ** or #."""

                try:
                    response = client.chat.completions.create(
                        model=MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7,
                        max_tokens=120
                    )
                    answer = response.choices[0].message.content.strip()
                except:
                    # Fallback if LLM fails
                    answer = f"Great news! With your ${current_down_float:,.0f} down payment, you can definitely afford a ${price_mentioned:,.0f} property. That's a {(current_down_float/price_mentioned)*100:.1f}% down payment, which exceeds the {int(min_down_pct*100)}% minimum and may qualify you for better rates!"
        
        elif current_down:
            # Generic down payment info with user's context
            loan_purpose = get_slot_value(state, "loan_purpose") or "personal"
            
            if loan_purpose == "investment" or loan_purpose == "second":
                min_pct = 25
                max_affordable = float(current_down) * 4
            else:
                min_pct = 20
                max_affordable = float(current_down) * 5
            
            answer = f"""With your **${float(current_down):,.0f}** down payment:

• Minimum required: **{min_pct}%** for {loan_purpose} property
• Maximum affordable: **${max_affordable:,.0f}** property
• Comfortable range: ${max_affordable*0.8:,.0f} - ${max_affordable:,.0f}

Higher down payments (30%+) may qualify for better rates and easier approval."""
        
        else:
            # No context, provide general info
            answer = """Minimum down payment requirements:

• **Primary residence**: 20% minimum
• **Second home**: 25% minimum
• **Investment property**: 25% minimum

Higher down payments (30%+) may qualify for better interest rates and easier approval."""
        
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f"\n\n{reminder}"
        
        return answer
    
    # =========================================================================
    # USE LLM FOR OTHER QUESTIONS
    # =========================================================================
    return generate_answer_with_llm(user_msg, state)


def generate_answer_with_llm(user_msg: str, state: Dict[str, Any]) -> str:
    """
    Use LLM to generate answers for questions not in knowledge base.
    """
    
    # Build context from state
    from .slot_state import get_slot_value
    
    context_parts = []
    if get_slot_value(state, "down_payment"):
        context_parts.append(f"User has ${get_slot_value(state, 'down_payment'):,.0f} for down payment")
    if get_slot_value(state, "loan_purpose"):
        context_parts.append(f"Looking for {get_slot_value(state, 'loan_purpose')} property")
    if get_slot_value(state, "property_city"):
        context_parts.append(f"Property in {get_slot_value(state, 'property_city')}")
    
    context = "; ".join(context_parts) if context_parts else "Starting pre-qualification"
    
    prompt = f"""You are a knowledgeable mortgage loan officer helping a Foreign National client.

Current context: {context}

User's question: "{user_msg}"

Provide a helpful, concise answer (2-4 sentences). Focus on Foreign National loan requirements.
Be professional but friendly. Don't make promises about approval."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        
        answer = response.choices[0].message.content.strip()
        
        # Add pending question reminder
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f"\n\n{reminder}"
        
        return answer
    
    except Exception as e:
        print(f"LLM answer generation error: {e}")
        
        # Fallback response
        answer = "I understand you have a question. Let me help you complete the pre-qualification first, then I can address that in detail."
        
        reminder = get_pending_question_reminder(state)
        if reminder:
            answer += f" {reminder}"
        
        return answer