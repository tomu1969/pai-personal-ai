"""
================================================================================
LOGGING_UTILS.PY - COMPREHENSIVE LOGGING FOR PRODUCTION DEBUGGING
================================================================================

High-fidelity logging utilities for mortgage agent debugging and monitoring.
Provides structured logging with conversation context and error tracking.
"""

import json
import logging
import traceback
from datetime import datetime
from typing import Dict, Any, List, Optional
import os


class MortgageAgentLogger:
    """
    Comprehensive logging system for mortgage agent with conversation context.
    
    Features:
    - Structured logging with JSON output
    - Conversation context tracking
    - Error categorization and analysis
    - Debug mode support
    - File and console output
    """
    
    def __init__(self, debug_mode: bool = False):
        """Initialize logger with optional debug mode."""
        self.debug_mode = debug_mode or os.getenv('DEBUG_MODE', 'false').lower() == 'true'
        
        # Create logs directory if it doesn't exist
        os.makedirs('logs', exist_ok=True)
        
        # Configure logging
        self.logger = logging.getLogger('mortgage_agent')
        self.logger.setLevel(logging.DEBUG if self.debug_mode else logging.INFO)
        
        # Clear existing handlers to avoid duplicates
        self.logger.handlers.clear()
        
        # File handler for all logs
        file_handler = logging.FileHandler('logs/mortgage_agent.log')
        file_handler.setLevel(logging.DEBUG)
        
        # Console handler for important logs
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # JSON formatter for structured logging
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
    
    def _format_log_entry(self, event_type: str, data: Dict[str, Any], 
                         conversation_id: str = None, error: Exception = None) -> str:
        """Format log entry as structured JSON."""
        
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "conversation_id": conversation_id,
            "data": data
        }
        
        if error:
            log_entry["error"] = {
                "type": type(error).__name__,
                "message": str(error),
                "traceback": traceback.format_exc() if self.debug_mode else None
            }
        
        return json.dumps(log_entry, indent=2 if self.debug_mode else None)
    
    def log_conversation_start(self, conversation_id: str, user_message: str):
        """Log conversation start."""
        log_data = {
            "user_message": user_message,
            "message_length": len(user_message)
        }
        
        log_entry = self._format_log_entry(
            "CONVERSATION_START", 
            log_data, 
            conversation_id
        )
        
        self.logger.info(f"CONVERSATION_START | {log_entry}")
    
    def log_entity_extraction(self, conversation_id: str, user_message: str, 
                            extracted_entities: Dict[str, Any], 
                            extraction_method: str = "openai_function_call"):
        """Log entity extraction results."""
        log_data = {
            "user_message": user_message,
            "extracted_entities": extracted_entities,
            "extraction_method": extraction_method,
            "entities_found": len([k for k, v in extracted_entities.items() if v is not None])
        }
        
        log_entry = self._format_log_entry(
            "ENTITY_EXTRACTION", 
            log_data, 
            conversation_id
        )
        
        self.logger.info(f"ENTITY_EXTRACTION | {log_entry}")
    
    def log_entity_extraction_error(self, conversation_id: str, user_message: str, 
                                  error: Exception, fallback_used: bool = False):
        """Log entity extraction errors with context."""
        log_data = {
            "user_message": user_message,
            "message_length": len(user_message),
            "fallback_used": fallback_used,
            "error_category": self._categorize_error(error)
        }
        
        log_entry = self._format_log_entry(
            "ENTITY_EXTRACTION_ERROR", 
            log_data, 
            conversation_id,
            error
        )
        
        self.logger.error(f"ENTITY_EXTRACTION_ERROR | {log_entry}")
    
    def log_conversation_processing(self, conversation_id: str, messages: List[Dict[str, str]], 
                                  entities: Dict[str, Any], response: str):
        """Log conversation processing details."""
        log_data = {
            "message_count": len(messages),
            "latest_user_message": messages[-1]["content"] if messages and messages[-1]["role"] == "user" else None,
            "entities_count": len([k for k, v in entities.items() if v is not None]),
            "entities": entities,
            "response_length": len(response),
            "response_preview": response[:100] + "..." if len(response) > 100 else response
        }
        
        log_entry = self._format_log_entry(
            "CONVERSATION_PROCESSING", 
            log_data, 
            conversation_id
        )
        
        self.logger.info(f"CONVERSATION_PROCESSING | {log_entry}")
    
    def log_conversation_error(self, conversation_id: str, messages: List[Dict[str, str]], 
                             error: Exception, recovery_attempted: bool = False):
        """Log conversation processing errors."""
        log_data = {
            "message_count": len(messages),
            "latest_user_message": messages[-1]["content"] if messages and messages[-1]["role"] == "user" else None,
            "recovery_attempted": recovery_attempted,
            "error_category": self._categorize_error(error)
        }
        
        log_entry = self._format_log_entry(
            "CONVERSATION_ERROR", 
            log_data, 
            conversation_id,
            error
        )
        
        self.logger.error(f"CONVERSATION_ERROR | {log_entry}")
    
    def log_api_error(self, conversation_id: str, endpoint: str, error: Exception, 
                     conversation_preserved: bool = False):
        """Log API endpoint errors."""
        log_data = {
            "endpoint": endpoint,
            "conversation_preserved": conversation_preserved,
            "error_category": self._categorize_error(error)
        }
        
        log_entry = self._format_log_entry(
            "API_ERROR", 
            log_data, 
            conversation_id,
            error
        )
        
        self.logger.error(f"API_ERROR | {log_entry}")
    
    def log_debug(self, event_type: str, data: Dict[str, Any], conversation_id: str = None):
        """Log debug information (only in debug mode)."""
        if not self.debug_mode:
            return
            
        log_entry = self._format_log_entry(event_type, data, conversation_id)
        self.logger.debug(f"DEBUG | {log_entry}")
    
    def _categorize_error(self, error: Exception) -> str:
        """Categorize errors for better analysis."""
        error_type = type(error).__name__
        error_message = str(error).lower()
        
        if "openai" in error_message or "api" in error_message:
            return "OPENAI_API_ERROR"
        elif "function" in error_message or "tool" in error_message:
            return "FUNCTION_CALLING_ERROR"
        elif "json" in error_message or "parse" in error_message:
            return "JSON_PARSING_ERROR"
        elif "connection" in error_message or "timeout" in error_message:
            return "NETWORK_ERROR"
        elif error_type in ["KeyError", "AttributeError", "IndexError"]:
            return "DATA_ACCESS_ERROR"
        else:
            return "UNKNOWN_ERROR"


