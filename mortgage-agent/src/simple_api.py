"""
================================================================================
SIMPLE_API.PY - SIMPLIFIED MORTGAGE ASSISTANT API
================================================================================

Clean API endpoint using the simplified conversation system.
Single endpoint with natural conversation flow.
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uuid
import os

from .conversation_simple import process_conversation_turn
from .logging_utils import log_api_error

# Initialize app
app = FastAPI(title="Mortgage Pre-Qualification - Simplified", version="3.0.0")

# Static files
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# ============================================================================
# IN-MEMORY CONVERSATION STORAGE
# ============================================================================
conversations: Dict[str, List[Dict[str, str]]] = {}


# ============================================================================
# CONTEXT-AWARE ERROR RECOVERY
# ============================================================================

def determine_expected_field(messages: List[Dict[str, str]]) -> str:
    """
    Determine what field the user was likely trying to provide based on conversation context.
    """
    if not messages:
        return "unknown"
    
    # Get the last assistant message to understand what was being asked
    assistant_messages = [m for m in messages if m["role"] == "assistant"]
    if not assistant_messages:
        return "unknown"
    
    last_assistant_msg = assistant_messages[-1]["content"].lower()
    
    # Pattern matching to determine expected field
    if any(phrase in last_assistant_msg for phrase in ["down payment", "put down", "how much can you"]):
        return "down_payment"
    elif any(phrase in last_assistant_msg for phrase in ["property price", "price you", "cost of"]):
        return "property_price"
    elif any(phrase in last_assistant_msg for phrase in ["city", "location", "where is", "property location"]):
        return "property_location"
    elif any(phrase in last_assistant_msg for phrase in ["purpose", "property purpose", "use the property"]):
        return "loan_purpose"
    elif any(phrase in last_assistant_msg for phrase in ["passport", "valid passport"]):
        return "passport"
    elif any(phrase in last_assistant_msg for phrase in ["visa", "u.s. visa", "visa status"]):
        return "visa"
    elif any(phrase in last_assistant_msg for phrase in ["income", "documentation", "demonstrate income"]):
        return "income_documentation"
    elif any(phrase in last_assistant_msg for phrase in ["reserves", "saved", "payments saved"]):
        return "reserves"
    else:
        return "unknown"


def generate_contextual_error_message(user_input: str, expected_field: str) -> str:
    """
    Generate a helpful, context-aware error message based on what the user was trying to provide.
    """
    user_input_clean = user_input.strip()[:50]  # First 50 chars for context
    
    if expected_field == "property_location":
        return f"I'm having trouble processing '{user_input_clean}' as a location. Could you provide the city and state? For example: 'Miami, Florida' or 'Miami FL'"
    
    elif expected_field == "down_payment":
        return f"I couldn't process '{user_input_clean}' as a down payment amount. Please provide a dollar amount like '$120,000' or '120k'"
    
    elif expected_field == "property_price":
        return f"I couldn't process '{user_input_clean}' as a property price. Please provide an amount like '$500,000' or '500k'"
    
    elif expected_field == "loan_purpose":
        return f"I couldn't process '{user_input_clean}' as a property purpose. Please specify: 'primary residence', 'second home', or 'investment'"
    
    elif expected_field == "passport":
        return f"I couldn't process '{user_input_clean}' as a passport status. Please answer 'yes' or 'no' - do you have a valid passport?"
    
    elif expected_field == "visa":
        return f"I couldn't process '{user_input_clean}' as a visa status. Please answer 'yes' or 'no' - do you have a valid U.S. visa?"
    
    elif expected_field == "income_documentation":
        return f"I couldn't process '{user_input_clean}' as an income documentation answer. Please answer 'yes' or 'no' - can you provide income documentation?"
    
    elif expected_field == "reserves":
        return f"I couldn't process '{user_input_clean}' as a reserves answer. Please answer 'yes' or 'no' - do you have 6-12 months of reserves saved?"
    
    else:
        return f"I had trouble processing your response '{user_input_clean}'. Could you please rephrase it or provide more details?"

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    complete: bool = False


# ============================================================================
# MAIN CHAT ENDPOINT
# ============================================================================

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Simplified chat endpoint using single-prompt architecture.
    
    Natural conversation flow with coherent responses.
    """
    try:
        # Get or create conversation
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        print(f"\n{'='*80}")
        print(f"SIMPLE API REQUEST - Conversation: {conversation_id}")
        print(f"User Message: {request.message}")
        print(f"{'='*80}")
        
        if conversation_id not in conversations:
            conversations[conversation_id] = []
            print(f"Created new conversation")
        
        messages = conversations[conversation_id]
        
        # Add user message
        messages.append({"role": "user", "content": request.message})
        
        # Process turn with simplified system
        response = process_conversation_turn(messages, conversation_id)
        
        # Add assistant response
        messages.append({"role": "assistant", "content": response})
        
        # Save updated conversation
        conversations[conversation_id] = messages
        
        # Check if conversation is complete
        is_complete = ("pre-qualified" in response.lower() or 
                      "don't qualify" in response.lower() or
                      "Unfortunately" in response)
        
        print(f"Assistant Response: {response}")
        print(f"Complete: {is_complete}")
        
        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            complete=is_complete
        )
        
    except Exception as e:
        # Enhanced error handling with conversation state preservation
        log_api_error(conversation_id, "/chat", e, conversation_preserved=True)
        
        print(f"ERROR in simple chat_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # CRITICAL: Preserve conversation state even on errors
        # The user's message was already added to the conversation, so keep it
        # Add a recovery response instead of crashing the conversation
        
        error_type = type(e).__name__
        
        # Generate context-aware error message
        if "openai" in str(e).lower() or "api" in str(e).lower():
            recovery_response = "I'm experiencing a connection issue. Could you please try again?"
        elif "function" in str(e).lower() or "tool" in str(e).lower():
            recovery_response = "I'm having trouble processing that response. Let me continue with the next question."
        else:
            # Use contextual error messages for better user experience
            expected_field = determine_expected_field(messages[:-1])  # Exclude user's current message
            recovery_response = generate_contextual_error_message(request.message, expected_field)
        
        # Add the recovery response to maintain conversation flow
        messages.append({"role": "assistant", "content": recovery_response})
        conversations[conversation_id] = messages
        
        print(f">>> CONVERSATION PRESERVED: Added recovery response: {recovery_response}")
        
        return ChatResponse(
            response=recovery_response,
            conversation_id=conversation_id,
            complete=False
        )


# ============================================================================
# DEBUG ENDPOINTS
# ============================================================================

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation for debugging."""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"messages": conversations[conversation_id]}


@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Conversation deleted"}
    else:
        raise HTTPException(status_code=404, detail="Conversation not found")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "mortgage-simple", "version": "3.0.0"}


@app.get("/")
async def serve_index():
    """Serve the chat interface."""
    static_path_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    index_path = os.path.join(static_path_dir, "index.html")
    
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        return {
            "message": "Mortgage Pre-Qualification - Simplified API",
            "version": "3.0.0",
            "endpoints": {
                "POST /chat": "Main chat endpoint (simplified)",
                "GET /health": "Health check",
                "GET /conversations/{id}": "Debug conversation",
                "DELETE /conversations/{id}": "Delete conversation"
            }
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)