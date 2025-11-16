#!/usr/bin/env node

/**
 * Add sample groups for testing search functionality
 * This script adds groups with "wise" and "capital" terms so the user can test search immediately
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const logger = require('../src/utils/logger');

async function addSampleGroups() {
  try {
    logger.info('Starting to add sample groups for search testing...');

    // Initialize database connection first
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

    logger.info('Groups manager initialized, adding sample groups...');

    // Sample groups with searchable terms
    const sampleGroups = [
      {
        groupId: '120363000000000001@g.us',
        groupName: 'Wise Customer Support',
        isMonitored: false,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000002@g.us', 
        groupName: 'Capital One Support Team',
        isMonitored: false,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000003@g.us',
        groupName: 'Wise Business Banking Help',
        isMonitored: true,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000004@g.us',
        groupName: 'Capital Markets Discussion',
        isMonitored: true,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000005@g.us',
        groupName: 'TransferWise Community',
        isMonitored: false,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000006@g.us',
        groupName: 'Capital Ventures Networking',
        isMonitored: false,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000007@g.us',
        groupName: 'Wise Money Transfer Support',
        isMonitored: true,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000008@g.us',
        groupName: 'Capital Growth Advisors',
        isMonitored: false,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000009@g.us',
        groupName: 'Smart Capital Management',
        isMonitored: true,
        instanceId: 'cs-monitor'
      },
      {
        groupId: '120363000000000010@g.us',
        groupName: 'Wise Business Solutions',
        isMonitored: false,
        instanceId: 'cs-monitor'
      }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const group of sampleGroups) {
      try {
        const result = await groupsManager.registerGroup(
          group.groupId,
          group.groupName,
          group.isMonitored,
          group.instanceId
        );

        if (result.success) {
          successCount++;
          logger.info(`✅ Added group: ${group.groupName}`, {
            groupId: group.groupId,
            action: result.action,
            isMonitored: group.isMonitored
          });
        } else {
          errorCount++;
          logger.error(`❌ Failed to add group: ${group.groupName}`, {
            error: result.error,
            groupId: group.groupId
          });
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Exception adding group: ${group.groupName}`, {
          error: error.message,
          groupId: group.groupId
        });
      }
    }

    logger.info('Sample groups addition completed', {
      total: sampleGroups.length,
      success: successCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    });

    // Test the search functionality
    logger.info('Testing search functionality...');
    
    try {
      const wiseResults = await groupsManager.searchGroups('wise');
      const capitalResults = await groupsManager.searchGroups('capital');
      
      logger.info('Search test results', {
        wiseResults: wiseResults.groups?.length || 0,
        capitalResults: capitalResults.groups?.length || 0,
        wiseGroups: wiseResults.groups?.map(g => g.group_name) || [],
        capitalGroups: capitalResults.groups?.map(g => g.group_name) || []
      });

      if (wiseResults.groups?.length > 0 && capitalResults.groups?.length > 0) {
        logger.info('🎉 Search functionality is working! User can now search for "wise" and "capital" terms.');
      } else {
        logger.warn('⚠️  Search might not be working as expected');
      }

    } catch (searchError) {
      logger.error('Search test failed', {
        error: searchError.message
      });
    }

    process.exit(0);

  } catch (error) {
    logger.error('Failed to add sample groups', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addSampleGroups();
}

module.exports = { addSampleGroups };