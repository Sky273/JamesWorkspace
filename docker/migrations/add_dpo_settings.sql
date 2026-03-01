-- Migration: Add DPO columns to llm_settings table
-- Date: 2026-03-01
-- Description: Adds DPO (Data Protection Officer) contact columns to existing llm_settings table

-- Add DPO columns to llm_settings table
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS dpo_name VARCHAR(255) DEFAULT '';
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS dpo_email VARCHAR(255) DEFAULT '';
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS dpo_phone VARCHAR(50) DEFAULT '';
