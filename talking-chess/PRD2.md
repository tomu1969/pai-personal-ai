PRD: Talking Chess - Conversational Persona "Irina" (Phase 1: Text & Logic)

Document Details



Project Name

Talking Chess (Chat & Mentor Layer)

Status

Approved Draft (v3)

Target

Bridge between Canvas Chess V2 and LLM Backend

Core Objective

Transform a silent chess engine into an interactive mentor named "Irina" that challenges the user to think deeper.

1. Executive Summary

The current application is a high-quality, canvas-based chess interface with a mute AI opponent. This initiative aims to add a "Conversational Layer" where an AI Mentor, a persona named "Irina", observes the game.

Unlike standard chess bots that simply state the best move, Irina uses the Socratic Method. She analyzes the board state, engine evaluation, and the user's estimated ELO to provide hints, ask probing questions, and guide the user to find the solution themselves.

2. User Experience (UX) Specifications

2.1. UI Layout & Wireframe

The interface must be fully responsive. The Game Controls are moved to a sleek navigation bar above the board to maximize vertical space and provide a clean aesthetic.

Visual Structure (Desktop View):

+-----------------------------------------------------------------------+
|  [Header] Talking Chess - Canvas V2   [ELO: 1200] [Status: Active]    |
+-----------------------------------------------------------------------+
|  [Controls Bar]  [New Game] [Flip] [Undo]   |   Level: Intermediate   |
+-----------------------------------------------------------------------+
|                                   |                                   |
|                                   |  +--- CHAT: "Irina" ----------+   |
|                                   |  | [Header]: Irina (Online)   |   |
|      (HTML5 CANVAS BOARD)         |  |                            |   |
|                                   |  | [Message Stream Scroll]    |   |
|      [   a   b   c ...  ]         |  | User: Is this bad?         |   |
|    8 [  R   N   B ...   ]         |  |                            |   |
|    7 [  P   P   P ...   ]         |  | Irina: It is risky. Look   |   |
|    ...                            |  |   at your King safety.     |   |
|    1 [  R   N   B ...   ]         |  |                            |   |
|                                   |  | [Status]: Irina typing...  |   |
|                                   |  |                            |   |
|                                   |  | [ Input Field... ] [Send]  |   |
|                                   |  +----------------------------+   |
|                                   |                                   |
+-----------------------------------------------------------------------+


Visual Structure (Mobile View):

+---------------------------------------+
| [Header] Talking Chess  [Menu =]      |
+---------------------------------------+
| [Controls Row]: [New] [Flip] [Undo]   |
+---------------------------------------+
| [ELO: 1200]  [Status: White to Move]  |
+---------------------------------------+
|                                       |
|        (HTML5 CANVAS BOARD)           |
|      (Full Width, Responsive)         |
|                                       |
+---------------------------------------+
|                                       |
|  +--- CHAT DRAWER / SECTION ------+   |
|  | [^] Irina (Online) - Tap to Open   |
|  |                                    |
|  | Irina: Watch that Knight!          |
|  |                                    |
|  | [ Input Field ] [Send]             |
|  +--------------------------------+   |
|                                       |
+---------------------------------------+


2.2. Mobile Responsiveness Strategy

To ensure a high-quality experience on phones and tablets:

Adaptive Canvas: The canvas element must resize dynamically based on the viewport width (vw), maintaining a 1:1 aspect ratio, but never exceeding the viewport height minus UI overhead.

Touch Targets: All buttons in the "Controls Bar" must have a minimum touch target of 44x44px.

Chat Drawer: On mobile, the chat should not permanently occupy vertical space. It should be:

Collapsed State: Shows only the last message toast and a small input bar.

Expanded State: Slides up or expands to show history when tapped.

Input Handling: Focusing the chat input must not obscure the board (handle virtual keyboard pushing content up).

2.3. Interaction Model

The interaction is Bi-Directional:

User-Initiated: The user types questions like "What is the plan here?"

System-Initiated (Triggers): Irina voluntarily interjects based on game events:

Blunder Alert: Significant drop in Stockfish evaluation (> 2.0).

Missed Opportunity: User missed a forced mate.

