"""
================================================================================
SLOT_API.PY - API FOR SLOT-FILLING SYSTEM
================================================================================

New API endpoint using slot-filling approach.
Can be deployed alongside existing API for A/B testing.
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import os

from .slot_state import SlotFillingState, create_slot_state
from .slot_graph import process_slot_turn

# Initialize app
app = FastAPI(title="Mortgage Pre-Qualification - Slot Filling", version="2.0.0")

# Static files
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# ============================================================================
# IN-MEMORY CONVERSATION STORAGE
# ============================================================================
conversations: Dict[str, SlotFillingState] = {}

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
    decision: Optional[str] = None
    captured_slots: Optional[Dict[str, Any]] = None


# ============================================================================
# MAIN CHAT ENDPOINT
# ============================================================================

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Slot-filling chat endpoint.
    
    Extracts multiple entities per turn, confirms deltas, asks about missing slots.
    """
    try:
        # Get or create conversation
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        print(f"\n{'='*80}")
        print(f"SLOT API REQUEST - Conversation: {conversation_id}")
        print(f"User Message: {request.message}")
        print(f"{'='*80}")
        
        if conversation_id not in conversations:
            conversations[conversation_id] = create_slot_state()
            print(f"Created new slot-filling state")
        
        state = conversations[conversation_id]
        
        # Add user message
        state["messages"].append({"role": "user", "content": request.message})
        
        # Process turn
        result = process_slot_turn(state)
        
        # Save updated state
        conversations[conversation_id] = result
        
        # Extract response
        assistant_messages = [msg for msg in result["messages"] if msg["role"] == "assistant"]
        if assistant_messages:
            latest_response = assistant_messages[-1]["content"]
        else:
            latest_response = "I'm here to help with your mortgage pre-qualification."
        
        # Build captured slots summary
        captured = {}
        for slot_name, slot_data in result["slots"].items():
            captured[slot_name] = {
                "value": slot_data["value"],
                "confidence": slot_data["confidence"]
            }
        
        return ChatResponse(
            response=latest_response,
            conversation_id=conversation_id,
            complete=result.get("conversation_complete", False),
            decision=result.get("final_decision"),
            captured_slots=captured
        )
        
    except Exception as e:
        print(f"ERROR in chat_endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")


# ============================================================================
# DEBUG ENDPOINTS
# ============================================================================

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation state for debugging."""
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "mortgage-slot-filling", "version": "2.0.0"}


@app.get("/")
async def serve_index():
    """Serve the chat interface."""
    static_path_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    index_path = os.path.join(static_path_dir, "index.html")
    
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        return {
            "message": "Mortgage Pre-Qualification - Slot Filling API",
            "version": "2.0.0",
            "endpoints": {
                "POST /chat": "Main chat endpoint (slot-filling)",
                "GET /health": "Health check",
                "GET /conversations/{id}": "Get conversation state",
                "DELETE /conversations/{id}": "Delete conversation"
            }
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)