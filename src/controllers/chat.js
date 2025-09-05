const { Op } = require('sequelize');
const {
  Contact, Conversation, Message,
} = require('../models');
const logger = require('../utils/logger');

/**
 * Get all conversations with contact info and latest message
 */
const getConversations = async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      status = 'all',
      search = '',
    } = req.query;

    const whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }

    let contactWhere = {};
    if (search) {
      contactWhere = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    const conversations = await Conversation.findAll({
      where: whereClause,
      include: [
        {
          model: Contact,
          as: 'contact',
          required: true,
          where: contactWhere,
          attributes: ['id', 'name', 'phone', 'profilePicture', 'isBlocked'],
        },
        {
          model: Message,
          as: 'messages',
          required: false,
          order: [['createdAt', 'DESC']],
          limit: 1,
          attributes: ['id', 'content', 'sender', 'messageType', 'createdAt'],
        },
      ],
      // Removed order, limit, and offset - we'll apply custom sorting and pagination after
    });

    // Get unread message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: conv.id,
            sender: 'user',
            isRead: false,
          },
        });

        return {
          ...conv.toJSON(),
          unreadCount,
        };
      }),
    );

    // Sort conversations with Assistant conversation first
    const ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';

    logger.debug('Before sorting conversations', {
      total: conversationsWithCounts.length,
      assistantFound: conversationsWithCounts.some((c) => c.id === ASSISTANT_CONVERSATION_ID),
      firstThree: conversationsWithCounts.slice(0, 3).map((c) => ({ id: c.id, name: c.contact?.name })),
    });

    conversationsWithCounts.sort((a, b) => {
      // Assistant conversation always comes first
      if (a.id === ASSISTANT_CONVERSATION_ID) return -1;
      if (b.id === ASSISTANT_CONVERSATION_ID) return 1;

      // For other conversations, sort by lastMessageAt descending
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    logger.debug('After sorting conversations', {
      firstThree: conversationsWithCounts.slice(0, 3).map((c) => ({ id: c.id, name: c.contact?.name })),
    });

    // Apply pagination after sorting
    const totalCount = conversationsWithCounts.length;
    const paginatedConversations = conversationsWithCounts.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit),
    );

    res.json({
      conversations: paginatedConversations,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });
  } catch (error) {
    logger.error('Failed to get conversations', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error.message,
    });
  }
};

/**
 * Get messages for a specific conversation
 */
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      limit = 50,
      offset = 0,
      before = null, // Message ID to load messages before
    } = req.query;

    // Check if conversation exists
    const conversation = await Conversation.findByPk(id, {
      include: [{
        model: Contact,
        as: 'contact',
        attributes: ['id', 'name', 'phone', 'profilePicture'],
      }],
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const whereClause = { conversationId: id };

    // If 'before' parameter provided, get messages before that message
    if (before) {
      const beforeMessage = await Message.findByPk(before);
      if (beforeMessage) {
        whereClause.createdAt = { [Op.lt]: beforeMessage.createdAt };
      }
    }

    const messages = await Message.findAll({
      where: whereClause,
      include: [{
        model: Contact,
        as: 'contact',
        attributes: ['id', 'name', 'phone', 'profilePicture'],
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Reverse to show oldest first
    const reversedMessages = messages.reverse();

    const totalCount = await Message.count({
      where: { conversationId: id },
    });

    res.json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        isAssistantEnabled: conversation.isAssistantEnabled,
        contact: conversation.contact,
      },
      messages: reversedMessages,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });
  } catch (error) {
    logger.error('Failed to get conversation messages', {
      conversationId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to get messages',
      message: error.message,
    });
  }
};

/**
 * Send a message in a conversation
 */
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text' } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const conversation = await Conversation.findByPk(id, {
      include: [{ model: Contact, as: 'contact' }],
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { contact } = conversation;

    // Check if this is the Assistant conversation (special handling)
    const ASSISTANT_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001';

    let result = null;
    let messageId = `manual_${Date.now()}`;

    if (id === ASSISTANT_CONVERSATION_ID || contact.phone === 'assistant@system') {
      // Assistant conversation - don't send via WhatsApp, handle internally
      result = {
        success: true,
        type: 'internal',
        message: 'Message sent to assistant',
      };
    } else {
      // Regular conversation - send via WhatsApp service
      const whatsappService = require('../services/whatsapp/whatsapp');
      const whatsapp = new whatsappService();

      try {
        result = await whatsapp.sendMessage(contact.phone, content);
        messageId = result.key?.id || messageId;
      } catch (whatsappError) {
        logger.error('Failed to send WhatsApp message', {
          error: whatsappError.message,
          phone: contact.phone,
        });

        return res.status(500).json({
          error: 'Failed to send message',
          message: whatsappError.message,
        });
      }
    }

    try {
      // Create message record - user's message should have sender='user'
      const message = await Message.create({
        messageId,
        conversationId: id,
        contactId: contact.id,
        content,
        messageType,
        sender: 'user', // This is the user's message, not assistant's
        isRead: true,
        metadata: {
          sentVia: 'chat_ui',
          whatsappResponse: result,
        },
      });

      // Update conversation
      await Conversation.update(
        {
          messageCount: require('sequelize').literal('message_count + 1'),
          lastMessageAt: new Date(),
        },
        { where: { id: conversation.id } },
      );

      const messageWithContact = await Message.findByPk(message.id, {
        include: [{
          model: Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'profilePicture'],
        }],
      });

      logger.info('Message sent via chat UI', {
        messageId: message.id,
        conversationId: id,
        phone: contact.phone,
        contentLength: content.length,
      });

      // Broadcast the sent message to real-time subscribers
      const realtimeService = require('../services/utils/realtime');
      realtimeService.broadcastNewMessage(id, messageWithContact);

      // If this is the Assistant conversation, process the message for Assistant response
      if (id === ASSISTANT_CONVERSATION_ID || contact.phone === 'assistant@system') {
        // Import and use the Assistant message handler
        const assistantMessageHandler = require('../services/assistantMessageHandler');

        // Process the message asynchronously (don't wait for response)
        setTimeout(() => {
          assistantMessageHandler.processAssistantMessage(
            content,
            id,
            (conversationId, isTyping, sender) => realtimeService.broadcastTypingIndicator(conversationId, isTyping, sender),
            (conversationId, message) => realtimeService.broadcastNewMessage(conversationId, message),
          ).catch((error) => {
            logger.error('Failed to process Assistant message', {
              error: error.message,
              conversationId: id,
            });
          });
        }, 100); // Small delay to ensure user message is broadcast first
      }

      res.json({
        success: true,
        message: messageWithContact,
      });
    } catch (messageError) {
      logger.error('Failed to create message record', {
        error: messageError.message,
        conversationId: id,
        phone: contact.phone,
      });

      res.status(500).json({
        error: 'Failed to create message',
        message: messageError.message,
      });
    }
  } catch (error) {
    logger.error('Failed to process send message request', {
      conversationId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message,
    });
  }
};

