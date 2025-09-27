# Mortgage Pre-Approval Chatbot MVP

A stateful conversational AI agent built with Python, LangChain, and LangGraph for mortgage pre-approval screening of Foreign Nationals.

## 🎯 Features

- **Stateful Conversations**: Maintains context across multiple interactions
- **Rules Engine**: Pure Python logic for loan approval decisions  
- **Conversational Intelligence**: Handles user questions and clarifications
- **Interactive Web UI**: Clean chat interface for testing
- **RESTful API**: Conversation management with unique IDs

## 🏗️ Architecture

- **Phase 1**: Foundation (GraphState, rules engine, FastAPI)
- **Phase 2**: Happy Path (8 sequential questions with LLM extraction)  
- **Phase 3**: Conversational Intelligence (router + clarification handling)
- **Phase 4**: API + Web UI (conversation management + HTML interface)

## 📋 Requirements

The chatbot asks 8 questions based on Foreign Nationals Non-QM Loan Guidelines:

1. **Property Location**: City/state in the U.S.
2. **Loan Purpose**: Personal, second home, or investment
3. **Property Price**: Approximate property value
4. **Down Payment**: Available cash for down payment  
5. **Documentation**: Valid passport and visa
6. **Current Location**: Living in origin country or U.S.
7. **Income Proof**: Bank statements or CPA letter capability
8. **Reserves**: 6-12 months of mortgage payments saved

## 🚀 Quick Start

### Installation

```bash
# Clone or navigate to the project
cd mortgage-agent

# Install dependencies
pip install -r requirements.txt

# Set OpenAI API key (required for LLM extraction)
export OPENAI_API_KEY="your-openai-api-key"
```

### Start the Server

```bash
# Start FastAPI server
python -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

### Access the Web Interface

Open your browser and go to: **http://localhost:8000**

## 🧪 Testing with cURL

### Start a New Conversation

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I want to apply for a mortgage"
  }'
```

**Expected Response:**
```json
{
  "response": "Hello! I'm here to help you with your mortgage pre-approval...",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "complete": false,
  "decision": null
}
```

### Continue an Existing Conversation

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Miami, Florida",
    "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Expected Response:**
```json
{
  "response": "Is the loan for a personal home, a second home, or an investment?",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000", 
  "complete": false,
  "decision": null
}
```

### Example Complete Flow

Here's a complete conversation example:

```bash
# Question 1: Property location
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Miami, Florida"}'

# Question 2: Loan purpose  
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Personal home", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 3: Property price
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "$400,000", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 4: Down payment
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "$120,000", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 5: Documents
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Yes, I have both passport and visa", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 6: Current location
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I am living in the USA", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 7: Income documentation
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Yes, I have bank statements", "conversation_id": "YOUR_CONVERSATION_ID"}'

# Question 8: Reserves (final question)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Yes, I have 8 months saved", "conversation_id": "YOUR_CONVERSATION_ID"}'
```

**Final Response (Pre-Approved):**
```json
{
  "response": "🎉 Congratulations! You are PRE-APPROVED for our Foreign Nationals loan program!\n\nHere's your loan summary:\n• Property Price: $400,000.00\n• Down Payment: $120,000.00 (30.0%)\n• Loan Amount: $280,000.00\n• LTV Ratio: 70.0%\n\nNext steps: A loan officer will contact you within 24 hours to proceed with your application.",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "complete": true,
  "decision": "Pre-Approved"
}
```

## 🧠 Conversational Intelligence

The chatbot can handle user questions during the flow:

### Question Example

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Why do you need to know the property location?", "conversation_id": "YOUR_ID"}'
```

**Response:**
```json
{
  "response": "I need to know the location to determine which state's lending regulations apply. You can provide either just the state (like 'California') or a specific city and state (like 'Miami, Florida').\n\nNow, could you please answer the original question?",
  "conversation_id": "YOUR_ID",
  "complete": false,
  "decision": null
}
```

Then provide the actual answer:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Miami, Florida", "conversation_id": "YOUR_ID"}'
```

## 📊 Decision Logic

The rules engine evaluates applications based on:

- **Down Payment**: Minimum 25% required (75% max LTV)
- **Documentation**: Valid passport AND visa required
- **Income Proof**: Bank statements or CPA letter capability
- **Reserves**: 6-12 months of mortgage payments
- **Property Type**: 1-4 unit residential (personal, second, investment)

### Possible Decisions

- **"Pre-Approved"**: All requirements met
- **"Rejected"**: Critical requirements not met  
- **"Needs Review"**: Incomplete information or edge cases

## 🔍 API Endpoints

### Core Endpoints

- `POST /chat` - Main chat endpoint
- `GET /conversations/{id}` - Get conversation state
- `DELETE /conversations/{id}` - Delete conversation
- `GET /health` - Health check
- `GET /` - Web interface

### Conversation Management

```bash
# Get conversation state
curl http://localhost:8000/conversations/YOUR_CONVERSATION_ID

# Delete conversation
curl -X DELETE http://localhost:8000/conversations/YOUR_CONVERSATION_ID
```

## 🧪 Running Tests

```bash
# Test rules engine (Phase 1)
python tests/test_rules.py

# Test conversational intelligence (Phase 3) 
python tests/test_clarification.py

# Test with PYTHONPATH
PYTHONPATH=. python tests/test_rules.py
PYTHONPATH=. python tests/test_clarification.py
```

## 🏢 Production Considerations

For production deployment:

1. **Replace in-memory storage** with Redis or database
2. **Add authentication** and rate limiting
3. **Implement proper logging** and monitoring
4. **Add input validation** and sanitization
5. **Use environment variables** for configuration
6. **Add error recovery** and conversation repair
7. **Implement conversation timeouts**

## 📝 Example Scenarios

### Scenario 1: Pre-Approved
- Property: $400,000 in Miami, FL
- Down Payment: $120,000 (30%)
- Has passport, visa, bank statements, reserves
- **Result**: Pre-Approved

### Scenario 2: Rejected (Insufficient Down Payment)
- Property: $400,000
- Down Payment: $80,000 (20%)
- **Result**: Rejected (need 25% minimum)

### Scenario 3: Rejected (Missing Documents)
- All financials good
- Missing passport or visa
- **Result**: Rejected (documentation required)

## 🎨 Web Interface Features

- **Real-time chat** with typing indicators
- **Message history** preservation
- **Completion status** with color coding
- **Responsive design** for mobile/desktop
- **Error handling** with user feedback

## 📚 Technical Stack

- **Backend**: FastAPI, Python 3.8+
- **AI Framework**: LangChain, LangGraph
- **LLM**: OpenAI GPT-3.5-turbo
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **State Management**: TypedDict with in-memory storage
- **Testing**: pytest, manual testing scripts

## 🚀 Success Criteria ✅

All master prompt requirements completed:

✅ **Phase 1**: GraphState TypedDict, rules engine, FastAPI setup  
✅ **Phase 2**: 8 question nodes, LLM extraction, sequential flow  
✅ **Phase 3**: Router for answer/question classification, clarifications  
✅ **Phase 4**: Conversation ID management, HTML interface, curl examples  

**Testing Results:**
- ✅ Rules engine rejects insufficient down payment
- ✅ Rules engine approves when all conditions met  
- ✅ Router correctly classifies answers vs questions
- ✅ Clarification flow returns to original question
- ✅ Web interface successfully logs FastAPI requests

The mortgage pre-approval chatbot MVP is **fully functional** and ready for demonstration! 🎉