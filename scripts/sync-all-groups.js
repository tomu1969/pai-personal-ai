#!/usr/bin/env node

/**
 * Sync all groups from Evolution API to local database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

const logger = require('../src/utils/logger');

async function syncAllGroups() {
  try {
    logger.info('Starting to sync all groups from Evolution API...');

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

    // Fetch all groups from Evolution API
    const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || 'pai_evolution_api_key_2025';
    const instanceId = 'cs-monitor';

    logger.info('Fetching all groups from Evolution API...');
    
    const response = await axios.get(
      `${evolutionApiUrl}/group/fetchAllGroups/${instanceId}?getParticipants=false`,
      {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );

    const groups = response.data;
    logger.info(`Fetched ${groups.length} groups from Evolution API`);

    let registeredCount = 0;
    const errors = [];

    // Register each group
    for (const group of groups) {
      try {
        const registerResult = await groupsManager.registerGroup(
          group.id,
          group.subject || 'Unnamed Group',
          false, // Default to not monitored
          instanceId
        );

        if (registerResult.success) {
          registeredCount++;
          if (registeredCount % 100 === 0) {
            logger.info(`Progress: ${registeredCount}/${groups.length} groups registered`);
          }
        } else {
          errors.push({
            groupId: group.id,
            error: registerResult.error
          });
        }

      } catch (error) {
        errors.push({
          groupId: group.id,
          error: error.message
        });
      }
    }

    logger.info('Group sync completed', {
      totalGroups: groups.length,
      registered: registeredCount,
      errors: errors.length,
      timestamp: new Date().toISOString()
    });

    if (errors.length > 0) {
      logger.warn('Some groups failed to register', {
        errorCount: errors.length,
        sampleErrors: errors.slice(0, 5)
      });
    }

    logger.info(`🎉 Successfully synced ${registeredCount} groups! You can now search across all groups.`);
    
    process.exit(0);

  } catch (error) {
    logger.error('Failed to sync groups', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  syncAllGroups();
}

module.exports = { syncAllGroups };