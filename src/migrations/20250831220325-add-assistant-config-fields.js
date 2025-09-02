module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('assistants', 'assistant_name', {
      type: Sequelize.STRING,
      defaultValue: 'AI Assistant',
      allowNull: false,
    });

    await queryInterface.addColumn('assistants', 'system_prompt', {
      type: Sequelize.TEXT,
      defaultValue: 'You are a helpful AI assistant acting as a personal assistant for the owner. You help filter and respond to messages professionally and courteously. Always be polite, concise, and helpful.',
      allowNull: false,
    });

    // Update existing records with default values
    await queryInterface.sequelize.query(`
      UPDATE assistants 
      SET assistant_name = 'AI Assistant'
      WHERE assistant_name IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE assistants 
      SET system_prompt = 'You are a helpful AI assistant acting as a personal assistant for the owner. You help filter and respond to messages professionally and courteously. Always be polite, concise, and helpful.'
      WHERE system_prompt IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('assistants', 'assistant_name');
    await queryInterface.removeColumn('assistants', 'system_prompt');
  },
};
