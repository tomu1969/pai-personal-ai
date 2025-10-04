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
    """Log the current entity state with detailed analysis"""
    # Basic entity summary
    entity_count = len([k for k, v in entities.items() if v is not None])
    confirmed_count = len([k for k, v in confirmed.items() if v is not None])
    
    logger.log(f"[ENTITIES] {stage} - {entity_count} entities, {confirmed_count} confirmed", 'DEBUG')
    
    # Log detailed entity breakdown
    required_fields = [
        "down_payment", "property_price", "loan_purpose", "property_city", 
        "property_state", "has_valid_passport", "has_valid_visa", 
        "can_demonstrate_income", "has_reserves"
    ]
    
    present_entities = {}
    missing_entities = []
    confirmed_entities = {}
    
    for field in required_fields:
        value = entities.get(field)
        confirmed_value = confirmed.get(field)
        
        if value is not None:
            if isinstance(value, (int, float)) and field in ["down_payment", "property_price"]:
                present_entities[field] = f"${value:,.0f}"
            else:
                present_entities[field] = str(value)
        else:
            missing_entities.append(field)
            
        if confirmed_value is not None:
            if isinstance(confirmed_value, (int, float)) and field in ["down_payment", "property_price"]:
                confirmed_entities[field] = f"${confirmed_value:,.0f}"
            else:
                confirmed_entities[field] = str(confirmed_value)
    
    # Log present entities
    if present_entities:
        logger.log(f"[ENTITIES_PRESENT] {', '.join([f'{k}={v}' for k, v in present_entities.items()])}", 'INFO')
    
    # Log confirmed entities
    if confirmed_entities:
        logger.log(f"[ENTITIES_CONFIRMED] {', '.join([f'{k}={v}' for k, v in confirmed_entities.items()])}", 'SUCCESS')
    
    # Log missing entities
    if missing_entities:
        logger.log(f"[ENTITIES_MISSING] {', '.join(missing_entities)}", 'WARNING')
    
    # Check for entity conflicts
    conflicts = []
    for field in required_fields:
        entity_val = entities.get(field)
        confirmed_val = confirmed.get(field)
        if entity_val is not None and confirmed_val is not None and entity_val != confirmed_val:
            conflicts.append(f"{field}: entity={entity_val} vs confirmed={confirmed_val}")
    
    if conflicts:
        logger.log(f"[ENTITIES_CONFLICT] {'; '.join(conflicts)}", 'ERROR')
    
    # Log special cases
    special_fields = [f for f in entities.keys() if f.startswith('updated_') or f in ['user_question', 'needs_clarification']]
    if special_fields:
        special_data = {field: entities[field] for field in special_fields if entities.get(field) is not None}
        logger.log(f"[ENTITIES_SPECIAL] {special_data}", 'DEBUG')

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

class TimingTracker:
    """Track detailed timing information for timeout debugging"""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = time.time()
        self.checkpoints = []
        self.max_duration = 30.0  # Render timeout threshold
        
    def checkpoint(self, stage_name: str, data: Dict = None):
        """Record a timing checkpoint"""
        current_time = time.time()
        elapsed = current_time - self.start_time
        
        checkpoint_data = {
            'stage': stage_name,
            'elapsed_seconds': elapsed,
            'elapsed_ms': elapsed * 1000,
            'timestamp': current_time
        }
        
        if data:
            checkpoint_data.update(data)
            
        self.checkpoints.append(checkpoint_data)
        
        # Log checkpoint with timeout warning
        timeout_risk = "⚠️" if elapsed > (self.max_duration * 0.7) else ""
        logger.log(f"[TIMING] {self.operation_name} - {stage_name}: {elapsed:.3f}s {timeout_risk}", 'INFO')
        
        # Detailed data logging
        if data:
            logger.log(f"[TIMING_DATA] {stage_name}: {data}", 'DEBUG')
            
        return elapsed
    
    def final_report(self):
        """Generate final timing report"""
        total_time = time.time() - self.start_time
        
        logger.log(f"[TIMING_FINAL] {self.operation_name} completed in {total_time:.3f}s", 'SUCCESS')
        
        # Log detailed breakdown
        for i, checkpoint in enumerate(self.checkpoints):
            stage_time = checkpoint['elapsed_seconds']
            if i > 0:
                prev_time = self.checkpoints[i-1]['elapsed_seconds']
                stage_duration = stage_time - prev_time
                logger.log(f"[TIMING_STAGE] {checkpoint['stage']}: {stage_duration:.3f}s (cumulative: {stage_time:.3f}s)", 'DEBUG')
        
        # Timeout risk assessment
        if total_time > self.max_duration * 0.8:
            logger.log(f"[TIMING_WARNING] Operation took {total_time:.3f}s - approaching timeout limit of {self.max_duration}s", 'WARNING')
        
        return total_time

