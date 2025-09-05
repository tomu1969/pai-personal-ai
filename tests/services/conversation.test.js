const {
  Contact, Conversation, Message, Assistant,
} = require('../../src/models');
const conversationService = require('../../src/services/utils/conversation');

// Mock the models
jest.mock('../../src/models', () => ({
  Contact: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  Conversation: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  Assistant: {
    findOne: jest.fn(),
  },
}));

describe('ConversationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreateContact', () => {
    const mockContact = {
      id: 'contact-1',
      phone: '+1234567890',
      name: 'John Doe',
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      update: jest.fn(),
    };

    it('should return existing contact', async () => {
      Contact.findOrCreate.mockResolvedValue([mockContact, false]);

      const result = await conversationService.findOrCreateContact('+1234567890', {
        name: 'John Doe',
        profilePicture: 'pic.jpg',
      });

      expect(Contact.findOrCreate).toHaveBeenCalledWith({
        where: { phone: '+1234567890' },
        defaults: {
          phone: '+1234567890',
          name: 'John Doe',
          profilePicture: 'pic.jpg',
          isBlocked: false,
          lastActivity: expect.any(Date),
          metadata: {},
        },
      });
      expect(result).toBe(mockContact);
    });

    it('should create new contact if not exists', async () => {
      Contact.findOrCreate.mockResolvedValue([mockContact, true]);

      const result = await conversationService.findOrCreateContact('+1234567890', {
        name: 'John Doe',
        profilePicture: 'pic.jpg',
      });

      expect(Contact.findOrCreate).toHaveBeenCalledWith({
        where: { phone: '+1234567890' },
        defaults: {
          phone: '+1234567890',
          name: 'John Doe',
          profilePicture: 'pic.jpg',
          isBlocked: false,
          lastActivity: expect.any(Date),
          metadata: {},
        },
      });
      expect(result).toBe(mockContact);
    });

    it('should update existing contact info if provided', async () => {
      Contact.findOrCreate.mockResolvedValue([mockContact, false]);
      mockContact.update.mockResolvedValue(mockContact);

      await conversationService.findOrCreateContact('+1234567890', {
        name: 'John Updated',
        profilePicture: 'new-pic.jpg',
      });

      expect(mockContact.update).toHaveBeenCalledWith({
        name: 'John Updated',
        profilePicture: 'new-pic.jpg',
        lastActivity: expect.any(Date),
      });
    });
  });

  describe('findOrCreateConversation', () => {
    const mockContact = { id: 'contact-1' };
    const mockAnalysis = {
      category: 'business',
      priority: 'high',
      sentiment: 'neutral',
    };
    const mockConversation = {
      id: 'conv-1',
      contactId: 'contact-1',
      status: 'active',
      category: 'business',
      priority: 'high',
      update: jest.fn(),
    };

    it('should return existing active conversation', async () => {
      Conversation.findOne.mockResolvedValue(mockConversation);

      const result = await conversationService.findOrCreateConversation('contact-1', mockAnalysis);

      expect(Conversation.findOne).toHaveBeenCalledWith({
        where: {
          contactId: 'contact-1',
          status: ['active', 'waiting'],
        },
        order: [['lastMessageAt', 'DESC']],
      });
      expect(result).toBe(mockConversation);
    });

    it('should create new conversation if none exists', async () => {
      Conversation.findOne.mockResolvedValue(null);
      Conversation.create.mockResolvedValue(mockConversation);

      const result = await conversationService.findOrCreateConversation('contact-1', mockAnalysis);

      expect(Conversation.create).toHaveBeenCalledWith({
        contactId: 'contact-1',
        status: 'active',
        category: 'business',
        priority: 'high',
        sentiment: 'neutral',
        isAssistantEnabled: true,
        messageCount: 0,
        summary: null,
        metadata: {},
      });
      expect(result).toBe(mockConversation);
    });

    it('should update existing conversation category and priority', async () => {
      Conversation.findOne.mockResolvedValue(mockConversation);
      mockConversation.update.mockResolvedValue(mockConversation);

      await conversationService.findOrCreateConversation('contact-1', {
        category: 'support',
        priority: 'urgent',
      });

      expect(mockConversation.update).toHaveBeenCalledWith({
        category: 'support',
        priority: 'urgent',
        sentiment: undefined,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('storeMessage', () => {
    const mockMessage = {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      content: 'Hello world',
      sender: 'user',
      messageType: 'text',
    };

    const mockStoredMessage = {
      id: 'stored-msg-1',
      ...mockMessage,
      createdAt: new Date(),
    };

    it('should store message successfully', async () => {
      Message.create.mockResolvedValue(mockStoredMessage);

      const result = await conversationService.storeMessage(mockMessage, {
        category: 'business',
        priority: 'high',
      });

      expect(Message.create).toHaveBeenCalledWith({
        messageId: 'msg-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        content: 'Hello world',
        sender: 'user',
        messageType: 'text',
        analysis: {
          category: 'business',
          priority: 'high',
        },
        metadata: {},
      });
      expect(result).toBe(mockStoredMessage);
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage failed');
      Message.create.mockRejectedValue(error);

      await expect(conversationService.storeMessage(mockMessage)).rejects.toThrow('Storage failed');
    });
  });

  describe('updateConversationStats', () => {
    const mockConversation = {
      id: 'conv-1',
      messageCount: 5,
      update: jest.fn(),
    };

    it('should increment message count and update last activity', async () => {
      Conversation.findByPk.mockResolvedValue(mockConversation);
      mockConversation.update.mockResolvedValue(mockConversation);

      await conversationService.updateConversationStats('conv-1');

      expect(mockConversation.update).toHaveBeenCalledWith({
        messageCount: 6,
        lastMessageAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle missing conversation gracefully', async () => {
      Conversation.findByPk.mockResolvedValue(null);

      // Should not throw error
      await expect(conversationService.updateConversationStats('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('getActiveConversations', () => {
    const mockConversations = [
      {
        id: 'conv-1',
        status: 'active',
        priority: 'high',
        Contact: { name: 'John Doe', phone: '+1234567890' },
      },
      {
        id: 'conv-2',
        status: 'waiting',
        priority: 'medium',
        Contact: { name: 'Jane Smith', phone: '+0987654321' },
      },
    ];

    it('should return active conversations with filters', async () => {
      Conversation.findAll.mockResolvedValue(mockConversations);
      Conversation.count.mockResolvedValue(2);

      const result = await conversationService.getActiveConversations(
        { status: 'active', priority: 'high' },
        { limit: 10, offset: 0 }
      );

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: {
          status: 'active',
          priority: 'high',
        },
        include: [
          {
            model: Contact,
            attributes: ['id', 'name', 'phone', 'profilePicture', 'isBlocked'],
          },
        ],
        order: [['priority', 'DESC'], ['updatedAt', 'DESC']],
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        conversations: mockConversations,
        total: 2,
        hasMore: false,
      });
    });

    it('should handle no filters', async () => {
      Conversation.findAll.mockResolvedValue([]);
      Conversation.count.mockResolvedValue(0);

      const result = await conversationService.getActiveConversations({}, {});

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Array),
        order: expect.any(Array),
        limit: 50,
        offset: 0,
      });

      expect(result).toEqual({
        conversations: [],
        total: 0,
        hasMore: false,
      });
    });
  });

  describe('getConversationHistory', () => {
    const mockMessages = [
      { id: 'msg-1', content: 'Hello', sender: 'user' },
      { id: 'msg-2', content: 'Hi there!', sender: 'assistant' },
    ];

    const mockConversation = {
      id: 'conv-1',
      status: 'active',
      Contact: { name: 'John Doe', phone: '+1234567890' },
    };

    it('should return conversation with message history', async () => {
      Conversation.findByPk.mockResolvedValue(mockConversation);
      Message.findAll.mockResolvedValue(mockMessages);
      Message.count.mockResolvedValue(2);

      const result = await conversationService.getConversationHistory('conv-1', {
        limit: 50,
        offset: 0,
      });

      expect(Conversation.findByPk).toHaveBeenCalledWith('conv-1', {
        include: [
          {
            model: Contact,
            attributes: ['id', 'name', 'phone', 'profilePicture', 'isBlocked'],
          },
        ],
      });

      expect(Message.findAll).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        order: [['createdAt', 'ASC']],
        limit: 50,
        offset: 0,
      });

      expect(result).toEqual({
        conversation: mockConversation,
        messages: mockMessages,
        total: 2,
        hasMore: false,
      });
    });

    it('should return null for non-existent conversation', async () => {
      Conversation.findByPk.mockResolvedValue(null);

      const result = await conversationService.getConversationHistory('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markConversationAsResolved', () => {
    const mockConversation = {
      id: 'conv-1',
      status: 'active',
      update: jest.fn(),
    };

    it('should mark conversation as resolved', async () => {
      Conversation.findByPk.mockResolvedValue(mockConversation);
      mockConversation.update.mockResolvedValue({ ...mockConversation, status: 'resolved' });

      const result = await conversationService.markConversationAsResolved('conv-1', 'Issue resolved by user');

      expect(mockConversation.update).toHaveBeenCalledWith({
        status: 'resolved',
        resolvedAt: expect.any(Date),
        resolutionNote: 'Issue resolved by user',
      });

      expect(result.status).toBe('resolved');
    });

    it('should handle non-existent conversation', async () => {
      Conversation.findByPk.mockResolvedValue(null);

      const result = await conversationService.markConversationAsResolved('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('blockContact', () => {
    const mockContact = {
      id: 'contact-1',
      isBlocked: false,
      update: jest.fn(),
    };

    it('should block contact and close conversations', async () => {
      Contact.findByPk.mockResolvedValue(mockContact);
      mockContact.update.mockResolvedValue({ ...mockContact, isBlocked: true });
      Conversation.update.mockResolvedValue([2]); // 2 conversations updated

      const result = await conversationService.blockContact('contact-1', 'Spam');

      expect(mockContact.update).toHaveBeenCalledWith({
        isBlocked: true,
        blockedReason: 'Spam',
        blockedAt: expect.any(Date),
      });

      expect(Conversation.update).toHaveBeenCalledWith(
        {
          status: 'closed',
          resolvedAt: expect.any(Date),
          resolutionNote: 'Contact blocked: Spam',
        },
        {
          where: {
            contactId: 'contact-1',
            status: ['active', 'waiting'],
          },
        }
      );

      expect(result.isBlocked).toBe(true);
    });
  });

  describe('unblockContact', () => {
    const mockContact = {
      id: 'contact-1',
      isBlocked: true,
      update: jest.fn(),
    };

    it('should unblock contact', async () => {
      Contact.findByPk.mockResolvedValue(mockContact);
      mockContact.update.mockResolvedValue({ ...mockContact, isBlocked: false });

      const result = await conversationService.unblockContact('contact-1');

      expect(mockContact.update).toHaveBeenCalledWith({
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
      });

      expect(result.isBlocked).toBe(false);
    });
  });

  describe('updateConversationSummary', () => {
    const mockConversation = {
      id: 'conv-1',
      summary: 'Old summary',
      update: jest.fn(),
    };

    it('should update conversation summary', async () => {
      Conversation.findByPk.mkResolvedValue(mockConversation);
      mockConversation.update.mockResolvedValue({
        ...mockConversation,
        summary: 'New summary',
      });

      const result = await conversationService.updateConversationSummary('conv-1', 'New summary');

      expect(mockConversation.update).toHaveBeenCalledWith({
        summary: 'New summary',
        summarizedAt: expect.any(Date),
      });

      expect(result.summary).toBe('New summary');
    });
  });

  describe('getContactConversations', () => {
    const mockConversations = [
      { id: 'conv-1', status: 'resolved' },
      { id: 'conv-2', status: 'active' },
    ];

    it('should return conversations for contact', async () => {
      Conversation.findAll.mockResolvedValue(mockConversations);

      const result = await conversationService.getContactConversations('contact-1', {
        limit: 10,
        offset: 0,
      });

      expect(Conversation.findAll).toHaveBeenCalledWith({
        where: { contactId: 'contact-1' },
        order: [['updatedAt', 'DESC']],
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockConversations);
    });
  });

  describe('searchContacts', () => {
    const mockContacts = [
      { id: 'contact-1', name: 'John Doe', phone: '+1234567890' },
      { id: 'contact-2', name: 'Jane Doe', phone: '+1234567891' },
    ];

    it('should search contacts by name or phone', async () => {
      Contact.findAll.mockResolvedValue(mockContacts);

      const result = await conversationService.searchContacts('Doe', {
        limit: 10,
        offset: 0,
      });

      expect(Contact.findAll).toHaveBeenCalledWith({
        where: {
          [require('sequelize').Op.or]: [
            { name: { [require('sequelize').Op.iLike]: '%Doe%' } },
            { phone: { [require('sequelize').Op.like]: '%Doe%' } },
          ],
        },
        order: [['name', 'ASC']],
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockContacts);
    });
  });

  describe('getContactById', () => {
    const mockContact = {
      id: 'contact-1',
      name: 'John Doe',
      phone: '+1234567890',
    };

    it('should return contact by ID', async () => {
      Contact.findByPk.mockResolvedValue(mockContact);

      const result = await conversationService.getContactById('contact-1');

      expect(Contact.findByPk).toHaveBeenCalledWith('contact-1');
      expect(result).toBe(mockContact);
    });

    it('should return null for non-existent contact', async () => {
      Contact.findByPk.mockResolvedValue(null);

      const result = await conversationService.getContactById('nonexistent');

      expect(result).toBeNull();
    });
  });
});