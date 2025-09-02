# AI PBX Chat Interface

A modern, WhatsApp-style chat interface for managing AI PBX conversations.

## 🚀 Quick Start

### Backend API (Port 3000)
```bash
npm start
```

### Frontend React App (Port 3001)
```bash
cd client
npm run dev
```

## 📱 Features

### ✅ Implemented Features

#### Backend API
- **REST API Endpoints**
  - `GET /api/chat/` - List all conversations with contact info
  - `GET /api/chat/:id` - Get messages for specific conversation
  - `POST /api/chat/:id/messages` - Send new message
  - `PATCH /api/chat/:id/read` - Mark conversation as read
  - `PATCH /api/chat/:id` - Update conversation settings (assistant toggle)
  - `GET /api/chat/search` - Search messages across conversations
  - `GET /api/chat/stats` - Get conversation statistics

- **Real-time WebSocket Support**
  - New message broadcasting
  - Typing indicators
  - Conversation updates
  - Message status updates
  - Connection status management

#### Frontend Interface
- **WhatsApp-style Design**
  - Dark theme with green accents (#25D366)
  - Two-panel layout (conversations | messages)
  - Responsive mobile-first design
  - Smooth animations and transitions

- **Conversation List**
  - Contact avatars with initials
  - Unread message badges
  - Last message preview
  - Search functionality
  - Assistant enabled/disabled indicator
  - Priority and category labels
  - Real-time updates

- **Message View**
  - Message bubbles (incoming/outgoing)
  - Different message types (text, audio, video, images, documents, reactions)
  - Message timestamps
  - Date separators
  - URL detection and linkification
  - Auto-scroll to latest messages
  - Contact information header

- **Message Input**
  - Auto-resizing textarea
  - Emoji button
  - Send button with loading state
  - Keyboard shortcuts (Enter to send)
  - Character counter
  - Connection status awareness

- **Real-time Features**
  - Live message updates
  - Connection status indicator
  - Typing indicators (framework ready)
  - Automatic conversation sorting

## 🎨 UI Components

### Colors (Tailwind Classes)
- `whatsapp-green-500` (#25D366) - Main accent color
- `chat-bg` (#0b141a) - Main background
- `chat-panel` (#202c33) - Panel background
- `chat-hover` (#2a3942) - Hover states
- `message-in` (#202c33) - Incoming messages
- `message-out` (#005c4b) - Outgoing messages
- `text-primary` (#e9edef) - Primary text
- `text-secondary` (#8696a0) - Secondary text
- `border-default` (#313d45) - Borders

### Key Components
- **ConversationList** - Left sidebar with all conversations
- **MessageView** - Main chat area with message bubbles
- **MessageInput** - Text input with send functionality
- **App** - Main container with state management

## 🔧 Technical Details

### API Integration
- Axios HTTP client with interceptors
- Automatic request/response logging
- Error handling and retry logic
- TypeScript interfaces for all data types

### WebSocket Integration
- Socket.io client for real-time communication
- Event subscription system
- Connection status monitoring
- Automatic reconnection handling

### State Management
- React hooks for local state
- Real-time updates via WebSocket events
- Optimistic UI updates
- Error handling and loading states

### Message Types Supported
- `text` - Regular text messages
- `audio` - Voice messages (🎵 indicator)
- `image` - Photos with preview
- `video` - Videos (📹 indicator)
- `document` - Files (📄 indicator)
- `reaction` - Message reactions (👍 indicator)

## 📊 Current Data

Based on real conversations loaded from the API:
- **15+ active conversations**
- **Multiple message types** (text, audio, reactions)
- **Real contact data** with names and phone numbers
- **Assistant responses** already in database
- **Unread message tracking**
- **Priority and category classification**

## 🌐 URLs

- **Backend API**: http://localhost:3000
- **Chat Interface**: http://localhost:3001
- **API Documentation**: Backend running at /api/chat/*
- **WebSocket**: ws://localhost:3000/socket.io

## 🎯 Next Steps

### Phase 3: Advanced Features
- Voice message playback
- Image/document preview
- Quick replies/templates
- Message search within conversation
- Export chat history
- Conversation labels/tags
- Archive/delete conversations
- Contact management
- Bulk message operations

### UI Enhancements
- Keyboard navigation
- Dark/light theme toggle
- Custom emoji picker
- Drag & drop file upload
- Message forwarding
- Message reactions
- Conversation pinning

## 📱 Mobile Responsiveness
- Mobile-first design approach
- Touch-friendly interface
- Swipe gestures (planned)
- Responsive breakpoints
- Optimized for tablets and phones

The chat interface is now fully functional with real-time updates, WhatsApp-style design, and comprehensive message management capabilities.