#!/usr/bin/env node
/**
 * Script to fix group names in the database
 * Updates all group contacts with their proper group names from WhatsApp
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../src/models');
const Contact = require('../src/models').Contact;
const WhatsAppService = require('../src/services/whatsapp');
const logger = require('../src/utils/logger');

async function fixGroupNames() {
  const whatsappService = new WhatsAppService();
  
  try {
    logger.info('Starting group name fix process...');
    
    // Find all group contacts
    const groupContacts = await Contact.findAll({
      where: {
        phone: {
          [sequelize.Sequelize.Op.like]: '%@g.us'
        }
      }
    });
    
    logger.info(`Found ${groupContacts.length} group contacts to update`);
    
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const contact of groupContacts) {
      try {
        logger.info(`Fetching name for group: ${contact.phone}`);
        
        // Fetch the actual group name
        const groupName = await whatsappService.fetchGroupName(contact.phone);
        
        if (groupName && groupName !== 'Group Chat' && groupName !== contact.name) {
          // Update the contact with the proper group name
          await contact.update({
            name: groupName,
            isGroup: true,
            metadata: {
              ...contact.metadata,
              lastGroupNameSync: new Date(),
              previousName: contact.name
            }
          });
          
          logger.info(`✅ Updated group: "${contact.name}" → "${groupName}"`);
          updatedCount++;
        } else {
          logger.info(`⏭️  Skipped group: ${contact.phone} (name: ${contact.name})`);
        }
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`❌ Failed to update group ${contact.phone}:`, error.message);
        failedCount++;
      }
    }
    
    logger.info(`\n✅ Group name fix complete!`);
    logger.info(`📊 Results: ${updatedCount} updated, ${failedCount} failed, ${groupContacts.length - updatedCount - failedCount} skipped`);
    
  } catch (error) {
    logger.error('Failed to fix group names:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the script
fixGroupNames().then(() => {
  logger.info('Script completed successfully');
  process.exit(0);
}).catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});