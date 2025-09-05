const { GroupMetadata } = require('../models');
const WhatsAppService = require('./whatsapp');
const logger = require('../utils/logger');

class GroupService {
  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Get or create group metadata
   * @param {string} groupId - WhatsApp group ID
   * @param {object} data - Initial group data
   * @returns {Promise<GroupMetadata>}
   */
  async findOrCreateGroup(groupId, data = {}) {
    try {
      const [group, created] = await GroupMetadata.findOrCreateByGroupId(groupId, {
        name: data.name || 'Group Chat',
        description: data.description,
        profilePicture: data.profilePicture,
        createdBy: data.createdBy,
        createdAtWhatsapp: data.createdAtWhatsapp,
        participants: data.participants || [],
        metadata: data.metadata || {},
        source: data.source || 'webhook',
        ...data,
      });

      if (created) {
        logger.info('Created new group metadata', {
          groupId,
          name: group.name,
          participantCount: group.participants.length,
        });
      }

      return group;
    } catch (error) {
      logger.error('Failed to find or create group', {
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update group metadata from webhook data
   * @param {string} groupId - WhatsApp group ID
   * @param {object} webhookData - Data from WhatsApp webhook
   * @returns {Promise<GroupMetadata>}
   */
  async updateFromWebhook(groupId, webhookData) {
    try {
      const updateData = {
        lastSynced: new Date(),
        source: 'webhook',
      };

      // Extract group name from various possible fields
      const groupName = webhookData.groupSubject
                       || webhookData.groupName
                       || webhookData.subject
                       || webhookData.name;

      if (groupName && groupName !== 'Group Chat') {
        updateData.name = groupName;
      }

      // Extract other metadata if available
      if (webhookData.groupDescription) {
        updateData.description = webhookData.groupDescription;
      }

      if (webhookData.groupPicture) {
        updateData.profilePicture = webhookData.groupPicture;
      }

      // Update metadata with webhook info
      updateData.metadata = {
        ...updateData.metadata,
        lastWebhookData: {
          timestamp: new Date(),
          data: webhookData,
        },
      };

      const group = await this.findOrCreateGroup(groupId, updateData);

      if (Object.keys(updateData).length > 2) { // More than just lastSynced and source
        await group.update(updateData);

        logger.info('Updated group from webhook', {
          groupId,
          name: group.name,
          updatedFields: Object.keys(updateData),
        });
      }

      return group;
    } catch (error) {
      logger.error('Failed to update group from webhook', {
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sync group participants from Evolution API
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<GroupMetadata>}
   */
  async syncParticipants(groupId) {
    try {
      logger.info('Syncing participants for group', { groupId });

      // Fetch participants from Evolution API
      const response = await this.whatsappService.client.get(
        `/group/participants/${this.whatsappService.instanceId}`,
        { params: { groupJid: groupId } },
      );

      const participants = response.data?.participants || [];

      const participantData = participants.map((p) => ({
        id: p.id,
        role: p.admin ? 'admin' : 'member',
        joinedAt: new Date(), // We don't have the actual join date
      }));

      // Update or create group with participants
      const group = await this.findOrCreateGroup(groupId);
      group.participants = participantData;
      group.lastSynced = new Date();
      group.source = 'api';

      await group.save();

      logger.info('Synced group participants', {
        groupId,
        participantCount: participantData.length,
        adminCount: participantData.filter((p) => p.role === 'admin').length,
      });

      return group;
    } catch (error) {
      logger.warn('Failed to sync participants from API', {
        groupId,
        error: error.message,
      });

      // Return existing group or create with empty participants
      return this.findOrCreateGroup(groupId);
    }
  }

  /**
   * Get group metadata by ID
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<GroupMetadata|null>}
   */
  async getGroup(groupId) {
    try {
      return await GroupMetadata.findByGroupId(groupId);
    } catch (error) {
      logger.error('Failed to get group', { groupId, error: error.message });
      return null;
    }
  }

  /**
   * Update group manually
   * @param {string} groupId - WhatsApp group ID
   * @param {object} updates - Updates to apply
   * @returns {Promise<GroupMetadata>}
   */
  async updateGroup(groupId, updates) {
    try {
      const group = await this.findOrCreateGroup(groupId);

      // Don't allow updating system fields
      const allowedUpdates = {
        name: updates.name,
        description: updates.description,
        profilePicture: updates.profilePicture,
      };

      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined),
      );

      if (Object.keys(filteredUpdates).length > 0) {
        filteredUpdates.source = 'manual';
        await group.update(filteredUpdates);

        logger.info('Updated group manually', {
          groupId,
          updates: Object.keys(filteredUpdates),
        });
      }

      return group;
    } catch (error) {
      logger.error('Failed to update group', {
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all groups with pagination
   * @param {object} options - Query options
   * @returns {Promise<{groups: GroupMetadata[], total: number}>}
   */
  async getAllGroups(options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        includeInactive = false,
        search = null,
      } = options;

      const where = {};

      if (!includeInactive) {
        where.isActive = true;
      }

      if (search) {
        where[require('sequelize').Op.or] = [
          { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { groupId: { [require('sequelize').Op.iLike]: `%${search}%` } },
        ];
      }

      const { rows: groups, count: total } = await GroupMetadata.findAndCountAll({
        where,
        limit,
        offset,
        order: [['updatedAt', 'DESC']],
      });

      return { groups, total };
    } catch (error) {
      logger.error('Failed to get all groups', { error: error.message });
      throw error;
    }
  }

  /**
   * Sync all groups from existing contacts
   * @returns {Promise<{synced: number, failed: number}>}
   */
  async syncGroupsFromContacts() {
    try {
      const { Contact } = require('../models');

      // Get all group contacts
      const groupContacts = await Contact.findAll({
        where: {
          phone: { [require('sequelize').Op.like]: '%@g.us' },
        },
      });

      let synced = 0;
      let failed = 0;

      for (const contact of groupContacts) {
        try {
          await this.findOrCreateGroup(contact.phone, {
            name: contact.name || 'Group Chat',
            source: 'manual',
          });
          synced++;
        } catch (error) {
          logger.error('Failed to sync group from contact', {
            contactId: contact.id,
            phone: contact.phone,
            error: error.message,
          });
          failed++;
        }
      }

      logger.info('Synced groups from contacts', { synced, failed, total: groupContacts.length });
      return { synced, failed };
    } catch (error) {
      logger.error('Failed to sync groups from contacts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get group name for display
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<string>}
   */
  async getGroupDisplayName(groupId) {
    try {
      const group = await this.getGroup(groupId);

      if (group && group.name && group.name !== 'Group Chat') {
        return group.name;
      }

      // Try to sync participants and get fresh data
      try {
        const syncedGroup = await this.syncParticipants(groupId);
        if (syncedGroup.name && syncedGroup.name !== 'Group Chat') {
          return syncedGroup.name;
        }
      } catch (syncError) {
        // Sync failed, continue with fallback
      }

      // Generate a name based on group ID
      const shortId = groupId.split('-')[0]?.substring(0, 8) || groupId.substring(0, 8);
      return `Group ${shortId}`;
    } catch (error) {
      logger.error('Failed to get group display name', { groupId, error: error.message });
      return 'Group Chat';
    }
  }

  /**
   * Mark group as inactive
   * @param {string} groupId - WhatsApp group ID
   * @returns {Promise<void>}
   */
  async deactivateGroup(groupId) {
    try {
      const group = await this.getGroup(groupId);
      if (group) {
        await group.update({ isActive: false });
        logger.info('Deactivated group', { groupId });
      }
    } catch (error) {
      logger.error('Failed to deactivate group', { groupId, error: error.message });
      throw error;
    }
  }
}

module.exports = new GroupService();
