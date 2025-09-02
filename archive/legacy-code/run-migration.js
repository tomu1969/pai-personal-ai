const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: console.log
  }
);

async function runMigration() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Add assistant_name column
    await sequelize.query(`
      ALTER TABLE assistants 
      ADD COLUMN IF NOT EXISTS assistant_name VARCHAR(255) 
      DEFAULT 'AI Assistant' NOT NULL;
    `);

    // Add system_prompt column
    await sequelize.query(`
      ALTER TABLE assistants 
      ADD COLUMN IF NOT EXISTS system_prompt TEXT 
      DEFAULT 'You are a helpful AI assistant acting as a personal assistant for the owner. You help filter and respond to messages professionally and courteously. Always be polite, concise, and helpful.' NOT NULL;
    `);

    // Update existing records
    await sequelize.query(`
      UPDATE assistants 
      SET assistant_name = 'AI Assistant'
      WHERE assistant_name IS NULL OR assistant_name = '';
    `);

    await sequelize.query(`
      UPDATE assistants 
      SET system_prompt = 'You are a helpful AI assistant acting as a personal assistant for the owner. You help filter and respond to messages professionally and courteously. Always be polite, concise, and helpful.'
      WHERE system_prompt IS NULL OR system_prompt = '';
    `);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

runMigration();