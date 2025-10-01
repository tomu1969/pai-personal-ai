"""
Enhanced logging module for debugging production issues.
Outputs to both console and a separate log file that can be monitored in another terminal.
"""

import os
import sys
import time
import json
import traceback
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional

# Log file path - can be monitored in separate terminal
LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "conversation_debug.log")

class ColoredLogger:
    """Logger with color support and file output"""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[0m',       # Default
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'SUCCESS': '\033[32m',   # Green
        'API_CALL': '\033[35m',  # Magenta
        'TRACE': '\033[90m',     # Gray
    }
    RESET = '\033[0m'
    
    def __init__(self, log_file: str = LOG_FILE):
        self.log_file = log_file
        # Clear log file on startup
        with open(self.log_file, 'w') as f:
            f.write(f"=== LOG STARTED AT {datetime.now().isoformat()} ===\n")
    
    def log(self, message: str, level: str = 'INFO', data: Optional[Dict] = None):
        """Log message to both console and file"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        # Format message
        log_entry = f"[{timestamp}] [{level}] {message}"
        
        # Add data if provided
        if data:
            log_entry += f" | {json.dumps(data, default=str)}"
        
        # Write to file (always, for monitoring in separate terminal)
        with open(self.log_file, 'a') as f:
            f.write(log_entry + '\n')
            f.flush()  # Force write immediately
        
        # Also print to console with color (for local development)
        color = self.COLORS.get(level, self.COLORS['INFO'])
        print(f"{color}{log_entry}{self.RESET}", flush=True)
        
        # ALSO print to stdout without colors for Render production logs
        # This ensures the logs appear in Render's web terminal
        sys.stdout.write(f"MORTGAGE_DEBUG: {log_entry}\n")
        sys.stdout.flush()
    
    def error(self, message: str, exception: Optional[Exception] = None):
        """Log error with traceback"""
        self.log(message, 'ERROR')
        if exception:
            tb = traceback.format_exc()
            for line in tb.split('\n'):
                if line.strip():
                    self.log(f"  {line}", 'ERROR')

# Global logger instance
logger = ColoredLogger()

def log_function_call(func_name: str):
    """Decorator to log function calls with timing"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Log entry
            logger.log(f"→ Entering {func_name}", 'TRACE')
            start_time = time.time()
            
            try:
                # Execute function
                result = func(*args, **kwargs)
                
                # Log success
                elapsed = time.time() - start_time
                logger.log(f"← {func_name} completed in {elapsed:.2f}s", 'SUCCESS')
                return result
                
            except Exception as e:
                # Log error
                elapsed = time.time() - start_time
                logger.log(f"✗ {func_name} failed after {elapsed:.2f}s: {e}", 'ERROR')
                logger.error(f"Exception in {func_name}", e)
                raise
        
        return wrapper
    return decorator

def log_api_call(service: str = "OpenAI"):
    """Decorator specifically for API calls"""
    def decorator(func):
        api_call_counter = [0]  # Use list to make it mutable in closure
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            api_call_counter[0] += 1
            call_num = api_call_counter[0]
            
            # Log API call start
            logger.log(f"API Call #{call_num} to {service}", 'API_CALL', {
                'function': func.__name__,
                'args_preview': str(args[0])[:50] if args else None
            })
            
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                elapsed = time.time() - start_time
                
                logger.log(f"API Call #{call_num} succeeded in {elapsed:.2f}s", 'SUCCESS')
                return result
                
            except Exception as e:
                elapsed = time.time() - start_time
                logger.log(f"API Call #{call_num} FAILED after {elapsed:.2f}s", 'ERROR', {
                    'error': str(e),
                    'type': type(e).__name__
                })
                raise
        
        return wrapper
    return decorator

def log_processing_step(step_name: str, data: Any = None):
    """Log a processing step with optional data"""
    logger.log(f"[STEP] {step_name}", 'INFO', {'data': data} if data else None)

def log_entity_state(entities: Dict, confirmed: Dict, stage: str):
    """Log the current entity state"""
    logger.log(f"[ENTITIES] {stage}", 'DEBUG', {
        'entities': entities,
        'confirmed': confirmed
    })

def log_conversation_state(messages: list, stage: str):
    """Log conversation state"""
    logger.log(f"[CONVERSATION] {stage} - {len(messages)} messages", 'DEBUG', {
        'last_message': messages[-1] if messages else None
    })

def check_environment():
    """Log environment configuration"""
    logger.log("=== ENVIRONMENT CHECK ===", 'INFO')
    
    # Check OpenAI configuration
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
        logger.log(f"OpenAI API Key: {masked_key}", 'INFO')
    else:
        logger.log("OpenAI API Key: NOT SET!", 'ERROR')
    
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    logger.log(f"OpenAI Model: {model}", 'INFO')
    
    # Check other env vars
    env_status = {
        'PYTHON_VERSION': sys.version.split()[0],
        'WORKING_DIR': os.getcwd(),
        'LOG_FILE': LOG_FILE
    }
    logger.log("Environment", 'INFO', env_status)
    logger.log("=== END ENVIRONMENT CHECK ===", 'INFO')

def log_api_metrics(api_call_data: dict):
    """Log API performance metrics for monitoring"""
    from datetime import datetime
    import json
    
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "conversation_length": api_call_data.get("message_count", 0),
        "api_calls_made": api_call_data.get("call_count", 0),
        "total_tokens": api_call_data.get("usage", {}).get("total_tokens", 0),
        "cached_tokens": api_call_data.get("usage", {}).get("cached_tokens", 0),
        "cache_hit_rate": 0,
        "response_time_ms": api_call_data.get("response_time_ms", 0),
        "approach": api_call_data.get("approach", "unknown")
    }
    
    # Calculate cache hit rate
    if metrics["total_tokens"] > 0:
        metrics["cache_hit_rate"] = (metrics["cached_tokens"] / metrics["total_tokens"]) * 100
    
    logger.log(f"API_METRICS: {json.dumps(metrics)}", 'METRICS', metrics)

# Export logger instance and decorators
__all__ = [
    'logger',
    'log_function_call',
    'log_api_call',
    'log_processing_step',
    'log_entity_state',
    'log_conversation_state',
    'log_api_metrics',
    'check_environment',
    'LOG_FILE'
]