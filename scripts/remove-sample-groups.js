#!/usr/bin/env node

/**
 * Remove hardcoded sample groups that were added for testing
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const logger = require('../src/utils/logger');

async function removeSampleGroups() {
  try {
    logger.info('Starting to remove hardcoded sample groups...');

    // Initialize database connection
    const { sequelize } = require('../src/models');
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Import groups manager
    const groupsManager = require('../ai-cs/modules/groups-manager');
    
    // Initialize groups manager with sequelize instance
    const initResult = await groupsManager.initialize(sequelize);
    
    if (!initResult.success) {
      throw new Error(`Failed to initialize groups manager: ${initResult.error}`);
    }

    // Sample group IDs that were created for testing (from add-sample-groups.js)
    const sampleGroupIds = [
      '120363000000000001@g.us', // Wise Customer Support
      '120363000000000002@g.us', // Capital One Support Team
      '120363000000000003@g.us', // Wise Business Banking Help
      '120363000000000004@g.us', // Capital Markets Discussion
      '120363000000000005@g.us', // TransferWise Community
      '120363000000000006@g.us', // Capital Ventures Networking
      '120363000000000007@g.us', // Wise Money Transfer Support
      '120363000000000008@g.us', // Capital Growth Advisors
      '120363000000000009@g.us', // Smart Capital Management
      '120363000000000010@g.us'  // Wise Business Solutions
    ];

    // Alternative: Remove by name patterns (in case IDs changed)
    const sampleGroupNames = [
      'Wise Customer Support',
      'Capital One Support Team', 
      'Wise Business Banking Help',
      'Capital Markets Discussion',
      'TransferWise Community',
      'Capital Ventures Networking',
      'Wise Money Transfer Support',
      'Capital Growth Advisors',
      'Smart Capital Management',
      'Wise Business Solutions'
    ];

    let removedCount = 0;
    const errors = [];

    // Remove by group IDs first
    for (const groupId of sampleGroupIds) {
      try {
        // Check if group exists
        const CSMonitoredGroup = sequelize.models.CSMonitoredGroup;
        const group = await CSMonitoredGroup.findOne({
          where: { group_id: groupId }
        });

        if (group) {
          await group.destroy();
          removedCount++;
          logger.info(`✅ Removed sample group by ID: ${groupId} (${group.group_name})`);
        }

      } catch (error) {
        errors.push({
          groupId,
          error: error.message
        });
        logger.error(`❌ Failed to remove group by ID: ${groupId}`, {
          error: error.message
        });
      }
    }

    // Remove by names as backup
    for (const groupName of sampleGroupNames) {
      try {
        const CSMonitoredGroup = sequelize.models.CSMonitoredGroup;
        const groups = await CSMonitoredGroup.findAll({
          where: { group_name: groupName }
        });

        for (const group of groups) {
          await group.destroy();
          removedCount++;
          logger.info(`✅ Removed sample group by name: ${groupName} (${group.group_id})`);
        }

      } catch (error) {
        errors.push({
          groupName,
          error: error.message
        });
        logger.error(`❌ Failed to remove group by name: ${groupName}`, {
          error: error.message
        });
      }
    }

    logger.info('Sample groups removal completed', {
      removed: removedCount,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    if (removedCount > 0) {
      logger.info('🎉 Sample groups removed successfully! Now using only actual WhatsApp groups.');
    } else {
      logger.info('ℹ️ No sample groups found to remove.');
    }

    process.exit(0);

  } catch (error) {
    logger.error('Failed to remove sample groups', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  removeSampleGroups();
}

module.exports = { removeSampleGroups };