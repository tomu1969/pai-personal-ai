# Master Prompt - Mortgage Pre-Approval Chatbot

## Mission
Build a functional MVP for a mortgage pre-approval chatbot using Python, LangChain, and LangGraph.

## Guiding Principles & Resources
This prompt is your primary directive and control flow guide. You must refer back to this document at the beginning of each phase to ensure you are following the plan precisely.

You will need to consult the following resource files for business logic and content:
- `questionnaire.md` - Contains the initial questions for mortgage pre-approval
- `guidelines.md` - Contains the Foreign Nationals Non-QM Loan Guidelines

## Phase 1: Foundation & Core Logic
**Objective:** Establish the project's technical backbone and define the core, non-AI logic.

### Tasks:
1. **Define State Object:** Create a Python TypedDict named `GraphState` that will serve as the graph's state. It must include keys for all data points in questionnaire.md (e.g., property_city: str, property_price: float, down_payment: float, has_valid_documents: bool, etc.) and a key messages to store chat history.

2. **Implement Rules Engine:** Create a pure Python function `check_preapproval(state: GraphState) -> str`. This function will take the final state as input and apply the rules from guidelines.md. It must return "Pre-Approved", "Rejected", or "Needs Review". This function must not contain any LLM calls.

3. **Set Up Project:** Initialize a LangGraph StateGraph with GraphState. Set up a basic FastAPI application with a single POST endpoint /chat.

### Testing and Validation (Phase 1):
- Write a unit test for `check_preapproval`. Assert that it returns "Rejected" for a down payment less than 25%. Assert it returns "Pre-Approved" for a case where all conditions are met.
- Ensure the FastAPI application file is syntactically correct and can be started.

## Phase 2: The "Happy Path" - Scripted Conversation
**Objective:** Build the primary conversational flow where the user answers every question directly.

### Tasks:
1. **Create Question Nodes:** For each question in questionnaire.md, create a dedicated node in the graph. The function for each node will append its specific question to the messages list in the state.

2. **Create Extraction Node:** Create a single node, `extract_info_node`. This node will use an LLM (prompted for structured output) to parse the user's most recent message and populate the corresponding fields in GraphState.

3. **Connect Nodes:** Using LangGraph's edges, connect the nodes in the exact sequence from questionnaire.md. The flow must be: Ask Question 1 -> extract_info_node -> Ask Question 2 -> extract_info_node ... ending with a final call to the check_preapproval node.

### Testing and Validation (Phase 2):
- Write a test script that simulates a "happy path" conversation.
- Programmatically invoke the graph with a list of mock user answers.
- After the final input, assert that all fields in the final state object are correctly populated.
- Assert that the final output from the graph is the expected pre-approval decision.

## Phase 3: Conversational Intelligence
**Objective:** Add the ability for the agent to handle user clarifications without breaking the main flow.

### Tasks:
1. **Implement Router:** Create a conditional edge that acts as a router. It must use an LLM to classify the user's input as either an "answer" or a "question".

2. **Create Clarification Node:** Build a new node, `clarification_node`, triggered when the router detects a "question". This node will use an LLM to generate a helpful response.

3. **Update Graph Flow:** Modify the graph's logic to use the router. If "answer", proceed to extract_info_node. If "question", divert to clarification_node. The clarification_node must always route back to the node that asked the original question.

### Testing and Validation (Phase 3):
- **Test Case 1 (Answer):** Rerun the "happy path" test from Phase 2. Assert that the router correctly identifies the inputs as answers and the outcome is unchanged.
- **Test Case 2 (Question):** Create a new test script where the user asks a question (e.g., "Why is the down payment so high?"). Assert that the graph's next output is a clarifying message, not the next question in the sequence. Then, provide the real answer and assert that the graph correctly returns to the main flow and asks the original question again.

## Phase 4: Finalization & UI
**Objective:** Finalize the API and create a simple user interface for testing.

### Tasks:
1. **Finalize API:** Complete the FastAPI /chat endpoint. It must handle a unique conversation ID to manage state between requests for different users.

2. **Create Simple UI:** Generate the code for a single index.html file. This file should contain basic HTML and JavaScript to create a chat window. The JavaScript must use fetch to call the /chat endpoint.

### Testing and Validation (Phase 4):
- Provide a curl command to demonstrate starting a new conversation with the /chat endpoint.
- Provide a second curl command that includes a conversation ID to demonstrate continuing an existing conversation.
- Confirm that the index.html file can be opened in a browser and that typing a message and hitting "send" successfully logs a request in the FastAPI server console.

## Success Criteria
By the end of all phases, you should have:
1. A working mortgage pre-approval chatbot with state management
2. A rules engine that applies loan guidelines
3. Conversational intelligence that handles user questions
4. A simple web interface for testing
5. Comprehensive tests validating all functionality