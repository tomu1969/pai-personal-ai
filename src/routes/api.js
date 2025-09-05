const express = require('express');
const { validate, validateQuery } = require('../middleware/validation');
const {
  assistantToggleSchema,
  sendMessageSchema,
  conversationQuerySchema,
  summaryQuerySchema,
} = require('../utils/schemas');
const logger = require('../utils/logger');
const groupService = require('../services/utils/groupService');
const paiAssistantController = require('../controllers/paiAssistantController');

const router = express.Router();

// Assistant management endpoints
router.get('/assistant/status', async (req, res) => {
  try {
    const assistantService = require('../services/assistant');
    const status = await assistantService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get assistant status',
      message: error.message,
    });
  }
});

router.post('/assistant/toggle', validate(assistantToggleSchema), async (req, res) => {
  try {
    const assistantService = require('../services/assistant');
    const { enabled } = req.body;
    const result = await assistantService.toggle(enabled);
    res.json({
      ...result,
      message: `Assistant ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to toggle assistant',
      message: error.message,
    });
  }
});

// Message management endpoints
router.post('/messages/send', validate(sendMessageSchema), async (req, res) => {
  // TODO: Implement send message endpoint
  const { phone } = req.body;
  res.json({
    success: true,
    messageId: 'temp-message-id',
    phone,
    message: 'Message queued for sending',
  });
});

// Conversation management endpoints
router.get('/conversations', validateQuery(conversationQuerySchema), async (req, res) => {
  try {
    const conversationService = require('../services/conversation');
    const {
      status, priority, category, limit, offset, contactId,
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (category) filters.category = category;
    if (contactId) filters.contactId = contactId;

    const result = await conversationService.getActiveConversations(
      filters,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) },
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error.message,
    });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const conversationService = require('../services/conversation');
    const { id } = req.params;

    const result = await conversationService.getConversationHistory(id, {
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    });

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get conversation',
      message: error.message,
    });
  }
});

// Summary and reporting endpoints
router.get('/summary', validateQuery(summaryQuerySchema), async (req, res) => {
  // TODO: Implement summary endpoint
  const {
    period, startDate, endDate, status,
  } = req.query;
  res.json({
    summary: {
      totalConversations: 0,
      activeConversations: 0,
      messagesProcessed: 0,
      responseTime: 0,
      period,
      filters: { status, startDate, endDate },
    },
    breakdown: {
      byCategory: {},
      byPriority: {},
      byHour: {},
    },
  });
});

// Contact management endpoints
router.get('/contacts', async (req, res) => {
  // TODO: Implement contacts listing endpoint
  res.json({
    contacts: [],
    total: 0,
  });
});

router.get('/contacts/:id', async (req, res) => {
  // TODO: Implement contact details endpoint
  res.json({
    contact: null,
    conversations: [],
    statistics: {
      totalMessages: 0,
      totalConversations: 0,
      lastActivity: null,
    },
  });
});

// System status endpoints
router.get('/status', async (req, res) => {
  res.json({
    assistant: {
      enabled: false,
      lastActivity: null,
      messagesProcessed: 0,
    },
    evolution: {
      connected: false,
      instanceId: null,
    },
    database: {
      connected: false,
    },
    uptime: process.uptime(),
    // eslint-disable-next-line global-require
    version: require('../../package.json').version,
  });
});

// WhatsApp connection status endpoint
router.get('/whatsapp/status', async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp/whatsapp');
    const whatsapp = new whatsappService();

    const instanceStatus = await whatsapp.getInstanceStatus();

    res.json({
      connected: instanceStatus.instance?.state === 'open' || false,
      state: instanceStatus.instance?.state || 'closed',
      instanceId: instanceStatus.instance?.instanceName || null,
      lastConnection: instanceStatus.instance?.lastConnection || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get WhatsApp connection status', {
      error: error.message,
      stack: error.stack,
    });

    res.json({
      connected: false,
      state: 'error',
      instanceId: null,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get WhatsApp QR Code for connection
router.get('/whatsapp/qrcode', async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp/whatsapp');
    const whatsapp = new whatsappService();

    // First check if already connected
    const instanceStatus = await whatsapp.getInstanceStatus();
    if (instanceStatus.instance?.state === 'open') {
      return res.json({
        connected: true,
        message: 'WhatsApp is already connected',
        timestamp: new Date().toISOString(),
      });
    }

    // Get QR code data
    const qrData = await whatsapp.getQRCode();

    res.json({
      connected: false,
      qrCode: qrData.base64,
      qrCodeUrl: qrData.code,
      instanceId: qrData.instanceId || instanceStatus.instance?.instanceName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get WhatsApp QR code', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      connected: false,
      error: 'Failed to generate QR code',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Sync chats from WhatsApp
router.post('/whatsapp/sync', async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp/whatsapp');
    const whatsapp = new whatsappService();

    logger.info('Starting WhatsApp chat sync', {
      triggeredBy: 'api_endpoint',
      timestamp: new Date().toISOString(),
    });

    const syncResult = await whatsapp.syncChatsWithDatabase();

    res.json({
      success: true,
      message: 'Chat sync completed successfully',
      ...syncResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to sync WhatsApp chats', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to sync chats',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get chat sync status/info
router.get('/whatsapp/sync/status', async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp/whatsapp');
    const whatsapp = new whatsappService();

    // Get basic stats about current chats
    const { Conversation, Contact } = require('../models');
    const [totalConversations, totalContacts, groupCount, individualCount] = await Promise.all([
      Conversation.count(),
      Contact.count(),
      Contact.count({ where: { isGroup: true } }),
      Contact.count({ where: { isGroup: false } }),
    ]);

    res.json({
      success: true,
      statistics: {
        totalConversations,
        totalContacts,
        groupCount,
        individualCount,
        lastSyncAt: null, // Could be stored in database if needed
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get sync status', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Group management endpoints
router.get('/groups', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      search,
      includeInactive = false,
    } = req.query;

    const { groups, total } = await groupService.getAllGroups({
      limit: parseInt(limit),
      offset: parseInt(offset),
      search,
      includeInactive: includeInactive === 'true',
    });

    res.json({
      success: true,
      groups: groups.map((group) => ({
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        description: group.description,
        profilePicture: group.profilePicture,
        participantCount: group.getParticipantCount(),
        adminCount: group.getAdmins().length,
        isActive: group.isActive,
        source: group.source,
        lastSynced: group.lastSynced,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error('Failed to get groups', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get groups',
      message: error.message,
    });
  }
});

router.get('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Decode the group ID if it's URL encoded
    const decodedGroupId = decodeURIComponent(groupId);

    const group = await groupService.getGroup(decodedGroupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
        groupId: decodedGroupId,
      });
    }

    res.json({
      success: true,
      group: {
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        description: group.description,
        profilePicture: group.profilePicture,
        createdBy: group.createdBy,
        createdAtWhatsapp: group.createdAtWhatsapp,
        participants: group.participants,
        participantCount: group.getParticipantCount(),
        admins: group.getAdmins(),
        adminCount: group.getAdmins().length,
        metadata: group.metadata,
        isActive: group.isActive,
        source: group.source,
        lastSynced: group.lastSynced,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to get group', {
      groupId: req.params.groupId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get group',
      message: error.message,
    });
  }
});

router.put('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Decode the group ID if it's URL encoded
    const decodedGroupId = decodeURIComponent(groupId);

    const group = await groupService.updateGroup(decodedGroupId, {
      name,
      description,
    });

    res.json({
      success: true,
      group: {
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        description: group.description,
        updatedAt: group.updatedAt,
      },
      message: 'Group updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update group', {
      groupId: req.params.groupId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update group',
      message: error.message,
    });
  }
});

router.post('/groups/:groupId/sync-participants', async (req, res) => {
  try {
    const { groupId } = req.params;

    // Decode the group ID if it's URL encoded
    const decodedGroupId = decodeURIComponent(groupId);

    const group = await groupService.syncParticipants(decodedGroupId);

    res.json({
      success: true,
      group: {
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        participantCount: group.getParticipantCount(),
        adminCount: group.getAdmins().length,
        lastSynced: group.lastSynced,
      },
      message: 'Participants synced successfully',
    });
  } catch (error) {
    logger.error('Failed to sync participants', {
      groupId: req.params.groupId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to sync participants',
      message: error.message,
    });
  }
});

router.post('/groups/sync-from-contacts', async (req, res) => {
  try {
    const result = await groupService.syncGroupsFromContacts();

    res.json({
      success: true,
      result,
      message: `Synced ${result.synced} groups from contacts`,
    });
  } catch (error) {
    logger.error('Failed to sync groups from contacts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to sync groups from contacts',
      message: error.message,
    });
  }
});

// Debug endpoint for WebSocket connections
router.get('/debug/websocket', (req, res) => {
  try {
    const realtimeService = require('../services/utils/realtime');
    const stats = realtimeService.getStats();
    const assistantRoomName = 'conversation_00000000-0000-0000-0000-000000000001';
    const assistantRoomSize = realtimeService.io?.sockets.adapter.rooms.get(assistantRoomName)?.size || 0;

    res.json({
      ...stats,
      assistantRoom: {
        name: assistantRoomName,
        size: assistantRoomSize,
      },
      allRooms: Array.from(realtimeService.io?.sockets.adapter.rooms.keys() || []),
    });
  } catch (error) {
    logger.error('Failed to get WebSocket debug info', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket debug info',
      message: error.message,
    });
  }
});

// PAI Assistant management endpoints
router.get('/pai-assistant/qr', paiAssistantController.getPaiAssistantQR);
router.get('/pai-assistant/status', paiAssistantController.getPaiAssistantStatus);
router.get('/pai-assistant/stats', paiAssistantController.getPaiAssistantStats);
router.post('/pai-assistant/test', paiAssistantController.testPaiAssistant);
router.post('/pai-assistant/send-test', paiAssistantController.sendTestMessage);
router.post('/pai-assistant/clear-conversation', paiAssistantController.clearUserConversation);

module.exports = router;
