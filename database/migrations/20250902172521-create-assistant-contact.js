'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create a special Assistant contact that will be used for summary conversations
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Get the assistant settings to use the correct name
      const [assistants] = await queryInterface.sequelize.query(
        'SELECT id, assistant_name FROM assistants LIMIT 1',
        { transaction }
      );

      const assistantName = assistants.length > 0 ? assistants[0].assistant_name : 'AI Assistant';
      const assistantId = assistants.length > 0 ? assistants[0].id : null;

      // Insert the Assistant contact with a special phone number
      await queryInterface.bulkInsert('contacts', [{
        id: '00000000-0000-0000-0000-000000000001', // Fixed UUID for Assistant
        phone: 'assistant@system',
        name: assistantName,
        profile_picture: null,
        is_blocked: false,
        is_group: false,
        priority: 'high',
        category: 'business',
        last_seen: new Date(),
        metadata: JSON.stringify({
          isAssistant: true,
          created_by_migration: true,
          assistant_id: assistantId
        }),
        created_at: new Date(),
        updated_at: new Date()
      }], { transaction });

      // Create an Assistant conversation
      await queryInterface.bulkInsert('conversations', [{
        id: '00000000-0000-0000-0000-000000000001', // Fixed UUID for Assistant conversation
        contact_id: '00000000-0000-0000-0000-000000000001',
        assistant_id: assistantId,
        status: 'active',
        priority: 'high',
        category: 'support',
        summary: 'Assistant conversation for summaries and system updates',
        context: JSON.stringify({
          isAssistant: true,
          purpose: 'system_summaries'
        }),
        tags: ['system', 'assistant', 'summaries'],
        last_message_at: new Date(),
        message_count: 0,
        is_assistant_enabled: false, // Assistant doesn't respond to itself
        created_at: new Date(),
        updated_at: new Date()
      }], { transaction });

      console.log(`✅ Created Assistant contact and conversation with name: ${assistantName}`);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove Assistant conversation first (due to foreign key)
      await queryInterface.bulkDelete('conversations', {
        id: '00000000-0000-0000-0000-000000000001'
      }, { transaction });

      // Remove Assistant contact
      await queryInterface.bulkDelete('contacts', {
        phone: 'assistant@system'
      }, { transaction });

      console.log('✅ Removed Assistant contact and conversation');
    });
  }
};