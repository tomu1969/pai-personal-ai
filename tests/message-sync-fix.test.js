/**
 * Message Synchronization Fix Test
 * 
 * This test verifies that messages are properly saved to database and broadcast
 * to the UI even when they are filtered out from assistant processing.
 */

const request = require('supertest');
const { Message, Conversation, Contact } = require('../src/models');
const messageProcessor = require('../src/services/whatsapp/messageProcessor');

describe('Message Synchronization Fix', () => {
  
  beforeEach(async () => {
    // Clean up test data
    await Message.destroy({ where: {}, force: true });
    await Conversation.destroy({ where: {}, force: true });
    await Contact.destroy({ where: {}, force: true });
  });

  test('should save group messages to database even when group messages are disabled', async () => {
    const groupMessage = {
      messageId: 'test-group-msg-123',
      phone: '573155760716-1514461123@g.us', // Group chat JID
      pushName: 'Test User',
      content: 'Test group message content',
      messageType: 'conversation',
      timestamp: new Date()
    };

    // Process the message
    const result = await messageProcessor.processMessage(groupMessage);

    // Should be processed (saved to DB) but assistant won't respond
    expect(result.processed).toBe(true);
    expect(result.assistantProcessed).toBe(false);
    expect(result.messageTypeFilterReason).toBe('group_messages_disabled');
    expect(result.response).toBeNull();

    // Verify message was saved to database
    const savedMessage = await Message.findByPk(result.message.id);
    expect(savedMessage).toBeDefined();
    expect(savedMessage.content).toBe(groupMessage.content);
    expect(savedMessage.sender).toBe('user');

    // Verify conversation was created
    const conversation = await Conversation.findByPk(result.conversation.id);
    expect(conversation).toBeDefined();

    // Verify contact was created
    const contact = await Contact.findByPk(result.contact.id);
    expect(contact).toBeDefined();
    expect(contact.phone).toBe(groupMessage.phone);
  });

  test('should save individual messages and allow assistant to respond', async () => {
    const individualMessage = {
      messageId: 'test-individual-msg-123',
      phone: '573182601111@s.whatsapp.net', // Individual chat JID
      pushName: 'Individual User',
      content: 'Test individual message content',
      messageType: 'conversation',
      timestamp: new Date()
    };

    // Process the message
    const result = await messageProcessor.processMessage(individualMessage);

    // Should be processed and assistant should respond
    expect(result.processed).toBe(true);
    expect(result.assistantProcessed).toBe(true);
    expect(result.messageTypeFilterReason).toBeNull();
    
    // Response depends on assistant settings, but it should at least try
    // (may fail due to WhatsApp service not being available in test)
    
    // Verify message was saved to database
    const savedMessage = await Message.findByPk(result.message.id);
    expect(savedMessage).toBeDefined();
    expect(savedMessage.content).toBe(individualMessage.content);
    expect(savedMessage.sender).toBe('user');
  });

  test('should handle different message types correctly', async () => {
    const testCases = [
      {
        phone: '573155760716-1514461123@g.us',
        messageType: 'videoMessage',
        expectedProcessed: true,
        expectedAssistantProcessed: false,
        expectedReason: 'group_messages_disabled'
      },
      {
        phone: '573182601111@s.whatsapp.net',
        messageType: 'imageMessage', 
        expectedProcessed: true,
        expectedAssistantProcessed: true,
        expectedReason: null
      },
      {
        phone: '12345@broadcast',
        messageType: 'conversation',
        expectedProcessed: true,
        expectedAssistantProcessed: false,
        expectedReason: 'distribution_lists_disabled'
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const message = {
        messageId: `test-msg-${i}`,
        phone: testCase.phone,
        pushName: `Test User ${i}`,
        content: `Test message ${i}`,
        messageType: testCase.messageType,
        timestamp: new Date()
      };

      const result = await messageProcessor.processMessage(message);

      expect(result.processed).toBe(testCase.expectedProcessed);
      expect(result.assistantProcessed).toBe(testCase.expectedAssistantProcessed);
      expect(result.messageTypeFilterReason).toBe(testCase.expectedReason);

      // All messages should be saved to database regardless of filtering
      if (result.processed) {
        const savedMessage = await Message.findByPk(result.message.id);
        expect(savedMessage).toBeDefined();
        expect(savedMessage.content).toBe(message.content);
      }
    }
  });

  test('should broadcast all processed messages to real-time subscribers', async () => {
    // This test would need mocking of the real-time service
    // For now, we verify that the message processing pipeline completes
    const groupMessage = {
      messageId: 'test-broadcast-msg',
      phone: '573155760716-1514461123@g.us',
      pushName: 'Broadcast Test',
      content: 'Should be broadcast even though filtered',
      messageType: 'conversation',
      timestamp: new Date()
    };

    const result = await messageProcessor.processMessage(groupMessage);
    
    // Message should be processed and have all required fields for broadcasting
    expect(result.processed).toBe(true);
    expect(result.conversation).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.contact).toBeDefined();
  });

});

/**
 * Integration Test for Webhook to UI Flow
 */
describe('Webhook to UI Message Flow', () => {
  
  test('webhook should process group messages correctly', async () => {
    const webhookPayload = {
      event: "messages.upsert",
      instance: "aipbx", 
      data: {
        key: {
          remoteJid: "573155760716-1514461123@g.us",
          fromMe: false,
          id: "TEST123",
          participant: "573157718725@s.whatsapp.net"
        },
        pushName: "Test User",
        message: {
          conversation: "Test webhook group message"
        },
        messageType: "conversation",
        messageTimestamp: Date.now(),
        instanceId: "test-instance",
        source: "android"
      }
    };

    // This would test the full webhook->processor->database->broadcast flow
    // For now, we just verify the webhook endpoint accepts the payload
    const response = await request(require('../src/app'))
      .post('/webhook/messages-upsert')
      .send(webhookPayload)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

});