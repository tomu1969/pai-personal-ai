# Mortgage Pre-Qualification Assistant (v3.0.0)

A simplified conversational AI agent for foreign national mortgage pre-qualification using a single system prompt architecture.

## 🎯 Current Features

- **Simplified System Prompt**: 35-line prompt (down from 88) for faster responses
- **External Prompt Management**: System prompts stored in markdown files for easy editing
- **Universal Confirmation Protocol**: Consistent Answer → Confirm → Proceed flow
- **Smart Entity Management**: Contextual value extraction with confidence tracking
- **Natural Conversation Flow**: Single prompt handles both answers and questions
- **Foreign National Specialization**: 25% down payment, visa requirements, reserves
- **Enhanced Monitoring**: Real-time entity tracking and qualification logic visibility
- **Web Interface**: Clean chat interface for testing
- **Production Deployment**: Live on Render.com

## 🏗️ Architecture (v3.0.0 - Simplified)

The current implementation uses a **simplified single-prompt architecture** that replaced the previous graph-based approach:

```
User Message → simple_api.py → conversation_simple.py → OpenAI GPT-4o → Response
```

### Core Files:
- `src/simple_api.py` - FastAPI application with chat endpoints
- `src/conversation_simple.py` - Single system prompt conversation logic  
- `src/database.py` - Conversation persistence and entity storage
- `src/enhanced_logging.py` - Real-time debugging and monitoring
- `new_system_prompt.md` - Current simplified system prompt (active)
- `old_system_prompt.md` - Original complex system prompt (backup)

## 📋 Pre-Qualification Questions

The assistant collects 8 pieces of information for foreign nationals:

1. **Down Payment Amount** (minimum 25% required)
2. **Property Price** 
3. **Property Purpose** (primary residence, second home, investment)
4. **Property Location** (city and state)
5. **Valid Passport** (required for foreign nationals)
6. **Valid U.S. Visa** (B1/B2, E-2, H-1B, L-1, etc.)
7. **Income Documentation** (bank statements, tax returns, employment letters)
8. **Financial Reserves** (6-12 months of mortgage payments saved)

## 📁 Project Structure

```
mortgage-agent/
├── src/                      # Core application
│   ├── simple_api.py        # FastAPI server
│   ├── conversation_simple.py # Conversation logic
│   ├── database.py          # Persistence layer
│   ├── debug_api.py         # Debug endpoints
│   ├── enhanced_logging.py  # Logging utilities
│   └── legacy/              # Old implementations (v1.0-v2.0)
├── static/                  # Web interface
├── docs/                    # Documentation  
├── legacy/                  # Archived files
│   ├── tests/              # Old test files (60+ files)
│   ├── diagnostics/        # Diagnostic tools
│   └── monitoring/         # Old monitoring scripts
├── new_system_prompt.md    # Active prompt (simplified)
├── old_system_prompt.md    # Original prompt (backup)
├── watch_logs.py           # Enhanced conversation monitor
├── test_simple_api.py      # Essential API tests
├── test_complete_flow.py   # Essential flow tests
└── README.md
```

## 🔍 Monitoring Conversations

Run the enhanced log watcher to see real-time conversation analysis:

```bash
python watch_logs.py
```

**Live Monitoring Shows:**
- 📋 **ENTITIES:** Current entity state with values and checkmarks
- ❓ **NEXT Q:** Which question type will be asked next
- 🧮 **QUALIFICATION:** Pass/fail decisions with calculations  
- 💰 **CALC:** Down payment calculations and requirements
- 📊 **DOWN PMT %:** Real-time percentage validation (25% minimum)
- 🔄 **ENTITY UPDATES:** What changed each conversation turn
- ⏱️ **TIMING:** Performance metrics and response times

**Example Output:**
```
[10:30:15] 👤 USER: I can put 120k down
[10:30:17] 📋 ENTITIES: 💰 Down Payment: $120,000 | 🏠 Property Price: Not set
[10:30:17] ❓ NEXT Q: 🏠 Property Price  
[10:30:17] 🤖 ASSISTANT: What's the property price you're considering?
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"

# Start the server
python -m uvicorn src.simple_api:app --host 0.0.0.0 --port 8000 --reload
```

### Access the Interface

- **Web Interface**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Production Deployment

**Live URL**: https://mortgage-agent.onrender.com

## 🧪 Testing with cURL

### Start a New Conversation

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to apply for a mortgage"}'
```

### Continue Conversation

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "200k", 
    "conversation_id": "your-conversation-id"
  }'
```

### Example Complete Flow

```bash
# 1. Down payment
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "250k"}'

# 2. Property price  
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "1M", "conversation_id": "your-id"}'

# 3. Property purpose
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "investment", "conversation_id": "your-id"}'

# 4. Location
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Miami", "conversation_id": "your-id"}'

# 5. Passport
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "yes", "conversation_id": "your-id"}'

# 6. Visa (with confirmation protocol)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "what visas are admissible?", "conversation_id": "your-id"}'
# Response: "Admissible visas include B1/B2, E-2, H-1B. Do you have one of these visas?"

curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "yes", "conversation_id": "your-id"}'

# 7. Income documentation
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "yes", "conversation_id": "your-id"}'

# 8. Reserves
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "yes", "conversation_id": "your-id"}'
```

## 🤝 Universal Confirmation Protocol