Opening Theory: Commenting on the specific opening played.

3. The "Irina" Persona & Logic

3.1. Persona Configuration

The persona is not hardcoded to "Mentor" but defined by variables to allow for future "Personality Packs."

Configuration Variable: const AI_PERSONA_NAME = "Irina";

Origin: Russian Chess School archetype.

Tone: Direct, slightly stern but encouraging, highly intellectual.

Typing Indicator: Must dynamically use the variable: "{AI_PERSONA_NAME} is analyzing..."

3.2. Core Philosophy (The Socratic Method)

Irina must not be a "Cheat Engine."

Bad: "Move your Bishop to C4."

Good (Irina Style): "You are focusing too much on the kingside. Have you noticed the weakness your opponent left on C4?"

3.3. Dynamic Skill Adjustment

Irina reads the ELO Setting (800–3000) from the existing app config:

Low ELO (800-1200): She focuses on basic safety ("Stop hanging your pieces.").

Mid ELO (1200-1800): She focuses on positional concepts.

High ELO (1800+): She focuses on prophylaxis and long-term strategy.

4. Technical Architecture

To bridge the Client (Canvas/JS) and the Intelligence (LLM), we require a new backend layer.

4.1. System Diagram

[User Browser (Mobile/Desktop)]
    |-- HTML5 Canvas (Responsive)
    |-- Stockfish.js (Move Eval)
    |-- Chat UI (Drawer/Sidebar)
    |       ^
    |       | (HTTP POST Payload)
    v       v
[Node.js/Express Server]
    |-- Context Builder (Formats PGN/FEN/Eval)
    |-- Persona Injector (Injects "Irina" prompt)
    |-- OpenAI/Anthropic API Client
            ^
            | (Request/Response)
            v
[LLM Provider] (e.g., GPT-4o or Claude 3.5 Sonnet)


4.2. Data Payload Structure

The Client sends this "Full Context Object" to the Server:

{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "pgn": "1. e4 ...",
  "lastMove": "e2e4",
  "userElo": 1200,
  "personaName": "Irina", 
  "engineEval": {
    "score": -0.4,
    "bestMove": "c7c5"
  },
  "chatHistory": [ ...last 4 messages... ],
  "userMessage": "What should I do now?"
}


4.3. System Prompt Strategy

The server wraps the user input with the strict Irina persona.

Draft System Prompt:

"You are {{personaName}}, a world-class Chess Coach from Russia.
Your student has an ELO of {{userElo}}.

Your Goal: Guide the user to find the best move themselves.
Voice: Direct, intelligent, slightly strict but supportive. Use the Socratic method.

Rules:

Never explicitly state the best move unless asked directly.

Adjust complexity to the user's ELO.

Be concise.

Current Context:
Engine Best Move: {{bestMove}}
Engine Eval: {{score}}"

5. Implementation Roadmap

Phase 1: The Backend Bridge

Task 1.1: Create server/index.js (Express).

Task 1.2: Configure .env for API keys.

Task 1.3: Create /api/chat endpoint accepting the Context Payload.

Phase 2: The State Extractor (Client-Side)

Task 2.1: Update stockfish-engine.js to broadcast Evaluation Score and Best Line.

Task 2.2: Create captureGameState() in chess-v2.js to package FEN, PGN, and Engine Data.

Phase 3: The UI & Responsive Layout

Task 3.1: Reorganize DOM: Move controls to top bar (Flexbox/Grid).

Task 3.2: Implement Mobile "Chat Drawer" logic vs Desktop "Sidebar".

Task 3.3: Implement dynamic Canvas resizing for mobile screens.

Task 3.4: Implement Fetch logic (Client -> Server).

Task 3.5: Render Irina's response.

6. Acceptance Criteria (DoD)

UI Match: Top bar controls + Sidebar chat (Desktop) / Drawer chat (Mobile).

Responsiveness: Board scales correctly on mobile without scrolling; chat does not block gameplay.

Persona Accuracy: The AI acts as "Irina" and uses the correct typing indicator.

Security: No API keys in client-side code.

Socratic Mentoring: The AI asks leading questions rather than giving answers immediately.