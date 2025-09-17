'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('pai_mortgages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      owner_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      assistant_name: {
        type: Sequelize.STRING,
        defaultValue: 'PAI Mortgage',
        allowNull: false,
      },
      system_prompt: {
        type: Sequelize.TEXT,
        allowNull: true, // Will use prompts/pai_mortgage.md if null
      },
      mortgage_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          maxLoanAmount: 1000000,
          minCreditScore: 580,
          maxDTIRatio: 43,
          supportedLoanTypes: ['conventional', 'fha', 'va', 'usda', 'jumbo'],
          includeCategories: ['qualification', 'rates', 'documents', 'process', 'calculations'],
          enableCalculators: true,
          enablePrequalification: true,
          rateAlerts: false,
        },
        allowNull: false,
      },
      query_settings: {
        type: Sequelize.JSONB,
        defaultValue: {
          defaultLimit: 50,
          maxLimit: 200,
          enableTimeframeFallback: true,
          defaultSearchDepth: 'week',
          mortgageSpecific: true,
        },
        allowNull: false,
      },
      last_qualification_requested_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      qualifications_processed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('pai_mortgages', ['enabled']);
    await queryInterface.addIndex('pai_mortgages', ['last_activity']);
    await queryInterface.addIndex('pai_mortgages', ['last_qualification_requested_at']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('pai_mortgages');
  }
};
