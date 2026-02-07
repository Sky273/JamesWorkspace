-- Migration: Add missing columns to rome_metiers and market_facts tables
-- Date: 2026-02-05
-- Description: Adds columns used by services that are missing from the schema

-- ============================================
-- TABLE: rome_metiers - Add missing columns
-- ============================================

-- Add obsolete column (boolean flag)
ALTER TABLE rome_metiers ADD COLUMN IF NOT EXISTS obsolete BOOLEAN DEFAULT FALSE;

-- Add enjeux column (JSONB for structured data)
ALTER TABLE rome_metiers ADD COLUMN IF NOT EXISTS enjeux JSONB;

-- Add macro_savoir_faire column (JSONB for structured data)
ALTER TABLE rome_metiers ADD COLUMN IF NOT EXISTS macro_savoir_faire JSONB;

-- Add savoirs column (JSONB for structured data)
ALTER TABLE rome_metiers ADD COLUMN IF NOT EXISTS savoirs JSONB;

-- ============================================
-- TABLE: market_facts - Add missing columns
-- ============================================

-- Add mean_salary column (numeric for salary data)
ALTER TABLE market_facts ADD COLUMN IF NOT EXISTS mean_salary NUMERIC(12, 2);

-- Verify rome_metiers columns
SELECT 'rome_metiers' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rome_metiers' 
ORDER BY ordinal_position;

-- Verify market_facts columns
SELECT 'market_facts' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'market_facts' 
ORDER BY ordinal_position;
