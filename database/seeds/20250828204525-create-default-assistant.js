const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const config = require('../../src/config');
    
    await queryInterface.bulkInsert('assistants', [{
      id: uuidv4(),
      enabled: config.assistant.defaultStatus,
      owner_name: config.assistant.ownerName,
      auto_response_template: config.assistant.autoResponseTemplate,
      messages_processed: 0,
      last_activity: null,
      settings: JSON.stringify({
        summaryIntervalHours: config.assistant.summaryIntervalHours,
      }),
      created_at: new Date(),
      updated_at: new Date(),
    }], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('assistants', null, {});
  },
};