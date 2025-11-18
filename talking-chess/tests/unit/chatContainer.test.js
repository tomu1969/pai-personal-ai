/**
 * Chat Container Tests - TDD Phase 3.2
 * Tests chat UI components that sit alongside the chess board
 */

const ChatContainer = require('../../src/chat-container');

describe('Chat Container - UI Components', () => {
  let chatContainer;
  let mockDocument;
  let mockElement;
  let createdElements;

  beforeEach(() => {
    // Mock DOM elements
    mockElement = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      addEventListener: jest.fn(),
      innerHTML: '',
      className: '',
      style: {},
      scrollTo: jest.fn(),
      scrollTop: 0,
      scrollHeight: 100,
      focus: jest.fn(),
      value: '',
      disabled: false,
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      remove: jest.fn(),
      id: 'mock-element'
    };
    
    // Track created elements for testing
    createdElements = [];
    const createMockElement = () => {
      const element = {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        addEventListener: jest.fn(),
        innerHTML: '',
        className: '',
        style: {},
        scrollTo: jest.fn(),
        scrollTop: 0,
        scrollHeight: 100,
        focus: jest.fn(),
        value: '',
        disabled: false,
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        remove: jest.fn(),
        removeEventListener: jest.fn(),
        id: 'created-element'
      };
      createdElements.push(element);
      return element;
    };

    mockDocument = {
      createElement: jest.fn(() => createMockElement()),
      getElementById: jest.fn(() => mockElement),
      querySelector: jest.fn(() => mockElement),
      body: mockElement
    };

    // Mock just the specific methods we need
    const originalDocument = global.document;
    global.document.getElementById = mockDocument.getElementById;
    global.document.createElement = mockDocument.createElement;
    
    global.window = {
      ...global.window, 
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: jest.fn()
    };

    chatContainer = new ChatContainer();
  });

  describe('Container Initialization', () => {
    test('should create chat container without affecting existing DOM', () => {
      const containerId = chatContainer.createChatContainer();

      expect(containerId).toBeDefined();
      expect(global.document.getElementById).toHaveBeenCalledWith('game-container');
      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.appendChild).toHaveBeenCalled();
    });

    test('should create container with proper CSS classes', () => {
      chatContainer.createChatContainer();

      // Check the created element (first one in createdElements array)
      expect(createdElements.length).toBeGreaterThan(0);
      expect(createdElements[0].className).toContain('chat-container');
    });

    test('should handle missing parent container gracefully', () => {
      mockDocument.getElementById.mockReturnValue(null);
      
      expect(() => chatContainer.createChatContainer('non-existent')).not.toThrow();
      expect(chatContainer.getIsInitialized()).toBe(false);
    });

    test('should provide default parent container when none specified', () => {
      chatContainer.createChatContainer();
      
      expect(mockDocument.getElementById).toHaveBeenCalledWith('game-container');
    });

    test('should allow custom parent container', () => {
      chatContainer.createChatContainer('custom-parent');
      
      expect(mockDocument.getElementById).toHaveBeenCalledWith('custom-parent');
    });
  });

  describe('Chat Header Component', () => {
    beforeEach(() => {
      chatContainer.createChatContainer();
    });

    test('should create chat header with persona name', () => {
      const header = chatContainer.createChatHeader('Irina');

      expect(header).toBeDefined();
      expect(mockElement.innerHTML).toContain('Irina');
      expect(mockElement.className).toContain('chat-header');
    });

    test('should show online status indicator', () => {
      const header = chatContainer.createChatHeader('Irina', true);

      expect(mockElement.innerHTML).toContain('Online');
      expect(mockElement.className).toContain('online');
    });

    test('should show offline status when not connected', () => {
      const header = chatContainer.createChatHeader('Irina', false);

      expect(mockElement.innerHTML).toContain('Offline');
      expect(mockElement.className).toContain('offline');
    });

    test('should allow status updates after creation', () => {
      const headerId = chatContainer.createChatHeader('Irina', false);
      
      chatContainer.updateConnectionStatus(true);
      
      expect(chatContainer.getConnectionStatus()).toBe(true);
    });
  });

  describe('Message Stream Component', () => {
    beforeEach(() => {
      chatContainer.createChatContainer();
    });

    test('should create scrollable message area', () => {
      const streamId = chatContainer.createMessageStream();

      expect(streamId).toBeDefined();
      expect(mockElement.className).toContain('message-stream');
      expect(mockElement.style.overflowY).toBe('auto');
    });

    test('should have proper scrolling behavior', () => {
      const streamId = chatContainer.createMessageStream();
      
      chatContainer.scrollToBottom();
      
      expect(mockElement.scrollTo).toHaveBeenCalled();
    });

    test('should auto-scroll when new messages added', () => {
      const streamId = chatContainer.createMessageStream();
      
      chatContainer.addMessage('user', 'Test message', { autoScroll: true });
      
      expect(mockElement.scrollTo).toHaveBeenCalled();
    });

    test('should respect auto-scroll preference', () => {
      const streamId = chatContainer.createMessageStream();
      
      chatContainer.addMessage('user', 'Test message', { autoScroll: false });
      
      expect(mockElement.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('Message Rendering', () => {
    beforeEach(() => {
      chatContainer.createChatContainer();
      chatContainer.createMessageStream();
    });

    test('should add user message with correct styling', () => {
      const messageId = chatContainer.addMessage('user', 'Hello Irina!');

      expect(messageId).toBeDefined();
      expect(mockElement.appendChild).toHaveBeenCalled();
      expect(mockElement.className).toContain('user-message');
    });

    test('should add assistant message with correct styling', () => {
      const messageId = chatContainer.addMessage('assistant', 'Hello! How can I help?');

      expect(messageId).toBeDefined();
      expect(mockElement.className).toContain('assistant-message');
    });

    test('should include timestamp in messages', () => {
      const messageId = chatContainer.addMessage('user', 'Test message');
      
      expect(mockElement.innerHTML).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    test('should handle empty messages gracefully', () => {
      expect(() => chatContainer.addMessage('user', '')).not.toThrow();
      expect(chatContainer.getMessageCount()).toBe(0); // Should not add empty messages
    });

    test('should handle long messages with word wrapping', () => {
      const longMessage = 'This is a very long message that should wrap properly in the chat interface without breaking the layout or causing overflow issues.';
      
      const messageId = chatContainer.addMessage('user', longMessage);
      
      expect(messageId).toBeDefined();
      expect(mockElement.style.wordWrap).toBe('break-word');
    });

    test('should support message metadata', () => {
      const messageId = chatContainer.addMessage('assistant', 'Good move!', {
        context: { move: 'e4', evaluation: 0.3 }
      });

      expect(messageId).toBeDefined();
      expect(chatContainer.getMessageMetadata(messageId)).toEqual({
        context: { move: 'e4', evaluation: 0.3 }
      });
    });
  });

  describe('Input Component', () => {
    beforeEach(() => {
      chatContainer.createChatContainer();
    });

    test('should create input field with send button', () => {
      const inputId = chatContainer.createMessageInput();

      expect(inputId).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('input');
      expect(mockDocument.createElement).toHaveBeenCalledWith('button');
    });

    test('should handle Enter key to send message', () => {
      const inputId = chatContainer.createMessageInput();
      const sendCallback = jest.fn();
      
      chatContainer.onMessageSend(sendCallback);
      
      // Simulate Enter key press
      const mockEvent = { key: 'Enter', preventDefault: jest.fn() };
      mockElement.addEventListener.mock.calls
        .find(call => call[0] === 'keydown')[1](mockEvent);

      expect(sendCallback).toHaveBeenCalled();
    });

    test('should handle send button click', () => {
      const inputId = chatContainer.createMessageInput();
      const sendCallback = jest.fn();
      
      chatContainer.onMessageSend(sendCallback);
      
      // Simulate button click
      mockElement.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      expect(sendCallback).toHaveBeenCalled();
    });

    test('should clear input after sending', () => {
      const inputId = chatContainer.createMessageInput();
      mockElement.value = 'Test message';
      
      chatContainer.sendCurrentMessage();
      
      expect(mockElement.value).toBe('');
    });

    test('should disable input when not ready', () => {
      const inputId = chatContainer.createMessageInput();
      
      chatContainer.setInputEnabled(false);
      
      expect(mockElement.disabled).toBe(true);
    });

    test('should enable input when ready', () => {
      const inputId = chatContainer.createMessageInput();
      
      chatContainer.setInputEnabled(true);
      
      expect(mockElement.disabled).toBe(false);
    });
  });

  describe('Typing Indicator', () => {
    beforeEach(() => {
      chatContainer.createChatContainer();
      chatContainer.createMessageStream();
    });

    test('should show typing indicator for assistant', () => {
      chatContainer.showTypingIndicator('Irina');

      expect(mockElement.innerHTML).toContain('Irina is typing...');
      expect(mockElement.className).toContain('typing-indicator');
    });

    test('should hide typing indicator', () => {
      chatContainer.showTypingIndicator('Irina');
      chatContainer.hideTypingIndicator();

      expect(chatContainer.isTypingIndicatorVisible()).toBe(false);
    });

    test('should use persona name in typing indicator', () => {
      chatContainer.showTypingIndicator('Custom Mentor');

      expect(mockElement.innerHTML).toContain('Custom Mentor is typing...');
    });

    test('should automatically hide indicator after timeout', (done) => {
      jest.useFakeTimers();
      
      chatContainer.showTypingIndicator('Irina', 1000);
      
      setTimeout(() => {
        expect(chatContainer.isTypingIndicatorVisible()).toBe(false);
        jest.useRealTimers();
        done();
      }, 1100);
      
      jest.runAllTimers();
    });
  });

  describe('Responsive Behavior', () => {
    test('should detect mobile viewport', () => {
      global.window.innerWidth = 600;
      
      const isMobile = chatContainer.isMobileView();
      
      expect(isMobile).toBe(true);
    });

    test('should detect desktop viewport', () => {
      global.window.innerWidth = 1200;
      
      const isMobile = chatContainer.isMobileView();
      
      expect(isMobile).toBe(false);
    });

    test('should adapt layout for mobile', () => {
      global.window.innerWidth = 600;
      chatContainer.createChatContainer();
      
      chatContainer.updateResponsiveLayout();
      
      expect(mockElement.className).toContain('mobile-layout');
    });

    test('should adapt layout for desktop', () => {
      global.window.innerWidth = 1200;
      chatContainer.createChatContainer();
      
      chatContainer.updateResponsiveLayout();
      
      expect(mockElement.className).toContain('desktop-layout');
    });

    test('should handle window resize', () => {
      chatContainer.createChatContainer();
      
      // Simulate window resize
      global.window.innerWidth = 600;
      const resizeHandler = global.window.addEventListener.mock.calls
        .find(call => call[0] === 'resize')[1];
      
      resizeHandler();
      
      expect(mockElement.className).toContain('mobile-layout');
    });
  });

  describe('Mobile Drawer Functionality', () => {
    beforeEach(() => {
      global.window.innerWidth = 600; // Mobile viewport
      chatContainer.createChatContainer();
    });

    test('should create collapsible drawer for mobile', () => {
      const drawerId = chatContainer.createMobileDrawer();

      expect(drawerId).toBeDefined();
      expect(mockElement.className).toContain('chat-drawer');
      expect(mockElement.className).toContain('collapsed');
    });

    test('should expand drawer when tapped', () => {
      const drawerId = chatContainer.createMobileDrawer();
      
      chatContainer.toggleDrawer();
      
      expect(mockElement.className).toContain('expanded');
    });

    test('should collapse drawer when tapped again', () => {
      const drawerId = chatContainer.createMobileDrawer();
      
      chatContainer.toggleDrawer(); // Expand
      chatContainer.toggleDrawer(); // Collapse
      
      expect(mockElement.className).toContain('collapsed');
    });

    test('should show last message in collapsed state', () => {
      const drawerId = chatContainer.createMobileDrawer();
      chatContainer.addMessage('assistant', 'Watch that Knight!');
      
      expect(mockElement.innerHTML).toContain('Watch that Knight!');
    });
  });

  describe('Event Handling', () => {
    test('should support message send callbacks', () => {
      const callback = jest.fn();
      chatContainer.onMessageSend(callback);
      
      chatContainer.createMessageInput();
      mockElement.value = 'Test message';
      chatContainer.sendCurrentMessage();
      
      expect(callback).toHaveBeenCalledWith('Test message');
    });

    test('should support drawer toggle callbacks', () => {
      const callback = jest.fn();
      chatContainer.onDrawerToggle(callback);
      
      chatContainer.createMobileDrawer();
      chatContainer.toggleDrawer();
      
      expect(callback).toHaveBeenCalledWith(true); // isExpanded
    });

    test('should cleanup event listeners on destroy', () => {
      chatContainer.createChatContainer();
      chatContainer.createMessageInput();
      
      const listenerCount = mockElement.addEventListener.mock.calls.length;
      
      chatContainer.destroy();
      
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(listenerCount);
    });
  });

  describe('State Management', () => {
    test('should track initialization state', () => {
      expect(chatContainer.getIsInitialized()).toBe(false);
      
      chatContainer.createChatContainer();
      
      expect(chatContainer.getIsInitialized()).toBe(true);
    });

    test('should track message count', () => {
      chatContainer.createChatContainer();
      chatContainer.createMessageStream();
      
      expect(chatContainer.getMessageCount()).toBe(0);
      
      chatContainer.addMessage('user', 'Hello');
      chatContainer.addMessage('assistant', 'Hi there!');
      
      expect(chatContainer.getMessageCount()).toBe(2);
    });

    test('should clear all messages', () => {
      chatContainer.createChatContainer();
      chatContainer.createMessageStream();
      
      chatContainer.addMessage('user', 'Hello');
      chatContainer.addMessage('assistant', 'Hi there!');
      
      chatContainer.clearMessages();
      
      expect(chatContainer.getMessageCount()).toBe(0);
    });

    test('should get container statistics', () => {
      chatContainer.createChatContainer();
      chatContainer.addMessage('user', 'Hello');
      
      const stats = chatContainer.getStats();
      
      expect(stats).toHaveProperty('initialized', true);
      expect(stats).toHaveProperty('messageCount', 1);
      expect(stats).toHaveProperty('isMobile');
      expect(stats).toHaveProperty('isDrawerExpanded');
    });
  });
});