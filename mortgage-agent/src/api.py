"""
================================================================================
API.PY - THE FRONT DOOR / RECEPTIONIST
================================================================================

This file is the web server that receives and responds to chat messages.

MAIN RESPONSIBILITIES:
1. Receive messages from the chat interface (static/index.html)
2. Store and retrieve conversation history from memory
3. Pass messages to the graph for processing (graph.py)
4. Send responses back to the user

THINK OF IT LIKE: A receptionist at a doctor's office
- Takes your information when you arrive
- Finds your file (or creates a new one)
- Passes you to the doctor (the graph)
- Gives you the doctor's instructions when you leave

KEY CONCEPTS:
- conversations{} = The filing cabinet that stores all active conversations
- Each conversation has a unique ID (like a patient ID number)
- State = All the information collected so far in a conversation
"""
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import os
from .state import GraphState
from .graph import create_mortgage_graph

# Initialize the web server
app = FastAPI(title="Mortgage Pre-Approval Chatbot", version="1.0.0")

# Set up access to static files (HTML, CSS, JS for the chat interface)
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# ============================================================================
# CONVERSATION STORAGE (In-Memory Database)
# ============================================================================
# This dictionary stores all active conversations
# Key = conversation_id (unique string like "abc-123")
# Value = GraphState (all the collected data and messages)
# 
# WARNING: In production, use Redis or a real database!
# Currently if server restarts, all conversations are lost.
conversations: Dict[str, GraphState] = {}

# ============================================================================
# DATA MODELS (Structure of Requests and Responses)
# ============================================================================

class ChatRequest(BaseModel):
    """
    What we receive from the frontend when user sends a message.
    
    Fields:
    - message: The text the user typed
    - conversation_id: Optional ID to continue an existing conversation
    """
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    """
    What we send back to the frontend after processing.
    
    Fields:
    - response: The bot's reply to show the user
    - conversation_id: The ID for this conversation (for next message)
    - complete: True if pre-approval process is finished
    - decision: "Pre-Approved", "Rejected", or "Needs Review" (when complete)
    """
    response: str
    conversation_id: str
    complete: bool = False
    decision: Optional[str] = None

# ============================================================================
# STATE INITIALIZATION
# ============================================================================

def create_initial_state() -> GraphState:
    """
    Create a blank form for a new conversation.
    
    This initializes all the fields we need to collect during pre-approval.
    Think of it like a paper form with empty boxes waiting to be filled in.
    
    DATA TO COLLECT (8 Questions):
    1. down_payment - How much money saved (Q1)
    2. property_city/state - Where buying (Q2)  
    3. loan_purpose - personal/second/investment (Q3)
    4. property_price - How much house costs (Q4)
    5. has_valid_passport/visa - Documentation (Q5)
    6. current_location - USA or origin country (Q6)
    7. can_demonstrate_income - Bank statements, etc (Q7)
    8. has_reserves - 6-12 months savings (Q8)
    
    TRACKING FIELDS:
    - messages: Chat history
    - current_question: Which of 8 questions we're on
    - conversation_complete: Are we done?
    - final_decision: The approval result
    """
    return {
        # Data to collect (starts as None, filled in during conversation)
        "property_city": None,
        "property_state": None,
        "loan_purpose": None,  # Must be "personal", "second", or "investment"
        "property_price": None,
        "down_payment": None,
        "has_valid_passport": None,
        "has_valid_visa": None,
        "current_location": None,
        "can_demonstrate_income": None,
        "has_reserves": None,
        
        # Conversation tracking
        "messages": [],  # Full chat history
        "current_question": 1,  # Which question (1-8) we're currently on
        "conversation_complete": False,
        "final_decision": None,  # "Pre-Approved", "Rejected", or "Needs Review"
        
        # Verification flow tracking
        "awaiting_verification": None,
        "verification_complete": None,
        "correction_mode": None
    }