def log_extraction_details(extraction_type: str, input_data: str, extracted_entities: Dict, analysis_time: float):
    """Log detailed entity extraction information"""
    logger.log(f"[EXTRACTION] {extraction_type} - {len(extracted_entities)} entities in {analysis_time:.3f}s", 'INFO')
    
    # Log input analysis
    input_preview = input_data[:100] + "..." if len(input_data) > 100 else input_data
    logger.log(f"[EXTRACTION_INPUT] '{input_preview}'", 'DEBUG')
    
    # Log extracted entities with detailed formatting
    if extracted_entities:
        for field, value in extracted_entities.items():
            if value is not None:
                if isinstance(value, (int, float)) and field in ["down_payment", "property_price"]:
                    formatted_value = f"${value:,.0f}"
                else:
                    formatted_value = str(value)
                logger.log(f"[EXTRACTION_FOUND] {field} = {formatted_value}", 'SUCCESS')
    else:
        logger.log(f"[EXTRACTION_EMPTY] No entities extracted from input", 'WARNING')

def log_conversation_flow(user_message: str, assistant_response: str, entities_before: Dict, entities_after: Dict, analysis_data: Dict):
    """Log detailed conversation flow analysis"""
    logger.log("[FLOW] === Conversation Turn Analysis ===", 'INFO')
    
    # Log user input
    logger.log(f"[FLOW_USER] '{user_message}'", 'INFO')
    
    # Log entity changes
    entity_changes = []
    for field in set(list(entities_before.keys()) + list(entities_after.keys())):
        before_val = entities_before.get(field)
        after_val = entities_after.get(field)
        
        if before_val != after_val:
            if before_val is None:
                entity_changes.append(f"{field}: ADDED={after_val}")
            elif after_val is None:
                entity_changes.append(f"{field}: REMOVED")
            else:
                entity_changes.append(f"{field}: {before_val} → {after_val}")
    
    if entity_changes:
        logger.log(f"[FLOW_CHANGES] {'; '.join(entity_changes)}", 'WARNING')
    else:
        logger.log("[FLOW_CHANGES] No entity changes", 'DEBUG')
    
    # Log analysis insights
    if analysis_data:
        conf_type = analysis_data.get('confirmation_type', 'unknown')
        is_confirmation = analysis_data.get('is_confirmation', False)
        logger.log(f"[FLOW_ANALYSIS] confirmation={is_confirmation}, type={conf_type}", 'INFO')
        
        reasoning = analysis_data.get('reasoning', '')
        if reasoning:
            logger.log(f"[FLOW_REASONING] {reasoning}", 'DEBUG')
    
    # Log assistant response
    response_preview = assistant_response[:100] + "..." if len(assistant_response) > 100 else assistant_response
    logger.log(f"[FLOW_ASSISTANT] '{response_preview}'", 'SUCCESS')

def log_failure_point(operation: str, error: Exception, context: Dict = None):
    """Log detailed failure information for debugging"""
    logger.log(f"[FAILURE] {operation} failed: {type(error).__name__}: {str(error)}", 'ERROR')
    
    if context:
        logger.log(f"[FAILURE_CONTEXT] {context}", 'ERROR')
    
    # Log stack trace
    import traceback
    tb_lines = traceback.format_exc().split('\n')
    for line in tb_lines:
        if line.strip():
            logger.log(f"[FAILURE_TRACE] {line}", 'ERROR')

def log_entity_validation(entities: Dict, validation_results: Dict):
    """Log entity validation results and issues"""
    logger.log(f"[VALIDATION] Entity validation completed", 'INFO')
    
    # Log validation summary
    valid_count = len([k for k, v in validation_results.items() if v.get('valid', False)])
    invalid_count = len(validation_results) - valid_count
    
    logger.log(f"[VALIDATION_SUMMARY] {valid_count} valid, {invalid_count} invalid entities", 'INFO')
    
    # Log specific validation issues
    for field, result in validation_results.items():
        if not result.get('valid', True):
            issues = result.get('issues', [])
            logger.log(f"[VALIDATION_ISSUE] {field}: {'; '.join(issues)}", 'WARNING')
    
    # Log missing required entities
    required_fields = [
        "down_payment", "property_price", "loan_purpose", "property_city", 
        "property_state", "has_valid_passport", "has_valid_visa", 
        "can_demonstrate_income", "has_reserves"
    ]
    
    missing_required = [field for field in required_fields if field not in entities or entities[field] is None]
    if missing_required:
        logger.log(f"[VALIDATION_MISSING] Required fields: {', '.join(missing_required)}", 'WARNING')
    
    # Log completion percentage
    completion_pct = ((len(required_fields) - len(missing_required)) / len(required_fields)) * 100
    logger.log(f"[VALIDATION_PROGRESS] {completion_pct:.1f}% complete ({len(required_fields) - len(missing_required)}/{len(required_fields)})", 'INFO')

