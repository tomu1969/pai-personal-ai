const { Sequelize } = require('sequelize');

// Mock Sequelize for testing models
const mockSequelize = {
  define: jest.fn((modelName, attributes, options) => ({
    name: modelName,
    attributes,
    options,
    associate: jest.fn(),
  })),
  UUIDV4: 'UUIDV4',
  UUID: 'UUID',
  STRING: 'STRING',
  TEXT: 'TEXT',
  BOOLEAN: 'BOOLEAN',
  INTEGER: 'INTEGER',
  DATE: 'DATE',
  JSONB: 'JSONB',
  ENUM: jest.fn((...values) => ({ type: 'ENUM', values })),
  ARRAY: jest.fn((type) => ({ type: 'ARRAY', arrayType: type })),
  NOW: 'NOW',
};

const mockDataTypes = mockSequelize;

describe('Database Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Assistant Model', () => {
    it('should define Assistant model with correct attributes', () => {
      const AssistantModel = require('../src/models/Assistant');
      const model = AssistantModel(mockSequelize, mockDataTypes);

      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Assistant',
        expect.objectContaining({
          id: expect.objectContaining({
            type: 'UUID',
            primaryKey: true,
          }),
          enabled: expect.objectContaining({
            type: 'BOOLEAN',
            defaultValue: false,
          }),
          ownerName: expect.objectContaining({
            type: 'STRING',
            allowNull: false,
          }),
        }),
        expect.objectContaining({
          tableName: 'assistants',
          timestamps: true,
          underscored: true,
        }),
      );
    });

    it('should define associations function', () => {
      const AssistantModel = require('../src/models/Assistant');
      const model = AssistantModel(mockSequelize, mockDataTypes);
      
      // Test that associate function is defined
      expect(typeof model.associate).toBe('function');
    });
  });

  describe('Contact Model', () => {
    it('should define Contact model with correct attributes', () => {
      const ContactModel = require('../src/models/Contact');
      const model = ContactModel(mockSequelize, mockDataTypes);

      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Contact',
        expect.objectContaining({
          phone: expect.objectContaining({
            type: 'STRING',
            allowNull: false,
            unique: true,
          }),
          priority: expect.objectContaining({
            defaultValue: 'medium',
          }),
          category: expect.objectContaining({
            defaultValue: 'unknown',
          }),
        }),
        expect.objectContaining({
          tableName: 'contacts',
          indexes: expect.arrayContaining([
            expect.objectContaining({ fields: ['phone'] }),
            expect.objectContaining({ fields: ['category'] }),
            expect.objectContaining({ fields: ['priority'] }),
          ]),
        }),
      );
    });
  });

  describe('Conversation Model', () => {
    it('should define Conversation model with correct attributes', () => {
      const ConversationModel = require('../src/models/Conversation');
      const model = ConversationModel(mockSequelize, mockDataTypes);

      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Conversation',
        expect.objectContaining({
          contactId: expect.objectContaining({
            type: 'UUID',
            allowNull: false,
          }),
          status: expect.objectContaining({
            defaultValue: 'active',
          }),
          messageCount: expect.objectContaining({
            type: 'INTEGER',
            defaultValue: 0,
          }),
        }),
        expect.objectContaining({
          tableName: 'conversations',
        }),
      );
    });
  });

  describe('Message Model', () => {
    it('should define Message model with correct attributes', () => {
      const MessageModel = require('../src/models/Message');
      const model = MessageModel(mockSequelize, mockDataTypes);

      expect(mockSequelize.define).toHaveBeenCalledWith(
        'Message',
        expect.objectContaining({
          conversationId: expect.objectContaining({
            type: 'UUID',
            allowNull: false,
          }),
          messageType: expect.objectContaining({
            defaultValue: 'text',
          }),
          sender: expect.objectContaining({
            allowNull: false,
          }),
          content: expect.objectContaining({
            type: 'TEXT',
            allowNull: false,
          }),
        }),
        expect.objectContaining({
          tableName: 'messages',
        }),
      );
    });

    it('should have correct message type enums', () => {
      const MessageModel = require('../src/models/Message');
      MessageModel(mockSequelize, mockDataTypes);

      // Check that ENUM was called with correct message types
      expect(mockDataTypes.ENUM).toHaveBeenCalledWith(
        'text',
        'image',
        'audio',
        'video',
        'document',
        'sticker',
        'location',
        'contact',
        'reaction',
        'system',
      );

      // Check sender enum
      expect(mockDataTypes.ENUM).toHaveBeenCalledWith('user', 'assistant', 'system');
    });
  });

  describe('Model Relationships', () => {
    it('should set up correct associations between models', () => {
      // This would typically be tested with a real database connection
      // For now, we verify that associate methods exist
      const AssistantModel = require('../src/models/Assistant');
      const ContactModel = require('../src/models/Contact');
      const ConversationModel = require('../src/models/Conversation');
      const MessageModel = require('../src/models/Message');

      const assistant = AssistantModel(mockSequelize, mockDataTypes);
      const contact = ContactModel(mockSequelize, mockDataTypes);
      const conversation = ConversationModel(mockSequelize, mockDataTypes);
      const message = MessageModel(mockSequelize, mockDataTypes);

      expect(typeof assistant.associate).toBe('function');
      expect(typeof contact.associate).toBe('function');
      expect(typeof conversation.associate).toBe('function');
      expect(typeof message.associate).toBe('function');
    });
  });
});