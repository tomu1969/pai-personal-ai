"""
FastAPI application for the mortgage pre-approval chatbot.
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

app = FastAPI(title="Mortgage Pre-Approval Chatbot", version="1.0.0")

# Mount static files
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# In-memory storage for conversation states (use Redis/DB in production)
conversations: Dict[str, GraphState] = {}

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    complete: bool = False
    decision: Optional[str] = None

def create_initial_state() -> GraphState:
    """Create a new conversation state."""
    return {
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

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint for the mortgage pre-approval chatbot.
    """
    try:
        # Get or create conversation
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        print(f"\n{'='*60}")
        print(f"API REQUEST - Conversation: {conversation_id}")
        print(f"User Message: {request.message}")
        print(f"Is New Conversation: {conversation_id not in conversations}")
        
        if conversation_id not in conversations:
            conversations[conversation_id] = create_initial_state()
            print(f"Created new state with current_question: {conversations[conversation_id].get('current_question')}")
        
        state = conversations[conversation_id]
        
        print(f"State BEFORE processing:")
        print(f"  - Messages count: {len(state['messages'])}")
        print(f"  - Current question: {state.get('current_question')}")
        print(f"  - Property city: {state.get('property_city')}")
        print(f"  - Property state: {state.get('property_state')}")
        
        # Add user message to history
        state["messages"].append({"role": "user", "content": request.message})
        
        # Create and invoke the graph
        graph = create_mortgage_graph()
        result = graph.invoke(state)
        
        print(f"\nState AFTER processing:")
        print(f"  - Messages count: {len(result['messages'])}")
        print(f"  - Current question: {result.get('current_question')}")
        print(f"  - Property city: {result.get('property_city')}")
        print(f"  - Property state: {result.get('property_state')}")
        
        # Update stored state
        conversations[conversation_id] = result
        
        # Get the latest assistant response
        assistant_messages = [msg for msg in result["messages"] if msg["role"] == "assistant"]
        if assistant_messages:
            latest_response = assistant_messages[-1]["content"]
            print(f"Returning response: {latest_response[:100]}...")
        else:
            # Fallback for edge cases
            latest_response = "Hello! I'll help you with your mortgage pre-approval. Please provide your first answer."
            print("WARNING: No assistant messages found, using fallback")
        
        print(f"{'='*60}\n")
        
        return ChatResponse(
            response=latest_response,
            conversation_id=conversation_id,
            complete=result.get("conversation_complete", False),
            decision=result.get("final_decision")
        )
        
    except Exception as e:
        print(f"ERROR in chat_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation state for debugging."""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversations[conversation_id]

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Conversation deleted"}
    else:
        raise HTTPException(status_code=404, detail="Conversation not found")

@app.get("/")
async def serve_index():
    """Serve the main chat interface."""
    static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    return FileResponse(os.path.join(static_path, "index.html"))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "mortgage-chatbot"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)