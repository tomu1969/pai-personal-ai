-- Evolution API Database Initialization
-- Creates necessary databases and users for PAI System

-- Create evolution user if not exists (for Evolution API)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'evolution') THEN
        CREATE USER evolution WITH PASSWORD 'evolution123';
    END IF;
END
$$;

-- Create evolution database if not exists
SELECT 'CREATE DATABASE evolution_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution_db');

-- Grant permissions to evolution user
GRANT ALL PRIVILEGES ON DATABASE evolution_db TO evolution;

-- Create ai_pbx user if not exists (for main application)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_pbx') THEN
        CREATE USER ai_pbx WITH PASSWORD 'aipbx123';
    END IF;
END
$$;

-- Create ai_pbx database if not exists  
SELECT 'CREATE DATABASE ai_pbx_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_pbx_db');

-- Grant permissions to ai_pbx user
GRANT ALL PRIVILEGES ON DATABASE ai_pbx_db TO ai_pbx;

-- Connect to evolution_db and set up schema
\c evolution_db;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO evolution;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO evolution;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO evolution;

-- Connect to ai_pbx_db and set up schema
\c ai_pbx_db;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO ai_pbx;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ai_pbx;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ai_pbx;

-- Create extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PAI System databases initialized successfully';
    RAISE NOTICE 'Evolution API database: evolution_db (user: evolution)';
    RAISE NOTICE 'AI PBX database: ai_pbx_db (user: ai_pbx)';
END
$$;