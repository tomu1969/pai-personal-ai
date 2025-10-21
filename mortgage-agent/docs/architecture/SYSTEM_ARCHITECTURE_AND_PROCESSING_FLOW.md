# Mortgage Agent - System Architecture and Processing Flow

This document provides a comprehensive analysis of how the mortgage agent processes user input, extracts key information, stores it, and makes qualification decisions.

## Process Flow Diagram

```
┌─────────────────┐
│   USER INPUT    │
│  (via /chat)    │
└────────┬────────┘
         │
┌────────▼────────┐
│   SIMPLE_API    │ ◄─── FastAPI Endpoint
│ (simple_api.py) │      ChatRequest Processing
└────────┬────────┘
         │
┌────────▼────────┐
│    DATABASE     │ ◄─── SQLite/AsyncIO
│  (database.py)  │      Load conversation + entities
└────────┬────────┘
         │
┌────────▼────────┐
│ CONVERSATION    │ ◄─── Core Processing Engine
│   PROCESSOR     │      (conversation_simple.py)
│                 │
│ ┌─────────────┐ │
│ │System Prompt│ │ ◄─── new_system_prompt.md
│ │   Loader    │ │      Rules & Business Logic
│ └─────────────┘ │
└────────┬────────┘
         │
┌────────▼────────┐
│   LLM ENGINE    │ ◄─── OpenAI GPT-4o
│ Function Calling│      Response + Entity Extraction
│                 │
│ ┌─────────────┐ │
│ │Entity Schema│ │ ◄─── Structured Output
│ │Definition   │ │      9 Required Fields
│ └─────────────┘ │
└────────┬────────┘
         │
┌────────▼────────┐
│  QUALIFICATION  │ ◄─── Business Rules Engine
│   CALCULATOR    │      calculate_qualification()
│                 │
│ ┌─────────────┐ │
│ │ DSCR Logic  │ │ ◄─── Investment Property
│ │   Handler   │ │      Alternative Path
│ └─────────────┘ │
└────────┬────────┘
         │
┌────────▼────────┐
│   RESPONSE      │ ◄─── Decision Integration
│  GENERATION     │      LLM + Qualification Result
└────────┬────────┘
         │
┌────────▼────────┐
│    DATABASE     │ ◄─── State Persistence
│     SAVE        │      Updated entities + messages
└────────┬────────┘
         │
┌────────▼────────┐
│  USER RESPONSE  │
│   (JSON API)    │
└─────────────────┘
```

## Detailed Step-by-Step Process

### **1. Input Reception**
- **Component**: `simple_api.py` - FastAPI endpoint
- **Tool**: `@app.post("/chat")` decorator
- **Function**: `chat_endpoint(request: ChatRequest)`
- **Action**: Receives user message and optional conversation_id

### **2. Conversation Loading**
- **Component**: `database.py` - SQLite persistence layer
- **Tool**: `get_or_create_conversation_with_entities()`
- **Action**: Loads existing conversation history and confirmed entities from database
- **Storage**: `MortgageConversation` model with JSON-encoded messages and entities

### **3. Message History Management**
- **Component**: `simple_api.py` 
- **Action**: Appends new user message to conversation history
- **Data Structure**: List of `{"role": "user/assistant", "content": "message"}` dictionaries

### **4. Core Processing Engine**
- **Component**: `conversation_simple.py`
- **Function**: `process_conversation_turn(messages, conversation_id, persistent_entities)`
- **Tool**: Main orchestration engine that coordinates all processing steps

### **5. System Prompt Loading**
- **Component**: `conversation_simple.py`
- **Function**: `load_system_prompt()`
- **Source**: `new_system_prompt.md`
- **Content**: Business rules, DSCR logic, qualification criteria, conversation flow

### **6. Entity Extraction & Response Generation**
- **Component**: `conversation_simple.py`
- **Function**: `generate_response_and_update_entities()`
- **Tool**: OpenAI GPT-4o with Function Calling
- **Question Generation**: Hardcoded question strings via `generate_next_question_from_context()`
- **Schema**: Structured entity extraction for 9 required fields:
  - `down_payment` (number)
  - `property_price` (number) 
  - `loan_purpose` (enum: primary_residence, second_home, investment)
  - `property_city` (string)
  - `property_state` (string)
  - `has_valid_passport` (boolean)
  - `has_valid_visa` (boolean)
  - `can_demonstrate_income` (boolean)
  - `has_reserves` (boolean)

