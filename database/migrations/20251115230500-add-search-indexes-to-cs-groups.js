'use strict';

/**
 * Database Migration: Add Full-Text Search Indexes to CS Monitored Groups
 * 
 * This migration adds PostgreSQL full-text search capabilities to efficiently 
 * search through thousands of WhatsApp groups by name.
 * 
 * Features:
 * - GIN index for full-text search on group names
 * - B-tree index for case-insensitive LIKE queries
 * - Text search vector column for advanced search
 * 
 * @module database/migrations/add-search-indexes-to-cs-groups
 * @author PAI System - CS Module
 * @since November 2025
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Add text search vector column for full-text search
      await queryInterface.addColumn(
        'cs_monitored_groups',
        'search_vector',
        {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          comment: 'PostgreSQL text search vector for full-text search'
        },
        { transaction }
      );

      // 2. Create function to update search vector automatically
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_cs_groups_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector = to_tsvector('english', 
            COALESCE(NEW.group_name, '') || ' ' || 
            COALESCE(NEW.group_id, '')
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction });

      // 3. Create trigger to automatically update search vector
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS cs_groups_search_vector_trigger ON cs_monitored_groups;
        CREATE TRIGGER cs_groups_search_vector_trigger
          BEFORE INSERT OR UPDATE ON cs_monitored_groups
          FOR EACH ROW EXECUTE FUNCTION update_cs_groups_search_vector();
      `, { transaction });

      // 4. Populate search vectors for existing records
      await queryInterface.sequelize.query(`
        UPDATE cs_monitored_groups 
        SET search_vector = to_tsvector('english', 
          COALESCE(group_name, '') || ' ' || 
          COALESCE(group_id, '')
        )
        WHERE search_vector IS NULL;
      `, { transaction });

      // 5. Create GIN index for full-text search (optimal for text search)
      await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cs_groups_search_vector 
        ON cs_monitored_groups USING gin(search_vector);
      `, { transaction });

      // 6. Create B-tree index for case-insensitive LIKE queries (backup search method)
      await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cs_groups_name_lower 
        ON cs_monitored_groups (LOWER(group_name));
      `, { transaction });

      // 7. Create composite index for filtered searches with monitoring status
      await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cs_groups_monitored_name 
        ON cs_monitored_groups (is_monitored, LOWER(group_name));
      `, { transaction });

      // 8. Add index for instance-specific searches
      await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cs_groups_instance_search 
        ON cs_monitored_groups (instance_id, LOWER(group_name));
      `, { transaction });

      await transaction.commit();
      
      console.log('✅ Successfully added full-text search indexes to cs_monitored_groups');
      console.log('📊 Features added:');
      console.log('   - GIN index for full-text search');
      console.log('   - B-tree indexes for LIKE queries');
      console.log('   - Automatic search vector updates');
      console.log('   - Composite indexes for filtered searches');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Failed to add search indexes:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove indexes
      await queryInterface.sequelize.query(`
        DROP INDEX CONCURRENTLY IF EXISTS idx_cs_groups_search_vector;
        DROP INDEX CONCURRENTLY IF EXISTS idx_cs_groups_name_lower;
        DROP INDEX CONCURRENTLY IF EXISTS idx_cs_groups_monitored_name;
        DROP INDEX CONCURRENTLY IF EXISTS idx_cs_groups_instance_search;
      `, { transaction });

      // Remove trigger and function
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS cs_groups_search_vector_trigger ON cs_monitored_groups;
        DROP FUNCTION IF EXISTS update_cs_groups_search_vector();
      `, { transaction });

      // Remove search vector column
      await queryInterface.removeColumn('cs_monitored_groups', 'search_vector', { transaction });

      await transaction.commit();
      console.log('✅ Successfully removed search indexes from cs_monitored_groups');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Failed to remove search indexes:', error.message);
      throw error;
    }
  }
};