The v3.0.0 system implements a universal confirmation protocol for ALL user questions:

### How It Works
1. **User asks any question** → System answers the question
2. **System asks for confirmation** → Never jumps to next topic
3. **User confirms** → System proceeds to next qualification question

### Examples

**Before (v2.0.0 - Protocol Violation):**
```
User: "what visas are admissible?"
Assistant: "Admissible visas include B1/B2, E-2, H-1B. Do you have income documentation?"
```

**After (v3.0.0 - Correct Protocol):**
```
User: "what visas are admissible?"  
Assistant: "Admissible visas include B1/B2, E-2, H-1B. Do you have one of these visas?"
User: "yes"
Assistant: "Can you demonstrate income with bank statements or tax returns?"
```

### Question Types Covered
- **Exploratory**: "how much can I afford?", "what if I put down 300k?"
- **Educational**: "what visas are admissible?", "what type of documentation?"
- **Clarification**: "do I need reserves?", "is it required?"

## 📊 Decision Logic

### Pre-Approval Requirements
- **Down Payment**: ≥25% of property price
- **Documentation**: Valid passport AND visa
- **Income Proof**: Bank statements, tax returns, or employment letters
- **Reserves**: 6-12 months of mortgage payments saved
- **Property Type**: Residential (personal, second home, investment)

### Possible Decisions
- **"Pre-Qualified"**: All requirements met
- **"Unfortunately, you don't qualify"**: Critical requirements missing

## 🔍 API Endpoints

- `POST /chat` - Main conversation endpoint
- `GET /conversations/{id}` - Get conversation history
- `DELETE /conversations/{id}` - Delete conversation
- `GET /health` - Health check
- `GET /` - Web interface

## 📚 Technical Stack

- **Backend**: FastAPI, Python 3.11+
- **AI Model**: OpenAI GPT-4o (fallback from GPT-5)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Deployment**: Render.com with auto-deploy
- **Storage**: SQLite with async support (production ready)

## ⚙️ Configuration

### Switching System Prompts

To switch between the simplified and original system prompts:

1. **Edit** `src/conversation_simple.py` line 296
2. **Change** `'new_system_prompt.md'` to `'old_system_prompt.md'`
3. **Restart** the server

```python
# Use simplified prompt (current - faster)
prompt_path = os.path.join(os.path.dirname(__file__), '..', 'new_system_prompt.md')

# Use original complex prompt (slower but more detailed)
prompt_path = os.path.join(os.path.dirname(__file__), '..', 'old_system_prompt.md')
```

### Performance Comparison:
- **New prompt**: ~1.7s response time for simple "yes" answers
- **Old prompt**: ~8s response time for simple "yes" answers

### Editing System Prompts

Simply edit the markdown files and restart the server:
- `new_system_prompt.md` - 35 lines, simplified rules
- `old_system_prompt.md` - 88 lines, comprehensive rules

No code changes needed for prompt modifications!

## 🔧 Recent Fixes (September 2025)

### Universal Confirmation Protocol
- Fixed issue where assistant would skip confirmation for educational questions
- Implemented consistent Answer → Confirm → Proceed flow for all question types

### Entity Persistence & Smart Merging
- Fixed entity reversion bug (down payment reverting from 250k to 200k)
- Added confirmed entities tracking throughout conversation history
- Implemented smart merging to protect confirmed values

### Reserve Calculations
- Fixed magnitude errors ($1B instead of $1M)
- Added proper loan amount calculations and formatting

### Down Payment Validation
- Prevents premature validation before having both down payment and property price
- Only validates percentage after collecting both values

## 🏢 Production Deployment

**Live Service**: https://mortgage-agent.onrender.com

### Environment Variables Required
```bash
OPENAI_API_KEY=your-openai-api-key
```

### Deployment Configuration
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn src.simple_api:app --host 0.0.0.0 --port $PORT`
- **Auto-Deploy**: Enabled from main branch
- **Health Check**: `/health`

## 📈 Version History

- **v3.0.0** (Current): Simplified single-prompt architecture with universal confirmation protocol
- **v2.0.0**: Slot-filling approach with complex state management (moved to legacy/)
- **v1.0.0**: Graph-based LangGraph implementation (moved to legacy/)

## 🧪 Testing

The system includes comprehensive test files for various scenarios. For the current v3.0.0 implementation, focus on:

- `test_simple_api.py` - API endpoint testing
- `test_simple_flow.py` - Conversation flow testing

Legacy test files for previous implementations are available in the repository.

## 🔍 Troubleshooting

### Common Issues

1. **ModuleNotFoundError: No module named 'dotenv'**
   - Solution: Ensure `python-dotenv>=1.0.0` is in requirements.txt

2. **OpenAI API Key Issues**
   - Verify OPENAI_API_KEY is set correctly
   - Check if key is valid and has sufficient credits

3. **Render Deployment Failures**
   - Check build logs for missing dependencies
   - Verify all required files are in repository

### Development Tips

- Use `--reload` flag for auto-restart during development
- Check logs with `tail -f` for real-time debugging
- Test API endpoints with `/docs` interface
- Monitor conversation state with debug endpoints

---

The Mortgage Pre-Qualification Assistant v3.0.0 provides a streamlined, production-ready solution for foreign national mortgage pre-qualification with consistent conversation flow and robust entity management.