### **7. Information Completeness Check**
- **Component**: `conversation_simple.py`
- **Logic**: Checks if all 8 pieces of information are collected
- **Trigger**: When `all_info_collected = True`

### **8. Qualification Decision**
- **Component**: `conversation_simple.py`
- **Function**: `calculate_qualification(entities)`
- **Business Rules**:
  - Down payment ≥ 30% of property price
  - Valid passport required
  - Valid U.S. visa required
  - **DSCR Logic**: Investment properties can qualify without income docs
  - Financial reserves required (6-12 months)
- **Output**: `{"qualified": bool, "reason": string, "details": object}`

### **9. LLM Context Injection**
- **Component**: `conversation_simple.py` (lines 556-568)
- **Tool**: Dynamic qualification context injection
- **Logic**: 
  - If qualified: "QUALIFICATION RESULT: PRE-QUALIFIED"
  - If not qualified: "QUALIFICATION RESULT: NOT QUALIFIED"
- **Purpose**: Forces LLM to use authoritative business logic decision

### **10. Smart Entity Merging**
- **Component**: `conversation_simple.py`
- **Function**: `smart_merge_entities(current, new, confirmed)`
- **Logic**: Prevents data corruption by protecting confirmed values
- **Anti-pattern**: Stops regression from "$250k" back to "$200k"

### **11. Response Synthesis**
- **Component**: OpenAI GPT-4o
- **Input**: System prompt + conversation history + qualification context + entity state
- **Output**: Natural language response that follows qualification decision
- **Constraint**: Cannot override qualification result

### **12. State Persistence**
- **Component**: `database.py`
- **Function**: `save_conversation_with_entities_safe()`
- **Tool**: SQLite with AsyncIO
- **Data**: Updated message history + confirmed entities as JSON

### **13. Completion Detection**
- **Component**: `simple_api.py` (lines 174-176)
- **Logic**: Checks response for qualification keywords
- **Triggers**: "pre-qualified", "don't qualify", "Unfortunately"
- **Output**: `complete: boolean` flag

### **14. Response Delivery**
- **Component**: `simple_api.py`
- **Model**: `ChatResponse(response, conversation_id, complete)`
- **Format**: JSON API response to frontend

## Key Components and Their Roles

### **Core Files**:
1. **`simple_api.py`** - FastAPI orchestrator
2. **`conversation_simple.py`** - Processing engine 
3. **`database.py`** - Persistence layer
4. **`new_system_prompt.md`** - Business rules

### **Critical Functions**:
1. **`process_conversation_turn()`** - Main flow controller
2. **`generate_response_and_update_entities()`** - LLM interface
3. **`generate_next_question_from_context()`** - Hardcoded question generation
4. **`calculate_qualification()`** - Business logic engine
5. **`smart_merge_entities()`** - Data integrity protection

### **Data Flow**:
- **Input**: User text message
- **Extraction**: 9 structured entities via LLM Function Calling
- **Questions**: Hardcoded strings from `generate_next_question_from_context()`
- **Storage**: SQLite database with JSON encoding
- **Decision**: Python business logic (`calculate_qualification`)
- **Output**: Natural language response guided by qualification result

## DSCR Loan Processing

### **Investment Property Flow**:
1. User indicates property purpose as "investment"
2. User responds "no" to income documentation
3. System continues to collect all 8 pieces of information
4. `calculate_qualification()` allows qualification for investment properties without income docs
5. LLM receives "PRE-QUALIFIED" context for DSCR loan
6. User is informed they qualify for DSCR loan with NOI > PITI verification in next stage

### **DSCR Business Logic** (lines 970-973 in `conversation_simple.py`):
```python
if not entities.get("can_demonstrate_income"):
    if entities.get("loan_purpose") != "investment":
        errors.append("Income documentation required (non-investment property)")
    # For investment properties, no error - they qualify for DSCR
```

## Architecture Benefits

### **Separation of Concerns**:
- **LLM**: Natural language processing and conversation flow
- **Hardcoded Questions**: Consistent question phrasing via `generate_next_question_from_context()`
- **Python Logic**: Authoritative business rules and qualification decisions
- **Database**: Persistent state management
- **System Prompt**: Configurable business rules

### **Data Integrity**:
- Smart entity merging prevents value regression
- Confirmed entities are protected from overwriting
- Database persistence survives server restarts

### **Flexibility**:
- System prompt can be updated without code changes
- Business rules centralized in `calculate_qualification()`
- DSCR logic easily extensible for other loan types

This architecture ensures that qualification decisions come from authoritative business logic while maintaining natural conversation flow through LLM-generated responses.