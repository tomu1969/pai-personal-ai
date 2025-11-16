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
const paiMortgageController = require('../controllers/paiMortgageController');
const systemController = require('../controllers/systemController');

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

// PAI Mortgage management endpoints
router.get('/pai-mortgage/qr', paiMortgageController.getPaiMortgageQR);
router.get('/pai-mortgage/status', paiMortgageController.getPaiMortgageStatus);
router.get('/pai-mortgage/stats', paiMortgageController.getPaiMortgageStats);
router.post('/pai-mortgage/test', paiMortgageController.testPaiMortgage);
router.post('/pai-mortgage/send-test', paiMortgageController.sendTestMessage);
router.post('/pai-mortgage/clear-conversation', paiMortgageController.clearUserConversation);
router.get('/pai-mortgage/qualification-report', paiMortgageController.getQualificationReport);
router.get('/pai-mortgage/rates', paiMortgageController.getCurrentRates);

// System management endpoints
router.get('/system/status', systemController.getSystemStatus);
router.post('/system/reinitialize', systemController.reinitializeSystem);
router.post('/system/instance/:alias/reinitialize', systemController.reinitializeInstance);
router.get('/system/pai-mortgage/diagnostics', systemController.getPaiMortgageStatus);

// CS Ticket System - Group Monitoring endpoints
router.get('/cs/groups', async (req, res) => {
  logger.info('CS Groups API endpoint called', {
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  try {
    logger.debug('Loading groups manager module');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    // Initialize Groups Manager with database connection
    logger.debug('Initializing Groups Manager with database connection');
    const { sequelize } = require('../models');
    
    const initResult = await groupsManager.initialize(sequelize);
    
    if (!initResult.success) {
      logger.error('Groups Manager initialization failed', { error: initResult.error });
      throw new Error(`Groups Manager initialization failed: ${initResult.error}`);
    }
    
    logger.debug('Groups manager initialized successfully');
    
    const { instanceId, monitored } = req.query;
    logger.debug('Calling getAllGroups with parameters', {
      instanceId: instanceId || 'default',
      hasInstanceId: !!instanceId,
      monitored: monitored
    });
    
    const result = await groupsManager.getAllGroups(instanceId);
    
    logger.info('Groups manager getAllGroups result', {
      success: result.success,
      groupsCount: result.groups?.length || 0,
      error: result.error,
      summary: result.summary
    });
    
    if (result.success) {
      let filteredGroups = result.groups;
      let filteredSummary = result.summary;
      
      // Debug monitored parameter
      logger.debug('Processing monitored filter', {
        monitored: monitored,
        monitoredType: typeof monitored,
        monitoredValue: JSON.stringify(monitored)
      });
      
      // Apply monitored filter if specified
      if (monitored === 'true') {
        filteredGroups = result.groups.filter(group => group.isMonitored === true);
        filteredSummary = {
          total: filteredGroups.length,
          monitored: filteredGroups.length,
          unmonitored: 0
        };
        logger.debug('Applied monitored filter', {
          originalCount: result.groups.length,
          filteredCount: filteredGroups.length
        });
      } else if (monitored === 'false') {
        filteredGroups = result.groups.filter(group => group.isMonitored === false);
        filteredSummary = {
          total: filteredGroups.length,
          monitored: 0,
          unmonitored: filteredGroups.length
        };
        logger.debug('Applied unmonitored filter', {
          originalCount: result.groups.length,
          filteredCount: filteredGroups.length
        });
      }
      
      logger.info('Sending successful groups response', {
        groupsCount: filteredGroups.length,
        summary: filteredSummary,
        monitoredFilter: monitored
      });
      
      res.json({
        success: true,
        groups: filteredGroups,
        summary: filteredSummary,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn('Groups manager returned error', {
        error: result.error,
        result
      });
      
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Exception in CS groups endpoint', {
      error: error.message,
      stack: error.stack,
      query: req.query,
      errorName: error.name,
      errorCode: error.code
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get CS monitored groups',
      message: error.message,
      errorDetails: {
        name: error.name,
        code: error.code
      },
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups Search endpoint - for finding groups to add to monitoring
// CS Groups - Get monitored groups only (for bulk processing dropdown)
router.get('/cs/groups/monitored', async (req, res) => {
  logger.info('CS Monitored Groups API endpoint called', {
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  try {
    logger.debug('Loading groups manager module for monitored groups');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    // Initialize Groups Manager with database connection
    logger.debug('Initializing Groups Manager with database connection for monitored groups');
    const { sequelize } = require('../models');
    
    const initResult = await groupsManager.initialize(sequelize);
    
    if (!initResult.success) {
      logger.error('Groups Manager initialization failed for monitored groups', { error: initResult.error });
      throw new Error(`Groups Manager initialization failed: ${initResult.error}`);
    }
    
    const result = await groupsManager.getAllGroups();
    
    if (result.success) {
      // Filter to only monitored groups
      const monitoredGroups = result.groups.filter(group => group.isMonitored === true);
      
      logger.info('Monitored groups fetched', {
        totalGroups: result.groups.length,
        monitoredGroups: monitoredGroups.length
      });
      
      res.json(monitoredGroups.map(group => ({
        group_id: group.groupId,
        group_name: group.groupName,
        id: group.id,
        is_monitored: group.isMonitored,
        instance_id: group.instanceId,
        first_seen: group.firstSeen,
        created_at: group.createdAt,
        updated_at: group.updatedAt
      })));
    } else {
      logger.warn('Groups manager returned error for monitored groups', {
        error: result.error
      });
      
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Exception in CS monitored groups endpoint', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get monitored groups',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/cs/groups/search', async (req, res) => {
  logger.info('CS Groups Search API endpoint called', {
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  try {
    const { q: searchTerm, limit = 50 } = req.query;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.debug('Loading groups manager module for search');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    // Initialize Groups Manager with database connection
    logger.debug('Initializing Groups Manager with database connection for search');
    const { sequelize } = require('../models');
    
    const initResult = await groupsManager.initialize(sequelize);
    
    if (!initResult.success) {
      logger.error('Groups Manager initialization failed for search', { error: initResult.error });
      throw new Error(`Groups Manager initialization failed: ${initResult.error}`);
    }
    
    // Use advanced database-level search instead of loading all groups
    const searchOptions = {
      limit: parseInt(limit, 10),
      instanceId: req.query.instance_id,
      monitoredOnly: req.query.monitored_only === 'true',
      searchType: req.query.search_type || 'auto'
    };

    const result = await groupsManager.searchGroups(searchTerm, searchOptions);
    
    if (result.success) {
      logger.info('Advanced groups search completed', {
        searchTerm: result.searchTerm,
        searchType: result.searchType,
        resultsFound: result.groups.length,
        searchTimeMs: result.searchTimeMs,
        limit: searchOptions.limit
      });
      
      // Get total groups count for summary (cached or quick query)
      const statsResult = await groupsManager.getSearchStats();
      const totalAvailable = statsResult.success ? statsResult.stats.total_groups : 0;
      
      res.json({
        success: true,
        groups: result.groups,
        searchTerm: result.searchTerm,
        searchType: result.searchType,
        searchTimeMs: result.searchTimeMs,
        summary: {
          totalAvailable: parseInt(totalAvailable),
          matchingResults: result.groups.length,
          limit: searchOptions.limit,
          searchOptions: searchOptions
        },
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn('Advanced groups search returned error', {
        error: result.error,
        searchTerm
      });
      
      res.status(500).json({
        success: false,
        error: result.error,
        searchTerm: result.searchTerm || searchTerm,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Exception in CS groups search endpoint', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to search CS groups',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Dual-Database Search endpoint (Evolution + Local)
router.get('/cs/groups/search-all', async (req, res) => {
  logger.info('CS Groups Dual-Database Search API endpoint called', {
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  try {
    const { q: searchTerm, limit = 50 } = req.query;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters',
        timestamp: new Date().toISOString()
      });
    }

    // Load both database services
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const evolutionDbService = require('../../ai-cs/services/evolution-db-service');
    
    logger.debug('Initializing dual database search services');
    
    // Initialize local groups manager
    const { sequelize } = require('../models');
    const localInitResult = await groupsManager.initialize(sequelize);
    
    if (!localInitResult.success) {
      logger.error('Local Groups Manager initialization failed', { error: localInitResult.error });
      throw new Error(`Local Groups Manager failed: ${localInitResult.error}`);
    }
    
    // Initialize Evolution database service
    const evolutionInitResult = await evolutionDbService.initialize();
    
    if (!evolutionInitResult.success) {
      logger.warn('Evolution Database Service initialization failed, using local only', { 
        error: evolutionInitResult.error 
      });
    }

    const searchOptions = {
      limit: parseInt(limit, 10),
      instanceId: req.query.instance_id,
      monitoredOnly: req.query.monitored_only === 'true',
      searchType: req.query.search_type || 'auto'
    };

    // Perform dual-database search
    const [localResult, evolutionResult] = await Promise.allSettled([
      groupsManager.searchGroups(searchTerm, searchOptions),
      evolutionInitResult.success ? 
        evolutionDbService.searchGroups(searchTerm, {
          limit: searchOptions.limit,
          activeOnly: true,
          searchType: searchOptions.searchType
        }) : 
        Promise.resolve({ success: false, groups: [] })
    ]);

    // Process search results
    let combinedGroups = [];
    let totalSearchTimeMs = 0;
    let sources = [];

    // Add local results
    if (localResult.status === 'fulfilled' && localResult.value.success) {
      const localGroups = localResult.value.groups.map(group => ({
        ...group,
        source: 'local',
        groupName: group.group_name,
        groupId: group.group_id,
        isMonitored: group.is_monitored
      }));
      combinedGroups = [...combinedGroups, ...localGroups];
      totalSearchTimeMs += localResult.value.searchTimeMs || 0;
      sources.push({
        source: 'local',
        count: localGroups.length,
        timeMs: localResult.value.searchTimeMs
      });
    }

    // Add Evolution database results
    if (evolutionResult.status === 'fulfilled' && evolutionResult.value.success) {
      const evolutionGroups = evolutionResult.value.groups.map(group => ({
        ...group,
        source: 'evolution',
        groupName: group.name,
        groupId: group.group_id,
        isMonitored: false,
        participants: group.participants,
        description: group.description,
        profilePicture: group.profile_picture
      }));
      
      // Merge with local groups (avoid duplicates by group_id)
      const existingGroupIds = new Set(combinedGroups.map(g => g.groupId));
      const newEvolutionGroups = evolutionGroups.filter(g => !existingGroupIds.has(g.groupId));
      
      combinedGroups = [...combinedGroups, ...newEvolutionGroups];
      totalSearchTimeMs += evolutionResult.value.searchTimeMs || 0;
      sources.push({
        source: 'evolution',
        count: newEvolutionGroups.length,
        duplicatesFiltered: evolutionGroups.length - newEvolutionGroups.length,
        timeMs: evolutionResult.value.searchTimeMs
      });
    }

    // Sort combined results by relevance and monitoring status
    combinedGroups.sort((a, b) => {
      if (a.isMonitored !== b.isMonitored) {
        return b.isMonitored ? 1 : -1;
      }
      if (a.relevance !== b.relevance) {
        return (b.relevance || 0) - (a.relevance || 0);
      }
      return (a.groupName || '').localeCompare(b.groupName || '');
    });

    // Apply limit to combined results
    const limitedGroups = combinedGroups.slice(0, searchOptions.limit);

    logger.info('Dual-database groups search completed', {
      searchTerm,
      searchType: searchOptions.searchType,
      resultsFound: limitedGroups.length,
      searchTimeMs: totalSearchTimeMs,
      sources: sources
    });

    res.json({
      success: true,
      groups: limitedGroups,
      searchTerm: searchTerm,
      searchType: searchOptions.searchType,
      searchTimeMs: totalSearchTimeMs,
      sources: sources,
      summary: {
        matchingResults: limitedGroups.length,
        combinedFromSources: combinedGroups.length,
        limit: searchOptions.limit,
        searchOptions: searchOptions
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Exception in dual-database CS groups search endpoint', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to search CS groups (dual-database)',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Sync Workers API endpoints
router.post('/cs/groups/sync-worker', async (req, res) => {
  logger.info('CS Groups Sync Worker API endpoint called', {
    body: req.body,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  try {
    const groupSyncWorker = require('../../ai-cs/workers/group-sync-worker');
    const evolutionDbService = require('../../ai-cs/services/evolution-db-service');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    // Initialize dependencies
    const { sequelize } = require('../models');
    await groupsManager.initialize(sequelize);
    
    const dependencies = {
      evolutionDbService,
      groupsManager
    };
    
    const initResult = await groupSyncWorker.initialize(dependencies);
    
    if (!initResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize sync worker',
        details: initResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const syncOptions = {
      instanceId: req.body.instanceId || 'cs-monitor',
      strategy: req.body.strategy || 'hybrid',
      forceRefresh: req.body.forceRefresh || false
    };
    
    const syncResult = await groupSyncWorker.performSync(syncOptions);
    
    res.json({
      success: syncResult.success,
      message: syncResult.message,
      syncResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Exception in CS groups sync worker endpoint', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to run sync worker',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/cs/groups/sync-worker/status', async (req, res) => {
  try {
    const groupSyncWorker = require('../../ai-cs/workers/group-sync-worker');
    const status = groupSyncWorker.getSyncStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Exception in CS groups sync worker status endpoint', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get sync worker status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Search Suggestions endpoint (autocomplete)
router.get('/cs/groups/suggestions', async (req, res) => {
  try {
    const { q: partialTerm, limit = 10, instance_id } = req.query;
    
    if (!partialTerm || partialTerm.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Partial term must be at least 1 character',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.debug('Loading groups manager for suggestions');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    const { sequelize } = require('../models');
    await groupsManager.initialize(sequelize);
    
    const suggestions = await groupsManager.getSearchSuggestions(partialTerm, {
      limit: parseInt(limit, 10),
      instanceId: instance_id
    });
    
    res.json({
      success: true,
      suggestions,
      partialTerm,
      limit: parseInt(limit, 10),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('CS groups suggestions failed', {
      error: error.message,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Search Statistics endpoint
router.get('/cs/groups/stats', async (req, res) => {
  try {
    logger.debug('Loading groups manager for search stats');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    const { sequelize } = require('../models');
    await groupsManager.initialize(sequelize);
    
    const statsResult = await groupsManager.getSearchStats();
    
    if (statsResult.success) {
      res.json({
        success: true,
        ...statsResult,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: statsResult.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('CS groups stats failed', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get search statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Index Management Endpoints

// CS Groups - Trigger Manual Index
router.post('/cs/groups/index', async (req, res) => {
  try {
    logger.info('Manual group indexing requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body
    });

    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const groupIndexer = require('../../ai-cs/modules/group-indexer');
    
    // Initialize both services
    const { sequelize } = require('../models');
    await groupsManager.initialize(sequelize);
    await groupIndexer.initialize(groupsManager);

    const { instanceId, forceRefresh = false } = req.body;
    
    const indexResult = await groupIndexer.performFullIndex({
      instanceId,
      forceRefresh
    });

    if (indexResult.success) {
      res.json({
        success: true,
        message: 'Group indexing completed successfully',
        ...indexResult,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: indexResult.error,
        isIndexing: indexResult.isIndexing,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Manual group indexing failed', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Group indexing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Index Status
router.get('/cs/groups/index/status', async (req, res) => {
  try {
    const groupIndexer = require('../../ai-cs/modules/group-indexer');
    const status = groupIndexer.getIndexingStatus();
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get indexing status', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get indexing status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Schedule Periodic Indexing
router.post('/cs/groups/index/schedule', async (req, res) => {
  try {
    const { intervalMinutes = 30 } = req.body;
    
    const groupIndexer = require('../../ai-cs/modules/group-indexer');
    const scheduleResult = groupIndexer.schedulePeriodicIndexing(intervalMinutes);
    
    res.json({
      success: true,
      ...scheduleResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to schedule periodic indexing', {
      error: error.message,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to schedule periodic indexing',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/cs/groups/:groupId/toggle', async (req, res) => {
  try {
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const { groupId } = req.params;
    const { isMonitored } = req.body;
    
    // Decode the group ID if it's URL encoded
    const decodedGroupId = decodeURIComponent(groupId);
    
    const result = await groupsManager.toggleGroupMonitoring(decodedGroupId, isMonitored);
    
    if (result.success) {
      res.json({
        success: true,
        group: result.group,
        message: `Group monitoring ${isMonitored ? 'enabled' : 'disabled'}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to toggle CS group monitoring', {
      groupId: req.params.groupId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to toggle group monitoring',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/cs/groups/bulk-update', async (req, res) => {
  try {
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates must be an array of {groupId, isMonitored} objects',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await groupsManager.bulkUpdateMonitoring(updates);
    
    res.json({
      success: result.success,
      results: result.results,
      summary: result.summary,
      message: result.success ? 'Bulk update completed' : 'Bulk update failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to bulk update CS group monitoring', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update group monitoring',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/cs/status', async (req, res) => {
  try {
    // Get CS orchestrator status
    const csOrchestrator = require('../../ai-cs/index');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    const orchestratorHealth = csOrchestrator.getHealthStatus();
    const groupsHealth = groupsManager.getHealthStatus();
    
    res.json({
      success: true,
      csTicketSystem: {
        orchestrator: orchestratorHealth,
        groupsManager: groupsHealth,
        ready: orchestratorHealth.initialized && groupsHealth.initialized
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get CS system status', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get CS system status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/cs/initialize', async (req, res) => {
  logger.info('CS system initialization requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  try {
    // Load CS orchestrator
    const csOrchestrator = require('../../ai-cs/index');
    
    logger.info('Attempting to initialize CS orchestrator...');
    
    // Initialize the orchestrator
    const initResult = await csOrchestrator.initialize();
    
    logger.info('CS orchestrator initialization result', {
      success: initResult.success,
      error: initResult.error,
      services: initResult.services,
      startTime: initResult.startTime
    });
    
    if (initResult.success) {
      res.json({
        success: true,
        message: 'CS Ticket System initialized successfully',
        result: initResult,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'CS system initialization failed',
        details: initResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Exception during CS system initialization', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to initialize CS system',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups Sync endpoint - Fetch real WhatsApp groups from Evolution API
router.post('/cs/groups/sync', async (req, res) => {
  try {
    logger.info('CS Groups sync requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Load required modules
    const axios = require('axios');
    const config = require('../config');
    const groupsManager = require('../../ai-cs/modules/groups-manager');

    const evolutionApiUrl = config.evolution.apiUrl;
    const evolutionApiKey = config.evolution.apiKey;
    const instanceId = process.env.CS_INSTANCE_ID || 'cs-ticket-monitor';

    logger.info('Fetching groups from Evolution API', {
      apiUrl: evolutionApiUrl,
      instanceId
    });

    // Fetch all WhatsApp groups from Evolution API
    const evolutionResponse = await axios.get(
      `${evolutionApiUrl}/group/fetchAllGroups/${instanceId}`,
      {
        headers: {
          'apikey': evolutionApiKey
        },
        params: {
          getParticipants: false
        },
        timeout: 30000
      }
    );

    const whatsappGroups = evolutionResponse.data;
    logger.info('Evolution API groups fetched', {
      totalGroups: whatsappGroups.length,
      sampleGroups: whatsappGroups.slice(0, 3).map(g => ({ id: g.id, subject: g.subject }))
    });

    // Sync groups to database
    let syncedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const group of whatsappGroups) {
      try {
        // Register each group in the database
        const result = await groupsManager.registerGroup(
          group.id,                           // groupId (e.g., "120363400400107382@g.us")
          group.subject || 'Unnamed Group',   // groupName
          instanceId                          // instanceId
        );

        if (result.success) {
          syncedCount++;
          results.push({
            groupId: group.id,
            groupName: group.subject,
            status: 'synced',
            isNew: result.created
          });
        } else {
          errorCount++;
          results.push({
            groupId: group.id,
            groupName: group.subject,
            status: 'error',
            error: result.error
          });
        }
      } catch (error) {
        errorCount++;
        logger.error('Error syncing individual group', {
          groupId: group.id,
          groupName: group.subject,
          error: error.message
        });
        results.push({
          groupId: group.id,
          groupName: group.subject,
          status: 'error',
          error: error.message
        });
      }
    }

    logger.info('Groups sync completed', {
      totalGroups: whatsappGroups.length,
      syncedCount,
      errorCount,
      successRate: `${Math.round((syncedCount / whatsappGroups.length) * 100)}%`
    });

    res.json({
      success: true,
      message: 'Groups synchronization completed',
      summary: {
        total: whatsappGroups.length,
        synced: syncedCount,
        errors: errorCount,
        successRate: Math.round((syncedCount / whatsappGroups.length) * 100)
      },
      results: results.slice(0, 10), // Return first 10 for brevity
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('CS Groups sync failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Groups synchronization failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups Clean endpoint - Remove test groups from database
router.post('/cs/groups/clean', async (req, res) => {
  try {
    logger.info('CS Groups clean requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Load the groups manager module
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    
    // Get all current groups to see what we're working with
    const currentResult = await groupsManager.getAllGroups();
    
    if (!currentResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch current groups',
        details: currentResult.error
      });
    }

    const testGroups = currentResult.groups.filter(group => 
      group.groupName && (
        group.groupName.toLowerCase().includes('test') ||
        group.groupName.toLowerCase().includes('vip support')
      )
    );

    logger.info('Found test groups to remove', {
      testGroupsCount: testGroups.length,
      testGroups: testGroups.map(g => ({ id: g.id, groupId: g.groupId, groupName: g.groupName }))
    });

    if (testGroups.length === 0) {
      return res.json({
        success: true,
        message: 'No test groups found to clean',
        removed: 0
      });
    }

    // Delete test groups by using the groups manager's internal sequelize connection
    let deleteResult = 0;
    for (const group of testGroups) {
      try {
        // Use the groups manager's sequelize instance through a raw query
        const queryResult = await groupsManager.sequelize.query(
          'DELETE FROM cs_monitored_groups WHERE id = $1',
          {
            bind: [group.id],
            type: groupsManager.sequelize.QueryTypes.DELETE
          }
        );
        deleteResult++;
        logger.debug('Deleted test group', {
          id: group.id,
          groupId: group.groupId,
          groupName: group.groupName
        });
      } catch (deleteError) {
        logger.error('Failed to delete test group', {
          groupId: group.groupId,
          groupName: group.groupName,
          error: deleteError.message
        });
      }
    }

    logger.info('Test groups cleanup completed', {
      groupsRemoved: deleteResult,
      testGroupIds: testGroups.map(g => g.id)
    });

    res.json({
      success: true,
      message: `Successfully removed ${deleteResult} test groups`,
      removed: deleteResult,
      details: testGroups.map(g => ({ groupId: g.groupId, groupName: g.groupName }))
    });

  } catch (error) {
    logger.error('CS Groups clean failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Groups cleanup failed',
      message: error.message
    });
  }
});

// CS Groups - Process History endpoint
router.post('/cs/groups/process-history', async (req, res) => {
  try {
    logger.info('CS Groups process history requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Load required modules
    const historyFetcher = require('../../ai-cs/services/history-fetcher');
    const csWebhookController = require('../../ai-cs/controllers/cs-webhook');
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const csOrchestrator = require('../../ai-cs/index');

    // Initialize CS orchestrator if not already initialized
    if (!csOrchestrator.isInitialized()) {
      logger.info('Initializing CS orchestrator for history processing...');
      const initResult = await csOrchestrator.initialize();
      if (!initResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize CS orchestrator',
          details: initResult.error,
          timestamp: new Date().toISOString()
        });
      }
      logger.info('CS orchestrator initialized successfully');
    }

    // Get all monitored groups
    logger.info('Fetching monitored groups...');
    const groupsResult = await groupsManager.getAllGroups();
    
    if (!groupsResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get monitored groups',
        details: groupsResult.error,
        timestamp: new Date().toISOString()
      });
    }

    const monitoredGroups = groupsResult.groups.filter(group => group.isMonitored === true);
    
    if (monitoredGroups.length === 0) {
      return res.json({
        success: true,
        message: 'No monitored groups found',
        groupsProcessed: 0,
        totalMessages: 0,
        ticketsCreated: 0,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Starting history processing for monitored groups', {
      monitoredGroupsCount: monitoredGroups.length
    });

    // Fetch historical messages from all monitored groups
    const historyResult = await historyFetcher.fetchAllGroupsHistory(
      monitoredGroups.map(group => ({
        groupId: group.groupId,
        groupName: group.groupName
      })),
      { limit: 500 } // Limit per group to avoid overwhelming the system
    );

    if (!historyResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch group history',
        details: historyResult.error,
        timestamp: new Date().toISOString()
      });
    }

    // Process messages through the existing bulk processing pipeline
    let totalTicketsCreated = 0;
    let totalDuplicatesSkipped = 0;
    let processingErrors = [];

    for (const groupResult of historyResult.groupResults) {
      if (groupResult.success && groupResult.messages.length > 0) {
        try {
          logger.info(`Processing ${groupResult.messages.length} messages for group: ${groupResult.groupName}`);

          // Transform messages to the format expected by processBulkMessages
          const formattedMessages = groupResult.messages.map(msg => ({
            timestamp: msg.timestamp,
            sender: msg.senderName,
            content: msg.textContent
          }));

          // Process through bulk processing pipeline
          const processingResult = await csWebhookController.processBulkMessages({
            messages: formattedMessages,
            groupId: groupResult.groupId,
            groupName: groupResult.groupName,
            sourceType: 'history',
            instanceId: process.env.CS_INSTANCE_ID || 'cs-ticket-monitor'
          });

          if (processingResult.success) {
            totalTicketsCreated += processingResult.ticketsCreated || 0;
            totalDuplicatesSkipped += processingResult.duplicatesSkipped || 0;
            
            // Update group result with ticket information
            groupResult.ticketsFound = processingResult.ticketsCreated || 0;
            
            logger.info(`Group processing completed: ${groupResult.groupName}`, {
              messagesProcessed: formattedMessages.length,
              ticketsCreated: processingResult.ticketsCreated || 0
            });
          } else {
            const errorMsg = `Failed to process messages for group ${groupResult.groupName}: ${processingResult.error}`;
            processingErrors.push(errorMsg);
            groupResult.ticketsFound = 0;
          }

        } catch (processingError) {
          const errorMsg = `Exception processing group ${groupResult.groupName}: ${processingError.message}`;
          processingErrors.push(errorMsg);
          groupResult.ticketsFound = 0;
          
          logger.error('Exception during group message processing', {
            groupName: groupResult.groupName,
            error: processingError.message
          });
        }
      } else {
        groupResult.ticketsFound = 0;
      }
    }

    // Combine all errors
    const allErrors = [...historyResult.errors, ...processingErrors];

    const finalResult = {
      success: true,
      message: 'History processing completed',
      groupsProcessed: historyResult.groupsProcessed,
      totalMessages: historyResult.totalMessages,
      ticketsCreated: totalTicketsCreated,
      duplicatesSkipped: totalDuplicatesSkipped,
      errors: allErrors.length,
      errorMessages: allErrors,
      groupResults: historyResult.groupResults,
      timestamp: new Date().toISOString()
    };

    logger.info('History processing completed successfully', {
      groupsProcessed: finalResult.groupsProcessed,
      totalMessages: finalResult.totalMessages,
      ticketsCreated: finalResult.ticketsCreated,
      errors: finalResult.errors
    });

    res.json(finalResult);

  } catch (error) {
    logger.error('CS Groups process history failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'History processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// CS Groups - Discover/Sync Groups endpoint
router.post('/cs/groups/discover', async (req, res) => {
  try {
    logger.info('CS Groups discover/sync requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Load required modules
    const groupsManager = require('../../ai-cs/modules/groups-manager');
    const csOrchestrator = require('../../ai-cs/index');

    // Initialize CS orchestrator if not already initialized
    if (!csOrchestrator.isInitialized()) {
      logger.info('Initializing CS orchestrator for group discovery...');
      const initResult = await csOrchestrator.initialize();
      if (!initResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize CS orchestrator',
          details: initResult.error,
          timestamp: new Date().toISOString()
        });
      }
      logger.info('CS orchestrator initialized successfully');
    }

    // Get instance ID from request or use default
    const instanceId = req.body.instanceId || process.env.CS_INSTANCE_ID || 'cs-monitor';

    logger.info('Starting group discovery process', { instanceId });

    // Trigger group discovery (pass empty object as evolution service since we make direct API calls)
    const discoveryResult = await groupsManager.discoverGroups({}, instanceId);

    if (discoveryResult.success) {
      logger.info('Group discovery completed successfully', discoveryResult);

      res.json({
        success: true,
        message: 'Group discovery completed successfully',
        instanceId: discoveryResult.instanceId,
        statistics: discoveryResult.statistics,
        errors: discoveryResult.errors,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Group discovery failed', discoveryResult);

      res.status(500).json({
        success: false,
        error: 'Group discovery failed',
        message: discoveryResult.error,
        instanceId: discoveryResult.instanceId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('CS Groups discover endpoint failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Group discovery endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