# Global logger instance
logger = MortgageAgentLogger()


def log_conversation_start(conversation_id: str, user_message: str):
    """Convenience function for logging conversation start."""
    logger.log_conversation_start(conversation_id, user_message)


def log_entity_extraction(conversation_id: str, user_message: str, 
                         extracted_entities: Dict[str, Any], 
                         extraction_method: str = "openai_function_call"):
    """Convenience function for logging entity extraction."""
    logger.log_entity_extraction(conversation_id, user_message, extracted_entities, extraction_method)


def log_entity_extraction_error(conversation_id: str, user_message: str, 
                               error: Exception, fallback_used: bool = False):
    """Convenience function for logging entity extraction errors."""
    logger.log_entity_extraction_error(conversation_id, user_message, error, fallback_used)


def log_conversation_processing(conversation_id: str, messages: List[Dict[str, str]], 
                               entities: Dict[str, Any], response: str):
    """Convenience function for logging conversation processing."""
    logger.log_conversation_processing(conversation_id, messages, entities, response)


def log_conversation_error(conversation_id: str, messages: List[Dict[str, str]], 
                          error: Exception, recovery_attempted: bool = False):
    """Convenience function for logging conversation errors."""
    logger.log_conversation_error(conversation_id, messages, error, recovery_attempted)


def log_api_error(conversation_id: str, endpoint: str, error: Exception, 
                 conversation_preserved: bool = False):
    """Convenience function for logging API errors."""
    logger.log_api_error(conversation_id, endpoint, error, conversation_preserved)


def log_debug(event_type: str, data: Dict[str, Any], conversation_id: str = None):
    """Convenience function for debug logging."""
    logger.log_debug(event_type, data, conversation_id)