# ============================================================================
# MAIN ENDPOINT: /chat
# ============================================================================
# This is where all user messages arrive and get processed

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    THE MAIN PROCESSING PIPELINE
    
    This endpoint handles every message the user sends. Here's the flow:
    
    1. IDENTIFY THE CONVERSATION
       - Use existing conversation_id if provided
       - Create new conversation_id if this is first message
    
    2. RETRIEVE OR CREATE STATE
       - Look up conversation in our "filing cabinet" (conversations dict)
       - If not found, create a new blank form (create_initial_state)
    
    3. ADD USER MESSAGE TO HISTORY
       - Append the user's message to the messages list
       - This builds up the full conversation history
    
    4. PROCESS WITH THE GRAPH
       - Pass the state to graph.py for processing
       - The graph decides what to do next (ask question, extract data, etc.)
       - Returns updated state with bot's response
    
    5. SAVE THE UPDATED STATE
       - Store the result back in our conversations dict
       - CRITICAL: We save the RESULT, not the original state!
    
    6. EXTRACT AND RETURN RESPONSE
       - Find the bot's latest message
       - Send it back to the frontend
    
    DEBUGGING: All the print() statements help us see what's happening
    """
    try:
        # -------------------------
        # STEP 1: Identify Conversation
        # -------------------------
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        # Logging for debugging
        print(f"\n{'='*60}")
        print(f"API REQUEST - Conversation: {conversation_id}")
        print(f"User Message: {request.message}")
        print(f"Is New Conversation: {conversation_id not in conversations}")
        
        # -------------------------
        # STEP 2: Get or Create State
        # -------------------------
        if conversation_id not in conversations:
            # New conversation - create blank form
            conversations[conversation_id] = create_initial_state()
            print(f"Created new state with current_question: {conversations[conversation_id].get('current_question')}")
        
        # Retrieve the conversation's current state
        state = conversations[conversation_id]
        
        # Log state before processing (helps debugging)
        print(f"State BEFORE processing:")
        print(f"  - Messages count: {len(state['messages'])}")
        print(f"  - Current question: {state.get('current_question')}")
        print(f"  - Property city: {state.get('property_city')}")
        print(f"  - Property state: {state.get('property_state')}")
        
        # -------------------------
        # STEP 3: Add User Message
        # -------------------------
        state["messages"].append({"role": "user", "content": request.message})
        
        # -------------------------
        # STEP 4: Process with Graph
        # -------------------------
        # This is where the magic happens!
        # The graph will:
        # - Decide which question to ask
        # - Extract data from user's message
        # - Generate the bot's response
        # - Update current_question if moving forward
        graph = create_mortgage_graph()
        result = graph.invoke(state)
        
        # Log state after processing (see what changed)
        print(f"\nState AFTER processing:")
        print(f"  - Messages count: {len(result['messages'])}")
        print(f"  - Current question: {result.get('current_question')}")
        print(f"  - Property city: {result.get('property_city')}")
        print(f"  - Property state: {result.get('property_state')}")
        print(f"  - Property price: {result.get('property_price')}")
        print(f"  - Down payment: {result.get('down_payment')}")
        print(f"  - Loan purpose: {result.get('loan_purpose')}")
        print(f"  - Has passport: {result.get('has_valid_passport')}")
        print(f"  - Has visa: {result.get('has_valid_visa')}")
        
        # -------------------------
        # STEP 5: Save Updated State
        # -------------------------
        # CRITICAL: Store the RESULT, not the original state
        # The graph modified the state, we need to keep those changes!
        conversations[conversation_id] = result
        
        # Verify it was saved correctly (paranoid checking)
        print(f"\nVERIFYING STATE PERSISTENCE:")
        print(f"  - Stored conversation has {len(conversations[conversation_id]['messages'])} messages")
        print(f"  - Stored current_question: {conversations[conversation_id].get('current_question')}")
        print(f"  - Stored property_city: {conversations[conversation_id].get('property_city')}")
        print(f"  - Stored down_payment: {conversations[conversation_id].get('down_payment')}")
        
        # -------------------------
        # STEP 6: Extract Response
        # -------------------------
        # Find the bot's latest message to send back to user
        assistant_messages = [msg for msg in result["messages"] if msg["role"] == "assistant"]
        if assistant_messages:
            latest_response = assistant_messages[-1]["content"]
            print(f"Returning response: {latest_response[:100]}...")
        else:
            # Edge case: No assistant message found (shouldn't happen)
            latest_response = "Hello! I'll help you with your mortgage pre-approval. Please provide your first answer."
            print("WARNING: No assistant messages found, using fallback")
        
        print(f"{'='*60}\n")
        
        # Send response back to frontend
        return ChatResponse(
            response=latest_response,
            conversation_id=conversation_id,
            complete=result.get("conversation_complete", False),
            decision=result.get("final_decision")
        )
        
    except Exception as e:
        # If anything goes wrong, log it and return error to frontend
        print(f"ERROR in chat_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

# ============================================================================
# DEBUGGING AND UTILITY ENDPOINTS
# ============================================================================

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    DEBUG ENDPOINT: View conversation state
    
    Use this to inspect what data has been collected so far.
    Example: GET /conversations/abc-123
    
    Returns the full state object with all fields and message history.
    """
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversations[conversation_id]

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """
    DEBUG ENDPOINT: Delete a conversation
    
    Removes conversation from memory.
    Example: DELETE /conversations/abc-123
    """
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Conversation deleted"}
    else:
        raise HTTPException(status_code=404, detail="Conversation not found")

# ============================================================================
# FRONTEND SERVING
# ============================================================================

@app.get("/")
async def serve_index():
    """
    Serve the chat interface HTML page
    
    When you visit http://localhost:8000/ in a browser,
    this returns the static/index.html file which contains
    the chat interface.
    
    If the HTML file doesn't exist, it returns API documentation instead.
    """
    static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    index_path = os.path.join(static_path, "index.html")
    
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        # Fallback if no HTML file - show API info
        return {
            "message": "Mortgage Pre-Approval Chatbot API",
            "version": "1.0.0",
            "endpoints": {
                "POST /chat": "Main chat endpoint",
                "GET /health": "Health check",
                "GET /conversations/{id}": "Get conversation state",
                "DELETE /conversations/{id}": "Delete conversation"
            }
        }

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring
    
    Returns 200 OK if the server is running.
    Used by monitoring tools to verify the service is alive.
    """
    return {"status": "healthy", "service": "mortgage-chatbot"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)