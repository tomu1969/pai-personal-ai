"""
Debug API endpoints for diagnosing production issues.
These endpoints provide detailed logging and error information.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import time
import traceback

# Import our enhanced logging
from .enhanced_logging import (
    logger, 
    log_function_call, 
    log_api_call, 
    log_processing_step,
    log_entity_state,
    log_conversation_state,
    check_environment
)

# Debug models
class DebugChatRequest(BaseModel):
    conversation: List[Dict[str, str]]
    
class DebugResponse(BaseModel):
    success: bool
    response: str = ""
    error: str = ""
    timing: Dict[str, float] = {}
    api_calls: int = 0
    entities: Dict[str, Any] = {}

def add_debug_endpoints(app: FastAPI):
    """Add debug endpoints to the FastAPI app"""
    
    @app.get("/debug/environment")
    async def debug_environment():
        """Check environment configuration"""
        logger.log("=== DEBUG ENVIRONMENT ENDPOINT CALLED ===", 'WARNING')
        check_environment()
        return {"status": "Environment check completed - see logs"}
    
    @app.post("/debug/test-passport", response_model=DebugResponse)
    async def debug_passport_conversation(request: DebugChatRequest):
        """Test the exact conversation that fails at passport question"""
        
        logger.log("=== DEBUG PASSPORT ENDPOINT CALLED ===", 'WARNING')
        logger.log(f"Received conversation with {len(request.conversation)} messages", 'INFO')
        
        # Default conversation if none provided
        messages = request.conversation if request.conversation else [
            {'role': 'assistant', 'content': 'I can help pre-qualify you for a mortgage with 8 questions. How much can you put down?'},
            {'role': 'user', 'content': 'i can do 120k'},
            {'role': 'assistant', 'content': 'Great! Now, what is the property price you are considering?'},
            {'role': 'user', 'content': 'about 500k'},
            {'role': 'assistant', 'content': 'Your down payment of $120,000 is 24% of the $500,000 property price, but you need at least 25%. Would you like to adjust your down payment or property price?'},
            {'role': 'user', 'content': 'whtas the minimun down payment i need?'},
            {'role': 'assistant', 'content': 'The minimum down payment you need for a $500,000 property is $125,000 (25%). Would you like to adjust your down payment or property price?'},
            {'role': 'user', 'content': 'ok yes'},
            {'role': 'assistant', 'content': 'Great! What\'s the property purpose: primary residence, second home, or investment?'},
            {'role': 'user', 'content': 'investment'},
            {'role': 'assistant', 'content': 'Thank you! Now, could you please provide the property location, including the city and state?'},
            {'role': 'user', 'content': 'Miami fl'},
            {'role': 'assistant', 'content': 'Thank you for the information! Do you have a valid passport?'},
            {'role': 'user', 'content': 'i do'}
        ]
        
        log_conversation_state(messages, "Starting debug test")
        
        timing = {}
        api_calls = [0]  # Use list to make it mutable
        start_total = time.time()
        
        try:
            # Import conversation processing with enhanced logging
            logger.log("Importing conversation module...", 'TRACE')
            from .conversation_simple import process_conversation_turn
            
            # Patch the analyze function to count API calls
            from . import conversation_simple as cs
            if hasattr(cs, 'analyze_user_response_with_llm'):
                original_analyze = cs.analyze_user_response_with_llm
                
                @log_api_call("OpenAI-Analysis")
                def logged_analyze(*args, **kwargs):
                    api_calls[0] += 1
                    return original_analyze(*args, **kwargs)
                
                cs.analyze_user_response_with_llm = logged_analyze
            
            # Add logging to OpenAI response generation
            if hasattr(cs, 'client'):
                original_create = cs.client.chat.completions.create
                
                @log_api_call("OpenAI-Response")
                def logged_create(*args, **kwargs):
                    api_calls[0] += 1
                    return original_create(*args, **kwargs)
                
                cs.client.chat.completions.create = logged_create
            
            # Process the conversation
            log_processing_step("Starting conversation processing")
            start_process = time.time()
            
            result = process_conversation_turn(messages)
            
            timing['total'] = time.time() - start_total
            timing['processing'] = time.time() - start_process
            
            log_processing_step(f"Processing completed in {timing['processing']:.2f}s")
            logger.log(f"Total API calls made: {api_calls[0]}", 'INFO')
            
            return DebugResponse(
                success=True,
                response=result,
                timing=timing,
                api_calls=api_calls[0]
            )
            
        except Exception as e:
            timing['total'] = time.time() - start_total
            error_msg = f"{type(e).__name__}: {str(e)}"
            
            logger.log(f"Processing failed after {timing['total']:.2f}s", 'ERROR')
            logger.error("Full exception details", e)
            
            # Include full traceback in response for debugging
            tb = traceback.format_exc()
            
            return DebugResponse(
                success=False,
                error=f"{error_msg}\n\nTraceback:\n{tb}",
                timing=timing,
                api_calls=api_calls[0]
            )
    
    @app.get("/debug/clear-logs")
    async def clear_debug_logs():
        """Clear the debug log file"""
        from .enhanced_logging import LOG_FILE
        try:
            with open(LOG_FILE, 'w') as f:
                f.write(f"=== LOG CLEARED AT {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
            logger.log("Debug logs cleared", 'INFO')
            return {"status": "Logs cleared"}
        except Exception as e:
            return {"status": f"Error clearing logs: {e}"}
    
    @app.get("/debug/log-file")
    async def get_log_file_path():
        """Get the path to the log file for monitoring"""
        from .enhanced_logging import LOG_FILE
        return {
            "log_file": LOG_FILE,
            "monitor_command": f"tail -f {LOG_FILE}",
            "color_monitor": "./monitor_logs.sh"
        }
    
    @app.get("/debug/recent-logs")
    async def get_recent_logs(lines: int = 50):
        """Get recent log entries for production debugging"""
        from .enhanced_logging import LOG_FILE
        try:
            with open(LOG_FILE, 'r') as f:
                all_lines = f.readlines()
            
            # Get last N lines
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
            return {
                "total_lines": len(all_lines),
                "returned_lines": len(recent_lines),
                "logs": [line.strip() for line in recent_lines if line.strip()]
            }
        except FileNotFoundError:
            return {
                "error": "Log file not found",
                "total_lines": 0,
                "returned_lines": 0,
                "logs": []
            }
    
    @app.get("/debug/logs-stream")
    async def get_logs_with_filters(
        level: str = None,
        contains: str = None,
        lines: int = 100
    ):
        """Get filtered log entries"""
        from .enhanced_logging import LOG_FILE
        try:
            with open(LOG_FILE, 'r') as f:
                all_lines = f.readlines()
            
            # Filter logs
            filtered_lines = []
            for line in all_lines:
                line = line.strip()
                if not line:
                    continue
                
                # Filter by level
                if level and f"[{level.upper()}]" not in line:
                    continue
                
                # Filter by content
                if contains and contains.lower() not in line.lower():
                    continue
                
                filtered_lines.append(line)
            
            # Get last N lines
            recent_lines = filtered_lines[-lines:] if len(filtered_lines) > lines else filtered_lines
            
            return {
                "filters": {"level": level, "contains": contains},
                "total_matches": len(filtered_lines),
                "returned_lines": len(recent_lines),
                "logs": recent_lines
            }
        except FileNotFoundError:
            return {
                "error": "Log file not found",
                "logs": []
            }

# Export the function
__all__ = ['add_debug_endpoints']