/**
 * Mark conversation as read
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findByPk(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Mark all unread messages as read
    await Message.update(
      { isRead: true },
      {
        where: {
          conversationId: id,
          sender: 'user',
          isRead: false,
        },
      },
    );

    logger.debug('Conversation marked as read', { conversationId: id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to mark conversation as read', {
      conversationId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to mark as read',
      message: error.message,
    });
  }
};

/**
 * Update conversation settings
 */
const updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAssistantEnabled, status } = req.body;

    const conversation = await Conversation.findByPk(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updates = {};
    if (typeof isAssistantEnabled === 'boolean') {
      updates.isAssistantEnabled = isAssistantEnabled;
    }
    if (status && ['active', 'archived', 'resolved'].includes(status)) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    await conversation.update(updates);

    logger.info('Conversation updated', {
      conversationId: id,
      updates: Object.keys(updates),
    });

    res.json({
      success: true,
      conversation: await Conversation.findByPk(id, {
        include: [{ model: Contact, as: 'contact' }],
      }),
    });
  } catch (error) {
    logger.error('Failed to update conversation', {
      conversationId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to update conversation',
      message: error.message,
    });
  }
};

/**
 * Search messages across conversations
 */
const searchMessages = async (req, res) => {
  try {
    const { q: query, limit = 50, offset = 0 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const messages = await Message.findAll({
      where: {
        content: {
          [Op.iLike]: `%${query}%`,
        },
      },
      include: [
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'name', 'phone', 'profilePicture'],
        },
        {
          model: Conversation,
          as: 'conversation',
          attributes: ['id', 'status'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const totalCount = await Message.count({
      where: {
        content: {
          [Op.iLike]: `%${query}%`,
        },
      },
    });

    res.json({
      messages,
      query,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });
  } catch (error) {
    logger.error('Failed to search messages', {
      query: req.query.q,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to search messages',
      message: error.message,
    });
  }
};

/**
 * Get conversation statistics
 */
const getConversationStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      // Total conversations
      Conversation.count(),

      // Active conversations
      Conversation.count({
        where: { status: 'active' },
      }),

      // Conversations with unread messages
      Conversation.count({
        include: [{
          model: Message,
          as: 'messages',
          where: {
            sender: 'user',
            isRead: false,
          },
          required: true,
        }],
      }),

      // Total messages today
      Message.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Assistant enabled conversations
      Conversation.count({
        where: { isAssistantEnabled: true },
      }),
    ]);

    res.json({
      totalConversations: stats[0],
      activeConversations: stats[1],
      unreadConversations: stats[2],
      messagesToday: stats[3],
      assistantEnabledConversations: stats[4],
    });
  } catch (error) {
    logger.error('Failed to get conversation stats', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message,
    });
  }
};

module.exports = {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  updateConversation,
  searchMessages,
  getConversationStats,
};