def validate_entities(entities: Dict) -> Dict:
    """Validate entities and return detailed validation results"""
    validation_results = {}
    
    # Validate down payment
    if 'down_payment' in entities and entities['down_payment'] is not None:
        down_payment = entities['down_payment']
        issues = []
        
        if not isinstance(down_payment, (int, float)):
            issues.append("Not a number")
        elif down_payment <= 0:
            issues.append("Must be positive")
        elif down_payment < 10000:
            issues.append("Unusually low (< $10k)")
        elif down_payment > 5000000:
            issues.append("Unusually high (> $5M)")
        
        validation_results['down_payment'] = {
            'valid': len(issues) == 0,
            'issues': issues,
            'value': down_payment
        }
    
    # Validate property price
    if 'property_price' in entities and entities['property_price'] is not None:
        property_price = entities['property_price']
        issues = []
        
        if not isinstance(property_price, (int, float)):
            issues.append("Not a number")
        elif property_price <= 0:
            issues.append("Must be positive")
        elif property_price < 50000:
            issues.append("Unusually low (< $50k)")
        elif property_price > 20000000:
            issues.append("Unusually high (> $20M)")
        
        validation_results['property_price'] = {
            'valid': len(issues) == 0,
            'issues': issues,
            'value': property_price
        }
    
    # Validate down payment percentage if both values exist
    if ('down_payment' in entities and entities['down_payment'] is not None and 
        'property_price' in entities and entities['property_price'] is not None):
        
        down_payment = entities['down_payment']
        property_price = entities['property_price']
        
        if isinstance(down_payment, (int, float)) and isinstance(property_price, (int, float)) and property_price > 0:
            down_pct = (down_payment / property_price) * 100
            issues = []
            
            if down_pct < 25:
                issues.append(f"Below 25% requirement ({down_pct:.1f}%)")
            elif down_pct > 80:
                issues.append(f"Unusually high ({down_pct:.1f}%)")
            
            validation_results['down_payment_percentage'] = {
                'valid': len(issues) == 0,
                'issues': issues,
                'value': down_pct
            }
    
    # Validate location
    if 'property_state' in entities and entities['property_state'] is not None:
        state = entities['property_state']
        issues = []
        
        valid_states = {
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
        }
        
        if not isinstance(state, str):
            issues.append("Not a string")
        elif state.upper() not in valid_states:
            issues.append("Invalid state code")
        
        validation_results['property_state'] = {
            'valid': len(issues) == 0,
            'issues': issues,
            'value': state
        }
    
    # Validate city
    if 'property_city' in entities and entities['property_city'] is not None:
        city = entities['property_city']
        issues = []
        
        if not isinstance(city, str):
            issues.append("Not a string")
        elif len(city.strip()) < 2:
            issues.append("Too short")
        elif city.lower().strip() in ['i', 'me', 'you', 'we']:
            issues.append("Invalid city name")
        
        validation_results['property_city'] = {
            'valid': len(issues) == 0,
            'issues': issues,
            'value': city
        }
    
    # Validate loan purpose
    if 'loan_purpose' in entities and entities['loan_purpose'] is not None:
        purpose = entities['loan_purpose']
        issues = []
        
        valid_purposes = ['personal', 'second', 'investment', 'primary_residence', 'second_home']
        
        if not isinstance(purpose, str):
            issues.append("Not a string")
        elif purpose not in valid_purposes:
            issues.append(f"Invalid purpose (expected: {', '.join(valid_purposes)})")
        
        validation_results['loan_purpose'] = {
            'valid': len(issues) == 0,
            'issues': issues,
            'value': purpose
        }
    
    return validation_results

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
    'TimingTracker',
    'log_extraction_details',
    'log_conversation_flow',
    'log_failure_point',
    'log_entity_validation',
    'validate_entities',
    'LOG_FILE'
]